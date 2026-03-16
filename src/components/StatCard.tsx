import { ReactNode, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import anime from 'animejs';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isUp: boolean;
  };
  className?: string;
  accent?: 'blue' | 'violet' | 'emerald' | 'amber';
}

const ACCENT_STYLES = {
  blue:    { icon: 'bg-blue-500/10 text-blue-500 border-blue-500/20', glow: 'hover:shadow-[0_8px_32px_rgba(59,130,246,0.15)]' },
  violet:  { icon: 'bg-violet-500/10 text-violet-500 border-violet-500/20', glow: 'hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)]' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', glow: 'hover:shadow-[0_8px_32px_rgba(16,185,129,0.15)]' },
  amber:   { icon: 'bg-amber-500/10 text-amber-500 border-amber-500/20', glow: 'hover:shadow-[0_8px_32px_rgba(245,158,11,0.15)]' },
};

export function StatCard({ title, value, icon, trend, className = '', accent = 'blue' }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];
  const valueRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Only animate if value is a number
    if (typeof value === 'number' && valueRef.current) {
      anime({
        targets: valueRef.current,
        innerHTML: [0, value],
        round: 1, // Round to integer
        easing: 'easeOutExpo',
        duration: 1500,
        delay: 200 // slight delay for visual pop
      });
    } else if (valueRef.current) {
      valueRef.current.innerHTML = String(value);
    }
  }, [value]);

  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 group transition-all duration-300 hover:-translate-y-0.5 border ${styles.glow} ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Subtle top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Background glow blob */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -mr-6 -mt-6"
        style={{ background: 'var(--primary-glow)' }} />

      <div className="relative flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 ref={valueRef} className="text-3xl font-bold text-foreground mt-2 tracking-tight">{value}</h3>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              {trend.isUp ? (
                <TrendingUp className="w-3.5 h-3.5 text-success" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              )}
              <span className={`text-sm font-semibold ${trend.isUp ? 'text-success' : 'text-destructive'}`}>
                {trend.isUp ? '+' : '-'}{Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-muted-foreground">vs last week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl border transition-all group-hover:scale-110 ${styles.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
