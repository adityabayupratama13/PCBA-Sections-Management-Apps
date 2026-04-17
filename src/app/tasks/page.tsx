'use client';
import { useState, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Users, Check, ChevronLeft, ChevronRight, FileDown, Star } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { KanbanColumn, KanbanCard } from '@/components/KanbanBoard';
import { CommentsSection, type Comment } from '@/components/CommentsSection';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import anime from 'animejs';
import { useRef } from 'react';

type TaskState = 'Backlog' | 'In Progress' | 'Review' | 'Done';

interface Task {
  id: number;
  title: string;
  status: TaskState;
  priority: string;
  assignee: string;
  initials: string;
  due_date: string;
  actual_completion_date?: string;
  resolution?: string;
  attachments?: string; // JSON array string
  difficulty?: number;
}

interface TeamMember { id: number; name: string; status: string; }

const COLUMNS: TaskState[] = ['Backlog', 'In Progress', 'Review', 'Done'];

export default function TasksPage() {
  const { data: tasks, loading, create, update, remove } = useApi<Task>('tasks');
  const { currentUser, members } = useAuth();

  // All team members from DB
  const allMembers: TeamMember[] = members.filter(m => m.status === 'Active' && m.member_type !== 'Management');

  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const defaultStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(defaultStr);
  const [endDate, setEndDate] = useState<string>(defaultStr);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [taskComments, setTaskComments] = useState<Comment[]>([]);
  const [difficultyRating, setDifficultyRating] = useState<number>(0);
  const [hoverDifficulty, setHoverDifficulty] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tasks.length > 0 && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const openId = params.get('openId');
      if (openId) {
        const t = tasks.find(x => x.id.toString() === openId);
        if (t && !isModalOpen) {
          setTimeout(() => openEditModal(t), 100);
          window.history.replaceState(null, '', '/tasks');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);



  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(59, 130, 246); // Primary blue
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PCBA Sections Management Dashboard', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Task Tracking Report', 14, 18);
    
    // Meta info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);
    doc.text(`Total Tasks: ${filteredTasks.length}`, 14, 38);

    const tableData = filteredTasks.map(t => [t.id, t.title, t.status, t.priority, t.assignee, t.due_date ? new Date(t.due_date).toLocaleDateString() : '-', t.actual_completion_date ? new Date(t.actual_completion_date).toLocaleDateString() : '-']);
    
    autoTable(doc, { 
      startY: 45, 
      head: [['ID', 'Title', 'Status', 'Priority', 'Assignees', 'Due Date', 'Completed']], 
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 }
    });
    
    doc.save(`Tasks_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF Exported');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTasks.map(t => ({ 
      ID: t.id, Title: t.title, Status: t.status, Priority: t.priority, Assignees: t.assignee, 'Due Date': t.due_date, 'Actual Completion': t.actual_completion_date || '', Resolution: t.resolution 
    })));
    
    // Set auto column widths for Excel
    const wscols = [
      { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 30 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, `Tasks_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel Exported');
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesAssignee = filterAssignee === 'All' || t.assignee.includes(filterAssignee);
    const matchesPriority = filterPriority === 'All' || t.priority === filterPriority;
    return matchesSearch && matchesAssignee && matchesPriority;
  });

  const assignees = Array.from(new Set(tasks.flatMap(t => t.assignee.split(', '))));

  const openAddModal = (status: TaskState = 'Backlog') => {
    setEditingTask({ id: 0, title: '', status, priority: 'Medium', assignee: '', initials: '', due_date: '', actual_completion_date: '', resolution: '', attachments: '[]' });
    setSelectedAssignees([]);
    setUploadedFiles([]);
    setTaskComments([]);
    setDifficultyRating(0);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setDifficultyRating(Number((task as any).difficulty) || 0);
    const validNames = allMembers.map(m => m.name);
    const initialAssignees = task.assignee ? task.assignee.split(', ').filter(a => validNames.includes(a)) : [];
    setSelectedAssignees(initialAssignees);
    try { setUploadedFiles(JSON.parse(task.attachments || '[]')); } catch { setUploadedFiles([]); }
    try { setTaskComments(JSON.parse((task as unknown as Record<string, unknown>).comments as string || '[]')); } catch { setTaskComments([]); }
    setIsModalOpen(true);
  };



  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success('Task deleted');
    setDeleteTarget(null);
  };

  const handleStatusChange = async (taskId: number, newStatus: TaskState) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    // Auto-fill actual_completion_date when dragging to Done (if not already set)
    const actualCompletionDate = (newStatus === 'Done' && !task.actual_completion_date)
      ? new Date().toISOString().split('T')[0]
      : task.actual_completion_date || '';
    await update({ ...task, status: newStatus, dueDate: task.due_date, actualCompletionDate, userName: currentUser?.name } as unknown as Task & Record<string, unknown>);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssignees.length === 0) { toast.error('Select at least one assignee'); return; }
    const formData = new FormData(e.target as HTMLFormElement);
    const assigneeStr = selectedAssignees.join(', ');
    const initials = selectedAssignees.map(n => n.substring(0, 2).toUpperCase()).join(', ');
    const statusVal = formData.get('status') as string;
    // Auto-fill actual_completion_date if status is Done and field is empty
    let actualCompletionVal = formData.get('actualCompletionDate') as string;
    if (statusVal === 'Done' && !actualCompletionVal) {
      actualCompletionVal = new Date().toISOString().split('T')[0];
    }
    const payload = {
      title: formData.get('title') as string,
      status: statusVal,
      priority: formData.get('priority') as string,
      assignee: assigneeStr,
      initials: initials,
      dueDate: formData.get('dueDate') as string,
      actualCompletionDate: actualCompletionVal || '',
      difficulty: difficultyRating,
      resolution: formData.get('resolution') as string,
      attachments: JSON.stringify(uploadedFiles),
      comments: JSON.stringify(taskComments),
      userName: currentUser?.name || 'System',
    };
    if (editingTask && editingTask.id > 0) {
      await update({ id: editingTask.id, ...payload } as unknown as Task & Record<string, unknown>);
      toast.success('Task updated');
    } else {
      await create(payload as unknown as Partial<Task> & Record<string, unknown>);
      toast.success('Task created');
    }
    setIsModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadedFiles(prev => [...prev, data.url]);
      toast.success('File uploaded');
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const priorityDot = (p: string) => {
    const c: Record<string, string> = { High: 'bg-red-500', Medium: 'bg-amber-400', Low: 'bg-blue-400' };
    return <div className={`w-2 h-2 rounded-full ${c[p] || 'bg-gray-400'}`} />;
  };

  const inputClass = "w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all";

  useEffect(() => {
    if (!loading && containerRef.current) {
      anime({
        targets: containerRef.current.querySelectorAll('.animate-enter'),
        translateY: [30, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        easing: 'spring(1, 80, 10, 0)',
        duration: 800
      });
    }
  }, [loading]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div ref={containerRef} className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Task Tracking</h1>
          <p className="text-muted-foreground mt-1">Kanban board — {tasks.length} tasks</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportPDF} className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm" title="Export to PDF">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 bg-[#107c41] hover:bg-[#107c41]/90 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm" title="Export to Excel">
            <FileDown className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => openAddModal()} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex bg-surface p-3 rounded-lg border border-border items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap">Time Filter :</label>

        <button 
          onClick={() => { setStartDate(''); setEndDate(''); }} 
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!startDate && !endDate ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:bg-secondary'}`}
        >
          All Data
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <div className="flex items-center gap-2">
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className={`bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all ${startDate && endDate ? 'ring-1 ring-primary border-primary' : ''}`}
          />
          <span className="text-muted-foreground">-</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className={`bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all ${startDate && endDate ? 'ring-1 ring-primary border-primary' : ''}`}
          />
        </div>
        
        <p className="text-xs text-muted-foreground ml-auto hidden md:block">
          {startDate && endDate ? "Showing tasks active or due in this date range." : "Showing all tasks across all dates."}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className={inputClass + ' pl-9'} />
        </div>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className={inputClass + ' min-w-[140px] cursor-pointer'}>
          <option value="All">All Assignees</option>
          {assignees.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={inputClass + ' min-w-[120px] cursor-pointer'}>
          {['All', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="flex overflow-x-auto custom-scrollbar pb-4 gap-4 w-full">
        {COLUMNS.map(col => {
          let colTasks = filteredTasks.filter(t => t.status === col);
          
          if (startDate && endDate) {
            colTasks = colTasks.filter(t => {
              if (t.status === 'Done') return t.due_date >= startDate && t.due_date <= endDate;
              return !t.due_date || (t.due_date >= startDate && t.due_date <= endDate) || (t.due_date < startDate);
            });
          }

          return (
            <KanbanColumn key={col} title={col} count={colTasks.length}
              onAdd={() => openAddModal(col)}
              onDrop={async (taskId: number) => handleStatusChange(taskId, col)}>
              {colTasks.map(task => {
                let isStale = false;
                if (task.status !== 'Done' && task.due_date) {
                  const diffDays = (new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 3600 * 24);
                  if (diffDays > 1) isStale = true;
                }

                // Check if task was completed after the due date
                let isCompletedLate = false;
                let lateDays = 0;
                if (task.status === 'Done' && task.due_date && task.actual_completion_date) {
                  const dueMs = new Date(task.due_date).getTime();
                  const completedMs = new Date(task.actual_completion_date).getTime();
                  lateDays = Math.ceil((completedMs - dueMs) / (1000 * 3600 * 24));
                  if (lateDays > 0) isCompletedLate = true;
                }

                return (
                  <KanbanCard key={task.id} id={task.id}
                    onEdit={() => openEditModal(task)} onDelete={() => setDeleteTarget(task)}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-medium text-foreground leading-snug">{task.title}</h4>
                      {priorityDot(task.priority)}
                    </div>
                    
                    {isStale && (
                      <div className="mb-2 inline-flex items-center rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                        ⚠️ Overdue
                      </div>
                    )}

                    {isCompletedLate && (
                      <div className="mb-2 inline-flex items-center rounded-sm bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning ring-1 ring-inset ring-warning/20">
                        ⏰ Completed Late ({lateDays} {lateDays === 1 ? 'day' : 'days'})
                      </div>
                    )}

                    {task.difficulty && task.difficulty > 0 && (
                      <div className="flex justify-end mb-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-2.5 h-2.5 ${
                                star <= (task.difficulty || 0)
                                  ? 'fill-amber-500 text-amber-500'
                                  : 'text-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {task.assignee.split(', ').filter(a => allMembers.some(m => m.name === a) || a === 'Unassigned').join(', ') || 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        {task.due_date && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 whitespace-nowrap" title="Due Date">
                            <CalendarIcon className="w-3 h-3 flex-shrink-0" /><span className="opacity-60">Due:</span> {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {task.actual_completion_date && task.status === 'Done' && (
                          <span className={`text-[10px] flex items-center gap-1 whitespace-nowrap ${isCompletedLate ? 'text-warning' : 'text-success'}`} title={`Completed: ${new Date(task.actual_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}>
                            <Check className="w-3 h-3 flex-shrink-0" /><span className="opacity-60">Done:</span> {new Date(task.actual_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </KanbanCard>
                )
              })}
            </KanbanColumn>
          )
        })}
      </div>

      {/* Add/Edit Modal with multi-select assignee */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask && editingTask.id > 0 ? 'Edit Task' : 'Add Task'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Task Title *</label>
            <input name="title" required defaultValue={editingTask?.title} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status</label>
              <select name="status" defaultValue={editingTask?.status || 'Backlog'} className={inputClass + ' cursor-pointer'}>
                {COLUMNS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Priority</label>
              <select name="priority" defaultValue={editingTask?.priority || 'Medium'} className={inputClass + ' cursor-pointer'}>
                {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Difficulty</label>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1" onMouseLeave={() => setHoverDifficulty(0)}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className="focus:outline-none transition-colors duration-150"
                      onMouseEnter={() => setHoverDifficulty(star)}
                      onClick={() => setDifficultyRating(star)}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          (hoverDifficulty || difficultyRating) >= star
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-transparent text-muted-foreground/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {(hoverDifficulty || difficultyRating) === 1 ? 'Very Low' :
                   (hoverDifficulty || difficultyRating) === 2 ? 'Low' :
                   (hoverDifficulty || difficultyRating) === 3 ? 'Medium' :
                   (hoverDifficulty || difficultyRating) === 4 ? 'High' :
                   (hoverDifficulty || difficultyRating) === 5 ? 'Very High' : 'Not set'}
                </span>
                <input type="hidden" name="difficulty" value={difficultyRating} />
              </div>
            </div>
          </div>

          {/* Assignee multi-select */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Assignee * <span className="text-xs text-primary ml-1">({selectedAssignees.length} selected)</span>
            </label>
            <div className="border border-border rounded-lg max-h-36 overflow-y-auto custom-scrollbar" style={{ background: 'var(--muted)' }}>
              {allMembers.map(m => (
                <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-primary/5 cursor-pointer transition-colors border-b border-border/50 last:border-0">
                  <input type="checkbox" className="hidden" checked={selectedAssignees.includes(m.name)} onChange={() => {
                    setSelectedAssignees(prev => prev.includes(m.name) ? prev.filter(a => a !== m.name) : [...prev, m.name]);
                  }} />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedAssignees.includes(m.name) ? 'bg-primary border-primary' : 'border-border'}`}>
                    {selectedAssignees.includes(m.name) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-foreground">{m.name}</span>
                </label>
              ))}
              {allMembers.length === 0 && <p className="text-xs text-muted-foreground p-3">No team members found</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Due Date</label>
            <input name="dueDate" type="date" defaultValue={editingTask?.due_date || new Date().toISOString().split('T')[0]} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Actual Completion Date</label>
            <input name="actualCompletionDate" type="date" defaultValue={editingTask?.actual_completion_date || ''} className={inputClass} />
            <p className="text-[10px] text-muted-foreground mt-1">Auto-fills with today&apos;s date when status is set to Done.</p>
          </div>

          <div className="border-t border-border pt-4 mt-2">
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Problem Solving (Resolution)</label>
            <textarea name="resolution" rows={3} defaultValue={editingTask?.resolution} placeholder="Document how this task was completed or problems encountered..." className={inputClass}></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Attachments</label>
            <div className="flex items-center gap-3 mb-2">
              <label className={`px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded cursor-pointer text-xs font-medium transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? 'Uploading...' : 'Upload File'}
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" />
              </label>
            </div>
            {uploadedFiles.length > 0 && (
              <ul className="space-y-1">
                {uploadedFiles.map((file, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-surface border border-border rounded px-2 py-1">
                    <a href={file} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[200px]">{file.split('/').pop()}</a>
                    <button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80 font-medium ml-2">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2">
            <CommentsSection comments={taskComments} setComments={setTaskComments} />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border sticky bottom-0 bg-white dark:bg-surface pb-1">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-primary/5 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
              {editingTask && editingTask.id > 0 ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Task" message={`Delete "${deleteTarget?.title}"?`} />
    </div>
  );
}
