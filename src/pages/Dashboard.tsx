import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, ArrowUpRight, ArrowDownRight, BarChart2, Newspaper, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrending, getShifters, type TrendingStock, type ShifterStock } from '../api/stocks';

function PriceChange({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums" style={{ color: up ? '#22c55e' : '#ef4444' }}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function StockCard({ stock, index }: { stock: TrendingStock; index: number }) {
  const up = (stock.change_pct ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Link
        to={`/app/stock/${stock.symbol}`}
        className="group block rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {stock.symbol}
            </span>
            {(stock as any).name && (
              <p className="mt-0.5 text-[11px] truncate max-w-[110px]" style={{ color: 'var(--text-muted)' }}>
                {(stock as any).name}
              </p>
            )}
          </div>
          {stock.mentions != null && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              {stock.mentions} mentions
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end justify-between">
          <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {stock.price != null ? `$${stock.price.toFixed(2)}` : '—'}
          </span>
          <PriceChange pct={stock.change_pct} />
        </div>

        {/* Bottom accent bar */}
        <div
          className="mt-3 h-0.5 rounded-full opacity-60"
          style={{ backgroundColor: up ? '#22c55e' : '#ef4444', width: '100%' }}
        />
      </Link>
    </motion.div>
  );
}

function TrendingSection() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['trending'], queryFn: getTrending });

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Trending
        </h2>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--bg-surface)' }} />
          ))}
        </div>
      )}

      {isError && (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Could not load trending stocks — is the backend running?
        </p>
      )}

      {data && data.length === 0 && (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No data yet — run the pipeline to populate stocks.
        </p>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((stock: TrendingStock, i: number) => (
            <StockCard key={stock.symbol} stock={stock} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function ShiftersSection() {
  const { data, isLoading } = useQuery({ queryKey: ['shifters'], queryFn: getShifters });

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Sentiment Shifters
        </h2>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>24h</span>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
            <div className="h-4 w-14 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            <div className="h-3 flex-1 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            <div className="h-4 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          </div>
        ))}

        {data && data.length === 0 && (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Not enough data yet to show shifters.
          </p>
        )}

        {data && data.map((stock: ShifterStock, i: number) => {
          const up = (stock.sentiment_delta_24h ?? 0) >= 0;
          return (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group flex items-center justify-between px-5 py-3.5 border-b last:border-0 transition-colors hover:bg-[var(--bg-elevated)] cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              <Link to={`/app/stock/${stock.symbol}`} className="flex items-center gap-4 flex-1 min-w-0">
                <span className="w-14 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{stock.symbol}</span>
                <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {stock.price != null ? `$${stock.price.toFixed(2)}` : ''}
                </span>
                {stock.change_pct != null && <PriceChange pct={stock.change_pct} />}
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(stock as any).recent_mentions ?? 0} mentions
                </span>
                <span
                  className="text-sm font-bold tabular-nums w-16 text-right"
                  style={{ color: up ? '#22c55e' : '#ef4444' }}
                >
                  {up ? '↑' : '↓'} {Math.abs((stock.sentiment_delta_24h ?? 0) * 100).toFixed(0)} pts
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function StatsBar({ trendingCount }: { trendingCount: number }) {
  const stats = [
    { icon: BarChart2, label: 'Stocks tracked', value: '100' },
    { icon: Newspaper, label: 'Articles indexed', value: '2,000+' },
    { icon: Activity, label: 'Sources', value: 'Finnhub · Yahoo' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{value}</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { data: trending } = useQuery({ queryKey: ['trending'], queryFn: getTrending });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Hero */}
      <div className="space-y-1 pt-2">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Market Sentiment
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Credibility-filtered signals from news, Reddit, and financial media
        </p>
      </div>

      <StatsBar trendingCount={trending?.length ?? 0} />
      <TrendingSection />
      <ShiftersSection />
    </motion.div>
  );
}
