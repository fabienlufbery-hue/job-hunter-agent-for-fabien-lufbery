import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { fetchApifyJobs } from '@/lib/apify/client';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';
export async function POST() {
  const auth = await requireOwnerSession(); if (!auth.ok) return auth.response;
  try {
    const { offers, rejected } = await fetchApifyJobs(100);
    return NextResponse.json({ ok: true, ...await upsertNormalizedJobs(offers), rejected });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur Apify' }, { status: 400 }); }
}
