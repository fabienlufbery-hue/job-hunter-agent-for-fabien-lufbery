import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { safeEqual } from '@/lib/crypto';
import { exchangeGmailCodeAndStore, getGmailRedirectUri } from '@/lib/gmail/client';

export async function GET(request: Request) {
  const session = await getCurrentSession();
  const baseUrl = new URL(getGmailRedirectUri()).origin;

  if (!session || session.role !== 'owner') {
    return NextResponse.redirect(`${baseUrl}/login?error=gmail_auth_required`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?gmail=error&reason=authorization_refused`
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('gmail_oauth_state')?.value;

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(`${baseUrl}/integrations?gmail=error&reason=invalid_oauth_state`);
  }

  try {
    await exchangeGmailCodeAndStore(code);
    const response = NextResponse.redirect(`${baseUrl}/integrations?gmail=connected`);
    response.cookies.set('gmail_oauth_state', '', { maxAge: 0, path: '/' });
    return response;
  } catch {
    const response = NextResponse.redirect(`${baseUrl}/integrations?gmail=error&reason=oauth_exchange_failed`);
    response.cookies.set('gmail_oauth_state', '', { maxAge: 0, path: '/' });
    return response;
  }
}
