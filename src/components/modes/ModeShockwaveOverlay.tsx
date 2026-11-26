import { AnimatePresence, motion } from 'framer-motion';
import { useAgencyStore } from '../../store/useAgencyStore';

export function ModeShockwaveOverlay() {
  const shockwave = useAgencyStore((s) => s.modeShockwave);

  return (
    <AnimatePresence>
      {shockwave && (
        <motion.div
          key={shockwave.id}
          aria-hidden="true"
          initial={{
            opacity: 0.45,
            scale: 0.02,
          }}
          animate={{
            opacity: 0,
            scale: 2.8,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed z-50"
          style={{
            left: shockwave.x - 240,
            top: shockwave.y - 240,
            width: 480,
            height: 480,
            borderRadius: '9999px',
            background: `radial-gradient(circle, ${shockwave.color} 0%, transparent 68%)`,
          }}
        />
      )}
    </AnimatePresence>
  );
}
