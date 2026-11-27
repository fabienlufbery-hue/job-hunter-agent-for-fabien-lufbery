import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { runServerAutomationSync } from '@/lib/automation/scheduler';

export async function POST() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const result = await runServerAutomationSync({
      triggerType: 'manual',
      maxOffers: 40,
      autoScoreLimit: 10,
    });
    return NextResponse.json({ ok: true, run: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur exécution manuelle' },
      { status: 500 }
    );
  }
}
