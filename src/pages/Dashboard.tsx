import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ExternalLink, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrending, getShifters, getFeed, type TrendingStock, type ShifterStock, type Mention } from '../api/stocks';

// ─── Utilities ──────────────────────────────────────────────────────────────

function PriceChange({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums" style={{ color: up ? 'var(--accent)' : 'var(--red)' }}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'just now';
}

const SOURCE_COLORS: Record<string, string> = {
  bloomberg: '#000000',
  reuters: '#ff8000',
  wsj: '#004b87',
  cnbc: '#e40000',
  marketwatch: '#00b1d2',
  'finance.yahoo': '#6001d2',
  yahoo: '#6001d2',
  'businessinsider': '#1c1c1c',
  forbes: '#a1000a',
  barrons: '#d4ad30',
};

function sourceDot(domain: string) {
  const key = Object.keys(SOURCE_COLORS).find(k => domain.includes(k));
  return key ? SOURCE_COLORS[key] : '#6e6e6c';
}

// ─── News Feed Card ──────────────────────────────────────────────────────────

function FeedCard({ mention, index }: { mention: Mention; index: number }) {
  const color = sourceDot(mention.news_source ?? mention.author ?? '');
  const domain = mention.news_source ?? mention.author ?? '';
  const ticker = mention.ticker ?? '';

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.25 }}
      className="group border-b last:border-0 py-4 transition-colors hover:bg-[var(--bg-elevated)] px-1 -mx-1 rounded-lg cursor-pointer"
      style={{ borderColor: 'var(--border)' }}
    >
      <a href={mention.url ?? '#'} target="_blank" rel="noopener noreferrer" className="block">
        {/* Top row: source + ticker tag + time */}
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-medium truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
            {domain}
          </span>
          {ticker && (
            <Link
              to={`/app/stock/${ticker}`}
              onClick={e => e.stopPropagation()}
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              ${ticker}
            </Link>
          )}
          <span className="ml-auto text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(mention.published_at)}
          </span>
        </div>

        {/* Headline */}
        <p className="text-sm font-semibold leading-snug pr-6 transition-colors group-hover:text-[var(--accent)]" style={{ color: 'var(--text-primary)' }}>
          {mention.text}
        </p>

        {/* Credibility */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-1 w-16 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${mention.credibility_score}%`, backgroundColor: mention.credibility_score >= 80 ? 'var(--accent)' : mention.credibility_score >= 60 ? '#f59e0b' : 'var(--text-muted)' }}
              />
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {mention.credibility_score >= 80 ? 'High credibility' : mention.credibility_score >= 60 ? 'Medium' : 'Low'}
            </span>
          </div>
          <ExternalLink className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: 'var(--text-muted)' }} />
        </div>
      </a>
    </motion.article>
  );
}

// ─── Trending Sidebar ────────────────────────────────────────────────────────

function TrendingSidebar() {
  const { data: trending, isLoading: tLoading } = useQuery({ queryKey: ['trending'], queryFn: getTrending });
  const { data: shifters, isLoading: sLoading } = useQuery({ queryKey: ['shifters'], queryFn: getShifters });

  return (
    <aside className="space-y-6">
      {/* Trending */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Trending
          </h3>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          {tLoading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 animate-pulse" style={{ borderColor: 'var(--border)' }}>
              <div className="h-3 w-12 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            </div>
          ))}

          {trending?.map((stock: TrendingStock, i: number) => (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                to={`/app/stock/${stock.symbol}`}
                className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold w-14" style={{ color: 'var(--text-primary)' }}>{stock.symbol}</span>
                  {(stock as any).mentions != null && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{(stock as any).mentions}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {stock.price != null ? `$${stock.price.toFixed(0)}` : '—'}
                  </span>
                  <PriceChange pct={stock.change_pct} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Movers */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Movers
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>24h</span>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          {sLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 animate-pulse" style={{ borderColor: 'var(--border)' }}>
              <div className="h-3 w-12 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-3 w-14 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            </div>
          ))}

          {shifters?.slice(0, 8).map((stock: ShifterStock, i: number) => {
            const up = (stock.sentiment_delta_24h ?? 0) >= 0;
            return (
              <motion.div key={stock.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <Link
                  to={`/app/stock/${stock.symbol}`}
                  className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{stock.symbol}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {stock.price != null ? `$${stock.price.toFixed(0)}` : ''}
                    </span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: up ? 'var(--accent)' : 'var(--red)' }}>
                      {up ? '▲' : '▼'} {Math.abs((stock.sentiment_delta_24h ?? 0) * 100).toFixed(0)}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ─── Main Feed ───────────────────────────────────────────────────────────────

function NewsFeed() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['feed'], queryFn: getFeed });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Latest Intelligence</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Credibility-filtered from Bloomberg, Reuters, Yahoo Finance, and more</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>Live</span>
        </div>
      </div>

      {isLoading && Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border-b py-4 animate-pulse space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="h-3 w-32 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        </div>
      ))}

      {isError && (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Could not load feed — is the backend running?
        </p>
      )}

      {data && data.length === 0 && (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No articles yet — run the seed script to ingest news.
        </p>
      )}

      {data && data.map((mention: Mention, i: number) => (
        <FeedCard key={mention.id ?? i} mention={mention} index={i} />
      ))}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex gap-8"
    >
      {/* Main feed */}
      <div className="min-w-0 flex-1">
        <NewsFeed />
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-20">
          <TrendingSidebar />
        </div>
      </div>
    </motion.div>
  );
}
