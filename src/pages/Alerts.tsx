import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { X, Bell, BellOff } from 'lucide-react';
import { getAlerts, createAlert, deleteAlert, type PriceAlert } from '../api/alerts';
import { useAuth } from '../store/useAuth';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function formatPrice(price: number) {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function Alerts() {
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();

  const [ticker,      setTicker]    = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [direction,   setDirection]   = useState<'above' | 'below'>('above');
  const [formError,   setFormError]   = useState('');

  const { data: alerts = [], isLoading } = useQuery<PriceAlert[]>({
    queryKey: ['alerts'],
    queryFn:  getAlerts,
    enabled:  isLoggedIn(),
  });

  const { mutate: addAlert, isPending: adding } = useMutation({
    mutationFn: createAlert,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setTicker('');
      setTargetPrice('');
      setFormError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to create alert';
      setFormError(msg);
    },
  });

  const { mutate: removeAlert } = useMutation({
    mutationFn: deleteAlert,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const t = ticker.trim().toUpperCase();
    const p = parseFloat(targetPrice);
    if (!t)           return setFormError('Ticker is required');
    if (isNaN(p) || p <= 0) return setFormError('Enter a valid price above 0');
    addAlert({ ticker: t, target_price: p, direction });
  }

  const active    = alerts.filter(a => !a.triggered);
  const triggered = alerts.filter(a => a.triggered);

  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-8 py-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Page header */}
      <motion.div variants={staggerItem} className="border-b-2 pb-3" style={{ borderColor: 'var(--text-primary)' }}>
        <div className="flex items-center gap-3">
          <Bell size={16} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)', ...MONO }}>
              Price Alerts
            </h1>
            <p className="text-[9px] mt-0.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Get notified when stocks hit your targets
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Create alert form ───────────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="border p-5 space-y-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <h2 className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
          Set New Alert
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            {/* Ticker */}
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
                Ticker
              </label>
              <input
                type="text"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={10}
                className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)] uppercase"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>

            {/* Target price */}
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
                Target Price
              </label>
              <input
                type="number"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>
          </div>

          {/* Direction toggle */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
              Direction
            </label>
            <div className="flex gap-2">
              {(['above', 'below'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className="flex-1 py-2 text-[11px] font-bold uppercase tracking-widest border transition-colors"
                  style={{
                    borderColor:     direction === d
                      ? (d === 'above' ? 'var(--accent)' : 'var(--red)')
                      : 'var(--border)',
                    backgroundColor: direction === d
                      ? (d === 'above' ? 'var(--accent-dim)' : 'var(--red-dim)')
                      : 'transparent',
                    color:           direction === d
                      ? (d === 'above' ? 'var(--accent)' : 'var(--red)')
                      : 'var(--text-muted)',
                    ...MONO,
                  }}
                >
                  {d === 'above' ? '↑ Above' : '↓ Below'}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--red)', ...MONO }}>
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={adding}
            className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
          >
            {adding ? 'Setting…' : 'Set Alert'}
          </button>
        </form>
      </motion.div>

      {/* ── Alerts list ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <motion.p
          variants={staggerItem}
          className="text-[10px] uppercase tracking-widest text-center py-8"
          style={{ color: 'var(--text-muted)', ...MONO }}
        >
          Loading alerts…
        </motion.p>
      ) : alerts.length === 0 ? (
        <motion.div
          variants={staggerItem}
          className="text-center py-12 space-y-2"
        >
          <BellOff size={28} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            No alerts set. Add one above.
          </p>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="space-y-6">

          {/* Active alerts */}
          {active.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', ...MONO }}>
                Active — {active.length}
              </h3>
              <div className="space-y-px">
                {active.map(alert => (
                  <AlertRow key={alert.id} alert={alert} onDelete={removeAlert} />
                ))}
              </div>
            </div>
          )}

          {/* Divider between sections */}
          {active.length > 0 && triggered.length > 0 && (
            <div className="border-t" style={{ borderColor: 'var(--border)' }} />
          )}

          {/* Triggered alerts */}
          {triggered.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', ...MONO }}>
                Triggered — {triggered.length}
              </h3>
              <div className="space-y-px">
                {triggered.map(alert => (
                  <AlertRow key={alert.id} alert={alert} onDelete={removeAlert} />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

interface AlertRowProps {
  alert:    PriceAlert;
  onDelete: (id: number) => void;
}

function AlertRow({ alert, onDelete }: AlertRowProps) {
  const isAbove     = alert.direction === 'above';
  const isTriggered = alert.triggered;

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 border transition-colors"
      style={{
        borderColor:     'var(--border)',
        backgroundColor: 'var(--bg-surface)',
        opacity:         isTriggered ? 0.55 : 1,
      }}
    >
      {/* Ticker */}
      <span
        className="text-sm font-black w-20 shrink-0"
        style={{ color: 'var(--text-primary)', ...MONO }}
      >
        {alert.ticker}
      </span>

      {/* Direction + price badge */}
      <span
        className="text-[10px] font-bold px-2 py-0.5 shrink-0"
        style={{
          color:           isAbove ? 'var(--accent)' : 'var(--red)',
          backgroundColor: isAbove ? 'var(--accent-dim)' : 'var(--red-dim)',
          textDecoration:  isTriggered ? 'line-through' : 'none',
          ...MONO,
        }}
      >
        {isAbove ? '↑ Above' : '↓ Below'} ${formatPrice(alert.target_price)}
      </span>

      {/* Status badge */}
      <span className="flex-1 text-right">
        {isTriggered ? (
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Triggered ✓
            {alert.triggered_at && (
              <span className="ml-1 font-normal">
                {formatDate(alert.triggered_at)}
              </span>
            )}
          </span>
        ) : (
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
            style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-dim)', ...MONO }}
          >
            Active
          </span>
        )}
      </span>

      {/* Delete button */}
      <button
        onClick={() => onDelete(alert.id)}
        className="shrink-0 p-1 transition-colors hover:text-[var(--red)]"
        style={{ color: 'var(--text-muted)' }}
        title="Delete alert"
        aria-label="Delete alert"
      >
        <X size={14} />
      </button>
    </div>
  );
}
