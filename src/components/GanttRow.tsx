export interface GanttRowProps {
  name: string;
  pic: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  status: 'Planning' | 'Active' | 'On Hold' | 'Completed';
  globalStartDate: Date;
  totalDays: number;
}

export function GanttRow({ name, pic, startDate, endDate, progress, status, globalStartDate, totalDays }: GanttRowProps) {
  
  const FILL_COLORS = {
    'Planning':  '#7C3AED',
    'Active':    '#2563EB',
    'On Hold':   '#EF4444',
    'Completed': '#10B981',
  };

  const fill = FILL_COLORS[status] || '#2563EB';

  // Calculate timeline offsets
  const dayMs = 1000 * 3600 * 24;
  const projectDurationDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / dayMs);
  const startOffsetDays = Math.max(0, (startDate.getTime() - globalStartDate.getTime()) / dayMs);
  
  const leftPercent = totalDays > 0 ? (startOffsetDays / totalDays) * 100 : 0;
  const widthPercent = totalDays > 0 ? (projectDurationDays / totalDays) * 100 : 100;

  return (
    <div className="flex py-3.5 border-b border-border/40 last:border-0 transition-colors group px-2 rounded-lg relative"
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; }}
      >
        <div className="w-[30%] shrink-0 pr-4 flex flex-col pl-2 overflow-hidden z-10 bg-inherit z-20 sticky left-0">
          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{name}</span>
          <span className="text-xs text-muted-foreground truncate mt-0.5">PIC: {pic}</span>
        </div>
        
        {/* Timeline track */}
        <div className="flex-1 relative h-10 overflow-hidden flex items-center pr-2">
           <div 
             className="absolute h-8 rounded-md overflow-hidden shadow-sm transition-all hover:brightness-110 flex items-center px-2 group/block cursor-pointer"
             style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, background: `${fill}25`, border: `1px solid ${fill}50` }}
           >
              {/* Internal progress bar */}
              <div 
                className="absolute top-0 bottom-0 left-0 transition-all opacity-40" 
                style={{ width: `${progress}%`, background: fill }} 
              />
              <span className="relative z-10 text-[10px] font-bold" style={{ color: fill }}>{progress}%</span>
           </div>
        </div>
    </div>
  );
}
