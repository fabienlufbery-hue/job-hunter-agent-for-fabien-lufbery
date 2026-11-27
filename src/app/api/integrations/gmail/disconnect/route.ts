import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { disconnectGmail } from '@/lib/gmail/client';

export async function POST() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    await disconnectGmail();
    return NextResponse.json({ ok: true, disconnected: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur déconnexion Gmail' },
      { status: 500 }
    );
  }
}
