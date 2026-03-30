import { Link, useLocation } from 'react-router-dom';
import { SearchBar } from '../SearchBar';
import { ThemeToggle } from '../ThemeToggle';

export function Navbar() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Accent stripe */}
      <div className="h-[3px] w-full" style={{ backgroundColor: 'var(--accent)' }} />

      {/* Main bar */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex h-12 max-w-screen-xl items-center justify-between gap-6 px-5">
          {/* Brand */}
          <Link
            to="/"
            className="shrink-0 text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: 'var(--text-primary)', fontFamily: '"IBM Plex Mono", monospace' }}
          >
            SentimentSignal
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <div className="max-w-xs flex-1">
              <SearchBar />
            </div>

            <nav className="flex items-center">
              {[
                { label: 'Feed', path: '/app' },
                { label: 'Watchlist', path: '/app/watchlists' },
              ].map(({ label, path }) => {
                const active = path === '/app'
                  ? location.pathname === '/app'
                  : location.pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
                    style={{
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
