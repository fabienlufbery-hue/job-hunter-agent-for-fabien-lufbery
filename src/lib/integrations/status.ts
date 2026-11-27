import { eq, sql } from 'drizzle-orm';
import { checkDatabaseHealth, getDb, schema } from '@/db';
import { isFranceTravailConfigured, FRANCE_TRAVAIL_APP_NAME } from '@/lib/france-travail/client';
import {
  GEMINI_MODEL_DEPRECATION_NOTE,
  getGeminiModel,
  isGeminiConfigured,
} from '@/lib/gemini/client';
import { getGmailConnectionStatus } from '@/lib/gmail/client';

export type IntegrationState =
  | 'connected'
  | 'configured_unverified'
  | 'unconfigured'
  | 'offline'
  | 'needs_attention'
  | 'error';

export interface IntegrationStatusItem {
  id: string;
  name: string;
  category: 'ai' | 'job_board' | 'email' | 'browser' | 'infrastructure';
  status: IntegrationState;
  statusLabel: string;
  mode: 'server_api' | 'browser_extension' | 'oauth2' | 'database' | 'manual';
  detail: string;
  lastActivityAt?: string | null;
  metrics?: Record<string, string | number | boolean | null>;
}

export async function getAllIntegrationsStatus(options?: {
  isDemo?: boolean;
}): Promise<IntegrationStatusItem[]> {
  const dbHealth = await checkDatabaseHealth();
  const ftConfigured = isFranceTravailConfigured();
  const geminiConfigured = isGeminiConfigured();
  const geminiModel = getGeminiModel();
  const gmailStatus = dbHealth.connected
    ? await getGmailConnectionStatus()
    : {
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        connected: false,
        accountEmail: null,
        scopes: [],
        expiresAt: null,
      };

  let heartbeat: typeof schema.extensionHeartbeats.$inferSelect | null = null;
  const countsBySource: Record<string, number> = {};
  const lastCollectedBySource: Record<string, string | null> = {};

  if (dbHealth.connected && !options?.isDemo) {
    try {
      const db = await getDb();
      const [hb] = await db
        .select()
        .from(schema.extensionHeartbeats)
        .where(eq(schema.extensionHeartbeats.id, 'primary'))
        .limit(1);
      heartbeat = hb || null;

      const rows = await db
        .select({
          source: schema.jobs.source,
          count: sql<number>`count(*)::int`,
          lastCollected: sql<string>`max(${schema.jobs.collectedAt})`,
        })
        .from(schema.jobs)
        .groupBy(schema.jobs.source);

      for (const r of rows) {
        countsBySource[r.source] = Number(r.count || 0);
        lastCollectedBySource[r.source] = r.lastCollected || null;
      }
    } catch {
      // Keep safe defaults
    }
  }

  const nowMs = Date.now();
  const lastSeenMs = heartbeat?.lastSeenAt ? heartbeat.lastSeenAt.getTime() : 0;
  const isExtRecent = lastSeenMs > 0 && nowMs - lastSeenMs < 24 * 60 * 60 * 1000;

  const extensionStatus: IntegrationState = heartbeat?.lastError
    ? 'needs_attention'
    : isExtRecent
      ? 'connected'
      : heartbeat
        ? 'offline'
        : 'unconfigured';

  const makeBoardItem = (
    id: 'welcome_to_the_jungle' | 'indeed' | 'hellowork' | 'meteojob',
    name: string,
    limitationNote: string
  ): IntegrationStatusItem => {
    const importedCount = countsBySource[id] || 0;
    const lastSync = lastCollectedBySource[id] || null;
    const status: IntegrationState =
      importedCount > 0 && isExtRecent
        ? 'connected'
        : isExtRecent
          ? 'configured_unverified'
          : 'offline';

    return {
      id,
      name,
      category: 'job_board',
      status,
      statusLabel:
        status === 'connected'
          ? 'Synchronisé via Extension'
          : status === 'configured_unverified'
            ? 'Prêt via Extension Chrome'
            : 'Extension Chrome hors ligne',
      mode: 'browser_extension',
      detail: `${limitationNote} (${importedCount} offre${importedCount > 1 ? 's' : ''} en base)`,
      lastActivityAt: lastSync,
      metrics: { importedCount, requiresBrowser: true },
    };
  };

  return [
    {
      id: 'database',
      name: 'Base de données PostgreSQL',
      category: 'infrastructure',
      status: dbHealth.connected ? 'connected' : 'error',
      statusLabel: dbHealth.connected
        ? dbHealth.mode === 'postgres'
          ? 'Connected (PostgreSQL Cloud)'
          : 'Connected (PGlite Local)'
        : 'Non configurée / Hors ligne',
      mode: 'database',
      detail: dbHealth.detail,
      metrics: { mode: dbHealth.mode, persistent: dbHealth.persistent },
    },
    {
      id: 'gemini',
      name: 'Google Gemini API',
      category: 'ai',
      status: geminiConfigured ? 'configured_unverified' : 'unconfigured',
      statusLabel: geminiConfigured
        ? `Configuré (${geminiModel}) — tester dans Settings`
        : 'Non configuré (GEMINI_API_KEY manquante)',
      mode: 'server_api',
      detail: GEMINI_MODEL_DEPRECATION_NOTE,
      metrics: { model: geminiModel, sdk: '@google/genai', configured: geminiConfigured },
    },
    {
      id: 'france_travail',
      name: 'France Travail API Offres v2',
      category: 'job_board',
      status: ftConfigured ? 'configured_unverified' : 'unconfigured',
      statusLabel: ftConfigured
        ? 'Identifiants présents — tester la connexion'
        : 'Non configuré (clés API manquantes)',
      mode: 'server_api',
      detail: `Application : ${FRANCE_TRAVAIL_APP_NAME} — OAuth2 client_credentials côté serveur (${countsBySource.france_travail || 0} offre(s)).`,
      lastActivityAt: lastCollectedBySource.france_travail || null,
      metrics: {
        configured: ftConfigured,
        importedCount: countsBySource.france_travail || 0,
      },
    },
    {
      id: 'gmail',
      name: 'Gmail API (OAuth2)',
      category: 'email',
      status: gmailStatus.connected
        ? 'connected'
        : gmailStatus.configured
          ? 'configured_unverified'
          : 'unconfigured',
      statusLabel: gmailStatus.connected
        ? `Connected (${gmailStatus.accountEmail || 'Compte Google'})`
        : gmailStatus.configured
          ? 'OAuth configuré — connexion utilisateur requise'
          : 'Non configuré (GOOGLE_CLIENT_ID / SECRET manquants)',
      mode: 'oauth2',
      detail:
        'Scopes minimaux (gmail.compose, gmail.send). Envoi strictement verrouillé derrière une confirmation humaine.',
      metrics: {
        accountEmail: gmailStatus.accountEmail,
        scopesCount: gmailStatus.scopes.length,
      },
    },
    {
      id: 'chrome_extension',
      name: 'Extension Chrome Manifest V3',
      category: 'browser',
      status: extensionStatus,
      statusLabel:
        extensionStatus === 'connected'
          ? `Connected (v${heartbeat?.extensionVersion || '1.0.0'})`
          : extensionStatus === 'needs_attention'
            ? 'Action humaine requise'
            : extensionStatus === 'offline'
              ? 'Navigateur Chrome fermé / inactif'
              : 'Jamais synchronisée',
      mode: 'browser_extension',
      detail: heartbeat?.lastError
        ? `Dernière alerte : ${heartbeat.lastError}`
        : heartbeat?.lastSyncAt
          ? `Dernière synchro : ${heartbeat.lastSyncAt.toISOString()} (${heartbeat.totalImported} offres importées).`
          : 'Chargez le dossier /extension dans chrome://extensions et configurez votre EXTENSION_INGEST_TOKEN.',
      lastActivityAt: heartbeat?.lastSeenAt ? heartbeat.lastSeenAt.toISOString() : null,
      metrics: {
        totalImported: heartbeat?.totalImported || 0,
        lastPlatform: heartbeat?.lastPlatform || null,
      },
    },
    {
      id: 'welcome_to_the_jungle',
      name: 'Welcome to the Jungle',
      category: 'job_board',
      status: dbHealth.connected ? 'configured_unverified' : 'error',
      statusLabel: dbHealth.connected ? 'Import assisté disponible' : 'Base de données indisponible',
      mode: 'manual',
      detail: `Enregistrez le lien et vos propres notes dans Job Matches. Pas de connexion directe au compte ni de collecte automatisée. (${countsBySource.welcome_to_the_jungle || 0} offre(s) en base).`,
      lastActivityAt: lastCollectedBySource.welcome_to_the_jungle || null,
      metrics: { importedCount: countsBySource.welcome_to_the_jungle || 0, requiresBrowser: false },
    },
    makeBoardItem(
      'indeed',
      'Indeed',
      'Collecte DOM/JSON-LD via Extension Chrome MV3 ; bascule assistée si protection anti-bot.'
    ),
    makeBoardItem(
      'hellowork',
      'HelloWork',
      'Collecte DOM/JSON-LD via Extension Chrome MV3 sur les pages consultées.'
    ),
    makeBoardItem(
      'meteojob',
      'Meteojob',
      'Collecte DOM/JSON-LD via Extension Chrome MV3 sur les pages consultées.'
    ),
  ];
}
