import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Spatial3DPrefs } from '../../types/agency';
import {
  computeHubOrbTelemetry,
  resolveActiveSpatialPalette,
  triggerGlobalSpatialPulse,
} from '../../utils/spatial3dConfig';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';

interface MorrowHubOrb3DProps {
  spatialPrefs?: Spatial3DPrefs;
  agencyCount?: number;
  activeIndividuals?: number;
  issueCount?: number;
  onPulse?: () => void;
  className?: string;
}

/**
 * Pure 2D SVG Geometric Portfolio Astrolabe Dial inside AgenciesHubView & MorrowCommandCenterView.
 * Maps live agency count, individual throughput, and audit health into concentric vector orbitals
 * with tabular-nums precision telemetry.
 */
export const MorrowHubOrb3D: React.FC<MorrowHubOrb3DProps> = ({
  spatialPrefs,
  agencyCount = 0,
  activeIndividuals = 0,
  issueCount = 0,
  onPulse,
  className = '',
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [pulseKey, setPulseKey] = useState(0);

  const telemetry = useMemo(
    () => computeHubOrbTelemetry(agencyCount, activeIndividuals, issueCount),
    [agencyCount, activeIndividuals, issueCount]
  );

  const palette = useMemo(
    () => resolveActiveSpatialPalette(spatialPrefs),
    [spatialPrefs]
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
    triggerGlobalSpatialPulse(1.25);
    onPulse?.();
  };

  return (
    <motion.button
      type="button"
      data-testid="morrow-hub-orb-3d"
      onClick={handleClick}
      whileHover={reducedMotion ? undefined : { scale: 1.04 }}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      transition={TABRIX_TACTILE_SPRING}
      title={`حالة المحفظة: ${telemetry.healthPct}% — ${agencyCount} وكالة (${activeIndividuals} فرد)`}
      aria-label={`مؤشر محفظة الوكالات: الجاهزية ${telemetry.healthPct}%`}
      className={`relative w-[108px] h-[108px] sm:w-[116px] sm:h-[116px] rounded-full cursor-pointer select-none flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)] ${className}`}
    >
      {/* Ambient Radial Core Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${palette.glowRgba}, transparent 72%)`,
        }}
      />

      {/* Interactive SVG Pulse Ring */}
      {!reducedMotion && pulseKey > 0 && (
        <motion.span
          key={pulseKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border"
          style={{ borderColor: palette.accentBright }}
          initial={{ scale: 0.9, opacity: 0.75 }}
          animate={{ scale: 1.45, opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
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
        {/* Outer rotating satellite ring */}
        <g
          className={reducedMotion ? '' : 'spin-orbital-cw'}
          style={{
            transformOrigin: '56px 56px',
            animationDuration: `${Math.max(9, Math.round(20 / Math.max(0.5, telemetry.ringSpinRate)))}s`,
          }}
        >
          <circle
            cx="56"
            cy="56"
            r="48"
            stroke={palette.secondary}
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {satelliteAngles.map((rad, i) => {
            const cx = 56 + Math.cos(rad) * 48;
            const cy = 56 + Math.sin(rad) * 48;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={i === 0 ? 2.6 : 1.9}
                fill={i % 2 === 0 ? palette.accentBright : palette.secondary}
              />
            );
          })}
        </g>

        {/* Health Gauge Track */}
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={palette.borderColor}
          strokeWidth="3.5"
        />

        {/* Active Health Arc */}
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={telemetry.alertIntensity > 0.35 ? '#F59E0B' : palette.accent}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 56 56)"
          style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />

        {/* Inner Diamond Reticle */}
        <polygon
          points="56,28 84,56 56,84 28,56"
          stroke={palette.accentBright}
          strokeOpacity="0.22"
          strokeWidth="0.9"
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
