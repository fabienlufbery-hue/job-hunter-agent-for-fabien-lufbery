import crypto from 'node:crypto';
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { getDb, schema, type AutomationErrorEntry } from '@/db';
import {
  createApifyWebhookSignature,
  fetchNormalizedDatasetItems,
  getApifyRunStatus,
  getLastSucceededApifyRun,
  isApifyTokenConfigured,
  startApifyRun,
} from '@/lib/apify/client';
import {
  getAppSettings,
  getMonthlyApifySpendUsd,
  listApifySources,
} from '@/lib/apify/repository';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';
import { isGeminiConfigured } from '@/lib/gemini/client';
import { computeProfileCacheHash, scoreAndPersistJob } from '@/lib/gemini/scoring';

export const AUTOMATION_TIMEZONE = 'Europe/Paris';
export const AUTOMATION_HOURS_PARIS = [9, 18] as const;

const parisClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: AUTOMATION_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
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
  const get = (type: string) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
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

async function scorePendingJobs(
  newJobIds: string[],
  maxScores: number,
  errors: AutomationErrorEntry[]
): Promise<number> {
  const db = await getDb();
  const [cvRow] = await db
    .select({ cvHash: schema.masterCv.contentHash })
    .from(schema.masterCv)
    .where(eq(schema.masterCv.id, 'primary'))
    .limit(1);

  if (!cvRow) {
    if (newJobIds.length > 0) {
      errors.push({
        source: 'gemini',
        code: 'CV_MISSING',
        message: 'Importez votre Master CV (My CV) pour analyser automatiquement les offres.',
      });
    }
    return 0;
  }

  if (!isGeminiConfigured()) {
    if (newJobIds.length > 0) {
      errors.push({
        source: 'gemini',
        code: 'NOT_CONFIGURED',
        message: 'GEMINI_API_KEY non configurée : offres importées mais non notées par IA.',
      });
    }
    return 0;
  }

  const [prefsRow] = await db
    .select()
    .from(schema.searchPreferences)
    .where(eq(schema.searchPreferences.id, 'primary'))
    .limit(1);

  const effectiveHash = computeProfileCacheHash(
    cvRow.cvHash,
    prefsRow
      ? {
          targetRoles: prefsRow.targetRoles,
          sectors: prefsRow.sectors,
          cities: prefsRow.cities,
          contractTypes: prefsRow.contractTypes,
          duration: prefsRow.duration,
          remotePolicy: prefsRow.remotePolicy,
          keywords: prefsRow.keywords,
        }
      : null
  );

  const limit = Math.max(0, Math.min(50, maxScores));
  if (limit === 0) return 0;

  const pending = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .leftJoin(
      schema.jobAnalyses,
      and(
        eq(schema.jobAnalyses.jobId, schema.jobs.id),
        eq(schema.jobAnalyses.jobContentHash, schema.jobs.contentHash),
        eq(schema.jobAnalyses.cvHash, effectiveHash)
      )
    )
    .where(isNull(schema.jobAnalyses.id))
    .orderBy(desc(schema.jobs.collectedAt))
    .limit(limit);

  const jobIds = [...new Set([...newJobIds, ...pending.map((j) => j.id)])];
  let scoredCount = 0;

  for (const jobId of jobIds.slice(0, limit)) {
    try {
      const res = await scoreAndPersistJob(jobId);
      if (!res.cached) scoredCount += 1;
    } catch (err) {
      errors.push({
        source: 'gemini',
        code: 'SCORING_ERROR',
        message: `Offre ${jobId}: ${err instanceof Error ? err.message : 'Erreur scoring Gemini'}`,
      });
    }
  }

  return scoredCount;
}

/**
 * Checks any in-progress async Apify runs, imports finished datasets into PostgreSQL,
 * updates costs & statuses, and triggers Gemini scoring for new offers.
 */
