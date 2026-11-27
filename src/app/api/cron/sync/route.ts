import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { isScheduledParisSlot, runServerAutomationSync } from '@/lib/automation/scheduler';

async function handleCron(request: Request) {
  const check = verifyCronSecret(request);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason || 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  const slot = isScheduledParisSlot();

  if (!force && !slot.matches) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Heure actuelle Europe/Paris (${slot.parisHour}h) hors créneaux 09h00 / 18h00 (garde changement d'heure DST).`,
    });
  }

  const triggerType =
    slot.slotLabel === 'scheduled_09' || slot.slotLabel === 'scheduled_18'
      ? slot.slotLabel
      : 'manual';

  try {
    const run = await runServerAutomationSync({
      triggerType,
      maxOffers: 50,
      autoScoreLimit: 15,
    });
    return NextResponse.json({ ok: true, skipped: false, run });
  } catch (err) {
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
