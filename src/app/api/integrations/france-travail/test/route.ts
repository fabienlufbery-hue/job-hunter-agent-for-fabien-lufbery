import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { getFranceTravailClient } from '@/lib/france-travail/client';

export async function POST() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const result = await getFranceTravailClient().testConnection();
  return NextResponse.json(result, { status: result.connected ? 200 : 400 });
}
