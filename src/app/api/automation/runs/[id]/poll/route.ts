import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireOwnerSession } from '@/lib/auth';
import { abortApifyRun } from '@/lib/apify/client';
import { pollPendingApifyRuns } from '@/lib/automation/scheduler';

export const maxDuration = 120;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const result = await pollPendingApifyRuns({
      automationRunId: id,
      waitForFinishSecs: 10,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur rafraîchissement du run Apify' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const db = await getDb();
    const activeApifyRuns = await db
      .select()
      .from(schema.apifyRuns)
      .where(
        and(
          eq(schema.apifyRuns.automationRunId, id),
          inArray(schema.apifyRuns.status, ['READY', 'RUNNING'])
        )
      );

    for (const r of activeApifyRuns) {
      await abortApifyRun(r.apifyRunId).catch(() => {});
      await db
        .update(schema.apifyRuns)
        .set({ status: 'ABORTED', finishedAt: new Date(), errorMessage: 'Interrompu par l’utilisateur.' })
        .where(eq(schema.apifyRuns.id, r.id));
    }

    await db
      .update(schema.automationRuns)
      .set({
        status: 'failed',
        summary: 'Exécution interrompue manuellement.',
        finishedAt: new Date(),
      })
      .where(eq(schema.automationRuns.id, id));

    return NextResponse.json({ ok: true, aborted: activeApifyRuns.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur arrêt du run Apify' },
      { status: 400 }
    );
  }
}
