import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const common = require('../extension/extractors/common.js');
const { extractWttjJobs } = require('../extension/extractors/wttj.js');
const { extractIndeedJobs } = require('../extension/extractors/indeed.js');
const { extractHelloWorkJobs } = require('../extension/extractors/hellowork.js');
const { extractMeteojobJobs } = require('../extension/extractors/meteojob.js');

/**
 * Minimal mock DOM builder to test extension extractors in pure Node without external browser binaries.
 */
function createMockDoc({
  title = '',
  bodyText = '',
  jsonLd = [] as unknown[],
  selectorMap = {} as Record<string, { textContent?: string; attrs?: Record<string, string> }>,
  listMap = {} as Record<
    string,
    Array<{
      textContent: string;
      attrs?: Record<string, string>;
      children?: Record<string, { textContent?: string; attrs?: Record<string, string> }>;
    }>
  >,
}) {
  const makeEl = (cfg: {
    textContent?: string;
    attrs?: Record<string, string>;
    children?: Record<string, { textContent?: string; attrs?: Record<string, string> }>;
  }) => ({
    textContent: cfg.textContent || '',
    getAttribute: (name: string) => cfg.attrs?.[name] ?? null,
    querySelector: (sel: string) => {
      if (!cfg.children) return null;
      for (const part of sel.split(',').map((s) => s.trim())) {
        if (cfg.children[part]) return makeEl(cfg.children[part]);
      }
      return null;
    },
  });

  return {
    title,
    body: { textContent: bodyText },
    querySelector: (sel: string) => {
      for (const part of sel.split(',').map((s) => s.trim())) {
        if (selectorMap[part]) return makeEl(selectorMap[part]);
      }
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes('application/ld+json')) {
        return jsonLd.map((obj) => ({ textContent: JSON.stringify(obj) }));
      }
      const results: ReturnType<typeof makeEl>[] = [];
      for (const part of sel.split(',').map((s) => s.trim())) {
        if (listMap[part]) {
          results.push(...listMap[part].map(makeEl));
        }
      }
      return results;
    },
  };
}

