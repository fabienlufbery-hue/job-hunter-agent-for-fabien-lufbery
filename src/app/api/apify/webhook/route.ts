import { NextResponse } from 'next/server';
import { createApifyWebhookSignature } from '@/lib/apify/client';
import { safeEqual } from '@/lib/crypto';
import { pollPendingApifyRuns } from '@/lib/automation/scheduler';

export const maxDuration = 120;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('runId')?.trim() || '';
  const sig = url.searchParams.get('sig')?.trim() || '';

  const expected = runId ? createApifyWebhookSignature(runId) : null;
  if (!runId || !sig || !expected || !safeEqual(sig, expected)) {
    return NextResponse.json({ error: 'Signature webhook Apify invalide.' }, { status: 401 });
  }

  try {
    const result = await pollPendingApifyRuns({
      automationRunId: runId,
      waitForFinishSecs: 5,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur traitement webhook Apify' },
      { status: 500 }
    );
  }
}
