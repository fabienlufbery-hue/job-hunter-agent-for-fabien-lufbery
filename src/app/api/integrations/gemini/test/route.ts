import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { testGeminiConnection } from '@/lib/gemini/client';

export async function POST() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const result = await testGeminiConnection();
  return NextResponse.json(result, { status: result.connected ? 200 : 400 });
}
