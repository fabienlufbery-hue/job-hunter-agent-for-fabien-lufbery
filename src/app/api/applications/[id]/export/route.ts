import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireSessionOrDemo } from '@/lib/auth';
import { DEMO_APPLICATIONS, DEMO_MASTER_CV } from '@/lib/demo/data';
import {
  generateApplicationDocxBuffer,
  generateApplicationPdfBuffer,
} from '@/lib/export/documents';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'pdf').toLowerCase();

  if (format !== 'pdf' && format !== 'docx') {
    return NextResponse.json({ error: 'Format supporté : pdf ou docx.' }, { status: 400 });
  }

  let docInput: {
    candidateName: string;
    jobTitle: string;
    company: string | null;
    coverLetter: string;
    presentationPage?: string;
    atsKeywords?: string[];
  } | null = null;

  if (auth.isDemo) {
    const demoApp = DEMO_APPLICATIONS.find((a) => a.id === id);
    if (!demoApp) return NextResponse.json({ error: 'Candidature démo introuvable' }, { status: 404 });
    docInput = {
      candidateName: DEMO_MASTER_CV.fullName,
      jobTitle: demoApp.jobTitle,
      company: demoApp.company,
      coverLetter: demoApp.coverLetter,
      presentationPage: demoApp.presentationPage,
      atsKeywords: demoApp.atsKeywords,
    };
  } else {
    const db = await getDb();
    const [app] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, id))
      .limit(1);
    if (!app) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });

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

    docInput = {
      candidateName: cv?.fullName || 'Fabien Lufbery',
      jobTitle: job?.title || 'Poste ciblé',
      company: job?.company || null,
      coverLetter: app.coverLetter,
      presentationPage: app.presentationPage,
      atsKeywords: app.atsKeywords,
    };
  }

  const slug = docInput.jobTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .slice(0, 48);

  if (format === 'docx') {
    const buffer = await generateApplicationDocxBuffer(docInput);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Candidature_${slug}.docx"`,
      },
    });
  }

  const buffer = await generateApplicationPdfBuffer(docInput);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Candidature_${slug}.pdf"`,
    },
  });
}
