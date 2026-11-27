import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb, resetTestDatabase } from '@/db';
import { createSessionToken } from '@/lib/auth';
import { POST as createDemo } from '@/app/api/auth/demo/route';
import { GET, PUT, DELETE } from '@/app/api/cv/route';
import { GET as listJobs } from '@/app/api/jobs/route';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';

const session = vi.hoisted(() => ({ token: '' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => session.token && { value: session.token } }),
}));

afterEach(async () => {
  session.token = '';
  await resetTestDatabase();
  vi.unstubAllEnvs();
});

describe('Private data and public demo session', () => {
  it('keeps the private CV and jobs out of the demo and restricts mutations to owner', async () => {
    await resetTestDatabase();
    const saveCV = (fullName: string) => PUT(new Request('http://localhost:3000/api/cv', {
      method: 'PUT',
      body: JSON.stringify({ fullName, technicalSkills: ['TypeScript'] }),
    }));
    const jobRequest = new Request('http://localhost:3000/api/jobs');
    expect((await GET()).status).toBe(401);

    session.token = createSessionToken({ role: 'owner', email: 'owner@example.com', name: 'Owner' });
    expect((await saveCV('Candidat Fictif')).status).toBe(200);
    expect((await saveCV('Candidat Fictif Modifié')).status).toBe(200);
    const ownerCV = await (await GET()).json();
    expect(ownerCV.cv.fullName).toBe('Candidat Fictif Modifié');
    await upsertNormalizedJobs([{
      title: 'Offre privée de qualification',
      originalUrl: 'https://fr.indeed.com/viewjob?jk=demo-private-test',
      source: 'indeed',
    }]);
    expect(JSON.stringify(await (await listJobs(jobRequest)).json()))
      .toContain('Offre privée de qualification');

    const demo = await createDemo();
    session.token = demo.cookies.get('jh_session')?.value ?? '';
    expect(demo.headers.get('set-cookie')).toContain('HttpOnly');
    const demoCV = await (await GET()).json();
    expect(demoCV.isDemo).toBe(true);
    expect(demoCV.cv.fullName).not.toBe(ownerCV.cv.fullName);
    expect(JSON.stringify(await (await listJobs(jobRequest)).json()))
      .not.toContain('Offre privée de qualification');
    expect((await saveCV('Modification de Démo')).status).toBe(403);
    expect((await DELETE()).status).toBe(403);

    session.token = createSessionToken({ role: 'owner', email: 'owner@example.com', name: 'Owner' });
    expect((await DELETE()).status).toBe(200);
    expect((await (await GET()).json()).cv).toBeNull();
    expect(await getDb()).toBeDefined();
  });
});
