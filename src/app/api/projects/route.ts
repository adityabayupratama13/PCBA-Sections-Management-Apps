/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM projects ORDER BY id') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  // Create a schedule link automatically
  const [schResult] = await db.execute(
    'INSERT INTO schedules (title, type, recurrence, day, date, end_date, day_of_month, month_of_year, start_time, end_time, assignee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [body.name, 'Project', 'one-time', 0, body.startDate, body.endDate, 0, 0, '08:00', '17:00', body.pic || 'Unassigned']
  ) as any;
  const newScheduleId = schResult.insertId;
  const schedulesArr = body.linkedSchedules || [];
  if (!schedulesArr.includes(newScheduleId)) schedulesArr.push(newScheduleId);

  const [result] = await db.execute(
    'INSERT INTO projects (name, pic, start_date, end_date, progress, status, linked_tasks, linked_schedules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [body.name, body.pic, body.startDate, body.endDate, body.progress || 0, body.status || 'Planning',
     JSON.stringify(body.linkedTasks || []), JSON.stringify(schedulesArr)]
  ) as any;
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Created', 'Projects', `Created project: ${body.name}`, body.userName || 'System']
  );
  return NextResponse.json({ id: result.insertId });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  const [projRows] = await db.execute('SELECT linked_schedules FROM projects WHERE id=?', [body.id]) as any;
  const currentProj = projRows[0] as { linked_schedules: string } | undefined;
  const currentSchedules: number[] = JSON.parse(currentProj?.linked_schedules || '[]');
  const schedulesArr = body.linkedSchedules || [];

  const placeholders = currentSchedules.length ? currentSchedules.join(',') : '0';
  const [schRows] = await db.query(
    `SELECT id FROM schedules WHERE type='Project' AND title=? AND id IN (${placeholders}) LIMIT 1`,
    [body.name]
  ) as any;
  const matchingSch = schRows[0] as { id: number } | undefined;

  if (matchingSch) {
    await db.execute('UPDATE schedules SET date=?, end_date=?, assignee=? WHERE id=?',
      [body.startDate, body.endDate, body.pic || 'Unassigned', matchingSch.id]);
  } else {
    const [newSch] = await db.execute(
      'INSERT INTO schedules (title, type, recurrence, day, date, end_date, day_of_month, month_of_year, start_time, end_time, assignee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [body.name, 'Project', 'one-time', 0, body.startDate, body.endDate, 0, 0, '08:00', '17:00', body.pic || 'Unassigned']
    ) as any;
    if (!schedulesArr.includes(newSch.insertId)) schedulesArr.push(newSch.insertId);
  }

  await db.execute(
    'UPDATE projects SET name=?, pic=?, start_date=?, end_date=?, progress=?, status=?, linked_tasks=?, linked_schedules=? WHERE id=?',
    [body.name, body.pic, body.startDate, body.endDate, body.progress, body.status,
     JSON.stringify(body.linkedTasks || []), JSON.stringify(schedulesArr), body.id]
  );
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Updated', 'Projects', `Updated project: ${body.name}`, body.userName || 'System']
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  const [rows] = await db.execute('SELECT name FROM projects WHERE id=?', [Number(id)]) as any;
  const proj = rows[0] as { name: string } | undefined;
  await db.execute('DELETE FROM projects WHERE id=?', [Number(id)]);
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Projects', `Deleted project: ${proj?.name || id}`, 'System']
  );
  return NextResponse.json({ success: true });
}
