import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { requireOwnerSession, requireSessionOrDemo } from '@/lib/auth';
import { DEMO_PREFERENCES } from '@/lib/demo/data';

const preferencesSchema = z.object({
  targetRoles: z.array(z.string().trim().min(1)).default([]),
  sectors: z.array(z.string().trim().min(1)).default([]),
  cities: z.array(z.string().trim().min(1)).default([]),
  departmentCodes: z.array(z.string().trim().min(1)).default([]),
  communeCodes: z.array(z.string().trim().min(1)).default([]),
  contractTypes: z.array(z.string().trim().min(1)).default([]),
  duration: z.string().trim().default(''),
  remotePolicy: z.enum(['any', 'remote', 'hybrid', 'onsite']).default('any'),
  keywords: z.array(z.string().trim().min(1)).default([]),
  minFitScore: z.number().int().min(1).max(10).default(6),
});

export async function GET() {
  const auth = await requireSessionOrDemo();
  if (!auth.ok) return auth.response;

  if (auth.isDemo) {
    return NextResponse.json({ isDemo: true, preferences: DEMO_PREFERENCES });
  }

  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(schema.searchPreferences)
      .where(eq(schema.searchPreferences.id, 'primary'))
      .limit(1);

    return NextResponse.json({
      isDemo: false,
      preferences: row || {
        id: 'primary',
        targetRoles: [],
        sectors: [],
        cities: [],
        departmentCodes: [],
        communeCodes: [],
        contractTypes: ['CDI'],
        duration: '',
        remotePolicy: 'any',
        keywords: [],
        minFitScore: 6,
        updatedAt: null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lecture préférences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = preferencesSchema.parse(body);
    const now = new Date();
    const db = await getDb();

    const [existing] = await db
      .select({ id: schema.searchPreferences.id })
      .from(schema.searchPreferences)
      .where(eq(schema.searchPreferences.id, 'primary'))
      .limit(1);

    if (existing) {
      await db
        .update(schema.searchPreferences)
        .set({ ...parsed, updatedAt: now })
        .where(eq(schema.searchPreferences.id, 'primary'));
    } else {
      await db.insert(schema.searchPreferences).values({
        id: 'primary',
        ...parsed,
        updatedAt: now,
      });
    }

    const [saved] = await db
      .select()
      .from(schema.searchPreferences)
      .where(eq(schema.searchPreferences.id, 'primary'))
      .limit(1);

    return NextResponse.json({ ok: true, preferences: saved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues[0]?.message : 'Erreur sauvegarde préférences' },
      { status: err instanceof z.ZodError ? 400 : 500 }
    );
  }
}
