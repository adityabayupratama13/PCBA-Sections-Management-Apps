import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const [rows]: any = await db.query('SELECT setting_key, setting_value FROM global_settings');
    const settings: Record<string, any> = {};

    for (const row of rows) {
      try {
         settings[row.setting_key] = JSON.parse(row.setting_value);
      } catch(e) {
         settings[row.setting_key] = row.setting_value;
      }
    }
    
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    // Iterate over the body and upsert into the DB
    for (const [key, value] of Object.entries(body)) {
       const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
       await db.execute(
         'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
         [key, strValue, strValue]
       );
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
