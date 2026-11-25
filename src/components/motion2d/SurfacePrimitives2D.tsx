import React, { useCallback, useEffect, useRef } from 'react';
import type { Motion2DIntensity, SurfaceCardDensity } from '../../types/agency';
import { getDensityPaddingClass } from '../../utils/surface2dConfig';

interface BentoCard2DProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  motionIntensity?: Motion2DIntensity;
  density?: SurfaceCardDensity;
  spotlight?: boolean;
  accentGlow?: string;
  noPadding?: boolean;
  testId?: string;
  'data-testid'?: string;
}

/**
 * Pure 2D Calm Bento Surface Card:
 * - Clean single-level surface with crisp 1px border
 * - Restrained top highlight line and smooth GPU pointer sheen
 */
export const BentoCard2D: React.FC<BentoCard2DProps> = ({
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

  const resolvedDensity: SurfaceCardDensity =
    density ||
    (typeof document !== 'undefined'
      ? ((document.documentElement.dataset.surfaceDensity as SurfaceCardDensity) || 'balanced')
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
      className={`glass-bento-card relative overflow-hidden rounded-[20px] ${
        elevated ? 'glass-bento-card-elevated' : ''
      } ${padClass} ${className}`}
    >
      {/* Top 1px subtle highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 8%, var(--accent-bright, #EED278) 50%, transparent 92%)',
          opacity: elevated ? 0.55 : 0.3,
        }}
      />

      {/* Interactive rAF 2D radial sheen */}
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: 'var(--spot-opacity, 0)' as unknown as number,
            background: `radial-gradient(380px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${
              accentGlow || 'var(--spatial-glow, rgba(212, 175, 55, 0.14))'
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
 * Clean matte recessed metric container.
 */
export const RecessedChannelWell: React.FC<RecessedChannelWellProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`recessed-well rounded-2xl border border-[var(--border-color)] ${className}`}
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
            <div className="geo-icon-socket w-10 h-10 shrink-0">
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
