import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { getStockDetail, getStockMentions, getStockChart, type Mention, type ChartPoint, type Fundamentals } from '../api/stocks';

const cardStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' };
const cardHover = 'hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]';

function sentimentColor(score: number | null) {
  if (score === null) return 'var(--text-muted)';
  return score > 0.1 ? '#22c55e' : score < -0.1 ? '#ef4444' : '#94a3b8';
}

function sentimentLabel(score: number | null) {
  if (score === null) return '—';
  if (score > 0.1) return 'Bullish';
  if (score < -0.1) return 'Bearish';
  return 'Neutral';
}

function SentimentBar({ score }: { score: number | null }) {
  const pct = score !== null ? Math.round((score + 1) * 50) : null;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        {pct !== null && (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: sentimentColor(score) }}
          />
        )}
      </div>
      <span className="text-xs tabular-nums font-medium w-8 text-right" style={{ color: sentimentColor(score) }}>
        {pct !== null ? `${pct}%` : '—'}
      </span>
    </div>
  );
}

function fmtVolume(v: number | null) {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

function fmtMarketCap(v: number | null) {
  if (v == null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

function FundamentalsGrid({ f }: { f: Fundamentals }) {
  const rows = [
    ['Open',    f.open != null ? `$${f.open.toFixed(2)}` : '—'],
    ['High',    f.day_high != null ? `$${f.day_high.toFixed(2)}` : '—'],
    ['Low',     f.day_low != null ? `$${f.day_low.toFixed(2)}` : '—'],
    ['Vol',     fmtVolume(f.volume)],
    ['Avg Vol', fmtVolume(f.avg_volume)],
    ['Mkt Cap', fmtMarketCap(f.market_cap)],
    ['P/E',     f.pe_ratio != null ? f.pe_ratio.toFixed(2) : '—'],
    ['EPS',     f.eps != null ? `$${f.eps.toFixed(2)}` : '—'],
    ['Beta',    f.beta != null ? f.beta.toFixed(2) : '—'],
    ['Yield',   f.dividend_yield != null && f.dividend_yield > 0 ? `${f.dividend_yield.toFixed(2)}%` : '—'],
    ['52W H',   f.fifty_two_week_high != null ? `$${f.fifty_two_week_high.toFixed(2)}` : '—'],
    ['52W L',   f.fifty_two_week_low != null ? `$${f.fifty_two_week_low.toFixed(2)}` : '—'],
  ];

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="grid grid-cols-3 divide-x divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-2 gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHART_PERIODS = ['1D', '1W', '1M', '3M', '1Y'] as const;
type ChartPeriod = typeof CHART_PERIODS[number];

function formatChartTime(isoTime: string, period: ChartPeriod) {
  const d = new Date(isoTime);
  if (period === '1D') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (period === '1Y') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PriceChart({ symbol, isUp }: { symbol: string; isUp: boolean }) {
  const [period, setPeriod] = useState<ChartPeriod>('1M');
  const color = isUp ? '#22c55e' : '#ef4444';

  const { data, isLoading } = useQuery({
    queryKey: ['chart', symbol, period],
    queryFn: () => getStockChart(symbol, period.toLowerCase()),
    staleTime: 5 * 60_000,
  });

  const chartData = (data ?? []).map((p: ChartPoint) => ({
    time: formatChartTime(p.time, period),
    price: p.close,
  }));

  const minPrice = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.999 : 0;
  const maxPrice = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.001 : 0;

  return (
    <div className="rounded-lg border p-5 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Price Chart</h2>
        <div className="flex gap-1">
          {CHART_PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: period === p ? 'var(--bg-elevated)' : 'transparent',
                color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: period === p ? 'var(--border-hover)' : 'transparent',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="h-48 animate-pulse rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      )}

      {!isLoading && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <defs>
              <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: 'var(--text-muted)' }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${symbol})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!isLoading && chartData.length === 0 && (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No price data available.</p>
      )}
    </div>
  );
}

const SOURCE_TABS = ['all', 'reddit', 'news'] as const;
type SourceTab = typeof SOURCE_TABS[number];

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    reddit: '#ff4500',
    twitter: '#1d9bf0',
    news: '#8b5cf6',
  };
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: `${colors[source] ?? '#888'}22`, color: colors[source] ?? '#888' }}
    >
      {source}
    </span>
  );
}

