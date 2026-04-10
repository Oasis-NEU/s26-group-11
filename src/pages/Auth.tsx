import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { login, forgotPassword, registerRequest } from '../api/auth';
import { useAuth } from '../store/useAuth';
import WelcomeScreen from '../components/WelcomeScreen';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

type Mode = 'login' | 'register' | 'forgot';


export function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devToken, setDevToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeUsername, setWelcomeUsername] = useState('');
  const { setAuth, setProfile } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const res = await forgotPassword(email);
        setSuccess(res.message);
        if (res.dev_token) setDevToken(res.dev_token);
        return;
      }
      if (mode === 'login') {
        const result = await login(email, password);
        setAuth(result.email, result.username);
        setProfile({ first_name: result.first_name, last_name: result.last_name, bio: result.bio, avatar_url: result.avatar_url });
        navigate('/app');
        return;
      }
      if (mode === 'register') {
        const res = await registerRequest(email, password, username || undefined);
        // Backend creates account directly and returns user data
        if ('email' in res) {
          setAuth(res.email, res.username);
          setProfile({ first_name: res.first_name, last_name: res.last_name, bio: res.bio, avatar_url: res.avatar_url });
          // Clear visit flag so the onboarding banner shows after registration
          try { localStorage.removeItem('ss_visited'); } catch { /* ignore */ }
          setWelcomeUsername(username || email.split('@')[0]);
          setShowWelcome(true);
          return;
        }
        return;
      }
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
      className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-5 overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-page)' }}
    >
      {/* Accent stripe */}
      <div className="fixed top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: 'var(--accent)' }} />

      {/* Back to app */}
      <Link
        to="/"
        className="fixed top-5 left-5 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
        style={{ color: 'var(--text-muted)', ...MONO }}
      >
        ← SentimentSignal
      </Link>

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-10 text-center">
          <h1 className="text-xs font-black uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-primary)', ...MONO }}>
            SentimentSignal
          </h1>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            {mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Create your account' : 'Reset your password'}
          </p>
        </div>

        <motion.div
          key="main-form"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
                  Username <span style={{ color: 'var(--text-muted)' }}>(optional, min. 3 chars)</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@handle"
                  autoComplete="username"
                  className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
                />
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)', ...MONO }}>
                  Password {mode === 'register' && <span style={{ color: 'var(--text-muted)' }}>(min. 8 chars)</span>}
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
            )}

            {error && (
              <p className="text-[11px] py-2 px-3 border" style={{ color: 'var(--red)', borderColor: 'var(--red)', ...MONO }}>
                {error}
              </p>
            )}

            {success && (
              <p className="text-[11px] py-2 px-3 border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)', ...MONO }}>
                {success}
              </p>
            )}

            {/* Dev mode: show reset link directly when email isn't configured */}
            {devToken && (
              <div className="border p-3 space-y-1" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
                  Dev mode — email not configured. Use this link:
                </p>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  className="text-[10px] break-all underline"
                  style={{ color: 'var(--accent)', ...MONO }}
                >
                  Reset password →
                </Link>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : 'Send Reset Link'}
            </motion.button>
          </form>

          {/* Forgot password link */}
          {mode === 'login' && (
            <button
              onClick={() => { setMode('forgot'); setError(''); setSuccess(''); setDevToken(''); }}
              className="mt-5 w-full text-center text-[10px] transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', ...MONO }}
            >
              Forgot password?
            </button>
          )}

          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); setDevToken(''); }}
              className="mt-5 w-full text-center text-[10px] transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', ...MONO }}
            >
              ← Back to Sign In
            </button>
          )}

          {mode === 'login' && (
            <button
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className="mt-3 w-full text-center text-[10px] transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', ...MONO }}
            >
              No account? Create one →
            </button>
          )}

          {mode === 'register' && (
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); setUsername(''); }}
              className="mt-3 w-full text-center text-[10px] transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', ...MONO }}
            >
              Already have an account? Sign in →
            </button>
          )}
        </motion.div>
      </div>

      {showWelcome && (
        <WelcomeScreen
          username={welcomeUsername}
          onDone={() => navigate('/app')}
        />
      )}
    </motion.div>
  );
}
