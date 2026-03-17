/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM schedules ORDER BY id') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const [result] = await db.execute(
    'INSERT INTO schedules (title, type, recurrence, day, date, end_date, day_of_month, month_of_year, start_time, end_time, assignee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [body.title, body.type || 'Meeting', body.recurrence || 'weekly', body.day || 0, body.date || '', body.endDate || '', body.dayOfMonth || 0, body.monthOfYear || 0, body.startTime, body.endTime, body.assignee]
  ) as any;
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Created', 'Schedule', `Created schedule: ${body.title}`, body.userName || 'System']
  );
  return NextResponse.json({ id: result.insertId });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  await db.execute(
    'UPDATE schedules SET title=?, type=?, recurrence=?, day=?, date=?, end_date=?, day_of_month=?, month_of_year=?, start_time=?, end_time=?, assignee=? WHERE id=?',
    [body.title, body.type, body.recurrence, body.day || 0, body.date || '', body.endDate || '', body.dayOfMonth || 0, body.monthOfYear || 0, body.startTime, body.endTime, body.assignee, body.id]
  );
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Updated', 'Schedule', `Updated schedule: ${body.title}`, body.userName || 'System']
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  const [rows] = await db.execute('SELECT title FROM schedules WHERE id=?', [Number(id)]) as any;
  const sch = rows[0] as { title: string } | undefined;
  await db.execute('DELETE FROM schedules WHERE id=?', [Number(id)]);
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Schedule', `Deleted schedule: ${sch?.title || id}`, 'System']
  );
  return NextResponse.json({ success: true });
}
