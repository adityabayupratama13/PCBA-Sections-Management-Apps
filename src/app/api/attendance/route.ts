/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const employee = searchParams.get('member_name');
  if (employee) {
    const [rows] = await db.query(
      'SELECT * FROM attendance_logs WHERE member_name = ? ORDER BY date DESC, id DESC',
      [employee]
    ) as any;
    return NextResponse.json(rows);
  }
  const [rows] = await db.query('SELECT * FROM attendance_logs ORDER BY date DESC, id DESC') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  const [existRows] = await db.execute(
    'SELECT id FROM attendance_logs WHERE member_name = ? AND date = ?',
    [body.member_name, body.date]
  ) as any;
  const existing = existRows[0] as { id: number } | undefined;

  if (existing) {
    await db.execute(
      'UPDATE attendance_logs SET shift = ?, ot_start_time = ?, ot_end_time = ?, overtime_hours = ?, overtime_desc = ? WHERE id = ?',
      [body.shift, body.ot_start_time || '', body.ot_end_time || '', body.overtime_hours || 0, body.overtime_desc || '', existing.id]
    );
    await db.execute(
      'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
      ['Updated', 'Attendance', `Updated attendance for ${body.member_name} on ${body.date}`, body.userName || 'System']
    );
    return NextResponse.json({ id: existing.id, updated: true });
  } else {
    const [result] = await db.execute(
      'INSERT INTO attendance_logs (member_name, date, shift, ot_start_time, ot_end_time, overtime_hours, overtime_desc) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [body.member_name, body.date, body.shift || 'Off', body.ot_start_time || '', body.ot_end_time || '', body.overtime_hours || 0, body.overtime_desc || '']
    ) as any;
    await db.execute(
      'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
      ['Created', 'Attendance', `Logged attendance for ${body.member_name} on ${body.date}`, body.userName || 'System']
    );
    return NextResponse.json({ id: result.insertId, created: true });
  }
}
