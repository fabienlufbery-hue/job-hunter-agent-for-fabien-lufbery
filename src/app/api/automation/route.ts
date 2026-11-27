import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireSessionOrDemo } from '@/lib/auth';
import { DEMO_AUTOMATION_RUNS } from '@/lib/demo/data';
import { AUTOMATION_TIMEZONE, getNextScheduledRunParis } from '@/lib/automation/scheduler';

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  const nextRun = getNextScheduledRunParis();
  const schedule = {
    timezone: AUTOMATION_TIMEZONE,
    dailySlots: ['09:00', '18:00'],
    nextRun,
    serverEngine: 'GitHub Actions DST-safe Cron (.github/workflows/daily-job-sync.yml) -> POST /api/cron/sync',
    localComplement: 'macOS launchd (scripts/install-macos-launchd.sh)',
    browserEngine: 'Extension Chrome Manifest V3 (chrome.alarms 09:00 & 18:00 — nécessite navigateur ouvert)',
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
  };

  if (auth.isDemo) {
    return NextResponse.json({
      isDemo: true,
      schedule,
      extensionHeartbeat: {
        browserStatus: 'demo',
        lastSeenAt: '2026-11-26T17:02:11.000Z',
        lastSyncAt: '2026-11-26T17:02:11.000Z',
        totalImported: 4,
        lastError: null,
      },
      runs: DEMO_AUTOMATION_RUNS,
    });
  }

  try {
    const db = await getDb();
    const [runs, hbRows] = await Promise.all([
      db
        .select()
        .from(schema.automationRuns)
        .orderBy(desc(schema.automationRuns.startedAt))
        .limit(30),
      db
        .select()
        .from(schema.extensionHeartbeats)
        .where(eq(schema.extensionHeartbeats.id, 'primary'))
        .limit(1),
    ]);

    return NextResponse.json({
      isDemo: false,
      schedule,
      extensionHeartbeat: hbRows[0] || null,
      runs: runs.map((r) => ({
        ...r,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture automatisation' },
      { status: 500 }
    );
  }
}
