import { rawJobInputSchema, type RawJobInput } from '@/lib/jobs/normalize';
import type { JobSource } from '@/db/schema';
const hosts: Record<string, JobSource> = {
  'www.welcometothejungle.com': 'welcome_to_the_jungle', 'www.indeed.com': 'indeed', 'fr.indeed.com': 'indeed',
  'www.hellowork.com': 'hellowork', 'www.meteojob.com': 'meteojob', 'candidat.francetravail.fr': 'france_travail',
};
export function isApifyConfigured() { return Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_TASK_ID?.trim()); }
function text(v: unknown, max: number) { return typeof v === 'string' ? v.trim().slice(0,max) : ''; }
export function normalizeApifyItem(item: unknown): RawJobInput | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const r = item as Record<string, unknown>;
  let url: URL;
  try { url = new URL(text(r.originalUrl || r.jobUrl || r.url || r.link,4096)); } catch { return null; }
  const source = hosts[url.hostname];
  if (!source || url.protocol !== 'https:' || url.username || url.password) return null;
  if (source === 'welcome_to_the_jungle' && !/\/companies\/[^/]+\/jobs\/[^/]+/.test(url.pathname)) return null;
  const company = r.company && typeof r.company === 'object' ? (r.company as Record<string, unknown>).name : r.company;
  const parsed = rawJobInputSchema.safeParse({
    source, originalUrl: url.href, title: text(r.title || r.jobTitle || r.position,300),
    company: text(r.companyName || company || r.organizationName,200) || null,
    location: text(r.location || r.city || r.jobLocation,200) || null,
    contractType: text(r.contractType || r.employmentType || r.jobType,100) || null,
    description: text(r.description || r.jobDescription || r.descriptionText,40000),
    salary: text(r.salary || r.salaryText,150) || null,
    externalId: text(r.externalId || r.jobId || r.id,200) || null,
    publishedAt: text(r.publishedAt || r.datePosted || r.postedAt,100) || null,
    skills: Array.isArray(r.skills) ? r.skills.filter((s): s is string => typeof s === 'string').map(s => s.trim().slice(0,80)).filter(Boolean).slice(0,50) : [],
  });
  return parsed.success ? parsed.data : null;
}
async function api(path: string): Promise<unknown> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new Error('APIFY_API_TOKEN manquant.');
  const res = await fetch('https://api.apify.com/v2/' + path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!res.ok) throw new Error('Apify : HTTP ' + res.status + '. Vérifiez le jeton et la tâche.');
  return res.json();
}
function taskId() {
  const id = process.env.APIFY_TASK_ID?.trim();
  if (!id || !/^[a-zA-Z0-9_~-]+$/.test(id)) throw new Error('APIFY_TASK_ID invalide ou manquant.');
  return encodeURIComponent(id);
}
export async function testApifyConnection() {
  const start = Date.now(); await api('actor-tasks/' + taskId()); return { connected: true, latencyMs: Date.now() - start };
}
export async function fetchApifyJobs(maxResults = 100) {
  const result = await api('actor-tasks/' + taskId() + '/runs/last?status=SUCCEEDED') as { data?: { status?: string; defaultDatasetId?: string } };
  const id = result.data?.defaultDatasetId;
  if (result.data?.status !== 'SUCCEEDED' || !id || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Aucun résultat de tâche Apify réussie.');
  const limit = Math.max(1, Math.min(500, Math.floor(maxResults)));
  const items = await api('datasets/' + encodeURIComponent(id) + '/items?clean=true&format=json&desc=true&limit=' + limit);
  if (!Array.isArray(items)) throw new Error('Format de dataset Apify inattendu.');
  const offers = items.map(normalizeApifyItem).filter((item): item is RawJobInput => item !== null);
  if (items.length && !offers.length) throw new Error('Aucune offre valide : vérifiez le format des données.');
  return { offers, fetched: items.length, rejected: items.length - offers.length };
}
