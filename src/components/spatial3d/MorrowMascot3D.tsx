import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';
import {
  type MorrowEntityMood,
  resolveActiveSpatialPalette,
  resolveMorrowEntityMoodState,
  triggerGlobalSpatialPulse,
} from '../../utils/spatial3dConfig';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';

export type MascotMood = MorrowEntityMood;

interface MorrowMascot3DProps {
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
  activeSlideIndex?: number;
  reduceMotion?: boolean;
  onGreetClick?: () => void;
  className?: string;
}

const GREETING_LINES = [
  'أهلاً بك في Morrow! حرّك المؤشر أو انقر لتفعيل النبض الهندسي الذكي',
  'Morrow جاهز لمرافقتك في إدارة الوكالات، الحسابات والتدقيق الفوري.',
  'سجّل دخولك بالطريقة التي تفضلها: Google، اسم المستخدم، الهاتف، أو البريد.',
];

const MOOD_LABELS: Array<{ id: MascotMood; label: string }> = [
  { id: 'greet', label: 'ترحيب' },
  { id: 'excited', label: 'حماس' },
  { id: 'focus', label: 'تركيز' },
];

const SLIDE_ORBIT_PROFILES = [
  { label: 'استقبال', ringSpeedSec: 18 },
  { label: 'تحليل', ringSpeedSec: 11 },
  { label: 'حماية', ringSpeedSec: 14 },
] as const;

/**
 * Pure 2D Architectural Morrow HUD Core.
 * Renders crisp 2D vector concentric HUD dials, reactive optical visor bars,
 * and mood-synchronized motion without WebGL.
 */
