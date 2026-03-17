export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Statuses are unified: Backlog, In Progress, Review, Done
function taskToTicketStatus(taskStatus: string): string {
  return taskStatus;
}

export async function GET() {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY COALESCE(updated_at, id) DESC').all();
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO tasks (title, status, priority, assignee, initials, due_date, ticket_id, resolution, attachments, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    body.title, body.status || 'Backlog', body.priority || 'Medium',
    body.assignee, body.initials || '', body.dueDate || '', body.ticketId || '',
    body.resolution || '', body.attachments || '[]', body.comments || '[]'
  );
  db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)').run(
    'Created', 'Tasks', `Created task: ${body.title}${body.ticketId ? ` (from ${body.ticketId})` : ''}`, body.userName || 'System'
  );
  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  // Ensure ticket_id is preserved if missing from body
  const existingTask = db.prepare('SELECT ticket_id FROM tasks WHERE id=?').get(body.id) as { ticket_id: string } | undefined;
  const ticketId = body.ticketId || body.ticket_id || existingTask?.ticket_id || '';

  db.prepare(
    "UPDATE tasks SET title=?, status=?, priority=?, assignee=?, initials=?, due_date=?, ticket_id=?, resolution=?, attachments=?, comments=?, updated_at=datetime('now', 'localtime') WHERE id=?"
  ).run(body.title, body.status, body.priority, body.assignee, body.initials || '', body.dueDate || '', ticketId, body.resolution || '', body.attachments || '[]', body.comments || '[]', body.id);

  // Sync: if this task is linked to a ticket, update ticket status too
  if (ticketId) {
    const ticket = db.prepare('SELECT id FROM tickets WHERE id=?').get(ticketId);
    if (ticket) {
      const newTicketStatus = taskToTicketStatus(body.status);
      db.prepare('UPDATE tickets SET status=? WHERE id=?').run(newTicketStatus, ticketId);
      // Also update daily log activity text
      db.prepare("UPDATE daily_logs SET activity=? WHERE source=?")
        .run(`[Ticket ${ticketId}] ${newTicketStatus} — ${body.title}`, `ticket:${ticketId}`);
      db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)')
        .run('Updated', 'Tickets', `Auto-synced ticket ${ticketId} status to "${newTicketStatus}" from task change`, 'System');
    }
  }

  db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)').run(
    'Updated', 'Tasks', `Updated task: ${body.title} → ${body.status}`, body.userName || 'System'
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  const task = db.prepare('SELECT title FROM tasks WHERE id=?').get(Number(id)) as { title: string } | undefined;
  db.prepare('DELETE FROM tasks WHERE id=?').run(Number(id));
  db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)').run(
    'Deleted', 'Tasks', `Deleted task: ${task?.title || id}`, 'System'
  );
  return NextResponse.json({ success: true });
}
