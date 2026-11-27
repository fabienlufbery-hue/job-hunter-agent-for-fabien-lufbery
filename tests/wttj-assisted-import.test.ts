import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/jobs/import/wttj/route';
import { requireOwnerSession } from '@/lib/auth';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';

vi.mock('@/lib/auth', () => ({ requireOwnerSession: vi.fn() }));
vi.mock('@/lib/jobs/repository', () => ({ upsertNormalizedJobs: vi.fn() }));

const originalUrl = 'https://www.welcometothejungle.com/fr/companies/example/jobs/role';
const request = (body: unknown, origin = 'http://localhost:3000') =>
  new Request('http://localhost:3000/api/jobs/import/wttj', {
    method: 'POST', headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });

describe('WTTJ assisted import', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireOwnerSession).mockResolvedValue({
      ok: true, session: { role: 'owner', email: 'owner@example.test', name: 'Owner', iat: 0, exp: 1 },
    });
    vi.mocked(upsertNormalizedJobs).mockResolvedValue({
      fetched: 1, inserted: 1, updated: 0, duplicates: 0, jobIds: ['job'], newJobIds: ['job'],
    });
  });
  it('stores the owner-entered reference and strips tracking parameters', async () => {
    const response = await POST(request({ originalUrl: originalUrl + '?utm_source=test#foo', title: 'Consultant junior', description: 'Mes notes' }));
    expect(response.status).toBe(200);
    expect(upsertNormalizedJobs).toHaveBeenCalledWith([{
      originalUrl, title: 'Consultant junior', description: 'Mes notes', source: 'welcome_to_the_jungle',
    }]);
  });
  it('rejects a foreign domain and a non-job URL', async () => {
    for (const url of ['https://example.test/fr/companies/a/jobs/b', 'https://www.welcometothejungle.com/fr/jobs']) {
      expect((await POST(request({ originalUrl: url, title: 'Consultant' }))).status).toBe(400);
    }
    expect(upsertNormalizedJobs).not.toHaveBeenCalled();
  });
  it('rejects a cross-origin request', async () => {
    expect((await POST(request({ originalUrl, title: 'Consultant' }, 'https://example.test'))).status).toBe(403);
    expect(upsertNormalizedJobs).not.toHaveBeenCalled();
  });
  it('rejects demo writes', async () => {
    vi.mocked(requireOwnerSession).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await POST(request({ originalUrl, title: 'Consultant' }))).status).toBe(403);
    expect(upsertNormalizedJobs).not.toHaveBeenCalled();
  });
});
