import React from 'react';

interface MotifProps {
  className?: string;
  size?: number;
}

/**
 * Crisp 2D Architectural Morrow Prism Crest inside calibrated concentric vector rings.
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
        <stop offset="0%" stopColor="var(--accent-bright, #86FFDE)" />
        <stop offset="52%" stopColor="var(--accent, #10E0A6)" />
        <stop offset="100%" stopColor="var(--spatial-secondary, #22D3EE)" />
      </linearGradient>
      <linearGradient id="marineRingGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-bright, #86FFDE)" stopOpacity="0.88" />
        <stop offset="100%" stopColor="var(--spatial-secondary, #22D3EE)" stopOpacity="0.28" />
      </linearGradient>
    </defs>

    {/* Outer calibrated orbital ring */}
    <circle
      cx="32"
      cy="32"
      r="27"
      stroke="url(#marineRingGrad)"
      strokeWidth="1.2"
      strokeDasharray="6 3"
    />
    {/* Precision cardinal reticle ticks */}
    <path
      d="M32 2V7M32 57V62M2 32H7M57 32H62"
      stroke="var(--accent-bright, #86FFDE)"
      strokeOpacity="0.55"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    {/* Inner geometric precision ring */}
    <circle
      cx="32"
      cy="32"
      r="21"
      stroke="url(#marineCrestGrad)"
      strokeWidth="1"
      strokeOpacity="0.48"
    />
    {/* Chamfered obsidian prism core */}
    <polygon
      points="32,11 49,21 49,43 32,53 15,43 15,21"
      fill="var(--bg-surface, #091326)"
      stroke="url(#marineCrestGrad)"
      strokeWidth="1.4"
    />
    {/* Top specular facet */}
    <polygon
      points="32,14 45.5,22 32,30 18.5,22"
      fill="var(--accent-bright, #86FFDE)"
      fillOpacity="0.16"
    />
    {/* Sleek Morrow M-visor geometric core */}
    <path
      d="M21 40V25.5L32 34L43 25.5V40L38.5 37V31.5L32 36.5L25.5 31.5V37L21 40Z"
      fill="url(#marineCrestGrad)"
    />
    {/* Luminous neural optical core node */}
    <circle cx="32" cy="22" r="2.1" fill="var(--accent-bright, #86FFDE)" />
    <circle cx="32" cy="22" r="4" stroke="var(--accent, #10E0A6)" strokeOpacity="0.45" strokeWidth="1" />
  </svg>
);

export const MorrowCoreCrest = GeometricRavenCrest;

/**
 * Pure 2D Architectural Hexagonal Prism Emblem for Workspace Studio & Onboarding anchors.
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
        <stop offset="0%" stopColor="var(--accent, #10B981)" stopOpacity="0.88" />
        <stop offset="100%" stopColor="var(--accent-deep, #047857)" stopOpacity="0.95" />
      </linearGradient>
      <linearGradient id="marineCubeRight" x1="60" y1="38" x2="100" y2="104" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-deep, #047857)" stopOpacity="0.82" />
        <stop offset="100%" stopColor="var(--bg-main, #040B14)" stopOpacity="0.96" />
      </linearGradient>
    </defs>

    {/* Outer calibrated circular reticle */}
    <circle
      cx="60"
      cy="60"
      r="52"
      stroke="var(--accent, #10B981)"
      strokeOpacity="0.28"
      strokeWidth="1"
      strokeDasharray="6 4"
    />
    {/* Secondary geometric hex boundary */}
    <polygon
      points="60,12 102,36 102,84 60,108 18,84 18,36"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeOpacity="0.25"
      strokeWidth="1"
    />
    {/* Top specular face */}
    <polygon
      points="60,20 93,39 60,58 27,39"
      fill="url(#marineCubeTop)"
      fillOpacity="0.9"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeWidth="1.15"
    />
    {/* Left geometric facet */}
    <polygon
      points="27,39 60,58 60,98 27,79"
      fill="url(#marineCubeLeft)"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeOpacity="0.5"
      strokeWidth="1.05"
    />
    {/* Right deep facet */}
    <polygon
      points="93,39 60,58 60,98 93,79"
      fill="url(#marineCubeRight)"
      stroke="var(--accent, #10B981)"
      strokeOpacity="0.5"
      strokeWidth="1.05"
    />
    {/* Inner precision node */}
    <circle
      cx="60"
      cy="58"
      r="5"
      fill="var(--bg-main, #040B14)"
      stroke="var(--accent-bright, #6EE7B7)"
      strokeWidth="1.25"
    />
    <circle cx="60" cy="58" r="2" fill="var(--accent-bright, #6EE7B7)" />
  </svg>
);

export const GeometricMarinePrism = GeometricGoldCube;

/**
 * Crisp 2D architectural dot-matrix texture for smoked glass surfaces.
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
