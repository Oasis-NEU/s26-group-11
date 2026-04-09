import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getHeatmap, type HeatmapStock } from '../api/stocks';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

type Period = '1D' | '7D' | '30D';

const PERIOD_DAYS: Record<Period, number> = {
  '1D': 1,
  '7D': 7,
  '30D': 30,
};

function sentimentColor(score: number): string {
  if (score > 0.3) return '#16a34a';
  if (score > 0.1) return '#22c55e';
  if (score > 0.02) return '#4ade80';
  if (score > -0.02) return '#6b7280';
  if (score > -0.1) return '#f87171';
  if (score > -0.3) return '#ef4444';
  return '#dc2626';
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function HeatmapTile({ stock }: { stock: HeatmapStock }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const bgColor = sentimentColor(stock.avg_sentiment);
  const textColor = isLight(bgColor) ? '#111827' : '#f9fafb';

  // Size proportional to mention_count, clamped between 80px and 160px
  const size = Math.min(160, Math.max(80, 80 + Math.sqrt(stock.mention_count) * 6));

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <motion.div
        onClick={() => navigate(`/app/stock/${stock.ticker}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="cursor-pointer flex flex-col items-center justify-center gap-0.5 select-none"
        style={{
          width: size,
          height: size,
          backgroundColor: bgColor,
          opacity: hovered ? 1 : 0.9,
        }}
      >
        <span
          className="font-black text-sm leading-none"
          style={{ color: textColor, ...MONO }}
        >
          {stock.ticker}
        </span>
        <span
          className="text-[10px] leading-none tabular-nums"
          style={{ color: textColor, opacity: 0.9, ...MONO }}
        >
          {stock.avg_sentiment > 0 ? '+' : ''}
          {stock.avg_sentiment.toFixed(3)}
        </span>
        <span
          className="text-[9px] leading-none"
          style={{ color: textColor, opacity: 0.7, ...MONO }}
        >
          {stock.mention_count}x
        </span>
      </motion.div>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none border px-3 py-2 space-y-1 text-[11px] min-w-[140px]"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%) translateY(-6px)',
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
            ...MONO,
          }}
        >
          <div className="font-black text-sm">{stock.ticker}</div>
          <div>
            Sentiment:{' '}
            <span style={{ color: bgColor }}>
              {stock.avg_sentiment > 0 ? '+' : ''}
              {stock.avg_sentiment.toFixed(4)}
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            {stock.mention_count} mention{stock.mention_count !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonTile() {
  return (
    <div
      className="animate-pulse"
      style={{
        width: 96,
        height: 96,
        backgroundColor: 'var(--bg-elevated)',
      }}
    />
  );
}

function Legend() {
  const stops = [
    { color: '#dc2626', label: 'Bearish' },
    { color: '#ef4444', label: '' },
    { color: '#f87171', label: '' },
    { color: '#6b7280', label: 'Neutral' },
    { color: '#4ade80', label: '' },
    { color: '#22c55e', label: '' },
    { color: '#16a34a', label: 'Bullish' },
  ];

  return (
    <div className="flex flex-col items-center gap-2 mt-8">
      <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
        Sentiment Scale
      </span>
      <div className="flex items-center gap-0">
        {stops.map((s, i) => (
          <div key={i} style={{ width: 40, height: 14, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="flex items-center justify-between" style={{ width: stops.length * 40 }}>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>Bearish</span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>Neutral</span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>Bullish</span>
      </div>
    </div>
  );
}

export function Heatmap() {
  const [period, setPeriod] = useState<Period>('7D');
  const days = PERIOD_DAYS[period];

  const { data, isLoading } = useQuery<HeatmapStock[]>({
    queryKey: ['heatmap', days],
    queryFn: () => getHeatmap(days),
    staleTime: 5 * 60_000,
  });

  const stocks = data ?? [];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-screen-xl px-5 py-8 space-y-8"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-black uppercase tracking-widest"
              style={{ color: 'var(--text-primary)', ...MONO }}
            >
              Sentiment Heatmap
            </h1>
            <p className="text-xs mt-1 uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              All tracked stocks colored by recent sentiment
            </p>
          </div>

          {/* Period toggle */}
          <div className="flex items-center gap-0 border" style={{ borderColor: 'var(--border)' }}>
            {(['1D', '7D', '30D'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                style={{
                  ...MONO,
                  backgroundColor: period === p ? 'var(--accent)' : 'transparent',
                  color: period === p ? '#fff' : 'var(--text-muted)',
                  borderRight: p !== '30D' ? '1px solid var(--border)' : 'none',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
      </motion.div>

      {/* Grid */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <div
            className="flex flex-wrap gap-2"
            style={{ minHeight: 300 }}
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        ) : stocks.length === 0 ? (
          <div
            className="border px-6 py-16 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)', ...MONO }}>
              No sentiment data available for this period.
            </p>
          </div>
        ) : (
          <div
            className="flex flex-wrap gap-2"
            style={{ alignItems: 'flex-start' }}
          >
            {stocks.map((stock) => (
              <HeatmapTile key={stock.ticker} stock={stock} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Legend */}
      {!isLoading && stocks.length > 0 && (
        <motion.div variants={staggerItem} className="flex justify-center">
          <Legend />
        </motion.div>
      )}
    </motion.div>
  );
}
