import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return NextResponse.json([]);
  }

  const db = getDb();
  const searchTerm = `%${query.trim()}%`;

  try {
    const results = db.prepare(`
      SELECT 
        id as itemId, 
        title as title, 
        status as subtitle, 
        'ticket' as type 
      FROM tickets 
      WHERE id LIKE ? OR title LIKE ?
      
      UNION ALL
      
      SELECT 
        CAST(id AS TEXT) as itemId, 
        title as title, 
        status as subtitle, 
        'task' as type 
      FROM tasks 
      WHERE title LIKE ?
      
      UNION ALL
      
      SELECT 
        badge as itemId, 
        name as title, 
        role as subtitle, 
        'member' as type 
      FROM members 
      WHERE name LIKE ? OR badge LIKE ?
      
      LIMIT 15
    `).all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
