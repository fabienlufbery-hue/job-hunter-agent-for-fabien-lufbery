import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireOwnerSession, requireSessionOrDemo } from '@/lib/auth';
import { DEMO_MASTER_CV } from '@/lib/demo/data';
import { computeCvContentHash, structuredCvSchema } from '@/lib/cv/extractor';
import { z } from 'zod';

const updateCvBodySchema = structuredCvSchema.extend({
  rawText: z.string().optional(),
  fileName: z.string().nullable().optional(),
  fileType: z.string().nullable().optional(),
});

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  if (auth.isDemo) {
    return NextResponse.json({ isDemo: true, cv: DEMO_MASTER_CV });
  }

  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    return NextResponse.json({
      isDemo: false,
      cv: row
        ? {
            ...row,
            uploadedAt: row.uploadedAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture Master CV' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = updateCvBodySchema.parse(body);
    const contentHash = computeCvContentHash(parsed);
    const now = new Date();

    const db = await getDb();
    const [existing] = await db
      .select()
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    if (existing) {
      await db
        .update(schema.masterCv)
        .set({
          fullName: parsed.fullName,
          headline: parsed.headline,
          summary: parsed.summary,
          email: parsed.email,
          phone: parsed.phone,
          location: parsed.location,
          experienceLevel: parsed.experienceLevel,
          education: parsed.education,
          experiences: parsed.experiences,
          technicalSkills: parsed.technicalSkills,
          softSkills: parsed.softSkills,
          languages: parsed.languages,
          certifications: parsed.certifications,
          sectors: parsed.sectors,
          links: parsed.links,
          rawText: parsed.rawText ?? existing.rawText,
          fileName: parsed.fileName !== undefined ? parsed.fileName : existing.fileName,
          fileType: parsed.fileType !== undefined ? parsed.fileType : existing.fileType,
          contentHash,
          updatedAt: now,
        })
        .where(eq(schema.masterCv.id, 'primary'));
    } else {
      await db.insert(schema.masterCv).values({
        id: 'primary',
        fileName: parsed.fileName ?? 'Master_CV_Manuel',
        fileType: parsed.fileType ?? 'manual',
        rawText: parsed.rawText ?? '',
        fullName: parsed.fullName,
        headline: parsed.headline,
        summary: parsed.summary,
        email: parsed.email,
        phone: parsed.phone,
        location: parsed.location,
        experienceLevel: parsed.experienceLevel,
        education: parsed.education,
        experiences: parsed.experiences,
        technicalSkills: parsed.technicalSkills,
        softSkills: parsed.softSkills,
        languages: parsed.languages,
        certifications: parsed.certifications,
        sectors: parsed.sectors,
        links: parsed.links,
        contentHash,
        uploadedAt: now,
        updatedAt: now,
      });
    }

    const [updated] = await db
      .select()
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    return NextResponse.json({ ok: true, cv: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Erreur sauvegarde CV' },
      { status: err instanceof z.ZodError ? 400 : 500 }
    );
  }
}

export async function DELETE() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const db = await getDb();
    await db.delete(schema.masterCv).where(eq(schema.masterCv.id, 'primary'));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur suppression Master CV' },
      { status: 500 }
    );
  }
}
