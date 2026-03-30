import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrending, getShifters, getFeed, type TrendingStock, type ShifterStock, type Mention } from '../api/stocks';

// ─── Utilities ──────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const SOURCE_LABELS: Record<string, string> = {
  'yahoo.com': 'Yahoo Finance',
  'finance.yahoo.com': 'Yahoo Finance',
  'bloomberg.com': 'Bloomberg',
  'reuters.com': 'Reuters',
  'wsj.com': 'Wall St. Journal',
  'cnbc.com': 'CNBC',
  'marketwatch.com': 'MarketWatch',
  'businessinsider.com': 'Business Insider',
  'forbes.com': 'Forbes',
  'barrons.com': "Barron's",
  'ft.com': 'Financial Times',
  'seekingalpha.com': 'Seeking Alpha',
  'thestreet.com': 'The Street',
  'investopedia.com': 'Investopedia',
};

function getSourceLabel(domain: string): string {
  const key = Object.keys(SOURCE_LABELS).find(k => domain.includes(k));
  return key ? SOURCE_LABELS[key] : domain.replace(/\.(com|net|org|io)$/, '');
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

function PriceChange({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--text-muted)', ...MONO }} className="text-[11px]">—</span>;
  const up = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] tabular-nums font-semibold"
      style={{ color: up ? 'var(--accent)' : 'var(--red)', ...MONO }}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────

function FeedCard({ mention, index }: { mention: Mention; index: number }) {
  const ticker = mention.ticker ?? '';
  const domain = mention.news_source ?? mention.author ?? '';
  const sourceLabel = getSourceLabel(domain);
  const isHero = index === 0;

  const credColor =
    mention.credibility_score >= 80
      ? 'var(--accent)'
      : mention.credibility_score >= 60
      ? '#b45309'
      : 'var(--text-muted)';

  const credLabel =
    mention.credibility_score >= 80
      ? 'High credibility'
      : mention.credibility_score >= 60
      ? 'Medium credibility'
      : 'Low credibility';

  return (
    <article className="border-b py-5" style={{ borderColor: 'var(--border)' }}>
      {/* Source row */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-bold tracking-[0.1em] uppercase"
          style={{ color: 'var(--text-muted)', ...MONO }}
        >
          {sourceLabel}
        </span>
        {ticker && (
          <Link
            to={`/app/stock/${ticker}`}
            className="text-[10px] font-bold px-1.5 py-px border transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', ...MONO }}
          >
            {ticker}
          </Link>
        )}
        <span className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)', ...MONO }}>
          {timeAgo(mention.published_at)}
        </span>
      </div>

      {/* Headline */}
      <a
        href={mention.url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        <h3
          className={`font-bold leading-snug group-hover:underline underline-offset-2 decoration-1 ${
            isHero ? 'text-[1.25rem]' : 'text-[0.9375rem]'
          }`}
          style={{ color: 'var(--text-primary)' }}
        >
          {mention.text}
        </h3>
      </a>

      {/* Credibility */}
      <div className="mt-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: credColor, ...MONO }}>
        {credLabel}
      </div>
    </article>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border-b py-5 space-y-2.5 animate-pulse" style={{ borderColor: 'var(--border)' }}>
          <div className="h-2.5 w-24 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-2.5 w-20 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        </div>
      ))}
    </>
  );
}

// ─── Sidebar Skeleton ─────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-2.5 border-b animate-pulse"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="h-2.5 w-10 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-2.5 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        </div>
      ))}
    </>
  );
}

// ─── Trending Sidebar ────────────────────────────────────────────────────────

function TrendingSidebar() {
  const { data: trending, isLoading: tLoading } = useQuery({ queryKey: ['trending'], queryFn: getTrending });
  const { data: shifters, isLoading: sLoading } = useQuery({ queryKey: ['shifters'], queryFn: getShifters });

  return (
    <aside className="space-y-8">
      {/* Trending */}
      <div>
        <div
          className="flex items-center justify-between pb-2 mb-0 border-b-2"
          style={{ borderColor: 'var(--text-primary)' }}
        >
          <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)', ...MONO }}>
            Trending
          </h3>
        </div>

        {tLoading ? (
          <SidebarSkeleton />
        ) : (
          trending?.map((stock: TrendingStock) => (
            <Link
              key={stock.symbol}
              to={`/app/stock/${stock.symbol}`}
              className="flex items-center justify-between py-2.5 border-b -mx-1 px-1 transition-colors hover:bg-[var(--bg-surface)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold w-12 shrink-0" style={{ color: 'var(--text-primary)', ...MONO }}>
                  {stock.symbol}
                </span>
                {(stock as any).mentions != null && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {(stock as any).mentions}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)', ...MONO }}>
                  {stock.price != null ? `$${stock.price.toFixed(0)}` : '—'}
                </span>
                <PriceChange pct={stock.change_pct} />
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Movers */}
      <div>
        <div
          className="flex items-center gap-2 pb-2 mb-0 border-b-2"
          style={{ borderColor: 'var(--text-primary)' }}
        >
          <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)', ...MONO }}>
            Movers
          </h3>
          <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)', ...MONO }}>
            24h
          </span>
        </div>

        {sLoading ? (
          <SidebarSkeleton />
        ) : (
          shifters?.slice(0, 8).map((stock: ShifterStock) => {
            const up = (stock.sentiment_delta_24h ?? 0) >= 0;
            return (
              <Link
                key={stock.symbol}
                to={`/app/stock/${stock.symbol}`}
                className="flex items-center justify-between py-2.5 border-b -mx-1 px-1 transition-colors hover:bg-[var(--bg-surface)]"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)', ...MONO }}>
                  {stock.symbol}
                </span>
                <div className="flex items-center gap-2">
                  {stock.price != null && (
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)', ...MONO }}>
                      ${stock.price.toFixed(0)}
                    </span>
                  )}
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: up ? 'var(--accent)' : 'var(--red)', ...MONO }}>
                    {up ? '▲' : '▼'} {Math.abs((stock.sentiment_delta_24h ?? 0) * 100).toFixed(0)}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}

// ─── News Feed ────────────────────────────────────────────────────────────────

function NewsFeed() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['feed'], queryFn: getFeed });

  return (
    <div>
      {/* Section header */}
      <div
        className="flex items-center justify-between border-b-2 pb-3 mb-0"
        style={{ borderColor: 'var(--text-primary)' }}
      >
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)', ...MONO }}>
          Latest Intelligence
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)', ...MONO }}>
            Live
          </span>
        </div>
      </div>

      {isLoading && <FeedSkeleton />}

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

      {data?.map((mention: Mention, i: number) => (
        <FeedCard key={mention.id ?? i} mention={mention} index={i} />
      ))}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  return (
    <div className="flex gap-12">
      {/* Main feed */}
      <div className="min-w-0 flex-1">
        <NewsFeed />
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-20">
          <TrendingSidebar />
        </div>
      </div>
    </div>
  );
}
