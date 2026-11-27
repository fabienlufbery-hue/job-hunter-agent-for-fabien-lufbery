import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ACTIVE_JOB_SOURCES,
  APIFY_EXECUTION_MODES,
  APIFY_SOURCE_KINDS,
  getDb,
  schema,
} from '@/db';
import { requireOwnerSession } from '@/lib/auth';
import { formatApifyPathId } from '@/lib/apify/client';

const patchSourceSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  kind: z.enum(APIFY_SOURCE_KINDS).optional(),
  apifyId: z.string().trim().min(2).max(160).optional(),
  platform: z.enum(ACTIVE_JOB_SOURCES).optional(),
  executionMode: z.enum(APIFY_EXECUTION_MODES).optional(),
  enabled: z.boolean().optional(),
  maxItems: z.number().int().min(1).max(200).optional(),
  maxCostUsd: z.number().min(0.05).max(20).optional(),
  timeoutSecs: z.number().int().min(30).max(600).optional(),
  memoryMbytes: z.number().int().min(128).max(4096).optional(),
  inputTemplate: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = patchSourceSchema.parse(body);
    if (parsed.apifyId) formatApifyPathId(parsed.apifyId);

    const db = await getDb();
    const [updated] = await db
      .update(schema.apifySources)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(schema.apifySources.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Source Apify introuvable.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, source: updated });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message
            : err instanceof Error
              ? err.message
              : 'Erreur mise à jour source Apify',
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const db = await getDb();
    await db.delete(schema.apifySources).where(eq(schema.apifySources.id, id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur suppression source Apify' },
      { status: 500 }
    );
  }
}
