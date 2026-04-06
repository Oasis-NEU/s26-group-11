import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Trash2, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getPortfolio, addPosition, removePosition,
  type PortfolioItem,
} from '../api/portfolio';
import { getStockDetail } from '../api/stocks';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: number) {
  return '$' + fmt(n, 2);
}

function PnlBadge({ value, pct }: { value: number; pct: number }) {
  const color =
    value > 0 ? 'var(--accent)' : value < 0 ? 'var(--red)' : 'var(--text-muted)';
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span style={{ color, ...MONO }} className="inline-flex items-center gap-1 text-xs">
      <Icon size={11} />
      {value >= 0 ? '+' : ''}
      {fmtCurrency(value)} ({pct >= 0 ? '+' : ''}
      {fmt(pct, 2)}%)
    </span>
  );
}

export function Portfolio() {
  const qc = useQueryClient();
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [formError, setFormError] = useState('');

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: getPortfolio,
  });

  // Fetch current prices for all portfolio tickers in parallel
  const priceQueries = useQueries({
    queries: (portfolio ?? []).map((item) => ({
      queryKey: ['stock', item.ticker],
      queryFn: () => getStockDetail(item.ticker),
      staleTime: 60_000,
    })),
  });

  // Build a ticker → query result map so lookups are always correct regardless of order
  const priceByTicker = useMemo(() => {
    const map: Record<string, typeof priceQueries[0]> = {};
    (portfolio ?? []).forEach((item, i) => {
      map[item.ticker] = priceQueries[i];
    });
    return map;
  }, [portfolio, priceQueries]);

  type EnrichedPosition = Omit<PortfolioItem, 'current_price' | 'market_value' | 'gain_loss' | 'gain_loss_pct'> & {
    current_price: number | null;
    market_value: number | null;
    gain_loss: number | null;
    gain_loss_pct: number | null;
  };

  // Build enriched positions with computed fields
  const positions: EnrichedPosition[] = (portfolio ?? []).map((item): EnrichedPosition => {
    const priceData = priceByTicker[item.ticker]?.data;
    const current_price = priceData?.price ?? null;
    const market_value = current_price !== null ? item.shares * current_price : null;
    const cost_basis = item.shares * item.avg_cost;
    const gain_loss = market_value !== null ? market_value - cost_basis : null;
    const gain_loss_pct =
      item.avg_cost > 0 && current_price !== null
        ? ((current_price - item.avg_cost) / item.avg_cost) * 100
        : null;
    return { ...item, current_price, market_value, gain_loss, gain_loss_pct };
  });

  // Portfolio totals
  const allPricesLoaded = (portfolio ?? []).every(p => !priceByTicker[p.ticker]?.isLoading);
  const anyPriceLoading = (portfolio ?? []).some(p => priceByTicker[p.ticker]?.isLoading);

  const totalCostBasis = positions.reduce((sum, p) => sum + p.shares * p.avg_cost, 0);
  // Only compute market-value totals when every price has arrived
  const totalValue = allPricesLoaded
    ? positions.reduce((sum, p) => sum + (p.market_value ?? p.shares * p.avg_cost), 0)
    : null;
  const totalGainLoss = totalValue !== null ? totalValue - totalCostBasis : null;
  const totalGainLossPct =
    totalGainLoss !== null && totalCostBasis > 0
      ? (totalGainLoss / totalCostBasis) * 100
      : null;

  const addMutation = useMutation({
    mutationFn: addPosition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setTicker('');
      setShares('');
      setAvgCost('');
      setFormError('');
    },
    onError: () => {
      setFormError('Failed to add position. Check the ticker and try again.');
    },
  });

  const removeMutation = useMutation({
    mutationFn: removePosition,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const t = ticker.trim().toUpperCase();
    const s = parseFloat(shares);
    const c = parseFloat(avgCost);
    if (!t) return setFormError('Ticker is required.');
    if (isNaN(s) || s <= 0) return setFormError('Shares must be a positive number.');
    if (isNaN(c) || c <= 0) return setFormError('Avg cost must be a positive number.');
    addMutation.mutate({ ticker: t, shares: s, avg_cost: c });
  }

  const pnlColor =
    totalGainLoss !== null && totalGainLoss > 0
      ? 'var(--accent)'
      : totalGainLoss !== null && totalGainLoss < 0
      ? 'var(--red)'
      : 'var(--text-muted)';

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-screen-xl px-5 py-8 space-y-8"
    >
      {/* ── Header ── */}
      <motion.div variants={staggerItem} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-black uppercase tracking-widest"
              style={{ color: 'var(--text-primary)', ...MONO }}
            >
              Portfolio
            </h1>
            <p className="text-xs mt-1 uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Track your positions
            </p>
          </div>

          {positions.length > 0 && (
            <div
              className="flex flex-col sm:items-end gap-1 border px-4 py-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
            >
              <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
                Total Value
              </span>
              {anyPriceLoading ? (
                <span
                  className="text-2xl font-black inline-flex items-center gap-2"
                  style={{ color: 'var(--text-muted)', ...MONO }}
                >
                  <span
                    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-label="Loading prices"
                  />
                  Loading prices…
                </span>
              ) : (
                <span
                  className="text-2xl font-black"
                  style={{ color: 'var(--text-primary)', ...MONO }}
                >
                  {totalValue !== null ? fmtCurrency(totalValue) : '—'}
                </span>
              )}
              {totalGainLoss !== null && totalGainLossPct !== null ? (
                <span
                  className="text-xs font-bold inline-flex items-center gap-1"
                  style={{ color: pnlColor, ...MONO }}
                >
                  {totalGainLoss >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {totalGainLoss >= 0 ? '+' : ''}
                  {fmtCurrency(totalGainLoss)} ({totalGainLossPct >= 0 ? '+' : ''}
                  {fmt(totalGainLossPct, 2)}%)
                </span>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-muted)', ...MONO }}>
                  Cost basis: {fmtCurrency(totalCostBasis)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
      </motion.div>

      {/* ── Add Position Form ── */}
      <motion.div variants={staggerItem}>
        <div
          className="border p-5 space-y-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <h2
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', ...MONO }}
          >
            Add Position
          </h2>
          <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label
                className="text-[9px] uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                Ticker
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={10}
                className="w-28 border px-2 py-1.5 text-xs bg-transparent focus:outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="text-[9px] uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                Shares
              </label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="10"
                min="0"
                step="any"
                className="w-24 border px-2 py-1.5 text-xs bg-transparent focus:outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="text-[9px] uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                Avg Cost / Share
              </label>
              <input
                type="number"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder="150.00"
                min="0"
                step="any"
                className="w-28 border px-2 py-1.5 text-xs bg-transparent focus:outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex items-center gap-1.5 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', ...MONO }}
            >
              <Plus size={12} />
              {addMutation.isPending ? 'Adding...' : 'Add Position'}
            </button>
          </form>
          {formError && (
            <p className="text-xs" style={{ color: 'var(--red)', ...MONO }}>
              {formError}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Positions Table ── */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 border animate-pulse"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
              />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div
            className="border px-6 py-12 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)', ...MONO }}>
              No positions yet. Add your first position above.
            </p>
          </div>
        ) : (
          <div
            className="border overflow-x-auto"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Table header */}
            <div
              className="grid items-center border-b px-4 py-2"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface)',
                gridTemplateColumns: '1fr 80px 90px 90px 100px 130px 30px',
              }}
            >
              {['Ticker', 'Shares', 'Avg Cost', 'Price', 'Mkt Value', 'P&L', ''].map(
                (h) => (
                  <span
                    key={h}
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)', ...MONO }}
                  >
                    {h}
                  </span>
                ),
              )}
            </div>

            {/* Rows */}
            <AnimatePresence initial={false}>
              {positions.map((pos) => {
                const priceLoading = priceByTicker[pos.ticker]?.isLoading;

                return (
                  <motion.div
                    key={pos.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid items-center border-b px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
                    style={{
                      borderColor: 'var(--border)',
                      gridTemplateColumns: '1fr 80px 90px 90px 100px 130px 30px',
                    }}
                  >
                    {/* Ticker */}
                    <Link
                      to={`/app/stock/${pos.ticker}`}
                      className="font-black text-sm transition-colors hover:text-[var(--accent)]"
                      style={{ color: 'var(--text-primary)', ...MONO }}
                    >
                      {pos.ticker}
                    </Link>

                    {/* Shares */}
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', ...MONO }}>
                      {fmt(pos.shares, pos.shares % 1 === 0 ? 0 : 4)}
                    </span>

                    {/* Avg cost */}
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', ...MONO }}>
                      {fmtCurrency(pos.avg_cost)}
                    </span>

                    {/* Current price */}
                    <span className="text-xs" style={{ color: 'var(--text-primary)', ...MONO }}>
                      {priceLoading
                        ? <span style={{ color: 'var(--text-muted)' }}>…</span>
                        : pos.current_price !== null
                        ? fmtCurrency(pos.current_price)
                        : '—'}
                    </span>

                    {/* Market value */}
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)', ...MONO }}>
                      {priceLoading
                        ? <span style={{ color: 'var(--text-muted)' }}>…</span>
                        : pos.market_value !== null
                        ? fmtCurrency(pos.market_value)
                        : '—'}
                    </span>

                    {/* P&L */}
                    <span>
                      {priceLoading ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)', ...MONO }}>…</span>
                      ) : pos.gain_loss !== null && pos.gain_loss_pct !== null ? (
                        <PnlBadge value={pos.gain_loss} pct={pos.gain_loss_pct} />
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)', ...MONO }}>
                          —
                        </span>
                      )}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => removeMutation.mutate(pos.id)}
                      disabled={removeMutation.isPending}
                      className="flex items-center justify-center p-1 transition-colors hover:text-[var(--red)] disabled:opacity-30"
                      style={{ color: 'var(--text-muted)' }}
                      title="Remove position"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
