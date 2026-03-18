'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Clock, FileText, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Search, User, Download, Edit, Trash2, Users } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { format, addDays, startOfWeek, subMonths, setDate, isWithinInterval, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { canManageAttendanceAdmin } from '@/lib/permissions';
import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
interface AttendanceLog { id: number; member_name: string; date: string; shift: string; ot_start_time?: string; ot_end_time?: string; overtime_hours: number; overtime_desc: string; [key: string]: unknown; }
interface LeaveReq { id: number; member_name: string; leave_type: string; application_date: string; start_date: string; end_date: string; days_count: number; reason: string; status: string; approved_by: string; userName?: string; [key: string]: unknown; }
interface LeaveBalance { id: string | number; member_name: string; balance: number; last_accrual_month: string; [key: string]: unknown; }

const SHIFT_OPTIONS = ['Normal Shift', 'Shift 1', 'Shift 2', 'Shift 3', 'Off', 'Leave'];
const LEAVE_TYPES = ['Annual Leave', 'Compassionate Leave', 'Maternity Leave', 'Paternity Leave', 'Marriage Leave', 'No Pay Leave'];
const ID_HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-01-16': "Isra Mi'raj",
  '2026-02-17': "Chinese New Year",
  '2026-03-19': "Nyepi (Balinese Day of Silence)",
  '2026-03-21': "Idul Fitri Day 1",
  '2026-03-22': "Idul Fitri Day 2",
  '2026-04-03': "Good Friday",
  '2026-04-05': "Easter Sunday",
  '2026-05-01': "Labour Day",
  '2026-05-14': "Ascension of Jesus Christ",
  '2026-05-27': "Eid al-Adha",
  '2026-05-31': "Vesak Day",
  '2026-06-01': "Pancasila Day",
  '2026-06-16': "Islamic New Year",
  '2026-08-17': "Independence Day",
  '2026-08-25': "Prophet Muhammad's Birthday",
  '2026-12-25': "Christmas Day"
};

