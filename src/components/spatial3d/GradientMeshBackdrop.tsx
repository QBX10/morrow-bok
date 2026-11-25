import React from 'react';
import type { AppShapeId, Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';
import { buildGradientMeshLayers } from '../../utils/spatial3dConfig';

interface GradientMeshBackdropProps {
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
  appShape?: AppShapeId;
  slideIndex?: number;
  intensity?: 'vibrant' | 'medium' | 'subtle';
  reduceMotion?: boolean;
  className?: string;
}

/**
 * Pure GPU-composited Atmospheric Gradient & Shape-Matched Geometric Backdrop.
 * Zero continuous JS requestAnimationFrame loops for silky 60fps scrolling across all devices.
 */
export const GradientMeshBackdrop: React.FC<GradientMeshBackdropProps> = ({
  themeId = 'emerald_smoked',
  spatialPrefs,
  appShape,
  slideIndex = 0,
  intensity = 'vibrant',
  reduceMotion = false,
  className = '',
}) => {
  const effectivePrefs: Spatial3DPrefs = spatialPrefs || {
    themeId,
    tiltIntensity: 'subtle',
    cardDensity: 'balanced',
  };

  const resolvedShape: AppShapeId =
    appShape ||
    (typeof document !== 'undefined'
      ? ((document.documentElement.dataset.appShape as AppShapeId) || 'geometric-glass')
      : 'geometric-glass');

  const { palette, orbs } = buildGradientMeshLayers(
    effectivePrefs,
    slideIndex,
    intensity
  );

  const isLight = !palette.isDark;
  const isEditorial = resolvedShape === 'swiss-editorial';

  const baseGradient = isLight
    ? `radial-gradient(120% 105% at 50% 0%, ${palette.bgSurface} 0%, ${palette.bgMain} 72%, ${palette.bgTableHeader} 100%)`
    : `radial-gradient(125% 110% at 50% 0%, color-mix(in srgb, ${palette.bgSurface} 82%, ${palette.bgMain}) 0%, ${palette.bgMain} 70%, #030408 100%)`;

  const renderShapePattern = () => {
    if (resolvedShape === 'sharp-monolith') {
      return (
        <pattern
          id="morrowArchitecturalMeshGrid"
          width="64"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 64 0 L 0 0 0 64"
            fill="none"
            stroke={palette.accent}
            strokeOpacity={isLight ? '0.16' : '0.26'}
            strokeWidth="0.85"
          />
          <path
            d="M 0 32 L 64 32 M 32 0 L 32 64"
            fill="none"
            stroke={palette.secondary}
            strokeOpacity={isLight ? '0.09' : '0.14'}
            strokeWidth="0.5"
          />
          <rect
            x="30"
            y="30"
            width="4"
            height="4"
            fill={palette.accentBright}
            fillOpacity="0.4"
          />
        </pattern>
      );
    }

    if (resolvedShape === 'royal-octagram') {
      return (
        <pattern
          id="morrowArchitecturalMeshGrid"
          width="80"
          height="80"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="40,4 76,40 40,76 4,40"
            fill="none"
            stroke={palette.accent}
            strokeOpacity={isLight ? '0.15' : '0.25'}
            strokeWidth="0.7"
          />
          <rect
            x="16"
            y="16"
            width="48"
            height="48"
            fill="none"
            stroke={palette.secondary}
            strokeOpacity={isLight ? '0.08' : '0.14'}
            strokeWidth="0.55"
          />
          <circle
            cx="40"
            cy="40"
            r="2"
            fill={palette.accentBright}
            fillOpacity="0.48"
          />
        </pattern>
      );
    }

    if (resolvedShape === 'swiss-editorial') {
      return (
        <pattern
          id="morrowArchitecturalMeshGrid"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="14"
            cy="14"
            r="0.9"
            fill={palette.accent}
            fillOpacity={isLight ? '0.22' : '0.26'}
          />
        </pattern>
      );
    }

    if (resolvedShape === 'floating-capsule') {
      return (
        <pattern
          id="morrowArchitecturalMeshGrid"
          width="84"
          height="84"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="42"
            cy="42"
            r="26"
            fill="none"
            stroke={palette.accent}
            strokeOpacity={isLight ? '0.12' : '0.2'}
            strokeWidth="0.65"
            strokeDasharray="4 6"
          />
          <circle
            cx="42"
            cy="42"
            r="10"
            fill="none"
            stroke={palette.secondary}
            strokeOpacity={isLight ? '0.08' : '0.14'}
            strokeWidth="0.5"
          />
        </pattern>
      );
    }

    return (
      <pattern
        id="morrowArchitecturalMeshGrid"
        width="72"
        height="72"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 72 0 L 0 0 0 72"
          fill="none"
          stroke={palette.accent}
          strokeOpacity={isLight ? '0.13' : '0.22'}
          strokeWidth="0.65"
        />
        <path
          d="M 0 36 L 72 36 M 36 0 L 36 72"
          fill="none"
          stroke={palette.secondary}
          strokeOpacity={isLight ? '0.07' : '0.11'}
          strokeWidth="0.45"
          strokeDasharray="2 4"
        />
        <circle
          cx="36"
          cy="36"
          r="1.1"
          fill={palette.accentBright}
          fillOpacity="0.4"
        />
      </pattern>
    );
  };

  return (
    <div
      data-testid="gradient-mesh-backdrop"
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      {/* 1. Adaptive Atmospheric Base */}
      <div
        className="absolute inset-0 transition-colors duration-300"
        style={{ background: baseGradient }}
      />

      {/* 2. Compositor-Friendly Radial Caustic Orbs */}
      {!isEditorial && (
        <div className="absolute inset-0 pointer-events-none">
          {orbs.map((orb, idx) => (
            <div
              key={orb.id}
              className={`absolute rounded-full ${orb.sizeClass} ${
                reduceMotion ? '' : idx % 2 === 0 ? 'ambient-orb-drift-a' : 'ambient-orb-drift-b'
              }`}
              style={{
                ...orb.initialPos,
                background: orb.gradient,
                opacity: isLight ? orb.opacity * 0.42 : orb.opacity,
              }}
            />
          ))}
        </div>
      )}

      {/* 3. Shape-Matched Static Architectural SVG Mesh */}
      <div
        className={`absolute inset-0 ${isEditorial ? 'opacity-[0.14]' : isLight ? 'opacity-[0.12]' : 'opacity-[0.18]'}`}
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>{renderShapePattern()}</defs>
          <rect width="100%" height="100%" fill="url(#morrowArchitecturalMeshGrid)" />
        </svg>
      </div>
    </div>
  );
};
