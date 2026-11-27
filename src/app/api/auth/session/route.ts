import { NextResponse } from 'next/server';
import { getCurrentSession, isOwnerAuthConfigured } from '@/lib/auth';

export async function GET() {
  const session = await getCurrentSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    session,
    ownerAuthConfigured: isOwnerAuthConfigured(),
    isLocalDev: process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1',
  });
}
