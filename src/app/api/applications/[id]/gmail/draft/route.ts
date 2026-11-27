import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { requireOwnerSession } from '@/lib/auth';
import { createGmailDraftForApplication } from '@/lib/gmail/client';
import { generateApplicationPdfBuffer } from '@/lib/export/documents';

const draftSchema = z.object({
  to: z.string().trim().min(3),
  subject: z.string().trim().min(2),
  body: z.string().trim().min(5),
  attachCoverLetterPdf: z.boolean().optional().default(true),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const raw = await request.json();
    const parsed = draftSchema.parse(raw);

    const db = await getDb();
    const [app] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, id))
      .limit(1);
    if (!app) return NextResponse.json({ error: 'Candidature introuvable.' }, { status: 404 });

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, app.jobId))
      .limit(1);
    const [cv] = await db
      .select()
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    const attachments = [];
    if (parsed.attachCoverLetterPdf) {
      const pdfBuf = await generateApplicationPdfBuffer({
        candidateName: cv?.fullName || 'Fabien Lufbery',
        jobTitle: job?.title || 'Candidature',
        company: job?.company || null,
        coverLetter: app.coverLetter,
        presentationPage: app.presentationPage,
        atsKeywords: app.atsKeywords,
      });
      attachments.push({
        filename: 'Lettre_de_Motivation_Fabien_Lufbery.pdf',
        content: pdfBuf,
        contentType: 'application/pdf',
      });
    }

    const result = await createGmailDraftForApplication({
      applicationId: app.id,
      jobId: app.jobId,
      to: parsed.to,
      subject: parsed.subject,
      body: parsed.body,
      attachments,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur création brouillon Gmail' },
      { status: 400 }
    );
  }
}
