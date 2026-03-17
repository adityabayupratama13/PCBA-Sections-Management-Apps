/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500') as any;
  return NextResponse.json(rows);
}
