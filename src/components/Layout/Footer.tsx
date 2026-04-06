import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle } from 'lucide-react';
import { submitFeedback } from '../../api/preferences';
import { useAuth } from '../../store/useAuth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

export function Footer() {
  const { email } = useAuth();

  const [open,      setOpen]      = useState(false);
  const [category,  setCategory]  = useState<'bug' | 'feature' | 'general'>('general');
  const [message,   setMessage]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      await submitFeedback({ category, message: message.trim(), email: email ?? undefined });
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setOpen(false); setMessage(''); }, 2500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer
      className="mt-16 border-t"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="mx-auto max-w-screen-xl px-5 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

        {/* Left — brand + links */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ color: 'var(--text-primary)', ...MONO }}
          >
            SentimentSignal
          </span>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: 'Feed',         to: '/app' },
              { label: 'Discuss',      to: '/app/discuss' },
              { label: 'Watchlist',    to: '/app/watchlists' },
              { label: 'Profile',      to: '/app/profile' },
              { label: 'How It Works', to: '/app/how-it-works' },
            ].map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="text-[9px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                {label}
              </Link>
            ))}
          </div>
          <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            © {new Date().getFullYear()} SentimentSignal
          </span>
        </div>

        {/* Right — inline feedback */}
        <div className="shrink-0">
          {!open ? (
            <motion.button
              onClick={() => setOpen(true)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="text-[9px] font-black uppercase tracking-widest border px-3 py-1.5 rounded transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
            >
              Send Feedback
            </motion.button>
          ) : submitted ? (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--accent)', ...MONO }}>
              <CheckCircle size={14} /> Thank you!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-72">
              {/* Category tabs */}
              <div className="flex gap-1">
                {(['bug', 'feature', 'general'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-colors"
                    style={{
                      ...MONO,
                      backgroundColor: category === c ? 'var(--accent)' : 'var(--bg-elevated)',
                      color:           category === c ? '#000'          : 'var(--text-muted)',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={2}
                placeholder="What's on your mind?"
                className="w-full border rounded bg-transparent px-2 py-1.5 text-xs resize-none outline-none focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />

              <div className="flex gap-2">
                <motion.button
                  type="submit"
                  disabled={loading || !message.trim()}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[9px] font-black uppercase tracking-widest disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: 'var(--accent)', color: '#000', ...MONO }}
                >
                  <Send size={10} /> {loading ? 'Sending…' : 'Send'}
                </motion.button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-colors"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', ...MONO }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </footer>
  );
}
