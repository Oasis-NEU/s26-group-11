import { motion } from 'framer-motion';
import { TrendingUp, Zap, Bookmark } from 'lucide-react';

const cardStyle = {
  borderColor: 'var(--border)',
  backgroundColor: 'var(--bg-surface)',
} as const;

const cardHoverStyle = 'hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]';

export function Dashboard() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-12"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          Sentiment Intelligence
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Real-time quality analysis from the world
        </p>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
          Trending
        </h2>
        <div className={`group relative overflow-hidden rounded-lg border p-12 text-center transition-colors duration-200 ${cardHoverStyle}`} style={cardStyle}>
          <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 pb-4 opacity-20">
            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8].map((h, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full opacity-60"
                style={{ backgroundColor: 'var(--text-primary)' }}
                animate={{ height: [`${h * 16}px`, `${h * 24}px`, `${h * 16}px`] }}
                transition={{ duration: 2 + i * 0.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
              />
            ))}
          </div>
          <TrendingUp className="relative mx-auto mb-3 h-10 w-10 transition-colors duration-200 group-hover:opacity-70" strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          <p className="relative text-sm transition-colors duration-200 group-hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Trending stocks — coming soon</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
          Sentiment shifters
        </h2>
        <div className={`group relative overflow-hidden rounded-lg border p-12 text-center transition-colors duration-200 ${cardHoverStyle}`} style={cardStyle}>
          <svg className="absolute right-4 top-1/2 h-20 w-20 -translate-y-1/2 opacity-[0.2]" viewBox="0 0 100 100">
            <motion.path
              d="M 10 50 L 30 30 L 50 50 L 70 70 L 90 50"
              fill="none"
              stroke="var(--graphic-stroke)"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          </svg>
          <Zap className="relative mx-auto mb-3 h-10 w-10 transition-colors duration-200 group-hover:opacity-70" strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          <p className="relative text-sm transition-colors duration-200 group-hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Big movers — coming soon</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} />
          Watchlist
        </h2>
        <div className={`group relative overflow-hidden rounded-lg border p-12 text-center transition-colors duration-200 ${cardHoverStyle}`} style={cardStyle}>
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-40" style={{ borderColor: 'var(--graphic-stroke)' }} />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-60" style={{ borderColor: 'var(--graphic-stroke)' }} />
          <Bookmark className="relative mx-auto mb-3 h-10 w-10 transition-colors duration-200 group-hover:opacity-70" strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          <p className="relative text-sm transition-colors duration-200 group-hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Your watchlist — coming soon</p>
        </div>
      </section>
    </motion.div>
  );
}
