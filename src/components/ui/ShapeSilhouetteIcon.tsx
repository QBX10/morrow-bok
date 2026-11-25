import React from 'react';
import type { AppShapeId } from '../../types/agency';

interface ShapeSilhouetteIconProps {
  shapeId: AppShapeId;
  active?: boolean;
  className?: string;
}

export const ShapeSilhouetteIcon: React.FC<ShapeSilhouetteIconProps> = ({
  shapeId,
  active = false,
  className = 'w-11 h-8',
}) => {
  const stroke = active ? 'var(--accent)' : 'var(--text-muted)';
  const accent = active ? 'var(--accent-bright)' : 'var(--accent)';
  const fill = active ? 'var(--bg-nav-active)' : 'var(--surface-well)';

  if (shapeId === 'sharp-monolith') {
    return (
      <svg viewBox="0 0 48 34" className={className} aria-hidden="true" fill="none">
        <rect x="3" y="3" width="42" height="28" rx="1.5" fill={fill} stroke={stroke} strokeWidth="1.4" />
        <rect x="7" y="7" width="16" height="4" rx="0.5" fill={accent} opacity="0.9" />
        <rect x="7" y="14" width="34" height="2" rx="0.5" fill={stroke} opacity="0.45" />
        <rect x="7" y="19" width="22" height="6" rx="0.5" stroke={stroke} strokeWidth="1" opacity="0.7" />
        <rect x="32" y="19" width="9" height="6" rx="0.5" fill={accent} opacity="0.65" />
      </svg>
    );
  }

  if (shapeId === 'royal-octagram') {
    return (
      <svg viewBox="0 0 48 34" className={className} aria-hidden="true" fill="none">
        <polygon
          points="10,3 38,3 45,10 45,24 38,31 10,31 3,24 3,10"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.4"
        />
        <polygon
          points="12,6 36,6 42,12 42,22 36,28 12,28 6,22 6,12"
          stroke={accent}
          strokeWidth="0.8"
          opacity="0.65"
        />
        <polygon
          points="24,10 27,15 32,17 27,19 24,24 21,19 16,17 21,15"
          fill={accent}
          opacity="0.85"
        />
      </svg>
    );
  }

  if (shapeId === 'swiss-editorial') {
    return (
      <svg viewBox="0 0 48 34" className={className} aria-hidden="true" fill="none">
        <rect x="3" y="3" width="42" height="28" rx="4" fill={fill} stroke={stroke} strokeWidth="1.3" />
        <line x1="7" y1="9" x2="41" y2="9" stroke={accent} strokeWidth="2.2" />
        <line x1="7" y1="15" x2="29" y2="15" stroke={stroke} strokeWidth="1.4" opacity="0.65" />
        <line x1="7" y1="20" x2="36" y2="20" stroke={stroke} strokeWidth="1.1" opacity="0.4" />
        <circle cx="38" cy="24" r="2.2" fill={accent} />
        <circle cx="32" cy="24" r="1.4" fill={stroke} opacity="0.5" />
      </svg>
    );
  }

  if (shapeId === 'floating-capsule') {
    return (
      <svg viewBox="0 0 48 34" className={className} aria-hidden="true" fill="none">
        <rect x="9" y="2" width="30" height="5.5" rx="2.75" fill={accent} opacity="0.85" />
        <rect x="4" y="10.5" width="40" height="14" rx="7" fill={fill} stroke={stroke} strokeWidth="1.3" />
        <rect x="13" y="27" width="22" height="5" rx="2.5" stroke={accent} strokeWidth="1.1" opacity="0.75" />
        <circle cx="14" cy="17.5" r="2.5" fill={accent} opacity="0.8" />
        <rect x="20" y="16" width="17" height="3" rx="1.5" fill={stroke} opacity="0.45" />
      </svg>
    );
  }

  // default: geometric-glass
  return (
    <svg viewBox="0 0 48 34" className={className} aria-hidden="true" fill="none">
      <rect x="3" y="3" width="42" height="28" rx="7" fill={fill} stroke={stroke} strokeWidth="1.3" />
      <path d="M8 7H12M8 7V11" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M40 27H36M40 27V23" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
      <rect x="10" y="12" width="18" height="3.5" rx="1.75" fill={accent} opacity="0.85" />
      <rect x="10" y="18.5" width="28" height="2.5" rx="1.25" fill={stroke} opacity="0.4" />
    </svg>
  );
};
