import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // 1. Team Workload (Completed Tasks & Tickets per member)
    const workloadRaw = db.prepare(`
      SELECT person as member_name, COUNT(*) as total_actions
      FROM (
        SELECT assignee as person FROM tasks WHERE status = 'Done'
        UNION ALL
        SELECT reporter as person FROM tickets WHERE status IN ('Resolved', 'Closed')
      )
      WHERE person != '' AND person NOT LIKE '%,%' -- basic split filter for simplicity on backend
      GROUP BY person
      ORDER BY total_actions DESC
      LIMIT 10
    `).all() as { member_name: string, total_actions: number }[];

    const workload = workloadRaw.map(w => ({
      name: w.member_name,
      count: w.total_actions
    }));

    // 2. Heatmap: Activity count per day (Last 30 days) - ONLY DONE/RESOLVED
    const heatmapDailyRaw = db.prepare(`
      SELECT 
        date(updated_at) as log_date, 
        'Task' as type,
        title
      FROM tasks
      WHERE status = 'Done' AND updated_at >= date('now', '-30 days')
      
      UNION ALL
      
      SELECT 
        date(updated_at) as log_date, 
        'Ticket' as type,
        title
      FROM tickets
      WHERE status IN ('Resolved', 'Closed') AND updated_at >= date('now', '-30 days')
    `).all() as { log_date: string, type: string, title: string }[];

    const heatmapMap = new Map<string, { count: number, items: string[] }>();
    heatmapDailyRaw.forEach(row => {
      if (!row.log_date) return;
      const existing = heatmapMap.get(row.log_date) || { count: 0, items: [] };
      existing.count += 1;
      if (existing.items.length < 3) {
        existing.items.push(`• [${row.type}] ${row.title}`);
      } else if (existing.items.length === 3) {
        existing.items.push(`... and more`);
      }
      heatmapMap.set(row.log_date, existing);
    });

    const heatmap = Array.from(heatmapMap.entries()).map(([log_date, data]) => ({
      log_date,
      count: data.count,
      intensity_score: data.count * 5,
      items: data.items
    })).sort((a, b) => a.log_date.localeCompare(b.log_date));

    // 3. Project vs Time Completion (Keep existing or remove if unused, let's keep empty array for now)
    const projectStatsRaw: string[] = [];

    return NextResponse.json({
      workload,
      heatmap,
      projectStats: projectStatsRaw
    });

  } catch (error) {
    console.error('Analytics failed:', error);
    return NextResponse.json({ error: 'Failed to aggregate analytics' }, { status: 500 });
  }
}
