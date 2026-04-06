import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast, type ToastType } from '../store/useToast';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-3.5 w-3.5 shrink-0" />,
  error:   <AlertCircle className="h-3.5 w-3.5 shrink-0" />,
  info:    <Info        className="h-3.5 w-3.5 shrink-0" />,
};

const STYLES: Record<ToastType, { color: string; bg: string; border: string }> = {
  success: { color: 'var(--accent)',      bg: 'var(--bg-surface)', border: 'var(--accent)' },
  error:   { color: 'var(--red)',         bg: 'var(--bg-surface)', border: 'var(--red)' },
  info:    { color: 'var(--text-primary)', bg: 'var(--bg-surface)', border: 'var(--border-strong)' },
};

export function ToastStack() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="fixed bottom-6 right-4 sm:right-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { color, bg, border } = STYLES[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 56, scale: 0.92 }}
              animate={{ opacity: 1, x: 0,  scale: 1 }}
              exit={{ opacity: 0, x: 56, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="pointer-events-auto flex items-center gap-2.5 border px-3 py-2.5 shadow-lg max-w-[300px] min-w-[200px]"
              style={{ backgroundColor: bg, borderColor: border, color }}
            >
              {ICONS[t.type]}
              <span className="text-[11px] font-bold flex-1 leading-snug" style={MONO}>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-1"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
