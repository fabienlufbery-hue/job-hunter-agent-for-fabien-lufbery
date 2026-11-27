import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnerSession } from '@/lib/auth';
import { ConcurrentRunError, runServerAutomationSync } from '@/lib/automation/scheduler';

export const maxDuration = 180;

const syncBodySchema = z
  .object({
    sourceId: z.string().optional(),
    force: z.boolean().optional().default(false),
  })
  .optional();

export async function POST(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const raw = await request.json().catch(() => undefined);
    const parsed = syncBodySchema.parse(raw);

    const run = await runServerAutomationSync({
      triggerType: 'apify_sync',
      sourceId: parsed?.sourceId,
      force: parsed?.force ?? false,
    });

    if (!run) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    return NextResponse.json(
      {
        ok: run.status !== 'failed',
        inserted: run.jobsNew,
        duplicates: run.jobsDuplicates,
        fetched: run.jobsFetched,
        scored: run.jobsScored,
        costUsd: run.costUsd,
        status: run.status,
        hasAsyncPending: run.hasAsyncPending,
        run,
      },
      { status: run.status === 'failed' ? 400 : 200 }
    );
  } catch (err) {
    if (err instanceof ConcurrentRunError) {
      return NextResponse.json(
        { error: err.message, activeRunId: err.activeRunId },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur synchronisation Apify' },
      { status: 400 }
    );
  }
}
