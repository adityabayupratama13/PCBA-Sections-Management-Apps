'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';


export interface Member {
  id: number;
  name: string;
  badge: string;
  password: string;
  role: string;
  division: string;
  email?: string;
  phone?: string;
  status: string;
  grade?: string;
  join_date?: string;
  finish_date?: string;
  employment_status?: string;
  contract_duration?: number;
  created_at?: string;
  photo_url?: string;
  member_type?: 'IT' | 'Management';
}

export interface AuditLog {
  id: number;
  action: string;
  module: string;
  details: string;
  user_name: string;
  timestamp: string;
}

interface AuthContextType {
  currentUser: Member | null;
  isMaster: boolean;
  isManagement: boolean;
  members: Member[];
  login: (badge: string, password: string) => Promise<boolean>;
  logout: () => void;
  addMember: (member: Omit<Member, 'id'>) => Promise<void>;
  updateMember: (member: Member) => Promise<void>;
  deleteMember: (id: number) => Promise<void>;
  refreshMembers: () => Promise<void>;
  auditLogs: AuditLog[];
  addAuditLog: (action: string, module: string, details: string) => void;
  role: string | null;
  userEmail: string | null;
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeSection, setActiveSectionState] = useState<string>('');

  const setActiveSection = (section: string) => {
    localStorage.setItem('activeSection', section);
    setActiveSectionState(section);
    // Reload to guarantee all layouts and APIs fetch with the new section header seamlessly
    window.location.reload();
  };

  useEffect(() => {
    // Setup fetch interceptor once
    if (typeof window !== 'undefined' && !(window as any).__fetchIntercepted) {
      (window as any).__fetchIntercepted = true;
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        let [resource, config] = args;
        if (typeof resource === 'string' && resource.startsWith('/api/')) {
          let section = '';
          try {
            section = localStorage.getItem('activeSection') || '';
            if (!section) {
              const stored = localStorage.getItem('it-mgt-user');
              if (stored) section = JSON.parse(stored).division || '';
            }
            if (section === 'Management') section = 'IT';
          } catch { /* ignore */ }
          if (section) {
            config = config || {};
            config.headers = { ...config.headers, 'x-section': section };
          }
        }
        return originalFetch(resource, config);
      };
    }

    const stored = localStorage.getItem('it-mgt-user');
    if (stored) {
      try { 
        const parsed = JSON.parse(stored);
        setCurrentUser(parsed); 
        
        // Ensure Management users start in a valid operational DB (e.g., IT) instead of invalid 'Management'
        let initialSection = localStorage.getItem('activeSection') || parsed.division || '';
        if (parsed.member_type === 'Management' && (!localStorage.getItem('activeSection') || localStorage.getItem('activeSection') === 'Management')) {
           initialSection = 'IT'; 
           localStorage.setItem('activeSection', 'IT');
        }
        
        setActiveSectionState(initialSection);
      } catch { /* ignore */ }
    }
    fetchMembers();
    fetchAuditLogs();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data: Member[] = await res.json();
        setMembers(data);
      }
    } catch { /* silent */ }
  };

  // Sync currentUser with fresh MySQL data whenever members list updates
  // This ensures photo_url and other fields are always current
  useEffect(() => {
    if (members.length === 0) return;
    setCurrentUser(prev => {
      if (!prev) return prev;
      const fresh = members.find(m => m.id === prev.id);
      if (!fresh) return prev;
      // Only update if data actually changed
      if (JSON.stringify(fresh) === JSON.stringify(prev)) return prev;
      localStorage.setItem('it-mgt-user', JSON.stringify(fresh));
      return fresh;
    });
  }, [members]);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit');
      if (res.ok) { setAuditLogs(await res.json()); }
    } catch { /* silent */ }
  };

  const refreshMembers = useCallback(async () => { await fetchMembers(); }, []);

  const login = async (badge: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', badge: badge.trim(), password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.member) {
          setCurrentUser(data.member);
          localStorage.setItem('it-mgt-user', JSON.stringify(data.member));
          
          let section = data.member.division;
          if (data.member.member_type === 'Management' && section === 'Management') section = 'IT';
          localStorage.setItem('activeSection', section);
          setActiveSectionState(section);
          
          return true;
        }
      }
    } catch { /* fall through */ }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('it-mgt-user');
    localStorage.removeItem('activeSection');
    setActiveSectionState('');
  };

  const addMember = async (member: Omit<Member, 'id'>) => {
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...member, userName: currentUser?.name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add member');
      }
      await fetchMembers();
      await fetchAuditLogs();
    } catch (err) { throw err; }
  };

  const updateMember = async (member: Member) => {
    try {
      await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...member, userName: currentUser?.name }),
      });
      await fetchMembers();
      await fetchAuditLogs();
      if (currentUser?.id === member.id) {
        setCurrentUser(member);
        localStorage.setItem('it-mgt-user', JSON.stringify(member));
      }
    } catch { /* silent */ }
  };

  const deleteMember = async (id: number) => {
    try {
      await fetch(`/api/members?id=${id}`, { method: 'DELETE' });
      await fetchMembers();
      await fetchAuditLogs();
    } catch { /* silent */ }
  };

  const addAuditLog = (action: string, module: string, details: string) => {
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, module, details, userName: currentUser?.name || 'System' }),
    }).catch(() => {});
    setAuditLogs(prev => [{ id: Date.now(), action, module, details, user_name: currentUser?.name || 'System', timestamp: new Date().toISOString() }, ...prev]);
  };

  const scopedMembers = useMemo(() => {
    if (!currentUser) return members;
    
    // Everyone strictly isolates to the active dropdown section.
    return members.filter(m => {
      // Show members belonging to the currently selected activeSection workspace context.
      if (m.division === activeSection) return true;
      // Also show Management members to IT admins and Management themselves to allow profile editing.
      if (m.member_type === 'Management' && (activeSection === 'IT' || currentUser.member_type === 'Management')) return true;
      return false;
    });
  }, [members, currentUser, activeSection]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      isMaster: false, // Deprecated over-ride
      isManagement: currentUser?.member_type === 'Management',
      members: scopedMembers,
      login, logout, addMember, updateMember, deleteMember, refreshMembers,
      auditLogs, addAuditLog,
      role: currentUser?.role ?? null,
      userEmail: currentUser?.name ?? null,
      activeSection,
      setActiveSection
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
