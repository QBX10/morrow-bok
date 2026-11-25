import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  TABRIX_PAGE_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_SPRING,
  TABRIX_SUBVIEW_VARIANTS,
  useTabrix3DTilt,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface TabrixPageTransitionProps {
  viewKey: string;
  direction?: 1 | -1;
  className?: string;
  children: React.ReactNode;
}

/**
 * TabrixPageTransition — Primary route & full-view Framer Motion 3D Enter/Exit stage.
 * Uses directional spatial axis + GPU-only transforms inside a 1400px perspective canvas.
 */
export const TabrixPageTransition: React.FC<TabrixPageTransitionProps> = ({
  viewKey,
  direction = 1,
  className = '',
  children,
}) => {
  const reducedMotion = useTabrixReducedMotion();

  return (
    <div className="tabrix-3d-stage flex-1 min-w-0 flex flex-col">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={viewKey}
          custom={direction}
          variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_PAGE_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`flex-1 min-w-0 flex flex-col ${className}`}
          style={{ transformOrigin: '50% 45%' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

interface TabrixSubViewTransitionProps {
  viewKey: string;
  direction?: 1 | -1;
  className?: string;
  children: React.ReactNode;
}

/**
 * TabrixSubViewTransition — Silky Framer Motion Enter/Exit transition for sub-tabs,
 * workspace modes, and 4-level Settings capsule hierarchy.
 */
export const TabrixSubViewTransition: React.FC<TabrixSubViewTransitionProps> = ({
  viewKey,
  direction = 1,
  className = '',
  children,
}) => {
  const reducedMotion = useTabrixReducedMotion();

  return (
    <div className="tabrix-3d-stage w-full">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={viewKey}
          custom={direction}
          variants={
            reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_SUBVIEW_VARIANTS
          }
          initial="initial"
          animate="animate"
          exit="exit"
          className={className}
          style={{ transformOrigin: '50% 40%' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

interface Tabrix3DTiltSurfaceProps {
  as?: 'div' | 'article' | 'section' | 'button';
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
  maxTiltX?: number;
  maxTiltY?: number;
  disabled?: boolean;
  showSheen?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  'data-testid'?: string;
  children: React.ReactNode;
}

/**
 * Tabrix3DTiltSurface — Interactive 3D spatial tilt container with dynamic specular sheen.
 * Safely encapsulates useTabrix3DTilt for mapped grids & KPI cards.
 */
export const Tabrix3DTiltSurface: React.FC<Tabrix3DTiltSurfaceProps> = ({
  as = 'div',
  type = 'button',
  className = '',
  style,
  maxTiltX = 4.6,
  maxTiltY = 5.6,
  disabled = false,
  showSheen = true,
  onClick,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
  children,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const { tiltRef, tiltHandlers } = useTabrix3DTilt<HTMLElement>({
    maxTiltX,
    maxTiltY,
    disabled: disabled || reducedMotion,
  });

  const Tag = as;

  return (
    <Tag
      ref={tiltRef as React.RefObject<never>}
      type={as === 'button' ? type : undefined}
      {...tiltHandlers}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      className={`smart-dashboard-card nexus-squircle nexus-squircle-interactive relative overflow-hidden ${className}`}
      style={style}
    >
      {showSheen && (
        <span className="smart-dashboard-card-sheen" aria-hidden="true" />
      )}
      {children}
    </Tag>
  );
};

interface TabrixPillIndicatorProps {
  layoutId: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * TabrixPillIndicator — Shared-layout Framer Motion active tab/filter highlight.
 */
export const TabrixPillIndicator: React.FC<TabrixPillIndicatorProps> = ({
  layoutId,
  className = 'rounded-xl',
  style,
}) => {
  const reducedMotion = useTabrixReducedMotion();

  return (
    <motion.span
      layoutId={layoutId}
      transition={reducedMotion ? { duration: 0.05 } : TABRIX_SPRING}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundColor: 'var(--bg-nav-active)',
        border: '1px solid color-mix(in srgb, var(--accent) 46%, var(--border-color))',
        boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 18%, transparent)',
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

