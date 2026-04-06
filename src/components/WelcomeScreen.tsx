import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WelcomeScreenProps {
  username?: string;
  onDone: () => void;
}

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

export default function WelcomeScreen({ username, onDone }: WelcomeScreenProps) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  // phase 0 = mounting / logo fade in
  // phase 1 = welcome message slides up
  // phase 2 = subtitle fades in
  // phase 3 = progress bar fills
  // phase 4 = whole overlay fades out → onDone

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);   // welcome message after logo appears
    const t2 = setTimeout(() => setPhase(2), 900);   // subtitle
    const t3 = setTimeout(() => setPhase(3), 1300);  // progress bar
    const t4 = setTimeout(() => setPhase(4), 2200);  // start fade-out
    const t5 = setTimeout(() => onDone(), 2550);     // call onDone after fade-out completes

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onDone]);

  const displayName = username
    ? username.toUpperCase()
    : null;

  return (
    <AnimatePresence>
      {phase < 4 && (
        <motion.div
          key="welcome-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#0a0a0a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0',
          }}
        >
          {/* Top accent stripe */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              backgroundColor: '#22c55e',
            }}
          />

          {/* Logo mark triangle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginBottom: '28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {/* Triangle mark */}
            <svg
              width="32"
              height="28"
              viewBox="0 0 32 28"
              fill="none"
              style={{ display: 'block' }}
            >
              <polygon
                points="16,2 30,26 2,26"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>

            {/* Brand name */}
            <div
              style={{
                ...MONO,
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#22c55e',
              }}
            >
              SentimentSignal
            </div>
          </motion.div>

          {/* Welcome message */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                key="welcome-msg"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  ...MONO,
                  fontSize: 'clamp(18px, 4vw, 28px)',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#f0f0f0',
                  marginBottom: '14px',
                  textAlign: 'center',
                  paddingInline: '1rem',
                }}
              >
                {displayName
                  ? `WELCOME, ${displayName}`
                  : 'WELCOME TO SENTIMENTSIGNAL'}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtitle */}
          <AnimatePresence>
            {phase >= 2 && (
              <motion.div
                key="subtitle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                style={{
                  ...MONO,
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(34, 197, 94, 0.7)',
                  marginBottom: '40px',
                }}
              >
                YOUR FEED IS READY.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          <AnimatePresence>
            {phase >= 3 && (
              <motion.div
                key="progress-track"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  width: '160px',
                  height: '1px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '0%' }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#22c55e',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom accent stripe */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '1px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
