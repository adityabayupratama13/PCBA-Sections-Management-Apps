/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type LeaveRow = { id: number; member_name: string; start_date: string; end_date: string; status: string; leave_type: string; days_count: number };

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM leave_requests ORDER BY application_date DESC, id DESC') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const [result] = await db.execute(
    'INSERT INTO leave_requests (member_name, leave_type, application_date, start_date, end_date, days_count, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [body.member_name, body.leave_type, body.application_date, body.start_date, body.end_date, body.days_count, body.reason || '', 'Pending']
  ) as any;
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Created', 'Leave Request', `${body.member_name} requested ${body.leave_type} for ${body.days_count} days`, body.userName || body.member_name]
  );
  return NextResponse.json({ id: result.insertId });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const [existRows] = await db.execute('SELECT * FROM leave_requests WHERE id = ?', [body.id]) as any;
  const existing = existRows[0] as LeaveRow | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Full edit of leave details
  if (body.start_date || body.end_date || body.leave_type || body.reason) {
    const isEditingApproved = existing.status === 'Approved';
    await db.execute(
      'UPDATE leave_requests SET leave_type = ?, start_date = ?, end_date = ?, days_count = ?, reason = ?, status = ?, approved_by = ? WHERE id = ?',
      [body.leave_type || existing.leave_type, body.start_date || existing.start_date,
       body.end_date || existing.end_date, body.days_count || existing.days_count,
       body.reason || '', 'Pending', '', body.id]
    );

    if (isEditingApproved) {
      if (existing.leave_type === 'Annual Leave') {
        const [bRows] = await db.execute('SELECT balance FROM user_leave_balances WHERE member_name = ?', [existing.member_name]) as any;
        if (bRows[0]) await db.execute('UPDATE user_leave_balances SET balance = balance + ? WHERE member_name = ?', [existing.days_count, existing.member_name]);
      }
      const currTarget = new Date(existing.start_date);
      const endDateObj = new Date(existing.end_date);
      while (currTarget <= endDateObj) {
        const dStr = currTarget.toISOString().split('T')[0];
        await db.execute("UPDATE attendance_logs SET shift = 'Off' WHERE member_name = ? AND date = ? AND shift = 'Leave'", [existing.member_name, dStr]);
        currTarget.setDate(currTarget.getDate() + 1);
      }
    }
    await db.execute('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
      ['Updated', 'Leave Request', `${body.userName || existing.member_name} edited leave ${body.id} and it is now Pending`, body.userName || 'System']);
    return NextResponse.json({ success: true, status: 'Pending' });
  }

  // Status approval/rejection only
  await db.execute('UPDATE leave_requests SET status = ?, approved_by = ? WHERE id = ?', [body.status, body.approved_by || '', body.id]);
  if (body.status === 'Approved' && existing.status !== 'Approved') {
    const currTarget = new Date(existing.start_date);
    const endDateObj = new Date(existing.end_date);
    while (currTarget <= endDateObj) {
      const dStr = currTarget.toISOString().split('T')[0];
      const [attRows] = await db.execute('SELECT id FROM attendance_logs WHERE member_name = ? AND date = ?', [existing.member_name, dStr]) as any;
      const attns = attRows[0] as { id: number } | undefined;
      if (attns) {
        await db.execute("UPDATE attendance_logs SET shift = 'Leave' WHERE id = ?", [attns.id]);
      } else {
        await db.execute("INSERT INTO attendance_logs (member_name, date, shift) VALUES (?, ?, 'Leave')", [existing.member_name, dStr]);
      }
      currTarget.setDate(currTarget.getDate() + 1);
    }
    if (existing.leave_type === 'Annual Leave') {
      const [bRows] = await db.execute('SELECT balance FROM user_leave_balances WHERE member_name = ?', [existing.member_name]) as any;
      if (bRows[0]) await db.execute('UPDATE user_leave_balances SET balance = balance - ? WHERE member_name = ?', [existing.days_count, existing.member_name]);
    }
  }
  await db.execute('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Updated', 'Leave Request', `${body.approved_by} marked leave ${body.id} as ${body.status}`, body.userName || 'System']);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const userName = searchParams.get('userName') || 'System';
  const db = getDb();
  const [existRows] = await db.execute('SELECT * FROM leave_requests WHERE id = ?', [Number(id)]) as any;
  const existing = existRows[0] as LeaveRow | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status === 'Approved') {
    if (existing.leave_type === 'Annual Leave') {
      const [bRows] = await db.execute('SELECT balance FROM user_leave_balances WHERE member_name = ?', [existing.member_name]) as any;
      if (bRows[0]) await db.execute('UPDATE user_leave_balances SET balance = balance + ? WHERE member_name = ?', [existing.days_count, existing.member_name]);
    }
    const currTarget = new Date(existing.start_date);
    const endDateObj = new Date(existing.end_date);
    while (currTarget <= endDateObj) {
      const dStr = currTarget.toISOString().split('T')[0];
      await db.execute("UPDATE attendance_logs SET shift = 'Off' WHERE member_name = ? AND date = ? AND shift = 'Leave'", [existing.member_name, dStr]);
      currTarget.setDate(currTarget.getDate() + 1);
    }
  }
  await db.execute('DELETE FROM leave_requests WHERE id = ?', [Number(id)]);
  await db.execute('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Leave Request', `${userName} deleted leave ${id} for ${existing.member_name}`, userName]);
  return NextResponse.json({ success: true });
}
