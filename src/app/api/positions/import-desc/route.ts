import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { id, descriptions, userName } = await req.json();
    const db = getDb('CENTRAL');

    if (!id || !Array.isArray(descriptions) || descriptions.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Fetch existing descriptions
    const [rows] = await db.execute(
      'SELECT name, description FROM positions WHERE id = ?',
      [id]
    ) as any;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const pos = rows[0];
    let existingDesc = [];
    try {
      existingDesc = JSON.parse(pos.description) || [];
      if (!Array.isArray(existingDesc)) existingDesc = [{ id: Date.now(), text: pos.description }];
    } catch {
      existingDesc = [{ id: Date.now(), text: pos.description }];
    }

    // Append new descriptions
    let newItemsAdded = 0;
    for (const text of descriptions) {
      if (!text || text.trim() === '') continue;
      existingDesc.push({
        id: Date.now() + newItemsAdded, // Ensure unique ID
        text: text.trim()
      });
      newItemsAdded++;
    }

    if (newItemsAdded > 0) {
      await db.execute(
        'UPDATE positions SET description = ? WHERE id = ?',
        [JSON.stringify(existingDesc), id]
      );
      
      await db.execute(
        'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
        ['Updated', 'Positions', `Imported ${newItemsAdded} items to Job Profile: ${pos.name}`, userName || 'System']
      );
    }
    
    return NextResponse.json({ success: true, count: newItemsAdded, newDescriptions: JSON.stringify(existingDesc) });
    
  } catch (error) {
    console.error('Import Details failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
