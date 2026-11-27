import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { buildGmailAuthUrl, isGmailOAuthConfigured } from '@/lib/gmail/client';

export async function GET() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          'Google OAuth2 non configuré (GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requis côté serveur).',
      },
      { status: 400 }
    );
  }

  const state = crypto.randomBytes(24).toString('hex');
  const authUrl = buildGmailAuthUrl(state);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
