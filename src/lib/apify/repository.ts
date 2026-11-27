import crypto from 'node:crypto';
import { desc, eq, gte, sql } from 'drizzle-orm';
import {
  getDb,
  schema,
  type ActiveJobSource,
  type ApifyExecutionMode,
  type ApifySourceKind,
} from '@/db';

export interface AppSettingsData {
  monthlyApifyBudgetUsd: number;
  maxCostPerRunUsd: number;
  maxItemsPerSource: number;
  runTimeoutSecs: number;
  maxGeminiScoresPerRun: number;
  autoScoreOnSync: boolean;
  minCooldownMinutes: number;
  lastApifyVerifiedAt: string | null;
  lastApifyVerifiedOk: boolean | null;
  lastApifyAccount: string | null;
  lastGeminiVerifiedAt: string | null;
  lastGeminiVerifiedOk: boolean | null;
  lastGeminiModel: string | null;
}

export const DEFAULT_APP_SETTINGS: AppSettingsData = {
  monthlyApifyBudgetUsd: 5.0,
  maxCostPerRunUsd: 0.75,
  maxItemsPerSource: 30,
  runTimeoutSecs: 120,
  maxGeminiScoresPerRun: 15,
  autoScoreOnSync: true,
  minCooldownMinutes: 5,
  lastApifyVerifiedAt: null,
  lastApifyVerifiedOk: null,
  lastApifyAccount: null,
  lastGeminiVerifiedAt: null,
  lastGeminiVerifiedOk: null,
  lastGeminiModel: null,
};

export async function getAppSettings(): Promise<AppSettingsData> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, 'primary'))
    .limit(1);

  if (!row) return { ...DEFAULT_APP_SETTINGS };

  return {
    monthlyApifyBudgetUsd: row.monthlyApifyBudgetUsd,
    maxCostPerRunUsd: row.maxCostPerRunUsd,
    maxItemsPerSource: row.maxItemsPerSource,
    runTimeoutSecs: row.runTimeoutSecs,
    maxGeminiScoresPerRun: row.maxGeminiScoresPerRun,
    autoScoreOnSync: row.autoScoreOnSync,
    minCooldownMinutes: row.minCooldownMinutes,
    lastApifyVerifiedAt: row.lastApifyVerifiedAt ? row.lastApifyVerifiedAt.toISOString() : null,
    lastApifyVerifiedOk: row.lastApifyVerifiedOk ?? null,
    lastApifyAccount: row.lastApifyAccount ?? null,
    lastGeminiVerifiedAt: row.lastGeminiVerifiedAt ? row.lastGeminiVerifiedAt.toISOString() : null,
    lastGeminiVerifiedOk: row.lastGeminiVerifiedOk ?? null,
    lastGeminiModel: row.lastGeminiModel ?? null,
  };
}

