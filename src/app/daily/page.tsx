'use client';
import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, Edit2, Trash2, Ticket } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

interface DailyLog {
  id: number;
  date: string;
  member: string;
  activity: string;
  hours: number;
  location: string;
  source: string;
}

export default function DailyLogPage() {
  const { data: logs, loading, create, update, remove } = useApi<DailyLog>('daily-logs');
  const [currentDate, setCurrentDate] = useState(new Date('2026-03-11'));
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DailyLog | null>(null);
  const { currentUser } = useAuth();

  const getDaysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const formatMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const filteredLogs = selectedDateFilter ? logs.filter(l => l.date === selectedDateFilter) : logs;

  const openAddModal = () => { setEditingLog(null); setIsModalOpen(true); };
  const openEditModal = (log: DailyLog) => { setEditingLog(log); setIsModalOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success('Daily log deleted');
    setDeleteTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const payload = {
      date: formData.get('date') as string,
      member: formData.get('member') as string,
      activity: formData.get('activity') as string,
      hours: Number(formData.get('hours')),
      location: formData.get('location') as string,
      source: 'manual',
      userName: currentUser?.name || 'System',
    };
    if (editingLog) {
      await update({ id: editingLog.id, ...payload } as DailyLog & Record<string, unknown>);
      toast.success('Daily log updated');
    } else {
      await create(payload as Partial<DailyLog> & Record<string, unknown>);
      toast.success('Daily log added');
    }
    setIsModalOpen(false);
  };

  const columns = [
    {
      header: 'Date',
      accessor: (log: DailyLog) => new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      className: 'whitespace-nowrap'
    },
    {
      header: 'Member',
      accessor: (log: DailyLog) => <span className="font-medium text-foreground">{log.member}</span>
    },
    {
      header: 'Activity Description',
      accessor: (log: DailyLog) => (
        <div className="flex items-center gap-2 max-w-md">
          {log.source === 'ticket' && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/25 whitespace-nowrap flex-shrink-0">
              <Ticket className="w-2.5 h-2.5" /> Ticket
            </span>
          )}
          <span className="truncate">{log.activity}</span>
        </div>
      ),
      className: 'max-w-md'
    },
    {
      header: 'Hours',
      accessor: (log: DailyLog) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {log.hours > 0 ? `${log.hours}h` : '—'}
        </span>
      )
    },
    {
      header: 'Location',
      accessor: (log: DailyLog) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          {log.location}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (log: DailyLog) => (
        <div className="flex items-center gap-3">
          <button onClick={() => openEditModal(log)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteTarget(log)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  // Calendar data
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const dayLogs = logs.filter(l => l.date === dateStr);
    return { day: i + 1, dateStr, count: dayLogs.length, totalHours: dayLogs.reduce((s, l) => s + l.hours, 0) };
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daily Job Log</h1>
          <p className="text-muted-foreground mt-1">Track daily activities by team members</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Log
        </button>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: 'var(--muted)' }}>
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/5 transition-colors text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
          <h3 className="text-sm font-semibold text-foreground">{formatMonth(currentDate)}</h3>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/5 transition-colors text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 text-center py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="h-20 border-b border-r border-border/30" />)}
          {calendarDays.map(cd => (
            <button key={cd.day} onClick={() => setSelectedDateFilter(selectedDateFilter === cd.dateStr ? null : cd.dateStr)}
              className={`h-20 border-b border-r border-border/30 p-1.5 text-left hover:bg-primary/5 transition-colors ${selectedDateFilter === cd.dateStr ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}>
              <span className={`text-xs font-medium ${cd.count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{cd.day}</span>
              {cd.count > 0 && (
                <div className="mt-1">
                  <div className="text-[9px] bg-primary/15 text-primary px-1 py-0.5 rounded font-bold inline-block">{cd.count} logs</div>
                  {cd.totalHours > 0 && <div className="text-[9px] text-muted-foreground mt-0.5">{cd.totalHours}h</div>}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedDateFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtered:</span>
          <span className="text-sm font-medium text-foreground">{new Date(selectedDateFilter).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <button onClick={() => setSelectedDateFilter(null)} className="text-xs text-primary hover:underline">Clear</button>
        </div>
      )}

      <DataTable data={filteredLogs} columns={columns} />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLog ? 'Edit Daily Log' : 'Add Daily Log'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Date *</label>
              <input name="date" type="date" required defaultValue={editingLog?.date || new Date().toISOString().split('T')[0]} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Member *</label>
              <input name="member" required defaultValue={editingLog?.member} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all invalid:border-destructive" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Activity Description *</label>
            <textarea name="activity" required defaultValue={editingLog?.activity} rows={3} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none invalid:border-destructive" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Hours</label>
              <input name="hours" type="number" min="0" max="24" step="0.5" defaultValue={editingLog?.hours || 0} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Location</label>
              <select name="location" defaultValue={editingLog?.location || 'Office'} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
                {['Office', 'WFH', 'Server Room', 'Branch B', 'On-site'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">{editingLog ? 'Save Changes' : 'Add Log'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Log" message="Are you sure you want to delete this log entry?" />
    </div>
  );
}
