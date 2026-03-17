import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // 1. Team Workload (Hours per member)
    const workloadRaw = db.prepare(`
      SELECT member_name, SUM(duration_seconds) as total_seconds
      FROM time_logs
      GROUP BY member_name
    `).all() as { member_name: string, total_seconds: number }[];

    const workload = workloadRaw.map(w => ({
      name: w.member_name,
      hours: Math.round((w.total_seconds / 3600) * 10) / 10
    })).sort((a, b) => b.hours - a.hours);

    // 2. Heatmap: Activity count per day (Last 30 days)
    // We'll count both "tickets resolved" from daily_logs and "time logged" from time_logs
    const heatmapRaw = db.prepare(`
      SELECT date(start_time) as log_date, COUNT(*) as count, SUM(duration_seconds) as seconds
      FROM time_logs
      WHERE start_time >= date('now', '-30 days')
      GROUP BY date(start_time)
      ORDER BY log_date ASC
    `).all() as { log_date: string, count: number, seconds: number }[];

    // 3. Project vs Time Completion
    const projectStatsRaw = db.prepare(`
      SELECT t.ticket_id as project_ref, SUM(t.time_spent) as total_time
      FROM tasks t
      WHERE t.ticket_id != ''
      GROUP BY t.ticket_id
    `).all() as { project_ref: string, total_time: number }[];

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
