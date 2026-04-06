import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchStocks, type SearchResult } from '../api/stocks';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const POPULAR = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL'];

// Type badge colours
function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const short = type === 'Common Stock' ? 'STOCK'
    : type === 'ETF' ? 'ETF'
    : type === 'ADR' ? 'ADR'
    : type.slice(0, 4).toUpperCase();
  const color = type === 'ETF' ? '#d97706' : type === 'ADR' ? '#8b5cf6' : 'var(--text-muted)';
  return (
    <span
      className="shrink-0 text-[8px] font-black tracking-widest border px-1 py-px"
      style={{ borderColor: color, color, ...MONO }}
    >
      {short}
    </span>
  );
}

// ── NO SIGNAL animation ───────────────────────────────────────────────────────

function NoSignal({ query, onSelect }: { query: string; onSelect: (sym: string) => void }) {
  return (
    <motion.div
      key="no-signal"
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="px-4 py-5 text-center space-y-3"
    >
      {/* Radar icon */}
      <div className="relative mx-auto" style={{ width: 36, height: 36 }}>
        {/* Pulse rings */}
        {[1, 1.6, 2.2].map((scale, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: 'var(--red)', opacity: 0.4 }}
            animate={{ scale: [1, scale], opacity: [0.5, 0] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: i * 0.4,
              ease: 'easeOut',
            }}
          />
        ))}
        {/* Static circle */}
        <div
          className="absolute inset-0 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: 'var(--red)' }}
        >
          {/* Sweeping arm */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute left-1/2 top-0 bottom-1/2 w-px origin-bottom"
              style={{ backgroundColor: 'var(--red)', opacity: 0.75, marginLeft: '-0.5px' }}
            />
          </motion.div>
          {/* Centre dot */}
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--red)' }} />
        </div>
      </div>

      {/* NO SIGNAL text */}
      <motion.p
        initial={{ x: -6, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="text-[11px] font-black uppercase tracking-[0.2em]"
        style={{ color: 'var(--red)', ...MONO }}
      >
        No Signal
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-[11px]"
        style={{ color: 'var(--text-muted)', ...MONO }}
      >
        "{query}" not found
      </motion.p>

      {/* Popular tickers */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22 }}
        className="space-y-1.5"
      >
        <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
          Try these instead
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {POPULAR.map((ticker) => (
            <button
              key={ticker}
              onClick={() => onSelect(ticker)}
              className="px-2 py-0.5 text-[10px] font-bold border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
            >
              {ticker}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main SearchBar ────────────────────────────────────────────────────────────

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

export function SearchBar({ placeholder = 'Search ticker or company...', className = '' }: SearchBarProps) {
  const [query, setQuery]           = useState('');
  const [open, setOpen]             = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const navigate   = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // 300 ms debounce
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Auto-highlight the first result so Enter always does something obvious
  useEffect(() => { setSelectedIdx(0); }, [debouncedQ]);

  const { data: suggestions, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn:  () => searchStocks(debouncedQ),
    enabled:  debouncedQ.length >= 1,
    staleTime: 30_000,
  });

  const handleSelect = useCallback((symbol: string) => {
    navigate(`/app/stock/${symbol}`);
    setQuery('');
    setOpen(false);
  }, [navigate]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && suggestions?.[selectedIdx]) {
      // Explicitly keyboard-navigated to a result
      handleSelect(suggestions[selectedIdx].symbol);
    } else if (suggestions?.[0]) {
      // Just typed and hit Enter — use the top result (e.g. "nvidia" → NVDA)
      handleSelect(suggestions[0].symbol);
    } else if (query.trim()) {
      // No suggestions yet (debounce still pending) — try the raw query as a ticker
      navigate(`/app/stock/${query.trim().toUpperCase()}`);
      setQuery('');
      setOpen(false);
    }
  }, [query, selectedIdx, suggestions, handleSelect, navigate]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = suggestions?.length ?? 0;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, count - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }, [suggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ⌘K / Ctrl+K focus
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const spinning = isLoading || isFetching;
  const hasSuggestions = suggestions && suggestions.length > 0;
  const notFound = !spinning && debouncedQ.length >= 1 && suggestions?.length === 0;
  const showDropdown = open && debouncedQ.length >= 1 && (hasSuggestions || notFound);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div
          className="flex items-center gap-2 rounded-none border px-3 py-1.5 transition-colors duration-200 focus-within:border-[var(--border-hover)]"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          {/* Icon — spins while fetching */}
          <motion.div
            animate={spinning ? { rotate: 360 } : { rotate: 0 }}
            transition={spinning ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
          >
            <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          </motion.div>

          <input
            ref={inputRef}
            data-search-input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder-[var(--text-muted)]"
            style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}
            aria-label="Search stocks"
            autoComplete="off"
          />
          <kbd
            className="hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline-block"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-page)', color: 'var(--text-muted)', ...MONO }}
          >
            ⌘K
          </kbd>
        </div>
      </form>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 border shadow-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            {hasSuggestions ? (
              <>
                {suggestions!.map((s: SearchResult, i) => (
                  <motion.button
                    key={s.symbol}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: i === selectedIdx ? 'var(--bg-elevated)' : 'transparent',
                      borderLeft: i === selectedIdx ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                    onMouseEnter={() => setSelectedIdx(i)}
                    onClick={() => handleSelect(s.symbol)}
                  >
                    <span
                      className="font-black text-sm w-14 shrink-0"
                      style={{ color: i === selectedIdx ? 'var(--accent)' : 'var(--text-primary)', ...MONO }}
                    >
                      {s.symbol}
                    </span>
                    {s.name && (
                      <span className="truncate text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
                        {s.name}
                      </span>
                    )}
                    <TypeBadge type={s.type} />
                  </motion.button>
                ))}
                {/* Footer hint */}
                <div
                  className="flex items-center justify-between px-3 py-1.5 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
                    ↑↓ navigate · enter to open
                  </span>
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
                    esc close
                  </span>
                </div>
              </>
            ) : (
              <NoSignal query={debouncedQ} onSelect={handleSelect} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
