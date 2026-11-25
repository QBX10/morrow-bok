import React, { useState } from 'react';
import { motion } from 'motion/react';
import { triggerGlobalMotionPulse } from '../../utils/surface2dConfig';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';

export type SmartCoreExecutionState = 'idle' | 'thinking' | 'streaming' | 'complete';

interface ModelPulseCore2DProps {
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
 * Pure 2D Concentric Analytical Matrix for Smart Models Workspace.
 * Synchronizes radar rotation cadence and highlight intensity with executionState.
 */
export const ModelPulseCore2D: React.FC<ModelPulseCore2DProps> = ({
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
    triggerGlobalMotionPulse(1.2);
    onPulseClick?.();
  };

  const ringDur =
    executionState === 'thinking'
      ? 5
      : executionState === 'streaming'
      ? 8
      : executionState === 'complete'
      ? 14
      : 20;

  return (
    <div
      className={`relative rounded-[20px] overflow-hidden border border-[var(--border-color)] recessed-well ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 45%, ${accentHex}1F, var(--bg-main) 74%)`,
      }}
    >
      <div
        data-testid="model-pulse-core-2d"
        aria-label={`مصفوفة التحليل التفاعلية — ${modelTitle}`}
        onClick={triggerCorePulse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerCorePulse();
          }
        }}
        className="w-full h-[210px] sm:h-[235px] relative flex items-center justify-center cursor-pointer select-none"
      >
        {!isReducedMotion && pulseCount > 0 && (
          <motion.span
            key={pulseCount}
            aria-hidden="true"
            className="pointer-events-none absolute w-24 h-24 rounded-full border"
            style={{ borderColor: secondaryHex }}
            initial={{ scale: 0.78, opacity: 0.75 }}
            animate={{ scale: 2.25, opacity: 0 }}
            transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
          />
        )}

        <svg
          viewBox="0 0 240 200"
          className="w-full max-w-[240px] h-[185px]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Outer orbit */}
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
              r="74"
              stroke={accentHex}
              strokeOpacity="0.34"
              strokeWidth="1.1"
              strokeDasharray="10 6"
            />
            <circle cx="194" cy="100" r="2.7" fill={accentHex} />
            <circle cx="46" cy="100" r="2.2" fill={secondaryHex} />
          </motion.g>

          {/* Counter-rotating ring */}
          <motion.g
            style={{ transformOrigin: '120px 100px' }}
            animate={isReducedMotion ? undefined : { rotate: -360 }}
            transition={
              isReducedMotion
                ? undefined
                : { duration: Math.max(4, Math.round(ringDur * 0.7)), repeat: Infinity, ease: 'linear' }
            }
          >
            <circle
              cx="120"
              cy="100"
              r="55"
              stroke={secondaryHex}
              strokeOpacity="0.44"
              strokeWidth="1.3"
              strokeDasharray="22 8 6 8"
            />
          </motion.g>

          {/* Calm Octagon Core */}
          <motion.g
            style={{ transformOrigin: '120px 100px' }}
            animate={
              isReducedMotion
                ? undefined
                : executionState === 'thinking'
                ? { scale: [1, 1.055, 1] }
                : { scale: [1, 1.02, 1] }
            }
            transition={
              isReducedMotion
                ? undefined
                : {
                    duration: executionState === 'thinking' ? 1.2 : 3.6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
          >
            <polygon
              points="120,62 147,73 158,100 147,127 120,138 93,127 82,100 93,73"
              fill="var(--bg-surface)"
              stroke={accentHex}
              strokeWidth="1.4"
            />
            <polygon
              points="120,76 144,100 120,124 96,100"
              fill={accentHex}
              fillOpacity="0.14"
              stroke={secondaryHex}
              strokeWidth="1.1"
            />
            <circle cx="120" cy="100" r="5.5" fill={accentHex} />
            <circle cx="120" cy="100" r="10.5" stroke={secondaryHex} strokeOpacity="0.45" strokeWidth="1" />
          </motion.g>
        </svg>
      </div>

      <div
        className="absolute top-3 right-3 px-2.5 py-1 rounded-lg border text-[11px] font-bold text-[var(--text-primary)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        {executionState === 'thinking'
          ? 'جاري التحليل...'
          : executionState === 'complete'
          ? 'اكتمل التحليل'
          : 'تفاعلي · انقر للنبض'}
      </div>

      <motion.button
        type="button"
        whileHover={isReducedMotion ? undefined : { scale: 1.02 }}
        whileTap={isReducedMotion ? undefined : { scale: 0.97 }}
        transition={TABRIX_TACTILE_SPRING}
        onClick={triggerCorePulse}
        className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: accentHex,
        }}
      >
        نبضة تفاعلية ✨
      </motion.button>
    </div>
  );
};
