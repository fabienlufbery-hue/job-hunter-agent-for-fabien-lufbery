import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { requireOwnerSession } from '@/lib/auth';
import {
  getFranceTravailClient,
  mapContractTypeToFranceTravailCode,
} from '@/lib/france-travail/client';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';

const syncSchema = z.object({
  motsCles: z.string().trim().max(150).optional(),
  departement: z.string().trim().max(20).optional(),
  commune: z.string().trim().max(20).optional(),
  typeContrat: z.string().trim().max(30).optional(),
  maxResults: z.number().int().min(1).max(150).optional().default(30),
});

export async function POST(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const startedAt = new Date();
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = syncSchema.parse(body);

    const client = getFranceTravailClient();
    const mappedContract = parsed.typeContrat
      ? mapContractTypeToFranceTravailCode(parsed.typeContrat) || parsed.typeContrat
      : undefined;

    const searchRes = await client.searchOffers({
      motsCles: parsed.motsCles,
      departement: parsed.departement,
      commune: parsed.commune,
      typeContrat: mappedContract,
      maxResults: parsed.maxResults,
      sort: '1',
    });

    const upsertRes = await upsertNormalizedJobs(searchRes.offers);
    const finishedAt = new Date();

    const db = await getDb();
    await db.insert(schema.automationRuns).values({
      id: crypto.randomUUID(),
      triggerType: 'france_travail_sync',
      sources: ['france_travail'],
      status: 'success',
      jobsFetched: upsertRes.fetched,
      jobsNew: upsertRes.inserted,
      jobsDuplicates: upsertRes.duplicates,
      jobsScored: 0,
      errors: [],
      startedAt,
      finishedAt,
    });

    return NextResponse.json({
      ok: true,
      totalAvailable: searchRes.totalAvailable,
      pagesFetched: searchRes.pagesFetched,
      ...upsertRes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur synchronisation France Travail' },
      { status: 400 }
    );
  }
}
