import { describe, expect, it } from 'vitest';
import {
  buildApifyRunInput,
  fetchNormalizedDatasetItems,
  formatApifyPathId,
  normalizeApifyItem,
  startApifyRun,
  testApifyConnection,
} from '@/lib/apify/client';

describe('Apify API v2 — Normalization, PII-Free Input Builder & Client', () => {
  it('normalizes offers from WTTJ, LinkedIn, Indeed, HelloWork, Meteojob and other authorized hosts', () => {
    const wttj = normalizeApifyItem({
      jobTitle: 'Senior Full-Stack Engineer',
      companyName: 'Helios',
      location: 'Paris',
      contractType: 'CDI',
      descriptionHtml: '<p>TypeScript &amp; Next.js</p>',
      jobUrl: 'https://www.welcometothejungle.com/fr/companies/helios/jobs/senior-fs',
    });
    expect(wttj).toMatchObject({
      source: 'welcome_to_the_jungle',
      title: 'Senior Full-Stack Engineer',
      company: 'Helios',
      description: 'TypeScript & Next.js',
    });

    const linkedin = normalizeApifyItem({
      title: 'AI Product Engineer',
      company: { name: 'NovaCloud' },
      formattedLocation: 'Paris, Île-de-France',
      jobUrl: 'https://www.linkedin.com/jobs/view/123456789',
      skills: ['TypeScript', 'PostgreSQL'],
    });
    expect(linkedin).toMatchObject({
      source: 'linkedin',
      company: 'NovaCloud',
      location: 'Paris, Île-de-France',
      skills: ['TypeScript', 'PostgreSQL'],
    });

    const indeed = normalizeApifyItem({
      positionName: 'Backend Node.js',
      company: 'Acme',
      salary: '55 000 € - 65 000 €',
      url: 'https://fr.indeed.com/viewjob?jk=abc999',
    });
    expect(indeed).toMatchObject({
      source: 'indeed',
      title: 'Backend Node.js',
      salary: '55 000 € - 65 000 €',
    });

    const other = normalizeApifyItem(
      {
        title: 'Product Engineer',
        companyName: 'StartupEU',
        url: 'https://jobs.lever.co/startupeu/abc-123',
      },
      { allowOtherHosts: true, fallbackPlatform: 'other' }
    );
    expect(other).toMatchObject({
      source: 'other',
      company: 'StartupEU',
    });
  });

  it('rejects unsafe URLs, local/test hosts, credentials in URL, and WTTJ index pages', () => {
    expect(normalizeApifyItem({ title: 'Dev', url: 'http://fr.indeed.com/viewjob?jk=1' })).toBeNull();
    expect(normalizeApifyItem({ title: 'Dev', url: 'https://localhost:3000/jobs/1' }, { allowOtherHosts: true })).toBeNull();
    expect(normalizeApifyItem({ title: 'Dev', url: 'https://example.test/jobs/role' }, { allowOtherHosts: true })).toBeNull();
    expect(normalizeApifyItem({ title: 'Dev', url: 'https://user:pass@fr.indeed.com/viewjob?jk=1' })).toBeNull();
    expect(normalizeApifyItem({ title: 'Dev', url: 'https://www.welcometothejungle.com/fr/jobs' })).toBeNull();
  });

  it('formats Apify actor/task IDs and builds PII-free search inputs from user preferences', () => {
    expect(formatApifyPathId('curious_coder/indeed-scraper')).toBe('curious_coder~indeed-scraper');
    expect(() => formatApifyPathId('invalid id with spaces!')).toThrow(/invalide/i);

    const actorInput = buildApifyRunInput({
      kind: 'actor',
      platform: 'indeed',
      preferences: {
        targetRoles: ['AI Engineer'],
        keywords: ['TypeScript'],
        cities: ['Paris'],
        sectors: ['SaaS'],
        contractTypes: ['CDI'],
        remotePolicy: 'hybrid',
        maxItems: 25,
      },
    });
    expect(actorInput).toEqual({
      country: 'FR',
      position: 'AI Engineer TypeScript',
      location: 'Paris',
      maxItems: 25,
      parseCompanyDetails: false,
    });

    const taskInput = buildApifyRunInput({
      kind: 'task',
      platform: 'linkedin',
      preferences: {
        targetRoles: ['Full-Stack'],
        keywords: [],
        cities: ['Lyon'],
        sectors: [],
        contractTypes: ['CDI'],
        remotePolicy: 'any',
        maxItems: 20,
      },
      inputTemplate: { search: '{{query}}', city: '{{location}}', limit: '{{maxItems}}' },
    });
    expect(taskInput).toEqual({ search: 'Full-Stack', city: 'Lyon', limit: 20 });
  });

  it('tests real Apify API v2 auth, task discovery, cost-capped run trigger, dataset fetch, and quota errors (simulated HTTP)', async () => {
    const calls: Array<{ url: string; method: string; auth: string | null }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, method: init?.method || 'GET', auth: headers.get('authorization') });

      if (url.endsWith('/users/me')) {
        return Response.json({
          data: { username: 'fabien_demo', plan: { id: 'FREE', monthlyUsageCreditsUsd: 5 } },
        });
      }
      if (url.includes('/actor-tasks?limit=50')) {
        return Response.json({
          data: { items: [{ id: 'task-123', name: 'my-indeed-task', title: 'Indeed FR', actId: 'curious_coder/indeed-scraper' }] },
        });
      }
      if (url.includes('/actors/curious_coder~indeed-scraper/runs?')) {
        expect(url).toContain('maxTotalChargeUsd=0.45');
        expect(url).toContain('maxItems=20');
        expect(url).toContain('timeout=90');
        return Response.json({
          data: { id: 'run_abc123', status: 'RUNNING', defaultDatasetId: 'ds_xyz', usageTotalUsd: 0.01 },
        });
      }
      if (url.includes('/datasets/ds_xyz/items?')) {
        return Response.json([
          {
            title: 'TypeScript Engineer',
            companyName: 'CloudParis',
            location: 'Paris',
            url: 'https://fr.indeed.com/viewjob?jk=ts1',
          },
        ]);
      }
      return new Response('Quota exceeded', { status: 402 });
    };

    const conn = await testApifyConnection({ token: 'apify_test_tok', fetchImpl: mockFetch });
    expect(conn.connected).toBe(true);
    expect(conn.account?.username).toBe('fabien_demo');
    expect(conn.tasksCount).toBe(1);
    expect(calls[0].auth).toBe('Bearer apify_test_tok');

    const run = await startApifyRun({
      kind: 'actor',
      apifyId: 'curious_coder/indeed-scraper',
      platform: 'indeed',
      preferences: {
        targetRoles: ['TypeScript'],
        keywords: [],
        cities: ['Paris'],
        sectors: [],
        contractTypes: ['CDI'],
        remotePolicy: 'any',
        maxItems: 20,
      },
      maxCostUsd: 0.45,
      timeoutSecs: 90,
      token: 'apify_test_tok',
      fetchImpl: mockFetch,
    });
    expect(run.id).toBe('run_abc123');

    const ds = await fetchNormalizedDatasetItems({
      datasetId: 'ds_xyz',
      token: 'apify_test_tok',
      fetchImpl: mockFetch,
    });
    expect(ds.offers).toHaveLength(1);
    expect(ds.offers[0].source).toBe('indeed');

    const missing = await testApifyConnection({ token: '' });
    expect(missing.connected).toBe(false);
    expect(missing.configured).toBe(false);
  });
});
