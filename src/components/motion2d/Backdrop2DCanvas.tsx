import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type {
  AppShapeId,
  AppView,
  Surface2DPrefs,
  Surface2DThemeId,
} from '../../types/agency';
import {
  MOTION_PULSE_EVENT,
  buildAmbientBackdropLayers,
  getViewBackdropPreset,
  resolveActiveSurfacePalette,
} from '../../utils/surface2dConfig';

interface Backdrop2DCanvasProps {
  themeId?: Surface2DThemeId;
  surfacePrefs?: Surface2DPrefs;
  appShape?: AppShapeId;
  activeView?: AppView;
  slideIndex?: number;
  intensity?: 'calm' | 'medium';
  reduceMotion?: boolean;
  className?: string;
  showGeometryReticle?: boolean;
}

/**
 * Pure 2D Calm Geometric Backdrop Canvas.
 * Uses compositor-friendly CSS ambient layers and light vector geometry with zero heavy glows.
 */
export const Backdrop2DCanvas: React.FC<Backdrop2DCanvasProps> = ({
  themeId = 'obsidian_gold',
  surfacePrefs,
  appShape,
  activeView = 'hub',
  slideIndex = 0,
  intensity = 'calm',
  reduceMotion = false,
  className = '',
  showGeometryReticle = true,
}) => {
  const effectivePrefs: Surface2DPrefs = useMemo(
    () =>
      surfacePrefs || {
        themeId,
        motionIntensity: 'subtle',
        cardDensity: 'balanced',
      },
    [surfacePrefs, themeId]
  );

  const resolvedShape: AppShapeId =
    appShape ||
    (typeof document !== 'undefined'
      ? ((document.documentElement.dataset.appShape as AppShapeId) || 'geometric-glass')
      : 'geometric-glass');

  const palette = useMemo(
    () => resolveActiveSurfacePalette(effectivePrefs),
    [effectivePrefs]
  );

  const { layers } = useMemo(
    () => buildAmbientBackdropLayers(effectivePrefs, slideIndex, intensity),
    [effectivePrefs, slideIndex, intensity]
  );

  const viewPreset = useMemo(
    () => getViewBackdropPreset(activeView),
    [activeView]
  );

  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    const onPulse = () => {
      setPulseCount((c) => c + 1);
    };
    window.addEventListener(MOTION_PULSE_EVENT, onPulse);
    return () => window.removeEventListener(MOTION_PULSE_EVENT, onPulse);
  }, []);

  const isLight = !palette.isDark;
  const isEditorial = resolvedShape === 'swiss-editorial';

  const baseGradient = isLight
    ? `radial-gradient(115% 95% at 50% 0%, ${palette.bgSurface} 0%, ${palette.bgMain} 74%, ${palette.bgTableHeader} 100%)`
    : `radial-gradient(120% 105% at 50% 0%, color-mix(in srgb, ${palette.bgSurface} 68%, ${palette.bgMain}) 0%, ${palette.bgMain} 74%)`;

  const renderShapePattern = () => {
    if (resolvedShape === 'sharp-monolith') {
      return (
        <pattern
          id="morrowCalmMeshGrid"
          width="68"
          height="68"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 68 0 L 0 0 0 68"
            fill="none"
            stroke={palette.accent}
            strokeOpacity={isLight ? '0.09' : '0.12'}
            strokeWidth="0.7"
          />
          <circle
            cx="34"
            cy="34"
            r="1"
            fill={palette.accentBright}
            fillOpacity="0.22"
          />
        </pattern>
      );
    }

    if (resolvedShape === 'royal-octagram') {
      return (
        <pattern
          id="morrowCalmMeshGrid"
          width="84"
          height="84"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="42,6 78,42 42,78 6,42"
            fill="none"
            stroke={palette.accent}
            strokeOpacity={isLight ? '0.08' : '0.12'}
            strokeWidth="0.65"
          />
          <circle
            cx="42"
            cy="42"
            r="1.3"
            fill={palette.accentBright}
            fillOpacity="0.25"
          />
        </pattern>
      );
    }

    if (resolvedShape === 'swiss-editorial') {
      return (
        <pattern
          id="morrowCalmMeshGrid"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="14"
            cy="14"
            r="0.75"
            fill={palette.accent}
            fillOpacity={isLight ? '0.14' : '0.16'}
          />
        </pattern>
      );
    }

    if (resolvedShape === 'floating-capsule') {
      return (
        <pattern
          id="morrowCalmMeshGrid"
          width="88"
          height="88"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="44"
            cy="44"
            r="24"
            fill="none"
            stroke={palette.accent}
            strokeOpacity={isLight ? '0.08' : '0.11'}
            strokeWidth="0.6"
            strokeDasharray="4 7"
          />
        </pattern>
      );
    }

    return (
      <pattern
        id="morrowCalmMeshGrid"
        width="76"
        height="76"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 76 0 L 0 0 0 76"
          fill="none"
          stroke={palette.accent}
          strokeOpacity={isLight ? '0.08' : '0.11'}
          strokeWidth="0.6"
        />
        <circle
          cx="38"
          cy="38"
          r="0.95"
          fill={palette.accentBright}
          fillOpacity="0.22"
        />
      </pattern>
    );
  };

  return (
    <div
      data-testid="backdrop-2d-canvas"
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      {/* 1. Calm Adaptive Surface Base */}
      <div
        className="absolute inset-0 transition-colors duration-300"
        style={{ background: baseGradient }}
      />

      {/* 2. Restrained Ambient Radial Washes */}
      {!isEditorial && (
        <div className="absolute inset-0 pointer-events-none">
          {layers.map((layer, idx) => (
            <div
              key={layer.id}
              className={`absolute rounded-full ${layer.sizeClass} ${
                reduceMotion ? '' : idx % 2 === 0 ? 'ambient-orb-drift-a' : 'ambient-orb-drift-b'
              }`}
              style={{
                ...layer.initialPos,
                background: layer.gradient,
                opacity: isLight ? layer.opacity * 0.34 : layer.opacity * 0.72,
              }}
            />
          ))}
        </div>
      )}

      {/* 3. Subtle Geometric Hairline Grid */}
      <div
        className={`absolute inset-0 ${isEditorial ? 'opacity-[0.12]' : isLight ? 'opacity-[0.1]' : 'opacity-[0.14]'}`}
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>{renderShapePattern()}</defs>
          <rect width="100%" height="100%" fill="url(#morrowCalmMeshGrid)" />
        </svg>
      </div>

      {/* 4. Ultra-subtle 2D Geometric Reticle */}
      {showGeometryReticle && !isEditorial && (
        <svg
          className="absolute inset-0 h-full w-full transition-opacity duration-500"
          style={{ opacity: isLight ? viewPreset.ringOpacity * 0.45 : viewPreset.ringOpacity * 0.7 }}
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            transform={`translate(${viewPreset.offsetX}, ${viewPreset.offsetY})`}
            style={{ transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <g
              className={reduceMotion ? '' : 'spin-orbital-cw'}
              style={{
                transformOrigin: '720px 430px',
                animationDuration: '68s',
              }}
            >
              {resolvedShape === 'sharp-monolith' ? (
                <rect
                  x="420"
                  y="130"
                  width="600"
                  height="600"
                  stroke={palette.accent}
                  strokeOpacity="0.16"
                  strokeWidth="0.8"
                  strokeDasharray="10 12"
                />
              ) : resolvedShape === 'royal-octagram' ? (
                <polygon
                  points="720,100 950,195 1045,430 950,665 720,760 490,665 395,430 490,195"
                  stroke={palette.accent}
                  strokeOpacity="0.18"
                  strokeWidth="0.85"
                />
              ) : (
                <circle
                  cx="720"
                  cy="430"
                  r="330"
                  stroke={palette.accent}
                  strokeOpacity="0.16"
                  strokeWidth="0.8"
                  strokeDasharray="8 14"
                />
              )}
              <circle cx="1050" cy="430" r="2.2" fill={palette.accentBright} fillOpacity="0.4" />
            </g>

            <g
              className={reduceMotion ? '' : 'spin-orbital-ccw'}
              style={{
                transformOrigin: '720px 430px',
                animationDuration: '48s',
              }}
            >
              <circle
                cx="720"
                cy="430"
                r="220"
                stroke={palette.secondary}
                strokeOpacity="0.13"
                strokeWidth="0.75"
                strokeDasharray="4 12"
              />
            </g>
          </g>
        </svg>
      )}

      {/* 5. Calm Event-Driven 2D Ripple */}
      {!reduceMotion && pulseCount > 0 && (
        <motion.div
          key={pulseCount}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            borderColor: palette.accent,
            width: 112,
            height: 112,
          }}
          initial={{ scale: 0.7, opacity: 0.28 }}
          animate={{ scale: 5.5, opacity: 0 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
};
