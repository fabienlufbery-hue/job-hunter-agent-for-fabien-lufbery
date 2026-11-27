import { checkDatabaseHealth } from '@/db';
import { isApifyTokenConfigured } from '@/lib/apify/client';
import {
  getAppSettings,
  getMonthlyApifySpendUsd,
  listApifySources,
} from '@/lib/apify/repository';
import {
  GEMINI_MODEL_INFO_NOTE,
  getGeminiModel,
  isGeminiConfigured,
} from '@/lib/gemini/client';

export type IntegrationState =
  | 'connected'
  | 'configured_unverified'
  | 'unconfigured'
  | 'error';

export interface IntegrationStatusItem {
  id: 'gemini' | 'apify' | 'database';
  name: string;
  category: 'ai' | 'job_search' | 'infrastructure';
  status: IntegrationState;
  statusLabel: string;
  mode: 'server_api' | 'database';
  detail: string;
  lastVerifiedAt?: string | null;
  metrics?: Record<string, string | number | boolean | null>;
}

/**
 * Returns real, honest status for ONLY the 3 architectural components:
 * 1. Google Gemini API (AI)
 * 2. Apify API (Job Search)
 * 3. PostgreSQL / Neon (Storage Infrastructure)
 * Never displays "Connected" unless actually verified.
 */
export async function getAllIntegrationsStatus(options?: {
  isDemo?: boolean;
}): Promise<IntegrationStatusItem[]> {
  const dbHealth = await checkDatabaseHealth();

  if (options?.isDemo) {
    return [
      {
        id: 'gemini',
        name: 'Google Gemini API',
        category: 'ai',
        status: 'unconfigured',
        statusLabel: 'Masqué en Mode Démo',
        mode: 'server_api',
        detail: `Modèle par défaut : ${getGeminiModel()}. Les appels réels et clés serveur restent protégés hors du Mode Démonstration.`,
        metrics: { model: getGeminiModel(), sdk: '@google/genai' },
      },
      {
        id: 'apify',
        name: 'Apify API',
        category: 'job_search',
        status: 'unconfigured',
        statusLabel: 'Masqué en Mode Démo',
        mode: 'server_api',
        detail:
          'Collecte multi-plateformes (WTTJ, Indeed, HelloWork, Meteojob, LinkedIn) via Actors & Tasks Apify avec plafonds budgétaires. Connectez-vous pour consulter le statut réel.',
      },
      {
        id: 'database',
        name: 'PostgreSQL / Neon',
        category: 'infrastructure',
        status: dbHealth.connected ? 'connected' : 'error',
        statusLabel: dbHealth.connected ? 'Connecté (Infrastructure)' : 'Indisponible',
        mode: 'database',
        detail: dbHealth.detail,
        metrics: { mode: dbHealth.mode, persistent: dbHealth.persistent },
      },
    ];
  }

  const settings = dbHealth.connected ? await getAppSettings() : null;
  const sources = dbHealth.connected ? await listApifySources() : [];
  const monthlySpendUsd = dbHealth.connected ? await getMonthlyApifySpendUsd() : 0;

  const geminiConfigured = isGeminiConfigured();
  const geminiVerified = Boolean(geminiConfigured && settings?.lastGeminiVerifiedOk === true);
  const geminiModel = getGeminiModel();

  const apifyConfigured = isApifyTokenConfigured();
  const apifyVerified = Boolean(apifyConfigured && settings?.lastApifyVerifiedOk === true);
  const enabledSourcesCount = sources.filter((s) => s.enabled).length;

  return [
    {
      id: 'gemini',
      name: 'Google Gemini API',
      category: 'ai',
      status: !geminiConfigured
        ? 'unconfigured'
        : geminiVerified
          ? 'connected'
          : 'configured_unverified',
      statusLabel: !geminiConfigured
        ? 'Non configuré'
        : geminiVerified
          ? `Connecté (${geminiModel})`
          : 'Configuré — non vérifié',
      mode: 'server_api',
      detail: `${GEMINI_MODEL_INFO_NOTE}`,
      lastVerifiedAt: settings?.lastGeminiVerifiedAt || null,
      metrics: {
        model: geminiModel,
        sdk: '@google/genai',
        configured: geminiConfigured,
        verified: geminiVerified,
      },
    },
    {
      id: 'apify',
      name: 'Apify API',
      category: 'job_search',
      status: !apifyConfigured
        ? 'unconfigured'
        : apifyVerified
          ? 'connected'
          : 'configured_unverified',
      statusLabel: !apifyConfigured
        ? 'Non configuré'
        : apifyVerified
          ? `Connecté (${settings?.lastApifyAccount || 'Compte Apify'})`
          : 'Jeton présent — à vérifier',
      mode: 'server_api',
      detail: apifyConfigured
        ? `${enabledSourcesCount} source(s) active(s) sur ${sources.length} configurée(s) · Dépense mensuelle : $${monthlySpendUsd.toFixed(3)} / $${(settings?.monthlyApifyBudgetUsd ?? 5).toFixed(2)}.`
        : 'Configurez APIFY_API_TOKEN dans les variables d’environnement Vercel puis sélectionnez vos Tasks ou Actors dans Settings.',
      lastVerifiedAt: settings?.lastApifyVerifiedAt || null,
      metrics: {
        configured: apifyConfigured,
        verified: apifyVerified,
        activeSources: enabledSourcesCount,
        totalSources: sources.length,
        monthlySpendUsd: Number(monthlySpendUsd.toFixed(4)),
        monthlyBudgetUsd: settings?.monthlyApifyBudgetUsd ?? 5.0,
      },
    },
    {
      id: 'database',
      name: 'PostgreSQL / Neon',
      category: 'infrastructure',
      status: dbHealth.connected ? 'connected' : 'error',
      statusLabel: dbHealth.connected
        ? dbHealth.mode === 'postgres'
          ? 'Connecté (Neon PostgreSQL)'
          : 'Connecté (PGlite Local)'
        : 'Indisponible',
      mode: 'database',
      detail: dbHealth.detail,
      metrics: {
        mode: dbHealth.mode,
        persistent: dbHealth.persistent,
      },
    },
  ];
}
