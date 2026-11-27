import { NextResponse } from 'next/server';
export async function GET(_request?: Request) { void _request; return NextResponse.json({ error: 'Intégration retirée. Utilisez Apify et Gemini.' }, { status: 410 }); }
