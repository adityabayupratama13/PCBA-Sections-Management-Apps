'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Ticket, CheckSquare, User, Loader2 } from 'lucide-react';

interface SearchResult {
  itemId: string;
  title: string;
  subtitle: string;
  type: 'ticket' | 'task' | 'member';
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const handleNav = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : results.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };
    
    window.addEventListener('keydown', handleNav);
    return () => window.removeEventListener('keydown', handleNav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, selectedIndex]);

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
    if (item.type === 'ticket') {
      router.push(`/tickets?openId=${item.itemId}`);
    } else if (item.type === 'task') {
      router.push(`/tasks?openId=${item.itemId}`);
    } else if (item.type === 'member') {
      router.push(`/team?badge=${item.itemId}`);
    }
  };

  const getIcon = (type: string) => {
    if (type === 'ticket') return <Ticket className="w-5 h-5 text-blue-500" />;
    if (type === 'task') return <CheckSquare className="w-5 h-5 text-emerald-500" />;
    return <User className="w-5 h-5 text-purple-500" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[60vh]"
            >
              <div className="flex items-center px-4 py-3 border-b border-border">
                <Search className="w-5 h-5 text-muted-foreground mr-3" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tickets, tasks, or team members..."
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                />
                {loading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin ml-3" />}
                <div className="hidden sm:flex items-center gap-1 opacity-50 ml-3">
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border border-border bg-background">ESC</kbd>
                </div>
              </div>

              {query && results.length === 0 && !loading && (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  No results found for &quot;{query}&quot;
                </div>
              )}

              {results.length > 0 && (
                <div className="overflow-y-auto p-2 custom-scrollbar flex-1">
                  {results.map((item, i) => (
                    <button
                      key={`${item.type}-${item.itemId}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        i === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="shrink-0 p-2 bg-background border border-border rounded-lg shadow-sm">
                        {getIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                          {item.title}
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          #{item.itemId} • {item.subtitle}
                        </div>
                      </div>
                      {i === selectedIndex && (
                        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border border-primary/20 bg-primary/10 text-primary">
                          Enter
                        </kbd>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
