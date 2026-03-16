export interface GanttRowProps {
  name: string;
  pic: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  status: 'Planning' | 'Active' | 'On Hold' | 'Completed';
}

export function GanttRow({ name, pic, startDate, endDate, progress, status }: GanttRowProps) {
  
  const FILL_COLORS = {
    'Planning':  '#7C3AED',
    'Active':    '#2563EB',
    'On Hold':   '#EF4444',
    'Completed': '#10B981',
  };

  const fill = FILL_COLORS[status] || '#2563EB';

  return (
    <div className="flex items-center py-3.5 border-b border-border/40 last:border-0 transition-colors group px-2 rounded-lg"
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; }}
      >
        <div className="w-[30%] shrink-0 pr-4 flex flex-col pl-2 overflow-hidden">
          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{name}</span>
          <span className="text-xs text-muted-foreground truncate mt-0.5">PIC: {pic}</span>
        </div>
        <div className="flex-1 flex flex-col justify-center pr-2 overflow-hidden">
          <div className="flex justify-between text-[10.5px] text-muted-foreground mb-1 font-medium px-1 uppercase tracking-wider">
          <span>{startDate.toISOString().split('T')[0]}</span>
          <span className="text-foreground/50">{status}</span>
          <span>{endDate.toISOString().split('T')[0]}</span>
        </div>
        <div className="flex items-center gap-3 w-full">
          <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted/60 border border-border/40">
            <div
              className="absolute top-0 bottom-0 left-0 rounded-full transition-all"
              style={{ width: `${progress}%`, background: fill }}
            />
          </div>
          <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors w-10 text-right flex-shrink-0">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
