import { Link, useLocation } from 'react-router-dom';
import { SearchBar } from '../SearchBar';
import { ThemeToggle } from '../ThemeToggle';

export function Navbar() {
  const location = useLocation();

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-page)', backgroundOpacity: 0.9 }}
    >
      <div className="mx-auto flex h-13 max-w-screen-xl items-center justify-between gap-6 px-5">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div
            className="flex h-6 w-6 items-center justify-center rounded"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10 L5 6 L8 8 L12 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight transition-opacity group-hover:opacity-70" style={{ color: 'var(--text-primary)' }}>
            SentimentSignal
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            Live
          </span>
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-sm">
          <SearchBar />
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {[
            { label: 'Feed', path: '/app' },
            { label: 'Watchlist', path: '/app/watchlists' },
          ].map(({ label, path }) => {
            const active = path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className="rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150"
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: active ? 'var(--bg-elevated)' : 'transparent',
                  border: `1px solid ${active ? 'var(--border)' : 'transparent'}`,
                }}
              >
                {label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
