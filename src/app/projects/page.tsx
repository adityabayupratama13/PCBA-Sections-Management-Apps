'use client';
import { useState, useMemo, useEffect } from 'react';
import { Plus, FolderKanban, TrendingUp, CheckCircle2, Edit2, Trash2, Link2, ListChecks, CalendarDays, Zap } from 'lucide-react';
import { GanttRow } from '@/components/GanttRow';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed';
type TaskState = 'Backlog' | 'In Progress' | 'Review' | 'Done';

interface TaskItem {
  id: number;
  title: string;
  status: TaskState;
  priority: string;
  assignee: string;
}

interface ScheduleItem {
  id: number;
  title: string;
  type: string;
  start_time: string;
  end_time: string;
  assignee: string;
}

interface DbProject {
  id: number;
  name: string;
  pic: string;
  start_date: string;
  end_date: string;
  progress: number;
  status: string;
  linked_tasks: string;
  linked_schedules: string;
}

const mapProject = (p: DbProject) => ({
  id: p.id,
  name: p.name,
  pic: p.pic,
  startDate: p.start_date,
  endDate: p.end_date,
  progress: p.progress,
  status: p.status as ProjectStatus,
  linkedTasks: JSON.parse(p.linked_tasks || '[]') as number[],
  linkedSchedules: JSON.parse(p.linked_schedules || '[]') as number[],
});

type Project = ReturnType<typeof mapProject>;