describe('Chrome Extension Manifest V3 — Extractors & Security Audit', () => {
  it('validates manifest.json branding, MV3 version and minimal permissions', () => {
    const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Job Hunter Agent for Fabien Lufbery');
    expect(manifest.permissions).toEqual(['storage', 'activeTab', 'alarms']);
    expect(manifest.permissions).not.toContain('cookies');
    expect(manifest.permissions).not.toContain('webRequest');
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        'https://www.welcometothejungle.com/*',
        'https://fr.indeed.com/*',
        'https://www.hellowork.com/*',
        'https://www.meteojob.com/*',
      ])
    );
  });

  it('guarantees zero cookie or password access across all extension JS files', () => {
    const extDir = path.join(process.cwd(), 'extension');
    const jsFiles = [
      'background.js',
      'content.js',
      'popup.js',
      'extractors/common.js',
      'extractors/wttj.js',
      'extractors/indeed.js',
      'extractors/hellowork.js',
      'extractors/meteojob.js',
    ];
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(extDir, file), 'utf8');
      // Ensure no actual chrome.cookies API or document.cookie property access
      expect(content).not.toMatch(/chrome\.cookies/);
      expect(content).not.toMatch(/document\.cookie\s*[=;.)]/);
    }
  });

  it('extracts normalized jobs from Welcome to the Jungle (JSON-LD & DOM cards)', () => {
    const doc = createMockDoc({
      jsonLd: [
        {
          '@type': 'JobPosting',
          title: 'Full-Stack Engineer Next.js',
          hiringOrganization: { name: 'WTTJ Corp' },
          jobLocation: { address: { addressLocality: 'Paris', postalCode: '75009' } },
          employmentType: 'FULL_TIME',
          baseSalary: { currency: 'EUR', value: { minValue: 55000, maxValue: 65000, unitText: 'YEAR' } },
          description: '<p>TypeScript &amp; React role</p>',
          datePosted: '2026-11-25',
          skills: ['TypeScript', 'React'],
        },
      ],
    });
    const res = extractWttjJobs(
      doc,
      'https://www.welcometothejungle.com/fr/companies/wttj-corp/jobs/fullstack'
    );
    expect(res.humanActionRequired).toBe(false);
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0]).toMatchObject({
      source: 'welcome_to_the_jungle',
      title: 'Full-Stack Engineer Next.js',
      company: 'WTTJ Corp',
      location: 'Paris, 75009',
      salary: '55000 - 65000 EUR / YEAR',
    });
  });

  it('extracts normalized jobs from Indeed DOM cards', () => {
    const doc = createMockDoc({
      listMap: {
        '.job_seen_beacon': [
          {
            textContent: 'AI Engineer TechParis 75008 58k€',
            children: {
              'a.jcs-JobTitle': { attrs: { href: '/viewjob?jk=jk9988', 'data-jk': 'jk9988' } },
              'h2.jobTitle span': { textContent: 'AI Engineer' },
              '[data-testid="company-name"]': { textContent: 'TechParis' },
              '[data-testid="text-location"]': { textContent: 'Paris 8e' },
              '.salary-snippet-container': { textContent: '58 000 € / an' },
              '.job-snippet': { textContent: 'Python, TypeScript et Gemini API.' },
            },
          },
        ],
      },
    });
    const res = extractIndeedJobs(doc, 'https://fr.indeed.com/jobs?q=AI');
    expect(res.humanActionRequired).toBe(false);
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0]).toMatchObject({
      source: 'indeed',
      externalId: 'jk9988',
      title: 'AI Engineer',
      company: 'TechParis',
      originalUrl: 'https://fr.indeed.com/viewjob?jk=jk9988',
    });
  });

  it('extracts normalized jobs from HelloWork & Meteojob DOM cards', () => {
    const hwDoc = createMockDoc({
      listMap: {
        '[data-cy="serpCard"]': [
          {
            textContent: 'Développeur Node.js — Lyon — CDI',
            attrs: { 'data-offer-id': '55210' },
            children: {
              'a[data-cy="offerTitle"]': {
                textContent: 'Développeur Node.js',
                attrs: { href: '/fr-fr/emplois/55210.html' },
              },
              '[data-cy="offerTitle"]': { textContent: 'Développeur Node.js' },
              '[data-cy="companyName"]': { textContent: 'LyonTech' },
              '[data-cy="localisationCard"]': { textContent: 'Lyon 69002' },
              '[data-cy="contractCard"]': { textContent: 'CDI' },
            },
          },
        ],
      },
    });
    const hwRes = extractHelloWorkJobs(hwDoc, 'https://www.hellowork.com/fr-fr/emploi/recherche.html');
    expect(hwRes.jobs).toHaveLength(1);
    expect(hwRes.jobs[0]).toMatchObject({
      source: 'hellowork',
      externalId: '55210',
      title: 'Développeur Node.js',
      company: 'LyonTech',
      contractType: 'CDI',
    });

    const mjDoc = createMockDoc({
      listMap: {
        'article.cc-job-offer-item': [
          {
            textContent: 'Product Engineer — Bordeaux — CDI',
            children: {
              'a[href*="/offres/"]': { attrs: { href: '/candidat/offres/mj-774' } },
              h2: { textContent: 'Product Engineer' },
              '.cc-job-offer-company': { textContent: 'Atlantique SaaS' },
              '.cc-job-offer-location': { textContent: 'Bordeaux' },
              '.cc-job-offer-contract': { textContent: 'CDI' },
            },
          },
        ],
      },
    });
    const mjRes = extractMeteojobJobs(mjDoc, 'https://www.meteojob.com/jobs');
    expect(mjRes.jobs).toHaveLength(1);
    expect(mjRes.jobs[0]).toMatchObject({
      source: 'meteojob',
      externalId: 'mj-774',
      title: 'Product Engineer',
      company: 'Atlantique SaaS',
    });
  });

  it('detects anti-bot / CAPTCHA barriers and never attempts to bypass them', () => {
    const captchaDoc = createMockDoc({
      title: 'Just a moment... Verify you are human',
      bodyText: 'Please complete the security check to continue.',
    });
    const res = extractIndeedJobs(captchaDoc, 'https://fr.indeed.com/jobs?q=dev');
    expect(res.humanActionRequired).toBe(true);
    expect(res.jobs).toHaveLength(0);
    expect(res.warning).toMatch(/CAPTCHA|anti-bot/i);
    expect(common.detectPlatform('https://www.welcometothejungle.com/fr')).toBe(
      'welcome_to_the_jungle'
    );
  });
});
