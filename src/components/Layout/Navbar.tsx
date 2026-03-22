import { Link, useLocation } from 'react-router-dom';
import { SearchBar } from '../SearchBar';
import { ThemeToggle } from '../ThemeToggle';

export function Navbar() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-page)' }}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          to="/"
          className="font-semibold tracking-tight transition-opacity duration-200 hover:opacity-80 active:opacity-60"
          style={{ color: 'var(--text-primary)' }}
        >
          SentimentSignal
        </Link>

        <div className="flex-1 max-w-md">
          <SearchBar />
        </div>

        <nav className="flex items-center gap-0.5">
          <Link
            to="/app"
            className={`rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-[var(--accent-subtle)] ${
              location.pathname === '/app' ? 'bg-[var(--accent-subtle)]' : ''
            }`}
            style={{
              color: location.pathname === '/app' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            Dashboard
          </Link>
          <Link
            to="/app/watchlists"
            className={`rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-[var(--accent-subtle)] ${
              location.pathname.startsWith('/app/watchlists') ? 'bg-[var(--accent-subtle)]' : ''
            }`}
            style={{
              color: location.pathname.startsWith('/app/watchlists') ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            Watchlists
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
