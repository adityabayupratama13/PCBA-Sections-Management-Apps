/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getReportData } from '@/lib/getReportData';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  
  // Get database pool based on 'x-section' header (Division context)
  const db = getDb();
  
  try {
    const data = await getReportData(date, db);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Report API Error:', err);
    return NextResponse.json({ error: 'Failed to generate report data' }, { status: 500 });
  }
}
