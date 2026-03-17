import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task_id, member_name, duration_seconds } = body;

    if (!task_id || !member_name || duration_seconds === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();
    
    // Log the individual time entry
    db.prepare(`
      INSERT INTO time_logs (task_id, member_name, start_time, end_time, duration_seconds)
      VALUES (?, ?, ?, ?, ?)
    `).run(task_id, member_name, now, now, duration_seconds);

    // Update the task's total accumulated time
    db.prepare(`
      UPDATE tasks 
      SET time_spent = COALESCE(time_spent, 0) + ? 
      WHERE id = ?
    `).run(duration_seconds, task_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log time:', error);
    return NextResponse.json({ error: 'Failed to log time' }, { status: 500 });
  }
}
