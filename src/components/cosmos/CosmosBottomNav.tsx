import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  AnimatePresence,
  motion,
  useAnimation,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import {
  Bot,
  Home,
  PlusCircle,
  ScanLine,
  Search,
  Settings,
  Table2,
} from 'lucide-react';
import type { AppView, SettingsSectionId } from '../../types/agency';
import { playTactileFeedback } from '../../utils/tactileFeedback';

export interface FloatingNavItem {
  key: string;
  label: string;
  icon: (props: { className?: string; strokeWidth?: number }) => React.ReactNode;
  badge?: number;
  onLongPress?: () => void;
}

export interface FloatingGlassBottomNavProps {
  items: FloatingNavItem[];
  activeKey?: string;
  activeIndex?: number;
  onChange: (key: string, index: number) => void;
  hiddenByScroll?: boolean;
  showHomeIndicator?: boolean;
  showLabels?: boolean;
  ariaLabel?: string;
  className?: string;
}

const BADGE_DIAMETER = 44;
const BADGE_REST_TOP = -10; // Protrudes 10px upward above the 60px pill top edge

const INDICATOR_SPRING = {
  stiffness: 380,
  damping: 26,
  mass: 0.8,
};

const TAP_SPRING = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

/**
 * Reusable floating pill-shaped glassmorphic bottom navigation bar
 * with velocity-coupled spring physics, distance-aware ballistic arc,
 * synchronized glass specular lighting, and sub-pixel RTL/LTR alignment.
 */
