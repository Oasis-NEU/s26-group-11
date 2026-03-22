import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart2, MessageSquare } from 'lucide-react';

const cardStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' };
const cardHover = 'hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]';

export function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <Link
        to="/app"
        className="group inline-flex items-center gap-2 text-sm transition-colors duration-200"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" strokeWidth={1.5} />
        Back
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {symbol ?? 'Stock'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Detail view — coming soon</p>
      </div>

      <div className={`group relative overflow-hidden rounded-lg border p-16 text-center transition-colors duration-200 ${cardHover}`} style={cardStyle}>
        <svg className="absolute inset-0 m-auto h-48 w-full max-w-md opacity-[0.15]" viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice">
          <motion.path d="M 0 80 Q 50 60, 100 80 T 200 80 T 300 80" fill="none" stroke="var(--graphic-stroke)" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: 'easeOut' }} />
          <motion.path d="M 0 80 Q 50 60, 100 80 T 200 80 T 300 80" fill="none" stroke="var(--graphic-stroke)" strokeWidth="1" strokeDasharray="8 4" initial={{ strokeDashoffset: 0 }} animate={{ strokeDashoffset: -24 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
        </svg>
        <BarChart2 className="relative mx-auto h-12 w-12 transition-colors duration-200 group-hover:opacity-70" strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
        <p className="relative mt-4 text-sm transition-colors duration-200 group-hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Sentiment chart</p>
      </div>

      <div className={`group relative overflow-hidden rounded-lg border p-16 text-center transition-colors duration-200 ${cardHover}`} style={cardStyle}>
        <div className="absolute left-8 top-1/2 flex -translate-y-1/2 gap-2 opacity-20">
          {[0.6, 0.4, 0.8, 0.5].map((w, i) => (
            <motion.div key={i} className="h-12 rounded opacity-40" style={{ width: `${w * 48}px`, backgroundColor: 'var(--text-primary)' }} animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
        <MessageSquare className="relative mx-auto h-12 w-12 transition-colors duration-200 group-hover:opacity-70" strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
        <p className="relative mt-4 text-sm transition-colors duration-200 group-hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Mentions</p>
      </div>
    </motion.div>
  );
}
