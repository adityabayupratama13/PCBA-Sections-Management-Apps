'use client';
import { useState, useEffect } from 'react';
import { Search, Bell, Menu, Sun, Moon, LogOut, CheckCheck, PlayCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';

interface HeaderProps {
  className?: string;
  onMenuClick?: () => void;
}

export function Header({ className = '', onMenuClick }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { currentUser, logout, auditLogs } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [lastViewed, setLastViewed] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('last_notification_view');
    if (saved) setLastViewed(parseInt(saved));
  }, []);

  const recentLogs = auditLogs.slice(0, 15);
  const unreadCount = recentLogs.filter(log => new Date(log.timestamp).getTime() > lastViewed).length;

  const handleOpenNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      const now = Date.now();
      setLastViewed(now);
      localStorage.setItem('last_notification_view', now.toString());
    }
  };

  const handleClearNotifications = () => {
    const now = Date.now();
    setLastViewed(now);
    localStorage.setItem('last_notification_view', now.toString());
    setShowNotifications(false);
  };

  return (
    <header className={`relative z-40 flex items-center justify-between h-16 px-4 sm:px-6 flex-shrink-0 glass-header ${className}`}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search bar */}
        <div id="tour-search" className="hidden md:block">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-xl text-sm text-muted-foreground transition-all hover:text-foreground group min-w-[200px]"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <Search className="w-4 h-4 flex-shrink-0 group-hover:text-primary transition-colors" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-muted-foreground"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 sm:gap-2">

        {/* Tour Button */}
        <button
          onClick={() => document.dispatchEvent(new CustomEvent('start-tour'))}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Tour
        </button>

        {/* Theme Toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="relative p-2 rounded-xl text-muted-foreground hover:text-primary transition-all hover:bg-primary/8 group"
            title="Toggle Theme"
          >
            <div className="relative w-5 h-5">
              <Sun className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} />
              <Moon className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${theme === 'dark' ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
            </div>
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={handleOpenNotifications}
            className="relative p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-surface animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                    <p className="text-xs text-muted-foreground">{unreadCount} recent activities</p>
                  </div>
                  <button
                    onClick={handleClearNotifications}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {recentLogs.length > 0 ? recentLogs.map((log) => {
                    const isUnread = new Date(log.timestamp).getTime() > lastViewed;
                    return (
                    <div key={log.id} className={`p-3 border-b hover:bg-primary/4 transition-colors cursor-pointer ${isUnread ? 'bg-primary/5' : ''}`} style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-start gap-2.5">
                        <div className="relative w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-primary/20">
                          {isUnread && <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full ring-2 ring-surface" />}
                          <span className="text-primary text-[9px] font-bold">{log.action.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground">{log.action} · {log.module}</div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{log.details}</div>
                          <div className="text-[10px] text-muted-foreground mt-1 opacity-60">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}) : (
                    <div className="p-8 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-20" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 mx-1" style={{ background: 'var(--border)' }} />

        {/* User Profile */}
        <div id="tour-role" className="flex items-center gap-2.5">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-foreground leading-none">{currentUser?.name || 'Guest'}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
              <span className={`w-1.5 h-1.5 rounded-full bg-success`} />
              {currentUser?.role || ''}
              {currentUser?.badge && <code className="font-mono text-[10px] opacity-60">#{currentUser.badge}</code>}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
            {currentUser?.name.charAt(0).toUpperCase() || '?'}
          </div>
          <button
            onClick={() => { logout(); window.location.href = '/login'; }}
            className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
