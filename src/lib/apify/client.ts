import crypto from 'node:crypto';
import type { ActiveJobSource, ApifySourceKind } from '@/db/schema';
import type { RawJobInput } from '@/lib/jobs/normalize';
import { normalizeApifyItem } from './normalizer';
import { buildApifyRunInput, type NonPersonalSearchCriteria } from './preferences-mapper';

export const APIFY_API_BASE = 'https://api.apify.com/v2';

export interface ApifyAccountSummary {
  username: string;
  planId: string | null;
  monthlyUsageCreditsUsd: number | null;
}

export interface ApifyDiscoveredTask {
  id: string;
  name: string;
  title: string | null;
  actId: string;
}

export interface ApifyRunDescriptor {
  id: string;
  status: string;
  defaultDatasetId: string | null;
  usageTotalUsd: number;
  startedAt: string | null;
  finishedAt: string | null;
  statusMessage: string | null;
}

export class ApifyApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApifyApiError';
    this.status = status;
    this.code = code;
  }
}

export function isApifyTokenConfigured(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN?.trim());
}

export function isApifyConfigured(): boolean {
  return isApifyTokenConfigured();
}

export function formatApifyPathId(rawId: string): string {
  const trimmed = rawId.trim();
  if (!trimmed || !/^[a-zA-Z0-9._~/-]+$/.test(trimmed)) {
    throw new ApifyApiError(
      'Identifiant Apify invalide (attendu : username~name ou username/name ou ID alphanumérique).',
      400,
      'INVALID_APIFY_ID'
    );
  }
  // Apify REST API v2 expects "~" instead of "/" in actor/task path segments
  return encodeURIComponent(trimmed.replace('/', '~'));
}

export function createApifyWebhookSignature(runTag: string): string | null {
  const secret =
    process.env.APIFY_WEBHOOK_SECRET?.trim() || process.env.CRON_SECRET?.trim() || '';
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(runTag).digest('hex');
}

export interface ApifyRequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  timeoutMs?: number;
  token?: string;
  fetchImpl?: typeof fetch;
}

