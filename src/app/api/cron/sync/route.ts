import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import {
  ConcurrentRunError,
  isScheduledParisSlot,
  runServerAutomationSync,
} from '@/lib/automation/scheduler';

export const maxDuration = 180;

async function handleCron(request: Request) {
  const check = verifyCronSecret(request);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason || 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  const now = new Date();
  const slot = isScheduledParisSlot(now);

  if (!force && !slot.matches) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Heure actuelle Europe/Paris (${slot.parisHour}h) hors créneaux 09h00 / 18h00 (garde changement d'heure DST).`,
    });
  }

  const triggerType = !force && slot.slotLabel !== 'off_slot' ? slot.slotLabel : 'manual';

  try {
    const run = await runServerAutomationSync({
      triggerType,
      scheduledAt: force ? undefined : now,
      force,
    });
    if (!run) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Créneau déjà traité.' });
    }
    return NextResponse.json(
      { ok: run.status !== 'failed', skipped: false, run },
      { status: run.status === 'failed' ? 503 : 200 }
    );
  } catch (err) {
    if (err instanceof ConcurrentRunError) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: err.message, activeRunId: err.activeRunId },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur exécution cron' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handleCron(request);
}

export async function GET(request: Request) {
  return handleCron(request);
}
