import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { landingVariants } from '../components/PageTransition';
import { useAuth } from '../store/useAuth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

// Example signal data for the bottom ticker
const SIGNALS = [
  { ticker: 'AAPL',  dir: '▲', pct: '2.31%', label: 'Strongly Bullish',  color: '#16a34a' },
  { ticker: 'TSLA',  dir: '▼', pct: '1.87%', label: 'Bearish',           color: '#ef4444' },
  { ticker: 'NVDA',  dir: '▲', pct: '3.14%', label: 'Bullish',           color: '#22c55e' },
  { ticker: 'META',  dir: '▲', pct: '0.94%', label: 'Bullish',           color: '#22c55e' },
  { ticker: 'AMZN',  dir: '▼', pct: '0.52%', label: 'Neutral',           color: '#d97706' },
  { ticker: 'MSFT',  dir: '▲', pct: '1.42%', label: 'Bullish',           color: '#22c55e' },
  { ticker: 'JPM',   dir: '▲', pct: '0.78%', label: 'Bullish',           color: '#22c55e' },
  { ticker: 'GOOGL', dir: '▼', pct: '0.33%', label: 'Neutral',           color: '#d97706' },
  { ticker: 'BRK-B', dir: '▲', pct: '0.61%', label: 'Bullish',           color: '#22c55e' },
  { ticker: 'XOM',   dir: '▼', pct: '1.19%', label: 'Bearish',           color: '#ef4444' },
];

const STATS = [
  { value: 50,   suffix: '+',  label: 'News Sources'    },
  { value: 100,  suffix: '+',  label: 'Stocks Tracked'  },
  { value: 10,   suffix: ' levels', label: 'Sentiment Depth' },
];

// Simple count-up hook
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const steps = 40;
    const stepMs = duration / steps;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setCount(Math.round((target * i) / steps));
      if (i >= steps) clearInterval(timer);
    }, stepMs);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

function StatPill({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const count = useCountUp(value, 1000);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex flex-col items-center gap-0.5"
    >
      <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-primary)', ...MONO }}>
        {count}{suffix}
      </span>
      <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
        {label}
      </span>
    </motion.div>
  );
}

// Headline word-by-word reveal
const HEADLINE_WORDS = ['Read', 'the', 'Market.'];

