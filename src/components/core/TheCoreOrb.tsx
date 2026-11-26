import { motion } from 'framer-motion';
import type { CoreOrbState } from '../../store/useAgencyStore';

interface TheCoreOrbProps {
  state: CoreOrbState;
  size?: 'sm' | 'lg';
  scanning?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function TheCoreOrb({
  state,
  size = 'sm',
  scanning = false,
  onClick,
  ariaLabel = 'THE CORE',
}: TheCoreOrbProps) {
  const isLarge = size === 'lg';
  const dim = isLarge ? 128 : 40;

  return (
    <motion.button
      type="button"
      layoutId="the-core-orb"
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.94 }}
      className="relative inline-flex shrink-0 items-center justify-center focus-visible:outline-2"
      style={{
        width: isLarge ? dim : 44,
        height: isLarge ? dim : 44,
      }}
    >
      {/* Syncing orbiting ring */}
      {(state === 'syncing' || state === 'thinking') && (
        <motion.span
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: state === 'thinking' ? 1.4 : 2.8,
            ease: 'linear',
          }}
          className="pointer-events-none absolute inset-0 border border-dashed"
          style={{
            borderRadius: '9999px',
            borderColor: 'var(--accent)',
            opacity: 0.8,
          }}
        />
      )}

      {/* Listening voice-reactive outer pulse */}
      {state === 'listening' && (
        <motion.span
          aria-hidden="true"
          animate={{ scale: [1, 1.32, 1], opacity: [0.6, 0.12, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
          className="pointer-events-none absolute inset-1"
          style={{
            borderRadius: '9999px',
            border: '2px solid var(--accent)',
          }}
        />
      )}

      {/* Core Sphere */}
      <motion.span
        animate={
          state === 'offline'
            ? { scale: 0.92, opacity: 0.48 }
            : state === 'thinking'
            ? { scale: [1, 1.09, 0.97, 1.07, 1], opacity: 1 }
            : { scale: [1, 1.045, 1], opacity: 1 }
        }
        transition={{
          repeat: state === 'offline' ? 0 : Infinity,
          duration: state === 'thinking' ? 1.3 : 3.2,
          ease: 'easeInOut',
        }}
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          width: isLarge ? 104 : 30,
          height: isLarge ? 104 : 30,
          borderRadius: '9999px',
          background:
            state === 'offline'
              ? 'radial-gradient(circle at 35% 30%, #64748b 0%, #1e293b 85%)'
              : 'radial-gradient(circle at 32% 28%, #ffffff 0%, var(--accent) 48%, rgba(4, 12, 24, 0.92) 100%)',
          boxShadow:
            state === 'offline'
              ? 'none'
              : `0 0 ${isLarge ? 42 : 16}px var(--accent-glow)`,
        }}
      >
        {/* Swirling particle inner glint */}
        {(state === 'thinking' || isLarge) && (
          <motion.span
            aria-hidden="true"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
            className="pointer-events-none absolute inset-2 opacity-65"
            style={{
              borderRadius: '9999px',
              borderTop: '2px solid rgba(255,255,255,0.85)',
              borderRight: '2px solid transparent',
            }}
          />
        )}

        {/* Passkey Scan Beam */}
        {scanning && (
          <motion.span
            aria-hidden="true"
            animate={{ y: [-45, 45, -45] }}
            transition={{ repeat: Infinity, duration: 1.25, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-x-0 h-1.5"
            style={{
              background:
                'linear-gradient(90deg, transparent, #ffffff, var(--accent), #ffffff, transparent)',
              boxShadow: '0 0 14px #ffffff',
            }}
          />
        )}
      </motion.span>
    </motion.button>
  );
}
