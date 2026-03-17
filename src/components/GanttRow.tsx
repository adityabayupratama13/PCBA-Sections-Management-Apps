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
        <div className="w-[30%] shrink-0 pr-4 flex items-center justify-between pl-2 overflow-hidden z-10 bg-inherit z-20 sticky left-0">
          <div className="flex flex-col overflow-hidden pr-2">
            <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{name}</span>
            <span className="text-[10px] text-muted-foreground truncate mt-0.5 uppercase tracking-wide">PIC: {pic}</span>
          </div>
          <div className="ml-2 flex flex-col items-end gap-1 shrink-0">
            <span className="px-1.5 py-0.5 rounded-sm border text-[9px] font-bold uppercase tracking-wider" style={{ color: fill, borderColor: `${fill}40`, backgroundColor: `${fill}10` }}>
              {status}
            </span>
            <span className="text-[11px] font-semibold text-foreground">{progress}%</span>
          </div>
        </div>
          <div className="flex-between absolute inset-0 left-[30%] right-[16px] pointer-events-none opacity-5">
            {/* The background lines are managed by the parent */}
          </div>
        
        {/* Timeline track */}
        <div className="flex-1 relative h-12 flex items-center pr-2">
           <div 
             className="absolute h-8 rounded shadow-sm transition-all hover:brightness-110 flex items-center px-2 cursor-default"
             style={{ 
               left: `${leftPercent}%`, 
               width: `max(70px, calc(${widthPercent}% - 4px))`, 
               background: `${fill}15`, 
               border: `1px solid ${fill}40`,
               borderLeft: `4px solid ${fill}`,
               zIndex: 10
             }}
             title={`${name} (${status} - ${progress}%)\nStart: ${startDate.toLocaleDateString()}\nEnd: ${endDate.toLocaleDateString()}`}
           >
              {/* Text labels container */}
              <div className="flex items-center justify-between w-full opacity-90">
                <span className="text-[9px] font-bold tracking-wide truncate pr-1" style={{ color: fill }}>
                  {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[9px] font-bold tracking-wide truncate pl-1 hidden sm:block" style={{ color: fill }}>
                  {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
           </div>
        </div>
    </div>
  );
}
