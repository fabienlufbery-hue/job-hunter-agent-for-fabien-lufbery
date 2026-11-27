import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { testApifyConnection } from '@/lib/apify/client';
import { upsertAppSettings } from '@/lib/apify/repository';

export async function POST() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const result = await testApifyConnection();
  try {
    await upsertAppSettings({
      lastApifyVerifiedAt: new Date(),
      lastApifyVerifiedOk: result.connected,
      lastApifyAccount: result.account?.username || null,
    });
  } catch {
    // Non-fatal settings persistence failure
  }

  return NextResponse.json(result, { status: result.connected ? 200 : 400 });
}
