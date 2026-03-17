export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Statuses are now unified: Backlog, In Progress, Review, Done
// Direct pass-through since ticket and task share the same labels
function ticketToTaskStatus(ticketStatus: string): string {
  return ticketStatus;
}


export async function GET() {
  const db = getDb();
  const tickets = db.prepare('SELECT * FROM tickets ORDER BY COALESCE(updated_at, created_date, id) DESC').all();
  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM tickets').get() as { c: number };
    const id = body.id || `TKT-${String(count.c + 100).padStart(3, '0')}`;
    db.prepare('INSERT INTO tickets (id, title, reporter, priority, status, created_date, resolution, attachments, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, body.title, body.reporter, body.priority || 'Medium', body.status || 'Backlog', body.createdDate || new Date().toISOString(),
      body.resolution || '', body.attachments || '[]', body.comments || '[]'
    );

    // Auto-create a linked Task for this ticket
    const taskTitle = `[${id}] ${body.title}`;
    const taskStatus = body.status || 'Backlog';
    const taskPriority = body.priority === 'Critical' ? 'High' : (body.priority || 'Medium');
    const assignee = 'Unassigned';
    const initials = 'UN';
    db.prepare('INSERT INTO tasks (title, status, priority, assignee, initials, due_date, ticket_id, resolution, attachments, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      taskTitle, taskStatus, taskPriority, assignee, initials, '', id, body.resolution || '', body.attachments || '[]', body.comments || '[]'
    );

    // Auto-create daily log entry linked to this ticket
    db.prepare('INSERT INTO daily_logs (date, member, activity, hours, location, source) VALUES (?, ?, ?, ?, ?, ?)').run(
      new Date().toISOString().split('T')[0], body.userName || 'System',
      `[Ticket ${id}] Created — ${body.title}`, 0, 'System', `ticket:${id}`
    );
    db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)')
      .run('Created', 'Tickets', `Created ticket: ${id} — ${body.title} (auto-created task + daily log)`, body.userName || 'System');
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  db.prepare("UPDATE tickets SET title=?, reporter=?, priority=?, status=?, resolution=?, attachments=?, comments=?, updated_at=datetime('now', 'localtime') WHERE id=?")
    .run(body.title, body.reporter, body.priority, body.status, body.resolution || '', body.attachments || '[]', body.comments || '[]', body.id);

  // Sync: update any linked task's status automatically
  const linkedTask = db.prepare("SELECT id FROM tasks WHERE ticket_id = ?").get(body.id) as { id: number } | undefined;
  if (linkedTask) {
    const newTaskStatus = ticketToTaskStatus(body.status);
    db.prepare('UPDATE tasks SET status=? WHERE id=?').run(newTaskStatus, linkedTask.id);
    db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)')
      .run('Updated', 'Tasks', `Auto-synced task status to "${newTaskStatus}" from ticket ${body.id}`, 'System');
  }

  // Update related daily log entries
  db.prepare("UPDATE daily_logs SET activity = ? WHERE source = ?")
    .run(`[Ticket ${body.id}] ${body.status} — ${body.title}`, `ticket:${body.id}`);

  db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)')
    .run('Updated', 'Tickets', `Updated ticket: ${body.id} — ${body.title} (${body.status})`, body.userName || 'System');

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  const ticket = db.prepare('SELECT title FROM tickets WHERE id=?').get(id) as { title: string } | undefined;
  db.prepare('DELETE FROM tickets WHERE id=?').run(id);
  // Delete related daily logs
  db.prepare("DELETE FROM daily_logs WHERE source = ?").run(`ticket:${id}`);
  // Unlink tasks that were linked to this ticket (don't delete tasks, just unlink)
  db.prepare("UPDATE tasks SET ticket_id='' WHERE ticket_id=?").run(id);
  db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)')
    .run('Deleted', 'Tickets', `Deleted ticket: ${id} — ${ticket?.title || ''}`, 'System');
  return NextResponse.json({ success: true });
}
