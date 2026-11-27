import { z } from 'zod';
import { JOB_SOURCES, type JobProvenance, type JobSource } from '@/db/schema';
import { sha256Hex } from '@/lib/crypto';
import { isValidHttpUrl } from '@/lib/security';

export const rawJobInputSchema = z.object({
  externalId: z.string().trim().max(200).nullable().optional(),
  title: z.string().trim().min(2).max(300),
  company: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  contractType: z.string().trim().max(100).nullable().optional(),
  salary: z.string().trim().max(150).nullable().optional(),
  description: z.string().trim().max(40000).default(''),
  skills: z.array(z.string().trim().min(1).max(80)).max(50).optional().default([]),
  publishedAt: z.string().nullable().optional(),
  originalUrl: z.string().trim().refine(isValidHttpUrl, 'URL originale invalide'),
  source: z.enum(JOB_SOURCES),
  recruiterEmail: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

export type RawJobInput = z.input<typeof rawJobInputSchema>;

export interface NormalizedJob {
  externalId: string | null;
  dedupeHash: string;
  contentHash: string;
  title: string;
  company: string | null;
  location: string | null;
  contractType: string | null;
  salary: string | null;
  description: string;
  skills: string[];
  publishedAt: Date | null;
  collectedAt: Date;
  originalUrl: string;
  source: JobSource;
  provenance: JobProvenance[];
  recruiterEmail: string | null;
}

export function normalizeTextKey(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    // Remove tracking query params while preserving meaningful job IDs (like Indeed jk=)
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'ref',
      'from',
      'tk',
      'advn',
    ];
    for (const p of trackingParams) {
      u.searchParams.delete(p);
    }
    u.hash = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return rawUrl.trim();
  }
}

export function normalizeContractType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const upper = normalizeTextKey(cleaned);
  if (upper.includes('cdi') || upper.includes('permanent') || upper.includes('indeterminee')) return 'CDI';
  if (upper.includes('cdd') || upper.includes('determinee') || upper.includes('fixed term')) return 'CDD';
  if (upper.includes('alternance') || upper.includes('apprentissage') || upper.includes('professionnalisation'))
    return 'Alternance';
  if (upper.includes('stage') || upper.includes('intern')) return 'Stage';
  if (upper.includes('freelance') || upper.includes('independant') || upper.includes('liberal')) return 'Freelance';
  if (upper.includes('interim') || upper.includes('mis') || upper.includes('temporaire')) return 'Intérim';
  return cleaned.slice(0, 60);
}

/**
 * Extracts only explicitly written email addresses from offer text if not provided separately.
 * Filters out generic no-reply / privacy / support addresses. Never fabricates an email.
 */
export function extractExplicitRecruiterEmail(text: string): string | null {
  const matches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g);
  if (!matches) return null;
  for (const candidate of matches) {
    const lower = candidate.toLowerCase();
    if (
      lower.startsWith('noreply') ||
      lower.startsWith('no-reply') ||
      lower.startsWith('ne-pas-repondre') ||
      lower.includes('example.') ||
      lower.includes('sentry.') ||
      lower.includes('privacy@') ||
      lower.includes('dpo@')
    ) {
      continue;
    }
    return candidate;
  }
  return null;
}

export function normalizeCityKey(location: string | null | undefined): string {
  if (!location) return '';
  const tokens = normalizeTextKey(location)
    .split(' ')
    .filter((tok) => tok && !/^\d+[a-z]?$/.test(tok) && tok !== 'cedex' && tok !== 'france');
  return tokens[0] || '';
}

export function computeDedupeHash(input: {
  title: string;
  company: string | null;
  location: string | null;
  originalUrl: string;
  source: JobSource;
  externalId: string | null;
}): string {
  const normTitle = normalizeTextKey(input.title);
  const normCompany = normalizeTextKey(input.company);
  const normLoc = normalizeCityKey(input.location);

  // Cross-source deduplication key when both title and company are present
  if (normTitle && normCompany) {
    return sha256Hex(`tc:${normTitle}|${normCompany}|${normLoc}`);
  }
  if (input.externalId) {
    return sha256Hex(`ext:${input.source}|${input.externalId.trim()}`);
  }
  return sha256Hex(`url:${canonicalizeUrl(input.originalUrl)}`);
}

export function computeJobContentHash(input: {
  title: string;
  company: string | null;
  location: string | null;
  contractType: string | null;
  description: string;
  skills: string[];
}): string {
  return sha256Hex(
    JSON.stringify({
      title: input.title,
      company: input.company || '',
      location: input.location || '',
      contractType: input.contractType || '',
      description: input.description,
      skills: [...input.skills].sort(),
    })
  );
}

export function parseOptionalDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeJobInput(raw: RawJobInput): NormalizedJob {
  const parsed = rawJobInputSchema.parse(raw);
  const now = new Date();
  const cleanUrl = canonicalizeUrl(parsed.originalUrl);
  const company = parsed.company && parsed.company.trim().length > 0 ? parsed.company.trim() : null;
  const location = parsed.location && parsed.location.trim().length > 0 ? parsed.location.trim() : null;
  const contractType = normalizeContractType(parsed.contractType);
  const salary = parsed.salary && parsed.salary.trim().length > 0 ? parsed.salary.trim() : null;
  const externalId = parsed.externalId && parsed.externalId.trim().length > 0 ? parsed.externalId.trim() : null;

  const dedupedSkills = Array.from(
    new Map(
      parsed.skills
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => [s.toLowerCase(), s])
    ).values()
  );

  const recruiterEmail = parsed.recruiterEmail || extractExplicitRecruiterEmail(parsed.description);

  const dedupeHash = computeDedupeHash({
    title: parsed.title,
    company,
    location,
    originalUrl: cleanUrl,
    source: parsed.source,
    externalId,
  });

  const contentHash = computeJobContentHash({
    title: parsed.title,
    company,
    location,
    contractType,
    description: parsed.description,
    skills: dedupedSkills,
  });

  return {
    externalId,
    dedupeHash,
    contentHash,
    title: parsed.title,
    company,
    location,
    contractType,
    salary,
    description: parsed.description,
    skills: dedupedSkills,
    publishedAt: parseOptionalDate(parsed.publishedAt),
    collectedAt: now,
    originalUrl: cleanUrl,
    source: parsed.source,
    provenance: [
      {
        source: parsed.source,
        url: cleanUrl,
        externalId,
        seenAt: now.toISOString(),
      },
    ],
    recruiterEmail,
  };
}

export function mergeProvenance(
  existing: JobProvenance[],
  incoming: JobProvenance[]
): JobProvenance[] {
  const map = new Map<string, JobProvenance>();
  for (const item of [...existing, ...incoming]) {
    const key = `${item.source}|${canonicalizeUrl(item.url)}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

export const SOURCE_LABELS: Record<JobSource, string> = {
  welcome_to_the_jungle: 'Welcome to the Jungle',
  indeed: 'Indeed',
  hellowork: 'HelloWork',
  meteojob: 'Meteojob',
  france_travail: 'France Travail',
};
