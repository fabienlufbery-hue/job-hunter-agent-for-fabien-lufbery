import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb, resetTestDatabase, schema } from '@/db';
import { getNextScheduledRunParis } from '@/lib/automation/scheduler';
import { POST as cronPost } from '@/app/api/cron/sync/route';
import { verifyExtensionToken, verifyOwnerCredentials } from '@/lib/auth';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Scheduled collection', () => {
  it('keeps the next Paris slot if the clock is already seconds away', () => {
    expect(getNextScheduledRunParis(new Date('2026-11-27T07:59:59Z')).iso)
      .toBe('2026-11-27T08:00:00.000Z');
    expect(getNextScheduledRunParis(new Date('2026-07-27T06:59:59Z')).iso)
      .toBe('2026-07-27T07:00:00.000Z');
  });

  it('claims a Paris slot once and records a failed provider run as a failure', async () => {
    await resetTestDatabase();
    vi.stubEnv('CRON_SECRET', 'test-only-secret');
    vi.stubEnv('APIFY_API_TOKEN', '');
    vi.stubEnv('APIFY_TASK_ID', '');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T08:02:00Z'));
    const makeRequest = () => new Request('http://localhost:3000/api/cron/sync', {
      method: 'POST', headers: { Authorization: 'Bearer test-only-secret' },
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

  it('syncs only authorized open tabs, stops at verification pages and runs once per slot', async () => {
    const storage: Record<string, unknown> = {
      authorizedSources: ['indeed', 'hellowork'],
      backendUrl: 'http://localhost:3000',
    };
    const alarm = vi.fn();
    const sendMessage = vi.fn(async (id: number) => id === 1 ? {
      ok: true,
      platform: 'indeed',
      jobs: [{ title: 'Test', source: 'indeed', originalUrl: 'https://fr.indeed.com/viewjob?jk=test' }],
    } : { ok: true, platform: 'hellowork', humanActionRequired: true, jobs: [] });
    const fetch = vi.fn<(url: string) => Promise<Response>>(async () => Response.json({ inserted: 1, totalImportedAllTime: 1 }));
    const chrome = {
      alarms: { onAlarm: { addListener: alarm }, get: async () => true },
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
      },
      storage: {
        local: {
          setAccessLevel: vi.fn(),
          get: async () => ({ ...storage }),
          set: async (data: object) => Object.assign(storage, data),
        },
      },
      tabs: {
        query: async () => [
          { id: 1, url: 'https://fr.indeed.com/viewjob?jk=test' },
          { id: 2, url: 'https://www.hellowork.com/fr-fr/emplois/42.html' },
          { id: 3, url: 'https://www.meteojob.com/jobs/42' },
        ],
        sendMessage,
      },
      action: { setBadgeText: vi.fn() },
    };
    const context = vm.createContext({ chrome, fetch, URL, Intl, Date });
    context.importScripts = (path: string) =>
      vm.runInContext(readFileSync(`extension/${path}`, 'utf8'), context);
    vm.runInContext(readFileSync('extension/background.js', 'utf8'), context);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T08:00:00Z'));
    context.Date = Date;
    const fire = alarm.mock.calls[0][0];
    await fire({ name: 'job_hunter_schedule_check' });
    await fire({ name: 'job_hunter_schedule_check' });
    expect(sendMessage.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/api/jobs/ingest'))).toHaveLength(1);
    expect(storage.scheduleStatus).toContain('Intervention requise');
  });

  it('disables default owner credentials and the extension token in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_EMAIL', '');
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubEnv('ADMIN_PASSWORD_HASH', '');
    vi.stubEnv('EXTENSION_INGEST_TOKEN', '');
    expect(verifyOwnerCredentials('fabien.lufbery@local.dev', 'local-dev-only')).toBe(false);
    expect(verifyExtensionToken(new Request('https://example.com', {
      headers: { 'X-Extension-Token': 'dev-extension-token' },
    })).valid).toBe(false);
  });
});
