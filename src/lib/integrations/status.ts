import { checkDatabaseHealth } from '@/db';
import { isApifyConfigured } from '@/lib/apify/client';
import { getGeminiModel, isGeminiConfigured, GEMINI_MODEL_DEPRECATION_NOTE } from '@/lib/gemini/client';
export type IntegrationState = 'connected' | 'configured_unverified' | 'unconfigured' | 'offline' | 'needs_attention' | 'error';
export interface IntegrationStatusItem {
  id: string; name: string; category: 'ai' | 'job_board' | 'infrastructure';
  status: IntegrationState; statusLabel: string; mode: 'server_api' | 'database';
  detail: string; lastActivityAt?: string | null;
  metrics?: Record<string, string | number | boolean | null>;
}
export async function getAllIntegrationsStatus(options?: { isDemo?: boolean }): Promise<IntegrationStatusItem[]> {
  const db = await checkDatabaseHealth();
  const apify = !options?.isDemo && isApifyConfigured();
  const gemini = !options?.isDemo && isGeminiConfigured();
  return [
    { id: 'database', name: 'PostgreSQL', category: 'infrastructure', status: db.connected ? 'connected' : 'error', statusLabel: db.connected ? 'Disponible' : 'Indisponible', mode: 'database', detail: db.detail },
    { id: 'apify', name: 'Apify API', category: 'job_board', status: apify ? 'configured_unverified' : 'unconfigured', statusLabel: apify ? 'Configuré — tester' : 'À configurer', mode: 'server_api', detail: 'Import du dernier dataset réussi de votre tâche Apify autorisée. Aucun lancement payant automatique depuis cette application.' },
    { id: 'gemini', name: 'Google Gemini API', category: 'ai', status: gemini ? 'configured_unverified' : 'unconfigured', statusLabel: gemini ? 'Configuré — tester' : 'À configurer', mode: 'server_api', detail: getGeminiModel() + ' — ' + GEMINI_MODEL_DEPRECATION_NOTE },
  ];
}
