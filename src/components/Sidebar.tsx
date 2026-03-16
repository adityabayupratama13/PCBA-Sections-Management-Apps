'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FolderKanban, Monitor, Tickets,
  CalendarDays, CalendarClock, History, CheckSquare, X, Briefcase, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GikenLogo } from '@/components/GikenLogo';
import { useEffect, useRef } from 'react';
// @ts-ignore
import anime from 'animejs';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Team', href: '/team', icon: Users },
  { label: 'Positions', href: '/positions', icon: Briefcase },
  { label: 'Attendance', href: '/attendance', icon: CalendarDays },
  { label: 'Tickets', href: '/tickets', icon: Tickets },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Schedule', href: '/schedule', icon: CalendarClock },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Assets', href: '/assets', icon: Monitor, external: 'http://10.0.2.212:3001' },
  { label: 'Daily Log', href: '/daily', icon: CalendarDays },
  { label: 'Audit Log', href: '/audit', icon: History },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useAuth();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (navRef.current) {
      anime({
        targets: navRef.current.querySelectorAll('.nav-item'),
        translateX: [-20, 0],
        opacity: [0, 1],
        delay: anime.stagger(50, { start: 100 }), // Cascade start
        easing: 'easeOutElastic(1, .8)',
        duration: 800
      });
    }
  }, []);

  const SidebarContent = (
    <div className="h-full flex flex-col w-64 glass-sidebar">
      
      {/* Logo */}
      <div className="px-6 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <GikenLogo className="h-6 w-auto text-[#1e3a8a] dark:text-white transition-colors duration-300" />
          <div className="border-l border-border pl-3">
            <div className="font-bold text-foreground text-sm xl:text-base leading-none">IT Apps</div>
            <div className="text-[10px] text-muted-foreground mt-1 font-semibold tracking-wider uppercase">Dashboard</div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav Label */}
      <div className="px-6 pb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Main Menu</span>
      </div>

      {/* Navigation */}
      <nav ref={navRef} id="sidebar-nav" className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.external}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="nav-item opacity-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group text-muted-foreground hover:text-primary hover:bg-primary/8"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-surface group-hover:bg-primary/10 transition-colors border border-sidebar-border group-hover:border-primary/20">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1">{item.label}</span>
                <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </a>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setIsOpen(false)}
              className={`nav-item opacity-0 relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface'
              }`}
              style={isActive ? { background: 'var(--sidebar-active)' } : {}}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                isActive
                  ? 'bg-primary/10 border-primary/20 text-primary'
                  : 'bg-surface border-sidebar-border text-muted-foreground group-hover:border-primary/20 group-hover:text-primary group-hover:bg-primary/5'
              }`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface cursor-default transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-primary font-bold text-sm border border-primary/20 flex-shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">My Account</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success status-online" />
              <p className="text-xs text-muted-foreground truncate">{role || 'Guest'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:flex h-full">{SidebarContent}</div>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden shadow-2xl"
            >
              {SidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
