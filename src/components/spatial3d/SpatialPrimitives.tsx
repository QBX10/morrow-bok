import React, { useCallback, useRef, useState } from 'react';
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
 * - Optional pointer-tracking radial spotlight & subtle 3D perspective tilt
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
  const [spot, setSpot] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

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

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!spotlight && !tiltCfg.enabled) return;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;

      if (spotlight) {
        setSpot({
          x: Math.round(nx * 100),
          y: Math.round(ny * 100),
          active: true,
        });
      }

      if (tiltCfg.enabled) {
        const ry = (nx - 0.5) * 2 * tiltCfg.maxDeg;
        const rx = -(ny - 0.5) * 2 * tiltCfg.maxDeg;
        setTilt({
          rx: Number(rx.toFixed(2)),
          ry: Number(ry.toFixed(2)),
        });
      }
    },
    [spotlight, tiltCfg.enabled, tiltCfg.maxDeg]
  );

  const handlePointerLeave = useCallback(() => {
    setSpot((prev) => (prev.active ? { ...prev, active: false } : prev));
    if (tilt.rx !== 0 || tilt.ry !== 0) {
      setTilt({ rx: 0, ry: 0 });
    }
  }, [tilt.rx, tilt.ry]);

  return (
    <div
      ref={cardRef}
      data-testid={testId ?? dataTestId}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`glass-bento-card relative overflow-hidden rounded-[24px] transition-transform duration-200 ${
        elevated ? 'glass-bento-card-elevated' : ''
      } ${padClass} ${className}`}
      style={{
        transform:
          tiltCfg.enabled && spot.active
            ? `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(${tiltCfg.scaleHover}, ${tiltCfg.scaleHover}, 1)`
            : 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      }}
    >
      {/* Top 1px Fresnel specular bevel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.22) 32%, var(--accent-bright, #6EE7B7) 50%, rgba(255,255,255,0.18) 68%, transparent 95%)',
          opacity: elevated ? 0.78 : 0.45,
        }}
      />

      {/* Precision Geometric Corner Reticles for Elevated Architectural Cards */}
      {elevated && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t border-r rounded-tr-md opacity-45"
            style={{ borderColor: 'var(--accent-bright, #6EE7B7)' }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b border-l rounded-bl-md opacity-45"
            style={{ borderColor: 'var(--accent-bright, #6EE7B7)' }}
          />
        </>
      )}

      {/* Interactive pointer-tracking spotlight */}
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: spot.active ? 1 : 0,
            background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, ${
              accentGlow || 'var(--spatial-glow, rgba(16, 185, 129, 0.14))'
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
