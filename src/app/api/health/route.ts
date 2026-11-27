import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/db';

export async function GET() {
  const db = await checkDatabaseHealth();
  return NextResponse.json({
    ok: true,
    app: 'Job Hunter Agent for Fabien Lufbery',
    timestamp: new Date().toISOString(),
    database: {
      connected: db.connected,
      mode: db.mode,
      persistent: db.persistent,
    },
  });
}
