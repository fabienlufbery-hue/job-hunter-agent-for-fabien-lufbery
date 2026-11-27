import crypto from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, schema, type AutomationErrorEntry } from '@/db';
import { fetchApifyJobs, isApifyConfigured } from '@/lib/apify/client';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';
import { isGeminiConfigured } from '@/lib/gemini/client';
import { scoreAndPersistJob } from '@/lib/gemini/scoring';

export const AUTOMATION_TIMEZONE = 'Europe/Paris';
export const AUTOMATION_HOURS_PARIS = [9, 18] as const;

const parisClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: AUTOMATION_TIMEZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

export interface ParisTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getParisTimeParts(date: Date): ParisTimeParts {
  const parts = parisClock.formatToParts(date);
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
  // Walk forward minute by minute up to 48 hours until exact Paris hour:00 matches 9 or 18
  const startMs = Math.floor(from.getTime() / (60 * 1000)) * 60 * 1000;
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
  scheduledAt?: Date;
  maxOffers?: number;
  autoScoreLimit?: number;
}) {
  const db = await getDb();
  const startedAt = new Date();
  const triggerType = options?.triggerType ?? 'manual';

  const slot = options?.scheduledAt && getParisTimeParts(options.scheduledAt);
  const runId = slot
    ? `${triggerType}:${slot.year}-${slot.month}-${slot.day}`
    : crypto.randomUUID();
  const [claimed] = await db.insert(schema.automationRuns).values({
    id: runId,
    triggerType,
    sources: ['apify'],
    status: 'running',
    startedAt,
  }).onConflictDoNothing({ target: schema.automationRuns.id }).returning();
  if (!claimed) return null;

  const errors: AutomationErrorEntry[] = [];
  let jobsFetched = 0;
  let jobsNew = 0;
  let jobsDuplicates = 0;
  let jobsScored = 0;

  try {
    let newJobIds: string[] = [];
    if (!isApifyConfigured()) {
      errors.push({ source: 'apify', code: 'NOT_CONFIGURED', message: 'Configurez APIFY_API_TOKEN et APIFY_TASK_ID.' });
    } else {
      try {
        const { offers, fetched, rejected } = await fetchApifyJobs(options?.maxOffers ?? 100);
        const result = await upsertNormalizedJobs(offers);
        jobsFetched = fetched;
        jobsNew = result.inserted;
        jobsDuplicates = result.duplicates;
        newJobIds = result.newJobIds;
        if (rejected) errors.push({ source: 'apify', code: 'INVALID_ITEMS', message: rejected + ' élément(s) non importé(s).' });
      } catch (err) {
        errors.push({ source: 'apify', code: 'API_ERROR', message: err instanceof Error ? err.message : 'Erreur Apify' });
      }
    }

    // Score new jobs automatically when Master CV & Gemini API are configured
    const [cvRow] = await db
      .select({ cvHash: schema.masterCv.contentHash })
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    if (cvRow && isGeminiConfigured()) {
      const limit = options?.autoScoreLimit ?? 15;
      const pending = await db
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .leftJoin(schema.jobAnalyses, and(
          eq(schema.jobAnalyses.jobId, schema.jobs.id),
          eq(schema.jobAnalyses.jobContentHash, schema.jobs.contentHash),
          eq(schema.jobAnalyses.cvHash, cvRow.cvHash)
        ))
        .where(isNull(schema.jobAnalyses.id))
        .orderBy(desc(schema.jobs.collectedAt))
        .limit(limit);
      const jobIds = [...new Set([...newJobIds, ...pending.map((job) => job.id)])];
      for (const jobId of jobIds.slice(0, limit)) {
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
    } else if (newJobIds.length > 0) {
      errors.push({
        source: 'gemini',
        code: cvRow ? 'NOT_CONFIGURED' : 'CV_MISSING',
        message: cvRow ? 'GEMINI_API_KEY non configurée.' : 'Importez le Master CV pour évaluer les offres.',
      });
    }

    const status =
      errors.length === 0 ? 'success' : (jobsFetched > 0 || jobsScored > 0) ? 'partial' : 'failed';
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
