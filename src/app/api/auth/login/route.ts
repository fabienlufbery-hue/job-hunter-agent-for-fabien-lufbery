import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  attachSessionCookie,
  createSessionToken,
  verifyOwnerCredentials,
} from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/security';

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`login:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives de connexion. Réessayez dans une minute.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    if (!verifyOwnerCredentials(email, password)) {
      return NextResponse.json(
        { error: 'Identifiants invalides.' },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      role: 'owner',
      email: email.trim().toLowerCase(),
      name: 'Fabien Lufbery',
    });

    const response = NextResponse.json({
      ok: true,
      session: { role: 'owner', email: email.trim().toLowerCase(), name: 'Fabien Lufbery' },
    });
    return attachSessionCookie(response, token);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues[0]?.message : 'Requête invalide.' },
      { status: 400 }
    );
  }
}
