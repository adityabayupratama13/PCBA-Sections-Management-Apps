'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Clock, FileText, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Search, User, Download, Edit, Trash2, Users, Loader2, X, DollarSign, ChevronDown } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { format, addDays, startOfWeek, subMonths, setDate, isWithinInterval, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { canManageAttendanceAdmin, canApproveAsLeader, canApproveAsITSupervisor, canApproveAsManager } from '@/lib/permissions';
import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
interface AttendanceLog { id: number; member_name: string; date: string; shift: string; ot_start_time?: string; ot_end_time?: string; overtime_hours: number; overtime_desc: string;[key: string]: unknown; }
interface LeaveReq { id: number; member_name: string; leave_type: string; application_date: string; start_date: string; end_date: string; days_count: number; reason: string; status: string; approved_by: string; leader_approved_by?: string; it_supervisor_approved_by?: string; manager_approved_by?: string; decline_reason?: string; revision_count: number; userName?: string; isRevision?: boolean;[key: string]: unknown; }
interface LeaveBalance { id: string | number; member_name: string; balance: number; last_accrual_month: string;[key: string]: unknown; }
interface OvertimeReq { id: number; member_name: string; request_date: string; start_time: string; end_time: string; hours: number; reason: string; revision_count: number; status: string; it_supervisor_approved_by: string; manager_approved_by: string; declined_by: string; decline_reason: string; created_at: string; updated_at: string; isRevision?: boolean;[key: string]: unknown; }

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
  const { data: rawLogs, refetch: fetchLogs, create: createLog } = useApi<AttendanceLog>('attendance');
  const { data: rawLeaves, refetch: fetchLeaves, create: createLeave, update: updateLeave } = useApi<LeaveReq>('leaves');
  const { data: rawBalances, refetch: fetchBalances, update: updateBalance } = useApi<LeaveBalance>('leave-balances');
  const { data: rawOvertimes, refetch: fetchOvertimes, create: createOvertime, update: updateOvertime } = useApi<OvertimeReq>('overtime');

  const logs = Array.isArray(rawLogs) ? rawLogs : [];
  const leaves = Array.isArray(rawLeaves) ? rawLeaves : [];
  const balances = Array.isArray(rawBalances) ? rawBalances : [];
  const overtimes = Array.isArray(rawOvertimes) ? rawOvertimes : [];
  const membersList = Array.isArray(members) ? members : [];

  // Refresh on mount
  useEffect(() => { fetchLogs(); fetchLeaves(); fetchBalances(); fetchOvertimes(); }, [fetchLogs, fetchLeaves, fetchBalances, fetchOvertimes]);

  const [activeTab, setActiveTab] = useState<'roster' | 'overtime' | 'leave' | 'employee-status'>('roster');

  // Tab 1: Roster State
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const rosterDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [savingShift, setSavingShift] = useState(false);
  const isBulkMode = true;
  const [selectedBulkMembers, setSelectedBulkMembers] = useState<string[]>([]);
  const [bulkFilterShift, setBulkFilterShift] = useState<string>('All');

  // UX Simplification States
  const [bulkTabMode, setBulkTabMode] = useState<'all' | 'specific'>('all');
  const [bulkTargetDays, setBulkTargetDays] = useState<string[]>([]);
  const [bulkTargetShift, setBulkTargetShift] = useState<string>('');
  const [bulkHolidayWarning, setBulkHolidayWarning] = useState<{ count: number, holidays: { date: string, name: string }[] } | null>(null);

  const [quickEditCell, setQuickEditCell] = useState<{ memberName: string, date: string, currentVal: string } | null>(null);
  const [quickEditHolidayConfirm, setQuickEditHolidayConfirm] = useState<{ memberName: string, date: string, newShift: string, holidayName: string } | null>(null);

  // Tab 2: Overtime State
  const [otMonthOffset, setOtMonthOffset] = useState(0); // 0 = Current Cut-off
  const [otSearch, setOtSearch] = useState('');
  const [selectedOtMember, setSelectedOtMember] = useState<string | null>(null);
  const [isOtModalOpen, setIsOtModalOpen] = useState(false);
  const [editingOtLog, setEditingOtLog] = useState<Partial<OvertimeReq> | null>(null);
  const [declineOtId, setDeclineOtId] = useState<number | null>(null);
  const [selectedOtMembers, setSelectedOtMembers] = useState<string[]>([]);
  const [otMemberSearch, setOtMemberSearch] = useState('');
  const [isOtEmployeeDropdownOpen, setIsOtEmployeeDropdownOpen] = useState(false);
  
  const [otFormDate, setOtFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [otFormStart, setOtFormStart] = useState('17:00');
  const [otFormEnd, setOtFormEnd] = useState('20:00');
  const [otFormReason, setOtFormReason] = useState('');
  const [otBulkReasons, setOtBulkReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingOtLog) {
      setOtFormDate((editingOtLog.request_date as string) || format(new Date(), 'yyyy-MM-dd'));
      setOtFormStart((editingOtLog.start_time as string) || '17:00');
      setOtFormEnd((editingOtLog.end_time as string) || '20:00');
      setOtFormReason((editingOtLog.reason as string) || '');
    } else if (isOtModalOpen) {
      setOtFormDate(format(new Date(), 'yyyy-MM-dd'));
      setOtFormStart('17:00');
      setOtFormEnd('20:00');
      setOtFormReason('');
      setOtBulkReasons({});
    }
  }, [editingOtLog, isOtModalOpen]);

  const parsedOtStart = otFormStart.split(':').map(Number);
  const parsedOtEnd = otFormEnd.split(':').map(Number);
  let liveOtDiff = 0;
  if (!isNaN(parsedOtStart[0]) && !isNaN(parsedOtEnd[0])) {
    let diff = (parsedOtEnd[0] * 60 + parsedOtEnd[1]) - (parsedOtStart[0] * 60 + parsedOtStart[1]);
    if (diff < 0) diff += 24 * 60;
    liveOtDiff = diff / 60;
    if (otFormDate && new Date(otFormDate).getDay() === 6 && liveOtDiff > 1) liveOtDiff -= 1;
  }
  const liveHidup = liveOtDiff > 0 ? ((liveOtDiff <= 1) ? liveOtDiff * 1.5 : 1.5 + ((liveOtDiff - 1) * 2)) : 0;

  // Tab 3: Leave State
  const [selectedLeaveMembers, setSelectedLeaveMembers] = useState<string[]>([]);
  const [leaveBulkReasons, setLeaveBulkReasons] = useState<Record<string, string>>({});
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [editingBalanceMember, setEditingBalanceMember] = useState('');
  const [editingLeaveLog, setEditingLeaveLog] = useState<LeaveReq | null>(null);
  const [viewingLeave, setViewingLeave] = useState<LeaveReq | null>(null);
  const [deleteLeaveId, setDeleteLeaveId] = useState<number | null>(null);
  const [declineLeaveId, setDeclineLeaveId] = useState<number | null>(null);
  const [deleteOtLog, setDeleteOtLog] = useState<OvertimeReq | null>(null);

  // Tab 4: Employee Status State
  const [isEmpStatusModalOpen, setIsEmpStatusModalOpen] = useState(false);
  const [editingEmpStatus, setEditingEmpStatus] = useState<typeof membersList[0] | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const { updateMember } = useAuth();

  const executeBulkChange = async (includeHolidayMode: boolean = false) => {
    setSavingShift(true);
    setBulkError(null);
    let count = selectedBulkMembers.length;

    const payloadAttendances = [];
    const payloadOvertimes = [];

    try {
      const daysToProcess = bulkTabMode === 'all'
        ? rosterDates.map(r => format(r, 'yyyy-MM-dd'))
        : bulkTargetDays;

      for (const mName of selectedBulkMembers) {
        for (const dateStr of daysToProcess) {
          const isHol = !!ID_HOLIDAYS[dateStr];

          if (isHol && !includeHolidayMode) {
            continue; // Skip holiday, keep it unchanged
          }

          payloadAttendances.push({ member_name: mName, date: dateStr, shift: bulkTargetShift });

          if (isHol && includeHolidayMode && bulkTargetShift !== 'Off' && bulkTargetShift !== 'Leave') {
            payloadOvertimes.push({
              member_name: mName,
              request_date: dateStr,
              start_time: '08:00',
              end_time: '17:00',
              hours: 8,
              reason: `Working on Public Holiday: ${ID_HOLIDAYS[dateStr]}`
            });
          }
        }
      }

      if (payloadAttendances.length === 0) {
        toast.info('No shifts were updated (holidays skipped).');
      } else {
        const res = await fetch('/api/attendance/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendances: payloadAttendances, overtimes: payloadOvertimes, userName: currentUser?.name || 'System' })
        });

        if (!res.ok) throw new Error('Failed to save via bulk API');

        toast.success(`Successfully applied shift to ${count} employee(s).`, {
          duration: 3000,
          action: {
            label: 'Undo',
            onClick: () => toast.info('Undo processing...')
          }
        });

        await fetchLogs();
        if (payloadOvertimes.length > 0) fetchOvertimes();
      }

      setSelectedBulkMembers([]);
      setBulkTargetDays([]);
      setBulkTargetShift('');
      setBulkHolidayWarning(null);
      setBulkTabMode('all');
    } catch {
      setBulkError('Proses update gagal. Silakan coba lagi.');
      toast.error('Gagal menerapkan perubahan bulk.');
    } finally {
      setSavingShift(false);
    }
  };

  const handleBulkChangeSubmit = async () => {
    if (!bulkTargetShift || selectedBulkMembers.length === 0) return;
    if (bulkTabMode === 'specific' && bulkTargetDays.length === 0) return;

    const targetHolidays: { date: string, name: string }[] = [];

    if (bulkTabMode === 'all') {
      for (let i = 0; i < 7; i++) {
        const dateStr = format(rosterDates[i], 'yyyy-MM-dd');
        if (ID_HOLIDAYS[dateStr]) {
          targetHolidays.push({ date: dateStr, name: ID_HOLIDAYS[dateStr] });
        }
      }
    } else {
      for (const day of bulkTargetDays) {
        if (ID_HOLIDAYS[day]) {
          targetHolidays.push({ date: day, name: ID_HOLIDAYS[day] });
        }
      }
    }

    if (targetHolidays.length > 0) {
      setBulkHolidayWarning({
        count: selectedBulkMembers.length,
        holidays: targetHolidays
      });
      return;
    }

    executeBulkChange();
  };

  const handleShiftChange = async (memberName: string, date: string, newShift: string, isOvertime: boolean = false) => {
    if (newShift === 'Leave') {
      const existing = leaves.find(l => l.member_name === memberName && l.status === 'Approved' && date >= l.start_date && date <= l.end_date);
      if (!existing) {
        toast.error('Apply cuti melalui tab "Leave Management" terlebih dahulu. Sistem otomatis mengisinya saat di-Approve.');
        return;
      }
    }
    setSavingShift(true);
    try {
      const payloadAttendances = [{ member_name: memberName, date, shift: newShift }];
      const payloadOvertimes = isOvertime ? [{
        member_name: memberName,
        request_date: date,
        start_time: '08:00',
        end_time: '17:00',
        hours: 8,
        reason: `Working on Public Holiday: ${ID_HOLIDAYS[date]}`
      }] : [];

      const res = await fetch('/api/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendances: payloadAttendances, overtimes: payloadOvertimes, userName: currentUser?.name || 'System' })
      });
      if (!res.ok) throw new Error('API Sync Failed');

      toast.success(`Shift updated for ${memberName}`, { duration: 2500, action: { label: 'Undo', onClick: () => toast.info('Undo shift...') } });
      await fetchLogs();
      if (isOvertime) fetchOvertimes();
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
      const activeItMembers = membersList.filter(m => m.member_type !== 'Management');
      for (const m of activeItMembers) {
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
    const dataObj = membersList.filter(m => m.status === 'Active' && m.member_type !== 'Management').map(m => {
      const row: Record<string, string | number> = { 'Team Member': m.name, 'Role': m.role };
      rosterDates.forEach(d => { row[format(d, 'dd MMM')] = (logs.find(l => l.member_name === m.name && l.date === format(d, 'yyyy-MM-dd'))?.shift || 'Off') as string; });
      return row;
    });
    if (type === 'excel') exportToExcel(dataObj, `Shift_Roster_${format(weekStart, 'MMM_dd_yyyy')}`);
    else exportToPdf(headers, dataObj.map((obj: Record<string, string | number>) => headers.map(h => obj[h] || '')), `Shift_Roster_${format(weekStart, 'MMM_dd_yyyy')}`, 'Weekly Shift Roster');
  };

  const RosterTab = () => {
    const filteredMembers = membersList.filter(m => m.status === 'Active' && m.member_type !== 'Management').filter(m => {
      if (!isBulkMode || bulkFilterShift === 'All') return true;
      const mondayStr = format(rosterDates[0], 'yyyy-MM-dd');
      const currentMondayShift = logs.find(l => l.member_name === m.name && l.date === mondayStr)?.shift || 'Off';
      return currentMondayShift === bulkFilterShift;
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) setSelectedBulkMembers(filteredmembersList.map(m => m.name));
      else setSelectedBulkMembers([]);
    };

    return (
      <div className="space-y-4 pb-20">
        <div className="flex flex-col xl:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-foreground">Weekly Shift Roster</h3>
            {isManager && (
              <div className="flex items-center gap-2">
                <select value={bulkFilterShift} onChange={e => setBulkFilterShift(e.target.value)} className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none">
                  <option value="All">Filter by Shift...</option>
                  {SHIFT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
              <button onClick={() => exportRoster('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> Excel</button>
              <button onClick={() => exportRoster('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> PDF</button>
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
                <th className="px-4 py-3 border-r border-border min-w-[150px]">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedBulkMembers.length === filteredMembers.length && filteredMembers.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-border text-primary outline-none" />
                    <span>Team Member</span>
                  </div>
                </th>
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
              {filteredmembersList.map(member => {
                const isSelected = selectedBulkMembers.includes(member.name);
                return (
                  <tr key={member.id} className={`transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-primary/5'}`}>
                    <td className="px-4 py-3 border-r border-border">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={isSelected} onChange={(e) => {
                          if (e.target.checked) setSelectedBulkMembers([...selectedBulkMembers, member.name]);
                          else setSelectedBulkMembers(selectedBulkmembersList.filter(n => n !== member.name));
                        }} className="mt-1 w-4 h-4 rounded border-border text-primary outline-none flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">{member.name}</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-[10px] text-muted-foreground truncate">{member.role}</div>
                            {isManager && (
                              <button onClick={() => handleCopyMonday(member.name)} className="text-[10px] font-semibold text-primary/80 hover:text-primary transition-colors flex-shrink-0" title="Copy Monday shift to entire week">Copy Wk</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {rosterDates.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const entry = logs.find(l => l.member_name === member.name && l.date === dateStr);
                      const currentVal = entry?.shift || 'Off';
                      return (
                        <td key={dateStr} className="px-2 py-2 text-center border-r border-border/50 last:border-0 relative">
                          {!!ID_HOLIDAYS[dateStr] && currentVal !== 'Off' && currentVal !== 'Leave' && (
                            <div className="absolute top-0 right-0 bg-orange-500/90 text-white text-[8px] font-bold px-1 py-0.5 rounded-bl shadow-sm z-10 pointer-events-none" title={`Overtime on Holiday: ${ID_HOLIDAYS[dateStr]}`}>OT</div>
                          )}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isManager && !savingShift) setQuickEditCell({ memberName: member.name, date: dateStr, currentVal });
                            }}
                            className={`w-full text-xs py-1.5 px-1 rounded border-transparent focus:border-primary outline-none transition-all cursor-pointer text-center select-none
                            ${currentVal === 'Off' ? 'bg-muted/50 text-muted-foreground' :
                                currentVal === 'Leave' ? 'bg-destructive/10 text-destructive font-medium border-destructive/20' :
                                  currentVal === 'Normal Shift' ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium border-teal-500/20' :
                                    currentVal.includes('Shift 1') ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border-blue-500/20' :
                                      currentVal.includes('Shift 2') ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium border-orange-500/20' :
                                        'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium border-violet-500/20'
                              }
                              ${quickEditCell?.memberName === member.name && quickEditCell?.date === dateStr ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:bg-primary/5 border hover:border-primary/30'}
                              `}
                            title="Click to change shift"
                          >
                            {currentVal}
                          </div>

                          {quickEditCell?.memberName === member.name && quickEditCell?.date === dateStr && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setQuickEditCell(null); }} />
                              <div className="absolute top-10 left-1/2 -translate-x-1/2 mt-1 z-50 bg-background border border-border shadow-2xl rounded-lg p-1 min-w-[130px] flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                                {SHIFT_OPTIONS.map(opt => (
                                  <button
                                    key={opt}
                                    onClick={() => {
                                      const isHol = !!ID_HOLIDAYS[dateStr];
                                      if (isHol && opt !== 'Off' && opt !== 'Leave') {
                                        setQuickEditHolidayConfirm({ memberName: member.name, date: dateStr, newShift: opt, holidayName: ID_HOLIDAYS[dateStr] });
                                      } else {
                                        handleShiftChange(member.name, dateStr, opt, false);
                                      }
                                      setQuickEditCell(null);
                                    }}
                                    className="flex items-center justify-between w-full px-2 py-1.5 text-xs rounded hover:bg-muted font-medium text-foreground transition-colors"
                                  >
                                    <span>{opt}</span>
                                    {currentVal === opt && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                                  </button>
                                ))}
                                {currentVal === 'Leave' && !SHIFT_OPTIONS.includes('Leave') && (
                                  <button className="flex items-center justify-between w-full px-2 py-1.5 text-xs rounded font-medium text-foreground transition-colors bg-muted/50 cursor-default">
                                    <span>Leave</span>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}

                          {quickEditHolidayConfirm?.memberName === member.name && quickEditHolidayConfirm?.date === dateStr && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setQuickEditHolidayConfirm(null)} />
                              <div className="absolute top-10 left-1/2 -translate-x-1/2 md:-translate-x-3/4 mt-1 z-50 bg-background border border-border shadow-2xl rounded-lg p-3 w-[240px] text-left" onClick={e => e.stopPropagation()}>
                                <p className="text-xs font-semibold text-foreground mb-3 whitespace-normal">
                                  This is a holiday ({quickEditHolidayConfirm.holidayName}). Count as overtime?
                                </p>
                                <div className="flex gap-2 w-full">
                                  <button onClick={() => setQuickEditHolidayConfirm(null)} className="flex-1 px-2 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted text-foreground transition-colors">Cancel</button>
                                  <button onClick={() => { handleShiftChange(member.name, dateStr, quickEditHolidayConfirm.newShift, true); setQuickEditHolidayConfirm(null); }} className="flex-1 px-2 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-sm rounded-lg transition-colors">Yes (OT)</button>
                                </div>
                              </div>
                            </>
                          )}
                          {currentVal === 'Leave' && (
                            <button
                              onClick={() => {
                                const match = leaves.find(l => l.member_name === member.name && l.status === 'Approved' && dateStr >= l.start_date && dateStr <= l.end_date);
                                if (match) setViewingLeave(match);
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
          {/* Leave Decline Modal */}
          <Modal isOpen={!!declineLeaveId} onClose={() => setDeclineLeaveId(null)} title="Decline Leave Request">
            <form onSubmit={handleLeaveReject} className="space-y-4">
              <p className="text-sm text-muted-foreground">Please provide a reason for declining this request.</p>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason *</label>
                <textarea name="reason" rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary placeholder-muted" placeholder="Enter reason" required />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setDeclineLeaveId(null)} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white text-sm font-medium rounded-lg shadow-sm">Decline Leave</button>
              </div>
            </form>
          </Modal>

          {/* Floating Bulk Action Bar */}
          <AnimatePresence>
            {selectedBulkMembers.length > 0 && (
              <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur shadow-2xl border border-border p-3 sm:p-4 rounded-2xl flex flex-col gap-3 sm:gap-4 w-[96vw] max-w-2xl overflow-y-auto max-h-[85vh] custom-scrollbar">
                {/* Header Section */}
                <div className="flex flex-col gap-2 w-full border-b border-border pl-1">
                  <div className="text-sm font-semibold text-foreground px-2 py-1 mb-1">
                    <CheckCircle2 className="w-4 h-4 inline-block -mt-0.5 text-primary mr-1" /> {selectedBulkMembers.length} employee(s) selected
                  </div>

                  <div className="flex gap-2 relative z-0">
                    <button onClick={() => setBulkTabMode('all')} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${bulkTabMode === 'all' ? 'border-primary text-primary bg-primary/5 rounded-t-lg' : 'border-transparent text-muted-foreground hover:bg-muted rounded-t-lg'}`}>
                      <span>📅</span> Change All Week
                    </button>
                    <button onClick={() => setBulkTabMode('specific')} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${bulkTabMode === 'specific' ? 'border-primary text-primary bg-primary/5 rounded-t-lg' : 'border-transparent text-muted-foreground hover:bg-muted rounded-t-lg'}`}>
                      <span>📌</span> Change Specific Days
                    </button>
                  </div>
                </div>

                {/* Mode Layout */}
                <div className="w-full pt-1 px-1">
                  {bulkTabMode === 'specific' && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-foreground mb-2">Select days:</div>
                      <div className="flex flex-wrap gap-2">
                        {rosterDates.map(d => {
                          const dateStr = format(d, 'yyyy-MM-dd');
                          const isSelected = bulkTargetDays.includes(dateStr);
                          return (
                            <button
                              key={dateStr}
                              onClick={() => {
                                if (isSelected) setBulkTargetDays(bulkTargetDays.filter(x => x !== dateStr));
                                else setBulkTargetDays([...bulkTargetDays, dateStr]);
                              }}
                              className={`h-[44px] px-3 font-medium text-sm border rounded-lg transition-colors flex-[1_1_auto] sm:flex-none flex items-center justify-center min-w-[70px] ${isSelected ? 'bg-primary text-white border-primary shadow-sm' : 'bg-background border-border text-foreground hover:bg-muted'}`}
                            >
                              {format(d, 'EEE, dd')}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-xs font-semibold text-foreground mb-2">
                    {bulkTabMode === 'all' ? 'Change all working days to:' : 'Change selected days to:'}
                  </div>
                </div>

                {/* Actions Section */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full border border-border bg-surface p-2 rounded-lg">
                  <select value={bulkTargetShift} onChange={e => setBulkTargetShift(e.target.value)} className="w-full sm:flex-1 h-[44px] bg-background border border-border/50 rounded px-3 text-sm focus:ring-primary focus:border-primary outline-none">
                    <option value="" disabled>Change to Shift...</option>
                    {SHIFT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <button onClick={() => { setSelectedBulkMembers([]); setBulkTargetDays([]); setBulkTabMode('all'); }} disabled={savingShift} className="flex-1 sm:flex-none px-5 h-[44px] text-sm font-medium hover:bg-muted rounded text-center disabled:opacity-50 transition-colors">Cancel</button>
                    <button onClick={handleBulkChangeSubmit} disabled={(!bulkTargetShift || savingShift || (bulkTabMode === 'specific' && bulkTargetDays.length === 0))} className={`flex-1 sm:flex-none px-8 h-[44px] text-sm font-bold text-white rounded transition-colors whitespace-nowrap shadow-md flex items-center justify-center gap-2 ${savingShift ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                      {savingShift && !bulkHolidayWarning ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Applying...</span></> : <span>Apply</span>}
                    </button>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Holiday Confirmation Modal (Simplified) */}
          <Modal isOpen={!!bulkHolidayWarning} onClose={() => { if (!savingShift) { setBulkHolidayWarning(null); setBulkError(null); } }} title="⚠️ Holiday Detected">
            <div className="space-y-4">
              {bulkError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive dark:text-red-400">
                  ⚠️ {bulkError}
                </div>
              )}
              {savingShift ? (
                <div className="p-6 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <div className="text-sm font-bold text-foreground">Applying changes...</div>
                  <div className="text-xs text-muted-foreground text-center">
                    Please wait while we update the shifts.
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-foreground">
                    <p className="font-medium mb-2">The following days are holidays:</p>
                    <ul className="list-disc pl-5 space-y-1 mb-4 text-muted-foreground text-xs">
                      {bulkHolidayWarning?.holidays?.map(h => (
                        <li key={h.date}><strong className="text-foreground">{format(new Date(h.date), 'EEEE, MMM d')}</strong> ({h.name})</li>
                      ))}
                    </ul>
                    <p className="font-semibold text-[13px]">Include as overtime?</p>
                  </div>
                  <div className="flex gap-3 pt-3">
                    <button type="button" onClick={() => executeBulkChange(false)} className="flex-1 min-h-[44px] bg-background border border-border hover:bg-muted text-foreground text-sm font-medium rounded-lg shadow-sm transition-colors">
                      No, Skip Holidays
                    </button>
                    <button type="button" onClick={() => executeBulkChange(true)} className="flex-1 min-h-[44px] bg-orange-500 hover:bg-orange-600 text-white border border-transparent text-sm font-bold rounded-lg shadow-sm transition-colors">
                      Yes, Overtime
                    </button>
                  </div>
                </>
              )}
            </div>
          </Modal>

        </div>
      </div>
    )
  };

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
    if (!editingOtLog?.id && isManager && selectedOtMembers.length === 0) return;
    try {
      const dateStr = otFormDate;
      const mem = !isManager ? (currentUser?.name || '') : '';
      const start = otFormStart;
      const end = otFormEnd;
      const reason = otFormReason;

      let hours = liveOtDiff;
      if (hours === 0) {
        toast.error('Finish Hour must be different from Start Hour');
        return;
      }

      if (editingOtLog?.id) {
        const targets = (isManager && selectedOtMembers.length > 0) ? selectedOtMembers : [editingOtLog.member_name];
        let revisedCount = 0;
        let notFoundCount = 0;

        for (const nm of targets) {
          if (!nm) continue;
          const existingLog = (Array.isArray(overtimes) ? overtimes : []).find(o => o.member_name === nm && o.request_date === editingOtLog.request_date);
          if (existingLog) {
            await updateOvertime({
              id: existingLog.id,
              start_time: start,
              end_time: end,
              hours: Number(hours.toFixed(2)),
              reason: otBulkReasons[nm] ?? existingLog.reason,
              isRevision: true,
              prev_start_time: existingLog.start_time,
              prev_end_time: existingLog.end_time,
              prev_hours: existingLog.hours
            } as unknown as OvertimeReq);
            revisedCount++;
          } else {
            notFoundCount++;
          }
        }
        
        if (revisedCount > 0) {
          toast.success(revisedCount > 1 ? `Successfully revised overtime for ${revisedCount} employees` : 'Overtime revised successfully');
        }
        if (notFoundCount > 0) {
          toast.warning(`Skipped ${notFoundCount} employee(s) who didn't have an overtime record on this date.`);
        }
      } else {
        const targets = isManager ? selectedOtMembers : [mem];

        const duplicateWarningMembers: string[] = [];
        for (const nm of targets) {
          if (!nm) continue;
          const hasDup = (Array.isArray(overtimes) ? overtimes : []).some(o => o.member_name === nm && o.request_date === dateStr);
          if (hasDup) duplicateWarningMembers.push(nm);
        }

        if (duplicateWarningMembers.length > 0) {
          if (!window.confirm(`${duplicateWarningMembers.length} employee(s) already have an overtime record on this date. Proceed anyway?\n\nYes = Proceed\nCancel = Abort`)) {
            return;
          }
        }

        let addedCount = 0;
        for (const memberName of targets) {
          if (!memberName) continue;
          await createOvertime({
            member_name: memberName,
            request_date: dateStr,
            start_time: start,
            end_time: end,
            hours: Number(hours.toFixed(2)),
            reason: otBulkReasons[memberName] || reason
          } as unknown as OvertimeReq);
          addedCount++;
        }
        toast.success(addedCount > 1 ? `Successfully added overtime for ${addedCount} employees` : 'Overtime requested successfully');
      }
      setIsOtModalOpen(false);
      setSelectedOtMembers([]);
      setOtMemberSearch('');
      fetchOvertimes();
    } catch { toast.error('Failed to submit overtime'); }
  };

  const handleOTApprove = async (logId: number) => {
    try {
      const isManagerApproving = currentUser?.member_type === 'Management';
      const payload: Partial<OvertimeReq> = { id: logId };

      if (isManagerApproving) {
        payload.status = 'Approved';
        payload.manager_approved_by = currentUser?.name;
      } else {
        payload.status = 'IT_Approved';
        payload.it_supervisor_approved_by = currentUser?.name;
      }

      await updateOvertime(payload as OvertimeReq);
      toast.success('Overtime Approved');
      fetchOvertimes();
    } catch { toast.error('Failed to approve OT'); }
  };

  const handleOTDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineOtId) return;
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await updateOvertime({
        id: declineOtId,
        status: 'Declined',
        declined_by: currentUser?.name,
        decline_reason: fd.get('reason') as string
      } as unknown as OvertimeReq);
      toast.success('Overtime Declined');
      setDeclineOtId(null);
      fetchOvertimes();
    } catch { toast.error('Failed to decline OT'); }
  };

  const confirmRemoveOT = async () => {
    if (!deleteOtLog) return;
    try {
      await fetch(`/api/overtime?id=${deleteOtLog.id}`, { method: 'DELETE' });
      fetchOvertimes(); toast.success('Overtime removed');
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

    const stats = membersList.filter(m => m.status === 'Active' && m.member_type !== 'Management' && m.name.toLowerCase().includes(otSearch.toLowerCase()) && (isManager || m.name === currentUser?.name)).map(m => {
      let periodOt = 0;
      let periodOtHidup = 0;
      let ytdOt = 0;
      const memberLogs = overtimes.filter(l => l.member_name === m.name && l.status !== 'Declined' && l.hours > 0);

      memberLogs.forEach(l => {
        const [yr, mo, dy] = String(l.request_date).split('-');
        const reqDateLocal = new Date(Number(yr), Number(mo) - 1, Number(dy), 12, 0, 0);
        const hrs = Number(l.hours) || 0;
        ytdOt += hrs;
        if (isWithinInterval(reqDateLocal, { start: startOfCutoff, end: endOfCutoff })) {
          periodOt += hrs;
          periodOtHidup += calculateJamHidup(hrs, m.role);
        }
      });
      return {
        member: m, periodOt, periodOtHidup, ytdOt, logsToEdit: overtimes.filter(l => {
          if (l.member_name !== m.name) return false;
          const [yr, mo, dy] = String(l.request_date).split('-');
          const reqDateLocal = new Date(Number(yr), Number(mo) - 1, Number(dy), 12, 0, 0);
          return isWithinInterval(reqDateLocal, { start: startOfCutoff, end: endOfCutoff });
        })
      };
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
          dataObj.push({ 'Member': s.member.name, 'Role': s.member.role, 'Date & Desc': `${l.request_date} - ${l.reason}`, 'Time Range': `${l.start_time}-${l.end_time}`, 'Jam Mati': Number(l.hours), 'Jam Hidup': calculateJamHidup(Number(l.hours), s.member.role).toFixed(1), 'Status': l.status });
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
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Overtime Tracker</h3>
              <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
                <button onClick={() => exportOt('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> Excel</button>
                <button onClick={() => exportOt('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> PDF</button>
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
            <button onClick={() => { 
              if (selectedOtMembers.length === 0 && selectedOtMember) {
                setSelectedOtMembers([selectedOtMember]);
              }
              setEditingOtLog(null); 
              setIsOtModalOpen(true); 
            }} className="px-4 py-2 w-full sm:w-auto bg-primary text-primary-foreground text-sm font-medium rounded-lg shadow whitespace-nowrap hover:bg-primary/90">
              + Add Overtime
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Member Selector */}
          <div className="w-full lg:w-64 flex flex-col gap-2 flex-shrink-0">
            <div className="flex justify-between items-center px-1 mb-1">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Select Member</h4>
              {isManager && stats.length > 0 && (
                <button 
                  onClick={() => {
                    if (selectedOtMembers.length === stats.length) {
                      setSelectedOtMembers([]);
                    } else {
                      setSelectedOtMembers(stats.map(s => s.member.name));
                    }
                  }}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                >
                  {selectedOtMembers.length === stats.length ? 'DESELECT ALL' : 'SELECT ALL'}
                </button>
              )}
            </div>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto max-h-[600px] custom-scrollbar pb-2 lg:pb-0">
              {stats.map(s => {
                const isSelectedForOt = selectedOtMembers.includes(s.member.name);
                const isActive = selectedOtMember === s.member.name;
                return (
                  <div
                    key={s.member.id}
                    onClick={() => setSelectedOtMember(s.member.name)}
                    className={`relative flex flex-col items-start px-4 py-3 rounded-xl border transition-all flex-shrink-0 w-[200px] lg:w-auto cursor-pointer
                      ${isActive
                        ? 'bg-primary/10 border-primary shadow-sm'
                        : 'bg-surface border-border hover:bg-muted/50'}`}
                  >
                    {isManager && (
                      <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelectedForOt} 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedOtMembers(prev => [...prev, s.member.name]);
                            else setSelectedOtMembers(prev => prev.filter(n => n !== s.member.name));
                          }} 
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary outline-none cursor-pointer" 
                        />
                      </div>
                    )}
                    <div className={`font-semibold pr-6 text-sm truncate w-full text-left ${isActive ? 'text-primary' : 'text-foreground'}`}>{s.member.name}</div>
                    <div className="flex justify-between w-full mt-2 items-end">
                      <span className="text-[10px] text-muted-foreground mr-2 truncate">{s.member.role}</span>
                      <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5"><span className="text-[8px] font-bold text-muted-foreground uppercase opacity-70">Mati</span><span className={`text-xs font-bold leading-none ${isActive ? 'text-primary' : 'text-foreground'}`}>{s.periodOt.toFixed(1)}h</span></div>
                        <div className="flex items-center gap-1.5"><span className="text-[8px] font-bold text-muted-foreground uppercase opacity-70">Hidup</span><span className={`text-xs font-bold leading-none ${isActive ? 'text-primary' : 'text-foreground'}`}>{s.periodOtHidup.toFixed(1)}h</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                          {currentMemberStat.logsToEdit.reduce((acc, l) => acc + (l.status !== 'Declined' ? calculateJamHidup(Number(l.hours), currentMemberStat.member.role) : 0), 0).toFixed(1)}h
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
                          <th className="px-5 py-3 text-center">Jam Mati<br /><span className="lowercase font-normal mt-0.5 text-[9px] block">Actual</span></th>
                          <th className="px-5 py-3 text-center">Jam Hidup<br /><span className="lowercase font-normal mt-0.5 text-[9px] block">Formulated</span></th>
                          <th className="px-5 py-3 text-center">Status</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {currentMemberStat.logsToEdit.length > 0 ? (
                          currentMemberStat.logsToEdit.map((l, idx) => {
                            const jnHidup = calculateJamHidup(Number(l.hours), currentMemberStat.member.role);
                            const isITSpv = currentUser?.role === 'IT Supervisor';
                            const isMgmt = currentUser?.member_type === 'Management';
                            const isRevised = l.revision_count > 0;

                            return (
                              <motion.tr
                                key={l.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`transition-colors ${isRevised ? 'bg-amber-500/[0.03] hover:bg-amber-500/10' : 'hover:bg-muted/30'}`}
                              >
                                <td className={`px-5 py-4 w-[250px] ${isRevised ? 'border-l-2 border-l-amber-500' : ''}`}>
                                  {isRevised && (
                                    <div className="mb-1.5">
                                      <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded inline-block border border-amber-500/20 tracking-wider">
                                        Rev: {l.revision_count}
                                      </span>
                                    </div>
                                  )}
                                  <div className={`font-medium ${isRevised ? 'text-amber-500/90' : 'text-foreground'}`}>{format(new Date(l.request_date), 'EEEE, dd MMM yyyy')}</div>
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2" title={l.reason}>{l.reason || 'No reason specified'}</div>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  {isRevised ? (
                                    <div className="flex flex-row items-center justify-center gap-1.5 min-w-max">
                                      <div className="flex flex-col items-center border border-border/50 rounded bg-muted/20 px-2 py-1">
                                        <span className="text-[9px] text-muted-foreground uppercase leading-none mb-1 font-medium tracking-wide">Original</span>
                                        <span className="text-xs font-mono text-muted-foreground">{String((l as any).prev_start_time || '??:??')} - {String((l as any).prev_end_time || '??:??')}</span>
                                      </div>
                                      <div className="text-amber-500/70 text-xs font-bold">»</div>
                                      <div className="flex flex-col items-center border border-amber-500/30 rounded bg-amber-500/10 px-2 py-1">
                                        <span className="text-[9px] text-amber-500 uppercase leading-none mb-1 font-bold tracking-wide">Revisi</span>
                                        <span className="text-xs font-mono font-bold text-amber-500">{l.start_time || '--:--'} - {l.end_time || '--:--'}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="bg-background border border-border px-2.5 py-1 rounded text-xs font-mono font-medium shadow-sm">
                                      {l.start_time || '--:--'} - {l.end_time || '--:--'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-center font-semibold">
                                  {isRevised ? (
                                    <div className="flex flex-row items-center justify-center gap-1.5 min-w-max">
                                      <div className="flex flex-col items-center border border-border/50 rounded bg-muted/20 px-2 py-1 min-w-[40px]">
                                        <span className="text-[9px] text-muted-foreground uppercase leading-none mb-1 font-medium tracking-wide">Orig</span>
                                        <span className="text-xs text-muted-foreground font-semibold">{(l as any).prev_hours ? Number((l as any).prev_hours).toFixed(1) : '?'}h</span>
                                      </div>
                                      <div className="text-amber-500/70 text-xs font-bold">»</div>
                                      <div className="flex flex-col items-center border border-amber-500/30 rounded bg-amber-500/10 px-2 py-1 min-w-[40px]">
                                        <span className="text-[9px] text-amber-500 uppercase leading-none mb-1 font-bold tracking-wide">Rev</span>
                                        <span className="text-xs font-bold text-amber-500">{Number(l.hours).toFixed(1)}h</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-foreground">{Number(l.hours).toFixed(1)}h</span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-center font-bold text-primary">
                                  {isRevised ? (
                                    <div className="flex flex-row items-center justify-center gap-1.5 min-w-max">
                                      <div className="flex flex-col items-center border border-border/50 rounded bg-muted/20 px-2 py-1 min-w-[40px]">
                                        <span className="text-[9px] text-muted-foreground uppercase leading-none mb-1 font-medium tracking-wide">Orig</span>
                                        <span className="text-xs text-muted-foreground font-bold">{(l as any).prev_hours ? calculateJamHidup(Number((l as any).prev_hours), currentMemberStat.member.role).toFixed(1) : '?'}h</span>
                                      </div>
                                      <div className="text-amber-500/70 text-xs font-bold">»</div>
                                      <div className="flex flex-col items-center border border-amber-500/30 rounded bg-amber-500/10 px-2 py-1 min-w-[40px]">
                                        <span className="text-[9px] text-amber-500 uppercase leading-none mb-1 font-bold tracking-wide">Rev</span>
                                        <span className="text-xs font-bold text-amber-500">{jnHidup.toFixed(1)}h</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span>{jnHidup.toFixed(1)}h</span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                                    ${l.status === 'Approved' ? 'bg-success/10 text-success border border-success/20' :
                                      l.status === 'Declined' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                        l.status === 'IT_Approved' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                          'bg-orange-500/10 text-orange-600 border border-orange-500/20'}`}>
                                    {l.status === 'IT_Approved' ? 'Waiting Manager' : l.status}
                                  </span>
                                  {l.status === 'Declined' && l.decline_reason && (
                                    <div className="text-[10px] text-destructive italic mt-1 max-w-[120px] truncate mx-auto" title={l.decline_reason}>{l.decline_reason}</div>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <div className="flex justify-end items-center gap-2">
                                    {l.status === 'Pending' && isITSpv && (
                                      <>
                                        <button onClick={() => handleOTApprove(l.id)} className="p-1.5 hover:bg-success/20 text-success bg-success/10 border border-success/20 rounded-lg transition-colors shadow-sm" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                                        <button onClick={() => setDeclineOtId(l.id)} className="p-1.5 hover:bg-destructive/20 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg transition-colors shadow-sm" title="Decline"><XCircle className="w-4 h-4" /></button>
                                      </>
                                    )}
                                    {l.status === 'IT_Approved' && isMgmt && (
                                      <>
                                        <button onClick={() => handleOTApprove(l.id)} className="p-1.5 hover:bg-success/20 text-success bg-success/10 border border-success/20 rounded-lg transition-colors shadow-sm" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                                        <button onClick={() => setDeclineOtId(l.id)} className="p-1.5 hover:bg-destructive/20 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg transition-colors shadow-sm" title="Decline"><XCircle className="w-4 h-4" /></button>
                                      </>
                                    )}
                                    {((isITSpv || isMgmt || l.member_name === currentUser?.name) && l.status !== 'Approved' || isManager) && (
                                      <button onClick={() => { setEditingOtLog(l); setIsOtModalOpen(true); }} className="text-xs font-medium text-amber-500 hover:text-amber-600 transition-colors ml-2">Revisi</button>
                                    )}
                                    {isManager && (
                                      <button onClick={() => setDeleteOtLog(l)} className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors ml-2">Delete</button>
                                    )}
                                  </div>
                                </td>
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
          userName: currentUser?.name || '',
          isRevision: editingLeaveLog.status === 'Declined'
        } as LeaveReq);
        toast.success('Leave updated successfully');
      } else {
        const mems = isManager && selectedLeaveMembers.length > 0 ? selectedLeaveMembers : [currentUser?.name || fd.get('member_name') as string];
        for (const mName of mems) {
          if (!mName) continue;
          await createLeave({
            member_name: mName, leave_type: fd.get('leave_type') as string,
            application_date: new Date().toISOString().split('T')[0], start_date: fd.get('start_date') as string,
            end_date: fd.get('end_date') as string, days_count: Number(fd.get('days_count')), 
            reason: leaveBulkReasons[mName] || fd.get('reason') as string,
            userName: currentUser?.name || ''
          });
        }
        toast.success(`Leave application submitted${mems.length > 1 ? ` for ${mems.length} employees` : ''}`);
      }
      setIsLeaveModalOpen(false);
      setSelectedLeaveMembers([]);
      setLeaveBulkReasons({});
      setEditingLeaveLog(null);
      fetchLeaves();
      fetchBalances();
      fetchLogs();
    } catch { toast.error('Failed to submit application'); }
  };

  const handleLeaveApprove = async (l: LeaveReq) => {
    try {
      const payload: Partial<LeaveReq> = { id: l.id };

      if (l.status === 'Pending' && canApproveAsLeader(currentUser)) {
        payload.status = 'Leader_Approved';
        payload.leader_approved_by = currentUser?.name;
      } else if (l.status === 'Leader_Approved' && canApproveAsITSupervisor(currentUser)) {
        payload.status = 'IT_Approved';
        payload.it_supervisor_approved_by = currentUser?.name;
      } else if (l.status === 'IT_Approved' && canApproveAsManager(currentUser)) {
        payload.status = 'Approved';
        payload.manager_approved_by = currentUser?.name;
        payload.approved_by = currentUser?.name;
      } else {
        toast.error('Check your approval rights');
        return;
      }

      await updateLeave({ ...payload, userName: currentUser?.name || '' } as LeaveReq);
      toast.success('Leave Approved');
      fetchLeaves(); fetchLogs(); fetchBalances();
    } catch { toast.error('Failed to approve leave request'); }
  };

  const handleLeaveReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineLeaveId) return;
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await updateLeave({
        id: declineLeaveId,
        status: 'Declined',
        declined_by: currentUser?.name || '',
        decline_reason: fd.get('reason') as string,
        userName: currentUser?.name || ''
      } as unknown as LeaveReq);
      toast.success('Leave Rejected');
      setDeclineLeaveId(null);
      fetchLeaves(); fetchLogs(); fetchBalances();
    } catch { toast.error('Failed to reject leave request'); }
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
    const balancesDisplay = membersList.filter(m => m.status === 'Active' && m.member_type !== 'Management').map(m => {
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
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Leave Management</h3>
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
              <button onClick={() => exportLeaves('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> Excel</button>
              <button onClick={() => exportLeaves('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> PDF</button>
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
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-semibold text-foreground">Annual Leave Balances</h4>
                {isManager && balancesDisplay.length > 0 && (
                  <button 
                    onClick={() => {
                      if (selectedLeaveMembers.length === balancesDisplay.length) {
                        setSelectedLeaveMembers([]);
                      } else {
                        setSelectedLeaveMembers(balancesDisplay.map(s => s.name));
                      }
                    }}
                    className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                  >
                    {selectedLeaveMembers.length === balancesDisplay.length ? 'DESELECT ALL' : 'SELECT ALL'}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {balancesDisplay.map(b => {
                  const isSelectedForLeave = selectedLeaveMembers.includes(b.name);
                  return (
                    <div key={b.name} className="flex justify-between items-center text-sm p-2 hover:bg-muted/50 rounded transition-colors group relative">
                      {isManager && (
                        <div className="mr-3">
                          <input 
                            type="checkbox" 
                            checked={isSelectedForLeave} 
                            onChange={(e) => {
                              if (e.target.checked) setSelectedLeaveMembers(prev => [...prev, b.name]);
                              else setSelectedLeaveMembers(prev => prev.filter(n => n !== b.name));
                            }} 
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary outline-none cursor-pointer" 
                          />
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
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
                  );
                })}
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
                            l.status === 'Declined' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                              'bg-orange-500/10 text-orange-600 border border-orange-500/20'}`}>
                          {l.status}
                        </span>
                        {l.revision_count > 0 && <span className="ml-1 text-[9px] text-muted-foreground bg-muted px-1 rounded-sm">Rev: {l.revision_count}</span>}
                        {l.status === 'Approved' && <div className="text-[9px] text-muted-foreground mt-1">Final: {l.approved_by}</div>}
                        {l.status === 'Declined' && <div className="text-[9px] text-destructive mt-1">By: {l.approved_by}<br />Reason: {l.decline_reason}</div>}
                        {(l.status === 'Leader_Approved' || l.status === 'IT_Approved' || l.status === 'Approved') && <div className="text-[8px] text-muted-foreground mt-1">Ldr: {l.leader_approved_by || '-'}</div>}
                        {(l.status === 'IT_Approved' || l.status === 'Approved') && <div className="text-[8px] text-muted-foreground">IT: {l.it_supervisor_approved_by || '-'}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          {((l.status === 'Pending' && canApproveAsLeader(currentUser)) ||
                            (l.status === 'Leader_Approved' && canApproveAsITSupervisor(currentUser)) ||
                            (l.status === 'IT_Approved' && canApproveAsManager(currentUser))) && (
                              <>
                                <button onClick={() => handleLeaveApprove(l)} className="p-1 hover:bg-success/20 text-success rounded transition-colors" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                                <button onClick={() => setDeclineLeaveId(l.id)} className="p-1 hover:bg-destructive/20 text-destructive rounded transition-colors" title="Decline"><XCircle className="w-4 h-4" /></button>
                              </>
                            )}
                          {(isManager || l.member_name === currentUser?.name) && (
                            <button onClick={() => { setEditingLeaveLog(l); setIsLeaveModalOpen(true); }} className="p-1 hover:bg-primary/20 text-primary rounded transition-colors" title="Edit Leave"><Edit className="w-3.5 h-3.5" /></button>
                          )}
                          {isManager && (
                            <button onClick={() => setDeleteLeaveId(l.id)} className="p-1 hover:bg-destructive/20 text-destructive rounded transition-colors" title="Delete Leave"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                          {!canApproveAsLeader(currentUser) && !canApproveAsITSupervisor(currentUser) && !canApproveAsManager(currentUser) && l.status !== 'Approved' && l.status !== 'Declined' && <span className="text-[10px] text-muted-foreground italic ml-2">Wait</span>}
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
      const dataObj: Record<string, string | number>[] = membersList.filter(m => m.member_type !== 'Management').map(m => {
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
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Employee Status</h3>
            <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3 ml-1">
              <button onClick={() => exportEmpStatus('excel')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-green-600/20 text-green-600 hover:bg-green-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> Excel</button>
              <button onClick={() => exportEmpStatus('pdf')} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-600/20 text-red-600 hover:bg-red-600/10 transition-colors"><Download className="w-3.5 h-3.5" /> PDF</button>
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
                {membersList.filter(m => m.member_type !== 'Management').map(m => {
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
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold inline-block border ${isFinished ? 'bg-destructive/10 text-destructive border-destructive/20' :
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

      <Modal isOpen={isLeaveModalOpen} onClose={() => { setIsLeaveModalOpen(false); setEditingLeaveLog(null); setLeaveBulkReasons({}); }} title={editingLeaveLog ? "Edit Leave Request" : "Apply for Leave"}>
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Employee Name *</label>
            {editingLeaveLog ? (
              <input type="text" readOnly value={editingLeaveLog.member_name} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none cursor-not-allowed" />
            ) : isManager ? (
              <div className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground text-sm font-medium cursor-not-allowed">
                {selectedLeaveMembers.length > 0 ? (
                  selectedLeaveMembers.length === 1 
                    ? selectedLeaveMembers[0] 
                    : `${selectedLeaveMembers.length} Employee(s) Selected from sidebar`
                ) : 'No employees checked in sidebar'}
              </div>
            ) : (
                <input type="text" readOnly value={currentUser?.name} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none cursor-not-allowed" />
            )}
            {!isManager && !editingLeaveLog && <input type="hidden" name="member_name" value={currentUser?.name} />}
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
          {(!isManager || editingLeaveLog || selectedLeaveMembers.length <= 1) ? (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Reason *</label>
              <textarea name="reason" rows={2} required defaultValue={editingLeaveLog?.reason || ''} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Provide details for this leave..."></textarea>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              <label className="block text-sm font-medium text-foreground mb-1.5">Individual Reasons <span className="text-muted-foreground font-normal">(required)</span></label>
              <div className="max-h-[160px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {selectedLeavemembersList.map(memberName => (
                  <div key={memberName} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">{memberName}</span>
                    <input
                      type="text"
                      required
                      value={leaveBulkReasons[memberName] || ''}
                      onChange={e => setLeaveBulkReasons(prev => ({...prev, [memberName]: e.target.value}))}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" 
                      placeholder={`Reason for ${memberName}...`} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button type="button" onClick={() => { setIsLeaveModalOpen(false); setEditingLeaveLog(null); }} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface">Cancel</button>
            <button type="submit" disabled={!editingLeaveLog && isManager && selectedLeaveMembers.length === 0} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {editingLeaveLog ? "Update Request" : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isOtModalOpen} onClose={() => { setIsOtModalOpen(false); setSelectedOtMembers([]); setOtMemberSearch(''); setIsOtEmployeeDropdownOpen(false); }} title={editingOtLog ? "Revise Overtime" : "Add Overtime"}>
        <form onSubmit={handleOTSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Employee *</label>
            {editingOtLog && (!isManager || selectedOtMembers.length <= 1) ? (
              <input type="text" readOnly value={editingOtLog.member_name} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none cursor-not-allowed" />
            ) : isManager ? (
              <div className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground text-sm font-medium cursor-not-allowed">
                {selectedOtMembers.length > 0 ? (
                  selectedOtMembers.length === 1 
                    ? selectedOtMembers[0] 
                    : `${selectedOtMembers.length} Employee(s) Selected from sidebar`
                ) : (editingOtLog ? editingOtLog.member_name : 'No employees checked in sidebar')}
              </div>
            ) : (
                <input type="text" readOnly value={currentUser?.name} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none cursor-not-allowed" />
            )}
            {!isManager && !editingOtLog && <input type="hidden" name="member_name" value={currentUser?.name} />}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date *</label>
            <div className="relative">
              <input name="date" type="date" required value={otFormDate} onChange={e => setOtFormDate(e.target.value)} className="w-full px-3 py-2 text-sm font-medium bg-surface border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none" />
              {otFormDate === format(new Date(), 'yyyy-MM-dd') && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none px-2 bg-surface text-sm font-medium text-muted-foreground">
                  (Today)
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Working Hours *</label>
            <div className="flex items-center gap-3">
               <input name="ot_start_time" type="time" required value={otFormStart} onChange={e => setOtFormStart(e.target.value)} className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
               <span className="text-sm font-medium text-muted-foreground">to</span>
               <input name="ot_end_time" type="time" required value={otFormEnd} onChange={e => setOtFormEnd(e.target.value)} className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            {otFormStart && otFormEnd && otFormStart === otFormEnd ? (
               <div className="mt-2 text-sm font-medium text-destructive">
                 Start and finish cannot be the same
               </div>
            ) : liveOtDiff > 0 ? (
               <div className="mt-2 text-sm font-medium text-foreground">
                 {editingOtLog ? (
                   <div className="bg-muted/50 p-3 rounded-lg border border-border mt-3 space-y-2 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                     <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">Revision Preview</div>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <div className="text-[10px] text-muted-foreground font-semibold">Original (Before)</div>
                         <div className="flex flex-col text-[13px] opacity-70">
                           <span>⏱️ Jam Mati: {Number(editingOtLog.hours).toFixed(1)}h</span>
                           <span>✨ Jam Hidup: {calculateJamHidup(Number(editingOtLog.hours), membersList.find(m => m.name === editingOtLog.member_name)?.role || '').toFixed(1)}h</span>
                         </div>
                       </div>
                       <div className="space-y-1 border-l border-border pl-4">
                         <div className="text-[10px] text-primary font-bold">Revised (After)</div>
                         <div className="flex flex-col text-[13px] font-medium">
                           <span className={Number(editingOtLog.hours) !== liveOtDiff ? "text-primary" : "text-foreground"}>⏱️ Jam Mati: {liveOtDiff.toFixed(1)}h</span>
                           <span className={Number(editingOtLog.hours) !== liveOtDiff ? "text-primary" : "text-foreground"}>✨ Jam Hidup: {calculateJamHidup(liveOtDiff, membersList.find(m => m.name === editingOtLog.member_name)?.role || '').toFixed(1)}h</span>
                         </div>
                       </div>
                     </div>
                   </div>
                 ) : (
                   <div className="flex items-center gap-3 mt-2">
                     <div className="flex-1">
                       <span>⏱️ Jam Mati: {liveOtDiff.toFixed(1)}h</span>
                     </div>
                     <span className="invisible text-sm font-medium px-2">to</span>
                     <div className="flex-1">
                       {(selectedOtMembers.length === 1 || !isManager) && <span>✨ Jam Hidup: {calculateJamHidup(liveOtDiff, membersList.find(m => m.name === (isManager ? selectedOtMembers[0] : currentUser?.name))?.role || '').toFixed(1)}h</span>}
                     </div>
                   </div>
                 )}
                 {new Date(otFormDate).getDay() === 6 && liveOtDiff > 1 && <div className="text-orange-500 text-xs mt-2 italic">*(1h break deducted for Saturday)</div>}
               </div>
            ) : null}
          </div>

          {(!isManager || selectedOtMembers.length <= 1) ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Remarks <span className="text-muted-foreground font-normal">(recommended)</span></label>
              <input name="reason" type="text" value={otFormReason} onChange={e => setOtFormReason(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Brief description..." />
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              <label className="block text-sm font-medium text-foreground mb-1.5">Individual Remarks <span className="text-muted-foreground font-normal">(optional)</span></label>
              <div className="max-h-[160px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {selectedOtmembersList.map(memberName => (
                  <div key={memberName} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">{memberName}</span>
                    <input
                      type="text"
                      value={otBulkReasons[memberName] ?? (Array.isArray(overtimes) ? overtimes : []).find(o => o.member_name === memberName && o.request_date === (editingOtLog?.request_date || otFormDate))?.reason || ''}
                      onChange={e => setOtBulkReasons(prev => ({...prev, [memberName]: e.target.value}))}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" 
                      placeholder={`Reason for ${memberName}...`} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="pt-3 flex justify-end gap-3 border-t border-border mt-3">
            <button type="button" onClick={() => { setIsOtModalOpen(false); setSelectedOtMembers([]); setOtMemberSearch(''); setIsOtEmployeeDropdownOpen(false); }} className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors">Cancel</button>
            <button type="submit" disabled={!editingOtLog && isManager && selectedOtMembers.length === 0} className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">Save</button>
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
            Are you sure you want to remove the overtime record for <strong className="text-primary">{deleteOtLog?.member_name}</strong> on <span className="font-semibold">{deleteOtLog?.request_date ? format(new Date(deleteOtLog.request_date as string), 'dd MMM yyyy') : ''}</span>?
          </div>
          <div className="flex justify-end gap-3 pt-5 border-t border-border">
            <button onClick={() => setDeleteOtLog(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors">Cancel</button>
            <button onClick={confirmRemoveOT} className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">Remove Record</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!declineOtId} onClose={() => setDeclineOtId(null)} title="Decline Overtime Request">
        <form onSubmit={handleOTDecline} className="space-y-4">
          <p className="text-sm text-muted-foreground my-2">
            Please provide a reason for declining this overtime request.
          </p>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Decline Reason *</label>
            <textarea name="reason" rows={3} required className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Elaborate on why this is declined..."></textarea>
          </div>
          <div className="flex justify-end gap-3 pt-5 border-t border-border mt-4">
            <button type="button" onClick={() => setDeclineOtId(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">Confirm Decline</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
