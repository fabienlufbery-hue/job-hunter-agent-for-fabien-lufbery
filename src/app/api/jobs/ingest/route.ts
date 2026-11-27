import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { verifyExtensionToken } from '@/lib/auth';
import { rawJobInputSchema } from '@/lib/jobs/normalize';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';
import { checkRateLimit, getClientIp } from '@/lib/security';

const browserSourceHosts: Record<string, string[]> = {
  welcome_to_the_jungle: ['www.welcometothejungle.com'],
  indeed: ['fr.indeed.com', 'www.indeed.com'],
  hellowork: ['www.hellowork.com'],
  meteojob: ['www.meteojob.com'],
};

const ingestPayloadSchema = z.object({
  extensionVersion: z.string().max(40).optional().default('1.0.0'),
  platform: z
    .enum(['welcome_to_the_jungle', 'indeed', 'hellowork', 'meteojob'])
    .optional(),
  jobs: z.array(rawJobInputSchema).min(1).max(100),
}).superRefine(({ platform, jobs }, ctx) => {
  for (const [index, job] of jobs.entries()) {
    const hosts = browserSourceHosts[job.source];
    const url = URL.parse(job.originalUrl);
    if (url?.protocol !== 'https:' || !hosts?.includes(url.hostname)
        || (platform && platform !== job.source)) {
      ctx.addIssue({
        code: 'custom',
        path: ['jobs', index, 'originalUrl'],
        message: 'L’adresse HTTPS doit correspondre à la plateforme annoncée.',
      });
    }
  }
});

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Extension-Token',
  };
  if (origin && (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)
      || (process.env.NODE_ENV !== 'production' && origin === 'http://localhost:3000'))) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
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
    const body = await request.json().catch(() => null);
    // Explicitly reject any accidental cookie / auth credential payloads
    if (body && typeof body === 'object' && ('cookies' in body || 'sessionCookies' in body || 'password' in body)) {
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
            : 'Erreur de persistance de l’ingestion.',
      },
      { status: err instanceof z.ZodError ? 400 : 500, headers }
    );
  }
}
