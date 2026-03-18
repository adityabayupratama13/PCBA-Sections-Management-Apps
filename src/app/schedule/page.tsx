'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Edit2, Trash2, List } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { addDays, startOfWeek, format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

type ScheduleType = 'Meeting' | 'Maintenance' | 'On-Call' | 'Training' | 'Deployment' | 'Other' | 'Project';
type Recurrence = 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type ViewMode = 'week' | 'month' | 'year';

interface ScheduleItem {
  id: number;
  title: string;
  type: ScheduleType;
  recurrence: Recurrence;
  day: number;           // 1-5 for weekly (Mon-Fri), 0 for non-weekly
  date: string;          // ISO date for 'once', empty for recurring
  end_date?: string;     // ISO end date for 'once' date range
  dayOfMonth: number;    // 1-31 for monthly
  monthOfYear: number;   // 0-11 for yearly
  startTime: string;
  endTime: string;
  assignee: string;
}



const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DbSchedule { id: number; title: string; type: string; recurrence: string; day: number; date: string; end_date: string; day_of_month: number; month_of_year: number; start_time: string; end_time: string; assignee: string; }
const mapFromDb = (s: DbSchedule): ScheduleItem => ({ id: s.id, title: s.title, type: s.type as ScheduleType, recurrence: s.recurrence as Recurrence, day: s.day, date: s.date, end_date: s.end_date, dayOfMonth: s.day_of_month, monthOfYear: s.month_of_year, startTime: s.start_time, endTime: s.end_time, assignee: s.assignee });

