import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { requireOwnerSession, requireSessionOrDemo } from '@/lib/auth';
import { DEMO_APPLICATIONS } from '@/lib/demo/data';
import { generateTailoredApplicationWithGemini } from '@/lib/gemini/tailoring';

const createAppSchema = z.object({
  jobId: z.string().min(1),
  customInstructions: z.string().max(1000).optional(),
});

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  if (auth.isDemo) {
    return NextResponse.json({
      isDemo: true,
      applications: DEMO_APPLICATIONS,
    });
  }

  try {
    const db = await getDb();
    const [apps, allJobs, allAnalyses] = await Promise.all([
      db.select().from(schema.applications).orderBy(desc(schema.applications.updatedAt)),
      db.select().from(schema.jobs),
      db.select().from(schema.jobAnalyses),
    ]);

    const jobMap = new Map(allJobs.map((j) => [j.id, j]));
    const analysisMap = new Map(allAnalyses.map((a) => [a.jobId, a]));

    const enriched = apps.map((app) => {
      const job = jobMap.get(app.jobId);
      const analysis = analysisMap.get(app.jobId);
      return {
        ...app,
        sentAt: app.sentAt ? app.sentAt.toISOString() : null,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
        jobTitle: job?.title || 'Offre archivée',
        company: job?.company || null,
        source: job?.source || 'other',
        originalUrl: job?.originalUrl || '',
        jobDescription: job?.description || '',
        fitScore: analysis?.fitScore ?? null,
      };
    });

    return NextResponse.json({
      isDemo: false,
      applications: enriched,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture candidatures' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { jobId, customInstructions } = createAppSchema.parse(body);

    const db = await getDb();
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
    if (!job) {
      return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 });
    }

    const [cv] = await db
      .select()
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);
    if (!cv) {
      return NextResponse.json(
        { error: 'Importez votre Master CV avant de générer une candidature personnalisée.' },
        { status: 400 }
      );
    }

    const [prefsRow] = await db
      .select()
      .from(schema.searchPreferences)
      .where(eq(schema.searchPreferences.id, 'primary'))
      .limit(1);

    const { output, modelUsed } = await generateTailoredApplicationWithGemini({
      cv: {
        fullName: cv.fullName,
        headline: cv.headline,
        summary: cv.summary,
        location: cv.location,
        experienceLevel: cv.experienceLevel,
        education: cv.education,
        experiences: cv.experiences,
        technicalSkills: cv.technicalSkills,
        softSkills: cv.softSkills,
        languages: cv.languages,
        certifications: cv.certifications,
        sectors: cv.sectors,
      },
      preferences: prefsRow
        ? {
            targetRoles: prefsRow.targetRoles,
            sectors: prefsRow.sectors,
            cities: prefsRow.cities,
            contractTypes: prefsRow.contractTypes,
            duration: prefsRow.duration,
            remotePolicy: prefsRow.remotePolicy,
            keywords: prefsRow.keywords,
          }
        : null,
      job: {
        title: job.title,
        company: job.company,
        location: job.location,
        contractType: job.contractType,
        salary: job.salary,
        description: job.description,
        skills: job.skills,
        source: job.source,
      },
      customInstructions,
    });

    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(schema.applications).values({
      id,
      jobId: job.id,
      status: 'ready',
      coverLetter: output.cover_letter,
      presentationPage: output.presentation_page,
      cvSuggestions: output.cv_suggestions,
      bulletRewrites: output.bullet_rewrites,
      atsKeywords: output.ats_keywords,
      emailSubject: output.email_subject,
      emailBody: output.email_body,
      recipientEmail: job.recruiterEmail || null,
      notes: null,
      modelUsed,
      createdAt: now,
      updatedAt: now,
    });

    await db
      .update(schema.jobs)
      .set({ applicationStatus: 'tailored', updatedAt: now })
      .where(eq(schema.jobs.id, job.id));

    return NextResponse.json({
      ok: true,
      application: {
        id,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        source: job.source,
        originalUrl: job.originalUrl,
        jobDescription: job.description,
        status: 'ready',
        coverLetter: output.cover_letter,
        presentationPage: output.presentation_page,
        cvSuggestions: output.cv_suggestions,
        bulletRewrites: output.bullet_rewrites,
        atsKeywords: output.ats_keywords,
        emailSubject: output.email_subject,
        emailBody: output.email_body,
        recipientEmail: job.recruiterEmail || null,
        notes: null,
        modelUsed,
        sentAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur génération candidature' },
      { status: 400 }
    );
  }
}
