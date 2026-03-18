'use client';
import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Shield, ExternalLink, Crown, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DataTable } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import PhotoAvatar from '@/components/PhotoAvatar';
import { toast } from 'sonner';
import { useAuth, type Member } from '@/context/AuthContext';
import Link from 'next/link';

interface Position { id: number; name: string; description: string; }

function roleBadgeStyle(role: string): string {
  const p = [
    'bg-violet-500/15 text-violet-400 border-violet-500/25',
    'bg-blue-500/15 text-blue-400 border-blue-500/25',
    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'bg-orange-500/15 text-orange-400 border-orange-500/25',
    'bg-pink-500/15 text-pink-400 border-pink-500/25',
    'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
    'bg-amber-500/15 text-amber-400 border-amber-500/25',
  ];
  let h = 0;
  for (let i = 0; i < role.length; i++) h = role.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

export default function TeamPage() {
  const { members, addMember, updateMember, deleteMember } = useAuth();

  const [positions, setPositions] = useState<Position[]>([]);
  useEffect(() => {
    fetch('/api/positions').then(r => r.json()).then(setPositions).catch(() => {});
  }, []);
  const roleNames = positions.map(p => p.name);

  const itMembers = members.filter(m => m.member_type !== 'Management');
  const managementMembers = members.filter(m => m.member_type === 'Management');
  const allMembers: Member[] = members;

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');

  // IT Member modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);

  // Management modal state
  const [isMgmtModalOpen, setIsMgmtModalOpen] = useState(false);
  const [editingMgmt, setEditingMgmt] = useState<Member | null>(null);
  const [deleteMgmtTarget, setDeleteMgmtTarget] = useState<Member | null>(null);
  const [showMgmtPw, setShowMgmtPw] = useState(false);
  const [pendingMgmtPhoto, setPendingMgmtPhoto] = useState<string | null>(null);

  const getDescriptionsList = (descStr?: string): { id: number, text: string }[] => {
    if (!descStr) return [];
    try {
      const parsed = JSON.parse(descStr);
      if (Array.isArray(parsed)) return parsed;
      return [{ id: Date.now(), text: descStr }];
    } catch {
      return [{ id: Date.now(), text: descStr }];
    }
  };

  useEffect(() => {
    if (allMembers.length > 0 && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const badge = params.get('badge');
      if (badge) {
        const m = allMembers.find(x => x.badge === badge);
        if (m && !isModalOpen && !viewingMember) {
          setTimeout(() => setViewingMember(m), 100);
          window.history.replaceState(null, '', '/team');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMembers]);

  const filtered = itMembers.filter(m => {
    const q = search.toLowerCase();
    return (m.name.toLowerCase().includes(q) || m.badge.includes(q)) &&
           (filterRole === 'All' || m.role === filterRole);
  });

  const openAddModal = () => {
    setEditingMember(null); setPendingPhoto(null); setShowPw(false); setIsModalOpen(true);
  };
  const openEditModal = (m: Member) => {
    setEditingMember(m); setPendingPhoto(null); setShowPw(false); setIsModalOpen(true);
  };
  const openAddMgmtModal = () => {
    setEditingMgmt(null); setPendingMgmtPhoto(null); setShowMgmtPw(false); setIsMgmtModalOpen(true);
  };
  const openEditMgmtModal = (m: Member) => {
    setEditingMgmt(m); setPendingMgmtPhoto(null); setShowMgmtPw(false); setIsMgmtModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMember(deleteTarget.id);
    toast.success(`"${deleteTarget.name}" removed`);
    setDeleteTarget(null);
  };
  const handleDeleteMgmt = async () => {
    if (!deleteMgmtTarget) return;
    await deleteMember(deleteMgmtTarget.id);
    toast.success(`"${deleteMgmtTarget.name}" removed from Management`);
    setDeleteMgmtTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const pw = fd.get('password') as string;
    const data: Omit<Member, 'id'> = {
      name: (fd.get('name') as string).trim(),
      badge: (fd.get('badge') as string).trim(),
      password: pw || editingMember?.password || '',
      role: fd.get('role') as string,
      division: (fd.get('division') as string).trim(),
      status: fd.get('status') as 'Active' | 'Inactive',
      email: (fd.get('email') as string || '').trim(),
      phone: (fd.get('phone') as string || '').trim(),
      grade: fd.get('grade') as string || '',
      created_at: (fd.get('joinDate') as string) || editingMember?.created_at || new Date().toISOString(),
      photo_url: pendingPhoto ?? editingMember?.photo_url ?? undefined,
      member_type: 'IT',
    };
    if (!data.name || !data.badge) { toast.error('Name and Badge required'); return; }
    const dup = allMembers.find(m => m.badge === data.badge && m.id !== editingMember?.id);
    if (dup) { toast.error('Badge already registered'); return; }
    try {
      if (editingMember) {
        await updateMember({ ...editingMember, ...data });
        toast.success(`"${data.name}" updated`);
      } else {
        if (!pw) { toast.error('Password required for new members'); return; }
        await addMember(data);
        toast.success(`"${data.name}" registered`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleSaveMgmt = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const pw = fd.get('password') as string;
    const data: Omit<Member, 'id'> = {
      name: (fd.get('name') as string).trim(),
      badge: (fd.get('badge') as string).trim(),
      password: pw || editingMgmt?.password || '',
      role: (fd.get('title') as string).trim(),
      division: 'Management',
      status: 'Active',
      email: (fd.get('email') as string || '').trim(),
      phone: (fd.get('phone') as string || '').trim(),
      grade: '',
      photo_url: pendingMgmtPhoto ?? editingMgmt?.photo_url ?? undefined,
      member_type: 'Management',
    };
    if (!data.name || !data.badge) { toast.error('Name and Badge required'); return; }
    const dup = allMembers.find(m => m.badge === data.badge && m.id !== editingMgmt?.id);
    if (dup) { toast.error('Badge already registered'); return; }
    try {
      if (editingMgmt) {
        await updateMember({ ...editingMgmt, ...data });
        toast.success(`"${data.name}" updated`);
      } else {
        if (!pw) { toast.error('Password required'); return; }
        await addMember(data);
        toast.success(`"${data.name}" added to Management`);
      }
      setIsMgmtModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  // Upload photo from view modal → save directly
  const handleViewModalUpload = async (url: string) => {
    if (!viewingMember) return;
    const updated = { ...viewingMember, photo_url: url };
    await updateMember(updated);
    setViewingMember(updated);
    toast.success('Photo updated!');
  };

  const inputClass = "w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all";

  const columns = [
    {
      header: 'Member',
      accessor: (m: Member) => (
        <div className="flex items-center gap-3">
          <PhotoAvatar name={m.name} photoUrl={m.photo_url} size="sm" />
          <div>
            <div className="font-semibold text-foreground">{m.name}</div>
          </div>
        </div>
      )
    },
    { header: 'Badge', accessor: (m: Member) => <code className="font-mono text-xs px-2 py-1 rounded font-semibold" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{m.badge}</code> },
    { header: 'Role', accessor: (m: Member) => <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadgeStyle(m.role)}`}>{m.role}</span> },
    { header: 'Grade', accessor: (m: Member) => m.grade ? <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">{m.grade}</span> : <span className="text-muted-foreground text-xs">—</span> },
    { header: 'Division', accessor: 'division' as keyof Member },
    {
      header: 'Status',
      accessor: (m: Member) => (
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${m.status === 'Active' ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground'}`} />
          {m.status}
        </span>
      )
    },
    { header: 'Joined', accessor: (m: Member) => (m.created_at ? new Date(m.created_at).toLocaleDateString() : '—') },
    {
      header: 'Actions',
      accessor: (m: Member) => (
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <button onClick={() => openEditModal(m)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(m)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
          <p className="text-muted-foreground mt-1">
            IT Team — <span className="font-semibold text-foreground">{itMembers.length}</span> members
            {managementMembers.length > 0 && <> · Management — <span className="font-semibold text-amber-400">{managementMembers.length}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAddMgmtModal}
            className="flex items-center gap-2 border border-amber-500/40 hover:border-amber-500/80 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-4 py-2.5 rounded-xl font-medium text-sm transition-all">
            <Crown className="w-4 h-4" /> Add Management
          </button>
          <button onClick={openAddModal}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      {/* Management Section */}
      {managementMembers.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'rgba(245,158,11,0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/25">
                <Crown className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Management</h2>
                <p className="text-[10px] text-muted-foreground">Full access · Approval authority</p>
              </div>
            </div>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
              {managementMembers.length} manager{managementMembers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {managementMembers.map(m => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-xl border p-4 flex flex-col items-center gap-3 group hover:border-amber-500/50 transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.05), transparent)', borderColor: 'rgba(245,158,11,0.2)' }}
              >
                {/* Actions */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditMgmtModal(m)} className="p-1.5 rounded-lg hover:bg-amber-500/15 text-muted-foreground hover:text-amber-400 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteMgmtTarget(m)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {/* Avatar */}
                <div className="relative">
                  <PhotoAvatar name={m.name} photoUrl={m.photo_url} size="lg" canUpload={false} />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center border-2 border-surface">
                    <Crown className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                {/* Info */}
                <div className="text-center">
                  <p className="font-bold text-sm text-foreground">{m.name}</p>
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">{m.role}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{m.division}</span>
                  </div>
                </div>
                {/* Contact */}
                <div className="w-full space-y-1 border-t pt-3" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
                  {m.email && <p className="text-[10px] text-muted-foreground truncate text-center">{m.email}</p>}
                  {m.phone && <p className="text-[10px] text-muted-foreground text-center">{m.phone}</p>}
                  <p className="text-[9px] text-amber-400/60 text-center font-mono">#{m.badge}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter — IT Team */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">IT Team</h2>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{itMembers.length} members</span>
        </div>
      <div className="rounded-2xl p-4 flex flex-col sm:flex-row gap-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search name or badge..." value={search} onChange={e => setSearch(e.target.value)}
            className={inputClass + ' pl-9'} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className={inputClass + ' min-w-[160px] cursor-pointer'}>
          <option value="All">All Roles</option>
          {roleNames.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      </div>

      <DataTable columns={columns} data={filtered} keyExtractor={m => m.id} onRowClick={m => setViewingMember(m)} />

      {/* ── Profile View Modal ── */}
      <Modal isOpen={!!viewingMember} onClose={() => setViewingMember(null)} title="Member Profile & Responsibilities" maxWidth="max-w-4xl">
        {viewingMember && (() => {
          const positionData = positions.find(p => p.name === viewingMember.role);
          const list = getDescriptionsList(positionData?.description);

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
              {/* Left: Personal */}
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex flex-col items-center gap-3 mb-4">
                    {/* Large avatar with upload */}
                    <div className="relative">
                      <PhotoAvatar
                        name={viewingMember.name}
                        photoUrl={viewingMember.photo_url}
                        size="xl"
                        canUpload
                        onUploaded={handleViewModalUpload}
                      />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-foreground leading-tight">{viewingMember.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{viewingMember.badge}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">Click avatar to upload photo</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Role / Job Title</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-block ${roleBadgeStyle(viewingMember.role)}`}>{viewingMember.role}</span>
                    </div>
                    {viewingMember.grade && (
                      <div>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Grade</span>
                        <span className="text-sm font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 inline-block">{viewingMember.grade}</span>
                      </div>
                    )}
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Division</span>
                      <span className="text-sm text-foreground">{viewingMember.division}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</span>
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <span className={`w-2 h-2 rounded-full ${viewingMember.status === 'Active' ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground'}`} />
                        {viewingMember.status}
                      </span>
                    </div>
                    {viewingMember.email && (
                      <div>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</span>
                        <a href={`mailto:${viewingMember.email}`} className="text-sm text-primary hover:underline font-medium">{viewingMember.email}</a>
                      </div>
                    )}
                    {viewingMember.phone && (
                      <div>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</span>
                        <a href={`tel:${viewingMember.phone}`} className="text-sm text-primary hover:underline font-medium">{viewingMember.phone}</a>
                      </div>
                    )}
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Join Date</span>
                      <span className="text-sm text-foreground">{new Date(viewingMember.created_at || new Date()).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Responsibilities */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-base font-semibold text-foreground">Job Scope & Responsibilities</h3>
                  <Link href="/positions" className="text-xs flex items-center gap-1.5 text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-primary/20">
                    <Edit2 className="w-3.5 h-3.5" /> Edit in Positions Master
                  </Link>
                </div>
                {list.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl" style={{ borderColor: 'var(--border)' }}>
                    No job descriptions assigned for <strong className="text-foreground">{viewingMember.role}</strong> yet.
                  </div>
                ) : (
                  <div className="border rounded-xl divide-y overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="max-h-[50vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                      {list.map((item, idx) => (
                        <div key={item.id || idx} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20 mt-0.5">{idx + 1}</span>
                          <p className="text-sm text-foreground/90 leading-relaxed pt-1">{item.text}</p>
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

      {/* Link to Positions */}
      <Link href="/positions" className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface hover:bg-muted/30 transition-colors text-sm">
        <Shield className="w-4 h-4 text-primary" />
        <span className="text-muted-foreground">Manage positions/roles in the <strong className="text-foreground">Jabatan</strong> menu</span>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
      </Link>

      {/* ── Add/Edit Modal ── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMember ? 'Edit Member' : 'Register New Member'}>
        <form onSubmit={handleSave} className="space-y-4 shadow-sm pb-1 max-h-[75vh] overflow-y-auto px-1 custom-scrollbar">
          
          {/* Photo upload at top of edit modal */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="flex flex-col items-center gap-2">
              <PhotoAvatar
                name={editingMember?.name || 'N'}
                photoUrl={pendingPhoto ?? editingMember?.photo_url}
                size="lg"
                canUpload
                onUploaded={url => setPendingPhoto(url)}
              />
              <span className="text-xs text-muted-foreground">Click or drag to set photo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name *</label>
              <input name="name" required defaultValue={editingMember?.name} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Badge Number *</label>
              <input name="badge" required defaultValue={editingMember?.badge} placeholder="e.g. 36001"
                className={inputClass + ' font-mono'} /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Password {editingMember ? '(leave blank to keep)' : '*'}
            </label>
            <div className="relative">
              <input name="password" type={showPw ? 'text' : 'password'} required={!editingMember}
                placeholder={editingMember ? '••••••••' : 'Set login password'} className={inputClass + ' pr-10'} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-muted-foreground">Role / Jabatan *</label>
              <Link href="/positions" onClick={() => setIsModalOpen(false)} className="text-xs text-primary hover:underline">Manage Positions →</Link>
            </div>
            <select name="role" defaultValue={editingMember?.role || roleNames[0] || 'IT Support'} className={inputClass + ' cursor-pointer'}>
              {roleNames.length > 0 ? roleNames.map(r => <option key={r}>{r}</option>) : <option>IT Support</option>}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Division</label>
              <input name="division" defaultValue={editingMember?.division} placeholder="e.g. Helpdesk" className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Status</label>
              <select name="status" defaultValue={editingMember?.status || 'Active'} className={inputClass + ' cursor-pointer'}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Grade / Level</label>
              <select name="grade" defaultValue={editingMember?.grade || ''} className={inputClass + ' cursor-pointer'}>
                <option value="">— No Grade —</option>
                <optgroup label="Manager"><option value="M2">M2</option><option value="M3">M3</option></optgroup>
                <optgroup label="Supervisor"><option value="S1">S1</option><option value="S2">S2</option><option value="S3">S3</option></optgroup>
                <optgroup label="Leader"><option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option><option value="L4">L4</option></optgroup>
              </select></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Email</label>
              <input name="email" type="email" defaultValue={editingMember?.email} className={inputClass} /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Phone</label>
            <input name="phone" defaultValue={editingMember?.phone} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Join Date</label>
            <input name="joinDate" type="date" defaultValue={editingMember?.created_at ? editingMember.created_at.split('T')[0] : new Date().toISOString().split('T')[0]} className={inputClass} />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border hover:bg-primary/5 transition-colors" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium transition-colors">
              {editingMember ? 'Save Changes' : 'Register Member'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Remove Member" message={`Remove "${deleteTarget?.name}" (${deleteTarget?.badge})? They will lose login access.`} />

      {/* ── Management Add/Edit Modal ── */}
      <Modal isOpen={isMgmtModalOpen} onClose={() => setIsMgmtModalOpen(false)}
        title={editingMgmt ? 'Edit Management Member' : 'Add Management Member'}
        maxWidth="max-w-md">
        <form onSubmit={handleSaveMgmt} className="space-y-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2 pb-2">
            <PhotoAvatar
              name={editingMgmt?.name || 'M'}
              photoUrl={pendingMgmtPhoto ?? editingMgmt?.photo_url}
              size="xl"
              canUpload
              onUploaded={url => setPendingMgmtPhoto(url)}
            />
            <p className="text-[10px] text-muted-foreground">Click avatar to upload photo</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name <span className="text-destructive">*</span></label>
              <input name="name" required defaultValue={editingMgmt?.name} placeholder="e.g. Budi Santoso" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Employee ID / Badge <span className="text-destructive">*</span></label>
              <input name="badge" required defaultValue={editingMgmt?.badge} placeholder="e.g. 50001" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Title / Position <span className="text-destructive">*</span></label>
              <input name="title" required defaultValue={editingMgmt?.role} placeholder="Manager / GM / Director" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email</label>
              <input name="email" type="email" defaultValue={editingMgmt?.email} placeholder="email@giken.co.id" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Phone</label>
              <input name="phone" defaultValue={editingMgmt?.phone} placeholder="08xx-xxxx-xxxx" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                {editingMgmt ? 'New Password (leave blank to keep)' : 'Password'} {!editingMgmt && <span className="text-destructive">*</span>}
              </label>
              <div className="relative">
                <input name="password" type={showMgmtPw ? 'text' : 'password'} placeholder="Min 6 characters" className={inputClass + ' pr-10'} />
                <button type="button" onClick={() => setShowMgmtPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showMgmtPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          {/* Management badge */}
          <div className="flex items-center gap-2 p-3 rounded-xl border bg-amber-500/5 border-amber-500/20">
            <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400/80">Management members have full read/write access to all menus and are separate from the IT Team count.</p>
          </div>
          <div className="pt-2 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={() => setIsMgmtModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border hover:bg-primary/5 transition-colors" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            <button type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-500/90 text-white rounded-xl text-sm font-medium transition-colors">
              {editingMgmt ? 'Save Changes' : 'Add to Management'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteMgmtTarget} onClose={() => setDeleteMgmtTarget(null)} onConfirm={handleDeleteMgmt}
        title="Remove Management Member" message={`Remove "${deleteMgmtTarget?.name}" from Management? They will lose login access.`} />

      {/* Suppress unused AnimatePresence warning */}
      <AnimatePresence />
    </div>
  );
}