export const FloatingGlassBottomNav: React.FC<FloatingGlassBottomNavProps> = ({
  items,
  activeKey,
  activeIndex,
  onChange,
  hiddenByScroll = false,
  showHomeIndicator = true,
  showLabels = true,
  ariaLabel = 'شريط التنقل العائم',
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const holdTimerRef = useRef<number | null>(null);
  const prevActiveIndexRef = useRef<number>(-1);
  const lastMeasuredIndexRef = useRef<number>(-1);
  const hasInitializedXRef = useRef(false);

  const [badgeX, setBadgeX] = useState<number | null>(null);
  const [reTapNonce, setReTapNonce] = useState(0);
  const [pulseNonce, setPulseNonce] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const arcControls = useAnimation();

  const resolvedIndex =
    typeof activeIndex === 'number'
      ? activeIndex >= 0 && activeIndex < items.length
        ? activeIndex
        : -1
      : activeKey
      ? items.findIndex((item) => item.key === activeKey)
      : -1;

  const activeItem = resolvedIndex >= 0 ? items[resolvedIndex] : null;

  const isReducedMotionActive = Boolean(
    prefersReducedMotion ||
      (typeof document !== 'undefined' &&
        document.documentElement.dataset.reduceMotion === '1')
  );

  // Continuous spring-driven horizontal motion value & velocity coupling
  const rawX = useMotionValue(0);
  const springX = useSpring(rawX, INDICATOR_SPRING);
  const velocityX = useVelocity(springX);

  // Real-time aerodynamic liquid deformation & lift coupled to horizontal velocity
  const aeroScaleX = useTransform(
    velocityX,
    [-1600, 0, 1600],
    isReducedMotionActive ? [1, 1, 1] : [1.14, 1, 1.14]
  );
  const aeroScaleY = useTransform(
    velocityX,
    [-1600, 0, 1600],
    isReducedMotionActive ? [1, 1, 1] : [0.91, 1, 0.91]
  );
  const aeroLiftY = useTransform(
    velocityX,
    [-1400, 0, 1400],
    isReducedMotionActive ? [0, 0, 0] : [-6.5, 0, -6.5]
  );
  const aeroTilt = useTransform(
    velocityX,
    [-1600, 0, 1600],
    isReducedMotionActive ? [0, 0, 0] : [-5, 0, 5]
  );

  const measureBadgePosition = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl || resolvedIndex < 0) {
      setBadgeX(null);
      return;
    }
    const targetTab = tabRefs.current[resolvedIndex];
    if (!targetTab) return;

    const containerRect = containerEl.getBoundingClientRect();
    const tabRect = targetTab.getBoundingClientRect();
    if (containerRect.width === 0 || tabRect.width === 0) return;

    const targetLeft =
      tabRect.left - containerRect.left + (tabRect.width - BADGE_DIAMETER) / 2;

    const indexChanged = lastMeasuredIndexRef.current !== resolvedIndex;
    lastMeasuredIndexRef.current = resolvedIndex;

    if (!hasInitializedXRef.current || isReducedMotionActive || !indexChanged) {
      hasInitializedXRef.current = true;
      rawX.jump(targetLeft);
      springX.jump(targetLeft);
    } else {
      rawX.set(targetLeft);
    }

    setBadgeX(targetLeft);
  }, [resolvedIndex, isReducedMotionActive, rawX, springX]);

  useLayoutEffect(() => {
    measureBadgePosition();
  }, [measureBadgePosition, items.length]);

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measureBadgePosition())
        : null;
    ro?.observe(containerEl);
    window.addEventListener('resize', measureBadgePosition, { passive: true });
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => measureBadgePosition());
    }
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureBadgePosition);
    };
  }, [measureBadgePosition]);

  // Distance-aware ballistic pop-up arc + concentric arrival pulse
  useEffect(() => {
    if (resolvedIndex < 0 || badgeX === null) {
      prevActiveIndexRef.current = resolvedIndex;
      return;
    }

    const prevIdx = prevActiveIndexRef.current;
    prevActiveIndexRef.current = resolvedIndex;

    if (prevIdx === -1) {
      return;
    }

    if (isReducedMotionActive) {
      arcControls.set({ y: 0, scale: 1 });
      return;
    }

    if (prevIdx !== resolvedIndex) {
      const distance = Math.abs(resolvedIndex - prevIdx);
      const peakLift = distance >= 3 ? -12 : distance === 2 ? -9.5 : -7;
      const peakScale = distance >= 3 ? 1.08 : 1.055;
      const duration = distance >= 3 ? 0.46 : distance === 2 ? 0.41 : 0.35;

      setPulseNonce((n) => n + 1);
      void arcControls.start({
        y: [0, peakLift, 0],
        scale: [1, peakScale, 1],
        transition: {
          duration,
          times: [0, 0.38, 1],
          ease: [0.22, 1.28, 0.36, 1],
        },
      });
    } else if (reTapNonce > 0) {
      setPulseNonce((n) => n + 1);
      void arcControls.start({
        y: [0, -4.5, 0],
        scale: [1, 1.05, 1],
        transition: {
          duration: 0.32,
          times: [0, 0.42, 1],
          ease: [0.22, 1.28, 0.36, 1],
        },
      });
    }
  }, [resolvedIndex, badgeX, reTapNonce, arcControls, isReducedMotionActive]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const isRtl =
      containerRef.current &&
      typeof window !== 'undefined' &&
      window.getComputedStyle(containerRef.current).direction === 'rtl';
    const step =
      e.key === 'ArrowRight' ? (isRtl ? -1 : 1) : isRtl ? 1 : -1;
    const baseIdx = resolvedIndex >= 0 ? resolvedIndex : 0;
    const nextIdx = (baseIdx + step + items.length) % items.length;
    const targetItem = items[nextIdx];
    if (targetItem) {
      tabRefs.current[nextIdx]?.focus();
      onChange(targetItem.key, nextIdx);
    }
  };

  const isVisibleBadge = Boolean(activeItem && badgeX !== null);

  return (
    <nav
      aria-label={ariaLabel}
      className={`no-print fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav,35)] flex flex-col items-center justify-end px-3 pb-[max(0.45rem,env(safe-area-inset-bottom))] pointer-events-none transition-transform duration-300 ${
        hiddenByScroll ? 'translate-y-28' : 'translate-y-0'
      } ${className}`}
    >
      <div
        ref={containerRef}
        role="tablist"
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHoveredIdx(null)}
        className="pointer-events-auto relative h-[60px] w-[92%] max-w-[440px] rounded-full overflow-visible select-none"
      >
        {/* Separate clipped glassmorphic surface layer with synchronized internal optical glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface, #0A1726) 64%, #020812)',
            backdropFilter: 'blur(20px) saturate(165%)',
            WebkitBackdropFilter: 'blur(20px) saturate(165%)',
            border: '1px solid color-mix(in srgb, var(--accent-bright, #6EE7B7) 26%, rgba(255, 255, 255, 0.18))',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -1px 0 rgba(2, 10, 22, 0.55), 0 14px 32px -6px rgba(2, 10, 22, 0.65), 0 4px 14px -2px rgba(2, 10, 22, 0.35)',
          }}
        >
          {/* Gliding subsurface marine-emerald aura tracking the active orb */}
          {isVisibleBadge && (
            <motion.div
              style={{
                x: springX,
                left: (BADGE_DIAMETER - 92) / 2,
                top: -4,
                width: 92,
                height: 64,
                background:
                  'radial-gradient(circle at 50% 24%, color-mix(in srgb, var(--accent, #10B981) 36%, transparent) 0%, color-mix(in srgb, var(--accent-bright, #6EE7B7) 14%, transparent) 48%, transparent 74%)',
              }}
              className="pointer-events-none absolute"
            />
          )}

          {/* Gliding top rim specular highlight riding the 1px glass edge */}
          {isVisibleBadge && (
            <motion.div
              style={{
                x: springX,
                left: (BADGE_DIAMETER - 56) / 2,
                top: 0,
                width: 56,
                height: 1.5,
                background:
                  'linear-gradient(90deg, transparent 0%, var(--accent-bright, rgba(167, 243, 208, 0.9)) 50%, transparent 100%)',
              }}
              className="pointer-events-none absolute"
            />
          )}
        </div>

        {/* Non-clipped overlay layer for the velocity-coupled elevated emerald circle */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        >
          <AnimatePresence initial={false}>
            {isVisibleBadge && activeItem && (
              <motion.div
                key="elevated-active-indicator"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: isReducedMotionActive ? 0.01 : 0.18 }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: BADGE_REST_TOP,
                  width: BADGE_DIAMETER,
                  height: BADGE_DIAMETER,
                  x: springX,
                  y: aeroLiftY,
                  perspective: 900,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Arrival / re-tap geometric concentric ring pulse */}
                {pulseNonce > 0 && !isReducedMotionActive && (
                  <motion.span
                    key={`pulse-${pulseNonce}`}
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1.52, opacity: 0 }}
                    transition={{
                      duration: 0.46,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      border: '1.5px solid color-mix(in srgb, var(--accent-bright, #6EE7B7) 60%, transparent)',
                    }}
                  />
                )}

                <motion.div
                  animate={arcControls}
                  style={{
                    scaleX: aeroScaleX,
                    scaleY: aeroScaleY,
                    rotate: aeroTilt,
                    background:
                      'linear-gradient(145deg, color-mix(in srgb, var(--accent, #10B981) 82%, #ffffff 12%) 0%, var(--accent-deep, #065F46) 100%)',
                    border: '1.5px solid color-mix(in srgb, var(--accent-bright, #6EE7B7) 48%, transparent)',
                    boxShadow:
                      '0 10px 24px color-mix(in srgb, var(--accent, #10B981) 38%, transparent), 0 4px 10px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.34), inset 0 -2px 4px rgba(0, 0, 0, 0.28)',
                    color: 'var(--accent-fg, #021C16)',
                  }}
                  className="relative flex h-full w-full items-center justify-center rounded-full"
                >
                  {/* Precision inner bezel ring + top specular arc */}
                  <span
                    className="pointer-events-none absolute inset-[3px] rounded-full"
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                    }}
                  />
                  <span
                    className="pointer-events-none absolute inset-x-3 top-[2px] h-[1px] rounded-full"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-bright, #A7F3D0) 75%, #ffffff), transparent)',
                    }}
                  />

                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={activeItem.key}
                      initial={
                        isReducedMotionActive
                          ? { opacity: 1, scale: 1 }
                          : { opacity: 0, scale: 0.82 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        isReducedMotionActive
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.82 }
                      }
                      transition={{
                        duration: isReducedMotionActive ? 0.01 : 0.2,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                      className="relative z-10 flex items-center justify-center"
                    >
                      {activeItem.icon({
                        className: 'h-[21px] w-[21px]',
                        strokeWidth: 2,
                      })}
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Equal-width interactive navigation items */}
        <div
          className="relative z-10 grid h-full w-full items-center px-1"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, idx) => {
            const isActive = idx === resolvedIndex;
            const isHovered = hoveredIdx === idx && !isActive;

            const startHold = () => {
              if (!item.onLongPress) return;
              clearHoldTimer();
              holdTimerRef.current = window.setTimeout(() => {
                playTactileFeedback('success', { haptic: true });
                item.onLongPress?.();
                holdTimerRef.current = null;
              }, 460);
            };

            return (
              <button
                key={item.key}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onClick={() => {
                  playTactileFeedback('tap', {
                    haptic: true,
                    reduceMotion: isReducedMotionActive,
                  });
                  if (isActive) {
                    setReTapNonce((n) => n + 1);
                  }
                  onChange(item.key, idx);
                }}
                onContextMenu={
                  item.onLongPress
                    ? (e) => {
                        e.preventDefault();
                        playTactileFeedback('success', { haptic: true });
                        item.onLongPress?.();
                      }
                    : undefined
                }
                onTouchStart={startHold}
                onTouchEnd={clearHoldTimer}
                onTouchCancel={clearHoldTimer}
                className="relative flex h-full min-h-[44px] w-full flex-col items-center justify-center rounded-full focus-visible:outline-none cursor-pointer"
              >
                {/* Magnetic hover spotlight capsule on desktop/trackpad */}
                {isHovered && !isReducedMotionActive && (
                  <motion.span
                    layoutId="floating-nav-hover-spot"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1.5 inset-y-1.5 rounded-full"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                  />
                )}

                {/* Base icon slot yields seamlessly when active so zero double-icon overlaps */}
                <motion.span
                  aria-hidden="true"
                  whileTap={
                    !isActive && !isReducedMotionActive
                      ? { scale: 0.9 }
                      : undefined
                  }
                  transition={TAP_SPRING}
                  animate={{
                    opacity: isActive ? 0 : 1,
                    scale: isActive ? 0.78 : isHovered ? 1.06 : 1,
                    y: isHovered && !isReducedMotionActive ? -2 : 0,
                  }}
                  className={`relative z-10 flex items-center justify-center ${
                    showLabels ? '-translate-y-[6px]' : ''
                  }`}
                  style={{
                    color: isHovered
                      ? 'rgba(255, 255, 255, 0.98)'
                      : 'rgba(245, 245, 245, 0.88)',
                  }}
                >
                  {item.icon({
                    className: 'h-[21px] w-[21px]',
                    strokeWidth: 1.85,
                  })}
                </motion.span>

                {showLabels && (
                  <motion.span
                    animate={{
                      y: isActive ? 0 : isHovered ? -0.5 : 0,
                      opacity: isActive ? 1 : isHovered ? 0.95 : 0.78,
                    }}
                    transition={{ duration: 0.18 }}
                    className="pointer-events-none absolute bottom-[5px] inset-x-1 truncate text-center text-[10px] leading-none"
                    style={{
                      color: isActive
                        ? 'var(--accent-bright, #A7F3D0)'
                        : 'rgba(245, 245, 245, 0.84)',
                      fontWeight: isActive ? 700 : 600,
                    }}
                  >
                    {item.label}
                  </motion.span>
                )}

                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className="absolute top-1.5 right-3 z-30 min-w-[16px] rounded-full px-1 text-center font-mono-num text-[9px] font-black leading-[15px]"
                    style={{
                      backgroundColor: 'var(--accent, #10B981)',
                      color: 'var(--accent-fg, #04271D)',
                      boxShadow: '0 2px 8px color-mix(in srgb, var(--accent, #10B981) 50%, transparent)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showHomeIndicator && (
        <div
          aria-hidden="true"
          className="mt-1.5 h-[4px] w-[120px] rounded-full pointer-events-none"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)' }}
        />
      )}
    </nav>
  );
};

