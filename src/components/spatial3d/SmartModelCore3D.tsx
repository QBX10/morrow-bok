import React, { useState } from 'react';
import { motion } from 'motion/react';
import { triggerGlobalSpatialPulse } from '../../utils/spatial3dConfig';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';

export type SmartCoreExecutionState = 'idle' | 'thinking' | 'streaming' | 'complete';

interface SmartModelCore3DProps {
  accentHex: string;
  secondaryHex: string;
  executionState: SmartCoreExecutionState;
  modelTitle: string;
  selectedModelId?: string;
  reduceMotion?: boolean;
  onPulseClick?: () => void;
  className?: string;
}

/**
 * Pure 2D Concentric Geometric Neural Matrix.
 * Synchronizes ring cadence, core scale, and vector reticle highlights with executionState.
 */
export const SmartModelCore3D: React.FC<SmartModelCore3DProps> = ({
  accentHex,
  secondaryHex,
  executionState,
  modelTitle,
  reduceMotion = false,
  onPulseClick,
  className = '',
}) => {
  const hookReducedMotion = useTabrixReducedMotion();
  const isReducedMotion = reduceMotion || hookReducedMotion;
  const [pulseCount, setPulseCount] = useState(0);

  const triggerCorePulse = () => {
    setPulseCount((c) => c + 1);
    triggerGlobalSpatialPulse(1.35);
    onPulseClick?.();
  };

  const ringDur =
    executionState === 'thinking'
      ? 4
      : executionState === 'streaming'
      ? 6
      : executionState === 'complete'
      ? 11
      : 16;

  return (
    <div
      className={`relative rounded-[22px] overflow-hidden border border-white/10 recessed-well ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 45%, ${accentHex}28, rgba(4, 10, 18, 0.94) 72%)`,
      }}
    >
      <div
        data-testid="smart-model-core-3d"
        aria-label={`النواة الهندسية التفاعلية — ${modelTitle}`}
        onClick={triggerCorePulse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerCorePulse();
          }
        }}
        className="w-full h-[215px] sm:h-[245px] relative flex items-center justify-center cursor-pointer select-none"
      >
        {!isReducedMotion && pulseCount > 0 && (
          <motion.span
            key={pulseCount}
            aria-hidden="true"
            className="pointer-events-none absolute w-24 h-24 rounded-full border"
            style={{ borderColor: secondaryHex }}
            initial={{ scale: 0.75, opacity: 0.85 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          />
        )}

        <svg
          viewBox="0 0 240 200"
          className="w-full max-w-[240px] h-[190px]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Outer calibrated orbit */}
          <motion.g
            style={{ transformOrigin: '120px 100px' }}
            animate={isReducedMotion ? undefined : { rotate: 360 }}
            transition={
              isReducedMotion
                ? undefined
                : { duration: ringDur, repeat: Infinity, ease: 'linear' }
            }
          >
            <circle
              cx="120"
              cy="100"
              r="76"
              stroke={accentHex}
              strokeOpacity="0.38"
              strokeWidth="1.2"
              strokeDasharray="10 6"
            />
            <circle cx="196" cy="100" r="3" fill={accentHex} />
            <circle cx="44" cy="100" r="2.5" fill={secondaryHex} />
          </motion.g>

          {/* Counter-rotating precision gauge */}
          <motion.g
            style={{ transformOrigin: '120px 100px' }}
            animate={isReducedMotion ? undefined : { rotate: -360 }}
            transition={
              isReducedMotion
                ? undefined
                : { duration: Math.max(3, Math.round(ringDur * 0.7)), repeat: Infinity, ease: 'linear' }
            }
          >
            <circle
              cx="120"
              cy="100"
              r="56"
              stroke={secondaryHex}
              strokeOpacity="0.52"
              strokeWidth="1.5"
              strokeDasharray="22 8 6 8"
            />
          </motion.g>

          {/* Geometric Octagon Housing */}
          <motion.g
            style={{ transformOrigin: '120px 100px' }}
            animate={
              isReducedMotion
                ? undefined
                : executionState === 'thinking'
                ? { scale: [1, 1.07, 1] }
                : { scale: [1, 1.025, 1] }
            }
            transition={
              isReducedMotion
                ? undefined
                : {
                    duration: executionState === 'thinking' ? 1.1 : 3.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
          >
            <polygon
              points="120,62 147,73 158,100 147,127 120,138 93,127 82,100 93,73"
              fill="rgba(5, 12, 24, 0.9)"
              stroke={accentHex}
              strokeWidth="1.5"
            />
            <polygon
              points="120,76 144,100 120,124 96,100"
              fill={accentHex}
              fillOpacity="0.16"
              stroke={secondaryHex}
              strokeWidth="1.2"
            />
            <circle cx="120" cy="100" r="6" fill={accentHex} />
            <circle cx="120" cy="100" r="11" stroke={secondaryHex} strokeOpacity="0.5" strokeWidth="1" />
          </motion.g>
        </svg>
      </div>

      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-[#050C1A]/85 border border-white/15 text-[11px] font-bold text-[var(--text-primary)]">
        {executionState === 'thinking'
          ? 'جاري التحليل...'
          : executionState === 'complete'
          ? 'اكتمل التحليل'
          : 'تفاعلي · انقر للنبض'}
      </div>

      <motion.button
        type="button"
        whileHover={isReducedMotion ? undefined : { scale: 1.03 }}
        whileTap={isReducedMotion ? undefined : { scale: 0.97 }}
        transition={TABRIX_TACTILE_SPRING}
        onClick={triggerCorePulse}
        className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-[#050C1A]/90 hover:bg-[#0A1830] border border-white/15 text-[10px] font-bold cursor-pointer transition"
        style={{ color: accentHex }}
      >
        نبضة تفاعلية ✨
      </motion.button>
    </div>
  );
};
