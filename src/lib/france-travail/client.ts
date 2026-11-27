import { normalizeFranceTravailOffer, type FranceTravailOffer } from './normalizer';
import type { RawJobInput } from '@/lib/jobs/normalize';

export const FRANCE_TRAVAIL_AUTH_URL =
  'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';
export const FRANCE_TRAVAIL_SEARCH_URL =
  'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
export const FRANCE_TRAVAIL_DEFAULT_SCOPE = 'api_offresdemploiv2 o2dsoffre';
export const FRANCE_TRAVAIL_APP_NAME = 'Job Hunter Agent - Fabien Lufbery';

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
  scope: string;
  expiresIn: number;
}

export interface FranceTravailSearchParams {
  motsCles?: string;
  commune?: string;
  departement?: string;
  typeContrat?: string;
  natureContrat?: string;
  range?: string;
  sort?: '0' | '1' | '2';
  maxResults?: number;
}

export interface FranceTravailSearchResponse {
  offers: RawJobInput[];
  totalAvailable: number;
  pagesFetched: number;
  statusCode: number;
}

export interface FranceTravailTestResult {
  configured: boolean;
  connected: boolean;
  appName: string;
  endpoint: string;
  latencyMs?: number;
  tokenExpiresIn?: number;
  totalAvailableOffers?: number;
  error?: string;
}

export class FranceTravailApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'FranceTravailApiError';
    this.status = status;
    this.code = code;
  }
}

export function isFranceTravailConfigured(): boolean {
  return Boolean(
    process.env.FRANCE_TRAVAIL_CLIENT_ID?.trim() &&
      process.env.FRANCE_TRAVAIL_CLIENT_SECRET?.trim()
  );
}

export function parseContentRange(header: string | null): {
  start: number;
  end: number;
  total: number;
} | null {
  if (!header) return null;
  // Format: "offres 0-49/1245" or "offres 0-0/*"
  const match = header.match(/offres\s+(\d+)-(\d+)\/(\d+|\*)/i);
  if (!match) return null;
  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  const total = match[3] === '*' ? end + 1 : Number.parseInt(match[3], 10);
  return { start, end, total };
}

export function mapContractTypeToFranceTravailCode(contract: string): string | null {
  const upper = contract.trim().toUpperCase();
  if (upper === 'CDI') return 'CDI';
  if (upper === 'CDD') return 'CDD';
  if (upper.includes('INTERIM') || upper === 'MIS') return 'MIS';
  if (upper.includes('FREELANCE') || upper === 'LIB') return 'LIB';
  if (upper.includes('SAISON') || upper === 'SAI') return 'SAI';
  return null;
}

export class FranceTravailClient {
  private tokenCache: CachedToken | null = null;
  private fetchImpl: typeof fetch;
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private sleepMs: (ms: number) => Promise<void>;

