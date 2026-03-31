'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    let [resource, config] = args;
    
    // Attempt to inject x-section if it's an API request
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
      let section = '';
      try {
        const stored = localStorage.getItem('it-mgt-user');
        if (stored) {
          section = JSON.parse(stored).division || '';
        }
      } catch { /* ignore */ }

      if (section) {
        config = config || {};
        config.headers = {
          ...config.headers,
          'x-section': section
        };
      }
    }
    return originalFetch(resource, config);
  };
}

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('it-mgt-user');
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch { /* ignore */ }
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
          return true;
        }
      }
    } catch { /* fall through */ }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('it-mgt-user');
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

  return (
    <AuthContext.Provider value={{
      currentUser,
      isMaster: false,
      isManagement: currentUser?.member_type === 'Management',
      members,
      login, logout, addMember, updateMember, deleteMember, refreshMembers,
      auditLogs, addAuditLog,
      role: currentUser?.role ?? null,
      userEmail: currentUser?.name ?? null,
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
