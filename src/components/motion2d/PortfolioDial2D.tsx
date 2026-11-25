import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Surface2DPrefs } from '../../types/agency';
import {
  computeHubDialTelemetry,
  resolveActiveSurfacePalette,
  triggerGlobalMotionPulse,
} from '../../utils/surface2dConfig';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';

interface PortfolioDial2DProps {
  surfacePrefs?: Surface2DPrefs;
  agencyCount?: number;
  activeIndividuals?: number;
  issueCount?: number;
  onPulse?: () => void;
  className?: string;
}

/**
 * Pure 2D SVG Portfolio Health Gauge inside AgenciesHubView & MorrowCommandCenterView.
 * Renders crisp tabular-nums readiness telemetry with calm Obsidian & Gold / active theme accents.
 */
export const PortfolioDial2D: React.FC<PortfolioDial2DProps> = ({
  surfacePrefs,
  agencyCount = 0,
  activeIndividuals = 0,
  issueCount = 0,
  onPulse,
  className = '',
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [pulseKey, setPulseKey] = useState(0);

  const telemetry = useMemo(
    () => computeHubDialTelemetry(agencyCount, activeIndividuals, issueCount),
    [agencyCount, activeIndividuals, issueCount]
  );

  const palette = useMemo(
    () => resolveActiveSurfacePalette(surfacePrefs),
    [surfacePrefs]
  );

  const satelliteAngles = useMemo(() => {
    const count = Math.max(3, Math.min(8, telemetry.satelliteCount));
    return Array.from({ length: count }, (_, idx) => (idx / count) * Math.PI * 2);
  }, [telemetry.satelliteCount]);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const healthFraction = Math.max(0.1, Math.min(1, telemetry.healthPct / 100));
  const strokeDashoffset = circumference * (1 - healthFraction);

  const handleClick = () => {
    setPulseKey((k) => k + 1);
    triggerGlobalMotionPulse(1.15);
    onPulse?.();
  };

  return (
    <motion.button
      type="button"
      data-testid="portfolio-dial-2d"
      onClick={handleClick}
      whileHover={reducedMotion ? undefined : { scale: 1.03 }}
      whileTap={reducedMotion ? undefined : { scale: 0.97 }}
      transition={TABRIX_TACTILE_SPRING}
      title={`حالة المحفظة: ${telemetry.healthPct}% — ${agencyCount} وكالة (${activeIndividuals} فرد)`}
      aria-label={`مؤشر محفظة الوكالات: الجاهزية ${telemetry.healthPct}%`}
      className={`relative w-[104px] h-[104px] sm:w-[112px] sm:h-[112px] rounded-full cursor-pointer select-none flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)] ${className}`}
    >
      {/* Subtle Core Tint */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${palette.glowRgba}, transparent 72%)`,
        }}
      />

      {/* Interactive 2D Pulse Ring */}
      {!reducedMotion && pulseKey > 0 && (
        <motion.span
          key={pulseKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border"
          style={{ borderColor: palette.accentBright }}
          initial={{ scale: 0.92, opacity: 0.65 }}
          animate={{ scale: 1.38, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      )}

      {/* Precision 2D Vector Dial */}
      <svg
        viewBox="0 0 112 112"
        className="relative z-10 h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g
          className={reducedMotion ? '' : 'spin-orbital-cw'}
          style={{
            transformOrigin: '56px 56px',
            animationDuration: `${telemetry.ringDurationSec}s`,
          }}
        >
          <circle
            cx="56"
            cy="56"
            r="48"
            stroke={palette.secondary}
            strokeOpacity="0.24"
            strokeWidth="0.9"
            strokeDasharray="4 5"
          />
          {satelliteAngles.map((rad, i) => {
            const cx = 56 + Math.cos(rad) * 48;
            const cy = 56 + Math.sin(rad) * 48;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={i === 0 ? 2.3 : 1.7}
                fill={i % 2 === 0 ? palette.accentBright : palette.secondary}
              />
            );
          })}
        </g>

        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={palette.borderColor}
          strokeWidth="3.2"
        />

        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={telemetry.alertIntensity > 0.35 ? '#F59E0B' : palette.accent}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 56 56)"
          style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />

        <polygon
          points="56,30 82,56 56,82 30,56"
          stroke={palette.accentBright}
          strokeOpacity="0.18"
          strokeWidth="0.8"
        />
      </svg>

      {/* Center Readout */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center text-center leading-none">
        <span
          dir="ltr"
          className="font-mono-num text-base font-black tabular-nums"
          style={{ color: palette.accentBright }}
        >
          {telemetry.healthPct}%
        </span>
        <span className="mt-1 text-[9px] font-bold text-[var(--text-muted)] tabular-nums">
          {agencyCount} وكالة
        </span>
      </div>
    </motion.button>
  );
};
