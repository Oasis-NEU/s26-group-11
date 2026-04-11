import { useState, useEffect } from 'react';
import { X, TrendingUp, BarChart2, Rss } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'ss_visited';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const FEATURES = [
  { icon: <Rss size={13} />, text: 'Real-time news & Reddit sentiment' },
  { icon: <TrendingUp size={13} />, text: 'AI-scored bullish/bearish signals' },
  { icon: <BarChart2 size={13} />, text: 'Heatmaps, screener & compare tools' },
];

export function FirstVisitBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage blocked — don't show banner
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="border-b"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="mx-auto max-w-screen-xl px-5 py-3 flex items-center gap-4 flex-wrap">
            {/* Accent dot */}
            <span
              className="hidden sm:block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}
            />

            {/* Label */}
            <span
              className="text-[10px] font-black uppercase tracking-widest shrink-0"
              style={{ color: 'var(--accent)', ...MONO }}
            >
              Welcome
            </span>

            {/* Description */}
            <span className="text-[11px] hidden sm:block" style={{ color: 'var(--text-secondary)', ...MONO }}>
              SentimentSignal tracks market sentiment across thousands of news sources &amp; social posts.
            </span>

            {/* Feature chips */}
            <div className="flex items-center gap-3 flex-wrap">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: 'var(--text-muted)', ...MONO }}
                >
                  <span style={{ color: 'var(--accent)' }}>{f.icon}</span>
                  {f.text}
                </div>
              ))}
            </div>

            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="ml-auto p-1 transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
