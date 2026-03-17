/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  if (!query || query.trim().length === 0) return NextResponse.json([]);
  const db = getDb();
  const searchTerm = `%${query.trim()}%`;
  try {
    const [results] = await db.query(`
      SELECT id AS itemId, title, status AS subtitle, 'ticket' AS type
      FROM tickets WHERE id LIKE ? OR title LIKE ?
      UNION ALL
      SELECT CAST(id AS CHAR) AS itemId, title, status AS subtitle, 'task' AS type
      FROM tasks WHERE title LIKE ?
      UNION ALL
      SELECT badge AS itemId, name AS title, role AS subtitle, 'member' AS type
      FROM members WHERE name LIKE ? OR badge LIKE ?
      LIMIT 15
    `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]) as any;
    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
