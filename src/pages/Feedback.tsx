import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Star, CheckCircle } from 'lucide-react';
import { submitFeedback, type FeedbackPayload } from '../api/preferences';
import { useAuth } from '../store/useAuth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const CATEGORIES: { value: FeedbackPayload['category']; label: string; desc: string }[] = [
  { value: 'bug',     label: 'Bug Report',      desc: 'Something is broken or not working as expected' },
  { value: 'feature', label: 'Feature Request',  desc: 'An idea for something new or an improvement' },
  { value: 'general', label: 'General Feedback', desc: 'Anything else — thoughts, praise, complaints' },
];

export function Feedback() {
  const { isLoggedIn, email } = useAuth();

  const [category, setCategory] = useState<FeedbackPayload['category']>('general');
  const [message,  setMessage]  = useState('');
  const [userEmail, setUserEmail] = useState(email ?? '');
  const [rating,   setRating]   = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) { setError('Please write a message.'); return; }
    setLoading(true); setError('');
    try {
      await submitFeedback({
        category,
        message: message.trim(),
        email:   userEmail || undefined,
        rating:  rating || undefined,
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      {/* Back */}
      <Link
        to="/app"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest mb-8 transition-colors hover:text-[var(--accent)]"
        style={{ color: 'var(--text-muted)', ...MONO }}
      >
        <ArrowLeft size={13} /> Feed
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-black uppercase tracking-tight mb-1"
          style={{ color: 'var(--text-primary)', fontFamily: '"Syne", system-ui' }}
        >
          Feedback
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Help us improve SentimentSignal. Every message is read.
        </p>
      </div>

      {submitted ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <CheckCircle size={48} style={{ color: 'var(--accent)' }} />
          <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: '"Syne"' }}>
            Thank you
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Your feedback has been submitted. We appreciate it.
          </p>
          <Link
            to="/app"
            className="mt-4 text-[11px] font-bold uppercase tracking-widest border px-4 py-2 rounded transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
          >
            Back to Feed
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Category */}
          <div>
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className="flex flex-col items-start gap-1 p-3 rounded border text-left transition-colors"
                  style={{
                    borderColor:     category === c.value ? 'var(--accent)' : 'var(--border)',
                    backgroundColor: category === c.value ? 'var(--accent-dim)' : 'var(--bg-surface)',
                    color:           category === c.value ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest" style={MONO}>{c.label}</span>
                  <span className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>{c.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Star rating */}
          <div>
            <Label>Overall Rating (optional)</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(rating === n ? 0 : n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={24}
                    fill={(hoverRating || rating) >= n ? 'var(--accent)' : 'transparent'}
                    stroke={(hoverRating || rating) >= n ? 'var(--accent)' : 'var(--border-strong)'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <Label>Message <span style={{ color: 'var(--red)' }}>*</span></Label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Tell us what's on your mind..."
              className="w-full mt-2 rounded border bg-transparent px-3 py-2 text-sm resize-none outline-none transition-colors focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Email (pre-fill if logged in) */}
          <div>
            <Label>Email (optional — for follow-up)</Label>
            <input
              type="email"
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full mt-2 rounded border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--red)', ...MONO }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: '#000', ...MONO }}
          >
            {loading ? 'Submitting…' : <><Send size={13} /> Submit Feedback</>}
          </button>
        </form>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: '"IBM Plex Mono"', color: 'var(--text-muted)' }}>
      {children}
    </p>
  );
}
