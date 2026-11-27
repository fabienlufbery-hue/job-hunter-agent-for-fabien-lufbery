import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireSessionOrDemo } from '@/lib/auth';
import {
  DEMO_APPLICATIONS,
  DEMO_AUTOMATION_RUNS,
  DEMO_JOBS,
  DEMO_PREFERENCES,
} from '@/lib/demo/data';
import { listJobsWithAnalyses } from '@/lib/jobs/repository';
import { getNextScheduledRunParis } from '@/lib/automation/scheduler';
import { getAllIntegrationsStatus } from '@/lib/integrations/status';

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  const nextScheduledRun = getNextScheduledRunParis();

  if (auth.isDemo) {
    const bySource: Record<string, number> = {
      welcome_to_the_jungle: 0,
      linkedin: 0,
      indeed: 0,
      hellowork: 0,
      meteojob: 0,
      other: 0,
    };
    for (const j of DEMO_JOBS) {
      bySource[j.source] = (bySource[j.source] || 0) + 1;
    }

    const compatibleJobs = DEMO_JOBS.filter(
      (j) => (j.analysis?.fitScore ?? 0) >= DEMO_PREFERENCES.minFitScore
    );
    const topJobs = [...DEMO_JOBS]
      .sort((a, b) => (b.analysis?.fitScore ?? 0) - (a.analysis?.fitScore ?? 0))
      .slice(0, 5);
    const integrations = await getAllIntegrationsStatus({ isDemo: true });

    return NextResponse.json({
      isDemo: true,
      kpis: {
        totalJobs: DEMO_JOBS.length,
        newJobsLast24h: 3,
        compatibleJobs: compatibleJobs.length,
        preparedApplications: DEMO_APPLICATIONS.length,
        appliedApplications: DEMO_APPLICATIONS.filter(
          (a) => a.status === 'applied' || a.status === 'sent'
        ).length,
      },
      bySource,
      topJobs,
      lastSyncAt: DEMO_AUTOMATION_RUNS[0]?.finishedAt || null,
      nextScheduledRun,
      integrations,
    });
  }

  try {
    const db = await getDb();
    const [jobs, apps, runs, prefsRows, integrations] = await Promise.all([
      listJobsWithAnalyses(),
      db.select().from(schema.applications),
      db
        .select()
        .from(schema.automationRuns)
        .orderBy(desc(schema.automationRuns.startedAt))
        .limit(5),
      db
        .select()
        .from(schema.searchPreferences)
        .where(eq(schema.searchPreferences.id, 'primary'))
        .limit(1),
      getAllIntegrationsStatus({ isDemo: false }),
    ]);

    const minFit = prefsRows[0]?.minFitScore ?? 6;
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const bySource: Record<string, number> = {
      welcome_to_the_jungle: 0,
      linkedin: 0,
      indeed: 0,
      hellowork: 0,
      meteojob: 0,
      other: 0,
    };
    for (const j of jobs) {
      bySource[j.source] = (bySource[j.source] || 0) + 1;
    }

    const compatibleJobs = jobs.filter((j) => (j.analysis?.fitScore ?? 0) >= minFit);
    const newJobsLast24h = jobs.filter(
      (j) => new Date(j.collectedAt).getTime() >= cutoff24h
    ).length;
    const topJobs = [...jobs]
      .sort((a, b) => (b.analysis?.fitScore ?? -1) - (a.analysis?.fitScore ?? -1))
      .slice(0, 5);

    return NextResponse.json({
      isDemo: false,
      kpis: {
        totalJobs: jobs.length,
        newJobsLast24h,
        compatibleJobs: compatibleJobs.length,
        preparedApplications: apps.length,
        appliedApplications: apps.filter(
          (a) =>
            a.status === 'applied' ||
            a.status === 'sent' ||
            a.status === 'interview' ||
            a.status === 'offer'
        ).length,
      },
      bySource,
      topJobs,
      lastSyncAt:
        runs[0]?.finishedAt?.toISOString() || runs[0]?.startedAt?.toISOString() || null,
      nextScheduledRun,
      integrations,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur chargement Overview' },
      { status: 500 }
    );
  }
}
