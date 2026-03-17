/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const currentMonth = new Date().toISOString().substring(0, 7);

  // Get all active members
  const [members] = await db.query("SELECT name FROM members WHERE status = 'Active'") as any;

  for (const m of members as { name: string }[]) {
    const [recRows] = await db.execute(
      'SELECT * FROM user_leave_balances WHERE member_name = ?', [m.name]
    ) as any;
    const record = recRows[0] as { member_name: string; balance: number; last_accrual_month: string } | undefined;

    if (!record) {
      await db.execute(
        'INSERT INTO user_leave_balances (member_name, balance, last_accrual_month) VALUES (?, ?, ?)',
        [m.name, 0, currentMonth]
      );
    } else if (record.last_accrual_month && record.last_accrual_month < currentMonth) {
      const [lastY, lastM] = record.last_accrual_month.split('-').map(Number);
      const [currY, currM] = currentMonth.split('-').map(Number);
      const monthsDiff = (currY - lastY) * 12 + (currM - lastM);
      if (monthsDiff > 0) {
        const newBalance = record.balance + monthsDiff;
        await db.execute(
          'UPDATE user_leave_balances SET balance = ?, last_accrual_month = ? WHERE member_name = ?',
          [newBalance, currentMonth, m.name]
        );
        await db.execute(
          'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
          ['Auto-Accrual', 'Leave Balance', `Auto added ${monthsDiff} days to ${m.name}. New Bal: ${newBalance}`, 'System']
        );
      }
    } else if (!record.last_accrual_month) {
      await db.execute(
        'UPDATE user_leave_balances SET last_accrual_month = ? WHERE member_name = ?',
        [currentMonth, m.name]
      );
    }
  }

  const [balances] = await db.query('SELECT * FROM user_leave_balances') as any;
  return NextResponse.json(balances);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  await db.execute(
    'INSERT INTO user_leave_balances (member_name, balance, last_accrual_month) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE balance = ?, last_accrual_month = ?',
    [body.member_name, body.balance, body.last_accrual_month, body.balance, body.last_accrual_month]
  );
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Manual Update', 'Leave Balance', `Set balance to ${body.balance} for ${body.member_name}`, body.userName || 'System']
  );
  return NextResponse.json({ success: true });
}
