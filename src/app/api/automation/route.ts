import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireSessionOrDemo } from '@/lib/auth';
import { DEMO_AUTOMATION_RUNS } from '@/lib/demo/data';
import { AUTOMATION_TIMEZONE, getNextScheduledRunParis } from '@/lib/automation/scheduler';
import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  getMonthlyApifySpendUsd,
} from '@/lib/apify/repository';

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  const nextRun = getNextScheduledRunParis();
  const schedule = {
    timezone: AUTOMATION_TIMEZONE,
    dailySlots: ['09:00', '18:00'],
    nextRun,
    serverEngine:
      'GitHub Actions Cron (.github/workflows/daily-job-sync.yml, Europe/Paris) -> POST /api/cron/sync',
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
  };

  if (auth.isDemo) {
    return NextResponse.json({
      isDemo: true,
      schedule,
      budget: {
        monthlySpendUsd: 0.073,
        monthlyBudgetUsd: DEFAULT_APP_SETTINGS.monthlyApifyBudgetUsd,
        maxCostPerRunUsd: DEFAULT_APP_SETTINGS.maxCostPerRunUsd,
      },
      runs: DEMO_AUTOMATION_RUNS,
      apifyRuns: [],
    });
  }

  try {
    const db = await getDb();
    const [runs, apifyRuns, settings, monthlySpendUsd] = await Promise.all([
      db
        .select()
        .from(schema.automationRuns)
        .orderBy(desc(schema.automationRuns.startedAt))
        .limit(30),
      db
        .select()
        .from(schema.apifyRuns)
        .orderBy(desc(schema.apifyRuns.startedAt))
        .limit(30),
      getAppSettings(),
      getMonthlyApifySpendUsd(),
    ]);

    return NextResponse.json({
      isDemo: false,
      schedule,
      budget: {
        monthlySpendUsd: Number(monthlySpendUsd.toFixed(4)),
        monthlyBudgetUsd: settings.monthlyApifyBudgetUsd,
        maxCostPerRunUsd: settings.maxCostPerRunUsd,
      },
      runs: runs.map((r) => ({
        ...r,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      })),
      apifyRuns: apifyRuns.map((a) => ({
        ...a,
        startedAt: a.startedAt.toISOString(),
        finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
        importedAt: a.importedAt ? a.importedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture automatisation' },
      { status: 500 }
    );
  }
}