export default function SchedulePage() {
  const { data: rawSchedules, create, update: apiUpdate, remove } = useApi<DbSchedule>('schedules');
  const schedules = rawSchedules.map(mapFromDb);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [formRecurrence, setFormRecurrence] = useState<Recurrence>('weekly');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const { currentUser, members } = useAuth();
  const allMembers = [{ name: 'Aditya Bayu Pratama' }, ...members.filter(m => m.name !== 'Aditya Bayu Pratama' && m.member_type !== 'Management')];

  // ─── Week helpers ───
  const getWeekRange = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 4);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };
  const getDayDates = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, i) => format(addDays(start, i), 'd'));
  };
  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const goToday = () => setCurrentDate(new Date());

  // ─── Month helpers ───
  const monthName = format(currentDate, 'MMMM yyyy');
  const daysInCurrMonth = getDaysInMonth(currentDate);
  const firstDayOffset = (getDay(startOfMonth(currentDate)) + 6) % 7; // Monday=0
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // ─── Year helpers ───
  const currentYear = currentDate.getFullYear();
  const prevYear = () => setCurrentDate(new Date(currentYear - 1, currentDate.getMonth(), 1));
  const nextYear = () => setCurrentDate(new Date(currentYear + 1, currentDate.getMonth(), 1));

  // ─── Schedule match helpers ───
  const getSchedulesForWeekDay = (dayIndex: number) => {
    // Get the actual date for this day of the week
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const dayDate = addDays(weekStart, dayIndex);
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const dayOfMonth = dayDate.getDate();
    const month = dayDate.getMonth();
    
    return schedules.filter(s => {
      if (s.recurrence === 'weekly' && s.day === dayIndex + 1) return true;
      if (s.recurrence === 'daily') return true;
      if (s.recurrence === 'one-time') {
        if (!s.end_date) return s.date === dateStr;
        return dateStr >= s.date && dateStr <= s.end_date;
      }
      if (s.recurrence === 'monthly' && s.dayOfMonth === dayOfMonth) return true;
      if (s.recurrence === 'yearly' && s.monthOfYear === month && s.dayOfMonth === dayOfMonth) return true;
      return false;
    });
  };

  const getSchedulesForDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayOfWeek = (d.getDay() + 6) % 7;
    const dayOfMonth = d.getDate();
    const month = d.getMonth();
    return schedules.filter(s => {
      if (s.recurrence === 'one-time') {
        if (!s.end_date) return s.date === dateStr;
        return dateStr >= s.date && dateStr <= s.end_date;
      }
      if (s.recurrence === 'daily') return true;
      if (s.recurrence === 'weekly' && s.day === dayOfWeek + 1) return true;
      if (s.recurrence === 'monthly' && s.dayOfMonth === dayOfMonth) return true;
      if (s.recurrence === 'yearly' && s.monthOfYear === month && s.dayOfMonth === dayOfMonth) return true;
      return false;
    });
  };

  const getScheduleCountForMonth = (month: number) => {
    return schedules.filter(s => {
      if (s.recurrence === 'daily' || s.recurrence === 'weekly') return true;
      if (s.recurrence === 'monthly') return true;
      if (s.recurrence === 'yearly' && s.monthOfYear === month) return true;
      if (s.recurrence === 'one-time') {
        const d = new Date(s.date);
        return d.getMonth() === month && d.getFullYear() === currentYear;
      }
      return false;
    }).length;
  };

  // ─── CRUD ───
  const openAddModal = () => { setEditingSchedule(null); setFormRecurrence('weekly'); setSelectedAssignees([]); setIsModalOpen(true); };
  const openEditModal = (s: ScheduleItem) => { setEditingSchedule(s); setFormRecurrence(s.recurrence); setSelectedAssignees(s.assignee ? s.assignee.split(', ') : []); setIsModalOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success(`Schedule "${deleteTarget.title}" deleted`);
    setDeleteTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const rec = fd.get('recurrence') as Recurrence;
    const payload = {
      title: fd.get('title') as string,
      type: fd.get('type') as string,
      recurrence: rec,
      day: rec === 'weekly' ? Number(fd.get('day')) : 0,
      date: rec === 'one-time' ? (fd.get('date') as string) : '',
      endDate: rec === 'one-time' ? (fd.get('endDate') as string) : '',
      dayOfMonth: (rec === 'monthly' || rec === 'yearly') ? Number(fd.get('dayOfMonth')) : 0,
      monthOfYear: rec === 'yearly' ? Number(fd.get('monthOfYear')) : 0,
      startTime: fd.get('startTime') as string,
      endTime: fd.get('endTime') as string,
      assignee: selectedAssignees.join(', '),
      userName: currentUser?.name || 'System',
    };
    if (editingSchedule) {
      await apiUpdate({ id: editingSchedule.id, ...payload } as unknown as DbSchedule & Record<string, unknown>);
      toast.success(`Schedule "${payload.title}" updated`);
    } else {
      await create(payload as unknown as Partial<DbSchedule> & Record<string, unknown>);
      toast.success(`Schedule "${payload.title}" created`);
    }
    setIsModalOpen(false);
  };

  const getTypeStyles = (type: ScheduleType) => {
    switch (type) {
      case 'Meeting':     return { bg: '#2563EB', text: '#ffffff', border: 'rgba(37,99,235,0.5)' };
      case 'Maintenance': return { bg: '#EA580C', text: '#ffffff', border: 'rgba(234,88,12,0.5)' };
      case 'On-Call':     return { bg: '#7C3AED', text: '#ffffff', border: 'rgba(124,58,237,0.5)' };
      case 'Training':    return { bg: '#0D9488', text: '#ffffff', border: 'rgba(13,148,136,0.5)' };
      case 'Deployment':  return { bg: '#0891B2', text: '#ffffff', border: 'rgba(8,145,178,0.5)' };
      case 'Project':     return { bg: '#10B981', text: '#000000', border: 'rgba(16,185,129,0.6)' };
      case 'Other':       return { bg: '#64748B', text: '#ffffff', border: 'rgba(100,116,139,0.5)' };
      default:            return { bg: 'var(--surface-2)', text: 'var(--foreground)', border: 'var(--border)' };
    }
  };

  const calculatePosition = (startTime: string, endTime: string) => {
    const startHour = parseInt(startTime.split(':')[0], 10);
    const endHour = parseInt(endTime.split(':')[0], 10);
    const relStart = Math.max(0, startHour - 8);
    let relEnd = endHour - 8;
    if (endHour < startHour) relEnd = 16;
    if (relEnd > 15) relEnd = 15;
    if (startHour < 8 || startHour >= 22) return { bottom: 0, height: '60px', isOutlier: true };
    const startPx = relStart * 64;
    const heightPx = Math.max(0.5, (relEnd - relStart)) * 64;
    return { top: `${startPx}px`, height: `${heightPx}px`, isOutlier: false };
  };

  const recurrenceLabel = (s: ScheduleItem) => {
    switch (s.recurrence) {
      case 'one-time': return `Once (${s.date})`;
      case 'daily': return 'Daily';
      case 'weekly': return `Weekly (${DAYS[s.day - 1]})`;
      case 'monthly': return `Monthly (Day ${s.dayOfMonth})`;
      case 'yearly': return `Yearly (${MONTHS[s.monthOfYear]} ${s.dayOfMonth})`;
    }
  };

  const dates = getDayDates();

  // ─── Legend ───
  const Legend = () => (
    <div className="flex gap-4 p-3 border-b border-border flex-shrink-0 text-sm overflow-x-auto" style={{ background: 'var(--muted)' }}>
      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" /><span className="text-muted-foreground font-medium">Meeting</span></div>
      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" /><span className="text-muted-foreground font-medium">Maintenance</span></div>
      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]" /><span className="text-muted-foreground font-medium">On-Call</span></div>
      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" /><span className="text-muted-foreground font-medium">Project</span></div>
    </div>
  );

  // ─── Schedule card (for monthly/yearly) ───
  const ScheduleChip = ({ s }: { s: ScheduleItem }) => {
    const st = getTypeStyles(s.type);
    return (
      <div className="text-[10px] truncate px-1.5 py-0.5 rounded font-medium group/chip relative cursor-pointer"
        style={{ background: `${st.bg}20`, color: st.bg, border: `1px solid ${st.border}` }}
        title={`${s.title} (${s.startTime}-${s.endTime}) · ${s.assignee}`}
      >
        {s.title}
        <div className="absolute top-0 right-0 hidden group-hover/chip:flex gap-0.5 z-20">
          <button onClick={(e) => { e.stopPropagation(); openEditModal(s); }} className="p-0.5 bg-white/90 dark:bg-black/60 rounded"><Edit2 className="w-2.5 h-2.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }} className="p-0.5 bg-white/90 dark:bg-black/60 rounded text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
        </div>
      </div>
    );
  };

  // ─── Navigation controls ───
  const NavigationBar = () => (
    <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          {viewMode === 'week' && getWeekRange()}
          {viewMode === 'month' && monthName}
          {viewMode === 'year' && String(currentYear)}
        </h2>
        <button onClick={goToday} className="text-xs bg-gray-100 dark:bg-background border border-border px-2.5 py-1 rounded-md text-foreground hover:bg-gray-200 dark:hover:bg-white/5 transition-colors">Today</button>
      </div>
      <div className="flex items-center gap-3">
        {/* View mode toggle */}
        <div className="flex rounded-lg p-0.5 gap-0.5 border" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
          {(['week', 'month', 'year'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                viewMode === mode ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        {/* Prev/Next */}
        <div className="flex items-center gap-1 rounded-lg p-0.5 border" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
          <button onClick={() => { if (viewMode === 'week') prevWeek(); else if (viewMode === 'month') prevMonth(); else prevYear(); }}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md transition-colors text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { if (viewMode === 'week') nextWeek(); else if (viewMode === 'month') nextMonth(); else nextYear(); }}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md transition-colors text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );

  // ─── WEEKLY VIEW (existing) ───
  const WeeklyView = () => (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-16 border-r border-border flex-shrink-0 overflow-hidden relative" style={{ background: 'var(--muted)' }}>
        <div className="h-10 border-b border-border" style={{ background: 'var(--surface)' }} />
        <div className="absolute top-10 left-0 right-0 bottom-0 overflow-y-auto custom-scrollbar overflow-x-hidden pr-2">
          {HOURS.map(hour => (
            <div key={hour} className="h-16 text-xs text-muted-foreground text-right pr-2 -mt-2">
              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
          ))}
          <div className="h-16 text-xs text-muted-foreground text-right pr-2 mt-4 font-bold border-t border-border/50 pt-2">Night</div>
        </div>
      </div>
      <div className="flex-1 flex overflow-x-auto custom-scrollbar relative">
        {DAYS.slice(0, 5).map((day, dayIndex) => {
          const daySchedules = getSchedulesForWeekDay(dayIndex);
          return (
            <div key={day} className="flex-1 min-w-[150px] border-r border-border/50 last:border-0 relative flex flex-col">
              <div className="h-10 flex flex-col items-center justify-center border-b border-border sticky top-0 z-10 flex-shrink-0" style={{ background: 'var(--surface)' }}>
                <span className="text-xs font-semibold text-foreground">{day}</span>
                <span className="text-[10px] text-muted-foreground">{dates[dayIndex]}</span>
              </div>
              <div className="relative flex-1 h-[calc(16*64px+64px)] w-full overflow-hidden" style={{ background: 'var(--background)' }}>
                {HOURS.map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-border/50 h-[64px]" style={{ top: `${i * 64}px` }} />
                ))}
                {daySchedules.map(schedule => {
                  const pos = calculatePosition(schedule.startTime, schedule.endTime);
                  const st = getTypeStyles(schedule.type);
                  const content = (
                    <>
                      <div className="font-semibold truncate leading-tight group-hover:text-foreground">{schedule.title}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{schedule.startTime}-{schedule.endTime}</div>
                      <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(schedule); }} className="p-0.5 bg-white/80 dark:bg-black/40 rounded hover:bg-white dark:hover:bg-black/60"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(schedule); }} className="p-0.5 bg-white/80 dark:bg-black/40 rounded hover:bg-white dark:hover:bg-black/60 text-destructive"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </>
                  );
                  if (pos.isOutlier) {
                    return (
                      <div key={schedule.id}
                        className="absolute left-1 right-1 rounded-lg p-1.5 shadow-md text-xs group cursor-pointer transition-all hover:opacity-90 hover:shadow-lg"
                        style={{ top: 'calc(100% - 60px)', height: '54px', background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
                        title={`${schedule.title} (${schedule.startTime} - ${schedule.endTime})`}>{content}</div>
                    );
                  }
                  return (
                    <div key={schedule.id}
                      className="absolute left-1 right-1 rounded-lg p-1.5 shadow-md overflow-hidden text-xs group cursor-pointer transition-all hover:opacity-90 hover:shadow-lg z-10"
                      style={{ top: pos.top, height: pos.height, background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
                      title={`${schedule.title} (${schedule.startTime} - ${schedule.endTime})\nAssignee: ${schedule.assignee}`}>
                      {content}
                      {parseFloat(pos.height as string) > 60 && <div className="text-[10px] opacity-80 truncate mt-1">👤 {schedule.assignee}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── MONTHLY VIEW ───
  const MonthlyView = () => {
    const formatDateStr = (day: number) => {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    const todayStr = new Date().toISOString().split('T')[0];
    return (
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <div className="min-w-[700px] grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={{ background: 'var(--muted)' }}>{d}</div>
          ))}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`e-${i}`} className="min-h-[100px] opacity-30" style={{ background: 'var(--background)' }} />
          ))}
          {Array.from({ length: daysInCurrMonth }).map((_, i) => {
            const dateStr = formatDateStr(i + 1);
            const daySchedules = getSchedulesForDate(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <div key={i} className="min-h-[100px] p-1.5 group" style={{ background: 'var(--surface)' }}>
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-white' : 'text-muted-foreground group-hover:text-foreground'}`}>{i + 1}</span>
                  {daySchedules.length > 0 && (
                    <span className="text-[9px] bg-primary/15 text-primary px-1 py-0.5 rounded font-bold">{daySchedules.length}</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {daySchedules.slice(0, 3).map(s => <ScheduleChip key={s.id} s={s} />)}
                  {daySchedules.length > 3 && <div className="text-[9px] text-muted-foreground pl-1">+{daySchedules.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── YEARLY VIEW ───
  const YearlyView = () => (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MONTHS.map((month, idx) => {
          const count = getScheduleCountForMonth(idx);
          const isCurrentMonth = idx === new Date().getMonth() && currentYear === new Date().getFullYear();
          return (
            <button
              key={month}
              onClick={() => { setCurrentDate(new Date(currentYear, idx, 1)); setViewMode('month'); }}
              className={`rounded-xl p-4 border text-left transition-all hover:border-primary/40 hover:shadow-md group ${isCurrentMonth ? 'ring-2 ring-primary/30' : ''}`}
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-sm font-bold ${isCurrentMonth ? 'text-primary' : 'text-foreground'}`}>{month}</span>
                {count > 0 && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold border border-primary/20">{count}</span>
                )}
              </div>
              {/* Mini calendar grid */}
              <div className="grid grid-cols-7 gap-px text-[8px] text-muted-foreground">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="text-center font-semibold opacity-50">{d}</div>)}
                {(() => {
                  const firstDay = (getDay(new Date(currentYear, idx, 1)) + 6) % 7;
                  const dim = getDaysInMonth(new Date(currentYear, idx));
                  return (
                    <>
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: dim }).map((_, i) => {
                        const dateStr = `${currentYear}-${String(idx + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                        const hasEvent = getSchedulesForDate(dateStr).length > 0;
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        return (
                          <div key={i} className={`text-center rounded-sm ${isToday ? 'bg-primary text-white font-bold' : hasEvent ? 'bg-primary/20 text-primary font-bold' : ''}`}>
                            {i + 1}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── All Schedules List ───
  const SchedulesList = () => (
    <div className="p-4 border-t border-border">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><List className="w-4 h-4 text-primary" /> All Schedules ({schedules.length})</h3>
      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
        {schedules.map(s => {
          const st = getTypeStyles(s.type);
          return (
            <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-colors group">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: st.bg }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{s.title}</span>
                <span className="text-xs text-muted-foreground ml-2">{recurrenceLabel(s)} · {s.startTime}–{s.endTime} · {s.assignee}</span>
              </div>
              <div className="hidden group-hover:flex gap-1">
                <button onClick={() => openEditModal(s)} className="p-1 text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteTarget(s)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground mt-1">Manage meetings, maintenance, and on-call rotations</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add Schedule
        </button>
      </div>

      <div className="rounded-2xl border flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <NavigationBar />
        <Legend />
        <div className="flex-1 overflow-auto">
          {viewMode === 'week' && <WeeklyView />}
          {viewMode === 'month' && <MonthlyView />}
          {viewMode === 'year' && <YearlyView />}
        </div>
        {(viewMode === 'month' || viewMode === 'year') && <SchedulesList />}
      </div>

      {/* ─── Add/Edit Modal ─── */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setShowAssigneeDropdown(false); }} title={editingSchedule ? 'Edit Schedule' : 'Add Schedule'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Schedule Title *</label>
            <input name="title" required defaultValue={editingSchedule?.title} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all invalid:border-destructive" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Type</label>
              <select name="type" defaultValue={editingSchedule?.type || 'Meeting'} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer">
                <option value="Meeting">Meeting</option>
                <option value="Maintenance">Maintenance</option>
                <option value="On-Call">On-Call Support</option>
                <option value="Training">Training</option>
                <option value="Deployment">Deployment</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Recurrence</label>
              <select name="recurrence" value={formRecurrence} onChange={e => setFormRecurrence(e.target.value as Recurrence)}
                className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer">
                <option value="one-time">One-Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {formRecurrence === 'one-time' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Start Date *</label>
                <input name="date" type="date" required defaultValue={editingSchedule?.date || new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">End Date</label>
                <input name="endDate" type="date" defaultValue={editingSchedule?.end_date || editingSchedule?.date || ''}
                  className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
              </div>
            </div>
          )}
          {formRecurrence === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Day of Week</label>
              <select name="day" defaultValue={editingSchedule?.day || 1}
                className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer">
                {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </div>
          )}
          {formRecurrence === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Day of Month</label>
              <input name="dayOfMonth" type="number" min="1" max="31" required defaultValue={editingSchedule?.dayOfMonth || 1}
                className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
          )}
          {formRecurrence === 'yearly' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Month</label>
                <select name="monthOfYear" defaultValue={editingSchedule?.monthOfYear || 0}
                  className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Day</label>
                <input name="dayOfMonth" type="number" min="1" max="31" required defaultValue={editingSchedule?.dayOfMonth || 1}
                  className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Start Time *</label>
              <input name="startTime" type="time" defaultValue={editingSchedule?.startTime || '09:00'} required className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">End Time *</label>
              <input name="endTime" type="time" defaultValue={editingSchedule?.endTime || '10:00'} required className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>

          {/* Multi-select Assignee */}
          <div className="relative">
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Assignee(s) *</label>
            <div
              onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
              className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground cursor-pointer min-h-[42px] flex flex-wrap gap-1 items-center"
            >
              {selectedAssignees.length === 0 && <span className="text-muted-foreground text-sm">Select team members...</span>}
              {selectedAssignees.map(a => (
                <span key={a} className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/25 font-medium flex items-center gap-1">
                  {a}
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); setSelectedAssignees(prev => prev.filter(x => x !== a)); }}
                    className="hover:text-destructive">×</button>
                </span>
              ))}
            </div>
            {showAssigneeDropdown && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border shadow-lg max-h-48 overflow-y-auto custom-scrollbar" style={{ background: 'var(--surface)' }}>
                {allMembers.filter(m => (m as { status?: string }).status !== 'Inactive').map(m => (
                  <label key={m.name} className="flex items-center gap-2 px-3 py-2 hover:bg-primary/5 cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedAssignees.includes(m.name)}
                      onChange={() => setSelectedAssignees(prev => prev.includes(m.name) ? prev.filter(x => x !== m.name) : [...prev, m.name])}
                      className="rounded border-border" />
                    <span className="text-foreground">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button type="button" onClick={() => { setIsModalOpen(false); setShowAssigneeDropdown(false); }} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">{editingSchedule ? 'Save Changes' : 'Add Schedule'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Schedule" message={`Are you sure you want to delete "${deleteTarget?.title}"?`} />
    </div>
  );
}
