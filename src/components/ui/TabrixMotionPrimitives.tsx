import React from 'react';
import { motion } from 'motion/react';
import {
  TABRIX_BUTTON_HOVER,
  TABRIX_BUTTON_TAP,
  TABRIX_INDICATOR_SPRING,
  TABRIX_TACTILE_SPRING,
  useSurfaceSheen2D,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface TabrixPageTransitionProps {
  viewKey: string;
  direction?: 1 | -1;
  className?: string;
  children: React.ReactNode;
}

/**
 * TabrixPageTransition — Instantaneous non-blocking GPU route stage.
 * Uses compositor-only transform + opacity (`220ms cubic-bezier(0.22, 1, 0.36, 1)`)
 * with zero blocking exit-wait delay so bottom nav & view switching is immediate.
 */
export const TabrixPageTransition: React.FC<TabrixPageTransitionProps> = ({
  viewKey,
  className = '',
  children,
}) => {
  const reducedMotion = useTabrixReducedMotion();

  return (
    <div className="tabrix-2d-stage flex-1 min-w-0 flex flex-col">
      <div
        key={viewKey}
        className={`flex-1 min-w-0 flex flex-col ${
          reducedMotion ? '' : 'tabrix-route-instant-enter'
        } ${className}`}
      >
        {children}
      </div>
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
 * TabrixSubViewTransition — Instant GPU 2D transition for sub-tabs,
 * workspace modes, and Settings capsule hierarchy without exit-wait stalls.
 */
export const TabrixSubViewTransition: React.FC<TabrixSubViewTransitionProps> = ({
  viewKey,
  className = '',
  children,
}) => {
  const reducedMotion = useTabrixReducedMotion();

  return (
    <div className="tabrix-2d-stage w-full">
      <div
        key={viewKey}
        className={`${reducedMotion ? '' : 'tabrix-route-instant-enter'} ${className}`}
      >
        {children}
      </div>
    </div>
  );
};

interface MotionSurfaceCardProps {
  as?: 'div' | 'article' | 'section' | 'button';
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  showSheen?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  'data-testid'?: string;
  children: React.ReactNode;
}

/**
 * MotionSurfaceCard — Pure 2D interactive card container with calm hover lift and optional specular sheen.
 */
export const MotionSurfaceCard: React.FC<MotionSurfaceCardProps> = ({
  as = 'div',
  type = 'button',
  className = '',
  style,
  disabled = false,
  showSheen = true,
  onClick,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
  children,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const { surfaceRef, surfaceHandlers } = useSurfaceSheen2D<HTMLElement>({
    disabled: disabled || reducedMotion,
  });

  const Tag = as;

  return (
    <Tag
      ref={surfaceRef as React.RefObject<never>}
      type={as === 'button' ? type : undefined}
      {...surfaceHandlers}
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
      transition={reducedMotion ? { duration: 0.05 } : TABRIX_INDICATOR_SPRING}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{
        backgroundColor: 'var(--bg-nav-active)',
        border: '1px solid color-mix(in srgb, var(--accent) 46%, var(--border-color))',
        boxShadow:
          'inset 0 1px 0 color-mix(in srgb, var(--accent-bright, #fff) 22%, transparent), 0 4px 14px color-mix(in srgb, var(--accent) 18%, transparent)',
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

interface MotionActionButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.button>, 'ref'> {
  disableLift?: boolean;
}

/**
 * MotionActionButton — Tactile 2D spring button with smooth hover float and press settle.
 */
export const MotionActionButton: React.FC<MotionActionButtonProps> = ({
  disableLift = false,
  disabled,
  transition,
  whileHover,
  whileTap,
  className = '',
  children,
  ...rest
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const interactive = !disabled && !reducedMotion && !disableLift;

  return (
    <motion.button
      disabled={disabled}
      whileHover={interactive ? whileHover ?? TABRIX_BUTTON_HOVER : undefined}
      whileTap={!disabled && !reducedMotion ? whileTap ?? TABRIX_BUTTON_TAP : undefined}
      transition={transition ?? TABRIX_TACTILE_SPRING}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
};

