import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { checkDatabaseHealth, getDb, schema } from '@/db';
import { verifyExtensionToken } from '@/lib/auth';

const heartbeatSchema = z.object({
  extensionVersion: z.string().max(40).default('1.0.0'),
  lastPlatform: z.string().max(60).nullable().optional(),
  browserStatus: z.enum(['active', 'idle', 'needs_attention']).default('active'),
  lastError: z.string().max(500).nullable().optional(),
});

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

export async function GET(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const tokenCheck = verifyExtensionToken(request);
  if (!tokenCheck.valid) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: tokenCheck.reason },
      { status: 401, headers }
    );
  }

  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.connected) {
    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        databaseConnected: false,
        app: 'Job Hunter Agent for Fabien Lufbery',
        heartbeat: null,
      },
      { headers }
    );
  }

  const db = await getDb();
  const [hb] = await db
    .select()
    .from(schema.extensionHeartbeats)
    .where(eq(schema.extensionHeartbeats.id, 'primary'))
    .limit(1);

  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      databaseConnected: true,
      app: 'Job Hunter Agent for Fabien Lufbery',
      heartbeat: hb
        ? {
            ...hb,
            lastSeenAt: hb.lastSeenAt ? hb.lastSeenAt.toISOString() : null,
            lastSyncAt: hb.lastSyncAt ? hb.lastSyncAt.toISOString() : null,
          }
        : null,
    },
    { headers }
  );
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const tokenCheck = verifyExtensionToken(request);
  if (!tokenCheck.valid) {
    return NextResponse.json({ error: tokenCheck.reason }, { status: 401, headers });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = heartbeatSchema.parse(body);
    const now = new Date();
    const db = await getDb();

    const [existing] = await db
      .select()
      .from(schema.extensionHeartbeats)
      .where(eq(schema.extensionHeartbeats.id, 'primary'))
      .limit(1);

    if (existing) {
      await db
        .update(schema.extensionHeartbeats)
        .set({
          extensionVersion: parsed.extensionVersion,
          lastSeenAt: now,
          lastPlatform: parsed.lastPlatform ?? existing.lastPlatform,
          browserStatus: parsed.browserStatus,
          lastError: parsed.lastError ?? null,
        })
        .where(eq(schema.extensionHeartbeats.id, 'primary'));
    } else {
      await db.insert(schema.extensionHeartbeats).values({
        id: 'primary',
        extensionVersion: parsed.extensionVersion,
        lastSeenAt: now,
        lastPlatform: parsed.lastPlatform ?? null,
        totalImported: 0,
        platformCounts: {},
        browserStatus: parsed.browserStatus,
        lastError: parsed.lastError ?? null,
      });
    }

    return NextResponse.json({ ok: true, lastSeenAt: now.toISOString() }, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur heartbeat extension' },
      { status: 400, headers }
    );
  }
}
