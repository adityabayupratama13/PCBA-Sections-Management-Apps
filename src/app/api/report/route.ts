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
  
  function getWeekBoundaries(d: string) {
    const dt = new Date(d + 'T00:00:00Z');
    const day = dt.getUTCDay();
    const diffToMon = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(dt.getTime()); mon.setUTCDate(diffToMon);
    const sun = new Date(mon.getTime()); sun.setUTCDate(mon.getUTCDate() + 6);
    return { mon: mon.toISOString().split('T')[0], sun: sun.toISOString().split('T')[0] };
  }
  const week = getWeekBoundaries(date);

  function isWithinCutoff(dbDateString: string, targetDateStr: string) {
    if (!dbDateString) return false;
    const t = new Date(dbDateString).getTime();
    if (isNaN(t)) return false;
    // targetDate starts at 06:30 AM local time (GMT+7)
    const startTimeStr = `${targetDateStr}T06:30:00+07:00`;
    const startT = new Date(startTimeStr).getTime();
    const endT = startT + 86400000; // +24 hours
    return t >= startT && t < endT;
  }

  try {
    // ── Tickets ──────────────────────────────────────────────
    const [allTickets] = await db.query('SELECT * FROM tickets') as any;
    const ticketsToday = allTickets.filter((t: any) => isWithinCutoff(t.created_date, date));
    const ticketStats = {
      totalCreatedToday: ticketsToday.length,
      backlog: ticketsToday.filter((t: any) => t.status === 'Backlog').length,
      inProgress: ticketsToday.filter((t: any) => t.status === 'In Progress' || t.status === 'Review').length,
      done: ticketsToday.filter((t: any) => t.status === 'Done').length,
      critical: ticketsToday.filter((t: any) => t.priority === 'Critical').length,
      high: ticketsToday.filter((t: any) => t.priority === 'High').length,
      medium: ticketsToday.filter((t: any) => t.priority === 'Medium').length,
      low: ticketsToday.filter((t: any) => t.priority === 'Low').length,
      recent: ticketsToday.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
    };

    // ── Tasks ─────────────────────────────────────────────────
    const [allTasks] = await db.query('SELECT * FROM tasks') as any;
    const tasksToday = allTasks.filter((t: any) => isWithinCutoff(t.created_at, date));
    const taskStats = {
      totalCreatedToday: tasksToday.length,
      backlog: tasksToday.filter((t: any) => t.status === 'Backlog').length,
      inProgress: tasksToday.filter((t: any) => t.status === 'In Progress').length,
      review: tasksToday.filter((t: any) => t.status === 'Review').length,
      done: tasksToday.filter((t: any) => t.status === 'Done').length,
      byAssignee: (() => {
        const map: Record<string, number> = {};
        tasksToday.forEach((t: any) => { if (t.assignee) map[t.assignee] = (map[t.assignee] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
      })(),
      recent: tasksToday.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority || 'Medium', assignee: t.assignee || 'Unassigned' })),
    };

    // ── Team / Members / Manpower ─────────────────────────────
    const [allMembers] = await db.query('SELECT * FROM members') as any;
    const [leaveBalances] = await db.query('SELECT * FROM user_leave_balances') as any;
    
    // Exclude Managers
    const members = allMembers.filter((m: any) => 
      !m.role?.toLowerCase().includes('manager') && 
      !m.position?.toLowerCase().includes('manager')
    );

    const memberStats = {
      total: members.length,
      active: members.filter((m: any) => m.status === 'Active').length,
      list: members.map((m: any) => ({ name: m.name, position: m.position, department: m.department, status: m.status })),
      manpower: members.map((m: any) => {
        const balRow = leaveBalances.find((l: any) => l.member_name === m.name);
        return {
          name: m.name,
          status: m.status,
          employment_status: m.employment_status || 'Permanent',
          contract_duration: m.contract_duration || 0,
          leave_balance: balRow ? balRow.balance : 0
        };
      })
    };

    // ── Attendance ────────────────────────────────────────────
    const [attRows] = await db.query('SELECT * FROM attendance_logs WHERE date = ?', [date]) as any;
    const attStats = {
      present: attRows.filter((a: any) => a.status === 'Present').length,
      absent: attRows.filter((a: any) => a.status === 'Absent').length,
      late: attRows.filter((a: any) => a.status === 'Late').length,
      wfh: attRows.filter((a: any) => a.status === 'WFH').length,
      total: attRows.length,
      shift1: attRows.filter((a: any) => a.shift?.includes('Shift 1') && a.status !== 'Absent').length,
      shift2: attRows.filter((a: any) => a.shift?.includes('Shift 2') && a.status !== 'Absent').length,
      shift3: attRows.filter((a: any) => a.shift?.includes('Shift 3') && a.status !== 'Absent').length,
      shiftNormal: attRows.filter((a: any) => a.shift?.includes('Normal') && a.status !== 'Absent').length,
      records: attRows.filter((a: any) => !['Off', 'Leave'].includes(a.shift)).map((a: any) => ({ name: a.member_name, shift: a.shift })),
    };
    
    // Derived Present dynamically from the Roster
    attStats.present = attStats.shift1 + attStats.shift2 + attStats.shift3 + attStats.shiftNormal;

    // ── Projects ──────────────────────────────────────────────
    const [projects] = await db.query('SELECT * FROM projects') as any;
    const activeProjects = projects.filter((p: any) => toMysqlDate(p.start_date) <= week.sun && toMysqlDate(p.end_date) >= week.mon);
    const projectStats = {
      totalActive: activeProjects.length,
      planning: activeProjects.filter((p: any) => p.status === 'Planning').length,
      active: activeProjects.filter((p: any) => p.status === 'Active').length,
      onHold: activeProjects.filter((p: any) => p.status === 'On Hold').length,
      completed: activeProjects.filter((p: any) => p.status === 'Completed').length,
      list: activeProjects.map((p: any) => ({ name: p.name, pic: p.pic, status: p.status, progress: p.progress, end_date: p.end_date })),
    };

    // ── Overtime ──────────────────────────────────────────────
    let otStats = { total: 0, pending: 0, approved: 0, totalHours: 0, records: [] as any[] };
    try {
      const conn = await mysql.createConnection(otDbConfig);
      // Fallback Overtime to filter precisely 06:30 if created_at is available, else request_date
      const [allOt] = await conn.query('SELECT * FROM overtime_requests WHERE request_date = ?', [date]) as any;
      await conn.end();
      otStats = {
        total: allOt.length,
        pending: allOt.filter((o: any) => o.status === 'Pending').length,
        approved: allOt.filter((o: any) => o.status === 'Approved').length,
        totalHours: allOt.reduce((s: number, o: any) => s + (Number(o.hours) || 0), 0),
        records: allOt.map((o: any) => ({ name: o.member_name, hours: o.hours, reason: o.reason, status: o.status })),
      };
    } catch { /* OT table may not exist */ }

    // ── Leave ─────────────────────────────────────────────────
    let leaveStats = { total: 0, pending: 0, approved: 0, rejected: 0, records: [] as any[] };
    try {
      const [leaveRows] = await db.query('SELECT * FROM leaves WHERE start_date <= ? AND end_date >= ?', [week.sun, week.mon]) as any;
      leaveStats = {
        total: leaveRows.length,
        pending: leaveRows.filter((l: any) => l.status === 'Pending').length,
        approved: leaveRows.filter((l: any) => l.status === 'Approved').length,
        rejected: leaveRows.filter((l: any) => l.status === 'Rejected').length,
        records: leaveRows.map((l: any) => ({ name: l.member_name, type: l.leave_type, status: l.status, start: l.start_date, end: l.end_date })),
      };
    } catch { /* leaves table optional */ }

    // ── Audit Summary ─────────────────────────────────────────
    const [auditRows] = await db.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200') as any;
    const filteredAudits = auditRows.filter((a: any) => isWithinCutoff(a.timestamp, date)).slice(0, 20);

    return NextResponse.json({
      date,
      generatedAt: new Date().toISOString(),
      tickets: ticketStats,
      tasks: taskStats,
      members: memberStats,
      attendance: attStats,
      projects: projectStats,
      overtime: otStats,
      leaves: leaveStats,
      auditSummary: filteredAudits.map((a: any) => ({ action: a.action, module: a.module, details: a.details, user: a.user_name, time: toMysqlDate(a.timestamp) })),
    });
  } catch (err) {
    console.error('Report API Error:', err);
    return NextResponse.json({ error: 'Failed to generate report data' }, { status: 500 });
  }
}
