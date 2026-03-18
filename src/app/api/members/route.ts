/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, toMysqlDatetime } from '@/lib/db';

const MASTER_BADGE = '36443';

export async function GET() {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM members ORDER BY id') as any;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  if (body.action === 'login') {
    const [rows] = await db.execute(
      'SELECT * FROM members WHERE badge = ? AND password = ?',
      [body.badge, body.password]
    ) as any;
    const member = rows[0] as Record<string, unknown> | undefined;
    if (member) {
      await db.execute(
        'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
        ['Logged In', 'Auth', `User logged in: ${member.name}`, member.name as string]
      );
      return NextResponse.json({ success: true, member });
    }
    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
  }

  try {
    const [existRows] = await db.execute('SELECT id FROM members WHERE badge = ?', [body.badge]) as any;
    if (existRows[0]) return NextResponse.json({ error: 'Badge already exists' }, { status: 400 });

    const [result] = await db.execute(
      'INSERT INTO members (name, badge, role, division, email, phone, password, status, grade, join_date, finish_date, employment_status, contract_duration, created_at, photo_url, member_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [body.name, body.badge, body.role || 'IT Support', body.division || 'IT Department',
       body.email || '', body.phone || '', body.password || 'Password123', body.status || 'Active',
       body.grade || '', body.join_date || '', body.finish_date || '', body.employment_status || 'Permanent',
       body.contract_duration || 0, toMysqlDatetime(body.created_at), body.photo_url || null,
       body.member_type || 'IT']
    ) as any;
    await db.execute(
      'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
      ['Created', 'Team', `Added member: ${body.name} (${body.member_type || 'IT'})`, body.userName || 'System']
    );
    return NextResponse.json({ id: result.insertId });
  } catch {
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  try {
    if (body.badge === MASTER_BADGE || body.id === 0) {
      const [existRows] = await db.execute('SELECT id FROM members WHERE badge = ?', [MASTER_BADGE]) as any;
      const existing = existRows[0] as { id: number } | undefined;
      if (existing) {
        await db.execute(
          'UPDATE members SET name=?, role=?, division=?, email=?, phone=?, status=?, grade=?, join_date=?, finish_date=?, employment_status=?, contract_duration=?, created_at=?, photo_url=? WHERE badge=?',
          [body.name, body.role, body.division, body.email || '', body.phone || '', body.status || 'Active',
           body.grade || '', body.join_date || '', body.finish_date || '', body.employment_status || 'Permanent',
           body.contract_duration || 0, toMysqlDatetime(body.created_at), body.photo_url ?? null, MASTER_BADGE]
        );
      } else {
        await db.execute(
          'INSERT INTO members (name, badge, role, division, email, phone, password, status, grade, join_date, finish_date, employment_status, contract_duration, created_at, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [body.name, MASTER_BADGE, body.role, body.division, body.email || '', body.phone || '',
           body.password || 'Giken@212', body.status || 'Active', body.grade || '', body.join_date || '',
           body.finish_date || '', body.employment_status || 'Permanent', body.contract_duration || 0,
           toMysqlDatetime(body.created_at), body.photo_url ?? null]
        );
      }
      await db.execute(
        'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
        ['Updated', 'Team', `Updated master profile: ${body.name}`, body.userName || 'System']
      );
      return NextResponse.json({ success: true });
    }

    await db.execute(
      'UPDATE members SET name=?, badge=?, role=?, division=?, email=?, phone=?, password=?, status=?, grade=?, join_date=?, finish_date=?, employment_status=?, contract_duration=?, created_at=?, photo_url=?, member_type=? WHERE id=?',
      [body.name, body.badge, body.role, body.division, body.email || '', body.phone || '',
       body.password || 'Password123', body.status || 'Active', body.grade || '', body.join_date || '',
       body.finish_date || '', body.employment_status || 'Permanent', body.contract_duration || 0,
       toMysqlDatetime(body.created_at), body.photo_url ?? null, body.member_type || 'IT', body.id]
    );
    await db.execute(
      'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
      ['Updated', 'Team', `Updated member: ${body.name}`, body.userName || 'System']
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDb();
  const [rows] = await db.execute('SELECT name FROM members WHERE id=?', [Number(id)]) as any;
  const member = rows[0] as { name: string } | undefined;
  await db.execute('DELETE FROM members WHERE id=?', [Number(id)]);
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Team', `Deleted member: ${member?.name || id}`, 'System']
  );
  return NextResponse.json({ success: true });
}
