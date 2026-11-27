import { NextResponse } from 'next/server';
import { attachSessionCookie, createSessionToken } from '@/lib/auth';

export async function POST() {
  const token = createSessionToken({
    role: 'demo',
    email: 'demo.evaluator@example.invalid',
    name: 'Mode Démonstration (Public)',
  });

  const response = NextResponse.json({
    ok: true,
    session: {
      role: 'demo',
      email: 'demo.evaluator@example.invalid',
      name: 'Mode Démonstration (Public)',
    },
  });
  return attachSessionCookie(response, token);
}
