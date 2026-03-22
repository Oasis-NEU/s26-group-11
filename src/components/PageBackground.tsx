import { motion } from 'framer-motion';

export function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: `
            linear-gradient(var(--graphic-stroke) 1px, transparent 1px),
            linear-gradient(90deg, var(--graphic-stroke) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-32 top-0 h-64 w-64 rounded-full blur-[80px]"
        style={{ backgroundColor: 'var(--graphic-fill)' }}
      />
      <motion.div
        animate={{ x: [0, -15, 0], y: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-24 bottom-1/4 h-48 w-48 rounded-full blur-[60px]"
        style={{ backgroundColor: 'var(--graphic-fill)' }}
      />
      <svg className="absolute right-0 top-0 h-48 w-48 opacity-[0.3]" viewBox="0 0 100 100">
        <motion.path
          d="M 100 0 L 100 80 M 100 0 L 20 0"
          fill="none"
          stroke="var(--graphic-stroke)"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <svg className="absolute bottom-0 left-0 h-32 w-32 opacity-[0.2]" viewBox="0 0 100 100">
        <motion.path
          d="M 0 100 L 0 30 M 0 100 L 70 100"
          fill="none"
          stroke="var(--graphic-stroke)"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.2, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
}
