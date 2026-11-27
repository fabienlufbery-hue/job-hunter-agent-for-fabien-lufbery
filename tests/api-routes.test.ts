import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase } from '@/db';
import { resetRateLimitsForTests } from '@/lib/security';
import { createSessionToken } from '@/lib/auth';
import { GET as healthGet } from '@/app/api/health/route';
import { POST as cronPost } from '@/app/api/cron/sync/route';
import { POST as webhookPost } from '@/app/api/apify/webhook/route';
import { GET as integrationsGet } from '@/app/api/integrations/status/route';
import { GET as settingsGet, PUT as settingsPut } from '@/app/api/settings/route';
import { GET as sourcesGet, POST as sourcesPost } from '@/app/api/apify/sources/route';

const session = vi.hoisted(() => ({ token: '' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => session.token && { value: session.token } }),
}));

describe('Backend API Route Integration & Security Tests', () => {
  beforeEach(async () => {
    session.token = '';
    await resetTestDatabase();
    resetRateLimitsForTests();
  });

  it('returns healthy status with app branding on GET /api/health', async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.app).toBe('Job Hunter Agent for Fabien Lufbery');
    expect(data.database.connected).toBe(true);
  });

  it('protects POST /api/cron/sync with CRON_SECRET and POST /api/apify/webhook with HMAC signature', async () => {
    const cronRes = await cronPost(
      new Request('http://localhost:3000/api/cron/sync', { method: 'POST' })
    );
    expect(cronRes.status).toBe(401);

    const webhookRes = await webhookPost(
      new Request('http://localhost:3000/api/apify/webhook?runId=abc&sig=bad', { method: 'POST' })
    );
    expect(webhookRes.status).toBe(401);
  });

  it('exposes ONLY Gemini, Apify, and PostgreSQL/Neon on GET /api/integrations/status', async () => {
    expect((await integrationsGet()).status).toBe(401);

    session.token = createSessionToken({ role: 'owner', email: 'owner@test.fr', name: 'Fabien' });
    const res = await integrationsGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.integrations.map((i: { id: string }) => i.id)).toEqual([
      'gemini',
      'apify',
      'database',
    ]);
    // Unconfigured external APIs must NEVER falsely claim connected
    const gemini = data.integrations.find((i: { id: string }) => i.id === 'gemini');
    const apify = data.integrations.find((i: { id: string }) => i.id === 'apify');
    expect(gemini.status).not.toBe('connected');
    expect(apify.status).not.toBe('connected');
  });

  it('allows owner to manage Apify sources and consumption settings while blocking unauthenticated/demo writes', async () => {
    expect((await settingsGet()).status).toBe(401);

    session.token = createSessionToken({ role: 'owner', email: 'owner@test.fr', name: 'Fabien' });
    const putRes = await settingsPut(
      new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ monthlyApifyBudgetUsd: 10, maxCostPerRunUsd: 0.6 }),
      })
    );
    expect(putRes.status).toBe(200);
    const updated = await putRes.json();
    expect(updated.settings.monthlyApifyBudgetUsd).toBe(10);

    const createSrc = await sourcesPost(
      new Request('http://localhost:3000/api/apify/sources', {
        method: 'POST',
        body: JSON.stringify({
          name: 'WTTJ SaaS',
          kind: 'actor',
          apifyId: 'bebity/welcome-to-the-jungle-jobs-scraper',
          platform: 'welcome_to_the_jungle',
          executionMode: 'run_and_fetch',
        }),
      })
    );
    expect(createSrc.status).toBe(201);

    const listRes = await sourcesGet(new Request('http://localhost:3000/api/apify/sources'));
    const listData = await listRes.json();
    expect(listData.sources).toHaveLength(1);
    expect(listData.sources[0].apifyId).toBe('bebity/welcome-to-the-jungle-jobs-scraper');
  });
});
