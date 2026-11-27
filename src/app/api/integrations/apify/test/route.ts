import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { testApifyConnection } from '@/lib/apify/client';
export async function POST() {
  const auth = await requireOwnerSession(); if (!auth.ok) return auth.response;
  try { return NextResponse.json(await testApifyConnection()); }
  catch (err) { return NextResponse.json({ connected: false, error: err instanceof Error ? err.message : 'Erreur Apify' }, { status: 400 }); }
}