function MentionCard({ mention }: { mention: Mention }) {
  const date = new Date(mention.published_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
  return (
    <div className="rounded-lg border p-4 space-y-2 transition-colors" style={cardStyle}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SourceBadge source={mention.source} />
          {mention.subreddit && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>r/{mention.subreddit}</span>
          )}
          {mention.news_source && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{mention.news_source}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{date}</span>
          {mention.url && (
            <a href={mention.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            </a>
          )}
        </div>
      </div>
      <p className="text-sm line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{mention.text}</p>
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {mention.sentiment_label && (
          <span style={{ color: sentimentColor(mention.sentiment_score) }}>
            {mention.sentiment_label}
          </span>
        )}
        <span>Credibility {mention.credibility_score}</span>
        {mention.upvotes > 0 && <span>↑ {mention.upvotes}</span>}
      </div>
    </div>
  );
}

export function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [sourceTab, setSourceTab] = useState<SourceTab>('all');

  const { data: stock, isLoading: stockLoading, isError: stockError } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => getStockDetail(symbol!),
    enabled: !!symbol,
  });

  const { data: mentions, isLoading: mentionsLoading } = useQuery({
    queryKey: ['mentions', symbol, sourceTab],
    queryFn: () => getStockMentions(symbol!, sourceTab === 'all' ? undefined : sourceTab),
    enabled: !!symbol,
  });

  const chartData = stock?.history.map((h) => ({
    date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    overall: h.overall !== null ? Math.round((h.overall + 1) * 50) : null,
    news: h.news !== null ? Math.round((h.news + 1) * 50) : null,
  })) ?? [];

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

      {/* Header */}
      {stockLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 w-32 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-4 w-48 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        </div>
      )}

      {stockError && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Could not load {symbol} — check the backend.
        </p>
      )}

      {stock && (
        <>
          {/* Title + price */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {stock.symbol}
              </h1>
              {stock.name && (
                <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>{stock.name}</p>
              )}
            </div>
            {stock.price != null && (
              <div className="text-right">
                <div className="text-xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  ${stock.price.toFixed(2)}
                </div>
                {stock.change_pct != null && (
                  <div className="flex items-center justify-end gap-0.5 text-sm font-medium" style={{ color: stock.change_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {stock.change_pct >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {Math.abs(stock.change_pct).toFixed(2)}%
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price chart */}
          <PriceChart symbol={stock.symbol} isUp={(stock.change_pct ?? 0) >= 0} />

          {/* Fundamentals */}
          {stock.fundamentals && <FundamentalsGrid f={stock.fundamentals} />}

          {/* Sentiment breakdown */}
          <div className={`rounded-lg border p-5 space-y-4 transition-colors ${cardHover}`} style={cardStyle}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sentiment</h2>
              <span className="text-sm font-semibold" style={{ color: sentimentColor(stock.sentiment.overall) }}>
                {sentimentLabel(stock.sentiment.overall)}
              </span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Overall', score: stock.sentiment.overall, count: stock.sentiment.reddit_count + stock.sentiment.news_count },
                { label: 'Reddit', score: stock.sentiment.reddit, count: stock.sentiment.reddit_count },
                { label: 'News', score: stock.sentiment.news, count: stock.sentiment.news_count },
              ].map(({ label, score, count }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{label}</span>
                    <span>{count} mention{count !== 1 ? 's' : ''}</span>
                  </div>
                  <SentimentBar score={score} />
                </div>
              ))}
            </div>
          </div>

          {/* 7-day chart */}
          {chartData.length > 0 && (
            <div className={`rounded-lg border p-5 transition-colors ${cardHover}`} style={cardStyle}>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                7-Day Sentiment
              </h2>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                  />
                  <Line type="monotone" dataKey="overall" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Overall" connectNulls />
                  <Line type="monotone" dataKey="news" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="News" connectNulls strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Mentions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Mentions</h2>
              <div className="flex gap-1">
                {SOURCE_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSourceTab(tab)}
                    className="rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors"
                    style={{
                      backgroundColor: sourceTab === tab ? 'var(--bg-elevated)' : 'transparent',
                      color: sourceTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: sourceTab === tab ? 'var(--border-hover)' : 'transparent',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {mentionsLoading && (
              <div className="space-y-2 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }} />
                ))}
              </div>
            )}

            {mentions && mentions.length === 0 && (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No high-quality mentions found in the last 7 days.
              </p>
            )}

            {mentions && mentions.map((m: Mention) => (
              <MentionCard key={m.id} mention={m} />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