async function apifyRequest<T = unknown>(
  endpointPath: string,
  options: ApifyRequestOptions = {}
): Promise<T> {
  const token = options.token?.trim() || process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    throw new ApifyApiError(
      'APIFY_API_TOKEN non configuré côté serveur.',
      401,
      'NOT_CONFIGURED'
    );
  }

  const fetchFn = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`${APIFY_API_BASE}/${endpointPath.replace(/^\/+/, '')}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
    });
  } catch (err) {
    throw new ApifyApiError(
      `Erreur réseau Apify : ${err instanceof Error ? err.message : 'connexion interrompue'}`,
      503,
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const code =
      response.status === 401 || response.status === 403
        ? 'INVALID_TOKEN'
        : response.status === 402
          ? 'QUOTA_EXCEEDED'
          : response.status === 404
            ? 'NOT_FOUND'
            : response.status === 429
              ? 'RATE_LIMITED'
              : 'API_ERROR';
    throw new ApifyApiError(
      `Apify HTTP ${response.status}${errText ? ` : ${errText.slice(0, 180)}` : ''}`,
      response.status,
      code
    );
  }

  return (await response.json()) as T;
}

function parseRunDescriptor(raw: unknown): ApifyRunDescriptor {
  const envelope = (raw as { data?: Record<string, unknown> })?.data ?? (raw as Record<string, unknown>);
  return {
    id: String(envelope?.id || ''),
    status: String(envelope?.status || 'UNKNOWN'),
    defaultDatasetId:
      typeof envelope?.defaultDatasetId === 'string' &&
      /^[a-zA-Z0-9_-]+$/.test(envelope.defaultDatasetId)
        ? envelope.defaultDatasetId
        : null,
    usageTotalUsd:
      typeof envelope?.usageTotalUsd === 'number' && Number.isFinite(envelope.usageTotalUsd)
        ? Number(envelope.usageTotalUsd)
        : 0,
    startedAt: typeof envelope?.startedAt === 'string' ? envelope.startedAt : null,
    finishedAt: typeof envelope?.finishedAt === 'string' ? envelope.finishedAt : null,
    statusMessage: typeof envelope?.statusMessage === 'string' ? envelope.statusMessage : null,
  };
}

export async function testApifyConnection(options?: {
  token?: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  account?: ApifyAccountSummary;
  tasksCount?: number;
  tasks?: ApifyDiscoveredTask[];
  error?: string;
}> {
  const token = options?.token?.trim() || process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    return {
      configured: false,
      connected: false,
      error: 'Variable APIFY_API_TOKEN non configurée côté serveur.',
    };
  }

  const start = Date.now();
  try {
    const meRes = await apifyRequest<{
      data?: {
        username?: string;
        plan?: { id?: string; monthlyUsageCreditsUsd?: number };
      };
    }>('users/me', { token, fetchImpl: options?.fetchImpl, timeoutMs: 15_000 });

    let tasks: ApifyDiscoveredTask[] = [];
    try {
      const tasksRes = await apifyRequest<{
        data?: {
          items?: Array<{ id?: string; name?: string; title?: string; actId?: string }>;
        };
      }>('actor-tasks?limit=50', { token, fetchImpl: options?.fetchImpl, timeoutMs: 15_000 });
      tasks = (tasksRes.data?.items || [])
        .filter((t): t is { id: string; name: string; title?: string; actId: string } =>
          Boolean(t.id && t.name)
        )
        .map((t) => ({
          id: t.id,
          name: t.name,
          title: t.title || null,
          actId: t.actId || '',
        }));
    } catch {
      tasks = [];
    }

    return {
      configured: true,
      connected: true,
      latencyMs: Date.now() - start,
      account: {
        username: meRes.data?.username || 'Compte Apify',
        planId: meRes.data?.plan?.id || null,
        monthlyUsageCreditsUsd:
          typeof meRes.data?.plan?.monthlyUsageCreditsUsd === 'number'
            ? meRes.data.plan.monthlyUsageCreditsUsd
            : null,
      },
      tasksCount: tasks.length,
      tasks,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Erreur connexion Apify',
    };
  }
}

export async function listUserApifyTasks(options?: {
  token?: string;
  fetchImpl?: typeof fetch;
}): Promise<ApifyDiscoveredTask[]> {
  const res = await apifyRequest<{
    data?: {
      items?: Array<{ id?: string; name?: string; title?: string; actId?: string }>;
    };
  }>('actor-tasks?limit=50', {
    token: options?.token,
    fetchImpl: options?.fetchImpl,
    timeoutMs: 15_000,
  });

  return (res.data?.items || [])
    .filter((t) => Boolean(t.id && t.name))
    .map((t) => ({
      id: String(t.id),
      name: String(t.name),
      title: t.title || null,
      actId: String(t.actId || ''),
    }));
}

/**
 * Starts an Apify Actor or Task asynchronously with strict cost/time/item caps.
 * Never transmits personal CV data; only search preferences are passed.
 */
export async function startApifyRun(params: {
  kind: ApifySourceKind;
  apifyId: string;
  platform: ActiveJobSource;
  preferences: NonPersonalSearchCriteria;
  inputTemplate?: Record<string, unknown> | null;
  maxCostUsd: number;
  timeoutSecs: number;
  memoryMbytes?: number;
  webhookUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}): Promise<ApifyRunDescriptor> {
  const pathId = formatApifyPathId(params.apifyId);
  const maxItems = Math.max(1, Math.min(200, Math.floor(params.preferences.maxItems || 30)));
  const maxCost = Math.max(0.05, Math.min(20, Number(params.maxCostUsd || 0.5)));
  const timeout = Math.max(30, Math.min(600, Math.floor(params.timeoutSecs || 120)));
  const memory = [128, 256, 512, 1024, 2048, 4096].includes(params.memoryMbytes || 512)
    ? params.memoryMbytes || 512
    : 512;

  const query = new URLSearchParams({
    timeout: String(timeout),
    memory: String(memory),
    maxItems: String(maxItems),
    maxTotalChargeUsd: maxCost.toFixed(2),
  });

  if (params.webhookUrl && params.webhookUrl.startsWith('https://')) {
    const webhooksPayload = [
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
        requestUrl: params.webhookUrl,
      },
    ];
    query.set('webhooks', Buffer.from(JSON.stringify(webhooksPayload), 'utf8').toString('base64'));
  }

  const inputBody = buildApifyRunInput({
    kind: params.kind,
    platform: params.platform,
    preferences: params.preferences,
    inputTemplate: params.inputTemplate,
  });

  const basePath = params.kind === 'task' ? `actor-tasks/${pathId}/runs` : `actors/${pathId}/runs`;
  const raw = await apifyRequest(`${basePath}?${query.toString()}`, {
    method: 'POST',
    body: inputBody,
    token: params.token,
    fetchImpl: params.fetchImpl,
    timeoutMs: 25_000,
  });

  const run = parseRunDescriptor(raw);
  if (!run.id) {
    throw new ApifyApiError('Réponse Apify invalide : identifiant de run absent.', 502, 'BAD_RUN');
  }
  return run;
}

/**
 * Fetches current status of an Apify run, optionally using Apify's waitForFinish long-poll.
 */
export async function getApifyRunStatus(
  apifyRunId: string,
  options?: { waitForFinishSecs?: number; token?: string; fetchImpl?: typeof fetch }
): Promise<ApifyRunDescriptor> {
  if (!/^[a-zA-Z0-9_-]+$/.test(apifyRunId)) {
    throw new ApifyApiError('Identifiant de run Apify invalide.', 400, 'INVALID_RUN_ID');
  }
  const wait = Math.max(0, Math.min(30, Math.floor(options?.waitForFinishSecs ?? 0)));
  const qs = wait > 0 ? `?waitForFinish=${wait}` : '';
  const raw = await apifyRequest(`actor-runs/${encodeURIComponent(apifyRunId)}${qs}`, {
    token: options?.token,
    fetchImpl: options?.fetchImpl,
    timeoutMs: (wait + 15) * 1000,
  });
  return parseRunDescriptor(raw);
}

export async function abortApifyRun(
  apifyRunId: string,
  options?: { token?: string; fetchImpl?: typeof fetch }
): Promise<ApifyRunDescriptor> {
  if (!/^[a-zA-Z0-9_-]+$/.test(apifyRunId)) {
    throw new ApifyApiError('Identifiant de run Apify invalide.', 400, 'INVALID_RUN_ID');
  }
  const raw = await apifyRequest(`actor-runs/${encodeURIComponent(apifyRunId)}/abort`, {
    method: 'POST',
    token: options?.token,
    fetchImpl: options?.fetchImpl,
    timeoutMs: 15_000,
  });
  return parseRunDescriptor(raw);
}

/**
 * Reads the latest SUCCEEDED run descriptor for a Task or Actor (zero extra Apify compute cost).
 */
export async function getLastSucceededApifyRun(params: {
  kind: ApifySourceKind;
  apifyId: string;
  token?: string;
  fetchImpl?: typeof fetch;
}): Promise<ApifyRunDescriptor> {
  const pathId = formatApifyPathId(params.apifyId);
  const basePath =
    params.kind === 'task'
      ? `actor-tasks/${pathId}/runs/last?status=SUCCEEDED`
      : `actors/${pathId}/runs/last?status=SUCCEEDED`;
  const raw = await apifyRequest(basePath, {
    token: params.token,
    fetchImpl: params.fetchImpl,
    timeoutMs: 20_000,
  });
  return parseRunDescriptor(raw);
}

/**
 * Fetches & normalizes dataset items from a completed Apify run.
 */
export async function fetchNormalizedDatasetItems(params: {
  datasetId: string;
  maxItems?: number;
  fallbackPlatform?: ActiveJobSource;
  allowOtherHosts?: boolean;
  token?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ offers: RawJobInput[]; fetched: number; rejected: number }> {
  if (!/^[a-zA-Z0-9_-]+$/.test(params.datasetId)) {
    throw new ApifyApiError('Identifiant de dataset Apify invalide.', 400, 'INVALID_DATASET_ID');
  }
  const limit = Math.max(1, Math.min(500, Math.floor(params.maxItems ?? 100)));
  const items = await apifyRequest<unknown>(
    `datasets/${encodeURIComponent(params.datasetId)}/items?clean=true&format=json&desc=true&limit=${limit}`,
    {
      token: params.token,
      fetchImpl: params.fetchImpl,
      timeoutMs: 25_000,
    }
  );

  if (!Array.isArray(items)) {
    throw new ApifyApiError('Format de dataset Apify inattendu (tableau JSON attendu).', 502, 'BAD_DATASET');
  }

  const offers = items
    .map((item) =>
      normalizeApifyItem(item, {
        fallbackPlatform: params.fallbackPlatform,
        allowOtherHosts: params.allowOtherHosts ?? true,
      })
    )
    .filter((job): job is RawJobInput => job !== null);

  return {
    offers,
    fetched: items.length,
    rejected: items.length - offers.length,
  };
}

export { normalizeApifyItem };
export { buildApifyRunInput, VERIFIED_APIFY_ACTOR_CATALOG } from './preferences-mapper';
