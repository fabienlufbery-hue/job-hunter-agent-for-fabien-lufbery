import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, schema, type AutomationErrorEntry } from '@/db';
import {
  getFranceTravailClient,
  isFranceTravailConfigured,
  mapContractTypeToFranceTravailCode,
} from '@/lib/france-travail/client';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';
import { isGeminiConfigured } from '@/lib/gemini/client';
import { scoreAndPersistJob } from '@/lib/gemini/scoring';

export const AUTOMATION_TIMEZONE = 'Europe/Paris';
export const AUTOMATION_HOURS_PARIS = [9, 18] as const;

export interface ParisTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getParisTimeParts(date: Date): ParisTimeParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: AUTOMATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Computes the next scheduled 09:00 or 18:00 Europe/Paris timestamp (DST-safe).
 */
export function getNextScheduledRunParis(from: Date = new Date()): {
  iso: string;
  labelParis: string;
  slotHour: 9 | 18;
} {
  // Walk forward in 15-minute increments up to 48 hours until exact Paris hour:00 matches 9 or 18
  const startMs = Math.ceil(from.getTime() / (60 * 1000)) * 60 * 1000;
  for (let offsetMin = 1; offsetMin <= 48 * 60; offsetMin++) {
    const candidate = new Date(startMs + offsetMin * 60 * 1000);
    const p = getParisTimeParts(candidate);
    if ((p.hour === 9 || p.hour === 18) && p.minute === 0) {
      const labelParis = new Intl.DateTimeFormat('fr-FR', {
        timeZone: AUTOMATION_TIMEZONE,
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(candidate);
      return {
        iso: candidate.toISOString(),
        labelParis: `${labelParis} (Europe/Paris)`,
        slotHour: p.hour as 9 | 18,
      };
    }
  }
  const fallback = new Date(from.getTime() + 12 * 3600 * 1000);
  return {
    iso: fallback.toISOString(),
    labelParis: 'Prochain créneau 09h00 / 18h00 (Europe/Paris)',
    slotHour: 9,
  };
}

export function isScheduledParisSlot(date: Date = new Date()): {
  matches: boolean;
  parisHour: number;
  slotLabel: 'scheduled_09' | 'scheduled_18' | 'off_slot';
} {
  const { hour } = getParisTimeParts(date);
  if (hour === 9) return { matches: true, parisHour: hour, slotLabel: 'scheduled_09' };
  if (hour === 18) return { matches: true, parisHour: hour, slotLabel: 'scheduled_18' };
  return { matches: false, parisHour: hour, slotLabel: 'off_slot' };
}

export async function runServerAutomationSync(options?: {
  triggerType?: 'scheduled_09' | 'scheduled_18' | 'manual' | 'france_travail_sync';
  maxOffers?: number;
  autoScoreLimit?: number;
}) {
  const db = await getDb();
  const runId = crypto.randomUUID();
  const startedAt = new Date();
  const triggerType = options?.triggerType ?? 'manual';

  await db.insert(schema.automationRuns).values({
    id: runId,
    triggerType,
    sources: ['france_travail'],
    status: 'running',
    jobsFetched: 0,
    jobsNew: 0,
    jobsDuplicates: 0,
    jobsScored: 0,
    errors: [],
    startedAt,
  });

  const errors: AutomationErrorEntry[] = [];
  let jobsFetched = 0;
  let jobsNew = 0;
  let jobsDuplicates = 0;
  let jobsScored = 0;

  try {
    const [prefs] = await db
      .select()
      .from(schema.searchPreferences)
      .where(eq(schema.searchPreferences.id, 'primary'))
      .limit(1);

    const keywordsList = [
      ...(prefs?.targetRoles || []),
      ...(prefs?.keywords || []),
    ].filter(Boolean);
    const motsCles = keywordsList.slice(0, 3).join(' ') || 'développeur';
    const departement = prefs?.departmentCodes?.[0] || undefined;
    const commune = prefs?.communeCodes?.[0] || undefined;
    const mappedContract = prefs?.contractTypes?.[0]
      ? mapContractTypeToFranceTravailCode(prefs.contractTypes[0]) || undefined
      : undefined;

    let newJobIds: string[] = [];

    if (!isFranceTravailConfigured()) {
      errors.push({
        source: 'france_travail',
        code: 'NOT_CONFIGURED',
        message:
          'Identifiants France Travail non configurés (FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET).',
      });
    } else {
      try {
        const ftClient = getFranceTravailClient();
        const searchRes = await ftClient.searchOffers({
          motsCles,
          departement,
          commune,
          typeContrat: mappedContract,
          maxResults: options?.maxOffers ?? 50,
          sort: '1',
        });

        const upsertRes = await upsertNormalizedJobs(searchRes.offers);
        jobsFetched = upsertRes.fetched;
        jobsNew = upsertRes.inserted;
        jobsDuplicates = upsertRes.duplicates;
        newJobIds = upsertRes.newJobIds;
      } catch (err) {
        errors.push({
          source: 'france_travail',
          code: 'API_ERROR',
          message: err instanceof Error ? err.message : 'Erreur API France Travail',
        });
      }
    }

    // Score new jobs automatically when Master CV & Gemini API are configured
    const [cvRow] = await db
      .select({ id: schema.masterCv.id })
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    if (newJobIds.length > 0 && cvRow && isGeminiConfigured()) {
      const limit = options?.autoScoreLimit ?? 15;
      for (const jobId of newJobIds.slice(0, limit)) {
        try {
          const scored = await scoreAndPersistJob(jobId);
          if (!scored.cached) jobsScored += 1;
        } catch (err) {
          errors.push({
            source: 'gemini',
            code: 'SCORING_ERROR',
            message: `Offre ${jobId}: ${err instanceof Error ? err.message : 'Erreur scoring Gemini'}`,
          });
        }
      }
    } else if (newJobIds.length > 0 && !isGeminiConfigured()) {
      errors.push({
        source: 'gemini',
        code: 'NOT_CONFIGURED',
        message: 'GEMINI_API_KEY non configurée : offres collectées mais non évaluées par IA.',
      });
    }

    const status =
      errors.length === 0 ? 'success' : jobsFetched > 0 ? 'partial' : 'failed';
    const finishedAt = new Date();

    await db
      .update(schema.automationRuns)
      .set({
        status,
        jobsFetched,
        jobsNew,
        jobsDuplicates,
        jobsScored,
        errors,
        finishedAt,
      })
      .where(eq(schema.automationRuns.id, runId));

    return {
      runId,
      triggerType,
      status,
      jobsFetched,
      jobsNew,
      jobsDuplicates,
      jobsScored,
      errors,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  } catch (err) {
    const finishedAt = new Date();
    errors.push({
      source: 'orchestrator',
      code: 'UNEXPECTED',
      message: err instanceof Error ? err.message : 'Erreur inattendue',
    });
    await db
      .update(schema.automationRuns)
      .set({ status: 'failed', errors, finishedAt })
      .where(eq(schema.automationRuns.id, runId));
    throw err;
  }
}
