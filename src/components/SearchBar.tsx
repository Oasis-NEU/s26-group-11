import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { searchStocks, type SearchResult } from '../api/stocks';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

export function SearchBar({ placeholder = 'Search stocks...', className = '' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce: only fire query after 300ms of no typing
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: suggestions } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => searchStocks(debouncedQ),
    enabled: debouncedQ.length >= 1,
    staleTime: 30_000,
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        navigate(`/app/stock/${query.trim().toUpperCase()}`);
        setQuery('');
        setOpen(false);
      }
    },
    [query, navigate]
  );

  const handleSelect = (symbol: string) => {
    navigate(`/app/stock/${symbol}`);
    setQuery('');
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cmd+K focus
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const showDropdown = open && debouncedQ.length >= 1 && suggestions && suggestions.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-200 focus-within:border-[var(--border-hover)] focus-within:bg-[var(--bg-surface)]" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <input
            data-search-input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder-[var(--text-muted)]"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Search stocks"
            autoComplete="off"
          />
          <kbd className="hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-page)', color: 'var(--text-muted)' }}>
            ⌘K
          </kbd>
        </div>
      </form>

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border shadow-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          {suggestions!.map((s: SearchResult) => (
            <button
              key={s.symbol}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-elevated)]"
              onClick={() => handleSelect(s.symbol)}
            >
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.symbol}</span>
              {s.name && (
                <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{s.name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
