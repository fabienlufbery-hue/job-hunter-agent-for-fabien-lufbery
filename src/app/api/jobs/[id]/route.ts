import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema, APPLICATION_STATUSES } from '@/db';
import { requireOwnerSession, requireSessionOrDemo } from '@/lib/auth';
import { DEMO_JOBS } from '@/lib/demo/data';

const patchJobSchema = z.object({
  isFavorite: z.boolean().optional(),
  applicationStatus: z.enum(APPLICATION_STATUSES).optional(),
  notes: z.string().max(4000).nullable().optional(),
  recruiterEmail: z
    .string()
    .email()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  if (auth.isDemo) {
    const job = DEMO_JOBS.find((j) => j.id === id);
    if (!job) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });
    return NextResponse.json({ isDemo: true, job });
  }

  try {
    const db = await getDb();
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).limit(1);
    if (!job) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

    const [analysis] = await db
      .select()
      .from(schema.jobAnalyses)
      .where(eq(schema.jobAnalyses.jobId, id))
      .limit(1);

    return NextResponse.json({ isDemo: false, job: { ...job, analysis: analysis || null } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture offre' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = patchJobSchema.parse(body);
    const db = await getDb();

    const [updated] = await db
      .update(schema.jobs)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(schema.jobs.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true, job: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues[0]?.message : 'Erreur mise à jour offre' },
      { status: err instanceof z.ZodError ? 400 : 500 }
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
    await db.delete(schema.jobs).where(eq(schema.jobs.id, id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur suppression offre' },
      { status: 500 }
    );
  }
}
