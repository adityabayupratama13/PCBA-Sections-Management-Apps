'use client';
import { useEffect, useState, useRef } from 'react';
import { Users, Ticket, CheckSquare, Activity, Clock, BarChart3, AlertCircle, Briefcase, ArrowRight, Settings2, GripHorizontal } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { canManageDashboard } from '@/lib/permissions';

interface Stats { members: number; tickets: { total: number; open: number; inProgress: number; resolved: number }; tasks: { total: number; backlog: number; inProgress: number; review: number; done: number }; logs: number; positions: number; }
interface AuditLog { id: number; action: string; module: string; details: string; user_name: string; timestamp: string; }
interface TaskItem { assignee: string; status: string; }
interface MemberItem { name: string; role: string; status: string; }

export default function DashboardPage() {
  const { auditLogs, currentUser } = useAuth();
  const [stats, setStats] = useState<Stats>({ members: 0, tickets: { total: 0, open: 0, inProgress: 0, resolved: 0 }, tasks: { total: 0, backlog: 0, inProgress: 0, review: 0, done: 0 }, logs: 0, positions: 0 });
  const defaultStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(defaultStr);
  const [endDate, setEndDate] = useState<string>(defaultStr);
  const [rawData, setRawData] = useState<{ tickets: any[], tasks: any[], logs: any[], members: any[], positions: any[] }>({ tickets: [], tasks: [], logs: [], members: [], positions: [] });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [workloads, setWorkloads] = useState<{ name: string; tasks: number }[]>([]);
  const [teamMembers, setTeamMembers] = useState<MemberItem[]>([]);
  const [heatmap, setHeatmap] = useState<{ log_date: string; count: number; intensity_score: number; items?: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Layout State
  const defaultLayout = ['stats', 'charts', 'workload', 'heatmap', 'activityWorkflow'];
  const [layout, setLayout] = useState<string[]>(defaultLayout);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_layout');
    if (saved) {
      try { setLayout(JSON.parse(saved)); } catch {}
    }
    
    Promise.all([
      fetch('/api/members').then(r => r.json()),
      fetch('/api/tickets').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/daily-logs').then(r => r.json()),
      fetch('/api/audit').then(r => r.json()),
      fetch('/api/positions').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json()),
    ]).then(([m, t, tk, dl, al, pos, analyticsResult]) => {
      setRecentLogs(al.slice(0, 10));
      const itMembersObj = (m as any[]).filter((x: any) => x.member_type !== 'Management');
      setTeamMembers(itMembersObj.slice(0, 8));
      if (analyticsResult && analyticsResult.heatmap) setHeatmap(analyticsResult.heatmap);

      setRawData({ tickets: t, tasks: tk, logs: dl, members: itMembersObj, positions: pos });
      setLoading(false);
      
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!rawData.members.length && !rawData.positions.length) return;

    let filteredTickets = rawData.tickets;
    let filteredTasks = rawData.tasks;
    let filteredLogs = rawData.logs;

    if (startDate && endDate) {
       // Daily Logs strict date match
       filteredLogs = rawData.logs.filter(x => {
         if (!x.date) return false;
         let dStr = x.date;
         if (dStr.includes('T')) dStr = dStr.split('T')[0];
         else if (dStr.includes(' ')) dStr = dStr.split(' ')[0];
         return dStr >= startDate && dStr <= endDate;
       });

       // Tickets rollover logic
       filteredTickets = rawData.tickets.filter(t => {
         const dStr = (t.created_date || '').split('T')[0].split(' ')[0];
         if (!dStr) return true; 
         if (t.status === 'Resolved' || t.status === 'Done') return dStr >= startDate && dStr <= endDate;
         return dStr <= endDate;
       });

       // Tasks rollover logic
       filteredTasks = rawData.tasks.filter(t => {
         const dStr = (t.due_date || t.created_at || t.updated_at || '').split('T')[0].split(' ')[0];
         if (!dStr) return true; 
         if (t.status === 'Done') return dStr >= startDate && dStr <= endDate;
         return dStr <= endDate;
       });
    }

    // Workload: count tasks per assignee from FILTERED tasks
    const wMap: Record<string, number> = {};
    filteredTasks.forEach((task: any) => {
      if (task.assignee) {
        task.assignee.split(', ').forEach((a: string) => {
          if (a && a !== 'Unassigned') wMap[a] = (wMap[a] || 0) + 1;
        });
      }
    });
    setWorkloads(Object.entries(wMap).map(([name, tasks]) => ({ name, tasks })).sort((a, b) => b.tasks - a.tasks));

    setStats({
      members: rawData.members.length,
      tickets: {
        total: filteredTickets.length,
        open: filteredTickets.filter((x: { status: string }) => x.status === 'Backlog').length,
        inProgress: filteredTickets.filter((x: { status: string }) => x.status === 'In Progress' || x.status === 'Review').length,
        resolved: filteredTickets.filter((x: { status: string }) => x.status === 'Done').length,
      },
      tasks: {
        total: filteredTasks.length,
        backlog: filteredTasks.filter((x: { status: string }) => x.status === 'Backlog').length,
        inProgress: filteredTasks.filter((x: { status: string }) => x.status === 'In Progress').length,
        review: filteredTasks.filter((x: { status: string }) => x.status === 'Review').length,
        done: filteredTasks.filter((x: { status: string }) => x.status === 'Done').length,
      },
      logs: filteredLogs.length,
      positions: rawData.positions.length,
    });
  }, [startDate, endDate, rawData]);

  const ticketPie = [
    { name: 'Backlog', value: stats.tickets.open, color: '#64748B' },
    { name: 'In Progress', value: stats.tickets.inProgress, color: '#3B82F6' },
    { name: 'Done', value: stats.tickets.resolved, color: '#10B981' },
  ].filter(d => d.value > 0);

  const taskBar = [
    { name: 'Backlog', count: stats.tasks.backlog, fill: '#64748B' },
    { name: 'In Progress', count: stats.tasks.inProgress, fill: '#3B82F6' },
    { name: 'Review', count: stats.tasks.review, fill: '#F59E0B' },
    { name: 'Done', count: stats.tasks.done, fill: '#10B981' },
  ];

  const actionStyle = (a: string) => {
    if (['Created', 'Logged In'].includes(a)) return 'bg-emerald-500/15 text-emerald-400';
    if (a === 'Deleted') return 'bg-rose-500/15 text-rose-400';
    if (a === 'Updated') return 'bg-blue-500/15 text-blue-400';
    return 'bg-gray-500/15 text-gray-400';
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color?: string; payload?: { fill?: string }; value: number }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-surface border border-border rounded-xl shadow-xl p-3 text-xs animate-in fade-in zoom-in-95 duration-200">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((entry: { color?: string; payload?: { fill?: string }; value: number }, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
                <span className="text-muted-foreground capitalize">Tasks</span>
              </div>
              <span className="font-bold text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { color?: string; fill?: string; name?: string; value: number } }[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = ticketPie.reduce((s, d) => s + d.value, 0);
      const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white dark:bg-surface border border-border rounded-xl shadow-xl p-3 text-xs animate-in fade-in zoom-in-95 duration-200 min-w-[120px]">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: data.color || data.fill }} />
            <p className="font-semibold text-foreground">{data.name}</p>
          </div>
          <div className="flex flex-col gap-1.5">
             <div className="flex justify-between items-center gap-4"><span className="text-muted-foreground">Count</span> <strong className="text-foreground">{data.value}</strong></div>
             <div className="flex justify-between items-center gap-4"><span className="text-muted-foreground">Share</span> <strong className="text-foreground">{pct}%</strong></div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isEditingLayout) return;
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!isEditingLayout || !draggedItem || draggedItem === id) return;
    const newLayout = [...layout];
    const dragIndex = newLayout.indexOf(draggedItem);
    const dropIndex = newLayout.indexOf(id);
    newLayout.splice(dragIndex, 1);
    newLayout.splice(dropIndex, 0, draggedItem);
    setLayout(newLayout);
  };

  const handleDragEnd = () => {
    if (isEditingLayout) {
      localStorage.setItem('dashboard_layout', JSON.stringify(layout));
      setDraggedItem(null);
    }
  };

  const toggleEditLayout = () => {
    if (isEditingLayout) {
      localStorage.setItem('dashboard_layout', JSON.stringify(layout));
    }
    setIsEditingLayout(!isEditingLayout);
  };

  const LayoutWrapperBlock = ({ id, children }: { id: string, children: React.ReactNode }) => (
    <div
      draggable={isEditingLayout}
      onDragStart={(e) => handleDragStart(e, id)}
      onDragOver={(e) => handleDragOver(e, id)}
      onDragEnd={handleDragEnd}
      className={`relative transition-all ${isEditingLayout ? 'p-4 border-2 border-dashed border-primary/40 rounded-2xl bg-primary/5 cursor-grab active:cursor-grabbing mb-4' : 'mb-6'}`}
      style={draggedItem === id ? { opacity: 0.5 } : {}}
    >
      {isEditingLayout && (
        <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary rounded-full text-white flex items-center justify-center shadow-lg z-10 cursor-grab">
          <GripHorizontal className="w-4 h-4" />
        </div>
      )}
      <div className={isEditingLayout ? 'pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }} 
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!startDate && !endDate ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-surface border border-border text-muted-foreground hover:bg-secondary'}`}
          >
            All Data
          </button>
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground pl-1 hidden sm:inline">Date:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm text-foreground focus:outline-none cursor-pointer" />
            <span className="text-muted-foreground">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm text-foreground focus:outline-none cursor-pointer" />
          </div>
          {canManageDashboard(currentUser) && (
            <button
              onClick={toggleEditLayout}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isEditingLayout ? 'bg-primary text-white shadow-md' : 'bg-surface border border-border text-foreground hover:bg-primary/5 hover:border-primary/30'}`}
            >
              <Settings2 className="w-4 h-4" />
              {isEditingLayout ? 'Done' : 'Edit Layout'}
            </button>
          )}
        </div>
      </div>

      {layout.map((blockId) => {
        if (blockId === 'stats') return (
          <LayoutWrapperBlock key="stats" id="stats">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[
                { label: 'Team Members', val: stats.members, sub: 'Active Accounts', icon: <Users className="w-5 h-5" />, cls: 'text-primary bg-primary/10 border-primary/20' },
                { label: 'Active Tickets', val: stats.tickets.open + stats.tickets.inProgress, sub: `${stats.tickets.resolved} done`, icon: <Ticket className="w-5 h-5" />, cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
                { label: 'Tasks', val: stats.tasks.total, sub: `${stats.tasks.done} done`, icon: <CheckSquare className="w-5 h-5" />, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              ].map(s => (
                <div key={s.label} className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className={`p-2.5 rounded-xl border flex-shrink-0 ${s.cls}`}>{s.icon}</div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold text-foreground">{s.val}</p>
                    <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </LayoutWrapperBlock>
        );

        if (blockId === 'charts') return (
          <LayoutWrapperBlock key="charts" id="charts">
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-primary" /> Task Status</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={taskBar} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {taskBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4"><AlertCircle className="w-4 h-4 text-orange-400" /> Ticket Breakdown</h2>
                {ticketPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={ticketPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {ticketPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-12">No tickets yet</p>}
              </div>
            </div>
          </LayoutWrapperBlock>
        );

        if (blockId === 'workload') return (
          <LayoutWrapperBlock key="workload" id="workload">
            {/* Workload + Team */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Workload Distribution */}
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-violet-400" /> Workload Distribution</h2>
                {workloads.length > 0 ? (
                  <div className="space-y-3">
                    {workloads.map(w => {
                      const max = Math.max(...workloads.map(x => x.tasks));
                      const pct = max > 0 ? (w.tasks / max) * 100 : 0;
                      return (
                        <div key={w.name} className="flex items-center gap-3">
                          <span className="text-xs text-foreground w-24 truncate font-medium">{w.name}</span>
                          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all flex items-center pl-2" style={{ width: `${pct}%` }}>
                              <span className="text-[10px] text-white font-bold">{w.tasks}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No tasks assigned yet</p>}
              </div>

              {/* Team Members */}
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-primary" /> Team Members</h2>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {teamMembers.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold border border-primary/20 flex-shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.role}</p>
                      </div>
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'Active' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                        <span className="text-[10px] text-muted-foreground">{m.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </LayoutWrapperBlock>
        );

        if (blockId === 'heatmap') return (
          <LayoutWrapperBlock key="heatmap" id="heatmap">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl border p-5 flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" /> 30-Day Workload Heatmap
                </h2>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">Based on daily ticket & task activity</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mt-2 overflow-x-auto pb-2 custom-scrollbar">
                {(() => {
                  const days = [];
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); // Normalize to local midnight
                  
                  // Local utility to format YYYY-MM-DD
                  const formatYMD = (d: Date) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  };

                  // Make a map of dates from analytics for O(1) lookup
                  const heatmapMap = new Map();
                  heatmap.forEach(item => heatmapMap.set(item.log_date, item));

                  for (let i = 29; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const dateStr = formatYMD(d);
                    const stat = heatmapMap.get(dateStr);
                    
                    let opacity = 'opacity-10';
                    if (stat && stat.count > 0) {
                      if (stat.intensity_score > 50) opacity = 'opacity-100'; 
                      else if (stat.intensity_score > 30) opacity = 'opacity-80'; 
                      else if (stat.intensity_score > 10) opacity = 'opacity-60'; 
                      else opacity = 'opacity-40';
                    }

                    const tooltipText = stat 
                      ? `${dateStr}: ${stat.count} items completed\n${stat.items?.join('\n') || ''}`.trim()
                      : `${dateStr}: 0 items completed`;

                    days.push(
                      <div 
                        key={dateStr}
                        title={tooltipText}
                        className={`w-12 h-14 sm:w-14 sm:h-16 shrink-0 rounded-[6px] border border-black/10 flex flex-col items-center justify-center bg-emerald-500 ${opacity} transition-all hover:opacity-100 hover:-translate-y-1 cursor-help ring-1 ring-inset ring-emerald-500/20`}
                      >
                        <span className="text-[10px] font-bold text-white/90 mb-1">{new Date(dateStr).getDate()}</span>
                        {stat && stat.count > 0 && (
                          <span className="text-[11px] font-black text-white">{stat.count}</span>
                        )}
                      </div>
                    );
                  }
                  return days;
                })()}
              </div>
              <div className="mt-4 flex items-center justify-start gap-2 text-[10px] text-muted-foreground font-medium pt-3 border-t border-border/40">
                <span>Less active</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-[3px] bg-emerald-500 opacity-10"></div>
                  <div className="w-3 h-3 rounded-[3px] bg-emerald-500 opacity-40"></div>
                  <div className="w-3 h-3 rounded-[3px] bg-emerald-500 opacity-60"></div>
                  <div className="w-3 h-3 rounded-[3px] bg-emerald-500 opacity-80"></div>
                  <div className="w-3 h-3 rounded-[3px] bg-emerald-500 opacity-100"></div>
                </div>
                <span>More active</span>
              </div>
            </div>
          </LayoutWrapperBlock>
        );

        if (blockId === 'activityWorkflow') return (
          <LayoutWrapperBlock key="activityWorkflow" id="activityWorkflow">
            {/* Activity + Workflow Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-primary" /> Recent Activity</h2>
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {recentLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>}
                  {recentLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${actionStyle(log.action)}`}>{log.action}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{log.details}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {log.user_name} · {log.module} · {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflow Guide */}
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold text-foreground mb-4">📋 IT Workflow</h2>
                <div className="space-y-3">
                  {[
                    { step: '1', label: 'Ticket masuk', desc: 'Job request dari user/department' },
                    { step: '2', label: 'Create Task', desc: 'Dari ticket → assign ke team' },
                    { step: '3', label: 'Daily Log', desc: 'Auto-recorded dari ticket/task' },
                    { step: '4', label: 'Project', desc: 'Link tasks & schedules' },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold border border-primary/20 flex-shrink-0">{s.step}</div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 p-2 rounded-lg text-[10px] text-muted-foreground" style={{ background: 'var(--muted)' }}>
                  <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span>Ticket → Task → Daily Log (auto-synced)</span>
                </div>
              </div>
            </div>
          </LayoutWrapperBlock>
        );

        return null;
      })}

    </div>
  );
}
