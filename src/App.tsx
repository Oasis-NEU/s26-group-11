import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './store/useTheme';
import { usePreferences, applyPreferences } from './store/usePreferences';
import { useAuth } from './store/useAuth';
import { getMe } from './api/auth';
import { landingVariants } from './components/PageTransition';

const Layout        = lazy(() => import('./components/Layout/Layout').then(m => ({ default: m.Layout })));
const Landing       = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Auth          = lazy(() => import('./pages/Auth').then(m => ({ default: m.Auth })));
const Dashboard     = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const StockDetail   = lazy(() => import('./pages/StockDetail').then(m => ({ default: m.StockDetail })));
const Watchlists    = lazy(() => import('./pages/Watchlists').then(m => ({ default: m.Watchlists })));
const Profile       = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const UserProfile   = lazy(() => import('./pages/UserProfile').then(m => ({ default: m.UserProfile })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Discuss       = lazy(() => import('./pages/Discuss').then(m => ({ default: m.Discuss })));
const ThreadDetail  = lazy(() => import('./pages/ThreadDetail').then(m => ({ default: m.ThreadDetail })));
const Feedback      = lazy(() => import('./pages/Feedback').then(m => ({ default: m.Feedback })));
const HowItWorks    = lazy(() => import('./pages/HowItWorks').then(m => ({ default: m.HowItWorks })));
const Compare       = lazy(() => import('./pages/Compare').then(m => ({ default: m.Compare })));
const Portfolio     = lazy(() => import('./pages/Portfolio').then(m => ({ default: m.Portfolio })));
const Alerts        = lazy(() => import('./pages/Alerts').then(m => ({ default: m.Alerts })));
const Screener      = lazy(() => import('./pages/Screener').then(m => ({ default: m.Screener })));
const Heatmap       = lazy(() => import('./pages/Heatmap').then(m => ({ default: m.Heatmap })));
const ActivityFeed  = lazy(() => import('./pages/ActivityFeed').then(m => ({ default: m.ActivityFeed })));

// Validates the JWT cookie on every page load/refresh. If the server says
// the session is gone, clear local auth state immediately so the user doesn't
// bounce around in a broken half-logged-in state.
function AuthInit() {
  const { isLoggedIn, setProfile, logout } = useAuth();
  useEffect(() => {
    if (!isLoggedIn()) return;
    getMe()
      .then(user => {
        setProfile({
          username:   user.username,
          first_name: user.first_name,
          last_name:  user.last_name,
          bio:        user.bio,
          avatar_url: user.avatar_url,
          is_admin:   user.is_admin,
        });
      })
      .catch(() => {
        // Cookie expired or revoked — clear local state silently.
        // The 401 interceptor in client.ts will handle the redirect if needed.
        logout();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ThemeSync() {
  const theme = useTheme(s => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

function PreferencesSync() {
  const prefs = usePreferences();
  useEffect(() => { prefs.load(); }, []); // eslint-disable-line
  useEffect(() => { applyPreferences(prefs); }, [prefs.accent_color, prefs.density]); // eslint-disable-line
  return null;
}

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-page)' }}>
    <motion.span
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className="text-[10px] uppercase tracking-widest"
      style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}
    >
      Loading...
    </motion.span>
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();

  // Only the outer shell (landing/auth) gets a unique key so the app
  // layout (Navbar, Footer) stays mounted during sub-route changes.
  const isOuterPage = ['/', '/auth', '/reset-password'].includes(location.pathname);
  const groupKey    = isOuterPage ? location.pathname : 'app-shell';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={groupKey}>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={
          <motion.div variants={landingVariants} initial="initial" animate="animate" exit="exit">
            <Auth />
          </motion.div>
        } />
        <Route path="/reset-password" element={
          <motion.div variants={landingVariants} initial="initial" animate="animate" exit="exit">
            <ResetPassword />
          </motion.div>
        } />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="stock/:symbol" element={<StockDetail />} />
          <Route path="watchlists" element={<Watchlists />} />
          <Route path="profile" element={<Profile />} />
          <Route path="discuss" element={<Discuss />} />
          <Route path="discuss/:id" element={<ThreadDetail />} />
          <Route path="users/:username" element={<UserProfile />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="compare" element={<Compare />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="screener" element={<Screener />} />
          <Route path="heatmap" element={<Heatmap />} />
          <Route path="activity" element={<ActivityFeed />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <>
      <AuthInit />
      <ThemeSync />
      <PreferencesSync />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <AnimatedRoutes />
        </Suspense>
      </BrowserRouter>
    </>
  );
}

export default App;
