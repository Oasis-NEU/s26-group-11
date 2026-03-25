import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, Bookmark, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrending, getShifters, type TrendingStock, type ShifterStock } from '../api/stocks';

const cardStyle = {
  borderColor: 'var(--border)',
  backgroundColor: 'var(--bg-surface)',
} as const;

const cardHoverStyle = 'hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]';

function SentimentBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
  const pct = Math.round((score + 1) * 50);
  const color = score > 0.1 ? '#22c55e' : score < -0.1 ? '#ef4444' : '#94a3b8';
  return (
    <span className="text-xs font-medium tabular-nums" style={{ color }}>
      {pct}%
    </span>
  );
}

function PriceChange({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums" style={{ color: up ? '#22c55e' : '#ef4444' }}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
      <div className="h-4 w-12 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      <div className="h-4 flex-1 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      <div className="h-4 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
    </div>
  );
}

function TrendingSection() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['trending'], queryFn: getTrending });

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
        Trending
      </h2>
      <div className={`rounded-lg border transition-colors duration-200 ${cardHoverStyle}`} style={cardStyle}>
        {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

        {isError && (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Could not load trending stocks — is the backend running?
          </p>
        )}

        {data && data.length === 0 && (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No data yet — run the pipeline to populate stocks.
          </p>
        )}

        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                {['Symbol', 'Price', 'Change', 'Sentiment', 'Mentions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((stock: TrendingStock, i: number) => (
                <motion.tr
                  key={stock.symbol}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b last:border-0 transition-colors duration-150 hover:bg-[var(--bg-elevated)] cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-3">
                    <Link to={`/app/stock/${stock.symbol}`} className="font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>
                      {stock.symbol}
                    </Link>
                    {stock.name && (
                      <div className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{stock.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {stock.price != null ? `$${stock.price.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3"><PriceChange pct={stock.change_pct} /></td>
                  <td className="px-4 py-3"><SentimentBadge score={stock.sentiment_score} /></td>
                  <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-muted)' }}>{stock.mention_count}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function ShiftersSection() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['shifters'], queryFn: getShifters });

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
        Sentiment shifters
      </h2>
      <div className={`rounded-lg border transition-colors duration-200 ${cardHoverStyle}`} style={cardStyle}>
        {isLoading && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}

        {isError && (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Could not load sentiment shifters.
          </p>
        )}

        {data && data.length === 0 && (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Not enough historical data yet.
          </p>
        )}

        {data && data.length > 0 && (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {data.map((stock: ShifterStock, i: number) => {
              const up = stock.sentiment_delta_24h >= 0;
              return (
                <motion.div
                  key={stock.symbol}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <Link to={`/app/stock/${stock.symbol}`} className="flex flex-col hover:underline" style={{ color: 'var(--text-primary)' }}>
                    <span className="font-semibold">{stock.symbol}</span>
                    {stock.name && <span className="text-xs truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>{stock.name}</span>}
                  </Link>
                  <div className="flex items-center gap-4">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {stock.price != null ? `$${stock.price.toFixed(2)}` : ''}
                    </span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: up ? '#22c55e' : '#ef4444' }}>
                      {up ? '+' : ''}{(stock.sentiment_delta_24h * 100).toFixed(1)}pts
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

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

      <TrendingSection />
      <ShiftersSection />

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
