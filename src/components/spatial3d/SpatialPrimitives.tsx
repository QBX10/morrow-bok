import React, { useCallback, useEffect, useRef } from 'react';
import type { SpatialCardDensity, SpatialTiltIntensity } from '../../types/agency';
import { getDensityPaddingClass } from '../../utils/spatial3dConfig';

interface GlassBentoCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  tiltIntensity?: SpatialTiltIntensity;
  density?: SpatialCardDensity;
  spotlight?: boolean;
  accentGlow?: string;
  noPadding?: boolean;
  testId?: string;
  'data-testid'?: string;
}

/**
 * Pure 2D Multi-Layered Glassmorphic Bento Card:
 * - Smoked translucent surface with 1px directional specular rim
 * - Architectural corner brackets on elevated panels
 * - High-FPS rAF pointer-tracking radial spotlight (zero 3D skew, zero React re-renders)
 */
export const GlassBentoCard: React.FC<GlassBentoCardProps> = ({
  children,
  className = '',
  elevated = false,
  density,
  spotlight = true,
  accentGlow,
  noPadding = false,
  testId,
  'data-testid': dataTestId,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const resolvedDensity: SpatialCardDensity =
    density ||
    (typeof document !== 'undefined'
      ? ((document.documentElement.dataset.spatialDensity as SpatialCardDensity) || 'balanced')
      : 'balanced');

  const padClass = noPadding ? '' : getDensityPaddingClass(resolvedDensity);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!spotlight) return;
      const el = cardRef.current;
      if (!el) return;
      if (
        typeof document !== 'undefined' &&
        document.documentElement.dataset.reduceMotion === '1'
      ) {
        return;
      }

      const clientX = e.clientX;
      const clientY = e.clientY;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        el.style.setProperty('--spot-x', `${Math.round(nx * 100)}%`);
        el.style.setProperty('--spot-y', `${Math.round(ny * 100)}%`);
        el.style.setProperty('--spot-opacity', '1');
      });
    },
    [spotlight]
  );

  const handlePointerLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--spot-opacity', '0');
  }, []);

  return (
    <div
      ref={cardRef}
      data-testid={testId ?? dataTestId}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`glass-bento-card relative overflow-hidden rounded-[22px] ${
        elevated ? 'glass-bento-card-elevated' : ''
      } ${padClass} ${className}`}
    >
      {/* Top 1px Fresnel specular bevel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.24) 32%, var(--accent-bright, #86FFDE) 50%, rgba(255,255,255,0.2) 68%, transparent 95%)',
          opacity: elevated ? 0.85 : 0.48,
        }}
      />

      {/* Precision Geometric Corner Reticles for Elevated Architectural Cards */}
      {elevated && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t border-r rounded-tr-md opacity-45"
            style={{ borderColor: 'var(--accent-bright, #86FFDE)' }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b border-l rounded-bl-md opacity-45"
            style={{ borderColor: 'var(--accent-bright, #86FFDE)' }}
          />
        </>
      )}

      {/* Interactive rAF pointer-tracking spotlight */}
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: 'var(--spot-opacity, 0)' as unknown as number,
            background: `radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${
              accentGlow || 'var(--spatial-glow, rgba(16, 224, 166, 0.16))'
            }, transparent 68%)`,
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
};

interface RecessedChannelWellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Recessed Structural Well for numeric telemetry, metric housings, and segmented tabs.
 */
export const RecessedChannelWell: React.FC<RecessedChannelWellProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`recessed-well rounded-2xl border border-white/[0.06] ${className}`}
    >
      {children}
    </div>
  );
};

interface GeometricSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export const GeometricSectionHeader: React.FC<GeometricSectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  trailing,
  className = '',
}) => {
  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="geo-icon-socket w-11 h-11 shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-[var(--text-primary)] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="geo-subtitle text-xs truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      <div aria-hidden="true" className="laser-divider" />
    </div>
  );
};
