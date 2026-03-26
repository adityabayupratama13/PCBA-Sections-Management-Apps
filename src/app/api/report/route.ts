/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, toMysqlDate } from '@/lib/db';
import mysql from 'mysql2/promise';

const otDbConfig = {
  host: process.env.MYSQL_HOST || 'giken-mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'giken_db',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const db = getDb();

  try {
    // ── Tickets ──────────────────────────────────────────────
    const [allTickets] = await db.query('SELECT * FROM tickets') as any;
    const activeTickets = allTickets.filter((t: any) => toMysqlDate(t.created_date) === date || toMysqlDate(t.updated_at) === date);
    const ticketStats = {
      totalActive: activeTickets.length,
      createdToday: activeTickets.filter((t: any) => toMysqlDate(t.created_date) === date).length,
      resolvedToday: activeTickets.filter((t: any) => t.status === 'Done' && toMysqlDate(t.updated_at) === date).length,
      backlog: activeTickets.filter((t: any) => t.status === 'Backlog').length,
      inProgress: activeTickets.filter((t: any) => t.status === 'In Progress' || t.status === 'Review').length,
      done: activeTickets.filter((t: any) => t.status === 'Done').length,
      critical: activeTickets.filter((t: any) => t.priority === 'Critical').length,
      high: activeTickets.filter((t: any) => t.priority === 'High').length,
      medium: activeTickets.filter((t: any) => t.priority === 'Medium').length,
      low: activeTickets.filter((t: any) => t.priority === 'Low').length,
      recent: activeTickets.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
    };

    // ── Tasks ─────────────────────────────────────────────────
    const [allTasks] = await db.query('SELECT * FROM tasks') as any;
    const activeTasks = allTasks.filter((t: any) => toMysqlDate(t.created_at) === date || toMysqlDate(t.updated_at) === date || (t.due_date && toMysqlDate(t.due_date) === date));
    const taskStats = {
      totalActive: activeTasks.length,
      createdToday: activeTasks.filter((t: any) => toMysqlDate(t.created_at) === date).length,
      resolvedToday: activeTasks.filter((t: any) => t.status === 'Done' && toMysqlDate(t.updated_at) === date).length,
      backlog: activeTasks.filter((t: any) => t.status === 'Backlog').length,
      inProgress: activeTasks.filter((t: any) => t.status === 'In Progress').length,
      review: activeTasks.filter((t: any) => t.status === 'Review').length,
      done: activeTasks.filter((t: any) => t.status === 'Done').length,
      overdue: activeTasks.filter((t: any) => t.due_date && toMysqlDate(t.due_date) < date && t.status !== 'Done').length,
      byAssignee: (() => {
        const map: Record<string, number> = {};
        activeTasks.forEach((t: any) => { if (t.assignee) map[t.assignee] = (map[t.assignee] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
      })(),
    };

    // ── Team / Members ────────────────────────────────────────
    const [members] = await db.query('SELECT * FROM members') as any;
    const memberStats = {
      total: members.length,
      active: members.filter((m: any) => m.status === 'Active').length,
      list: members.map((m: any) => ({ name: m.name, position: m.position, department: m.department, status: m.status })),
    };

    // ── Attendance ────────────────────────────────────────────
    const [attRows] = await db.query('SELECT * FROM attendance_logs WHERE date = ?', [date]) as any;
    const attStats = {
      present: attRows.filter((a: any) => a.status === 'Present').length,
      absent: attRows.filter((a: any) => a.status === 'Absent').length,
      late: attRows.filter((a: any) => a.status === 'Late').length,
      wfh: attRows.filter((a: any) => a.status === 'WFH').length,
      total: attRows.length,
      records: attRows.map((a: any) => ({ name: a.member_name, status: a.status, time_in: a.time_in, time_out: a.time_out })),
    };

    // ── Projects ──────────────────────────────────────────────
    const [projects] = await db.query('SELECT * FROM projects') as any;
    const activeProjects = projects.filter((p: any) => toMysqlDate(p.start_date) <= date && toMysqlDate(p.end_date) >= date);
    const projectStats = {
      totalActive: activeProjects.length,
      planning: activeProjects.filter((p: any) => p.status === 'Planning').length,
      active: activeProjects.filter((p: any) => p.status === 'Active').length,
      onHold: activeProjects.filter((p: any) => p.status === 'On Hold').length,
      completed: activeProjects.filter((p: any) => p.status === 'Completed').length,
      list: activeProjects.map((p: any) => ({ name: p.name, pic: p.pic, status: p.status, progress: p.progress, end_date: p.end_date })),
    };

    // ── Daily Logs ────────────────────────────────────────────
    const [logs] = await db.query('SELECT * FROM daily_logs WHERE date = ?', [date]) as any;
    const logStats = {
      total: logs.length,
      totalHours: logs.reduce((s: number, l: any) => s + (Number(l.hours) || 0), 0),
      records: logs.map((l: any) => ({ member: l.member, activity: l.activity, hours: l.hours, location: l.location })),
    };

    // ── Overtime ──────────────────────────────────────────────
    let otStats = { total: 0, pending: 0, approved: 0, totalHours: 0, records: [] as any[] };
    try {
      const conn = await mysql.createConnection(otDbConfig);
      const [otRows] = await conn.query('SELECT * FROM overtime_requests WHERE request_date = ?', [date]) as any;
      await conn.end();
      otStats = {
        total: otRows.length,
        pending: otRows.filter((o: any) => o.status === 'Pending').length,
        approved: otRows.filter((o: any) => o.status === 'Approved').length,
        totalHours: otRows.reduce((s: number, o: any) => s + (Number(o.hours) || 0), 0),
        records: otRows.map((o: any) => ({ name: o.member_name, hours: o.hours, reason: o.reason, status: o.status })),
      };
    } catch { /* OT table may not exist */ }

    // ── Leave ─────────────────────────────────────────────────
    let leaveStats = { total: 0, pending: 0, approved: 0, rejected: 0, records: [] as any[] };
    try {
      const [leaveRows] = await db.query('SELECT * FROM leaves WHERE start_date <= ? AND end_date >= ?', [date, date]) as any;
      leaveStats = {
        total: leaveRows.length,
        pending: leaveRows.filter((l: any) => l.status === 'Pending').length,
        approved: leaveRows.filter((l: any) => l.status === 'Approved').length,
        rejected: leaveRows.filter((l: any) => l.status === 'Rejected').length,
        records: leaveRows.map((l: any) => ({ name: l.member_name, type: l.leave_type, status: l.status, start: l.start_date, end: l.end_date })),
      };
    } catch { /* leaves table optional */ }

    // ── Audit Summary ─────────────────────────────────────────
    const [auditRows] = await db.query('SELECT * FROM audit_logs WHERE DATE(timestamp) = ? ORDER BY timestamp DESC LIMIT 20', [date]) as any;

    return NextResponse.json({
      date,
      generatedAt: new Date().toISOString(),
      tickets: ticketStats,
      tasks: taskStats,
      members: memberStats,
      attendance: attStats,
      projects: projectStats,
      dailyLogs: logStats,
      overtime: otStats,
      leaves: leaveStats,
      auditSummary: auditRows.map((a: any) => ({ action: a.action, module: a.module, details: a.details, user: a.user_name, time: toMysqlDate(a.timestamp) })),
    });
  } catch (err) {
    console.error('Report API Error:', err);
    return NextResponse.json({ error: 'Failed to generate report data' }, { status: 500 });
  }
}
