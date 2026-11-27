import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { ConcurrentRunError, runServerAutomationSync } from '@/lib/automation/scheduler';

export const maxDuration = 180;

export async function POST(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const force = Boolean(body?.force);

  try {
    const result = await runServerAutomationSync({
      triggerType: 'manual',
      force,
    });
    return NextResponse.json({ ok: true, run: result });
  } catch (err) {
    if (err instanceof ConcurrentRunError) {
      return NextResponse.json(
        { error: err.message, activeRunId: err.activeRunId },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur exécution manuelle' },
      { status: 500 }
    );
  }
}
