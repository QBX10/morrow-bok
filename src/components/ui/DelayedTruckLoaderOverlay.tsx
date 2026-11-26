import React, { useId } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useDelayedLoadingState } from '../../utils/delayedLoader';
import {
  TABRIX_EASE,
  TABRIX_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface SmartTruckInlineIconProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Compact geometric animated truck icon for inline real-loading indicators
 * (rear doors swing open -> geometric crates enter -> doors lock -> truck rolls cleanly).
 */
export const SmartTruckInlineIcon: React.FC<SmartTruckInlineIconProps> = ({
  size = 'sm',
  className = '',
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const uid = useId().replace(/:/g, '_');
  const dims =
    size === 'xs'
      ? 'h-4 w-9'
      : size === 'md'
        ? 'h-8 w-[72px]'
        : 'h-5 w-11';

  return (
    <svg
      viewBox="0 0 300 124"
      className={`shrink-0 overflow-visible ${dims} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`inlineAccent_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-bright, #EED278)" />
          <stop offset="100%" stopColor="var(--accent, #D4AF37)" />
        </linearGradient>
      </defs>

      {/* Moving geometric road dashes */}
      <g className={reducedMotion ? 'opacity-50' : 'truck-road-dashes'}>
        <line
          x1="4"
          y1="112"
          x2="420"
          y2="112"
          stroke="var(--accent, #D4AF37)"
          strokeWidth="3.2"
          strokeDasharray="18 14"
          strokeLinecap="round"
        />
      </g>

      <g className={reducedMotion ? '' : 'truck-chassis-motion'}>
        {/* Cargo Box */}
        <rect
          x="74"
          y="38"
          width="102"
          height="54"
          rx="8"
          fill="var(--bg-surface, #101012)"
          stroke={`url(#inlineAccent_${uid})`}
          strokeWidth="4"
        />

        {/* Crates gliding into bay */}
        <g className={reducedMotion ? '' : 'truck-box-a'}>
          <rect
            x="84"
            y="58"
            width="22"
            height="22"
            rx="3.5"
            fill="var(--accent, #D4AF37)"
          />
        </g>
        <g className={reducedMotion ? '' : 'truck-box-b'}>
          <rect
            x="112"
            y="58"
            width="22"
            height="22"
            rx="3.5"
            fill="var(--accent-bright, #EED278)"
          />
        </g>
        <g className={reducedMotion ? '' : 'truck-box-c'}>
          <rect
            x="140"
            y="58"
            width="22"
            height="22"
            rx="3.5"
            fill="var(--spatial-secondary, var(--accent))"
          />
        </g>

        {/* Rear Doors (upper + lower swing) */}
        <line
          x1="72"
          y1="42"
          x2="72"
          y2="65"
          stroke="var(--accent-bright, #EED278)"
          strokeWidth="5"
          strokeLinecap="round"
          className={reducedMotion ? '' : 'truck-door-top'}
        />
        <line
          x1="72"
          y1="66"
          x2="72"
          y2="89"
          stroke="var(--accent-bright, #EED278)"
          strokeWidth="5"
          strokeLinecap="round"
          className={reducedMotion ? '' : 'truck-door-bottom'}
        />

        {/* Cab */}
        <path
          d="M179 49 H210 C217 49 222 53 226 60 L235 76 V92 H179 Z"
          fill="var(--bg-surface, #101012)"
          stroke={`url(#inlineAccent_${uid})`}
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Wheels */}
        <g transform="translate(104 97)">
          <g className={reducedMotion ? '' : 'truck-wheel-spin'}>
            <circle
              cx="0"
              cy="0"
              r="13"
              fill="var(--bg-main, #070708)"
              stroke={`url(#inlineAccent_${uid})`}
              strokeWidth="4"
            />
            <line x1="-8" y1="0" x2="8" y2="0" stroke="var(--accent-bright, #EED278)" strokeWidth="2.5" />
          </g>
        </g>
        <g transform="translate(207 97)">
          <g className={reducedMotion ? '' : 'truck-wheel-spin'}>
            <circle
              cx="0"
              cy="0"
              r="13"
              fill="var(--bg-main, #070708)"
              stroke={`url(#inlineAccent_${uid})`}
              strokeWidth="4"
            />
            <line x1="-8" y1="0" x2="8" y2="0" stroke="var(--accent-bright, #EED278)" strokeWidth="2.5" />
          </g>
        </g>
      </g>
    </svg>
  );
};

/**
 * Non-blocking compact geometric floating truck loader dock.
 * Appears ONLY during real active/delayed loading tasks without covering the screen or blocking interaction.
 */
export const DelayedTruckLoaderOverlay: React.FC = () => {
  const { visible, label, subtitle } = useDelayedLoadingState();
  const reducedMotion = useTabrixReducedMotion();
  const uid = useId().replace(/:/g, '_');

  return (
    <AnimatePresence>
      {visible && (
        <div
          key="delayed-truck-loader-dock"
          data-testid="delayed-truck-loader"
          role="status"
          aria-live="polite"
          aria-label={label}
          className="no-print pointer-events-none fixed bottom-4 left-4 right-4 sm:right-auto sm:bottom-6 sm:left-6 z-[115] flex justify-start"
        >
          <motion.div
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 16 }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 12 }
            }
            transition={reducedMotion ? { duration: 0.16 } : TABRIX_SPRING}
            className="pointer-events-auto relative w-full max-w-[300px] overflow-hidden rounded-2xl border p-3.5 shadow-2xl"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-surface, #101012) 94%, transparent)',
              borderColor: 'color-mix(in srgb, var(--accent, #D4AF37) 44%, var(--border-color))',
              backdropFilter: 'blur(18px) saturate(150%)',
              WebkitBackdropFilter: 'blur(18px) saturate(150%)',
              boxShadow:
                '0 18px 44px -14px rgba(0, 0, 0, 0.68), 0 0 24px -10px var(--marine-caustic-1, rgba(212,175,55,0.28))',
            }}
          >
            {/* Compact Geometric Road & Convoy Stage */}
            <div
              className="relative mb-2.5 h-[78px] w-full overflow-hidden rounded-xl border px-2 pt-1"
              style={{
                backgroundColor: 'var(--bg-main, #070708)',
                borderColor: 'color-mix(in srgb, var(--accent, #D4AF37) 20%, var(--border-color))',
              }}
            >
              <svg
                viewBox="0 0 320 126"
                className="relative h-full w-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={`dockBody_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--bg-table-header, #1c1a16)" />
                    <stop offset="100%" stopColor="var(--bg-main, #09090b)" />
                  </linearGradient>
                  <linearGradient id={`dockAccent_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-bright, #EED278)" />
                    <stop offset="55%" stopColor="var(--accent, #D4AF37)" />
                    <stop offset="100%" stopColor="var(--accent-deep, #9F7F22)" />
                  </linearGradient>
                  <linearGradient id={`dockBeam_${uid}`} x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="var(--accent-bright, #EED278)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent, #D4AF37)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Parallax Geometric Horizon Skyline Markers */}
                <g className={reducedMotion ? 'opacity-25' : 'truck-skyline-grid'}>
                  <rect x="40" y="20" width="14" height="86" fill="none" stroke="var(--border-color)" strokeWidth="1" opacity="0.5" />
                  <rect x="115" y="12" width="18" height="94" fill="none" stroke="var(--border-color)" strokeWidth="1" opacity="0.4" />
                  <rect x="200" y="24" width="12" height="82" fill="none" stroke="var(--border-color)" strokeWidth="1" opacity="0.45" />
                  <rect x="280" y="16" width="16" height="90" fill="none" stroke="var(--border-color)" strokeWidth="1" opacity="0.4" />
                  <rect x="355" y="20" width="14" height="86" fill="none" stroke="var(--border-color)" strokeWidth="1" opacity="0.45" />
                </g>

                {/* Base Road Line */}
                <line
                  x1="6"
                  y1="108"
                  x2="314"
                  y2="108"
                  stroke="var(--accent, #D4AF37)"
                  strokeOpacity="0.34"
                  strokeWidth="1.8"
                />

                {/* Moving Road Dashes */}
                <g className={reducedMotion ? 'opacity-45' : 'truck-road-dashes'}>
                  <line
                    x1="4"
                    y1="116"
                    x2="460"
                    y2="116"
                    stroke="var(--accent-bright, #EED278)"
                    strokeWidth="2.2"
                    strokeDasharray="18 14"
                    strokeLinecap="round"
                  />
                </g>

                {/* Wind Streaks when moving */}
                <g className={reducedMotion ? 'opacity-0' : 'truck-wind-lines'}>
                  <line x1="22" y1="50" x2="54" y2="50" stroke="var(--accent-bright, #EED278)" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="14" y1="64" x2="44" y2="64" stroke="var(--accent, #D4AF37)" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="26" y1="78" x2="56" y2="78" stroke="var(--accent-bright, #EED278)" strokeWidth="1.6" strokeLinecap="round" />
                </g>

                {/* Main Geometric Truck Chassis */}
                <g className={reducedMotion ? '' : 'truck-chassis-motion'}>
                  <ellipse cx="162" cy="108" rx="84" ry="4" fill="rgba(0,0,0,0.65)" />

                  {/* Headlight Cone */}
                  <polygon points="242,76 312,62 312,92 242,84" fill={`url(#dockBeam_${uid})`} />

                  {/* Cargo Bay Frame */}
                  <rect
                    x="74"
                    y="38"
                    width="106"
                    height="55"
                    rx="8"
                    fill={`url(#dockBody_${uid})`}
                    stroke={`url(#dockAccent_${uid})`}
                    strokeWidth="2.2"
                  />

                  {/* Cargo Bay Interior Lit Backing */}
                  <rect
                    x="80"
                    y="44"
                    width="94"
                    height="43"
                    rx="5"
                    fill="var(--bg-nav-active, rgba(212,175,55,0.08))"
                    stroke="var(--border-color)"
                    strokeWidth="1"
                  />

                  {/* 3 Staggered Geometric Crates entering from rear dock */}
                  <g className={reducedMotion ? '' : 'truck-box-a'}>
                    <rect x="87" y="57" width="23" height="23" rx="3.5" fill="var(--accent, #D4AF37)" stroke="var(--accent-bright, #FFF4CC)" strokeWidth="1.2" />
                    <line x1="98.5" y1="57" x2="98.5" y2="80" stroke="var(--bg-main, #070708)" strokeOpacity="0.45" strokeWidth="2.5" />
                  </g>
                  <g className={reducedMotion ? '' : 'truck-box-b'}>
                    <rect x="116" y="54" width="24" height="26" rx="3.5" fill="var(--accent-bright, #EED278)" stroke="#FFFFFF" strokeWidth="1.2" />
                    <line x1="128" y1="54" x2="128" y2="80" stroke="var(--bg-main, #070708)" strokeOpacity="0.4" strokeWidth="2.5" />
                  </g>
                  <g className={reducedMotion ? '' : 'truck-box-c'}>
                    <rect x="145" y="58" width="22" height="22" rx="3.5" fill="var(--spatial-secondary, var(--accent))" stroke="var(--accent-bright, #FFF4CC)" strokeWidth="1.2" />
                    <line x1="156" y1="58" x2="156" y2="80" stroke="var(--bg-main, #070708)" strokeOpacity="0.45" strokeWidth="2.5" />
                  </g>

                  {/* Hinged Rear Doors (Top + Bottom Swing Open & Shut) */}
                  <line
                    x1="72"
                    y1="42"
                    x2="72"
                    y2="65"
                    stroke={`url(#dockAccent_${uid})`}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    className={reducedMotion ? '' : 'truck-door-top'}
                  />
                  <line
                    x1="72"
                    y1="66"
                    x2="72"
                    y2="89"
                    stroke={`url(#dockAccent_${uid})`}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    className={reducedMotion ? '' : 'truck-door-bottom'}
                  />

                  {/* Rear Lock Flash once closed */}
                  <circle
                    cx="72"
                    cy="65.5"
                    r="4.2"
                    fill="var(--accent-bright, #FFF4CC)"
                    className={reducedMotion ? 'opacity-0' : 'truck-lock-seal'}
                  />

                  {/* Lower Rail Chassis */}
                  <rect
                    x="70"
                    y="90"
                    width="174"
                    height="6.5"
                    rx="3"
                    fill="var(--bg-surface, #161411)"
                    stroke="var(--accent, #D4AF37)"
                    strokeOpacity="0.55"
                    strokeWidth="1.2"
                  />

                  {/* Truck Cab */}
                  <path
                    d="M183 48 H215 C222 48 227 52 231 59 L241 75 C243 78 244 82 244 86 V92 C244 94 242 96 239 96 H183 Z"
                    fill={`url(#dockBody_${uid})`}
                    stroke={`url(#dockAccent_${uid})`}
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M199 54 H214 C219 54 222 57 225 62 L231 72 H199 Z"
                    fill="var(--bg-main, #1D222B)"
                    stroke="var(--accent-bright, #EED278)"
                    strokeOpacity="0.65"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  <rect x="236" y="77" width="7" height="6" rx="2" fill="var(--accent-bright, #FFF3C4)" />

                  {/* Rear Wheel */}
                  <g transform="translate(106 97)">
                    <g className={reducedMotion ? '' : 'truck-wheel-spin'}>
                      <circle cx="0" cy="0" r="12.5" fill="var(--bg-main, #0B0B0D)" stroke={`url(#dockAccent_${uid})`} strokeWidth="2.5" />
                      <circle cx="0" cy="0" r="4.8" fill={`url(#dockAccent_${uid})`} />
                      <line x1="-8" y1="0" x2="8" y2="0" stroke="var(--accent-bright, #EED278)" strokeOpacity="0.7" strokeWidth="1.5" />
                      <line x1="0" y1="-8" x2="0" y2="8" stroke="var(--accent-bright, #EED278)" strokeOpacity="0.7" strokeWidth="1.5" />
                    </g>
                  </g>

                  {/* Front Wheel */}
                  <g transform="translate(213 97)">
                    <g className={reducedMotion ? '' : 'truck-wheel-spin'}>
                      <circle cx="0" cy="0" r="12.5" fill="var(--bg-main, #0B0B0D)" stroke={`url(#dockAccent_${uid})`} strokeWidth="2.5" />
                      <circle cx="0" cy="0" r="4.8" fill={`url(#dockAccent_${uid})`} />
                      <line x1="-8" y1="0" x2="8" y2="0" stroke="var(--accent-bright, #EED278)" strokeOpacity="0.7" strokeWidth="1.5" />
                      <line x1="0" y1="-8" x2="0" y2="8" stroke="var(--accent-bright, #EED278)" strokeOpacity="0.7" strokeWidth="1.5" />
                    </g>
                  </g>
                </g>
              </svg>
            </div>

            {/* Shimmer Bar */}
            <div
              className="mb-2 h-1 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent, #D4AF37) 18%, transparent)' }}
            >
              <div
                className={`h-full rounded-full ${
                  reducedMotion ? 'w-2/3' : 'truck-progress-shimmer w-1/2'
                }`}
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, var(--accent, #D4AF37) 35%, var(--accent-bright, #FFF1BA) 55%, var(--accent, #D4AF37) 75%, transparent 100%)',
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-2 text-right">
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-xs font-black tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {label}
                </div>
                <div
                  className="mt-0.5 line-clamp-1 text-[10px] leading-snug"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {subtitle}
                </div>
              </div>
              <motion.span
                animate={reducedMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: TABRIX_EASE }}
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--accent, #D4AF37)' }}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
