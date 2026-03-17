import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const rules = db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all();
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Failed to fetch rules:', error);
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, trigger_event, condition_field, condition_value, action_type, action_payload } = body;

    if (!name || !trigger_event || !action_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO rules (name, trigger_event, condition_field, condition_value, action_type, action_payload, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    
    const info = stmt.run(name, trigger_event, condition_field, condition_value, action_type, action_payload);
    
    return NextResponse.json({ 
      id: info.lastInsertRowid,
      name, trigger_event, condition_field, condition_value, action_type, action_payload,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to create rule:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      UPDATE rules 
      SET is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    stmt.run(is_active ? 1 : 0, id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update rule:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM rules WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete rule:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
