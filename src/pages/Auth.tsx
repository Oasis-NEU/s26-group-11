import { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { login, register, forgotPassword, registerRequest, registerVerify } from '../api/auth';
import { useAuth } from '../store/useAuth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

type Mode = 'login' | 'register' | 'forgot' | 'verify';

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const next = [...digits];
    next[i] = char;
    onChange(next.join(''));
    if (i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        onChange(next.join('').replace(/\s/g, ''));
      } else if (i > 0) {
        const next = [...digits];
        next[i - 1] = '';
        onChange(next.join('').replace(/\s/g, ''));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, '').slice(0, 6).replace(/\s/g, ''));
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2 justify-between" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i]}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onClick={() => refs.current[i]?.select()}
          className="w-9 h-11 sm:w-10 sm:h-12 text-center text-lg sm:text-xl font-black border bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
          style={{
            borderColor: digits[i] ? 'var(--accent)' : 'var(--border)',
            color: 'var(--text-primary)',
            fontFamily: '"IBM Plex Mono", monospace',
          }}
        />
      ))}
    </div>
  );
}

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
  const [pendingToken, setPendingToken] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otpValue, setOtpValue] = useState('');
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
        setPendingToken(res.token);
        if (res.dev_otp) setDevOtp(res.dev_otp);
        setMode('verify');
        return;
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otpValue.length < 6) { setError('Please enter all 6 digits.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await registerVerify(pendingToken, otpValue);
      setAuth(result.email, result.username);
      setProfile({ first_name: result.first_name, last_name: result.last_name, bio: result.bio, avatar_url: result.avatar_url });
      navigate('/app');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Keep register import used (suppress unused warning)
  void register;

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
            {mode === 'verify' ? 'Verify your email' : mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Create your account' : 'Reset your password'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode !== 'verify' && (
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
          )}

          {mode === 'verify' && (
            <motion.div
              key="verify-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={handleVerify} className="space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)', ...MONO }}>
                    Check your inbox
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                    We sent a 6-digit code to <span style={{ color: 'var(--text-primary)' }}>{email}</span>
                  </p>
                </div>

                {devOtp && (
                  <div className="border px-3 py-2 text-center" style={{ borderColor: 'var(--accent)44', backgroundColor: 'var(--accent)11' }}>
                    <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', ...MONO }}>
                      Dev mode — email not configured
                    </p>
                    <p className="text-lg font-black tracking-[0.3em]" style={{ color: 'var(--accent)', ...MONO }}>{devOtp}</p>
                  </div>
                )}

                <OtpInput value={otpValue} onChange={setOtpValue} />

                {error && (
                  <p className="text-[11px] py-2 px-3 border" style={{ color: 'var(--red)', borderColor: 'var(--red)', ...MONO }}>
                    {error}
                  </p>
                )}

                <motion.button
                  type="submit"
                  disabled={loading || otpValue.length < 6}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
                >
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </motion.button>

                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setOtpValue(''); setPendingToken(''); setDevOtp(''); }}
                  className="w-full text-center text-[10px] transition-colors hover:text-[var(--accent)]"
                  style={{ color: 'var(--text-muted)', ...MONO }}
                >
                  ← Back / resend
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
