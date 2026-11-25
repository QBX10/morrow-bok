import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type {
  AppShapeId,
  AppView,
  Spatial3DPrefs,
  Spatial3DThemeId,
} from '../../types/agency';
import {
  SPATIAL_PULSE_EVENT,
  getSpatialViewChoreography,
  resolveActiveSpatialPalette,
} from '../../utils/spatial3dConfig';
import { GradientMeshBackdrop } from './GradientMeshBackdrop';

interface Spatial3DCanvasProps {
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
  appShape?: AppShapeId;
  activeView?: AppView;
  reduceMotion?: boolean;
  className?: string;
}

/**
 * Pure 2D Autonomous Geometric Backdrop Canvas.
 * Uses CSS-composited orbital transforms so JS main thread stays 100% free during scroll and interaction.
 */
export const Spatial3DCanvas: React.FC<Spatial3DCanvasProps> = ({
  themeId = 'emerald_smoked',
  spatialPrefs,
  appShape,
  activeView = 'hub',
  reduceMotion = false,
  className = '',
}) => {
  const effectivePrefs: Spatial3DPrefs = useMemo(
    () =>
      spatialPrefs || {
        themeId,
        tiltIntensity: 'subtle',
        cardDensity: 'balanced',
      },
    [spatialPrefs, themeId]
  );

  const resolvedShape: AppShapeId =
    appShape ||
    (typeof document !== 'undefined'
      ? ((document.documentElement.dataset.appShape as AppShapeId) || 'geometric-glass')
      : 'geometric-glass');

  const palette = useMemo(
    () => resolveActiveSpatialPalette(effectivePrefs),
    [effectivePrefs]
  );

  const choreography = useMemo(
    () => getSpatialViewChoreography(activeView),
    [activeView]
  );

  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    const onPulse = () => {
      setPulseCount((c) => c + 1);
    };
    window.addEventListener(SPATIAL_PULSE_EVENT, onPulse);
    return () => window.removeEventListener(SPATIAL_PULSE_EVENT, onPulse);
  }, []);

  const ringSpinDuration = Math.max(24, Math.round(52 / Math.max(0.4, choreography.ringSpeedMult)));
  const isLight = !palette.isDark;
  const isEditorial = resolvedShape === 'swiss-editorial';

  return (
    <div
      data-testid="spatial-2d-canvas"
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      <GradientMeshBackdrop
        themeId={effectivePrefs.themeId}
        spatialPrefs={effectivePrefs}
        appShape={resolvedShape}
        intensity="medium"
        reduceMotion={reduceMotion}
      />

      {/* Autonomous 2D Sacred Geometry Reticle & Precision Orbitals */}
      {!isEditorial && (
        <svg
          className={`absolute inset-0 h-full w-full ${isLight ? 'opacity-[0.14]' : 'opacity-[0.2]'}`}
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="geoBackdropGlow" cx="50%" cy="46%" r="50%">
              <stop offset="0%" stopColor={palette.accent} stopOpacity={isLight ? '0.12' : '0.2'} />
              <stop offset="60%" stopColor={palette.secondary} stopOpacity="0.05" />
              <stop offset="100%" stopColor={palette.bgMain} stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="720" cy="430" r="420" fill="url(#geoBackdropGlow)" />

          <line
            x1="720"
            y1="40"
            x2="720"
            y2="860"
            stroke={palette.accent}
            strokeOpacity="0.1"
            strokeWidth="0.75"
            strokeDasharray="4 8"
          />
          <line
            x1="140"
            y1="430"
            x2="1300"
            y2="430"
            stroke={palette.secondary}
            strokeOpacity="0.1"
            strokeWidth="0.75"
            strokeDasharray="4 8"
          />

          <g
            className={reduceMotion ? '' : 'spin-orbital-cw'}
            style={{
              transformOrigin: '720px 430px',
              animationDuration: `${ringSpinDuration}s`,
            }}
          >
            {resolvedShape === 'sharp-monolith' ? (
              <rect
                x="410"
                y="120"
                width="620"
                height="620"
                stroke={palette.accent}
                strokeOpacity="0.22"
                strokeWidth="0.9"
                strokeDasharray="12 10"
              />
            ) : resolvedShape === 'royal-octagram' ? (
              <polygon
                points="720,90 960,190 1060,430 960,670 720,770 480,670 380,430 480,190"
                stroke={palette.accent}
                strokeOpacity="0.25"
                strokeWidth="1"
              />
            ) : (
              <circle
                cx="720"
                cy="430"
                r="340"
                stroke={palette.accent}
                strokeOpacity="0.22"
                strokeWidth="0.9"
                strokeDasharray="10 14"
              />
            )}
            <circle cx="1060" cy="430" r="3" fill={palette.accentBright} fillOpacity="0.55" />
            <circle cx="380" cy="430" r="2.5" fill={palette.secondary} fillOpacity="0.5" />
          </g>

          <g
            className={reduceMotion ? '' : 'spin-orbital-ccw'}
            style={{
              transformOrigin: '720px 430px',
              animationDuration: `${Math.round(ringSpinDuration * 0.72)}s`,
            }}
          >
            <circle
              cx="720"
              cy="430"
              r="230"
              stroke={palette.secondary}
              strokeOpacity="0.18"
              strokeWidth="0.85"
              strokeDasharray="4 10"
            />
          </g>
        </svg>
      )}

      {/* Event-driven subtle 2D pulse ripple */}
      {!reduceMotion && pulseCount > 0 && (
        <motion.div
          key={pulseCount}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            borderColor: palette.accentBright,
            width: 120,
            height: 120,
          }}
          initial={{ scale: 0.6, opacity: 0.45 }}
          animate={{ scale: 6.5, opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
};