export function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn, email } = useAuth();

  function goToApp() { navigate('/app'); }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) goToApp();
    };
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) goToApp();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Blinking cursor for LIVE indicator
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 700);
    return () => clearInterval(t);
  }, []);

  const ticker = [...SIGNALS, ...SIGNALS, ...SIGNALS];

  return (
    <motion.div variants={landingVariants} initial="initial" animate="animate" exit="exit">
      <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-page)' }}>

        {/* Accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-[2px] z-30" style={{ backgroundColor: 'var(--accent)' }} />

        {/* Top-right controls */}
        <div className="absolute right-4 top-5 z-20 flex items-center gap-3">
          {isLoggedIn() ? (
            <motion.button
              onClick={goToApp}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="text-[10px] font-black uppercase tracking-widest border px-3 py-1.5 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
            >
              {email?.split('@')[0]} →
            </motion.button>
          ) : (
            <>
              <Link
                to="/auth"
                className="text-[10px] font-black uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                Sign in
              </Link>
              <Link
                to="/auth?mode=register"
                className="text-[10px] font-black uppercase tracking-widest border px-3 py-1.5 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
              >
                Create account
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>

        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `
              linear-gradient(var(--graphic-stroke) 1px, transparent 1px),
              linear-gradient(90deg, var(--graphic-stroke) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
          }}
        />

        {/* Ambient orbs */}
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -40, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 top-10 h-[600px] w-[600px] rounded-full blur-[140px]"
          style={{ backgroundColor: 'var(--graphic-fill)' }}
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -right-20 bottom-20 h-[500px] w-[500px] rounded-full blur-[120px]"
          style={{ backgroundColor: 'rgba(22,101,52,0.07)' }}
        />

        {/* Radar rings */}
        {[600, 420, 260].map((size, i) => (
          <motion.div
            key={size}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ width: size, height: size, borderColor: 'var(--graphic-stroke)', opacity: 0.25 - i * 0.05 }}
            animate={{ scale: [1, 1.08 + i * 0.03, 1], opacity: [0.25 - i * 0.05, 0.1, 0.25 - i * 0.05] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeOut', delay: i * 0.6 }}
          />
        ))}

        {/* Floating particles */}
        {[...Array(24)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              backgroundColor: i % 5 === 0 ? 'var(--accent)' : 'var(--text-primary)',
              left: `${8 + (i * 3.8) % 84}%`,
              top: `${5 + (i * 4.1) % 90}%`,
            }}
            animate={{ opacity: [0.08, 0.4, 0.08], y: [0, -20, 0], x: [0, 8, 0] }}
            transition={{ duration: 4 + (i % 4), repeat: Infinity, delay: (i * 0.18) % 3, ease: 'easeInOut' }}
          />
        ))}

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="relative z-10 flex min-h-screen flex-col px-6">

        {/* centre panel — grows to fill, centers content */}
        <div className="flex flex-1 flex-col items-center justify-center">

          {/* LIVE indicator */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 flex items-center gap-2"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: 'var(--accent)',
                opacity: blink ? 1 : 0.2,
                transition: 'opacity 0.15s ease',
              }}
            />
            <span className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--accent)', ...MONO }}>
              Live Signal
            </span>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              · Stock Sentiment Intelligence
            </span>
          </motion.div>

          {/* Headline — word-by-word reveal */}
          <h1 className="text-center leading-none mb-2" style={{ color: 'var(--text-primary)', ...MONO }}>
            {HEADLINE_WORDS.map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 40, skewX: -4 }}
                animate={{ opacity: 1, y: 0, skewX: 0 }}
                transition={{ delay: 0.35 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                className="inline-block mr-[0.25em] font-black"
                style={{
                  fontSize: 'clamp(3.2rem, 9vw, 7.5rem)',
                  color: word === 'Market.' ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          {/* Accent divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.85, duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="mb-8 mt-6 h-[2px] w-32 origin-left"
            style={{ backgroundColor: 'var(--accent)' }}
          />

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="mb-10 max-w-sm text-center text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)', ...MONO }}
          >
            Sentiment scored from the world's top financial sources.
            <br />
            <span style={{ color: 'var(--text-muted)' }}>Trade with context. Not just price.</span>
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.5 }}
            className="mb-12"
          >
            <motion.button
              onClick={goToApp}
              whileHover={{ scale: 1.04, boxShadow: '0 0 32px rgba(34,197,94,0.18)' }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-3 px-10 py-4 text-sm font-black uppercase tracking-widest transition-all"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#000',
                ...MONO,
              }}
            >
              Enter the Feed
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
            </motion.button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-8 sm:gap-14"
          >
            {STATS.map((s, i) => (
              <StatPill key={s.label} value={s.value} suffix={s.suffix} label={s.label} delay={1.3 + i * 0.1} />
            ))}
          </motion.div>

        </div>{/* end centre panel */}

        {/* Bottom signal ticker strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="overflow-hidden"
          style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <div
            className="flex items-center gap-0 py-1.5"
            style={{ animation: 'ticker-scroll 35s linear infinite', width: 'max-content' }}
          >
            {ticker.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-5 text-[10px] border-r shrink-0"
                style={{ borderColor: 'var(--border)', ...MONO }}
              >
                <span style={{ color: s.color, fontSize: '7px' }}>●</span>
                <span className="font-black" style={{ color: 'var(--text-primary)' }}>{s.ticker}</span>
                <span className="font-bold" style={{ color: s.color }}>{s.dir} {s.pct}</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </span>
            ))}
          </div>
        </motion.div>

        {/* Press Enter hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="py-2 text-center text-[9px] uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', ...MONO }}
        >
          Press Enter or scroll to explore
        </motion.p>

        </div>{/* end outer flex column */}

        {/* Noise overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </motion.div>
  );
}
