import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/auth';
import { testGeminiConnection } from '@/lib/gemini/client';
import { upsertAppSettings } from '@/lib/apify/repository';

export async function POST() {
  const auth = await requireOwnerSession();
  if (!auth.ok) return auth.response;

  const result = await testGeminiConnection();
  try {
    await upsertAppSettings({
      lastGeminiVerifiedAt: new Date(),
      lastGeminiVerifiedOk: result.connected,
      lastGeminiModel: result.model,
    });
  } catch {
    // Non-fatal settings persistence failure
  }

  return NextResponse.json(result, { status: result.connected ? 200 : 400 });
}
