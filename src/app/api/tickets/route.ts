/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, toMysqlDatetime, toMysqlDate } from '@/lib/db';


// Rules Engine
async function processRules(triggerEvent: string, itemData: Record<string, unknown>) {
  try {
    const db = getDb();
    const [rules] = await (db.query as any)(
      'SELECT * FROM rules WHERE is_active = 1 AND trigger_event = ?',
      [triggerEvent]
    );
    for (const rule of rules as Record<string, unknown>[]) {
      const fieldVal = String(itemData[String(rule.condition_field)] || '').toLowerCase();
      const targetVal = String(rule.condition_value).toLowerCase();
      if (fieldVal !== targetVal) continue;

      const ex = (sql: string, params: unknown[]) => (db.execute as any)(sql, params);

      if (rule.action_type === 'assign_to') {
        await ex('UPDATE tasks SET assignee = ? WHERE ticket_id = ?', [rule.action_payload, itemData.id]);
        await ex('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
          ['Automation', 'Rules', `[${rule.name}] Auto-assigned task to ${rule.action_payload}`, 'System']);
      } else if (rule.action_type === 'set_priority') {
        await ex('UPDATE tickets SET priority = ? WHERE id = ?', [rule.action_payload, itemData.id]);
        const taskPriority = rule.action_payload === 'Critical' ? 'High' : rule.action_payload;
        await ex('UPDATE tasks SET priority = ? WHERE ticket_id = ?', [taskPriority, itemData.id]);
        await ex('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
          ['Automation', 'Rules', `[${rule.name}] Auto-set priority to ${rule.action_payload}`, 'System']);
      } else if (rule.action_type === 'add_comment') {
        const [crows] = await ex('SELECT comments FROM tickets WHERE id=?', [itemData.id]);
        const current = (crows as any)[0] as { comments: string } | undefined;
        const comments = JSON.parse(current?.comments || '[]');
        comments.push({ id: Date.now().toString(), author: 'System Bot', text: rule.action_payload, timestamp: new Date().toISOString() });
        await ex('UPDATE tickets SET comments = ? WHERE id = ?', [JSON.stringify(comments), itemData.id]);
        await ex('UPDATE tasks SET comments = ? WHERE ticket_id = ?', [JSON.stringify(comments), itemData.id]);
        await ex('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
          ['Automation', 'Rules', `[${rule.name}] Auto-commented on ticket`, 'System']);
      } else if (rule.action_type === 'generate_alert') {
        await ex('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
          ['CRITICAL ALERT', 'Rules', `🚨 [${rule.name}] ${rule.action_payload} (Ticket: ${itemData.id})`, 'System']);
      }
    }
  } catch (err) {
    console.error('Automation Engine Error:', err);
  }
}

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM tickets ORDER BY COALESCE(updated_at, created_date, id) DESC') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  try {
    const [maxRows] = await db.query("SELECT MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)) AS m FROM tickets") as any;
    const maxNum = (maxRows[0] as { m: number | null }).m ?? 99;
    const id = body.id || `TKT-${String(maxNum + 1).padStart(3, '0')}`;

    await db.execute(
      'INSERT INTO tickets (id, title, reporter, priority, difficulty, status, created_date, resolution, attachments, comments, linked_article) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, body.title, body.reporter, body.priority || 'Medium', body.difficulty || 0, body.status || 'Backlog',
       toMysqlDatetime(body.createdDate), body.resolution || '',
       body.attachments || '[]', body.comments || '[]', body.linked_article || '']
    );

    const taskPriority = body.priority === 'Critical' ? 'High' : (body.priority || 'Medium');
    await db.execute(
      'INSERT INTO tasks (title, status, priority, assignee, initials, due_date, ticket_id, resolution, attachments, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [`[${id}] ${body.title}`, body.status || 'Backlog', taskPriority, 'Unassigned', 'UN', '', id, body.resolution || '', body.attachments || '[]', body.comments || '[]']
    );
    await db.execute(
      'INSERT INTO daily_logs (date, member, activity, hours, location, source) VALUES (?, ?, ?, ?, ?, ?)',
      [toMysqlDate(), body.userName || 'System',
       `[Ticket ${id}] Created — ${body.title}`, 0, 'System', `ticket:${id}`]
    );
    await db.execute(
      'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
      ['Created', 'Tickets', `Created ticket: ${id} — ${body.title}`, body.userName || 'System']
    );
    await processRules('ticket_created', { id, ...body });
    return NextResponse.json({ id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  await db.execute(
    'UPDATE tickets SET title=?, reporter=?, priority=?, difficulty=?, status=?, resolution=?, attachments=?, comments=?, linked_article=?, updated_at=NOW() WHERE id=?',
    [body.title, body.reporter, body.priority, body.difficulty || 0, body.status, body.resolution || '',
     body.attachments || '[]', body.comments || '[]', body.linked_article || '', body.id]
  );

  const [taskRows] = await db.execute('SELECT id FROM tasks WHERE ticket_id = ?', [body.id]) as any;
  const linkedTask = taskRows[0] as { id: number } | undefined;
  if (linkedTask) {
    await db.execute('UPDATE tasks SET status=? WHERE id=?', [body.status, linkedTask.id]);
    await db.execute('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
      ['Updated', 'Tasks', `Auto-synced task status to "${body.status}" from ticket ${body.id}`, 'System']);
  }
  await db.execute('UPDATE daily_logs SET activity = ? WHERE source = ?',
    [`[Ticket ${body.id}] ${body.status} — ${body.title}`, `ticket:${body.id}`]);
  await db.execute('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Updated', 'Tickets', `Updated ticket: ${body.id} — ${body.title} (${body.status})`, body.userName || 'System']);
  await processRules('ticket_updated', body);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  const [rows] = await db.execute('SELECT title FROM tickets WHERE id=?', [id]) as any;
  const ticket = rows[0] as { title: string } | undefined;
  await db.execute('DELETE FROM tickets WHERE id=?', [id]);
  await db.execute('DELETE FROM daily_logs WHERE source = ?', [`ticket:${id}`]);
  await db.execute("UPDATE tasks SET ticket_id='' WHERE ticket_id=?", [id]);
  await db.execute('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Tickets', `Deleted ticket: ${id} — ${ticket?.title || ''}`, 'System']);
  return NextResponse.json({ success: true });
}