export default function AttendancePage() {
  const { currentUser, members } = useAuth();
  const isManager = canManageAttendanceAdmin(currentUser);
  
  // API Data
  const { data: logs, refetch: fetchLogs, create: createLog } = useApi<AttendanceLog>('attendance');
  const { data: leaves, refetch: fetchLeaves, create: createLeave, update: updateLeave } = useApi<LeaveReq>('leaves');
  const { data: balances, refetch: fetchBalances, update: updateBalance } = useApi<LeaveBalance>('leave-balances');
  
  // Refresh on mount
  useEffect(() => { fetchLogs(); fetchLeaves(); fetchBalances(); }, [fetchLogs, fetchLeaves, fetchBalances]);
  
  const [activeTab, setActiveTab] = useState<'roster' | 'overtime' | 'leave' | 'employee-status'>('roster');
  
  // Tab 1: Roster State
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const rosterDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [savingShift, setSavingShift] = useState(false);
  
  // Tab 2: Overtime State
  const [otMonthOffset, setOtMonthOffset] = useState(0); // 0 = Current Cut-off
  const [otSearch, setOtSearch] = useState('');
  const [selectedOtMember, setSelectedOtMember] = useState<string | null>(null);
  const [isOtModalOpen, setIsOtModalOpen] = useState(false);
  const [editingOtLog, setEditingOtLog] = useState<Partial<AttendanceLog> | null>(null);
  
  // Tab 3: Leave State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [editingBalanceMember, setEditingBalanceMember] = useState('');
  const [editingLeaveLog, setEditingLeaveLog] = useState<LeaveReq | null>(null);
  const [viewingLeave, setViewingLeave] = useState<LeaveReq | null>(null);
  const [deleteLeaveId, setDeleteLeaveId] = useState<number | null>(null);
  const [deleteOtLog, setDeleteOtLog] = useState<AttendanceLog | null>(null);
  
  // Tab 4: Employee Status State
  const [isEmpStatusModalOpen, setIsEmpStatusModalOpen] = useState(false);
  const [editingEmpStatus, setEditingEmpStatus] = useState<typeof members[0] | null>(null);
  const { updateMember } = useAuth();
  
  const handleShiftChange = async (memberName: string, date: string, newShift: string) => {
    if (newShift === 'Leave') {
      const existing = leaves.find(l => l.member_name === memberName && l.status === 'Approved' && date >= l.start_date && date <= l.end_date);
      if (!existing) {
        toast.error('Apply cuti melalui tab "Leave Management" terlebih dahulu. Sistem akan otomatis mengisi roster saat di-Approve.');
        return;
      }
    }
    setSavingShift(true);
    try {
      await createLog({ member_name: memberName, date, shift: newShift, userName: currentUser?.name || '' } as unknown as AttendanceLog);
      toast.success(`Shift updated for ${memberName}`);
      fetchLogs();
    } catch {
      toast.error('Failed to update shift');
    } finally {
      setSavingShift(false);
    }
  };

  const handleCopyMonday = async (memberName: string) => {
    const mondayStr = format(rosterDates[0], 'yyyy-MM-dd');
    const mondayShift = logs.find(l => l.member_name === memberName && l.date === mondayStr)?.shift;
    if (!mondayShift || mondayShift === 'Off' || mondayShift === 'Leave') {
      return toast.error('Set a valid active shift on Monday first!');
    }
    setSavingShift(true);
    try {
      for (let i = 1; i < 7; i++) {
        const dateStr = format(rosterDates[i], 'yyyy-MM-dd');
        const shiftToAssign = ID_HOLIDAYS[dateStr] ? 'Off' : mondayShift;
        await createLog({ member_name: memberName, date: dateStr, shift: shiftToAssign, userName: currentUser?.name || '' } as unknown as AttendanceLog);
      }
      toast.success(`Copied Monday's shift for ${memberName}`);
      fetchLogs();
    } catch { toast.error('Failed to copy shift'); }
    finally { setSavingShift(false); }
  };
  
  const handleAutoRotateNextWeek = async () => {
    setSavingShift(true);
    let count = 0;
    try {
      const nextWeekMonday = addDays(weekStart, 7);
      for (const m of members) {
        if (m.status !== 'Active') continue;
        const isAnalyst = m.role.includes('Analyst & Support');
        
        const thisMondayStr = format(rosterDates[0], 'yyyy-MM-dd');
        const currentShift = logs.find(l => l.member_name === m.name && l.date === thisMondayStr)?.shift;
        
        if (isAnalyst && currentShift && currentShift.includes('Shift')) {
          let nextShift = 'Shift 1';
          if (currentShift === 'Shift 1') nextShift = 'Shift 3';
          else if (currentShift === 'Shift 3') nextShift = 'Shift 2';
          else if (currentShift === 'Shift 2') nextShift = 'Shift 1';
          
          for (let i = 0; i < 7; i++) {
            const dateStr = format(addDays(nextWeekMonday, i), 'yyyy-MM-dd');
            const shiftToAssign = ID_HOLIDAYS[dateStr] ? 'Off' : nextShift;
            await createLog({ member_name: m.name, date: dateStr, shift: shiftToAssign, userName: currentUser?.name || '' } as unknown as AttendanceLog);
          }
          count++;
        } else if (!isAnalyst) {
          // Default to Normal Shift for non-analysts
          for (let i = 0; i < 7; i++) {
            const dateStr = format(addDays(nextWeekMonday, i), 'yyyy-MM-dd');
            const shiftToAssign = ID_HOLIDAYS[dateStr] ? 'Off' : 'Normal Shift';
            await createLog({ member_name: m.name, date: dateStr, shift: shiftToAssign, userName: currentUser?.name || '' } as unknown as AttendanceLog);
          }
          count++;
        }
      }
      toast.success(`Auto-rotated shifts for ${count} staff next week.`);
      setWeekStart(nextWeekMonday);
      fetchLogs();
    } catch { toast.error('Error auto-rotating shifts'); }
    finally { setSavingShift(false); }
  };

  // --- Export Helpers ---
  const exportToExcel = (data: Record<string, unknown>[], filename: string) => {
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
    xlsx.writeFile(wb, `${filename}.xlsx`);
  };

  const exportToPdf = (headers: string[], data: (string | number)[][], filename: string, title: string) => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 22);
    autoTable(doc, { head: [headers], body: data, startY: 28, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] } });
    doc.save(`${filename}.pdf`);
  };

  const exportRoster = (type: 'excel' | 'pdf') => {
    const datesHeader = rosterDates.map(d => format(d, 'dd MMM'));
    const headers = ['Team Member', 'Role', ...datesHeader];
    const dataObj = members.filter(m => m.status === 'Active').map(m => {
      const row: Record<string, string | number> = { 'Team Member': m.name, 'Role': m.role };
      rosterDates.forEach(d => { row[format(d, 'dd MMM')] = (logs.find(l => l.member_name === m.name && l.date === format(d, 'yyyy-MM-dd'))?.shift || 'Off') as string; });
      return row;
    });
    if (type === 'excel') exportToExcel(dataObj, `Shift_Roster_${format(weekStart, 'MMM_dd_yyyy')}`);
    else exportToPdf(headers, dataObj.map((obj: Record<string, string | number>) => headers.map(h => obj[h] || '')), `Shift_Roster_${format(weekStart, 'MMM_dd_yyyy')}`, 'Weekly Shift Roster');
  };

  const RosterTab = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">Weekly Shift Roster</h3>
          <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
             <button onClick={() => exportRoster('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> Excel</button>
             <button onClick={() => exportRoster('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> PDF</button>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg border border-border">
          {isManager && <button onClick={handleAutoRotateNextWeek} className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded shadow-sm mr-2 hover:bg-primary/90 transition-colors" title="Rotate staff shifts 1->2->3->1 for next week">Auto-Rotate (Next Wk)</button>}
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1 hover:bg-background rounded text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium px-2">{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1 hover:bg-background rounded text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-4 py-3 border-r border-border min-w-[150px]">Team Member</th>
              {rosterDates.map(d => {
                const isHoliday = !!ID_HOLIDAYS[format(d, 'yyyy-MM-dd')];
                return (
                  <th key={d.toISOString()} className="px-3 py-3 text-center min-w-[110px] relative">
                    <div className={`font-bold ${isHoliday ? 'text-destructive' : ''}`}>{format(d, 'EEE')}</div>
                    <div className="text-[10px] opacity-70 mb-1">{format(d, 'MMM d')}</div>
                    {isHoliday && (
                      <div className="absolute top-1 right-2 group cursor-help">
                        <div className="w-2 h-2 rounded-full bg-destructive/80 mr-1.5 mt-1"></div>
                        <div className="hidden group-hover:block absolute bottom-full mb-1 right-0 min-w-max bg-foreground text-background text-[10px] px-2 py-1 rounded shadow-lg z-10 whitespace-nowrap">
                          {ID_HOLIDAYS[format(d, 'yyyy-MM-dd')]}
                        </div>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {members.filter(m => m.status === 'Active').map(member => {
              return (
                <tr key={member.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3 border-r border-border">
                    <div className="font-medium text-foreground truncate">{member.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-[10px] text-muted-foreground truncate">{member.role}</div>
                      {isManager && (
                        <button onClick={() => handleCopyMonday(member.name)} className="text-[10px] font-semibold text-primary/80 hover:text-primary transition-colors flex-shrink-0" title="Copy Monday shift to entire week">Copy Wk</button>
                      )}
                    </div>
                  </td>
                  {rosterDates.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const entry = logs.find(l => l.member_name === member.name && l.date === dateStr);
                    const currentVal = entry?.shift || 'Off';
                    return (
                      <td key={dateStr} className="px-2 py-2 text-center border-r border-border/50 last:border-0 relative">
                        <select 
                          value={currentVal}
                          onChange={(e) => handleShiftChange(member.name, dateStr, e.target.value)}
                          disabled={savingShift || !isManager}
                          className={`w-full text-xs py-1.5 px-1 rounded border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer text-center appearance-none
                            ${currentVal === 'Off' ? 'bg-muted/50 text-muted-foreground' : 
                              currentVal === 'Leave' ? 'bg-destructive/10 text-destructive font-medium border-destructive/20' : 
                              currentVal === 'Normal Shift' ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium border-teal-500/20' :
                              currentVal.includes('Shift 1') ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border-blue-500/20' :
                              currentVal.includes('Shift 2') ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium border-orange-500/20' :
                              'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium border-violet-500/20'
                            }`}
                        >
                          {SHIFT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          {currentVal === 'Leave' && !SHIFT_OPTIONS.includes('Leave') && <option value="Leave">Leave</option>}
                        </select>
                        {currentVal === 'Leave' && (
                          <button 
                            onClick={() => {
                              const match = leaves.find(l => l.member_name === member.name && l.status === 'Approved' && dateStr >= l.start_date && dateStr <= l.end_date);
                              if(match) setViewingLeave(match);
                              else toast.info('No corresponding approved leave form found for this date.');
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-destructive hover:bg-destructive/20 p-1 rounded transition-colors"
                            title="View Leave Details"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- Helpers Tab 2: Overtime ---
  const calculateJamHidup = (jamMati: number, role: string) => {
    const r = role.toUpperCase();
    const isMOrS = /S[1-3]|M[1-3]/.test(r) || ['SENIOR', 'SUPERVISOR', 'MANAGER'].some(x => r.includes(x));
    if (isMOrS) return jamMati;
    // Line/Staff calculation: 1.5x for 1st hour, 2.0x remaining
    if (jamMati <= 1) return jamMati * 1.5;
    return 1.5 + ((jamMati - 1) * 2);
  };

  const handleOTSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const dateStr = fd.get('date') as string;
      const mem = fd.get('member_name') as string;
      const start = fd.get('ot_start_time') as string;
      const end = fd.get('ot_end_time') as string;
      
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // if shifted past midnight
      let hours = diff / 60;

      // Saturday deduction (1 hour break time if worked on Sat)
      const dayOfWeek = new Date(dateStr).getDay();
      if (dayOfWeek === 6 && hours > 1) { // 6 = Saturday
        hours -= 1;
      }

      const existingShift = logs.find(l => l.member_name === mem && l.date === dateStr)?.shift || 'Off';
      
      const res = await createLog({
        member_name: mem, 
        date: dateStr, 
        shift: existingShift,
        ot_start_time: start,
        ot_end_time: end,
        overtime_hours: Number(hours.toFixed(2)), 
        overtime_desc: fd.get('reason') as string, 
        userName: currentUser?.name || ''
      } as unknown as AttendanceLog);
      
      if (res) {
        toast.success('Overtime recorded successfully');
        setIsOtModalOpen(false);
        fetchLogs();
      }
    } catch { toast.error('Failed to record overtime'); }
  };
  
  const confirmRemoveOT = async () => {
    if (!deleteOtLog) return;
    try {
      await createLog({ member_name: deleteOtLog.member_name, date: deleteOtLog.date, shift: deleteOtLog.shift, overtime_hours: 0, overtime_desc: '', userName: currentUser?.name || '' } as unknown as AttendanceLog);
      fetchLogs(); toast.success('Overtime removed');
    } catch { toast.error('Error removing OT'); }
    setDeleteOtLog(null);
  };

  const OtTab = () => {
    // Cut-off Logic: 16th of previous month to 15th of current target month
    const currentDate = new Date();
    const isPast15th = currentDate.getDate() >= 16;
    const baseTargetDate = isPast15th ? addMonths(currentDate, 1) : currentDate;
    
    const targetDate = subMonths(baseTargetDate, otMonthOffset);
    const startOfCutoff = setDate(subMonths(targetDate, 1), 16);
    startOfCutoff.setHours(0, 0, 0, 0);
    
    const endOfCutoff = setDate(targetDate, 15);
    endOfCutoff.setHours(23, 59, 59, 999);
    
    // Filter members and compute their OT within this interval
    const stats = members.filter(m => m.status === 'Active' && m.name.toLowerCase().includes(otSearch.toLowerCase())).map(m => {
      let periodOt = 0;
      let periodOtHidup = 0;
      let ytdOt = 0;
      const memberLogs = logs.filter(l => l.member_name === m.name && l.overtime_hours > 0);
      
      memberLogs.forEach(l => {
        const d = new Date(l.date);
        ytdOt += l.overtime_hours;
        if (isWithinInterval(d, { start: startOfCutoff, end: endOfCutoff })) {
          periodOt += l.overtime_hours;
          periodOtHidup += calculateJamHidup(l.overtime_hours, m.role);
        }
      });
      return { member: m, periodOt, periodOtHidup, ytdOt, logsToEdit: memberLogs.filter(l => isWithinInterval(new Date(l.date), { start: startOfCutoff, end: endOfCutoff })) };
    });

    useEffect(() => {
      if (stats.length > 0 && (!selectedOtMember || !stats.find(s => s.member.name === selectedOtMember))) {
        setSelectedOtMember(stats[0].member.name);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stats, selectedOtMember]);

    const exportOt = (type: 'excel' | 'pdf') => {
      const headers = ['Member', 'Role', 'Date & Desc', 'Time Range', 'Jam Mati', 'Jam Hidup'];
      const dataObj: Record<string, string | number>[] = [];
      stats.forEach(s => {
        if (s.logsToEdit.length === 0) return;
        s.logsToEdit.forEach(l => {
          dataObj.push({ 'Member': s.member.name, 'Role': s.member.role, 'Date & Desc': `${l.date} - ${l.overtime_desc}`, 'Time Range': `${l.ot_start_time}-${l.ot_end_time}`, 'Jam Mati': l.overtime_hours, 'Jam Hidup': calculateJamHidup(l.overtime_hours, s.member.role).toFixed(1) });
        });
      });
      if (type === 'excel') exportToExcel(dataObj, `Overtime_Report_${format(endOfCutoff, 'MMM_yyyy')}`);
      else exportToPdf(headers, dataObj.map((obj: Record<string, string | number>) => headers.map(h => obj[h] || '')), `Overtime_Report_${format(endOfCutoff, 'MMM_yyyy')}`, 'Overtime Tracker Report');
    };

    const currentMemberStat = stats.find(s => s.member.name === selectedOtMember) || stats[0];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Clock className="w-5 h-5 text-primary"/> Overtime Tracker</h3>
              <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
                 <button onClick={() => exportOt('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> Excel</button>
                 <button onClick={() => exportOt('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> PDF</button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Detailed calculation including physical vs formulated hours.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input placeholder="Search member..." value={otSearch} onChange={e => setOtSearch(e.target.value)} className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <select value={otMonthOffset} onChange={e => setOtMonthOffset(Number(e.target.value))} className="bg-surface border border-border w-full sm:w-auto rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer">
              {Array.from({ length: 12 }).map((_, i) => {
                const currentDate = new Date();
                const isPast15th = currentDate.getDate() >= 16;
                const baseTargetDate = isPast15th ? addMonths(currentDate, 1) : currentDate;
                return (
                  <option key={i} value={i}>{i === 0 ? 'Current Cut-off' : `Cut-off`} ({format(subMonths(baseTargetDate, i), 'MMM yyyy')})</option>
                );
              })}
            </select>
            <button onClick={() => { setEditingOtLog(null); setIsOtModalOpen(true); }} className="px-4 py-2 w-full sm:w-auto bg-primary text-primary-foreground text-sm font-medium rounded-lg shadow whitespace-nowrap hover:bg-primary/90">
              + Add Overtime
            </button>
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Member Selector */}
          <div className="w-full lg:w-64 flex flex-col gap-2 flex-shrink-0">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground px-2 mb-1">Select Member</h4>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto max-h-[600px] custom-scrollbar pb-2 lg:pb-0">
              {stats.map(s => (
                <button
                  key={s.member.id}
                  onClick={() => setSelectedOtMember(s.member.name)}
                  className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all flex-shrink-0 w-[200px] lg:w-auto
                    ${selectedOtMember === s.member.name 
                      ? 'bg-primary/10 border-primary shadow-sm' 
                      : 'bg-surface border-border hover:bg-muted/50'}`}
                >
                  <div className={`font-semibold text-sm truncate w-full text-left ${selectedOtMember === s.member.name ? 'text-primary' : 'text-foreground'}`}>{s.member.name}</div>
                  <div className="flex justify-between w-full mt-2 items-end">
                    <span className="text-[10px] text-muted-foreground mr-2 truncate">{s.member.role}</span>
                    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5"><span className="text-[8px] font-bold text-muted-foreground uppercase opacity-70">Mati</span><span className={`text-xs font-bold leading-none ${selectedOtMember === s.member.name ? 'text-primary' : 'text-foreground'}`}>{s.periodOt.toFixed(1)}h</span></div>
                      <div className="flex items-center gap-1.5"><span className="text-[8px] font-bold text-muted-foreground uppercase opacity-70">Hidup</span><span className={`text-xs font-bold leading-none ${selectedOtMember === s.member.name ? 'text-primary' : 'text-foreground'}`}>{s.periodOtHidup.toFixed(1)}h</span></div>
                    </div>
                  </div>
                </button>
              ))}
              {stats.length === 0 && <div className="text-xs text-muted-foreground p-2">No members found.</div>}
            </div>
          </div>

          {/* Main Content Table for Selected Member */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {currentMemberStat ? (
                <motion.div
                  key={currentMemberStat.member.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-foreground">{currentMemberStat.member.name}</h4>
                        <p className="text-xs text-muted-foreground">{currentMemberStat.member.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="bg-background border border-border rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[80px]">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total (P) Mati</span>
                        <span className="text-sm font-bold text-foreground">{currentMemberStat.periodOt.toFixed(1)}h</span>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[80px]">
                        <span className="text-[10px] text-primary uppercase font-semibold">Total (P) Hidup</span>
                        <span className="text-sm font-bold text-primary">
                          {currentMemberStat.logsToEdit.reduce((acc, l) => acc + calculateJamHidup(l.overtime_hours, currentMemberStat.member.role), 0).toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                        <tr>
                          <th className="px-5 py-3">Date & Description</th>
                          <th className="px-5 py-3 text-center">Time Range</th>
                          <th className="px-5 py-3 text-center">Jam Mati<br/><span className="lowercase font-normal mt-0.5 text-[9px] block">Actual</span></th>
                          <th className="px-5 py-3 text-center">Jam Hidup<br/><span className="lowercase font-normal mt-0.5 text-[9px] block">Formulated</span></th>
                          {isManager && <th className="px-5 py-3 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {currentMemberStat.logsToEdit.length > 0 ? (
                          currentMemberStat.logsToEdit.map((l, idx) => {
                            const jnHidup = calculateJamHidup(l.overtime_hours, currentMemberStat.member.role);
                            return (
                              <motion.tr 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={l.id} 
                                className="hover:bg-muted/30 transition-colors"
                              >
                                <td className="px-5 py-4 w-[300px]">
                                  <div className="font-medium text-foreground">{format(new Date(l.date), 'EEEE, dd MMM yyyy')}</div>
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2" title={l.overtime_desc}>{l.overtime_desc || 'No reason specified'}</div>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className="bg-background border border-border px-2.5 py-1 rounded text-xs font-mono font-medium shadow-sm">
                                    {l.ot_start_time || '--:--'} - {l.ot_end_time || '--:--'}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-center text-foreground font-semibold">{Number(l.overtime_hours).toFixed(1)}h</td>
                                <td className="px-5 py-4 text-center font-bold text-primary">{jnHidup.toFixed(1)}h</td>
                                {isManager && (
                                  <td className="px-5 py-4 text-right">
                                     <div className="flex justify-end items-center gap-3">
                                       <button onClick={() => { setEditingOtLog(l); setIsOtModalOpen(true); }} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Edit</button>
                                       <button onClick={() => setDeleteOtLog(l)} className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors">Remove</button>
                                     </div>
                                  </td>
                                )}
                              </motion.tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-muted-foreground bg-muted/10">
                              <div className="flex flex-col items-center justify-center">
                                <Clock className="w-8 h-8 opacity-20 mb-3" />
                                <span>No overtime records found in this period.</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-surface border border-border rounded-xl p-10 flex flex-col items-center justify-center text-muted-foreground h-full min-h-[400px]">
                  <User className="w-12 h-12 opacity-20 mb-4" />
                  <p>Select a member from the sidebar to view their overtime details.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };

  // --- Helpers Tab 3: Leave ---
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      if (editingLeaveLog) {
        await updateLeave({
          id: editingLeaveLog.id,
          leave_type: fd.get('leave_type') as string,
          start_date: fd.get('start_date') as string,
          end_date: fd.get('end_date') as string,
          days_count: Number(fd.get('days_count')),
          reason: fd.get('reason') as string,
          userName: currentUser?.name || ''
        });
        toast.success('Leave updated successfully');
      } else {
        await createLeave({
          member_name: fd.get('member_name') as string, leave_type: fd.get('leave_type') as string,
          application_date: new Date().toISOString().split('T')[0], start_date: fd.get('start_date') as string, 
          end_date: fd.get('end_date') as string, days_count: Number(fd.get('days_count')), reason: fd.get('reason') as string,
          userName: currentUser?.name || ''
        });
        toast.success('Leave application submitted');
      }
      setIsLeaveModalOpen(false);
      setEditingLeaveLog(null);
      fetchLeaves();
      fetchBalances(); 
      fetchLogs();
    } catch { toast.error('Failed to submit application'); }
  };
  
  const handleApproveReject = async (id: number, status: string) => {
    try {
      await updateLeave({ id, status, approved_by: currentUser?.name || '', userName: currentUser?.name || '' });
      toast.success(`Leave ${status}`);
      fetchLeaves(); fetchLogs(); fetchBalances();
    } catch { toast.error('Failed to update leave request'); }
  };

  const confirmLeaveDelete = async () => {
    if (!deleteLeaveId) return;
    try {
      await fetch(`/api/leaves?id=${deleteLeaveId}&userName=${encodeURIComponent(currentUser?.name || '')}`, { method: 'DELETE' });
      toast.success('Leave Request deleted');
      fetchLeaves(); fetchLogs(); fetchBalances();
    } catch { toast.error('Failed to delete leave'); }
    setDeleteLeaveId(null);
  };

  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await updateBalance({
        member_name: editingBalanceMember,
        balance: Number(fd.get('balance')),
        last_accrual_month: format(new Date(), 'yyyy-MM'),
        userName: currentUser?.name || ''
      } as unknown as LeaveBalance);
      toast.success('Balance updated');
      setIsBalanceModalOpen(false);
      fetchBalances();
    } catch { toast.error('Failed to update balance'); }
  };

  const LeaveTab = () => {
    const balancesDisplay = members.filter(m => m.status === 'Active').map(m => {
      const bObj = balances?.find(b => b.member_name === m.name);
      return {
        name: m.name,
        balance: bObj?.balance || 0,
        lastAccrual: bObj?.last_accrual_month || 'Not Set'
      };
    });

    const exportLeaves = (type: 'excel' | 'pdf') => {
      const headers = ['Applicant', 'Type', 'Application Date', 'Duration', 'Start', 'End', 'Status'];
      const dataObj: Record<string, string | number>[] = leaves.map(l => ({ 'Applicant': l.member_name, 'Type': l.leave_type, 'Application Date': l.application_date, 'Duration': `${l.days_count} Days`, 'Start': l.start_date, 'End': l.end_date, 'Status': l.status }));
      if (type === 'excel') exportToExcel(dataObj, `Leave_Report_${Date.now()}`);
      else exportToPdf(headers, dataObj.map((obj: Record<string, string | number>) => headers.map(h => obj[h] || '')), `Leave_Report_${Date.now()}`, 'Leave Management Report');
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-primary"/> Leave Management</h3>
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
               <button onClick={() => exportLeaves('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> Excel</button>
               <button onClick={() => exportLeaves('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> PDF</button>
            </div>
          </div>
          <button onClick={() => { setEditingLeaveLog(null); setIsLeaveModalOpen(true); }} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg shadow-sm">
            Apply for Leave
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-4">Annual Leave Balances</h4>
              <div className="space-y-3">
                {balancesDisplay.map(b => (
                  <div key={b.name} className="flex justify-between items-center text-sm p-2 hover:bg-muted/50 rounded transition-colors group">
                    <div className="flex flex-col">
                      <span className="text-foreground font-medium">{b.name}</span>
                      <span className="text-[10px] text-muted-foreground">Accrued: {b.lastAccrual}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`font-bold ${b.balance <= 3 ? 'text-destructive' : 'text-success'}`}>{b.balance} Left</span>
                      {isManager && (
                        <button onClick={() => { setEditingBalanceMember(b.name); setIsBalanceModalOpen(true); }} className="px-2 py-0.5 border border-primary/30 rounded text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors mt-0.5" title="Edit Initial/Base Balance">Edit</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Applications Column */}
          <div className="lg:col-span-2">
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Type & Date</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaves.map(l => (
                    <tr key={l.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{l.member_name}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{l.leave_type}</div>
                        <div className="text-[10px] text-muted-foreground">Applied: {l.application_date}</div>
                        <div className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{l.reason}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{l.days_count} Days</div>
                        <div className="text-[10px] text-muted-foreground">{format(new Date(l.start_date), 'dd MMM')} - {format(new Date(l.end_date), 'dd MMM yyyy')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                          ${l.status === 'Approved' ? 'bg-success/10 text-success border border-success/20' : 
                            l.status === 'Rejected' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 
                            'bg-orange-500/10 text-orange-600 border border-orange-500/20'}`}>
                          {l.status}
                        </span>
                        {l.status !== 'Pending' && <div className="text-[9px] text-muted-foreground mt-1">By: {l.approved_by}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          {l.status === 'Pending' && isManager && (
                            <>
                              <button onClick={() => handleApproveReject(l.id, 'Approved')} className="p-1 hover:bg-success/20 text-success rounded transition-colors" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                              <button onClick={() => handleApproveReject(l.id, 'Rejected')} className="p-1 hover:bg-destructive/20 text-destructive rounded transition-colors" title="Reject"><XCircle className="w-4 h-4" /></button>
                            </>
                          )}
                          {(isManager || l.member_name === currentUser?.name) && (
                            <button onClick={() => { setEditingLeaveLog(l); setIsLeaveModalOpen(true); }} className="p-1 hover:bg-primary/20 text-primary rounded transition-colors" title="Edit Leave"><Edit className="w-3.5 h-3.5" /></button>
                          )}
                          {isManager && (
                            <button onClick={() => setDeleteLeaveId(l.id)} className="p-1 hover:bg-destructive/20 text-destructive rounded transition-colors" title="Delete Leave"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                          {l.status === 'Pending' && !isManager && <span className="text-[10px] text-muted-foreground italic ml-2">Wait</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leaves.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground italic">No leave applications found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    );
  };

  // --- Helpers Tab 4: Employee Status ---
  const handleEmpStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmpStatus) return;
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await updateMember({
        ...editingEmpStatus,
        join_date: fd.get('join_date') as string,
        finish_date: fd.get('finish_date') as string,
        employment_status: fd.get('employment_status') as string,
        contract_duration: Number(fd.get('contract_duration')),
      });
      toast.success('Employee status updated successfully');
      setIsEmpStatusModalOpen(false);
      setEditingEmpStatus(null);
    } catch {
      toast.error('Failed to update employee status');
    }
  };

  const EmployeeStatusTab = () => {
    const getWorkingDuration = (startDateStr: string) => {
      if (!startDateStr) return '--';
      const start = new Date(startDateStr);
      const now = new Date();
      if (start > now) return '0 Days';
      
      let years = now.getFullYear() - start.getFullYear();
      let months = now.getMonth() - start.getMonth();
      let days = now.getDate() - start.getDate();
      
      if (days < 0) {
        months -= 1;
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
      }
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      
      const parts: string[] = [];
      if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
      if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
      if (days > 0 || parts.length === 0) parts.push(`${days} Day${days !== 1 ? 's' : ''}`);
      
      return parts.join(' ');
    };

    const exportEmpStatus = (type: 'excel' | 'pdf') => {
      const headers = ['Name', 'Badge', 'Role', 'Grade', 'Join Date', 'Finish Date', 'Working Duration', 'Plan Contract (Months)', 'Status', 'Days Left'];
      const dataObj: Record<string, string | number>[] = members.map(m => {
        let daysLeft: number | string = '--';
        if (m.finish_date) {
           const timeDiff = new Date(m.finish_date).getTime() - new Date().getTime();
           daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
        }
        const effectiveJoinDate = m.join_date || (m.created_at ? m.created_at.split('T')[0] : '');
        const workingDur = effectiveJoinDate ? getWorkingDuration(effectiveJoinDate) : '--';
        return { 'Name': m.name, 'Badge': m.badge, 'Role': m.role, 'Grade': m.grade || '--', 'Join Date': effectiveJoinDate || '--', 'Finish Date': m.finish_date || '--', 'Working Duration': workingDur, 'Plan Contract (Months)': m.contract_duration || 0, 'Status': m.employment_status || 'Permanent', 'Days Left': daysLeft };
      });
      if (type === 'excel') exportToExcel(dataObj, `Employee_Status_${format(new Date(), 'MMM_yyyy')}`);
      else exportToPdf(headers, dataObj.map((obj: Record<string, string | number>) => headers.map(h => obj[h] || '')), `Employee_Status_${format(new Date(), 'MMM_yyyy')}`, 'Employee Status Report');
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-primary"/> Employee Status</h3>
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
               <button onClick={() => exportEmpStatus('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> Excel</button>
               <button onClick={() => exportEmpStatus('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5"/> PDF</button>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-5 py-3">Member Info</th>
                  <th className="px-5 py-3">Contract & Role</th>
                  <th className="px-5 py-3">Dates</th>
                  <th className="px-5 py-3 text-center">Counting Contract</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map(m => {
                  let daysLeftText = '--';
                  let isEndingSoon = false;
                  let isFinished = false;

                  if (m.employment_status === 'Contract' && m.finish_date) {
                    const timeDiff = new Date(m.finish_date).getTime() - new Date().getTime();
                    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    if (daysLeft < 0) {
                      daysLeftText = 'Expired';
                      isFinished = true;
                    } else {
                      daysLeftText = `${daysLeft} Days Left`;
                      if (daysLeft <= 30) isEndingSoon = true;
                    }
                  } else if (m.employment_status === 'Permanent') {
                     daysLeftText = 'N/A';
                  }
                  
                  const effectiveJoinDate = m.join_date || (m.created_at ? m.created_at.split('T')[0] : '');
                  const workingDurationText = effectiveJoinDate ? getWorkingDuration(effectiveJoinDate) : '--';

                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-bold text-foreground flex items-center gap-2">
                           {m.name}
                           {isEndingSoon && <span className="w-2 h-2 rounded-full bg-warning animate-pulse" title="Contract ending soon!" />}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">Badge: {m.badge}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-[11px] font-semibold text-foreground uppercase tracking-wider">{m.role}</div>
                        <div className="mt-1 flex gap-2 items-center">
                           <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${m.employment_status === 'Contract' ? 'bg-orange-500/10 text-orange-600' : 'bg-success/10 text-success'}`}>{m.employment_status || 'Permanent'}</span>
                           {m.employment_status === 'Contract' && <span className="text-[10px] text-muted-foreground">{m.contract_duration || 0} Month(s) Plan</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-xs"><span className="text-muted-foreground text-[10px] w-12 inline-block">Join:</span> {effectiveJoinDate ? format(new Date(effectiveJoinDate), 'dd MMM yyyy') : '--'}</div>
                        {m.employment_status === 'Contract' && (
                           <div className="text-xs mt-0.5"><span className="text-muted-foreground text-[10px] w-12 inline-block">Finish:</span> {m.finish_date ? format(new Date(m.finish_date), 'dd MMM yyyy') : '--'}</div>
                        )}
                        <div className="text-[10px] font-medium text-primary/80 mt-1 pt-1 border-t border-border/50">Ongoing: {workingDurationText}</div>
                      </td>
                      <td className="px-5 py-3 text-center">
                         <span className={`px-2.5 py-1 rounded text-[11px] font-bold inline-block border ${
                           isFinished ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                           isEndingSoon ? 'bg-warning/10 text-warning border-warning/20 dark:text-amber-400' : 
                           m.employment_status === 'Permanent' ? 'bg-muted/50 text-muted-foreground border-border/50' : 
                           'bg-background border-border text-foreground shadow-sm'
                         }`}>
                           {daysLeftText}
                         </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isManager && (
                          <button onClick={() => { setEditingEmpStatus(m); setIsEmpStatusModalOpen(true); }} className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors" title="Update Status">Edit Entry</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-8 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Attendance & Leave</h1>
          <p className="text-muted-foreground mt-1">Manage shift rosters, overtime records, and track team leaves.</p>
        </div>
      </div>

      <div className="rounded-2xl border flex-1 flex flex-col overflow-hidden bg-surface" style={{ borderColor: 'var(--border)' }}>
        {/* Sub-tab Navigation */}
        <div className="flex p-2 border-b border-border gap-2 bg-muted/30">
          <button 
            onClick={() => setActiveTab('roster')} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'roster' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent hover:border-border'}`}
          >
            <CalendarDays className="w-4 h-4" /> Shift Roster
          </button>
          <button 
            onClick={() => setActiveTab('overtime')} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'overtime' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent hover:border-border'}`}
          >
            <Clock className="w-4 h-4" /> Overtime Tracker
          </button>
          <button 
            onClick={() => setActiveTab('leave')} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'leave' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent hover:border-border'}`}
          >
            <FileText className="w-4 h-4" /> Leave Management
          </button>
          <button 
            onClick={() => setActiveTab('employee-status')} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'employee-status' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent hover:border-border'}`}
          >
            <Users className="w-4 h-4" /> Employee Status
          </button>
        </div>
        
        {/* Content Area */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'roster' && <RosterTab />}
              {activeTab === 'overtime' && <OtTab />}
              {activeTab === 'leave' && <LeaveTab />}
              {activeTab === 'employee-status' && <EmployeeStatusTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      {/* Absolute Root Modals (Independent of Tabs) */}
      <Modal isOpen={isEmpStatusModalOpen} onClose={() => { setIsEmpStatusModalOpen(false); setEditingEmpStatus(null); }} title={`Edit Status: ${editingEmpStatus?.name}`}>
        <form onSubmit={handleEmpStatusSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Employment Status</label>
              <select 
                name="employment_status" 
                defaultValue={editingEmpStatus?.employment_status || 'Permanent'} 
                className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none"
                id="employment_status_select"
                onChange={(e) => {
                   const fdInput = document.getElementById('finish_date_input') as HTMLInputElement;
                   if (fdInput) {
                      fdInput.required = e.target.value === 'Contract';
                   }
                }}
              >
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Contract Duration (Months)</label>
              <input type="number" name="contract_duration" min="0" defaultValue={editingEmpStatus?.contract_duration || 0} className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none" required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Join Date</label>
              <input type="date" name="join_date" defaultValue={editingEmpStatus?.join_date || (editingEmpStatus?.created_at ? editingEmpStatus.created_at.split('T')[0] : '')} className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Finish Date {editingEmpStatus?.employment_status !== 'Permanent' && '*'}</label>
              <input type="date" id="finish_date_input" name="finish_date" defaultValue={editingEmpStatus?.finish_date || ''} className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none" required={editingEmpStatus?.employment_status === 'Contract'} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button type="button" onClick={() => setIsEmpStatusModalOpen(false)} className="px-4 py-2 text-sm text-foreground bg-surface border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm text-white bg-primary rounded-lg shadow-sm hover:bg-primary/90 flex items-center justify-center transition-colors">Save Details</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isLeaveModalOpen} onClose={() => { setIsLeaveModalOpen(false); setEditingLeaveLog(null); }} title={editingLeaveLog ? "Edit Leave Request" : "Apply for Leave"}>
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Employee Name *</label>
            <select name="member_name" required defaultValue={editingLeaveLog?.member_name || currentUser?.name} disabled={!!editingLeaveLog} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed">
              {isManager ? members.filter(m => m.status === 'Active').map(m => <option key={m.id} value={m.name}>{m.name}</option>) : <option value={currentUser?.name}>{currentUser?.name}</option>}
            </select>
            {!!editingLeaveLog && <input type="hidden" name="member_name" value={editingLeaveLog.member_name} />}
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Leave Type *</label>
            <select name="leave_type" required defaultValue={editingLeaveLog?.leave_type || 'Annual Leave'} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none">
              {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Start Date *</label>
              <input name="start_date" type="date" required defaultValue={editingLeaveLog?.start_date || ''} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">End Date *</label>
              <input name="end_date" type="date" required defaultValue={editingLeaveLog?.end_date || ''} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Duration (Days) *</label>
              <input name="days_count" type="number" step="0.5" required min="0.5" defaultValue={editingLeaveLog?.days_count || ''} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Application Date *</label>
              <input name="application_date" type="date" required defaultValue={editingLeaveLog?.application_date || new Date().toISOString().split('T')[0]} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Reason *</label>
            <textarea name="reason" rows={2} required defaultValue={editingLeaveLog?.reason || ''} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Provide details for this leave..."></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button type="button" onClick={() => { setIsLeaveModalOpen(false); setEditingLeaveLog(null); }} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium shadow-sm">
              {editingLeaveLog ? "Update Request" : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isOtModalOpen} onClose={() => setIsOtModalOpen(false)} title={editingOtLog?.date ? "Edit Overtime" : "Add Overtime"}>
        <form onSubmit={handleOTSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Employee Name *</label>
            <select name="member_name" required defaultValue={editingOtLog?.member_name || currentUser?.name} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none">
              {isManager ? members.filter(m => m.status === 'Active').map(m => <option key={m.id} value={m.name}>{m.name}</option>) : <option value={currentUser?.name}>{currentUser?.name}</option>}
            </select>
          </div>
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1.5">Date *</label>
             <input name="date" type="date" required defaultValue={editingOtLog?.date || format(new Date(), 'yyyy-MM-dd')} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Start Hour *</label>
                <input name="ot_start_time" type="time" required defaultValue={editingOtLog?.ot_start_time || '18:00'} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
             </div>
             <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Finish Hour *</label>
                <input name="ot_end_time" type="time" required defaultValue={editingOtLog?.ot_end_time || '20:00'} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
             </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Reason / Details *</label>
            <textarea name="reason" rows={2} required defaultValue={editingOtLog?.overtime_desc || ''} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Reason for overtime..."></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button type="button" onClick={() => setIsOtModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium shadow-sm">Save Overtime</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isBalanceModalOpen} onClose={() => setIsBalanceModalOpen(false)} title="Update Leave Balance">
        <form onSubmit={handleUpdateBalance} className="space-y-4">
          <p className="text-sm text-muted-foreground">Set the initial manual balance for <strong className="text-foreground">{editingBalanceMember}</strong>. The system will auto-add +1 day per month starting next month.</p>
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1.5">Current Balance (Days) *</label>
             <input name="balance" type="number" step="0.5" required defaultValue={balances?.find(b => b.member_name === editingBalanceMember)?.balance || 0} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button type="button" onClick={() => setIsBalanceModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium shadow-sm">Save Balance</button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={!!viewingLeave} onClose={() => setViewingLeave(null)} title="Leave Application Details">
        {viewingLeave && (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-xl border border-border">
              <h4 className="font-semibold text-foreground">{viewingLeave.member_name}</h4>
              <p className="text-sm text-primary font-medium mt-1">{viewingLeave.leave_type}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs uppercase font-bold">Duration</span>
                <p className="font-medium">{viewingLeave.days_count} Days</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase font-bold">Date Range</span>
                <p className="font-medium">{format(new Date(viewingLeave.start_date), 'dd MMM')} - {format(new Date(viewingLeave.end_date), 'dd MMM yyyy')}</p>
              </div>
            </div>
            <div className="text-sm border-t border-border pt-3 mt-3">
              <span className="text-muted-foreground text-xs uppercase font-bold">Reason</span>
              <p className="font-medium mt-1">{viewingLeave.reason}</p>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t border-border mt-2">
              <button type="button" onClick={() => setViewingLeave(null)} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium shadow-sm">Done</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!deleteLeaveId} onClose={() => setDeleteLeaveId(null)} title="Confirm Deletion">
        <div className="space-y-4">
          <div className="text-sm text-foreground my-2">
            Are you sure you want to delete this leave request? This action will auto-revert any balance deductions and roster assignments back to normal.
          </div>
          <div className="flex justify-end gap-3 pt-5 border-t border-border">
            <button onClick={() => setDeleteLeaveId(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors">Cancel</button>
            <button onClick={confirmLeaveDelete} className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">Delete Request</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteOtLog} onClose={() => setDeleteOtLog(null)} title="Remove Overtime">
        <div className="space-y-4">
          <div className="text-sm text-foreground my-2">
            Are you sure you want to remove the overtime record for <strong className="text-primary">{deleteOtLog?.member_name}</strong> on <span className="font-semibold">{deleteOtLog?.date ? format(new Date(deleteOtLog.date), 'dd MMM yyyy') : ''}</span>?
          </div>
          <div className="flex justify-end gap-3 pt-5 border-t border-border">
            <button onClick={() => setDeleteOtLog(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors">Cancel</button>
            <button onClick={confirmRemoveOT} className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">Remove Record</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
