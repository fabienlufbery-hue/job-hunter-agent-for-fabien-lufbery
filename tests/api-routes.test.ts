import { beforeEach, describe, expect, it } from 'vitest';
import { resetTestDatabase } from '@/db';
import { resetRateLimitsForTests } from '@/lib/security';
import { GET as healthGet } from '@/app/api/health/route';
import { POST as ingestPost } from '@/app/api/jobs/ingest/route';
import { GET as extStatusGet } from '@/app/api/extension/status/route';
import { POST as cronPost } from '@/app/api/cron/sync/route';

describe('Backend API Route Integration & Security Tests', () => {
  beforeEach(async () => {
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

  it('rejects unauthenticated or cookie-bearing payloads on POST /api/jobs/ingest', async () => {
    const noTokenRes = await ingestPost(
      new Request('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: [] }),
      })
    );
    expect(noTokenRes.status).toBe(401);

    const cookiePayloadRes = await ingestPost(
      new Request('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Token': 'dev-extension-token',
        },
        body: JSON.stringify({
          cookies: 'session=secret',
          jobs: [
            {
              title: 'Dev',
              originalUrl: 'https://www.welcometothejungle.com/fr/companies/a/jobs/b',
              source: 'welcome_to_the_jungle',
            },
          ],
        }),
      })
    );
    expect(cookiePayloadRes.status).toBe(400);
  });

  it('ingests, deduplicates, and updates extension heartbeat via POST /api/jobs/ingest', async () => {
    const reqBody = {
      extensionVersion: '1.0.0',
      platform: 'welcome_to_the_jungle',
      jobs: [
        {
          externalId: 'wttj-int-1',
          title: 'Ingénieur Full-Stack TypeScript',
          company: 'Studio Lumière',
          location: 'Paris',
          contractType: 'CDI',
          description: 'Next.js, PostgreSQL, Gemini.',
          skills: ['TypeScript', 'Next.js'],
          originalUrl: 'https://www.welcometothejungle.com/fr/companies/lumiere/jobs/fs',
          source: 'welcome_to_the_jungle',
        },
      ],
    };

    const res1 = await ingestPost(
      new Request('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Token': 'dev-extension-token',
        },
        body: JSON.stringify(reqBody),
      })
    );
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.inserted).toBe(1);
    expect(data1.duplicates).toBe(0);

    // Second identical ingest must deduplicate
    const res2 = await ingestPost(
      new Request('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Token': 'dev-extension-token',
        },
        body: JSON.stringify(reqBody),
      })
    );
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.inserted).toBe(0);
    expect(data2.duplicates).toBe(1);

    // Extension status endpoint verifies heartbeat persisted
    const statusRes = await extStatusGet(
      new Request('http://localhost:3000/api/extension/status', {
        headers: { 'X-Extension-Token': 'dev-extension-token' },
      })
    );
    expect(statusRes.status).toBe(200);
    const statusData = await statusRes.json();
    expect(statusData.authenticated).toBe(true);
    expect(statusData.heartbeat.totalImported).toBe(1);
  });

  it('protects POST /api/cron/sync with CRON_SECRET', async () => {
    const res = await cronPost(
      new Request('http://localhost:3000/api/cron/sync', { method: 'POST' })
    );
    expect(res.status).toBe(401);
  });
});
