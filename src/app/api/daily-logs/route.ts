/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM daily_logs ORDER BY date DESC, created_at DESC') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const [result] = await db.execute(
    'INSERT INTO daily_logs (date, member, activity, hours, location, source) VALUES (?, ?, ?, ?, ?, ?)',
    [body.date, body.member, body.activity, body.hours || 0, body.location || 'Office', body.source || 'manual']
  ) as any;
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Created', 'Daily Log', `Added log by ${body.member}`, body.userName || 'System']
  );
  return NextResponse.json({ id: result.insertId });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  await db.execute(
    'UPDATE daily_logs SET date=?, member=?, activity=?, hours=?, location=? WHERE id=?',
    [body.date, body.member, body.activity, body.hours, body.location, body.id]
  );
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Updated', 'Daily Log', `Updated log by ${body.member}`, body.userName || 'System']
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  await db.execute('DELETE FROM daily_logs WHERE id=?', [Number(id)]);
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Daily Log', `Deleted daily log #${id}`, 'System']
  );
  return NextResponse.json({ success: true });
}