export async function upsertAppSettings(
  patch: Partial<{
    monthlyApifyBudgetUsd: number;
    maxCostPerRunUsd: number;
    maxItemsPerSource: number;
    runTimeoutSecs: number;
    maxGeminiScoresPerRun: number;
    autoScoreOnSync: boolean;
    minCooldownMinutes: number;
    lastApifyVerifiedAt: Date | null;
    lastApifyVerifiedOk: boolean | null;
    lastApifyAccount: string | null;
    lastGeminiVerifiedAt: Date | null;
    lastGeminiVerifiedOk: boolean | null;
    lastGeminiModel: string | null;
  }>
): Promise<AppSettingsData> {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, 'primary'))
    .limit(1);

  const now = new Date();
  if (existing) {
    await db
      .update(schema.appSettings)
      .set({ ...patch, updatedAt: now })
      .where(eq(schema.appSettings.id, 'primary'));
  } else {
    await db.insert(schema.appSettings).values({
      id: 'primary',
      monthlyApifyBudgetUsd: patch.monthlyApifyBudgetUsd ?? DEFAULT_APP_SETTINGS.monthlyApifyBudgetUsd,
      maxCostPerRunUsd: patch.maxCostPerRunUsd ?? DEFAULT_APP_SETTINGS.maxCostPerRunUsd,
      maxItemsPerSource: patch.maxItemsPerSource ?? DEFAULT_APP_SETTINGS.maxItemsPerSource,
      runTimeoutSecs: patch.runTimeoutSecs ?? DEFAULT_APP_SETTINGS.runTimeoutSecs,
      maxGeminiScoresPerRun: patch.maxGeminiScoresPerRun ?? DEFAULT_APP_SETTINGS.maxGeminiScoresPerRun,
      autoScoreOnSync: patch.autoScoreOnSync ?? DEFAULT_APP_SETTINGS.autoScoreOnSync,
      minCooldownMinutes: patch.minCooldownMinutes ?? DEFAULT_APP_SETTINGS.minCooldownMinutes,
      lastApifyVerifiedAt: patch.lastApifyVerifiedAt ?? null,
      lastApifyVerifiedOk: patch.lastApifyVerifiedOk ?? null,
      lastApifyAccount: patch.lastApifyAccount ?? null,
      lastGeminiVerifiedAt: patch.lastGeminiVerifiedAt ?? null,
      lastGeminiVerifiedOk: patch.lastGeminiVerifiedOk ?? null,
      lastGeminiModel: patch.lastGeminiModel ?? null,
      updatedAt: now,
    });
  }
  return getAppSettings();
}

/**
 * Computes total recorded Apify USD cost for the current UTC calendar month.
 */
export async function getMonthlyApifySpendUsd(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.apifyRuns.costUsd}), 0)`,
    })
    .from(schema.apifyRuns)
    .where(gte(schema.apifyRuns.startedAt, monthStart));
  return Number(row?.total || 0);
}

/**
 * Lists configured Apify sources; if none exist in DB yet and APIFY_TASK_ID env var is set,
 * automatically creates an initial Task source linked to APIFY_TASK_ID.
 */
export async function listApifySources() {
  const db = await getDb();
  let rows = await db
    .select()
    .from(schema.apifySources)
    .orderBy(desc(schema.apifySources.createdAt));

  const envTaskId = process.env.APIFY_TASK_ID?.trim();
  if (rows.length === 0 && envTaskId && /^[a-zA-Z0-9._~/-]+$/.test(envTaskId)) {
    const now = new Date();
    const id = crypto.randomUUID();
    await db.insert(schema.apifySources).values({
      id,
      name: 'Tâche Apify par défaut (APIFY_TASK_ID)',
      kind: 'task',
      apifyId: envTaskId,
      platform: 'other',
      executionMode: 'run_and_fetch',
      enabled: true,
      maxItems: 30,
      maxCostUsd: 0.5,
      timeoutSecs: 120,
      memoryMbytes: 512,
      inputTemplate: {},
      createdAt: now,
      updatedAt: now,
    });
    rows = await db
      .select()
      .from(schema.apifySources)
      .orderBy(desc(schema.apifySources.createdAt));
  }

  return rows.map((r) => ({
    ...r,
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createApifySource(input: {
  name: string;
  kind: ApifySourceKind;
  apifyId: string;
  platform: ActiveJobSource;
  executionMode: ApifyExecutionMode;
  enabled?: boolean;
  maxItems?: number;
  maxCostUsd?: number;
  timeoutSecs?: number;
  memoryMbytes?: number;
  inputTemplate?: Record<string, unknown>;
}) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.apifySources).values({
    id,
    name: input.name.trim(),
    kind: input.kind,
    apifyId: input.apifyId.trim(),
    platform: input.platform,
    executionMode: input.executionMode,
    enabled: input.enabled ?? true,
    maxItems: Math.max(1, Math.min(200, input.maxItems ?? 30)),
    maxCostUsd: Math.max(0.05, Math.min(20, input.maxCostUsd ?? 0.5)),
    timeoutSecs: Math.max(30, Math.min(600, input.timeoutSecs ?? 120)),
    memoryMbytes: input.memoryMbytes ?? 512,
    inputTemplate: input.inputTemplate ?? {},
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(schema.apifySources)
    .where(eq(schema.apifySources.id, id))
    .limit(1);
  return created;
}
