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

  it('disables retired extension endpoints', async () => {
    expect((await ingestPost(new Request('http://localhost:3000/api/jobs/ingest', { method: 'POST' }))).status).toBe(410);
    expect((await extStatusGet(new Request('http://localhost:3000/api/extension/status'))).status).toBe(410);
  });

  it('protects POST /api/cron/sync with CRON_SECRET', async () => {
    const res = await cronPost(
      new Request('http://localhost:3000/api/cron/sync', { method: 'POST' })
    );
    expect(res.status).toBe(401);
  });
});
