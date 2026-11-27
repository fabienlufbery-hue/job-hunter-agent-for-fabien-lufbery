import { beforeEach, describe, expect, it } from 'vitest';
import { checkDatabaseHealth, resetTestDatabase } from '@/db';
import {
  extractExplicitRecruiterEmail,
  normalizeContractType,
  normalizeJobInput,
} from '@/lib/jobs/normalize';
import { listJobsWithAnalyses, upsertNormalizedJobs } from '@/lib/jobs/repository';

describe('Job Normalization, Deduplication & PostgreSQL Persistence (PGlite)', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('normalizes contract types and never invents missing fields or recruiter emails', () => {
    expect(normalizeContractType('Contrat à durée indéterminée')).toBe('CDI');
    expect(normalizeContractType('Alternance / Apprentissage')).toBe('Alternance');
    expect(normalizeContractType('Mission intérimaire')).toBe('Intérim');

    expect(extractExplicitRecruiterEmail('Contact: noreply@company.fr')).toBeNull();
    expect(extractExplicitRecruiterEmail('Postulez via jobs@acme.fr')).toBe('jobs@acme.fr');

    const normalized = normalizeJobInput({
      title: 'Développeur Next.js',
      originalUrl: 'https://www.welcometothejungle.com/fr/companies/acme/jobs/dev?utm_source=test',
      source: 'welcome_to_the_jungle',
      description: 'Poste full-stack sans email mentionné.',
    });

    expect(normalized.company).toBeNull();
    expect(normalized.salary).toBeNull();
    expect(normalized.recruiterEmail).toBeNull();
    expect(normalized.originalUrl).toBe(
      'https://www.welcometothejungle.com/fr/companies/acme/jobs/dev'
    );
  });

  it('persists offers from Apify multi-platform sources and deduplicates preserving provenance', async () => {
    const health = await checkDatabaseHealth();
    expect(health.connected).toBe(true);

    const firstBatch = await upsertNormalizedJobs([
      {
        externalId: 'wttj-1',
        title: 'AI Product Engineer',
        company: 'Helios Labs',
        location: 'Paris',
        contractType: 'CDI',
        description: 'Description courte.',
        skills: ['TypeScript', 'Next.js'],
        originalUrl: 'https://www.welcometothejungle.com/fr/companies/helios/jobs/ai-eng',
        source: 'welcome_to_the_jungle',
      },
      {
        externalId: 'li-100',
        title: 'Ingénieur Cloud Node.js',
        company: 'NovaCloud',
        location: 'Lyon',
        contractType: 'CDI',
        salary: '55 k€',
        description: 'API Node.js et PostgreSQL.',
        skills: ['Node.js', 'PostgreSQL'],
        originalUrl: 'https://www.linkedin.com/jobs/view/100',
        source: 'linkedin',
      },
      {
        externalId: 'hw-1',
        title: 'Développeur React',
        company: 'Veridian',
        location: 'Bordeaux',
        contractType: 'CDD',
        description: 'Frontend React Tailwind.',
        skills: ['React'],
        originalUrl: 'https://www.hellowork.com/fr-fr/emplois/999.html',
        source: 'hellowork',
      },
      {
        externalId: 'mj-1',
        title: 'Tech Lead TypeScript',
        company: 'Kestrel',
        location: 'Nantes',
        contractType: 'CDI',
        description: 'Architecture SaaS.',
        skills: ['TypeScript'],
        originalUrl: 'https://www.meteojob.com/candidat/offres/1234',
        source: 'meteojob',
      },
    ]);

    expect(firstBatch.inserted).toBe(4);
    expect(firstBatch.duplicates).toBe(0);

    // Cross-source duplicate of Helios Labs from Indeed with richer description & salary
    const secondBatch = await upsertNormalizedJobs([
      {
        externalId: 'indeed-dup-1',
        title: 'AI Product Engineer',
        company: 'Helios Labs',
        location: 'Paris (75)',
        contractType: 'CDI',
        salary: '60 k€',
        description: 'Description complète et beaucoup plus détaillée incluant PostgreSQL et Gemini.',
        skills: ['PostgreSQL'],
        originalUrl: 'https://fr.indeed.com/viewjob?jk=abc123',
        source: 'indeed',
      },
    ]);

    expect(secondBatch.inserted).toBe(0);
    expect(secondBatch.duplicates).toBe(1);
    expect(secondBatch.updated).toBe(1);

    const allJobs = await listJobsWithAnalyses();
    expect(allJobs).toHaveLength(4);

    const helios = allJobs.find((j) => j.company === 'Helios Labs');
    expect(helios).toBeDefined();
    expect(helios!.salary).toBe('60 k€');
    expect(helios!.skills).toEqual(expect.arrayContaining(['TypeScript', 'Next.js', 'PostgreSQL']));
    expect(helios!.provenance).toHaveLength(2);
    expect(helios!.provenance.map((p) => p.source)).toEqual(
      expect.arrayContaining(['welcome_to_the_jungle', 'indeed'])
    );
  });
});
