'use client';
import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Briefcase, Users } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { canManageTeam } from '@/lib/permissions';

interface Position {
  id: number;
  name: string;
  division: string;
  level: string;
  description: string;
  created_at?: string;
}

const LEVEL_ORDER = ['Manager', 'Supervisor', 'Senior', 'Staff'];
const LEVEL_COLORS: Record<string, string> = {
  Manager:    'bg-violet-500/15 text-violet-400 border-violet-500/25',
  Supervisor: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Senior:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Staff:      'bg-orange-500/15 text-orange-400 border-orange-500/25',
};

const DIVISIONS = ['Management', 'Software Dev', 'Infrastructure', 'Helpdesk', 'IT Department', 'Hardware'];

export default function PositionsPage() {
  const { data: positions, loading, create, update, remove } = useApi<Position>('positions');
  const { currentUser } = useAuth();
  const canEdit = canManageTeam(currentUser);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);
  const [managingDesc, setManagingDesc] = useState<Position | null>(null);
  const [newDescText, setNewDescText] = useState('');

  const getDescriptionsList = (descStr: string): { id: number, text: string }[] => {
    if (!descStr) return [];
    try {
      const parsed = JSON.parse(descStr);
      if (Array.isArray(parsed)) return parsed;
      return [{ id: Date.now(), text: descStr }];
    } catch {
      return [{ id: Date.now(), text: descStr }];
    }
  };

  const filtered = positions.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const matchLevel = filterLevel === 'All' || p.level === filterLevel;
    return matchSearch && matchLevel;
  });

  const openAddModal = () => { setEditingPosition(null); setIsModalOpen(true); };
  const openEditModal = (p: Position) => { setEditingPosition(p); setIsModalOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) toast.success(`"${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const payload = {
      name: (fd.get('name') as string).trim(),
      division: fd.get('division') as string,
      level: fd.get('level') as string,
      description: editingPosition ? editingPosition.description : '[]',
      userName: currentUser?.name || 'System',
    };
    if (!payload.name) { toast.error('Name required'); return; }

    if (editingPosition) {
      const res = await update({ id: editingPosition.id, ...payload } as unknown as Position & Record<string, unknown>);
      if (res !== null) { toast.success(`"${payload.name}" updated`); setIsModalOpen(false); }
    } else {
      const res = await create(payload as unknown as Partial<Position> & Record<string, unknown>);
      if (res !== null) { toast.success(`"${payload.name}" created`); setIsModalOpen(false); }
    }
  };

  const inputClass = "w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all";

  const columns = [
    {
      header: 'Position Name',
      accessor: (p: Position) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Briefcase className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-foreground">{p.name}</div>
            {p.created_at && <div className="text-xs text-muted-foreground">Since {new Date(p.created_at).getFullYear()}</div>}
          </div>
        </div>
      )
    },
    {
      header: 'Division',
      accessor: (p: Position) => <span className="text-sm text-foreground">{p.division}</span>
    },
    {
      header: 'Level',
      accessor: (p: Position) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${LEVEL_COLORS[p.level] || LEVEL_COLORS.Staff}`}>
          {p.level}
        </span>
      )
    },
    {
      header: 'Description',
      accessor: (p: Position) => {
        const list = getDescriptionsList(p.description);
        return <span className="text-sm text-muted-foreground">{list.length} Details</span>;
      }
    },
    {
      header: 'Actions',
      accessor: (p: Position) => canEdit ? (
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => openEditModal(p)} className="text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(p)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">View only</span>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Job Positions</h1>
          <p className="text-muted-foreground mt-1">Master data jabatan — {positions.length} positions</p>
        </div>
        {canEdit && (
          <button onClick={openAddModal}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Add Position
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 flex flex-col sm:flex-row gap-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search positions..." value={search} onChange={e => setSearch(e.target.value)} className={inputClass + ' pl-9'} />
        </div>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className={inputClass + ' min-w-[140px] cursor-pointer'}>
          <option value="All">All Levels</option>
          {LEVEL_ORDER.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={filtered} keyExtractor={p => p.id} onRowClick={(p) => setManagingDesc(p)} isLoading={loading} />

      {/* Info */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border text-sm" style={{ background: 'var(--surface)' }}>
        <Users className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-muted-foreground">Positions here appear as role options in the <strong className="text-foreground">Team</strong> module.</span>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPosition ? 'Edit Position' : 'Add New Position'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Position Name *</label>
            <input name="name" required defaultValue={editingPosition?.name} className={inputClass} placeholder="e.g. Network Engineer" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Division *</label>
              <select name="division" defaultValue={editingPosition?.division || 'IT Department'} className={inputClass + ' cursor-pointer'}>
                {DIVISIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Level *</label>
              <select name="level" defaultValue={editingPosition?.level || 'Staff'} className={inputClass + ' cursor-pointer'}>
                {LEVEL_ORDER.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border hover:bg-primary/5 transition-colors" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium transition-colors">
              {editingPosition ? 'Save Changes' : 'Add Position'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Job Descriptions Modal */}
      <Modal isOpen={!!managingDesc} onClose={() => { setManagingDesc(null); setNewDescText(''); }} title={`Position Profile: ${managingDesc?.name}`} maxWidth="max-w-4xl">
        {managingDesc && (() => {
          const list = getDescriptionsList(managingDesc.description);
          
          const handleAddDesc = async (e?: React.FormEvent) => {
             e?.preventDefault();
             if (!newDescText.trim()) return;
             const newList = [...list, { id: Date.now(), text: newDescText.trim() }];
             setNewDescText('');
             const res = await update({ ...managingDesc, description: JSON.stringify(newList) } as unknown as Position & Record<string, unknown>);
             if (res) { setManagingDesc({ ...managingDesc, description: JSON.stringify(newList) }); toast.success('Detail added'); }
          };

          const handleDeleteDesc = async (id: number) => {
             const newList = list.filter(d => d.id !== id);
             const res = await update({ ...managingDesc, description: JSON.stringify(newList) } as unknown as Position & Record<string, unknown>);
             if (res) { setManagingDesc({ ...managingDesc, description: JSON.stringify(newList) }); toast.success('Detail deleted'); }
          };

          const formatDate = (ts: number) => {
            if (!ts || ts < 1000000000000) return 'Legacy Data';
            const d = new Date(ts);
            return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`;
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
              {/* Left Column: Details */}
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-3">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{managingDesc.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{managingDesc.division}</p>
                  
                  <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Level</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-block ${LEVEL_COLORS[managingDesc.level] || LEVEL_COLORS.Staff}`}>
                        {managingDesc.level}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Responsibilities</span>
                      <span className="text-sm font-medium text-foreground">{list.length} Items</span>
                    </div>
                    {managingDesc.created_at && (
                      <div>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Created Date</span>
                        <span className="text-sm font-medium text-foreground">
                          {new Date(managingDesc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Descriptions List */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Job Responsibilities & Descriptions</h3>
                </div>
                
                <form onSubmit={handleAddDesc} className="flex gap-2">
                  <input value={newDescText} onChange={e => setNewDescText(e.target.value)} placeholder="Type new job responsibility..." className={inputClass} />
                  <button type="submit" className="px-5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex-shrink-0 transition-colors shadow-sm">Add Item</button>
                </form>

                {list.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl" style={{ borderColor: 'var(--border)' }}>No job details added yet. Format requires action points.</div>
                ) : (
                  <div className="border rounded-xl divide-y overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="max-h-[50vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                      {list.map((item, idx) => (
                        <div key={item.id || idx} className="flex justify-between items-start gap-4 p-4 hover:bg-muted/30 transition-colors group">
                          <div className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">{idx+1}</span>
                            <div>
                              <p className="text-sm text-foreground/90 leading-snug">{item.text}</p>
                              <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">Last Edited: {formatDate(item.id)}</p>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteDesc(item.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1.5 bg-background rounded-md border border-border opacity-0 group-hover:opacity-100 transition-all shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Position" message={`Delete "${deleteTarget?.name}"? Members using this role won't be affected.`} />
    </div>
  );
}
