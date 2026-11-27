import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { scoreAndPersistJob } from '@/lib/gemini/scoring';
import { checkRateLimit, getClientIp } from '@/lib/security';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(`score:${getClientIp(request)}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Limite de requêtes atteinte pour l’évaluation Gemini. Réessayez dans 1 minute.' },
      { status: 429 }
    );
  }

  const { id } = await context.params;
  let force = false;
  try {
    const body = await request.json().catch(() => ({}));
    force = Boolean(body?.force);
  } catch {
    force = false;
  }

  try {
    const result = await scoreAndPersistJob(id, { force });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors du scoring Gemini' },
      { status: 400 }
    );
  }
}
