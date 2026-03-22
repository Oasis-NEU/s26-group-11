import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        navigate('/app');
      }
    };
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        navigate('/app');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-page)' }}>
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Animated grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: `
            linear-gradient(var(--graphic-stroke) 1px, transparent 1px),
            linear-gradient(90deg, var(--graphic-stroke) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Ambient gradient orbs */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/[0.06] blur-[120px]"
      />
      <motion.div
        animate={{ x: [0, -40, 0], y: [0, 25, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/5 right-1/5 h-[400px] w-[400px] rounded-full blur-[100px]"
        style={{ backgroundColor: 'var(--graphic-fill)' }}
      />

      {/* Pulsing radar ring */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-30"
        style={{ borderColor: 'var(--graphic-stroke)' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-40"
        style={{ borderColor: 'var(--graphic-stroke)' }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
      />

      {/* Animated signal bars */}
      <div className="absolute inset-0 flex items-end justify-center gap-1 pb-32 opacity-30">
        {[0.3, 0.6, 0.9, 0.7, 0.5, 0.8, 0.4, 0.9, 0.6].map((height, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full opacity-40"
            style={{ backgroundColor: 'var(--text-primary)' }}
            animate={{ height: [`${height * 20}px`, `${height * 40}px`, `${height * 20}px`] }}
            transition={{ duration: 1.5 + i * 0.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
          />
        ))}
      </div>

      {/* SVG signal waves */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.15]">
        <svg className="h-full w-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
          <motion.path d="M 0 200 Q 100 150, 200 200 T 400 200 T 600 200 T 800 200" fill="none" stroke="var(--graphic-stroke)" strokeWidth="2" strokeDasharray="20 10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: 'easeInOut' }} />
          <motion.path d="M 0 250 Q 80 200, 160 250 T 320 250 T 480 250 T 640 250 T 800 250" fill="none" stroke="var(--graphic-stroke)" strokeWidth="1.5" strokeDasharray="15 8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, delay: 0.3, ease: 'easeInOut' }} />
          <motion.path d="M 0 150 Q 120 220, 240 150 T 480 150 T 720 150 T 800 150" fill="none" stroke="var(--graphic-stroke)" strokeWidth="1" strokeDasharray="10 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, delay: 0.6, ease: 'easeInOut' }} />
        </svg>
      </div>

      {/* Floating drift particles */}
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full opacity-30"
          style={{ backgroundColor: 'var(--text-primary)', left: `${15 + (i * 2.5) % 70}%`, top: `${10 + (i * 3) % 80}%` }}
          animate={{ opacity: [0.1, 0.5, 0.1], y: [0, -30, 0], x: [0, 10, 0] }}
          transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: (i * 0.2) % 3, ease: 'easeInOut' }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-5 text-xs font-medium uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>
            Stock Sentiment Intelligence
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl" style={{ color: 'var(--text-primary)' }}>
            SentimentSignal
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mx-auto mt-8 max-w-md text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
            REAL-TIME QUALITY ANALYSIS FROM THE WORLD
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-14">
            <Link to="/app">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="group relative overflow-hidden rounded-full border px-10 py-4 text-sm font-medium backdrop-blur-md transition-all duration-300"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--accent-subtle)', color: 'var(--text-primary)' }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Enter
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2} />
                </span>
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Press Enter or scroll to explore
        </motion.p>
      </div>

      {/* Subtle noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
