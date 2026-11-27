import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireOwnerSession } from '@/lib/auth';
import { parseCvBuffer } from '@/lib/cv/parser';
import { computeCvContentHash, extractStructuredCv } from '@/lib/cv/extractor';

export async function POST(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Aucun fichier reçu. Sélectionnez un CV au format PDF ou DOCX.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parseCvBuffer(buffer, file.name, file.type);
    const extracted = await extractStructuredCv(parsed.rawText);
    const contentHash = computeCvContentHash(extracted.structured);
    const now = new Date();

    const db = await getDb();
    const [existing] = await db
      .select({ id: schema.masterCv.id })
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    const values = {
      fileName: file.name,
      fileType: parsed.fileType,
      rawText: parsed.rawText,
      fullName: extracted.structured.fullName,
      headline: extracted.structured.headline,
      summary: extracted.structured.summary,
      email: extracted.structured.email,
      phone: extracted.structured.phone,
      location: extracted.structured.location,
      experienceLevel: extracted.structured.experienceLevel,
      education: extracted.structured.education,
      experiences: extracted.structured.experiences,
      technicalSkills: extracted.structured.technicalSkills,
      softSkills: extracted.structured.softSkills,
      languages: extracted.structured.languages,
      certifications: extracted.structured.certifications,
      sectors: extracted.structured.sectors,
      links: extracted.structured.links,
      contentHash,
      uploadedAt: now,
      updatedAt: now,
    };

    if (existing) {
      await db.update(schema.masterCv).set(values).where(eq(schema.masterCv.id, 'primary'));
    } else {
      await db.insert(schema.masterCv).values({ id: 'primary', ...values });
    }

    const [saved] = await db
      .select()
      .from(schema.masterCv)
      .where(eq(schema.masterCv.id, 'primary'))
      .limit(1);

    return NextResponse.json({
      ok: true,
      method: extracted.method,
      modelUsed: extracted.modelUsed || null,
      warning: extracted.warning || null,
      cv: saved,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur import CV' },
      { status: 400 }
    );
  }
}
