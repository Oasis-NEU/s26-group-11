import { motion } from 'framer-motion';
import { Bookmark } from 'lucide-react';

export function Watchlists() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Watchlists
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Track your favorite stocks — coming soon
        </p>
      </div>

      <div className={`group relative overflow-hidden rounded-lg border p-20 text-center transition-colors duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]`} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-lg border opacity-60"
            style={{
              width: 120 + i * 20,
              height: 80,
              left: `${20 + i * 25}%`,
              top: `${30 + (i % 2) * 20}%`,
              borderColor: 'var(--graphic-stroke)',
              backgroundColor: 'var(--graphic-fill)',
            }}
            animate={{ y: [0, -8, 0], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          />
        ))}
        <div className="absolute bottom-1/4 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full border opacity-50" style={{ borderColor: 'var(--graphic-stroke)' }} />
        <Bookmark className="relative mx-auto h-12 w-12 transition-colors duration-200 group-hover:opacity-70" strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
        <p className="relative mt-4 text-sm transition-colors duration-200 group-hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Watchlist manager</p>
      </div>
    </motion.div>
  );
}
