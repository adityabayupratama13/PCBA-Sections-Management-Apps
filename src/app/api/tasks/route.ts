/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  try {
    const [rows] = await db.query('SELECT *, DATE_FORMAT(actual_completion_date, \'%Y-%m-%d\') as actual_completion_date FROM tasks ORDER BY COALESCE(updated_at, id) DESC') as any;
    return NextResponse.json(rows);
  } catch (e: any) {
    // Fallback if actual_completion_date column doesn't exist yet (pre-migration)
    if (e.errno === 1054) {
      const [rows] = await db.query('SELECT *, NULL as actual_completion_date FROM tasks ORDER BY COALESCE(updated_at, id) DESC') as any;
      return NextResponse.json(rows);
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  // Auto-set actual_completion_date to today if status is Done and no date provided
  const actualCompletionDate = body.actualCompletionDate || (body.status === 'Done' ? new Date().toISOString().split('T')[0] : null);
  let insertId;
  try {
    const [result] = await db.execute(
      'INSERT INTO tasks (title, status, priority, assignee, initials, due_date, actual_completion_date, ticket_id, resolution, attachments, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [body.title, body.status || 'Backlog', body.priority || 'Medium',
       body.assignee, body.initials || '', body.dueDate || '', actualCompletionDate,
       body.ticketId || '', body.resolution || '', body.attachments || '[]', body.comments || '[]']
    ) as any;
    insertId = result.insertId;
  } catch (e: any) {
    if (e.errno === 1054) {
      // Fallback: column doesn't exist yet (pre-migration)
      const [result] = await db.execute(
        'INSERT INTO tasks (title, status, priority, assignee, initials, due_date, ticket_id, resolution, attachments, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [body.title, body.status || 'Backlog', body.priority || 'Medium',
         body.assignee, body.initials || '', body.dueDate || '', body.ticketId || '',
         body.resolution || '', body.attachments || '[]', body.comments || '[]']
      ) as any;
      insertId = result.insertId;
    } else { throw e; }
  }
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Created', 'Tasks', `Created task: ${body.title}${body.ticketId ? ` (from ${body.ticketId})` : ''}`, body.userName || 'System']
  );
  return NextResponse.json({ id: insertId });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  const [existRows] = await db.execute('SELECT ticket_id, status as old_status FROM tasks WHERE id=?', [body.id]) as any;
  const existingTask = existRows[0] as { ticket_id: string; old_status: string } | undefined;
  const ticketId = body.ticketId || body.ticket_id || existingTask?.ticket_id || '';

  // Auto-set actual_completion_date: use provided value, or auto-fill today if newly set to Done
  let actualCompletionDate = body.actualCompletionDate !== undefined ? (body.actualCompletionDate || null) : null;
  if (body.status === 'Done' && existingTask?.old_status !== 'Done' && !actualCompletionDate) {
    actualCompletionDate = new Date().toISOString().split('T')[0];
  }

  try {
    // If actualCompletionDate is not explicitly provided and status isn't changing to Done, preserve existing value
    if (body.actualCompletionDate === undefined && !(body.status === 'Done' && existingTask?.old_status !== 'Done')) {
      // Read existing value if column exists
      try {
        const [acdRows] = await db.execute('SELECT actual_completion_date FROM tasks WHERE id=?', [body.id]) as any;
        actualCompletionDate = acdRows[0]?.actual_completion_date || null;
      } catch { /* column doesn't exist yet */ }
    }
    await db.execute(
      'UPDATE tasks SET title=?, status=?, priority=?, assignee=?, initials=?, due_date=?, actual_completion_date=?, ticket_id=?, resolution=?, attachments=?, comments=?, updated_at=NOW() WHERE id=?',
      [body.title, body.status, body.priority, body.assignee, body.initials || '', body.dueDate || '',
       actualCompletionDate, ticketId, body.resolution || '', body.attachments || '[]', body.comments || '[]', body.id]
    );
  } catch (e: any) {
    if (e.errno === 1054) {
      // Fallback: column doesn't exist yet (pre-migration)
      await db.execute(
        'UPDATE tasks SET title=?, status=?, priority=?, assignee=?, initials=?, due_date=?, ticket_id=?, resolution=?, attachments=?, comments=?, updated_at=NOW() WHERE id=?',
        [body.title, body.status, body.priority, body.assignee, body.initials || '', body.dueDate || '',
         ticketId, body.resolution || '', body.attachments || '[]', body.comments || '[]', body.id]
      );
    } else { throw e; }
  }

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
