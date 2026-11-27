import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ACTIVE_JOB_SOURCES,
  APIFY_EXECUTION_MODES,
  APIFY_SOURCE_KINDS,
} from '@/db/schema';
import { requireOwnerSession, requireSessionOrDemo } from '@/lib/auth';
import {
  formatApifyPathId,
  isApifyTokenConfigured,
  listUserApifyTasks,
} from '@/lib/apify/client';
import { VERIFIED_APIFY_ACTOR_CATALOG } from '@/lib/apify/preferences-mapper';
import { createApifySource, listApifySources } from '@/lib/apify/repository';
import { DEMO_APIFY_SOURCES } from '@/lib/demo/data';

const createSourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(APIFY_SOURCE_KINDS),
  apifyId: z.string().trim().min(2).max(160),
  platform: z.enum(ACTIVE_JOB_SOURCES),
  executionMode: z.enum(APIFY_EXECUTION_MODES).default('run_and_fetch'),
  enabled: z.boolean().optional().default(true),
  maxItems: z.number().int().min(1).max(200).optional().default(30),
  maxCostUsd: z.number().min(0.05).max(20).optional().default(0.5),
  timeoutSecs: z.number().int().min(30).max(600).optional().default(120),
  memoryMbytes: z.number().int().min(128).max(4096).optional().default(512),
  inputTemplate: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET(request: Request) {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  if (auth.isDemo) {
    return NextResponse.json({
      isDemo: true,
      sources: DEMO_APIFY_SOURCES,
      discoveredTasks: [],
      catalog: VERIFIED_APIFY_ACTOR_CATALOG,
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const discover = searchParams.get('discover') === 'true';
    const sources = await listApifySources();
    let discoveredTasks: Array<{ id: string; name: string; title: string | null; actId: string }> =
      [];
    let discoveryError: string | null = null;

    if (discover && isApifyTokenConfigured()) {
      try {
        discoveredTasks = await listUserApifyTasks();
      } catch (err) {
        discoveryError = err instanceof Error ? err.message : 'Erreur lecture tâches Apify';
      }
    }

    return NextResponse.json({
      isDemo: false,
      sources,
      discoveredTasks,
      discoveryError,
      catalog: VERIFIED_APIFY_ACTOR_CATALOG,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture sources Apify' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = createSourceSchema.parse(body);
    // Validate Apify ID syntax strictly before saving
    formatApifyPathId(parsed.apifyId);

    const created = await createApifySource(parsed);
    return NextResponse.json({ ok: true, source: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message
            : err instanceof Error
              ? err.message
              : 'Erreur création source Apify',
      },
      { status: 400 }
    );
  }
}