interface CosmosBottomNavProps {
  activeView: AppView;
  canAddPerson: boolean;
  canUseQuickExtract: boolean;
  onNavigateView: (view: AppView, sec?: SettingsSectionId) => void;
  onQuickAddPerson: () => void;
  onOpenAssistant: () => void;
  onOpenCommandPalette: () => void;
  pendingDraftsCount?: number;
  isCenterActionActive?: boolean;
  isAssistantOpen?: boolean;
}

/**
 * Morrow Floating Glassmorphic Bottom Navigation Bar integrated with app routes.
 */
export const CosmosBottomNav: React.FC<CosmosBottomNavProps> = ({
  activeView,
  canAddPerson,
  canUseQuickExtract,
  onNavigateView,
  onQuickAddPerson,
  onOpenAssistant,
  onOpenCommandPalette,
  pendingDraftsCount = 0,
  isCenterActionActive = false,
  isAssistantOpen = false,
}) => {
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const lastScrollYRef = useRef(0);

  // Always reveal dock smoothly whenever route or modal context switches
  useEffect(() => {
    setHiddenByScroll(false);
  }, [activeView, isCenterActionActive, isAssistantOpen]);

  useEffect(() => {
    const onScroll = () => {
      const curY = window.scrollY || 0;
      const delta = curY - lastScrollYRef.current;
      if (curY < 60) {
        setHiddenByScroll(false);
      } else if (delta > 24) {
        setHiddenByScroll(true);
      } else if (delta < -10) {
        setHiddenByScroll(false);
      }
      lastScrollYRef.current = curY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const showSettingsSlot =
    !canUseQuickExtract ||
    activeView === 'settings' ||
    activeView === 'account_security';

  const items: FloatingNavItem[] = [
    {
      key: 'hub',
      label: 'الوكالات',
      icon: ({ className, strokeWidth }) => (
        <Home className={className} strokeWidth={strokeWidth} />
      ),
    },
    {
      key: 'master_roster',
      label: 'الجدول',
      icon: ({ className, strokeWidth }) => (
        <Table2 className={className} strokeWidth={strokeWidth} />
      ),
    },
    {
      key: 'center_action',
      label: canAddPerson ? 'إضافة' : 'بحث',
      icon: ({ className, strokeWidth }) =>
        canAddPerson ? (
          <PlusCircle className={className} strokeWidth={strokeWidth} />
        ) : (
          <Search className={className} strokeWidth={strokeWidth} />
        ),
      onLongPress: onOpenCommandPalette,
    },
    {
      key: 'morrow',
      label: 'Morrow',
      badge: pendingDraftsCount > 0 ? pendingDraftsCount : undefined,
      icon: ({ className, strokeWidth }) => (
        <Bot className={className} strokeWidth={strokeWidth} />
      ),
      onLongPress: () => onNavigateView('morrow_center'),
    },
    showSettingsSlot
      ? {
          key: 'settings',
          label: 'الإعدادات',
          icon: ({ className, strokeWidth }) => (
            <Settings className={className} strokeWidth={strokeWidth} />
          ),
          onLongPress: canUseQuickExtract
            ? () => onNavigateView('quick_extract')
            : undefined,
        }
      : {
          key: 'extract',
          label: 'السحب',
          icon: ({ className, strokeWidth }) => (
            <ScanLine className={className} strokeWidth={strokeWidth} />
          ),
          onLongPress: () => onNavigateView('settings'),
        },
  ];

  const resolvedActiveKey = isCenterActionActive
    ? 'center_action'
    : activeView === 'hub'
    ? 'hub'
    : activeView === 'master_roster' ||
      activeView === 'agency_roster' ||
      activeView === 'ready_lists' ||
      activeView === 'relationships' ||
      activeView === 'finance' ||
      activeView === 'data_archives'
    ? 'master_roster'
    : activeView === 'morrow_center' ||
      activeView === 'google_workspace' ||
      isAssistantOpen
    ? 'morrow'
    : activeView === 'quick_extract' && !showSettingsSlot
    ? 'extract'
    : showSettingsSlot &&
      (activeView === 'settings' || activeView === 'account_security')
    ? 'settings'
    : undefined;

  const handleSelect = (key: string) => {
    switch (key) {
      case 'hub':
        onNavigateView('hub');
        break;
      case 'master_roster':
        onNavigateView('master_roster');
        break;
      case 'center_action':
        if (canAddPerson) {
          onQuickAddPerson();
        } else {
          onOpenCommandPalette();
        }
        break;
      case 'morrow':
        onOpenAssistant();
        break;
      case 'extract':
        onNavigateView('quick_extract');
        break;
      case 'settings':
        onNavigateView('settings');
        break;
      default:
        break;
    }
  };

  return (
    <FloatingGlassBottomNav
      items={items}
      activeKey={resolvedActiveKey}
      onChange={handleSelect}
      hiddenByScroll={hiddenByScroll}
      showHomeIndicator={true}
      showLabels={true}
    />
  );
};
