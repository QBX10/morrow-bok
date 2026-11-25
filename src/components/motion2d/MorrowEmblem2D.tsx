import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Surface2DPrefs, Surface2DThemeId } from '../../types/agency';
import {
  type MorrowCompanionMood,
  resolveActiveSurfacePalette,
  resolveMorrowCompanionState,
  triggerGlobalMotionPulse,
} from '../../utils/surface2dConfig';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';

export type EmblemMood = MorrowCompanionMood;

interface MorrowEmblem2DProps {
  themeId?: Surface2DThemeId;
  surfacePrefs?: Surface2DPrefs;
  activeSlideIndex?: number;
  reduceMotion?: boolean;
  onGreetClick?: () => void;
  className?: string;
  compact?: boolean;
}

const GREETING_LINES = [
  'أهلاً بك في Morrow — واجهة هادئة ومنظمة لإدارة الوكالات والحسابات بدقة.',
  'متابعة الأرصدة، الأعضاء، والاستخراج الذكي في مساحة واحدة متكاملة.',
  'سجّل دخولك بالطريقة التي تفضلها: Google، اسم المستخدم، الهاتف، أو البريد.',
];

const MOOD_LABELS: Array<{ id: EmblemMood; label: string }> = [
  { id: 'greet', label: 'ترحيب' },
  { id: 'excited', label: 'نشط' },
  { id: 'focus', label: 'تركيز' },
];

const SLIDE_ORBIT_PROFILES = [
  { label: 'استقبال', ringSpeedSec: 26 },
  { label: 'تحليل', ringSpeedSec: 18 },
  { label: 'حماية', ringSpeedSec: 22 },
] as const;

/**
 * Pure 2D Calm Geometric Morrow Emblem.
 * Synchronizes concentric vector motion and mood states with the active Surface2D theme.
 */
