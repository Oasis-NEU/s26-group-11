import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

export function SearchBar({ placeholder = 'Search stocks...', className = '' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        navigate(`/app/stock/${query.trim().toUpperCase()}`);
        setQuery('');
      }
    },
    [query, navigate]
  );

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

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-200 focus-within:border-[var(--border-hover)] focus-within:bg-[var(--bg-surface)]" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        <input
          data-search-input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder-[var(--text-muted)]"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Search stocks"
        />
        <kbd className="hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-page)', color: 'var(--text-muted)' }}>
          ⌘K
        </kbd>
      </div>
    </form>
  );
}
