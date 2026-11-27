import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { verifyExtensionToken } from '@/lib/auth';
import { rawJobInputSchema } from '@/lib/jobs/normalize';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';
import { checkRateLimit, getClientIp } from '@/lib/security';

const ingestPayloadSchema = z.object({
  extensionVersion: z.string().max(40).optional().default('1.0.0'),
  platform: z
    .enum(['welcome_to_the_jungle', 'indeed', 'hellowork', 'meteojob'])
    .optional(),
  jobs: z.array(rawJobInputSchema).min(1).max(100),
});

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    origin && (origin.startsWith('chrome-extension://') || origin.startsWith('http://localhost'))
      ? origin
      : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Extension-Token',
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));

  const limit = checkRateLimit(`ingest:${getClientIp(request)}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes d’ingestion. Patientez quelques instants.' },
      { status: 429, headers }
    );
  }

  const tokenCheck = verifyExtensionToken(request);
  if (!tokenCheck.valid) {
    return NextResponse.json(
      { error: tokenCheck.reason || 'Token d’extension invalide', code: 'UNAUTHORIZED' },
      { status: 401, headers }
    );
  }

  try {
    const body = await request.json();
    // Explicitly reject any accidental cookie / auth credential payloads
    if (body && ('cookies' in body || 'sessionCookies' in body || 'password' in body)) {
      return NextResponse.json(
        {
          error:
            'Politique de sécurité : l’extension ne doit jamais transmettre de cookies ou identifiants de session.',
        },
        { status: 400, headers }
      );
    }

    const parsed = ingestPayloadSchema.parse(body);
    const result = await upsertNormalizedJobs(parsed.jobs);
    const now = new Date();
    const db = await getDb();

    // Update extension heartbeat & platform stats
    const [existingHb] = await db
      .select()
      .from(schema.extensionHeartbeats)
      .where(eq(schema.extensionHeartbeats.id, 'primary'))
      .limit(1);

    const nextPlatformCounts = { ...(existingHb?.platformCounts || {}) };
    for (const j of parsed.jobs) {
      nextPlatformCounts[j.source] = (nextPlatformCounts[j.source] || 0) + 1;
    }

    const hbValues = {
      extensionVersion: parsed.extensionVersion,
      lastSeenAt: now,
      lastSyncAt: now,
      lastPlatform: parsed.platform || parsed.jobs[0]?.source || null,
      totalImported: (existingHb?.totalImported || 0) + result.inserted,
      platformCounts: nextPlatformCounts,
      lastError: null,
      browserStatus: 'active',
    };

    if (existingHb) {
      await db
        .update(schema.extensionHeartbeats)
        .set(hbValues)
        .where(eq(schema.extensionHeartbeats.id, 'primary'));
    } else {
      await db.insert(schema.extensionHeartbeats).values({ id: 'primary', ...hbValues });
    }

    // Record sync run in automation_runs for full traceability
    const sources = Array.from(new Set(parsed.jobs.map((j) => j.source)));
    await db.insert(schema.automationRuns).values({
      id: crypto.randomUUID(),
      triggerType: 'extension_sync',
      sources,
      status: 'success',
      jobsFetched: result.fetched,
      jobsNew: result.inserted,
      jobsDuplicates: result.duplicates,
      jobsScored: 0,
      errors: [],
      startedAt: now,
      finishedAt: now,
    });

    return NextResponse.json(
      {
        ok: true,
        fetched: result.fetched,
        inserted: result.inserted,
        duplicates: result.duplicates,
        updated: result.updated,
        totalImportedAllTime: hbValues.totalImported,
        syncedAt: now.toISOString(),
      },
      { headers }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? `Données d’offre invalides : ${err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
            : err instanceof Error
              ? err.message
              : 'Erreur ingestion',
      },
      { status: err instanceof z.ZodError ? 400 : 500, headers }
    );
  }
}
