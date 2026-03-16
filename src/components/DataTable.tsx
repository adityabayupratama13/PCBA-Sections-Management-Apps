import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
}

export function DataTable<T>({ columns, data, keyExtractor, onRowClick, isLoading }: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <table className="w-full text-sm text-left">
          <thead style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={`px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                {columns.map((_, colIndex) => (
                  <td key={colIndex} className="px-5 py-4">
                    <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
          <span className="text-primary text-xl">∅</span>
        </div>
        <p className="text-muted-foreground font-medium">No data available</p>
        <p className="text-sm text-muted-foreground mt-1 opacity-60">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={`px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody 
            className="divide-y" 
            style={{ borderColor: 'var(--border)' }}
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } }
            }}
          >
            <AnimatePresence>
              {data.map((item, idx) => (
                <motion.tr 
                  key={keyExtractor ? keyExtractor(item) : idx}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                  }}
                  className={`transition-colors group ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick && onRowClick(item)}
                  whileHover={{ backgroundColor: 'var(--muted)', scale: 1.005 }}
                  transition={{ duration: 0.2 }}
                >
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className={`px-5 py-3.5 text-foreground/90 group-hover:text-foreground transition-colors ${col.className || ''}`}>
                      {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as ReactNode)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
