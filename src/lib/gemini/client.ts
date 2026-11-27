import { GoogleGenAI } from '@google/genai';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const ACADEMIC_ORIGINAL_MODEL = 'gemini-2.5-flash';

export const GEMINI_MODEL_DEPRECATION_NOTE =
  'Le sujet académique demandait initialement gemini-2.5-flash. Google déprécie gemini-2.5-flash (accès restreint pour les nouveaux projets et routage automatique vers son successeur à partir du 1er décembre 2026). Le modèle recommandé par Google, gemini-3.5-flash-lite, est configuré par défaut via GEMINI_MODEL avec le SDK officiel @google/genai.';

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getGeminiClient(apiKey?: string): GoogleGenAI {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY non configurée côté serveur.');
  }
  return new GoogleGenAI({ apiKey: key });
}

function describeGeminiError(error: unknown): string {
  const detail = error instanceof Error ? error.message : '';
  const status = detail.match(/\b(400|401|403|404|429|500|502|503|504)\b/)?.[1];
  return status ? `Requête Gemini refusée (HTTP ${status}).` : 'Requête Gemini indisponible.';
}

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  options?: { maxAttempts?: number; sleepMs?: (ms: number) => Promise<void> }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const sleep =
    options?.sleepMs ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('timeout') ||
        msg.includes('ECONNRESET');

      if (!isRetryable || attempt >= maxAttempts) {
        throw new Error(describeGeminiError(err));
      }
      await sleep(attempt * 800);
    }
  }
  throw new Error(describeGeminiError(lastError));
}

export async function testGeminiConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  model: string;
  latencyMs?: number;
  error?: string;
}> {
  const model = getGeminiModel();
  if (!isGeminiConfigured()) {
    return {
      configured: false,
      connected: false,
      model,
      error: 'Variable GEMINI_API_KEY non configurée côté serveur.',
    };
  }

  const start = Date.now();
  try {
    const client = getGeminiClient();
    const res = await client.models.generateContent({
      model,
      contents: 'Reply with OK only.',
      config: { store: false, maxOutputTokens: 128, httpOptions: { timeout: 15_000 } },
    });
    return {
      configured: true,
      connected: Boolean(res.text),
      model,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      model,
      latencyMs: Date.now() - start,
      error: describeGeminiError(err),
    };
  }
}
