/**
 * Shared page-transition primitives.
 * Uses only opacity + y — no CSS filter which can hang AnimatePresence.
 */
import { motion, type Variants } from 'framer-motion';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN  = [0.55, 0, 1, 0.45] as const;

// ── App-internal pages ───────────────────────────────────────────────────────
export const appPageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    // No y-shift on exit — avoids layout reflow during mode="wait" sequential swap
    transition: { duration: 0.1, ease: EASE_IN },
  },
};

// ── Landing / Auth ───────────────────────────────────────────────────────────
export const landingVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.35, ease: EASE_IN },
  },
};

// ── Convenience wrapper ───────────────────────────────────────────────────────
export function PageTransition({
  children,
  variant = 'app',
  className,
}: {
  children: React.ReactNode;
  variant?: 'app' | 'landing';
  className?: string;
}) {
  return (
    <motion.div
      variants={variant === 'landing' ? landingVariants : appPageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}