export const MorrowEmblem2D: React.FC<MorrowEmblem2DProps> = ({
  themeId = 'obsidian_gold',
  surfacePrefs,
  activeSlideIndex = 0,
  reduceMotion = false,
  onGreetClick,
  className = '',
  compact = false,
}) => {
  const hookReducedMotion = useTabrixReducedMotion();
  const isReducedMotion = reduceMotion || hookReducedMotion;
  const [greetLineIdx, setGreetLineIdx] = useState(0);
  const [mood, setMood] = useState<EmblemMood>('greet');
  const [pulseCount, setPulseCount] = useState(0);

  const effectivePrefs: Surface2DPrefs = useMemo(
    () =>
      surfacePrefs || {
        themeId,
        motionIntensity: 'subtle',
        cardDensity: 'balanced',
      },
    [surfacePrefs, themeId]
  );

  const palette = useMemo(
    () => resolveActiveSurfacePalette(effectivePrefs),
    [effectivePrefs]
  );

  const companionState = useMemo(
    () => resolveMorrowCompanionState(mood, activeSlideIndex, pulseCount > 0),
    [mood, activeSlideIndex, pulseCount]
  );

  const activeStage =
    SLIDE_ORBIT_PROFILES[activeSlideIndex % SLIDE_ORBIT_PROFILES.length] ||
    SLIDE_ORBIT_PROFILES[0];

  const triggerGreeting = () => {
    setPulseCount((c) => c + 1);
    setMood((prev) =>
      prev === 'greet' ? 'excited' : prev === 'excited' ? 'focus' : 'greet'
    );
    setGreetLineIdx((prev) => (prev + 1) % GREETING_LINES.length);
    triggerGlobalMotionPulse(1.2);
    onGreetClick?.();
  };

  const outerSpinDur = Math.max(
    10,
    Math.round((activeStage.ringSpeedSec + companionState.orbitDurationSec) / 2)
  );

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div
        className={`relative w-full ${
          compact ? 'h-[210px] sm:h-[230px]' : 'h-[268px] sm:h-[304px]'
        } rounded-[20px] overflow-hidden border`}
        style={{
          borderColor: palette.borderColor,
          background: `radial-gradient(115% 100% at 50% 15%, color-mix(in srgb, ${palette.bgSurface} 92%, ${palette.accent} 8%) 0%, ${palette.bgMain} 78%)`,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 48%, ${palette.glowRgba}, transparent 68%)`,
          }}
        />

        {/* Pure 2D Geometric Emblem Stage */}
        <div
          data-testid="morrow-emblem-2d"
          onClick={triggerGreeting}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerGreeting();
            }
          }}
          aria-label="الشعار الهندسي التفاعلي لنظام Morrow"
          className="w-full h-full relative z-10 flex items-center justify-center cursor-pointer"
        >
          {!isReducedMotion && pulseCount > 0 && (
            <motion.span
              key={pulseCount}
              aria-hidden="true"
              className="pointer-events-none absolute w-28 h-28 rounded-full border"
              style={{ borderColor: palette.accentBright }}
              initial={{ scale: 0.85, opacity: 0.7 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          )}

          <svg
            viewBox="0 0 260 220"
            className={`w-full max-w-[250px] ${compact ? 'h-[170px]' : 'h-[195px]'}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Outer Precision Ring */}
            <motion.g
              style={{ transformOrigin: '130px 110px' }}
              animate={isReducedMotion ? undefined : { rotate: 360 }}
              transition={
                isReducedMotion
                  ? undefined
                  : { duration: outerSpinDur, repeat: Infinity, ease: 'linear' }
              }
            >
              <circle
                cx="130"
                cy="110"
                r="84"
                stroke={palette.accent}
                strokeOpacity={companionState.ringOpacity}
                strokeWidth="1.1"
                strokeDasharray="8 7"
              />
              <circle cx="214" cy="110" r="2.6" fill={palette.accentBright} />
              <circle cx="46" cy="110" r="2.1" fill={palette.secondary} />
            </motion.g>

            {/* Counter-Rotating Inner Gauge */}
            <motion.g
              style={{ transformOrigin: '130px 110px' }}
              animate={isReducedMotion ? undefined : { rotate: -360 }}
              transition={
                isReducedMotion
                  ? undefined
                  : { duration: Math.round(outerSpinDur * 0.75), repeat: Infinity, ease: 'linear' }
              }
            >
              <circle
                cx="130"
                cy="110"
                r="64"
                stroke={palette.secondary}
                strokeOpacity="0.38"
                strokeWidth="1.15"
                strokeDasharray="22 10 6 10"
              />
            </motion.g>

            {/* Calm Floating Hexagonal Core */}
            <motion.g
              animate={
                isReducedMotion
                  ? undefined
                  : {
                      y: [
                        -companionState.breathAmplitudePx,
                        companionState.breathAmplitudePx,
                        -companionState.breathAmplitudePx,
                      ],
                    }
              }
              transition={
                isReducedMotion
                  ? undefined
                  : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              <polygon
                points="130,62 172,86 172,134 130,158 88,134 88,86"
                fill={palette.bgSurface}
                stroke={palette.accentBright}
                strokeWidth="1.4"
              />
              <polygon
                points="130,70 165,90 165,130 130,150 95,130 95,90"
                fill={palette.accent}
                fillOpacity="0.08"
                stroke={palette.secondary}
                strokeOpacity="0.32"
                strokeWidth="0.9"
              />

              {/* Morrow Monogram */}
              <path
                d="M108 124V96L130 112L152 96V124L144 119V108L130 118.5L116 108V119L108 124Z"
                fill={palette.accentBright}
              />

              {/* Status Indicators */}
              <rect
                x="116"
                y="84"
                width="10"
                height={mood === 'focus' ? 2.2 : mood === 'excited' ? 4.2 : 3}
                rx="1.5"
                fill={palette.secondary}
              />
              <rect
                x="134"
                y="84"
                width="10"
                height={mood === 'focus' ? 2.2 : mood === 'excited' ? 4.2 : 3}
                rx="1.5"
                fill={palette.secondary}
              />
            </motion.g>
          </svg>
        </div>

        {/* Mood Selector */}
        {!compact && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-xl border p-1"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            {MOOD_LABELS.map((item) => {
              const active = mood === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`morrow-mood-${item.id}`}
                  onClick={() => {
                    setMood(item.id);
                    setPulseCount((c) => c + 1);
                    triggerGlobalMotionPulse(1.05);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Stage Tag */}
        <div
          className="pointer-events-none absolute top-3 left-3 z-20 px-2.5 py-1 rounded-xl border text-[10px] font-extrabold"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--accent-bright)',
          }}
        >
          وضع: {activeStage.label}
        </div>

        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerGreeting();
          }}
          whileHover={isReducedMotion ? undefined : { scale: 1.02 }}
          whileTap={isReducedMotion ? undefined : { scale: 0.97 }}
          transition={TABRIX_TACTILE_SPRING}
          data-testid="morrow-emblem-greet-btn"
          aria-label="تفاعل مع شعار Morrow الذكي"
          className="absolute bottom-3 left-3 z-20 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--accent-bright)',
          }}
        >
          تفاعل مع Morrow ✨
        </motion.button>
      </div>

      {!compact && (
        <div
          className="mt-3 w-full rounded-2xl px-4 py-2.5 border text-center"
          style={{
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-relaxed">
            {GREETING_LINES[greetLineIdx]}
          </p>
        </div>
      )}
    </div>
  );
};
