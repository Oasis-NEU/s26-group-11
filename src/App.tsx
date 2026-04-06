import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './store/useTheme';
import { usePreferences, applyPreferences } from './store/usePreferences';
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <>
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
