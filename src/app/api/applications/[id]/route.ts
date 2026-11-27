import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema, type ApplicationStatus } from '@/db';
import { requireOwnerSession, requireSessionOrDemo } from '@/lib/auth';
import { DEMO_APPLICATIONS } from '@/lib/demo/data';

const patchApplicationSchema = z.object({
  coverLetter: z.string().min(1).optional(),
  presentationPage: z.string().optional(),
  emailSubject: z.string().min(1).optional(),
  emailBody: z.string().min(1).optional(),
  recipientEmail: z
    .string()
    .trim()
    .email('Adresse email destinataire invalide')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  notes: z.string().max(4000).nullable().optional(),
  status: z.enum(['draft', 'ready', 'applied', 'sent', 'interview', 'offer', 'rejected']).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  if (auth.isDemo) {
    const app = DEMO_APPLICATIONS.find((a) => a.id === id);
    if (!app) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    return NextResponse.json({ isDemo: true, application: app });
  }

  try {
    const db = await getDb();
    const [app] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, id))
      .limit(1);
    if (!app) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    return NextResponse.json({ isDemo: false, application: app });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture candidature' },
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
    const parsed = patchApplicationSchema.parse(body);
    const db = await getDb();
    const now = new Date();

    const [existing] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }

    const markSentNow =
      (parsed.status === 'applied' || parsed.status === 'sent') && !existing.sentAt;

    const [updated] = await db
      .update(schema.applications)
      .set({
        ...parsed,
        ...(markSentNow ? { sentAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(schema.applications.id, id))
      .returning();

    // Keep linked job status synchronized when user updates manual tracking
    if (parsed.status) {
      const jobStatusMap: Record<string, ApplicationStatus> = {
        draft: 'reviewing',
        ready: 'tailored',
        applied: 'applied',
        sent: 'applied',
        interview: 'interview',
        offer: 'offer',
        rejected: 'rejected',
      };
      const mapped = jobStatusMap[parsed.status];
      if (mapped) {
        await db
          .update(schema.jobs)
          .set({ applicationStatus: mapped, updatedAt: now })
          .where(eq(schema.jobs.id, existing.jobId));
      }
    }

    return NextResponse.json({ ok: true, application: updated });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError ? err.issues[0]?.message : 'Erreur mise à jour candidature',
      },
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
    await db.delete(schema.applications).where(eq(schema.applications.id, id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur suppression candidature' },
      { status: 500 }
    );
  }
}
