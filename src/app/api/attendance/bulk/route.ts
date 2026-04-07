/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { attendances = [], overtimes = [], userName = 'System' } = await req.json();
    const db = getDb();
    
    // Process attendances
    for (const body of attendances) {
      const [existRows] = await db.execute(
        'SELECT id FROM attendance_logs WHERE member_name = ? AND date = ?',
        [body.member_name, body.date]
      ) as any;
      const existing = existRows[0] as { id: number } | undefined;

      if (existing) {
        await db.execute(
          'UPDATE attendance_logs SET shift = ?, ot_start_time = ?, ot_end_time = ?, overtime_hours = ?, overtime_desc = ? WHERE id = ?',
          [body.shift, body.ot_start_time || '', body.ot_end_time || '', body.overtime_hours || 0, body.overtime_desc || '', existing.id]
        );
      } else {
        await db.execute(
          'INSERT INTO attendance_logs (member_name, date, shift, ot_start_time, ot_end_time, overtime_hours, overtime_desc) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [body.member_name, body.date, body.shift || 'Off', body.ot_start_time || '', body.ot_end_time || '', body.overtime_hours || 0, body.overtime_desc || '']
        );
      }
    }

    if (attendances.length > 0) {
      await db.execute(
        'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
        ['Updated', 'Attendance', `Bulk updated ${attendances.length} shift(s)`, userName]
      );
    }

    // Process Overtimes
    for (const ot of overtimes) {
      const [result] = await db.execute(
        'INSERT INTO overtimes (member_name, request_date, start_time, end_time, hours, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ot.member_name, ot.request_date, ot.start_time, ot.end_time, ot.hours, ot.reason, 'Pending']
      ) as any;
    }

    if (overtimes.length > 0) {
      await db.execute(
        'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
        ['Created', 'Overtime', `Bulk created ${overtimes.length} overtime request(s) from Holiday Apply`, userName]
      );
    }

    return NextResponse.json({ success: true, processed: { attendances: attendances.length, overtimes: overtimes.length } });
  } catch (error: any) {
    console.error('Bulk API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
