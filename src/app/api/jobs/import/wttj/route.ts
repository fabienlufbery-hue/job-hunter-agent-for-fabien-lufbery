import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnerSession } from '@/lib/auth';
import { upsertNormalizedJobs } from '@/lib/jobs/repository';

const inputSchema = z.object({
  originalUrl: z.string().trim().max(4096).refine((value) => {
    try {
      const url = new URL(value);
      return url.origin === 'https://www.welcometothejungle.com' &&
        !url.username && !url.password &&
        /^\/[a-z]{2}(?:-[a-z]{2})?\/companies\/[^/]+\/jobs\/[^/]+\/?$/i.test(url.pathname);
    } catch { return false; }
  }, 'Utilisez le lien HTTPS d’une fiche de poste Welcome to the Jungle.'),
  title: z.string().trim().min(2).max(300),
  company: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  contractType: z.string().trim().max(100).optional(),
  description: z.string().trim().max(4000).optional(),
}).strict();

export async function POST(request: Request) {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origine non autorisée.' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON requis.' }, { status: 415 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Informations invalides.' }, { status: 400 });
  }
  const { originalUrl, description, ...fields } = parsed.data;
  const url = new URL(originalUrl);
  url.search = '';
  url.hash = '';
  try {
    const result = await upsertNormalizedJobs([{
      ...fields, originalUrl: url.href,
      description: description || '',
      source: 'welcome_to_the_jungle',
    }]);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: 'Impossible d’enregistrer la référence. Vérifiez la base de données.' }, { status: 500 });
  }
}
