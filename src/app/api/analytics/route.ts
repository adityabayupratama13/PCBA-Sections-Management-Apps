import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // 1. Team Workload (Task & Ticket Actions per member)
    const workloadRaw = db.prepare(`
      SELECT user_name as member_name, COUNT(*) as total_actions
      FROM audit_logs
      WHERE module IN ('Tasks', 'Tickets') AND user_name != 'System' AND user_name != 'System Bot'
      GROUP BY user_name
      ORDER BY total_actions DESC
      LIMIT 10
    `).all() as { member_name: string, total_actions: number }[];

    const workload = workloadRaw.map(w => ({
      name: w.member_name,
      count: w.total_actions
    }));

    // 2. Heatmap: Activity count per day (Last 30 days)
    const heatmapRaw = db.prepare(`
      SELECT date(timestamp) as log_date, COUNT(*) as count, COUNT(*) * 5 as intensity_score
      FROM audit_logs
      WHERE timestamp >= date('now', '-30 days')
      GROUP BY date(timestamp)
      ORDER BY log_date ASC
    `).all() as { log_date: string, count: number, intensity_score: number }[];

    // 3. Project vs Time Completion (Keep existing or remove if unused, let's keep empty array for now)
    const projectStatsRaw: string[] = [];

    return NextResponse.json({
      workload,
      heatmap: heatmapRaw,
      projectStats: projectStatsRaw
    });

  } catch (error) {
    console.error('Analytics failed:', error);
    return NextResponse.json({ error: 'Failed to aggregate analytics' }, { status: 500 });
  }
}
