import React, { useCallback, useEffect, useRef } from 'react';
import type { SpatialCardDensity, SpatialTiltIntensity } from '../../types/agency';
import { getDensityPaddingClass, getTiltConfig } from '../../utils/spatial3dConfig';

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
 * Layer 2 Multi-Layered 3D Glassmorphic Bento Card:
 * - Translucent surface with 1px directional specular bevel
 * - High-FPS rAF pointer-tracking radial spotlight & subtle 3D perspective tilt (zero React re-renders)
 */
export const GlassBentoCard: React.FC<GlassBentoCardProps> = ({
  children,
  className = '',
  elevated = false,
  tiltIntensity,
  density,
  spotlight = true,
  accentGlow,
  noPadding = false,
  testId,
  'data-testid': dataTestId,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const resolvedTilt: SpatialTiltIntensity =
    tiltIntensity ||
    (typeof document !== 'undefined'
      ? ((document.documentElement.dataset.spatialTilt as SpatialTiltIntensity) || 'subtle')
      : 'subtle');

  const resolvedDensity: SpatialCardDensity =
    density ||
    (typeof document !== 'undefined'
      ? ((document.documentElement.dataset.spatialDensity as SpatialCardDensity) || 'balanced')
      : 'balanced');

  const tiltCfg = getTiltConfig(resolvedTilt);
  const padClass = noPadding ? '' : getDensityPaddingClass(resolvedDensity);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!spotlight && !tiltCfg.enabled) return;
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

        if (spotlight) {
          el.style.setProperty('--spot-x', `${Math.round(nx * 100)}%`);
          el.style.setProperty('--spot-y', `${Math.round(ny * 100)}%`);
          el.style.setProperty('--spot-opacity', '1');
        }

        if (tiltCfg.enabled) {
          const ry = ((nx - 0.5) * 2 * tiltCfg.maxDeg).toFixed(2);
          const rx = (-(ny - 0.5) * 2 * tiltCfg.maxDeg).toFixed(2);
          el.style.setProperty('--tilt-rx', `${rx}deg`);
          el.style.setProperty('--tilt-ry', `${ry}deg`);
          el.style.setProperty('--tilt-scale', String(tiltCfg.scaleHover));
        }
      });
    },
    [spotlight, tiltCfg.enabled, tiltCfg.maxDeg, tiltCfg.scaleHover]
  );

  const handlePointerLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--spot-opacity', '0');
    el.style.setProperty('--tilt-rx', '0deg');
    el.style.setProperty('--tilt-ry', '0deg');
    el.style.setProperty('--tilt-scale', '1');
  }, []);

  return (
    <div
      ref={cardRef}
      data-testid={testId ?? dataTestId}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`glass-bento-card relative overflow-hidden rounded-[24px] ${
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
            background: `radial-gradient(440px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${
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
 * Layer 1 Recessed Structural Well for numeric telemetry, metric housings, and recessed controls.
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
            <div
              className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center border border-white/15"
              style={{
                background:
                  'radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--accent-bright) 28%, transparent), color-mix(in srgb, var(--bg-table-header) 92%, #020810))',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 20px -10px var(--spatial-glow, rgba(16,185,129,0.5))',
              }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-[var(--text-primary)] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs font-medium text-[var(--text-muted)] truncate mt-0.5">
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
