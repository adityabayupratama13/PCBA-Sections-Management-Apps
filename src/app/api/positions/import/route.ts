import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { positions, userName } = await req.json();
    const db = getDb('CENTRAL');

    if (!Array.isArray(positions) || positions.length === 0) {
      return NextResponse.json({ error: 'No data to import' }, { status: 400 });
    }

    let successCount = 0;
    
    // Process each row
    for (const pos of positions) {
      // Validate row
      if (!pos.division || !pos.name || !pos.level) continue;
      
      let descArray: Record<string, any>[] = [];
      if (pos.description && pos.description !== '[]') {
        try {
          const parsed = JSON.parse(pos.description);
          if (Array.isArray(parsed)) descArray = parsed;
          else descArray = [{ id: Date.now(), text: pos.description }];
        } catch {
          // If plain text (maybe parsed with newlines from Excel), split it
          const textLines = String(pos.description).split(/\r?\n/).filter(t => t.trim() !== '');
          descArray = textLines.map((t, i) => ({ id: Date.now() + i, text: t.trim() }));
          if (descArray.length === 0) descArray = [{ id: Date.now(), text: pos.description }];
        }
      }
      const desc = JSON.stringify(descArray);
      
      // Check if duplicate
      const [exists] = await db.execute(
        'SELECT id, description, level FROM positions WHERE name = ? AND division = ?',
        [pos.name, pos.division]
      ) as any;
      
      if ((exists as any[]).length === 0) {
        await db.execute(
          'INSERT INTO positions (name, division, level, description) VALUES (?, ?, ?, ?)',
          [pos.name, pos.division, pos.level, desc]
        );
        successCount++;
      } else {
        // Upsert description to existing position
        const existingRow = (exists as any[])[0];
        let newItemsAdded = 0;
        let existingDesc: any[] = [];
        try { existingDesc = JSON.parse(existingRow.description) || []; } catch { existingDesc = []; }
        if (!Array.isArray(existingDesc)) existingDesc = [];

        descArray.forEach(newItem => {
           const isDup = existingDesc.some(d => d.text.trim().toLowerCase() === newItem.text.trim().toLowerCase());
           if (!isDup && newItem.text) {
             existingDesc.push({ id: Date.now() + newItemsAdded, text: newItem.text });
             newItemsAdded++;
           }
        });

        // Always update level if it changed, but count as success if new desc added
        await db.execute(
          'UPDATE positions SET description = ?, level = ? WHERE id = ?',
          [JSON.stringify(existingDesc), pos.level, existingRow.id]
        );
        if (newItemsAdded > 0) successCount++;
      }
    }
    
    if (successCount > 0) {
      await db.execute(
        'INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)',
        ['Imported', 'Positions', `Imported ${successCount} positions via Excel`, userName || 'System']
      );
    }
    
    return NextResponse.json({ success: true, count: successCount });
    
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json({ error: 'Failed to process import' }, { status: 500 });
  }
}