export default function ProjectsPage() {
  const { data: rawProjects, loading, create, update: apiUpdate, remove } = useApi<DbProject>('projects');
  const projects = useMemo(() => rawProjects.map(mapProject), [rawProjects]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [selectedLinkedTasks, setSelectedLinkedTasks] = useState<number[]>([]);
  const [selectedLinkedSchedules, setSelectedLinkedSchedules] = useState<number[]>([]);
  const [selectedPICs, setSelectedPICs] = useState<string[]>([]);
  const [showPICDropdown, setShowPICDropdown] = useState(false);
  const [endDateValue, setEndDateValue] = useState('');
  const [startDateValue, setStartDateValue] = useState('');
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [allSchedules, setAllSchedules] = useState<ScheduleItem[]>([]);
  const { members } = useAuth();

  // Fetch tasks & schedules from DB
  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(setAllTasks).catch(() => {});
    fetch('/api/schedules').then(r => r.json()).then(setAllSchedules).catch(() => {});
  }, [isModalOpen, expandedProject]);

  const getAutoProgress = (project: Project) => {
    if (!project.linkedTasks?.length) return project.progress;
    const linked = allTasks.filter(t => project.linkedTasks.includes(t.id));
    if (!linked.length) return project.progress;
    const done = linked.filter(t => t.status === 'Done').length;
    return Math.round((done / linked.length) * 100);
  };

  // Removed Gantt extremes

  const openAddModal = () => {
    setEditingProject(null); setProgressValue(0);
    setSelectedLinkedTasks([]); setSelectedLinkedSchedules([]);
    setSelectedPICs([]); setShowPICDropdown(false);
    setStartDateValue(new Date().toISOString().split('T')[0]);
    setEndDateValue('');
    setIsModalOpen(true);
  };
  const openEditModal = (project: Project) => {
    const validTasks = (project.linkedTasks || []).filter(tid => allTasks.some(t => t.id === tid));
    const validSchedules = (project.linkedSchedules || []).filter(sid => allSchedules.some(s => s.id === sid));
    setEditingProject(project);
    setProgressValue(project.progress);
    setSelectedLinkedTasks(validTasks);
    setSelectedLinkedSchedules(validSchedules);
    // PIC: support both old single string and new comma-separated
    setSelectedPICs(project.pic ? project.pic.split(', ').filter(Boolean) : []);
    setShowPICDropdown(false);
    setStartDateValue(project.startDate || new Date().toISOString().split('T')[0]);
    setEndDateValue(project.endDate || '');
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success(`Project "${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const payload = {
      name: formData.get('name') as string,
      pic: selectedPICs.join(', '),
      startDate: startDateValue,
      endDate: endDateValue,
      progress: progressValue,
      status: formData.get('status') as string,
      linkedTasks: selectedLinkedTasks,
      linkedSchedules: selectedLinkedSchedules,
    };
    if (editingProject) {
      await apiUpdate({ id: editingProject.id, ...payload } as unknown as DbProject & Record<string, unknown>);
      toast.success(`Project "${payload.name}" updated`);
    } else {
      await create(payload as unknown as Partial<DbProject> & Record<string, unknown>);
      toast.success(`Project "${payload.name}" created`);
    }
    setIsModalOpen(false);
  };

  const toggleTaskLink = (id: number) => setSelectedLinkedTasks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleScheduleLink = (id: number) => setSelectedLinkedSchedules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const activeProjects = projects.filter(p => p.status === 'Active').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + getAutoProgress(p), 0) / projects.length) : 0;

  const picOptions = useMemo(() => members.filter(m => m.member_type !== 'Management').map(m => m.name), [members]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'Done': return 'bg-success/15 text-success border-success/25';
      case 'In Progress': return 'bg-primary/15 text-primary border-primary/25';
      case 'Review': return 'bg-orange-500/15 text-orange-400 border-orange-500/25';
      default: return 'bg-gray-500/15 text-gray-400 border-gray-500/25';
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Project Plan</h1>
          <p className="text-muted-foreground mt-1">High-level overview and timelines</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Project
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-3 bg-primary/15 text-primary rounded-xl border border-primary/20"><FolderKanban className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-muted-foreground">Active Projects</p><h3 className="text-2xl font-bold text-foreground">{activeProjects}</h3></div>
        </div>
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-3 bg-success/15 text-success rounded-xl border border-success/20"><CheckCircle2 className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-muted-foreground">Completed</p><h3 className="text-2xl font-bold text-success">{completedProjects}</h3></div>
        </div>
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-3 bg-violet-500/15 text-violet-400 rounded-xl border border-violet-500/20"><TrendingUp className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-muted-foreground">Average Progress</p><h3 className="text-2xl font-bold text-violet-400">{avgProgress}%</h3></div>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0" style={{ background: 'var(--muted)' }}>
          <h2 className="font-semibold text-foreground flex items-center gap-2">Timeline Overview</h2>
          <div className="flex gap-4 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-secondary opacity-80" /> Planning</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-primary opacity-80" /> Active</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-destructive/80 opacity-80" /> On Hold</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-success opacity-80" /> Completed</span>
          </div>
        </div>
        <div className="p-4 overflow-x-auto custom-scrollbar">
          <div className="min-w-[950px]">
            <div className="flex border-b border-border/50 pb-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider relative">
              <div className="w-[30%] pl-4 shrink-0">Project Details</div>
              
              {/* Dynamic Calendar Header */}
              <div className="flex-1 flex justify-between pr-4 relative h-4 overflow-hidden">
                {(() => {
                  if (projects.length === 0) return <span className="opacity-80">Timeline</span>;
                  const dates = projects.flatMap(p => [new Date(p.startDate).getTime(), new Date(p.endDate).getTime()]);
                  const minTime = Math.min(...dates);
                  const maxTime = Math.max(...dates);
                  const startDate = new Date(minTime);
                  const endDate = new Date(maxTime);
                  // add a small buffer of 14 days to the ends
                  startDate.setDate(startDate.getDate() - 14);
                  endDate.setDate(endDate.getDate() + 14);
                  
                  const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
                  
                  // generate monthly markers
                  const markers = [];
                  for (let curr = new Date(startDate); curr <= endDate; curr.setMonth(curr.getMonth() + 1)) {
                    const offsetDays = (curr.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
                    const leftPct = (offsetDays / totalDays) * 100;
                    if (leftPct >= 0 && leftPct <= 100) {
                      markers.push(
                        <div key={curr.toISOString()} className="absolute flex flex-col items-center" style={{ left: `${leftPct}%` }}>
                          <span className="text-[10px] whitespace-nowrap -translate-x-1/2 opacity-70">
                            {curr.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      );
                    }
                  }
                  return markers;
                })()}
              </div>
            </div>
            <div className="space-y-1 relative">
              {/* Background grid lines for months */}
              <div className="absolute inset-0 left-[30%] right-[16px] pointer-events-none opacity-5 flex">
                {(() => {
                   if (projects.length === 0) return null;
                   // Re-calculate to keep grid matching header
                   const dates = projects.flatMap(p => [new Date(p.startDate).getTime(), new Date(p.endDate).getTime()]);
                   const minTime = Math.min(...dates);
                   const maxTime = Math.max(...dates);
                   const startDate = new Date(minTime);
                   const endDate = new Date(maxTime);
                   startDate.setDate(startDate.getDate() - 14);
                   endDate.setDate(endDate.getDate() + 14);
                   const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
                   
                   const lines = [];
                   for (let curr = new Date(startDate); curr <= endDate; curr.setMonth(curr.getMonth() + 1)) {
                     const offsetDays = (curr.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
                     const leftPct = (offsetDays / totalDays) * 100;
                     if (leftPct >= 0 && leftPct <= 100) {
                       lines.push(<div key={`line-${curr.toISOString()}`} className="absolute top-0 bottom-0 w-px bg-foreground" style={{ left: `${leftPct}%` }} />);
                     }
                   }
                   return lines;
                })()}
              </div>

              {[...projects].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map(project => {
                const autoProgress = getAutoProgress(project);
                const hasLinks = (project.linkedTasks?.length > 0) || (project.linkedSchedules?.length > 0);
                const isExpanded = expandedProject === project.id;
                
                // Timeline boundary calculation for GanttRow prop passing
                let globalStartDate = new Date();
                let totalDays = 1;
                if (projects.length > 0) {
                  const dates = projects.flatMap(p => [new Date(p.startDate).getTime(), new Date(p.endDate).getTime()]);
                  globalStartDate = new Date(Math.min(...dates));
                  const globalEndDate = new Date(Math.max(...dates));
                  globalStartDate.setDate(globalStartDate.getDate() - 14);
                  globalEndDate.setDate(globalEndDate.getDate() + 14);
                  totalDays = Math.max(1, (globalEndDate.getTime() - globalStartDate.getTime()) / (1000 * 3600 * 24));
                }

                return (
                  <div key={project.id}>
                    <div className="group relative cursor-pointer" onClick={() => setExpandedProject(isExpanded ? null : project.id)}>
                      <GanttRow 
                        name={project.name} 
                        pic={project.pic} 
                        startDate={new Date(project.startDate)} 
                        endDate={new Date(project.endDate)} 
                        progress={autoProgress} 
                        status={project.status} 
                        globalStartDate={globalStartDate}
                        totalDays={totalDays}
                      />
                      {hasLinks && (
                        <div className="absolute left-[29%] top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 bg-surface/80 px-1 rounded backdrop-blur-sm">
                          <Link2 className="w-3 h-3 text-primary" />
                          <span className="text-[10px] text-primary font-medium">{(project.linkedTasks?.length || 0) + (project.linkedSchedules?.length || 0)} linked</span>
                        </div>
                      )}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 z-20">
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(project); }} className="p-1.5 bg-white dark:bg-surface border border-border rounded-md text-muted-foreground hover:text-primary transition-colors shadow-sm" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }} className="p-1.5 bg-white dark:bg-surface border border-border rounded-md text-muted-foreground hover:text-destructive transition-colors shadow-sm" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {isExpanded && hasLinks && (
                      <div className="ml-8 mr-4 mb-2 p-3 rounded-lg border border-border/50 space-y-2" style={{ background: 'var(--muted)' }}>
                        {project.linkedTasks?.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><ListChecks className="w-3 h-3" /> Linked Tasks</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {project.linkedTasks.map(tid => {
                                const task = allTasks.find(t => t.id === tid);
                                if (!task) return null;
                                return <span key={tid} className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusColor(task.status)}`}>{task.title} · {task.status}</span>;
                              })}
                            </div>
                          </div>
                        )}
                        {project.linkedSchedules?.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Linked Schedules</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {project.linkedSchedules.map(sid => {
                                const sch = allSchedules.find(s => s.id === sid);
                                if (!sch) return null;
                                return <span key={sid} className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-violet-500/15 text-violet-400 border-violet-500/25">{sch.title} · {sch.start_time}–{sch.end_time}</span>;
                              })}
                            </div>
                          </div>
                        )}
                        {project.linkedTasks?.length > 0 && (
                          <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                            <Zap className="w-3 h-3 text-primary" />
                            <span className="text-[10px] text-primary font-medium">Auto-progress from tasks: {autoProgress}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProject ? 'Edit Project' : 'Add Project Plan'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Project Name *</label>
            <input name="name" required defaultValue={editingProject?.name} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all invalid:border-destructive" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              {/* PIC multi-select */}
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">PIC / Assignee(s)</label>
              <div className="relative">
                <div
                  onClick={() => setShowPICDropdown(!showPICDropdown)}
                  className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground cursor-pointer min-h-[42px] flex flex-wrap gap-1 items-center"
                >
                  {selectedPICs.length === 0 && <span className="text-muted-foreground text-sm">Select members...</span>}
                  {selectedPICs.map(p => (
                    <span key={p} className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/25 font-medium flex items-center gap-1">
                      {p}
                      <button type="button" onClick={ev => { ev.stopPropagation(); setSelectedPICs(prev => prev.filter(x => x !== p)); }} className="hover:text-destructive">×</button>
                    </span>
                  ))}
                </div>
                {showPICDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-border shadow-lg max-h-40 overflow-y-auto custom-scrollbar" style={{ background: 'var(--surface)' }}>
                    {picOptions.map(name => (
                      <label key={name} className="flex items-center gap-2 px-3 py-2 hover:bg-primary/5 cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedPICs.includes(name)}
                          onChange={() => setSelectedPICs(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])}
                          className="rounded border-border" />
                        <span className="text-foreground">{name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status</label>
              <select name="status" defaultValue={editingProject?.status || 'Planning'} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
                {['Planning', 'Active', 'On Hold', 'Completed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Start Date *</label>
              <input name="startDate" type="date" required value={startDateValue} onChange={e => setStartDateValue(e.target.value)} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">End Date *</label>
              <input name="endDate" type="date" required value={endDateValue} onChange={e => setEndDateValue(e.target.value)} className="w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Progress: {progressValue}%</label>
            <input type="range" min="0" max="100" value={progressValue} onChange={(e) => setProgressValue(Number(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-background rounded-lg appearance-none cursor-pointer accent-primary" />
            {selectedLinkedTasks.length > 0 && <p className="text-[10px] text-primary mt-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Progress will auto-update from linked tasks</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><ListChecks className="w-4 h-4 text-primary" /> Link Tasks ({selectedLinkedTasks.length})</label>
            <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1 custom-scrollbar" style={{ background: 'var(--background)' }}>
              {allTasks.map(task => (
                <label key={task.id} className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm ${selectedLinkedTasks.includes(task.id) ? 'bg-primary/10' : 'hover:bg-primary/5'}`}>
                  <input type="checkbox" checked={selectedLinkedTasks.includes(task.id)} onChange={() => toggleTaskLink(task.id)} className="rounded border-border accent-primary" />
                  <span className="flex-1 truncate text-foreground">{task.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${statusColor(task.status)}`}>{task.status}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-violet-400" /> Link Schedules ({selectedLinkedSchedules.length})</label>
            <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1 custom-scrollbar" style={{ background: 'var(--background)' }}>
              {allSchedules.map(sch => (
                <label key={sch.id} className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm ${selectedLinkedSchedules.includes(sch.id) ? 'bg-violet-500/10' : 'hover:bg-violet-500/5'}`}>
                  <input type="checkbox" checked={selectedLinkedSchedules.includes(sch.id)} onChange={() => toggleScheduleLink(sch.id)} className="rounded border-border accent-violet-500" />
                  <span className="flex-1 truncate text-foreground">{sch.title}</span>
                  <span className="text-[10px] text-muted-foreground">{sch.start_time}–{sch.end_time}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">{editingProject ? 'Save Changes' : 'Add Project'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Project" message={`Are you sure you want to delete "${deleteTarget?.name}"?`} />
    </div>
  );
}
