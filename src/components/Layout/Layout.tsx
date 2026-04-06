import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { PageBackground } from '../PageBackground';
import { ToastStack } from '../ToastStack';

export function Layout() {
  const location = useLocation();

  return (
    <motion.div
      className="relative min-h-screen flex flex-col overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-page)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      <PageBackground />
      <Navbar />
      {/*
        No inner AnimatePresence — nested mode="wait" reliably hangs
        enter animations on certain Framer Motion versions, causing blank pages.
        Sub-route content renders instantly; the landing→app shell transition
        provides all the smoothness the user needs.
      */}
      <main key={location.pathname} className="mx-auto w-full max-w-screen-xl px-3 sm:px-5 py-6 sm:py-8 flex-1">
        <Outlet />
      </main>
      <Footer />
      <ToastStack />
    </motion.div>
  );
}
