import React from 'react';

interface MotifProps {
  className?: string;
  size?: number;
}

/**
 * Custom metallic gold geometric raven emblem inside interlocking precision rings.
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
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="ravenGoldGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F3E5AB" />
        <stop offset="48%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#9A781C" />
      </linearGradient>
      <linearGradient id="ringSubtleGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="rgba(243,229,171,0.72)" />
        <stop offset="100%" stopColor="rgba(212,175,55,0.18)" />
      </linearGradient>
    </defs>

    {/* Outer geometric ring */}
    <circle
      cx="32"
      cy="32"
      r="27"
      stroke="url(#ringSubtleGrad)"
      strokeWidth="1.25"
      strokeDasharray="6 3"
    />
    {/* Interlocking inner tilted ring */}
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="15"
      transform="rotate(-24 32 32)"
      stroke="url(#ravenGoldGrad)"
      strokeWidth="1.2"
      strokeOpacity="0.6"
    />
    {/* Chamfered obsidian core */}
    <polygon
      points="32,12 48,22 48,42 32,52 16,42 16,22"
      fill="#121216"
      stroke="url(#ravenGoldGrad)"
      strokeWidth="1.25"
    />
    {/* Stylized faceted geometric raven silhouette */}
    <path
      d="M21 40L28 24L35 19L44 21L38 25L41 32L32 42L21 40Z"
      fill="url(#ravenGoldGrad)"
    />
    <path
      d="M28 24L35 28L32 42L25 36L28 24Z"
      fill="#09090B"
      fillOpacity="0.34"
    />
    <circle cx="37.2" cy="22.4" r="1.15" fill="#09090B" />
  </svg>
);

/**
 * 3D Isometric chamfered gold cube for Hero Header and Onboarding visual anchors.
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
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="cubeTop" x1="28" y1="16" x2="92" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F8ECC2" />
        <stop offset="100%" stopColor="#D4AF37" />
      </linearGradient>
      <linearGradient id="cubeLeft" x1="20" y1="38" x2="60" y2="104" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.88" />
        <stop offset="100%" stopColor="#6B5313" stopOpacity="0.92" />
      </linearGradient>
      <linearGradient id="cubeRight" x1="60" y1="38" x2="100" y2="104" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#B89228" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#262010" stopOpacity="0.95" />
      </linearGradient>
    </defs>

    {/* Outer halo polygon */}
    <polygon
      points="60,8 106,34 106,86 60,112 14,86 14,34"
      stroke="rgba(212, 175, 55, 0.25)"
      strokeWidth="1"
    />
    {/* Top face */}
    <polygon
      points="60,18 95,38 60,58 25,38"
      fill="url(#cubeTop)"
      fillOpacity="0.88"
      stroke="#F3E5AB"
      strokeWidth="1"
    />
    {/* Left face */}
    <polygon
      points="25,38 60,58 60,100 25,80"
      fill="url(#cubeLeft)"
      stroke="rgba(243, 229, 171, 0.45)"
      strokeWidth="1"
    />
    {/* Right face */}
    <polygon
      points="95,38 60,58 60,100 95,80"
      fill="url(#cubeRight)"
      stroke="rgba(212, 175, 55, 0.45)"
      strokeWidth="1"
    />
    {/* Inner wireframe lattice */}
    <polyline
      points="42,28 77,48 77,90"
      stroke="rgba(243, 229, 171, 0.35)"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
  </svg>
);

/**
 * Subtle geometric dot-matrix pattern for Obsidian glass cards.
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
        id="obsidianGoldDotGrid"
        width="18"
        height="18"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="2" cy="2" r="1" fill="rgba(212, 175, 55, 0.26)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#obsidianGoldDotGrid)" />
  </svg>
);
