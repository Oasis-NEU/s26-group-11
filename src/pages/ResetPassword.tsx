import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { resetPassword } from '../api/auth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      setSuccess(res.message);
      setTimeout(() => navigate('/auth'), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="relative min-h-screen flex flex-col items-center justify-center px-5"
      style={{ backgroundColor: 'var(--bg-page)' }}
    >
      <div className="fixed top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: 'var(--accent)' }} />

      <Link
        to="/auth"
        className="fixed top-5 left-5 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
        style={{ color: 'var(--text-muted)', ...MONO }}
      >
        ← Sign In
      </Link>

      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-xs font-black uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-primary)', ...MONO }}>
            SentimentSignal
          </h1>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Set a new password
          </p>
        </div>

        {!token ? (
          <div className="border p-4 text-center" style={{ borderColor: 'var(--red)' }}>
            <p className="text-[11px]" style={{ color: 'var(--red)', ...MONO }}>
              Invalid or missing reset token. Please request a new reset link.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-block text-[10px] underline"
              style={{ color: 'var(--accent)', ...MONO }}
            >
              Back to Sign In
            </Link>
          </div>
        ) : success ? (
          <div className="border p-4 text-center space-y-3" style={{ borderColor: 'var(--accent)' }}>
            <p className="text-[11px]" style={{ color: 'var(--accent)', ...MONO }}>{success}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>Redirecting to sign in...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
                New Password <span style={{ color: 'var(--text-muted)' }}>(min. 8 chars)</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>

            {error && (
              <p className="text-[11px] py-2 px-3 border" style={{ color: 'var(--red)', borderColor: 'var(--red)', ...MONO }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 8}
              className="w-full py-3 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
            >
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
