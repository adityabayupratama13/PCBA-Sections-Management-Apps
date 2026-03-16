'use client';
import { useState, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Users, Check, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KanbanColumn, KanbanCard } from '@/components/KanbanBoard';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

type TaskState = 'Backlog' | 'In Progress' | 'Review' | 'Done';

interface Task {
  id: number;
  title: string;
  status: TaskState;
  priority: string;
  assignee: string;
  initials: string;
  due_date: string;
  resolution?: string;
  attachments?: string; // JSON array string
}

interface TeamMember { id: number; name: string; status: string; }

const COLUMNS: TaskState[] = ['Backlog', 'In Progress', 'Review', 'Done'];

export default function TasksPage() {
  const { data: tasks, loading, create, update, remove } = useApi<Task>('tasks');
  const { currentUser, members } = useAuth();

  // All team members from DB
  const allMembers: TeamMember[] = members.filter(m => m.status === 'Active');

  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState<string>(''); // For daily filter
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  useEffect(() => {
    setFilterDate(new Date().toISOString().split('T')[0]);
  }, []);

  const navigateDate = (days: number) => {
    if (!filterDate) {
      const today = new Date();
      setFilterDate(today.toISOString().split('T')[0]);
      return;
    }
    const d = new Date(filterDate);
    d.setUTCDate(d.getUTCDate() + days);
    setFilterDate(d.toISOString().split('T')[0]);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Task Tracking Report', 14, 15);
    const tableData = filteredTasks.map(t => [t.id, t.title, t.status, t.priority, t.assignee, t.due_date ? new Date(t.due_date).toLocaleDateString() : '-']);
    autoTable(doc, { startY: 20, head: [['ID', 'Title', 'Status', 'Priority', 'Assignees', 'Due Date']], body: tableData });
    doc.save(`Tasks_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF Exported');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTasks.map(t => ({ 
      ID: t.id, Title: t.title, Status: t.status, Priority: t.priority, Assignees: t.assignee, 'Due Date': t.due_date, Resolution: t.resolution 
    })));
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
    setEditingTask({ id: 0, title: '', status, priority: 'Medium', assignee: '', initials: '', due_date: '', resolution: '', attachments: '[]' });
    setSelectedAssignees([]);
    setUploadedFiles([]);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    const validNames = allMembers.map(m => m.name);
    const initialAssignees = task.assignee ? task.assignee.split(', ').filter(a => validNames.includes(a)) : [];
    setSelectedAssignees(initialAssignees);
    try { setUploadedFiles(JSON.parse(task.attachments || '[]')); } catch { setUploadedFiles([]); }
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
    await update({ ...task, status: newStatus, dueDate: task.due_date, userName: currentUser?.name } as unknown as Task & Record<string, unknown>);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssignees.length === 0) { toast.error('Select at least one assignee'); return; }
    const formData = new FormData(e.target as HTMLFormElement);
    const assigneeStr = selectedAssignees.join(', ');
    const initials = selectedAssignees.map(n => n.substring(0, 2).toUpperCase()).join(', ');
    const payload = {
      title: formData.get('title') as string,
      status: formData.get('status') as string,
      priority: formData.get('priority') as string,
      assignee: assigneeStr,
      initials: initials,
      dueDate: formData.get('dueDate') as string,
      resolution: formData.get('resolution') as string,
      attachments: JSON.stringify(uploadedFiles),
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 pb-8">
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
        <label className="text-sm font-medium text-foreground whitespace-nowrap">Daily Filter :</label>
        <div className="flex items-center gap-1">
          <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-secondary rounded text-muted-foreground transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
            className="bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={() => navigateDate(1)} className="p-1 hover:bg-secondary rounded text-muted-foreground transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {filterDate && (
          <button onClick={() => setFilterDate('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
        <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
          Show tasks active/due on this day, overriding rollovers
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

      <div className="flex overflow-x-auto custom-scrollbar pb-4 gap-4">
        {COLUMNS.map(col => {
          let colTasks = filteredTasks.filter(t => t.status === col);
          
          if (filterDate) {
            colTasks = colTasks.filter(t => {
              if (t.status === 'Done') return t.due_date === filterDate;
              return !t.due_date || t.due_date <= filterDate;
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

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {task.assignee.split(', ').filter(a => allMembers.some(m => m.name === a) || a === 'Unassigned').join(', ') || 'Unassigned'}
                        </span>
                      </div>
                      {task.due_date && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <input name="dueDate" type="date" defaultValue={editingTask?.due_date} className={inputClass} />
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

          <div className="pt-4 flex justify-end gap-3 border-t border-border">
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
