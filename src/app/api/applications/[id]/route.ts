import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
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
  status: z.enum(['draft', 'ready', 'gmail_draft', 'sent', 'interview', 'rejected']).optional(),
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

    const [updated] = await db
      .update(schema.applications)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(schema.applications.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true, application: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues[0]?.message : 'Erreur mise à jour candidature' },
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
