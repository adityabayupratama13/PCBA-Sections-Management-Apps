/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb('CENTRAL');
    const [rows] = await db.query(
      `SELECT * FROM positions ORDER BY
        CASE level
          WHEN 'Manager' THEN 1
          WHEN 'Supervisor' THEN 2
          WHEN 'Senior' THEN 3
          ELSE 4
        END, name ASC`
    ) as any;
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Positions GET error:', err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb('CENTRAL');

  const [existing] = await db.execute('SELECT id FROM positions WHERE LOWER(name) = LOWER(?)', [body.name]) as any;
  if (existing[0]) return NextResponse.json({ error: 'Position name already exists' }, { status: 409 });

  const [result] = await db.execute(
    'INSERT INTO positions (name, division, level, description) VALUES (?, ?, ?, ?)',
    [body.name, body.division || 'Engineering', body.level || 'Staff', body.description || '']
  ) as any;
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Created', 'Positions', `Created position: ${body.name}`, body.userName || 'System']
  );
  return NextResponse.json({ id: result.insertId, name: body.name, division: body.division, level: body.level, description: body.description }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb('CENTRAL');

  const [existing] = await db.execute('SELECT id FROM positions WHERE LOWER(name) = LOWER(?) AND id != ?', [body.name, body.id]) as any;
  if (existing[0]) return NextResponse.json({ error: 'Position name already exists' }, { status: 409 });

  await db.execute(
    'UPDATE positions SET name = ?, division = ?, level = ?, description = ? WHERE id = ?',
    [body.name, body.division, body.level, body.description || '', body.id]
  );
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Updated', 'Positions', `Updated position: ${body.name}`, body.userName || 'System']
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb('CENTRAL');
  const [rows] = await db.execute('SELECT name FROM positions WHERE id = ?', [id]) as any;
  const pos = rows[0] as { name: string } | undefined;
  if (!pos) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

  await db.execute('DELETE FROM positions WHERE id = ?', [id]);
  await db.execute(
    'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
    ['Deleted', 'Positions', `Deleted position: ${pos.name}`, 'System']
  );
  return NextResponse.json({ success: true });
}
