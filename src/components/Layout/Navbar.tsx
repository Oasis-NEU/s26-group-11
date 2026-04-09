import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchBar } from '../SearchBar';
import { useAuth } from '../../store/useAuth';
import { Avatar } from '../Avatar';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const MARKET_SECTIONS = ['MARKETS', 'EARNINGS', 'MACRO', 'CRYPTO', 'ANALYSIS'] as const;

function useDateDisplay() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

export function Navbar() {
  const location    = useLocation();
  const { isLoggedIn, email, username, avatar_url } = useAuth();
  const dateDisplay = useDateDisplay();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const NAV_LINKS = [
    { label: 'Feed',         path: '/app' },
    { label: 'Discuss',      path: '/app/discuss' },
    { label: 'Watchlist',    path: '/app/watchlists' },
    { label: 'Portfolio',    path: '/app/portfolio' },
    { label: 'Compare',      path: '/app/compare' },
    { label: 'Heatmap',      path: '/app/heatmap' },
    { label: 'Screener',     path: '/app/screener' },
    { label: 'Activity',     path: '/app/activity' },
    { label: 'Alerts',       path: '/app/alerts' },
    { label: 'How It Works', path: '/app/how-it-works' },
  ];

  function closeMenu() { setMenuOpen(false); }

  return (
    <header className="sticky top-0 z-40" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Accent stripe */}
      <div className="h-[3px] w-full" style={{ backgroundColor: 'var(--accent)' }} />

      {/* Main bar */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex h-12 max-w-screen-xl items-center justify-between gap-4 px-5">

          {/* Brand */}
          <Link
            to="/"
            className="shrink-0 font-black uppercase"
            style={{ color: 'var(--text-primary)', fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.875rem', letterSpacing: '0.22em' }}
          >
            SentimentSignal
          </Link>

          {/* ── Desktop right side ── */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="max-w-xs flex-1">
              <SearchBar />
            </div>

            {/* Nav links with sliding indicator */}
            <nav className="flex items-center">
              {NAV_LINKS.slice(0, 6).map(({ label, path }) => {
                const active = path === '/app'
                  ? location.pathname === '/app'
                  : location.pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className="relative px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
                    style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {label}
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-0 right-0 h-[2px]"
                        style={{ backgroundColor: 'var(--accent)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Auth / Settings */}
            {isLoggedIn() ? (
              <Link
                to="/app/profile"
                className="flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ color: location.pathname === '/app/profile' ? 'var(--accent)' : 'var(--text-muted)' }}
                title="Profile & Settings"
              >
                <Avatar name={username ?? '?'} avatarUrl={avatar_url} size={22} />
                <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:block truncate max-w-[80px]" style={MONO}>
                  {username ?? 'Profile'}
                </span>
                <Settings size={13} />
              </Link>
            ) : (
              <Link
                to="/auth"
                className="text-[9px] font-bold uppercase tracking-widest border px-2.5 py-1 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
              >
                Sign in
              </Link>
            )}
          </div>

          {/* ── Mobile right side ── */}
          <div className="flex sm:hidden items-center gap-3">
            {isLoggedIn() ? (
              <Link to="/app/profile" onClick={closeMenu}>
                <Avatar name={username ?? '?'} avatarUrl={avatar_url} size={24} />
              </Link>
            ) : (
              <Link
                to="/auth"
                className="text-[9px] font-bold uppercase tracking-widest border px-2 py-1 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
              >
                Sign in
              </Link>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="sm:hidden border-b overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="px-5 py-4 space-y-4">
              {/* Search */}
              <SearchBar />

              {/* Nav links */}
              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map(({ label, path }) => {
                  const active = path === '/app'
                    ? location.pathname === '/app'
                    : location.pathname.startsWith(path);
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={closeMenu}
                      className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors"
                      style={{
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                        ...MONO,
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
                {isLoggedIn() && (
                  <Link
                    to="/app/profile"
                    onClick={closeMenu}
                    className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors"
                    style={{
                      color: location.pathname === '/app/profile' ? 'var(--accent)' : 'var(--text-secondary)',
                      borderLeft: location.pathname === '/app/profile' ? '2px solid var(--accent)' : '2px solid transparent',
                      ...MONO,
                    }}
                  >
                    Profile &amp; Settings
                  </Link>
                )}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secondary sub-nav */}
      <div className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="mx-auto flex h-8 max-w-screen-xl items-center justify-between px-3 sm:px-5">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none min-w-0">
            {MARKET_SECTIONS.map((section, i) => (
              <span
                key={section}
                className="category-tag transition-colors cursor-default select-none"
                style={{
                  color: 'var(--text-muted)',
                  borderRight: i < MARKET_SECTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                  paddingLeft: i === 0 ? 0 : undefined,
                }}
              >
                {section}
              </span>
            ))}
          </div>
          <span className="text-[9px] font-bold tracking-widest select-none shrink-0 hidden sm:block" style={{ color: 'var(--text-muted)', ...MONO }}>
            {dateDisplay}
          </span>
        </div>
      </div>
    </header>
  );
}