  constructor(options?: {
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    fetchImpl?: typeof fetch;
    sleepMs?: (ms: number) => Promise<void>;
  }) {
    this.clientId = options?.clientId ?? process.env.FRANCE_TRAVAIL_CLIENT_ID?.trim() ?? '';
    this.clientSecret =
      options?.clientSecret ?? process.env.FRANCE_TRAVAIL_CLIENT_SECRET?.trim() ?? '';
    this.scope =
      options?.scope ??
      process.env.FRANCE_TRAVAIL_SCOPE?.trim() ??
      FRANCE_TRAVAIL_DEFAULT_SCOPE;
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.sleepMs =
      options?.sleepMs ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  public isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  public clearTokenCache(): void {
    this.tokenCache = null;
  }

  public async getAccessToken(forceRefresh = false): Promise<CachedToken> {
    if (!this.isConfigured()) {
      throw new FranceTravailApiError(
        'Identifiants France Travail manquants (FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET).',
        401,
        'NOT_CONFIGURED'
      );
    }

    const now = Date.now();
    // Refresh 60 seconds prior to actual expiration
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAtMs - 60_000 > now) {
      return this.tokenCache;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: this.scope,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(FRANCE_TRAVAIL_AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new FranceTravailApiError(
        `Échec réseau lors de l’authentification OAuth2 France Travail : ${err instanceof Error ? err.message : 'Erreur inconnue'}`,
        503,
        'NETWORK_ERROR'
      );
    }

    if (!response.ok) {
      throw new FranceTravailApiError(
        `Authentification OAuth2 France Travail refusée (HTTP ${response.status})`,
        response.status,
        response.status === 401 || response.status === 400 ? 'INVALID_CREDENTIALS' : 'AUTH_ERROR'
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
    };

    if (!data.access_token) {
      throw new FranceTravailApiError(
        'Réponse OAuth2 France Travail invalide : access_token absent.',
        502,
        'INVALID_TOKEN_RESPONSE'
      );
    }

    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 1499;
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAtMs: now + expiresIn * 1000,
      scope: data.scope || this.scope,
      expiresIn,
    };

    return this.tokenCache;
  }

  private async fetchSearchPage(
    params: FranceTravailSearchParams,
    range: string,
    attempt = 1,
    hasRefreshedToken = false
  ): Promise<{ offers: FranceTravailOffer[]; total: number; status: number }> {
    const token = await this.getAccessToken(false);
    const url = new URL(FRANCE_TRAVAIL_SEARCH_URL);

    if (params.motsCles?.trim()) url.searchParams.set('motsCles', params.motsCles.trim());
    if (params.commune?.trim()) url.searchParams.set('commune', params.commune.trim());
    if (params.departement?.trim()) url.searchParams.set('departement', params.departement.trim());
    if (params.typeContrat?.trim()) url.searchParams.set('typeContrat', params.typeContrat.trim());
    if (params.natureContrat?.trim())
      url.searchParams.set('natureContrat', params.natureContrat.trim());
    if (params.sort) url.searchParams.set('sort', params.sort);
    url.searchParams.set('range', range);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new FranceTravailApiError(
        `Erreur réseau lors de la recherche France Travail : ${err instanceof Error ? err.message : 'Erreur inconnue'}`,
        503,
        'NETWORK_ERROR'
      );
    }

    // Expired or revoked token -> refresh once and retry
    if (response.status === 401 && !hasRefreshedToken) {
      this.clearTokenCache();
      await this.getAccessToken(true);
      return this.fetchSearchPage(params, range, attempt, true);
    }

    // Quota / Rate limit (10 req/s default) -> backoff & retry up to 3 attempts
    if (response.status === 429) {
      if (attempt < 3) {
        const retryAfterSec = Number.parseFloat(response.headers.get('retry-after') || '0');
        const waitMs =
          Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? Math.min(retryAfterSec * 1000, 5000)
            : attempt * 1000;
        await this.sleepMs(waitMs);
        return this.fetchSearchPage(params, range, attempt + 1, hasRefreshedToken);
      }
      throw new FranceTravailApiError(
        'Quota API France Travail atteint (HTTP 429 Too Many Requests). Réessayez dans quelques secondes.',
        429,
        'RATE_LIMITED'
      );
    }

    // 204 No Content -> valid response with zero matching offers
    if (response.status === 204) {
      return { offers: [], total: 0, status: 204 };
    }

    if (response.status !== 200 && response.status !== 206) {
      throw new FranceTravailApiError(
        `Erreur API France Travail (HTTP ${response.status})`,
        response.status,
        'SEARCH_ERROR'
      );
    }

    const payload = (await response.json()) as { resultats?: FranceTravailOffer[] };
    const offers = Array.isArray(payload.resultats) ? payload.resultats : [];
    const rangeInfo = parseContentRange(response.headers.get('content-range'));
    const total = rangeInfo ? rangeInfo.total : offers.length;

    return { offers, total, status: response.status };
  }

  public async searchOffers(
    params: FranceTravailSearchParams
  ): Promise<FranceTravailSearchResponse> {
    const maxResults = Math.min(Math.max(params.maxResults ?? 50, 1), 300);
    const pageSize = Math.min(50, maxResults);

    if (params.range) {
      const page = await this.fetchSearchPage(params, params.range);
      return {
        offers: page.offers.map(normalizeFranceTravailOffer),
        totalAvailable: page.total,
        pagesFetched: 1,
        statusCode: page.status,
      };
    }

    const allOffers: FranceTravailOffer[] = [];
    let offset = 0;
    let totalAvailable = 0;
    let pagesFetched = 0;
    let lastStatus = 200;

    while (allOffers.length < maxResults) {
      const end = Math.min(offset + pageSize - 1, maxResults - 1);
      const page = await this.fetchSearchPage(params, `${offset}-${end}`);
      pagesFetched += 1;
      lastStatus = page.status;
      totalAvailable = page.total;

      if (page.offers.length === 0) break;
      allOffers.push(...page.offers);

      if (page.status === 200 || allOffers.length >= totalAvailable || page.offers.length < pageSize) {
        break;
      }

      offset += pageSize;
      // Polite throttle well under France Travail 10 req/s quota
      await this.sleepMs(120);
    }

    return {
      offers: allOffers.slice(0, maxResults).map(normalizeFranceTravailOffer),
      totalAvailable,
      pagesFetched,
      statusCode: lastStatus,
    };
  }

  public async testConnection(): Promise<FranceTravailTestResult> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        connected: false,
        appName: FRANCE_TRAVAIL_APP_NAME,
        endpoint: FRANCE_TRAVAIL_SEARCH_URL,
        error:
          'Variables FRANCE_TRAVAIL_CLIENT_ID et FRANCE_TRAVAIL_CLIENT_SECRET non configurées.',
      };
    }

    const start = Date.now();
    try {
      const token = await this.getAccessToken(true);
      const probe = await this.searchOffers({ range: '0-0', maxResults: 1 });
      return {
        configured: true,
        connected: true,
        appName: FRANCE_TRAVAIL_APP_NAME,
        endpoint: FRANCE_TRAVAIL_SEARCH_URL,
        latencyMs: Date.now() - start,
        tokenExpiresIn: token.expiresIn,
        totalAvailableOffers: probe.totalAvailable,
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        appName: FRANCE_TRAVAIL_APP_NAME,
        endpoint: FRANCE_TRAVAIL_SEARCH_URL,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Erreur inconnue France Travail',
      };
    }
  }
}

let singletonClient: FranceTravailClient | null = null;

export function getFranceTravailClient(): FranceTravailClient {
  if (!singletonClient) {
    singletonClient = new FranceTravailClient();
  }
  return singletonClient;
}