export const MorrowMascot3D: React.FC<MorrowMascot3DProps> = ({
  themeId = 'emerald_smoked',
  spatialPrefs,
  activeSlideIndex = 0,
  reduceMotion = false,
  onGreetClick,
  className = '',
}) => {
  const hookReducedMotion = useTabrixReducedMotion();
  const isReducedMotion = reduceMotion || hookReducedMotion;
  const [greetLineIdx, setGreetLineIdx] = useState(0);
  const [mood, setMood] = useState<MascotMood>('greet');
  const [pulseCount, setPulseCount] = useState(0);

  const effectivePrefs: Spatial3DPrefs = useMemo(
    () =>
      spatialPrefs || {
        themeId,
        tiltIntensity: 'subtle',
        cardDensity: 'balanced',
      },
    [spatialPrefs, themeId]
  );

  const palette = useMemo(
    () => resolveActiveSpatialPalette(effectivePrefs),
    [effectivePrefs]
  );

  const moodState = useMemo(
    () => resolveMorrowEntityMoodState(mood, activeSlideIndex, pulseCount > 0),
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
    triggerGlobalSpatialPulse(1.35);
    onGreetClick?.();
  };

  const outerSpinDur = Math.max(
    5,
    Math.round(activeStage.ringSpeedSec / Math.max(0.6, moodState.coreSpinSpeed * 0.45))
  );

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div
        className="relative w-full h-[275px] sm:h-[315px] rounded-[24px] overflow-hidden border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_20px_54px_-20px_rgba(0,0,0,0.88)]"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 15%, rgba(15, 30, 56, 0.72) 0%, rgba(4, 8, 20, 0.94) 72%)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 46%, ${palette.glowRgba}, transparent 68%)`,
          }}
        />

        {/* Pure 2D Architectural Vector HUD Core */}
        <div
          data-testid="morrow-mascot-3d"
          onClick={triggerGreeting}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerGreeting();
            }
          }}
          aria-label="النواة الهندسية التفاعلية لنظام Morrow"
          className="w-full h-full relative z-10 flex items-center justify-center cursor-pointer"
        >
          {!isReducedMotion && pulseCount > 0 && (
            <motion.span
              key={pulseCount}
              aria-hidden="true"
              className="pointer-events-none absolute w-32 h-32 rounded-full border"
              style={{ borderColor: palette.accentBright }}
              initial={{ scale: 0.8, opacity: 0.85 }}
              animate={{ scale: 2.35, opacity: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            />
          )}

          <svg
            viewBox="0 0 260 220"
            className="w-full max-w-[260px] h-[200px]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Outer Precision Telemetry Circle */}
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
                r="86"
                stroke={palette.accent}
                strokeOpacity="0.34"
                strokeWidth="1.2"
                strokeDasharray="8 6"
              />
              <circle cx="216" cy="110" r="3" fill={palette.accentBright} />
              <circle cx="44" cy="110" r="2.5" fill={palette.secondary} />
            </motion.g>

            {/* Counter-Rotating Calibrated Ring */}
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
                r="66"
                stroke={palette.secondary}
                strokeOpacity="0.48"
                strokeWidth="1.35"
                strokeDasharray="24 10 6 10"
              />
            </motion.g>

            {/* Chamfered Hexagonal Morrow Visor Housing */}
            <motion.g
              animate={
                isReducedMotion
                  ? undefined
                  : {
                      y: [-moodState.hoverAmplitude * 30, moodState.hoverAmplitude * 30, -moodState.hoverAmplitude * 30],
                    }
              }
              transition={
                isReducedMotion
                  ? undefined
                  : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              <polygon
                points="130,62 172,86 172,134 130,158 88,134 88,86"
                fill="rgba(5, 12, 26, 0.92)"
                stroke={palette.accentBright}
                strokeWidth="1.5"
              />
              <polygon
                points="130,70 165,90 165,130 130,150 95,130 95,90"
                fill={palette.accent}
                fillOpacity="0.09"
                stroke={palette.secondary}
                strokeOpacity="0.38"
                strokeWidth="1"
              />

              {/* Morrow Emblem Visor */}
              <path
                d="M108 124V96L130 112L152 96V124L144 119V108L130 118.5L116 108V119L108 124Z"
                fill={palette.accentBright}
              />

              {/* Reactive Mood Optical Telemetry Bars */}
              <rect
                x="116"
                y="84"
                width="10"
                height={mood === 'focus' ? 2.5 : mood === 'excited' ? 5 : 3.5}
                rx="1.5"
                fill={palette.secondary}
              />
              <rect
                x="134"
                y="84"
                width="10"
                height={mood === 'focus' ? 2.5 : mood === 'excited' ? 5 : 3.5}
                rx="1.5"
                fill={palette.secondary}
              />
            </motion.g>
          </svg>
        </div>

        {/* Mood Selector */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-xl bg-[#050C1A]/90 border border-white/15 p-1"
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
                  triggerGlobalSpatialPulse(1.1);
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

        {/* Orbital Profile Tag */}
        <div className="pointer-events-none absolute top-3 left-3 z-20 px-2.5 py-1 rounded-xl bg-[#050C1A]/88 border border-white/15 text-[10px] font-extrabold text-[var(--accent-bright)]">
          وضع: {activeStage.label}
        </div>

        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerGreeting();
          }}
          whileHover={isReducedMotion ? undefined : { scale: 1.03 }}
          whileTap={isReducedMotion ? undefined : { scale: 0.97 }}
          transition={TABRIX_TACTILE_SPRING}
          data-testid="morrow-mascot-greet-btn"
          aria-label="تفاعل مع نواة Morrow الذكية"
          className="absolute bottom-3 left-3 z-20 px-3.5 py-1.5 rounded-xl bg-[#061224]/92 hover:bg-[#0B1E3B] border border-[var(--accent)]/40 text-[11px] font-extrabold text-[var(--accent-bright)] shadow-[0_6px_20px_-6px_var(--spatial-glow)] transition cursor-pointer"
        >
          تفاعل مع Morrow ✨
        </motion.button>
      </div>

      <div className="mt-3 w-full rounded-2xl px-4 py-2.5 border border-[var(--border-color)] bg-[#060E1F]/85 text-center">
        <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-relaxed">
          {GREETING_LINES[greetLineIdx]}
        </p>
      </div>
    </div>
  );
};

export const MorrowEntity3D = MorrowMascot3D;