export async function pollPendingApifyRuns(options?: {
  automationRunId?: string;
  waitForFinishSecs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{
  checked: number;
  stillRunning: number;
  fetched: number;
  inserted: number;
  duplicates: number;
  scored: number;
  costUsd: number;
  errors: AutomationErrorEntry[];
}> {
  const db = await getDb();
  const settings = await getAppSettings();
  const pendingRows = await db
    .select()
    .from(schema.apifyRuns)
    .where(
      options?.automationRunId
        ? and(
            eq(schema.apifyRuns.automationRunId, options.automationRunId),
            inArray(schema.apifyRuns.status, ['READY', 'RUNNING'])
          )
        : inArray(schema.apifyRuns.status, ['READY', 'RUNNING'])
    )
    .orderBy(desc(schema.apifyRuns.startedAt))
    .limit(10);

  let stillRunning = 0;
  let fetched = 0;
  let inserted = 0;
  let duplicates = 0;
  let costUsd = 0;
  const newJobIds: string[] = [];
  const errors: AutomationErrorEntry[] = [];

  for (const runRow of pendingRows) {
    try {
      const live = await getApifyRunStatus(runRow.apifyRunId, {
        waitForFinishSecs: options?.waitForFinishSecs ?? 10,
        fetchImpl: options?.fetchImpl,
      });

      if (live.status === 'READY' || live.status === 'RUNNING') {
        stillRunning += 1;
        await db
          .update(schema.apifyRuns)
          .set({
            status: live.status,
            datasetId: live.defaultDatasetId || runRow.datasetId,
            costUsd: live.usageTotalUsd || runRow.costUsd,
          })
          .where(eq(schema.apifyRuns.id, runRow.id));
        continue;
      }

      costUsd += live.usageTotalUsd;

      if (live.status === 'SUCCEEDED' && live.defaultDatasetId) {
        const [sourceRow] = runRow.sourceId
          ? await db
              .select()
              .from(schema.apifySources)
              .where(eq(schema.apifySources.id, runRow.sourceId))
              .limit(1)
          : [];

        const ds = await fetchNormalizedDatasetItems({
          datasetId: live.defaultDatasetId,
          maxItems: sourceRow?.maxItems ?? settings.maxItemsPerSource,
          fallbackPlatform: sourceRow?.platform ?? 'other',
          allowOtherHosts: true,
          fetchImpl: options?.fetchImpl,
        });

        const upserted = await upsertNormalizedJobs(ds.offers);
        fetched += ds.fetched;
        inserted += upserted.inserted;
        duplicates += upserted.duplicates;
        newJobIds.push(...upserted.newJobIds);

        const now = new Date();
        await db
          .update(schema.apifyRuns)
          .set({
            status: 'IMPORTED',
            datasetId: live.defaultDatasetId,
            itemsFetched: ds.fetched,
            itemsInserted: upserted.inserted,
            itemsDuplicates: upserted.duplicates,
            itemsRejected: ds.rejected,
            costUsd: live.usageTotalUsd,
            finishedAt: live.finishedAt ? new Date(live.finishedAt) : now,
            importedAt: now,
            errorMessage:
              ds.rejected > 0 ? `${ds.rejected} élément(s) ignoré(s) (format/URL invalide)` : null,
          })
          .where(eq(schema.apifyRuns.id, runRow.id));

        if (sourceRow) {
          await db
            .update(schema.apifySources)
            .set({
              lastDatasetId: live.defaultDatasetId,
              lastRunAt: now,
              lastStatus: 'SUCCEEDED',
              updatedAt: now,
            })
            .where(eq(schema.apifySources.id, sourceRow.id));
        }
      } else {
        const errMsg =
          live.statusMessage || `Exécution Apify terminée avec le statut ${live.status}.`;
        errors.push({ source: runRow.sourceName, code: live.status, message: errMsg });
        await db
          .update(schema.apifyRuns)
          .set({
            status: live.status,
            costUsd: live.usageTotalUsd,
            errorMessage: errMsg,
            finishedAt: live.finishedAt ? new Date(live.finishedAt) : new Date(),
          })
          .where(eq(schema.apifyRuns.id, runRow.id));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur suivi run Apify';
      errors.push({ source: runRow.sourceName, code: 'POLL_ERROR', message: msg });
    }
  }

  let scored = 0;
  if (settings.autoScoreOnSync && newJobIds.length > 0) {
    scored = await scorePendingJobs(newJobIds, settings.maxGeminiScoresPerRun, errors);
  }

  // Reconcile all affected parent automationRuns (whether or not automationRunId was explicitly passed)
  const affectedParentIds = Array.from(
    new Set(
      [
        options?.automationRunId,
        ...pendingRows.map((r) => r.automationRunId),
      ].filter((id): id is string => Boolean(id))
    )
  );

  for (const parentId of affectedParentIds) {
    const [parent] = await db
      .select()
      .from(schema.automationRuns)
      .where(eq(schema.automationRuns.id, parentId))
      .limit(1);

    if (!parent || parent.status !== 'running') continue;

    const remainingForParent = await db
      .select({ id: schema.apifyRuns.id })
      .from(schema.apifyRuns)
      .where(
        and(
          eq(schema.apifyRuns.automationRunId, parentId),
          inArray(schema.apifyRuns.status, ['READY', 'RUNNING'])
        )
      )
      .limit(1);

    if (remainingForParent.length === 0) {
      const mergedErrors = [...(parent.errors || []), ...errors];
      const finalFetched = parent.jobsFetched + fetched;
      const finalNew = parent.jobsNew + inserted;
      const finalDup = parent.jobsDuplicates + duplicates;
      const finalScored = parent.jobsScored + scored;
      const finalCost = Number((parent.costUsd + costUsd).toFixed(4));
      const finalStatus =
        mergedErrors.length === 0
          ? 'success'
          : finalFetched > 0 || finalScored > 0
            ? 'partial'
            : 'failed';

      await db
        .update(schema.automationRuns)
        .set({
          status: finalStatus,
          jobsFetched: finalFetched,
          jobsNew: finalNew,
          jobsDuplicates: finalDup,
          jobsScored: finalScored,
          costUsd: finalCost,
          summary: `${finalFetched} récupérées, ${finalNew} nouvelles, ${finalDup} doublons, ${finalScored} notées IA.`,
          errors: mergedErrors,
          finishedAt: new Date(),
        })
        .where(eq(schema.automationRuns.id, parent.id));
    }
  }

  return {
    checked: pendingRows.length,
    stillRunning,
    fetched,
    inserted,
    duplicates,
    scored,
    costUsd,
    errors,
  };
}

export class ConcurrentRunError extends Error {
  activeRunId: string;
  constructor(message: string, activeRunId: string) {
    super(message);
    this.name = 'ConcurrentRunError';
    this.activeRunId = activeRunId;
  }
}

export async function runServerAutomationSync(options?: {
  triggerType?: 'scheduled_09' | 'scheduled_18' | 'manual' | 'apify_sync';
  scheduledAt?: Date;
  maxOffers?: number;
  autoScoreLimit?: number;
  sourceId?: string;
  force?: boolean;
  waitForFinishSecs?: number;
  fetchImpl?: typeof fetch;
}) {
  const db = await getDb();
  const startedAt = new Date();
  const triggerType = options?.triggerType ?? 'manual';
  const settings = await getAppSettings();

  // 1. Reconcile any previously running async Apify jobs first
  if (isApifyTokenConfigured()) {
    await pollPendingApifyRuns({ waitForFinishSecs: 2, fetchImpl: options?.fetchImpl }).catch(
      () => {}
    );
  }

  // 2. Prevent simultaneous overlapping runs (protects against duplicate Apify spend)
  const tenMinutesAgo = new Date(startedAt.getTime() - 10 * 60 * 1000);
  const [activeRun] = await db
    .select()
    .from(schema.automationRuns)
    .where(
      and(
        eq(schema.automationRuns.status, 'running'),
        gte(schema.automationRuns.startedAt, tenMinutesAgo)
      )
    )
    .orderBy(desc(schema.automationRuns.startedAt))
    .limit(1);

  if (activeRun && !options?.force) {
    throw new ConcurrentRunError(
      'Une recherche est déjà en cours d’exécution. Patientez jusqu’à sa finalisation pour éviter les doublons de coûts Apify.',
      activeRun.id
    );
  }

  // 3. Enforce cooldown on manual triggers if not forced
  if (triggerType === 'manual' && !options?.force && settings.minCooldownMinutes > 0) {
    const cooldownStart = new Date(startedAt.getTime() - settings.minCooldownMinutes * 60 * 1000);
    const [recentManual] = await db
      .select()
      .from(schema.automationRuns)
      .where(
        and(
          eq(schema.automationRuns.triggerType, 'manual'),
          gte(schema.automationRuns.startedAt, cooldownStart)
        )
      )
      .orderBy(desc(schema.automationRuns.startedAt))
      .limit(1);

    if (recentManual && recentManual.status === 'success') {
      throw new ConcurrentRunError(
        `Un délai anti-doublon de ${settings.minCooldownMinutes} min est actif entre deux recherches manuelles réussies (ajustable dans Settings).`,
        recentManual.id
      );
    }
  }

  // 4. Atomic slot claim for scheduled 09:00 / 18:00 Europe/Paris runs
  const slot = options?.scheduledAt && getParisTimeParts(options.scheduledAt);
  const runId = slot
    ? `${triggerType}:${slot.year}-${slot.month}-${slot.day}`
    : crypto.randomUUID();

  const [claimed] = await db
    .insert(schema.automationRuns)
    .values({
      id: runId,
      triggerType,
      sources: ['apify'],
      status: 'running',
      startedAt,
    })
    .onConflictDoNothing({ target: schema.automationRuns.id })
    .returning();

  if (!claimed) return null;

  const errors: AutomationErrorEntry[] = [];
  const apifyRunIds: string[] = [];
  const usedPlatforms = new Set<string>();
  let jobsFetched = 0;
  let jobsNew = 0;
  let jobsDuplicates = 0;
  let jobsScored = 0;
  let totalCostUsd = 0;
  let hasAsyncPending = false;
  const newJobIds: string[] = [];

  try {
    if (!isApifyTokenConfigured()) {
      errors.push({
        source: 'apify',
        code: 'NOT_CONFIGURED',
        message: 'APIFY_API_TOKEN non configuré dans les variables d’environnement serveur.',
      });
    } else {
      const allSources = await listApifySources();
      const activeSources = allSources.filter(
        (s) => s.enabled && (!options?.sourceId || s.id === options.sourceId)
      );

      if (activeSources.length === 0) {
        errors.push({
          source: 'apify',
          code: 'NO_SOURCES',
          message:
            'Aucune source Apify (Actor ou Task) activée. Configurez au moins une source dans Settings ou APIFY_TASK_ID.',
        });
      } else {
        const [prefsRow] = await db
          .select()
          .from(schema.searchPreferences)
          .where(eq(schema.searchPreferences.id, 'primary'))
          .limit(1);

        const monthlySpend = await getMonthlyApifySpendUsd(startedAt);
        let remainingMonthlyBudget = Math.max(0, settings.monthlyApifyBudgetUsd - monthlySpend);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, '') || '';
        const webhookSig = createApifyWebhookSignature(runId);
        const webhookUrl =
          appUrl.startsWith('https://') && webhookSig
            ? `${appUrl}/api/apify/webhook?runId=${encodeURIComponent(runId)}&sig=${encodeURIComponent(webhookSig)}`
            : undefined;

        for (const src of activeSources) {
          usedPlatforms.add(src.platform);
          const effectiveMaxItems = Math.min(
            src.maxItems,
            options?.maxOffers ?? settings.maxItemsPerSource
          );

          try {
            if (src.executionMode === 'fetch_last_dataset') {
              const lastRun = await getLastSucceededApifyRun({
                kind: src.kind,
                apifyId: src.apifyId,
                fetchImpl: options?.fetchImpl,
              });

              if (!lastRun.defaultDatasetId) {
                errors.push({
                  source: src.name,
                  code: 'NO_DATASET',
                  message: 'Aucun dataset réussi trouvé sur cette tâche/actor Apify.',
                });
                continue;
              }

              const ds = await fetchNormalizedDatasetItems({
                datasetId: lastRun.defaultDatasetId,
                maxItems: effectiveMaxItems,
                fallbackPlatform: src.platform,
                allowOtherHosts: true,
                fetchImpl: options?.fetchImpl,
              });

              const upserted = await upsertNormalizedJobs(ds.offers);
              jobsFetched += ds.fetched;
              jobsNew += upserted.inserted;
              jobsDuplicates += upserted.duplicates;
              newJobIds.push(...upserted.newJobIds);
              if (lastRun.id) apifyRunIds.push(lastRun.id);

              const now = new Date();
              await db.insert(schema.apifyRuns).values({
                id: crypto.randomUUID(),
                automationRunId: runId,
                sourceId: src.id,
                sourceName: src.name,
                kind: src.kind,
                apifyId: src.apifyId,
                apifyRunId: lastRun.id || `dataset-${lastRun.defaultDatasetId}`,
                datasetId: lastRun.defaultDatasetId,
                status: 'IMPORTED',
                itemsFetched: ds.fetched,
                itemsInserted: upserted.inserted,
                itemsDuplicates: upserted.duplicates,
                itemsRejected: ds.rejected,
                costUsd: 0,
                startedAt: now,
                finishedAt: now,
                importedAt: now,
              });

              await db
                .update(schema.apifySources)
                .set({
                  lastDatasetId: lastRun.defaultDatasetId,
                  lastRunAt: now,
                  lastStatus: 'SUCCEEDED',
                  updatedAt: now,
                })
                .where(eq(schema.apifySources.id, src.id));

              if (ds.rejected > 0) {
                errors.push({
                  source: src.name,
                  code: 'INVALID_ITEMS',
                  message: `${ds.rejected} élément(s) ignoré(s) (URL ou format non valide).`,
                });
              }
            } else {
              // Mode run_and_fetch: enforce monthly & per-run budget cap strictly
              const allowedRunCost = Math.min(
                src.maxCostUsd,
                settings.maxCostPerRunUsd,
                remainingMonthlyBudget
              );

              if (allowedRunCost < 0.05) {
                errors.push({
                  source: src.name,
                  code: 'BUDGET_EXCEEDED',
                  message: `Budget mensuel Apify atteint ($${monthlySpend.toFixed(2)} / $${settings.monthlyApifyBudgetUsd.toFixed(2)}). Lancement bloqué par sécurité.`,
                });
                continue;
              }

              const started = await startApifyRun({
                kind: src.kind,
                apifyId: src.apifyId,
                platform: src.platform,
                preferences: {
                  targetRoles: prefsRow?.targetRoles || [],
                  keywords: prefsRow?.keywords || [],
                  cities: prefsRow?.cities || [],
                  sectors: prefsRow?.sectors || [],
                  contractTypes: prefsRow?.contractTypes || [],
                  remotePolicy: prefsRow?.remotePolicy || 'any',
                  maxItems: effectiveMaxItems,
                },
                inputTemplate: src.inputTemplate,
                maxCostUsd: allowedRunCost,
                timeoutSecs: Math.min(src.timeoutSecs, settings.runTimeoutSecs),
                memoryMbytes: src.memoryMbytes,
                webhookUrl,
                fetchImpl: options?.fetchImpl,
              });

              apifyRunIds.push(started.id);
              const apifyDbRowId = crypto.randomUUID();
              await db.insert(schema.apifyRuns).values({
                id: apifyDbRowId,
                automationRunId: runId,
                sourceId: src.id,
                sourceName: src.name,
                kind: src.kind,
                apifyId: src.apifyId,
                apifyRunId: started.id,
                datasetId: started.defaultDatasetId,
                status: started.status,
                costUsd: started.usageTotalUsd,
                startedAt: new Date(),
              });

              // Bounded long-poll safe for Vercel serverless timeout
              const waitSecs = options?.waitForFinishSecs ?? 20;
              const live =
                started.status === 'SUCCEEDED' || started.status === 'FAILED'
                  ? started
                  : await getApifyRunStatus(started.id, {
                      waitForFinishSecs: waitSecs,
                      fetchImpl: options?.fetchImpl,
                    });

              totalCostUsd += live.usageTotalUsd;
              remainingMonthlyBudget = Math.max(0, remainingMonthlyBudget - live.usageTotalUsd);

              if (live.status === 'SUCCEEDED' && live.defaultDatasetId) {
                const ds = await fetchNormalizedDatasetItems({
                  datasetId: live.defaultDatasetId,
                  maxItems: effectiveMaxItems,
                  fallbackPlatform: src.platform,
                  allowOtherHosts: true,
                  fetchImpl: options?.fetchImpl,
                });

                const upserted = await upsertNormalizedJobs(ds.offers);
                jobsFetched += ds.fetched;
                jobsNew += upserted.inserted;
                jobsDuplicates += upserted.duplicates;
                newJobIds.push(...upserted.newJobIds);

                const now = new Date();
                await db
                  .update(schema.apifyRuns)
                  .set({
                    status: 'IMPORTED',
                    datasetId: live.defaultDatasetId,
                    itemsFetched: ds.fetched,
                    itemsInserted: upserted.inserted,
                    itemsDuplicates: upserted.duplicates,
                    itemsRejected: ds.rejected,
                    costUsd: live.usageTotalUsd,
                    finishedAt: live.finishedAt ? new Date(live.finishedAt) : now,
                    importedAt: now,
                  })
                  .where(eq(schema.apifyRuns.id, apifyDbRowId));

                await db
                  .update(schema.apifySources)
                  .set({
                    lastDatasetId: live.defaultDatasetId,
                    lastRunAt: now,
                    lastStatus: 'SUCCEEDED',
                    updatedAt: now,
                  })
                  .where(eq(schema.apifySources.id, src.id));
              } else if (live.status === 'READY' || live.status === 'RUNNING') {
                // Async handoff: Apify continues running in cloud; poll/webhook finalizes it
                hasAsyncPending = true;
                await db
                  .update(schema.apifyRuns)
                  .set({
                    status: live.status,
                    datasetId: live.defaultDatasetId || started.defaultDatasetId,
                    costUsd: live.usageTotalUsd,
                  })
                  .where(eq(schema.apifyRuns.id, apifyDbRowId));

                await db
                  .update(schema.apifySources)
                  .set({ lastRunAt: new Date(), lastStatus: 'RUNNING', updatedAt: new Date() })
                  .where(eq(schema.apifySources.id, src.id));
              } else {
                const msg =
                  live.statusMessage || `Run Apify terminé avec statut ${live.status}.`;
                errors.push({ source: src.name, code: live.status, message: msg });
                await db
                  .update(schema.apifyRuns)
                  .set({
                    status: live.status,
                    costUsd: live.usageTotalUsd,
                    errorMessage: msg,
                    finishedAt: new Date(),
                  })
                  .where(eq(schema.apifyRuns.id, apifyDbRowId));
              }
            }
          } catch (err) {
            errors.push({
              source: src.name,
              code: 'APIFY_ERROR',
              message: err instanceof Error ? err.message : 'Erreur source Apify',
            });
          }
        }
      }
    }

    // 5. Score newly collected & pending jobs with Gemini
    if (settings.autoScoreOnSync) {
      const scoreLimit = options?.autoScoreLimit ?? settings.maxGeminiScoresPerRun;
      jobsScored = await scorePendingJobs(newJobIds, scoreLimit, errors);
    }

    const finalStatus = hasAsyncPending
      ? 'running'
      : errors.length === 0
        ? 'success'
        : jobsFetched > 0 || jobsScored > 0
          ? 'partial'
          : 'failed';
    const finishedAt = hasAsyncPending ? null : new Date();

    const summary = hasAsyncPending
      ? 'Collecte Apify en cours en arrière-plan (suivi asynchrone actif).'
      : `${jobsFetched} récupérées, ${jobsNew} nouvelles, ${jobsDuplicates} doublons, ${jobsScored} notées IA.`;

    await db
      .update(schema.automationRuns)
      .set({
        sources: usedPlatforms.size > 0 ? Array.from(usedPlatforms) : ['apify'],
        status: finalStatus,
        jobsFetched,
        jobsNew,
        jobsDuplicates,
        jobsScored,
        costUsd: Number(totalCostUsd.toFixed(4)),
        apifyRunIds,
        summary,
        errors,
        finishedAt,
      })
      .where(eq(schema.automationRuns.id, runId));

    return {
      runId,
      triggerType,
      status: finalStatus,
      hasAsyncPending,
      jobsFetched,
      jobsNew,
      jobsDuplicates,
      jobsScored,
      costUsd: Number(totalCostUsd.toFixed(4)),
      apifyRunIds,
      summary,
      errors,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt ? finishedAt.toISOString() : null,
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
