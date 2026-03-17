/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const [rows] = await db.query('SELECT * FROM articles ORDER BY created_at DESC') as any;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, author, category, tags = '[]' } = body;
    if (!title || !author) return NextResponse.json({ error: 'Title and author are required' }, { status: 400 });
    const db = getDb();
    const [result] = await db.execute(
      'INSERT INTO articles (title, content, author, category, tags) VALUES (?, ?, ?, ?, ?)',
      [title, content, author, category || 'General', tags]
    ) as any;
    return NextResponse.json({ id: result.insertId, title, content, author, category, tags, views: 0, likes: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to create article:', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, title, content, category, tags } = body;
    if (!id) return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
    const db = getDb();
    await db.execute(
      'UPDATE articles SET title = ?, content = ?, category = ?, tags = ?, updated_at = NOW() WHERE id = ?',
      [title, content, category, tags, id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update article:', error);
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Article ID required' }, { status: 400 });
    const db = getDb();
    await db.execute('DELETE FROM articles WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
