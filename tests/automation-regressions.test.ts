import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb, resetTestDatabase, schema } from '@/db';
import {
  ConcurrentRunError,
  getNextScheduledRunParis,
  pollPendingApifyRuns,
  runServerAutomationSync,
} from '@/lib/automation/scheduler';
import { createApifySource, upsertAppSettings } from '@/lib/apify/repository';
import { POST as cronPost } from '@/app/api/cron/sync/route';
import { verifyOwnerCredentials } from '@/lib/auth';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Automation Pipeline, Concurrency Lock, Budget Guard & Async Apify Recovery', () => {
  it('computes DST-safe 09:00 and 18:00 Europe/Paris slots accurately', () => {
    expect(getNextScheduledRunParis(new Date('2026-11-27T07:59:59Z')).iso).toBe(
      '2026-11-27T08:00:00.000Z'
    );
    expect(getNextScheduledRunParis(new Date('2026-07-27T06:59:59Z')).iso).toBe(
      '2026-07-27T07:00:00.000Z'
    );
  });

  it('claims a Paris slot once atomically and records a failed unconfigured run', async () => {
    await resetTestDatabase();
    vi.stubEnv('CRON_SECRET', 'test-only-secret');
    vi.stubEnv('APIFY_API_TOKEN', '');
    vi.stubEnv('APIFY_TASK_ID', '');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T08:02:00Z'));

    const makeRequest = () =>
      new Request('http://localhost:3000/api/cron/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-only-secret' },
      });

    const outcomes = await Promise.all([cronPost(makeRequest()), cronPost(makeRequest())]);
    expect(outcomes.map(({ status }) => status).sort()).toEqual([200, 503]);

    const records = await (await getDb()).select().from(schema.automationRuns);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      triggerType: 'scheduled_09',
      status: 'failed',
      errors: [expect.objectContaining({ code: 'NOT_CONFIGURED' })],
    });
  });

  it('handles async Apify execution handoff, concurrency lock, and deferred dataset import', async () => {
    await resetTestDatabase();
    vi.stubEnv('APIFY_API_TOKEN', 'apify_test_secret');
    vi.stubEnv('GEMINI_API_KEY', '');

    await createApifySource({
      name: 'Indeed Test Async',
      kind: 'actor',
      apifyId: 'curious_coder/indeed-scraper',
      platform: 'indeed',
      executionMode: 'run_and_fetch',
      maxItems: 10,
      maxCostUsd: 0.4,
    });

    let pollCount = 0;
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/actors/curious_coder~indeed-scraper/runs?')) {
        return Response.json({
          data: { id: 'async_run_1', status: 'RUNNING', defaultDatasetId: 'ds_async_1', usageTotalUsd: 0.01 },
        });
      }
      if (url.includes('/actor-runs/async_run_1')) {
        pollCount += 1;
        if (pollCount <= 2) {
          return Response.json({
            data: { id: 'async_run_1', status: 'RUNNING', defaultDatasetId: 'ds_async_1', usageTotalUsd: 0.02 },
          });
        }
        return Response.json({
          data: { id: 'async_run_1', status: 'SUCCEEDED', defaultDatasetId: 'ds_async_1', usageTotalUsd: 0.05 },
        });
      }
      if (url.includes('/datasets/ds_async_1/items')) {
        return Response.json([
          {
            title: 'AI Engineer Async',
            companyName: 'NeonTech',
            location: 'Paris',
            url: 'https://fr.indeed.com/viewjob?jk=async99',
          },
        ]);
      }
      return new Response('Not found', { status: 404 });
    };

    const run = await runServerAutomationSync({
      triggerType: 'manual',
      waitForFinishSecs: 0,
      fetchImpl: mockFetch,
    });

    expect(run?.status).toBe('running');
    expect(run?.hasAsyncPending).toBe(true);

    // Simultaneous manual trigger must be rejected while active run is running
    await expect(
      runServerAutomationSync({ triggerType: 'manual', fetchImpl: mockFetch })
    ).rejects.toThrow(ConcurrentRunError);

    // Deferred poll finalizes the Apify run, imports offers, and records real USD cost
    const polled = await pollPendingApifyRuns({
      automationRunId: run!.runId,
      waitForFinishSecs: 0,
      fetchImpl: mockFetch,
    });
    expect(polled.stillRunning).toBe(0);
    expect(polled.inserted).toBe(1);
    expect(polled.costUsd).toBe(0.05);

    const savedJobs = await (await getDb()).select().from(schema.jobs);
    expect(savedJobs).toHaveLength(1);
    expect(savedJobs[0].title).toBe('AI Engineer Async');
  });

  it('blocks Apify paid launches when monthly budget cap is reached', async () => {
    await resetTestDatabase();
    vi.stubEnv('APIFY_API_TOKEN', 'apify_test_secret');
    await upsertAppSettings({ monthlyApifyBudgetUsd: 0.5, maxCostPerRunUsd: 0.5 });

    const src = await createApifySource({
      name: 'Budget Test Actor',
      kind: 'actor',
      apifyId: 'curious_coder/indeed-scraper',
      platform: 'indeed',
      executionMode: 'run_and_fetch',
    });

    // Seed existing monthly spend equal to cap
    await (await getDb()).insert(schema.apifyRuns).values({
      id: 'prior-spend',
      sourceId: src!.id,
      sourceName: 'Budget Test Actor',
      kind: 'actor',
      apifyId: 'curious_coder/indeed-scraper',
      apifyRunId: 'prior-1',
      status: 'IMPORTED',
      costUsd: 0.5,
      startedAt: new Date(),
    });

    const run = await runServerAutomationSync({
      triggerType: 'manual',
      force: true,
      fetchImpl: async () => {
        throw new Error('Should never call Apify when budget exceeded');
      },
    });
    expect(run?.status).toBe('failed');
    expect(run?.errors[0]?.code).toBe('BUDGET_EXCEEDED');
  });

  it('disables default owner credentials in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_EMAIL', '');
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubEnv('ADMIN_PASSWORD_HASH', '');
    expect(verifyOwnerCredentials('fabien.lufbery@local.dev', 'local-dev-only')).toBe(false);
  });
});
