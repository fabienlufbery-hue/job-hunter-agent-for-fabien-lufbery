import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';

export const SESSION_COOKIE_NAME = 'jh_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionRole = 'owner' | 'demo';

export interface SessionPayload {
  role: SessionRole;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET (>=16 chars) must be configured in production');
  }
  return 'job-hunter-local-dev-auth-secret-change-in-prod';
}

function signData(data: string): string {
  return crypto.createHmac('sha256', getAuthSecret()).update(data).digest('base64url');
}

export function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  const signature = signData(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  try {
    const expected = signData(encoded);
    if (!safeEqual(signature, expected)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.exp || parsed.exp < now) return null;
    if (parsed.role !== 'owner' && parsed.role !== 'demo') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hashPasswordScrypt(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `scrypt:${usedSalt}:${derived}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hex] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return safeEqual(derived, hex);
}

export function isOwnerAuthConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL?.trim() &&
      (process.env.ADMIN_PASSWORD?.trim() || process.env.ADMIN_PASSWORD_HASH?.trim())
  );
}

export function verifyOwnerCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const plain = process.env.ADMIN_PASSWORD?.trim();

  // In local dev without env vars configured, allow explicit local default ONLY when not on Vercel/production
  if (!expectedEmail || (!hash && !plain)) {
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
      return (
        safeEqual(email.trim().toLowerCase(), 'fabien.lufbery@local.dev') &&
        safeEqual(password, 'local-dev-only')
      );
    }
    return false;
  }

  if (!safeEqual(email.trim().toLowerCase(), expectedEmail)) {
    return false;
  }

  if (hash) {
    return verifyPasswordScrypt(password, hash);
  }
  if (plain) {
    return safeEqual(password, plain);
  }
  return false;
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

/**
 * Guard for routes accessible by authenticated owner OR demo mode (returns session).
 * Returns 401 JSON response if neither authenticated nor in Demo Mode.
 */
export async function requireSessionOrDemo(): Promise<
  { ok: true; session: SessionPayload; isDemo: boolean } | { ok: false; response: NextResponse }
> {
  const session = await getCurrentSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Authentification requise. Connectez-vous ou activez le Mode Démonstration.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    };
  }
  return { ok: true, session, isDemo: session.role === 'demo' };
}

/**
 * Strict guard for private owner-only actions (CV upload/edit, real DB mutations, Gmail send, external API calls).
 */
export async function requireOwnerSession(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: NextResponse }
> {
  const session = await getCurrentSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentification requise.', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }
  if (session.role !== 'owner') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Action désactivée en Mode Démonstration. Connectez-vous au compte personnel de Fabien Lufbery pour modifier les données réelles.',
          code: 'DEMO_READ_ONLY',
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, session };
}

/**
 * Verifies Chrome Extension ingest Bearer token or X-Extension-Token header.
 */
export function verifyExtensionToken(request: Request): { valid: boolean; reason?: string } {
  const configured = process.env.EXTENSION_INGEST_TOKEN?.trim();
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const headerToken = request.headers.get('x-extension-token')?.trim() || bearer;

  if (!configured) {
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
      if (headerToken && safeEqual(headerToken, 'dev-extension-token')) {
        return { valid: true };
      }
      return {
        valid: false,
        reason:
          'EXTENSION_INGEST_TOKEN non défini. Utilisez dev-extension-token en local ou configurez EXTENSION_INGEST_TOKEN.',
      };
    }
    return { valid: false, reason: 'EXTENSION_INGEST_TOKEN non configuré côté serveur.' };
  }

  if (!headerToken) {
    return { valid: false, reason: 'En-tête X-Extension-Token ou Authorization Bearer manquant.' };
  }

  if (!safeEqual(headerToken, configured)) {
    return { valid: false, reason: 'Token d’extension invalide.' };
  }

  return { valid: true };
}

/**
 * Verifies CRON_SECRET for scheduled automation triggers.
 */
export function verifyCronSecret(request: Request): { valid: boolean; reason?: string } {
  const configured = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const headerSecret = request.headers.get('x-cron-secret')?.trim() || bearer;

  if (!configured) {
    return { valid: false, reason: 'CRON_SECRET non configuré côté serveur.' };
  }
  if (!headerSecret || !safeEqual(headerSecret, configured)) {
    return { valid: false, reason: 'CRON_SECRET invalide ou manquant.' };
  }
  return { valid: true };
}
