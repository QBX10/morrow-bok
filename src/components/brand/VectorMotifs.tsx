import React from 'react';

interface MotifProps {
  className?: string;
  size?: number;
}

/**
 * 3D Faceted Marine Prism Crest inside interlocking oceanic orbital rings.
 */
export const GeometricRavenCrest: React.FC<MotifProps> = ({
  className = '',
  size = 44,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`marine-float-3d ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="marineCrestGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-bright, #6EE7B7)" />
        <stop offset="50%" stopColor="var(--accent, #10B981)" />
        <stop offset="100%" stopColor="var(--accent-deep, #047857)" />
      </linearGradient>
      <linearGradient id="marineRingGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-bright, #6EE7B7)" stopOpacity="0.82" />
        <stop offset="100%" stopColor="var(--accent, #10B981)" stopOpacity="0.2" />
      </linearGradient>
    </defs>

    {/* Outer oceanic orbital ring */}
    <circle
      cx="32"
      cy="32"
      r="27"
      stroke="url(#marineRingGrad)"
      strokeWidth="1.25"
      strokeDasharray="6 3"
    />
    {/* Interlocking tilted 3D gyro ring */}
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="14.5"
      transform="rotate(-24 32 32)"
      stroke="url(#marineCrestGrad)"
      strokeWidth="1.3"
      strokeOpacity="0.68"
    />
    {/* Chamfered abyssal prism core */}
    <polygon
      points="32,11 49,21 49,43 32,53 15,43 15,21"
      fill="var(--bg-surface, #0A1726)"
      stroke="url(#marineCrestGrad)"
      strokeWidth="1.35"
    />
    {/* Inner specular facet */}
    <polygon
      points="32,15 45,23 32,31 19,23"
      fill="var(--accent-bright, #6EE7B7)"
      fillOpacity="0.14"
    />
    {/* Stylized faceted geometric crest */}
    <path
      d="M21 40L28 24L35 19L44 21L38 25L41 32L32 42L21 40Z"
      fill="url(#marineCrestGrad)"
    />
    <path
      d="M28 24L35 28L32 42L25 36L28 24Z"
      fill="var(--bg-main, #040B14)"
      fillOpacity="0.38"
    />
    <circle cx="37.2" cy="22.4" r="1.2" fill="var(--bg-main, #040B14)" />
  </svg>
);

/**
 * 3D Isometric chamfered Marine Crystal Cube for Hero Header and Onboarding anchors.
 */
export const GeometricGoldCube: React.FC<MotifProps> = ({
  className = '',
  size = 112,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`marine-float-3d ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="marineCubeTop" x1="28" y1="16" x2="92" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-bright, #6EE7B7)" />
        <stop offset="100%" stopColor="var(--accent, #10B981)" />
      </linearGradient>
      <linearGradient id="marineCubeLeft" x1="20" y1="38" x2="60" y2="104" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent, #10B981)" stopOpacity="0.92" />
        <stop offset="100%" stopColor="var(--accent-deep, #047857)" stopOpacity="0.95" />
      </linearGradient>
      <linearGradient id="marineCubeRight" x1="60" y1="38" x2="100" y2="104" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-deep, #047857)" stopOpacity="0.82" />
        <stop offset="100%" stopColor="var(--bg-main, #040B14)" stopOpacity="0.96" />
      </linearGradient>
    </defs>

    {/* Outer oceanic halo polygon */}
    <polygon
      points="60,7 107,34 107,86 60,113 13,86 13,34"
      stroke="var(--accent, #10B981)"
      strokeOpacity="0.3"
      strokeWidth="1.15"
    />
    {/* Secondary orbital bevel ring */}
    <polygon
      points="60,13 101,37 101,83 60,107 19,83 19,37"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeOpacity="0.18"
      strokeWidth="0.9"
      strokeDasharray="4 3"
    />
    {/* Top specular face */}
    <polygon
      points="60,18 95,38 60,58 25,38"
      fill="url(#marineCubeTop)"
      fillOpacity="0.9"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeWidth="1.15"
    />
    {/* Left luminous face */}
    <polygon
      points="25,38 60,58 60,100 25,80"
      fill="url(#marineCubeLeft)"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeOpacity="0.5"
      strokeWidth="1.05"
    />
    {/* Right deep abyssal face */}
    <polygon
      points="95,38 60,58 60,100 95,80"
      fill="url(#marineCubeRight)"
      stroke="var(--accent, #10B981)"
      strokeOpacity="0.5"
      strokeWidth="1.05"
    />
    {/* Inner 3D suspended core prism */}
    <polygon
      points="60,31 79,42 60,53 41,42"
      fill="var(--bg-main, #040B14)"
      fillOpacity="0.28"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeOpacity="0.65"
      strokeWidth="0.9"
    />
    {/* Wireframe volumetric lattice */}
    <polyline
      points="42,28 77,48 77,90"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeOpacity="0.45"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
  </svg>
);

export const GeometricMarinePrism = GeometricGoldCube;

/**
 * Subtle geometric marine caustic dot-matrix pattern for 3D glass surfaces.
 */
export const DotMatrixPattern: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    className={className}
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <pattern
        id="marineCausticDotGrid"
        width="18"
        height="18"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="2" cy="2" r="1.05" fill="var(--accent, #10B981)" fillOpacity="0.28" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#marineCausticDotGrid)" />
  </svg>
);
