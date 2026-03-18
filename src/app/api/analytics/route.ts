/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // 1. Team Workload (Completed Tasks & Tickets per member)
    const [workloadRaw] = await db.query(`
      SELECT person AS member_name, COUNT(*) AS total_actions
      FROM (
        SELECT assignee AS person FROM tasks WHERE status = 'Done'
        UNION ALL
        SELECT reporter AS person FROM tickets WHERE status = 'Done'
      ) t
      WHERE person != '' AND person NOT LIKE '%,%'
      GROUP BY person
      ORDER BY total_actions DESC
      LIMIT 10
    `) as any;

    const workload = (workloadRaw as { member_name: string; total_actions: number }[])
      .map(w => ({ name: w.member_name, count: w.total_actions }));

    // 2. Heatmap: Activity count per day (Last 30 days)
    const [heatmapDailyRaw] = await db.query(`
      SELECT DATE_FORMAT(updated_at, '%Y-%m-%d') AS log_date, 'Task' AS type, title
      FROM tasks
      WHERE status = 'Done' AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      UNION ALL
      SELECT DATE_FORMAT(updated_at, '%Y-%m-%d') AS log_date, 'Ticket' AS type, title
      FROM tickets
      WHERE status = 'Done' AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `) as any;

    const heatmapMap = new Map<string, { count: number; items: string[] }>();
    (heatmapDailyRaw as { log_date: string; type: string; title: string }[]).forEach(row => {
      if (!row.log_date) return;
      const existing = heatmapMap.get(row.log_date) || { count: 0, items: [] };
      existing.count += 1;
      if (existing.items.length < 3) existing.items.push(`• [${row.type}] ${row.title}`);
      else if (existing.items.length === 3) existing.items.push('... and more');
      heatmapMap.set(row.log_date, existing);
    });

    const heatmap = Array.from(heatmapMap.entries())
      .map(([log_date, data]) => ({ log_date, count: data.count, intensity_score: data.count * 5, items: data.items }))
      .sort((a, b) => a.log_date.localeCompare(b.log_date));

    return NextResponse.json({ workload, heatmap, projectStats: [] });
  } catch (error) {
    console.error('Analytics failed:', error);
    return NextResponse.json({ error: 'Failed to aggregate analytics' }, { status: 500 });
  }
}
