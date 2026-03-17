/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM tasks ORDER BY COALESCE(updated_at, id) DESC') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const [result] = await db.execute(
    'INSERT INTO tasks (title, status, priority, assignee, initials, due_date, ticket_id, resolution, attachments, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [body.title, body.status || 'Backlog', body.priority || 'Medium',
     body.assignee, body.initials || '', body.dueDate || '', body.ticketId || '',
     body.resolution || '', body.attachments || '[]', body.comments || '[]']
  ) as any;
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Created', 'Tasks', `Created task: ${body.title}${body.ticketId ? ` (from ${body.ticketId})` : ''}`, body.userName || 'System']
  );
  return NextResponse.json({ id: result.insertId });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  const [existRows] = await db.execute('SELECT ticket_id FROM tasks WHERE id=?', [body.id]) as any;
  const existingTask = existRows[0] as { ticket_id: string } | undefined;
  const ticketId = body.ticketId || body.ticket_id || existingTask?.ticket_id || '';

  await db.execute(
    'UPDATE tasks SET title=?, status=?, priority=?, assignee=?, initials=?, due_date=?, ticket_id=?, resolution=?, attachments=?, comments=?, updated_at=NOW() WHERE id=?',
    [body.title, body.status, body.priority, body.assignee, body.initials || '', body.dueDate || '',
     ticketId, body.resolution || '', body.attachments || '[]', body.comments || '[]', body.id]
  );

  if (ticketId) {
    const [ticketRows] = await db.execute('SELECT id FROM tickets WHERE id=?', [ticketId]) as any;
    if (ticketRows[0]) {
      await db.execute('UPDATE tickets SET status=? WHERE id=?', [body.status, ticketId]);
      await db.execute('UPDATE daily_logs SET activity=? WHERE source=?',
        [`[Ticket ${ticketId}] ${body.status} — ${body.title}`, `ticket:${ticketId}`]);
      await db.execute(
        'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
        ['Updated', 'Tickets', `Auto-synced ticket ${ticketId} status to "${body.status}" from task change`, 'System']
      );
    }
  }

  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Updated', 'Tasks', `Updated task: ${body.title} → ${body.status}`, body.userName || 'System']
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  const [rows] = await db.execute('SELECT title FROM tasks WHERE id=?', [Number(id)]) as any;
  const task = rows[0] as { title: string } | undefined;
  await db.execute('DELETE FROM tasks WHERE id=?', [Number(id)]);
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Tasks', `Deleted task: ${task?.title || id}`, 'System']
  );
  return NextResponse.json({ success: true });
}
