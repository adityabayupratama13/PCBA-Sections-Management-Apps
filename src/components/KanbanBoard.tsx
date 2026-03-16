import { ReactNode } from 'react';

const COLUMN_STYLES: Record<string, { dot: string; badge: string }> = {
  'Backlog':     { dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground border-border' },
  'In Progress': { dot: 'bg-primary animate-pulse',  badge: 'bg-primary/10 text-primary border-primary/20' },
  'Review':      { dot: 'bg-warning',          badge: 'bg-warning/10 text-warning border-warning/20 dark:text-amber-400' },
  'Done':        { dot: 'bg-success',          badge: 'bg-success/10 text-success border-success/20' },
};

interface KanbanColumnProps {
  title: string;
  children: ReactNode;
  count: number;
  onAdd?: () => void;
  onDrop?: (id: number) => void;
}

export function KanbanColumn({ title, children, count, onAdd }: KanbanColumnProps) {
  const styles = COLUMN_STYLES[title] || COLUMN_STYLES['Backlog'];
  return (
    <div className="flex flex-col rounded-2xl min-w-[320px] flex-1 shrink-0 overflow-hidden border"
      style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}
    >
      <div className="px-4 py-3.5 flex justify-between items-center border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${styles.badge}`}>
            {count}
          </span>
          {onAdd && (
            <button onClick={onAdd} className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded" title="Add task">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 custom-scrollbar">
        {children}
      </div>
    </div>
  );
}

interface KanbanCardProps {
  children: ReactNode;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  id?: number;
}

export function KanbanCard({ children, onClick, onEdit, onDelete }: KanbanCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover group relative ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 4px 20px var(--primary-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}
    >
      {children}
      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 bg-white/80 dark:bg-black/40 rounded hover:bg-white dark:hover:bg-black/60 text-muted-foreground hover:text-primary transition-colors" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 bg-white/80 dark:bg-black/40 rounded hover:bg-white dark:hover:bg-black/60 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
