import type { ActiveJobSource } from '@/db/schema';
import { rawJobInputSchema, type RawJobInput } from '@/lib/jobs/normalize';

const HOST_TO_PLATFORM: Array<{ match: (host: string) => boolean; source: ActiveJobSource }> = [
  { match: (h) => h === 'welcometothejungle.com' || h.endsWith('.welcometothejungle.com'), source: 'welcome_to_the_jungle' },
  { match: (h) => h === 'indeed.com' || h.endsWith('.indeed.com') || h.endsWith('.indeed.fr'), source: 'indeed' },
  { match: (h) => h === 'hellowork.com' || h.endsWith('.hellowork.com'), source: 'hellowork' },
  { match: (h) => h === 'meteojob.com' || h.endsWith('.meteojob.com'), source: 'meteojob' },
  { match: (h) => h === 'linkedin.com' || h.endsWith('.linkedin.com'), source: 'linkedin' },
];

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\]|.*\.local$|.*\.internal$|.*\.test$|.*\.invalid$)/i;

function pickText(v: unknown, max: number): string {
  if (typeof v === 'string') return v.trim().slice(0, max);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).slice(0, max);
  return '';
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractCompany(r: Record<string, unknown>): string | null {
  const direct = pickText(
    r.companyName || r.organizationName || r.employerName || r.company_name || r.employer,
    200
  );
  if (direct) return direct;

  for (const candidate of [r.company, r.organization, r.hiringOrganization]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 200);
    }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const obj = candidate as Record<string, unknown>;
      const nested = pickText(obj.name || obj.companyName || obj.title, 200);
      if (nested) return nested;
    }
  }
  return null;
}

function extractLocation(r: Record<string, unknown>): string | null {
  const direct = pickText(
    r.formattedLocation || r.location || r.city || r.jobLocation || r.place || r.workplace,
    200
  );
  if (direct) return direct;

  for (const candidate of [r.office, r.offices, r.jobLocation, r.address]) {
    const first = Array.isArray(candidate) ? candidate[0] : candidate;
    if (typeof first === 'string' && first.trim()) return first.trim().slice(0, 200);
    if (first && typeof first === 'object') {
      const obj = first as Record<string, unknown>;
      const addr = (obj.address && typeof obj.address === 'object'
        ? obj.address
        : obj) as Record<string, unknown>;
      const parts = [addr.city, addr.addressLocality, addr.zip_code, addr.postalCode, addr.country]
        .map((x) => pickText(x, 80))
        .filter(Boolean);
      if (parts.length > 0) return parts.join(', ').slice(0, 200);
    }
  }
  return null;
}

function extractSalary(r: Record<string, unknown>): string | null {
  const direct = pickText(
    r.salary || r.salaryText || r.salaryRange || r.compensation || r.remuneration,
    150
  );
  if (direct) return direct;

  if (r.salary_min || r.salary_max) {
    const min = pickText(r.salary_min, 30);
    const max = pickText(r.salary_max, 30);
    const cur = pickText(r.salary_currency || r.currency, 10) || 'EUR';
    return `${min}${min && max ? ' - ' : ''}${max} ${cur}`.trim().slice(0, 150);
  }
  if (r.baseSalary && typeof r.baseSalary === 'object') {
    const bs = r.baseSalary as Record<string, unknown>;
    const val = (bs.value && typeof bs.value === 'object' ? bs.value : bs) as Record<string, unknown>;
    const min = pickText(val.minValue, 30);
    const max = pickText(val.maxValue, 30);
    const single = pickText(val.value, 30);
    const cur = pickText(bs.currency, 10) || 'EUR';
    if (min || max) return `${min}${min && max ? ' - ' : ''}${max} ${cur}`.trim();
    if (single) return `${single} ${cur}`.trim();
  }
  return null;
}

function extractSkills(r: Record<string, unknown>): string[] {
  const rawSkills = r.skills || r.tags || r.keywords || r.requiredSkills;
  if (Array.isArray(rawSkills)) {
    return rawSkills
      .map((item) => {
        if (typeof item === 'string') return item.trim().slice(0, 80);
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          return pickText(obj.name || obj.label || obj.title, 80);
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, 50);
  }
  if (typeof rawSkills === 'string') {
    return rawSkills
      .split(/[,;•\n]/)
      .map((s) => s.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 50);
  }
  return [];
}

export function detectPlatformFromUrl(
  url: URL,
  fallbackPlatform?: ActiveJobSource
): ActiveJobSource | null {
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.test(host)) return null;
  for (const entry of HOST_TO_PLATFORM) {
    if (entry.match(host)) return entry.source;
  }
  if (fallbackPlatform) return fallbackPlatform;
  return null;
}

export function normalizeApifyItem(
  item: unknown,
  options?: { fallbackPlatform?: ActiveJobSource; allowOtherHosts?: boolean }
): RawJobInput | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const r = item as Record<string, unknown>;

  const rawUrl = pickText(
    r.originalUrl || r.jobUrl || r.url || r.link || r.applyUrl || r.externalApplyLink,
    4096
  );
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password) return null;
  if (BLOCKED_HOSTS.test(url.hostname)) return null;

  const detected = detectPlatformFromUrl(
    url,
    options?.allowOtherHosts ? options?.fallbackPlatform ?? 'other' : undefined
  );
  if (!detected) return null;

  // Reject WTTJ generic search index pages that aren't actual job postings
  if (
    detected === 'welcome_to_the_jungle' &&
    !/\/companies\/[^/]+\/jobs\/[^/]+/.test(url.pathname)
  ) {
    return null;
  }

  const title = pickText(
    r.title || r.jobTitle || r.positionName || r.position || r.name || r.job_title,
    300
  );
  if (!title || title.length < 2) return null;

  const rawDesc =
    pickText(r.descriptionText || r.jobDescription || r.description, 40000) ||
    (typeof r.descriptionHtml === 'string'
      ? stripHtml(r.descriptionHtml).slice(0, 40000)
      : '') ||
    pickText(r.summary || r.snippet, 40000);
  const description = /<[a-z][\s\S]*>/i.test(rawDesc) ? stripHtml(rawDesc).slice(0, 40000) : rawDesc;

  const rawContract = Array.isArray(r.jobType)
    ? pickText(r.jobType[0], 100)
    : pickText(r.contractType || r.employmentType || r.jobType || r.contract_type || r.schedule, 100);

  const parsed = rawJobInputSchema.safeParse({
    source: detected,
    originalUrl: url.href,
    title,
    company: extractCompany(r),
    location: extractLocation(r),
    contractType: rawContract || null,
    description,
    salary: extractSalary(r),
    externalId:
      pickText(r.externalId || r.jobId || r.id || r.slug || r.reference, 200) || null,
    publishedAt:
      pickText(r.publishedAt || r.postedAt || r.datePosted || r.published_at || r.createdAt, 100) ||
      null,
    skills: extractSkills(r),
  });

  return parsed.success ? parsed.data : null;
}
