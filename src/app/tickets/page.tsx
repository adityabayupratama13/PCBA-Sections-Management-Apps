'use client';
import { useState, useEffect } from 'react';
import { Search, AlertCircle, Edit2, Trash2, Plus, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DataTable } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { CommentsSection, type Comment } from '@/components/CommentsSection';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

interface Ticket {
  id: string;
  title: string;
  reporter: string;
  priority: string;
  status: string;
  created_date: string;
  resolution?: string;
  attachments?: string; // JSON Array string
}

export default function TicketsPage() {
  const { data: tickets, loading, create, update, remove } = useApi<Ticket>('tickets');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterDate, setFilterDate] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [ticketComments, setTicketComments] = useState<Comment[]>([]);
  const { currentUser } = useAuth();

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
    
    // Header
    doc.setFillColor(59, 130, 246); // Primary blue
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('IT Management Dashboard', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Help Desk Tickets Report', 14, 18);
    
    // Meta info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);
    doc.text(`Total Tickets: ${filteredTickets.length}`, 14, 38);

    const tableData = filteredTickets.map(t => [t.id, t.title, t.reporter, t.priority, t.status, new Date(t.created_date).toLocaleDateString()]);
    
    autoTable(doc, { 
      startY: 45, 
      head: [['ID', 'Title', 'Reporter', 'Priority', 'Status', 'Created Date']], 
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 }
    });
    
    doc.save(`Tickets_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF Exported');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTickets.map(t => ({ 
      ID: t.id, Title: t.title, Reporter: t.reporter, Priority: t.priority, Status: t.status, 'Created Date': new Date(t.created_date).toLocaleString(), Resolution: t.resolution 
    })));
    
    // Auto-size columns for Excel
    const wscols = [
      { wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
    XLSX.writeFile(wb, `Tickets_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel Exported');
  };

  let filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
    const matchesPriority = filterPriority === 'All' || t.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (filterDate) {
    filteredTickets = filteredTickets.filter(t => {
      const createdStr = t.created_date.substring(0, 10);
      if (t.status === 'Done') return createdStr === filterDate;
      return createdStr <= filterDate; // Rollover unresolved past tickets
    });
  }

  const openAddModal = () => { 
    setEditingTicket(null); 
    setUploadedFiles([]);
    setTicketComments([]);
    setIsModalOpen(true); 
  };
  const openEditModal = (ticket: Ticket) => { 
    setEditingTicket(ticket); 
    try { setUploadedFiles(JSON.parse(ticket.attachments || '[]')); } catch { setUploadedFiles([]); }
    try { setTicketComments(JSON.parse((ticket as any).comments || '[]')); } catch { setTicketComments([]); }
    setIsModalOpen(true); 
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success(`Ticket ${deleteTarget.id} deleted (daily log entries removed)`);
    setDeleteTarget(null);
  };

  const handleInlineStatusChange = async (ticketId: string, newStatus: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    await update({ ...ticket, status: newStatus, userName: currentUser?.name } as unknown as Ticket & Record<string, unknown>);
    toast.success(`Ticket ${ticketId} → ${newStatus}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const payload = {
      title: formData.get('title') as string,
      reporter: formData.get('reporter') as string,
      priority: formData.get('priority') as string,
      status: formData.get('status') as string,
      resolution: formData.get('resolution') as string,
      attachments: JSON.stringify(uploadedFiles),
      comments: JSON.stringify(ticketComments),
      userName: currentUser?.name || 'System',
    };
    if (editingTicket) {
      await update({ id: editingTicket.id, ...payload } as unknown as Ticket & Record<string, unknown>);
      toast.success(`Ticket ${editingTicket.id} updated`);
    } else {
      await create(payload as unknown as Partial<Ticket> & Record<string, unknown>);
      toast.success('Ticket created');
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

  const inputClass = "w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all";

  const columns = [
    { header: 'ID', accessor: 'id' as keyof Ticket, className: 'font-mono text-primary font-bold whitespace-nowrap' },
    { 
      header: 'Title', 
      accessor: (t: Ticket) => {
        let isStale = false;
        if (t.status !== 'Done' && t.status !== 'Closed') {
          const diffDays = (new Date().getTime() - new Date(t.created_date).getTime()) / (1000 * 3600 * 24);
          if (diffDays > 1) isStale = true;
        }
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="font-medium text-foreground">{t.title}</span>
            {isStale && <span className="inline-flex items-center rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive ring-1 ring-inset ring-destructive/20 leading-none">⚠️ Overdue</span>}
          </div>
        );
      }
    },
    { header: 'Reporter', accessor: 'reporter' as keyof Ticket, className: 'whitespace-nowrap' },
    {
      header: 'Priority', accessor: (t: Ticket) => {
        const styles: Record<string, string> = { Critical: 'bg-red-500/15 text-red-400 border-red-500/25', High: 'bg-orange-500/15 text-orange-400 border-orange-500/25', Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25', Low: 'bg-blue-500/15 text-blue-400 border-blue-500/25' };
        return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${styles[t.priority] || ''}`}>{t.priority}</span>;
      }
    },
    {
      header: 'Status', accessor: (t: Ticket) => (
        <select value={t.status} onChange={e => handleInlineStatusChange(t.id, e.target.value)}
          className="text-xs font-medium bg-transparent border border-border rounded-md px-2 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary">
          {['Backlog', 'In Progress', 'Review', 'Done'].map(s => <option key={s}>{s}</option>)}
        </select>
      )
    },
    {
      header: 'Created', accessor: (t: Ticket) => {
        const d = new Date(t.created_date);
        return <span className="text-muted-foreground text-xs whitespace-nowrap">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>;
      }
    },
    {
      header: 'Actions', accessor: (t: Ticket) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEditModal(t)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(t)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Help Desk Tickets</h1>
          <p className="text-muted-foreground mt-1">Track IT support requests — {tickets.length} tickets</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportPDF} className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm" title="Export to PDF">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 bg-[#107c41] hover:bg-[#107c41]/90 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm" title="Export to Excel">
            <FileDown className="w-4 h-4" /> Excel
          </button>
          <button onClick={openAddModal} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>
      </div>

      {/* Info: Workflow */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border text-xs text-muted-foreground" style={{ background: 'var(--surface)' }}>
        <span className="w-4 h-4 text-emerald-400 flex-shrink-0">⚡</span>
        <span><strong className="text-foreground">Auto-sync:</strong> Creating a ticket auto-creates a Task + Daily Log. Status changes sync across all three automatically.</span>
      </div>

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
          Show tickets active on this day, overriding rollovers
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className={inputClass + ' pl-9'} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputClass + ' min-w-[130px] cursor-pointer'}>
          {['All', 'Backlog', 'In Progress', 'Review', 'Done'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={inputClass + ' min-w-[120px] cursor-pointer'}>
          {['All', 'Critical', 'High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl" style={{ background: 'var(--surface)' }}>
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-foreground">No tickets found</h3>
          <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <DataTable data={filteredTickets} columns={columns} isLoading={loading} />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTicket ? 'Edit Ticket' : 'New Ticket'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Title *</label>
            <input name="title" required defaultValue={editingTicket?.title} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Reporter *</label>
              <input name="reporter" required defaultValue={editingTicket?.reporter} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Priority</label>
              <select name="priority" defaultValue={editingTicket?.priority || 'Medium'} className={inputClass + ' cursor-pointer'}>
                {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status</label>
            <select name="status" defaultValue={editingTicket?.status || 'Backlog'} className={inputClass + ' cursor-pointer'}>
              {['Backlog', 'In Progress', 'Review', 'Done'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="border-t border-border pt-4 mt-2">
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Problem Solving (Resolution)</label>
            <textarea name="resolution" rows={3} defaultValue={editingTicket?.resolution} placeholder="Document how this ticket was resolved..." className={inputClass}></textarea>
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
            <CommentsSection comments={ticketComments} setComments={setTicketComments} />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-primary/5 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">{editingTicket ? 'Save Changes' : 'Create Ticket'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Ticket" message={`Delete ticket ${deleteTarget?.id}? Related daily log entries will also be removed.`} />
    </div>
  );
}
