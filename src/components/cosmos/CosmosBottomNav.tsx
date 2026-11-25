import React, { useEffect, useRef, useState } from 'react';
import { ListChecks, ScanLine, Table2, Wallet } from 'lucide-react';
import type { AppView, SettingsSectionId } from '../../types/agency';
import { useTabrixReducedMotion } from '../../utils/tabrixMotion';
import { playTactileFeedback } from '../../utils/tactileFeedback';
import { GeometricNeuralBrain } from '../brand/VectorMotifs';

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

const BADGE_DIAMETER = 52;
const BADGE_REST_TOP = -21; // Elevated cleanly above the 70px floating bar
const NOTCH_WIDTH = 84;
const NOTCH_HEIGHT = 26;
const SMOOTH_CUBIC = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Pure mathematical RTL/LTR slot placement for the raised golden indicator orb
 * and the liquid curved notch saddle.
 * Uses percentage-width carrier (`100% / totalItems`) + GPU `translate3d(±idx * 100%, 0, 0)`
 * so alignment is exact across every screen width, resize, and route change with zero DOM lag.
 */
export function computeBottomNavCarrierStyle(params: {
  activeIndex: number;
  totalItems: number;
  isRtl: boolean;
  reducedMotion?: boolean;
}): React.CSSProperties {
  const count = Math.max(1, params.totalItems);
  const idx = Math.max(0, Math.min(count - 1, params.activeIndex));
  const slotPct = 100 / count;
  const offsetPct = (params.isRtl ? -idx : idx) * 100;

  return {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: `${slotPct}%`,
    ...(params.isRtl ? { right: 0 } : { left: 0 }),
    transform: `translate3d(${offsetPct}%, 0, 0)`,
    willChange: 'transform',
    transition: params.reducedMotion
      ? 'none'
      : `transform 250ms ${SMOOTH_CUBIC}, opacity 220ms ${SMOOTH_CUBIC}`,
  };
}

/**
 * Reusable 70px floating bottom navigation bar with exact mathematical Liquid/Curved Notch,
 * elevated glowing gold orb, active Arabic label + underline bar, and pure GPU transform+opacity motion.
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
  const isReducedMotionActive = useTabrixReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const holdTimerRef = useRef<number | null>(null);

  const [isRtl, setIsRtl] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true;
    return document.documentElement.dir !== 'ltr';
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;
    const detected = window.getComputedStyle(el).direction !== 'ltr';
    setIsRtl((prev) => (prev === detected ? prev : detected));
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const resolvedIndex =
    typeof activeIndex === 'number'
      ? activeIndex >= 0 && activeIndex < items.length
        ? activeIndex
        : -1
      : activeKey
      ? items.findIndex((item) => item.key === activeKey)
      : -1;

  const activeItem = resolvedIndex >= 0 ? items[resolvedIndex] : null;
  const hasActiveTab = Boolean(activeItem && resolvedIndex >= 0);

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

  const carrierStyle = computeBottomNavCarrierStyle({
    activeIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
    totalItems: items.length,
    isRtl,
    reducedMotion: isReducedMotionActive,
  });

  const navHideStyle: React.CSSProperties = {
    transform: hiddenByScroll
      ? 'translate3d(0, 112px, 0)'
      : 'translate3d(0, 0, 0)',
    opacity: hiddenByScroll ? 0 : 1,
    willChange: 'transform, opacity',
    transition: isReducedMotionActive
      ? 'opacity 80ms linear'
      : `transform 250ms ${SMOOTH_CUBIC}, opacity 220ms ${SMOOTH_CUBIC}`,
  };

  return (
    <nav
      aria-label={ariaLabel}
      style={navHideStyle}
      className={`no-print pointer-events-none flex flex-col items-center justify-end ${className}`}
    >
      <div
        ref={containerRef}
        role="tablist"
        onKeyDown={handleKeyDown}
        className="pointer-events-auto relative h-[70px] w-[min(calc(100vw-88px),392px)] overflow-visible select-none"
      >
        {/* Clipped 70px floating bar glass layer + Gliding Liquid Curved Notch */}
        <div
          aria-hidden="true"
          className="cosmos-bottom-nav-shell pointer-events-none absolute inset-0 overflow-hidden"
        >
          {/* Subtle luxury Obsidian & Gold gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--accent-bright, var(--accent)) 9%, transparent) 0%, transparent 46%, color-mix(in srgb, var(--spatial-secondary, var(--accent)) 7%, transparent) 100%), linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 52%, rgba(2, 10, 22, 0.1) 100%)',
            }}
          />

          {/* Mathematically aligned carrier for ambient gold glow & curved notch saddle */}
          {hasActiveTab && (
            <div style={carrierStyle} className="pointer-events-none">
              {/* Soft pooled gold glow centered inside the active slot */}
              <div
                className="pointer-events-none absolute top-[-2px] left-1/2 h-[58px] w-[92px]"
                style={{
                  transform: 'translate3d(-50%, 0, 0)',
                  background:
                    'radial-gradient(circle at 50% 24%, color-mix(in srgb, var(--accent, #D4AF37) 34%, transparent) 0%, color-mix(in srgb, var(--accent-bright, #EED278) 12%, transparent) 48%, transparent 74%)',
                }}
              />

              {/* Liquid / Curved Notch SVG Saddle dead-center over active tab */}
              <div
                className="pointer-events-none absolute top-[-1px] left-1/2 z-10"
                style={{
                  width: NOTCH_WIDTH,
                  height: NOTCH_HEIGHT,
                  transform: 'translate3d(-50%, 0, 0)',
                }}
              >
                <svg
                  width={NOTCH_WIDTH}
                  height={NOTCH_HEIGHT}
                  viewBox={`0 0 ${NOTCH_WIDTH} ${NOTCH_HEIGHT}`}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0,0 L84,0 C71,0 66,23.5 42,23.5 C18,23.5 13,0 0,0 Z"
                    fill="var(--bg-main, #070708)"
                  />
                  <path
                    d="M2,1 C14.5,1 18.5,23.5 42,23.5 C65.5,23.5 69.5,1 82,1"
                    stroke="color-mix(in srgb, var(--accent-bright, #EED278) 56%, var(--border-color))"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Non-clipped overlay layer for the elevated glowing gold indicator orb */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        >
          {hasActiveTab && activeItem && (
            <div style={carrierStyle} className="pointer-events-none">
              <div
                data-testid="bottom-nav-active-orb"
                className="absolute left-1/2 flex items-center justify-center rounded-full"
                style={{
                  top: BADGE_REST_TOP,
                  width: BADGE_DIAMETER,
                  height: BADGE_DIAMETER,
                  transform: 'translate3d(-50%, 0, 0)',
                  willChange: 'transform',
                  background:
                    'linear-gradient(145deg, color-mix(in srgb, var(--accent-bright, #F4DC8A) 36%, var(--accent, #D4AF37)) 0%, var(--accent, #D4AF37) 52%, var(--accent-deep, #9F7F22) 100%)',
                  border:
                    '2px solid color-mix(in srgb, var(--accent-bright, #F4DC8A) 65%, transparent)',
                  boxShadow:
                    '0 0 0 4px color-mix(in srgb, var(--bg-main, #070708) 78%, transparent), 0 0 22px -2px color-mix(in srgb, var(--accent, #D4AF37) 55%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--accent, #D4AF37) 42%, transparent), var(--glass-specular-top, inset 0 1px 0 rgba(255, 255, 255, 0.35))',
                  color: 'var(--accent-fg, #090806)',
                }}
              >
                {/* Precision inner metallic bezel ring */}
                <span
                  className="pointer-events-none absolute inset-[2px] rounded-full"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                  }}
                />

                {/* Single clean active icon (no exiting overlapping duplicate) */}
                <span
                  key={activeItem.key}
                  className={`relative z-10 flex items-center justify-center ${
                    isReducedMotionActive ? '' : 'bottom-nav-orb-icon-enter'
                  }`}
                >
                  {activeItem.icon({
                    className: 'h-[21px] w-[21px]',
                    strokeWidth: 2.15,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Equal-width 4 navigation slots (zero horizontal padding offset for exact 25% alignment) */}
        <div
          className="relative z-10 grid h-full w-full items-center"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, idx) => {
            const isActive = idx === resolvedIndex;

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
                data-testid={`bottom-nav-tab-${item.key}`}
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  playTactileFeedback('nav', {
                    haptic: true,
                    sound: true,
                    reduceMotion: isReducedMotionActive,
                  });
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
                className="bottom-nav-tab relative flex h-full min-h-[44px] w-full flex-col items-center justify-center rounded-[14px] focus-visible:outline-none cursor-pointer"
                data-active={isActive ? '1' : '0'}
              >
                {/* Base icon transitions strictly via GPU transform & opacity */}
                <span
                  aria-hidden="true"
                  className="bottom-nav-tab-icon relative z-10 flex items-center justify-center"
                  style={{
                    opacity: isActive ? 0 : 1,
                    transform: isActive
                      ? 'translate3d(0, -14px, 0) scale(0.76)'
                      : showLabels
                      ? 'translate3d(0, -4px, 0) scale(1)'
                      : 'translate3d(0, 0, 0) scale(1)',
                  }}
                >
                  {item.icon({
                    className: 'h-[21px] w-[21px]',
                    strokeWidth: 1.85,
                  })}
                </span>

                {showLabels && (
                  <span
                    className="bottom-nav-tab-label pointer-events-none absolute bottom-[12px] inset-x-1 truncate text-center text-[11px] leading-none tracking-tight"
                    style={{
                      transform: isActive
                        ? 'translate3d(0, -3px, 0) scale(1.02)'
                        : 'translate3d(0, 2px, 0) scale(0.96)',
                      opacity: isActive ? 1 : 0.76,
                      color: isActive
                        ? 'var(--accent-bright, var(--accent))'
                        : 'var(--text-primary)',
                      fontWeight: isActive ? 800 : 600,
                    }}
                  >
                    {item.label}
                  </span>
                )}

                {/* Crisp active glowing gold underline indicator bar */}
                {showLabels && (
                  <span
                    aria-hidden="true"
                    className="bottom-nav-tab-bar pointer-events-none absolute bottom-[5px] h-[2.5px] w-4 rounded-full"
                    style={{
                      opacity: isActive ? 1 : 0,
                      transform: isActive
                        ? 'scaleX(1) translate3d(0, 0, 0)'
                        : 'scaleX(0.3) translate3d(0, 0, 0)',
                      backgroundColor: 'var(--accent, #D4AF37)',
                      boxShadow:
                        '0 0 8px color-mix(in srgb, var(--accent, #D4AF37) 65%, transparent)',
                    }}
                  />
                )}

                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className="absolute top-2 right-3 z-30 min-w-[16px] rounded-full px-1 text-center font-mono-num text-[9px] font-black leading-[15px]"
                    style={{
                      backgroundColor: 'var(--accent, #D4AF37)',
                      color: 'var(--accent-fg, #090806)',
                      boxShadow:
                        '0 2px 8px color-mix(in srgb, var(--accent, #D4AF37) 48%, transparent)',
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
          className="mt-1.5 h-[4px] w-[108px] rounded-full pointer-events-none md:hidden opacity-40"
          style={{ backgroundColor: 'var(--text-muted)' }}
        />
      )}
    </nav>
  );
};

interface CosmosBottomNavProps {
  activeView: AppView;
  onNavigateView: (view: AppView, sec?: SettingsSectionId) => void;
  onOpenAssistant: () => void;
  pendingDraftsCount?: number;
  isAssistantOpen?: boolean;
}

/**
 * Unified Obsidian & Gold Floating 4-Tab Bottom Dock + Standalone Morrow AI Brain Core Button.
 * RTL Order (Right -> Left): القوائم -> السجلات -> المحاسبة -> السحب, with Brain Core anchored on the left.
 */
export const CosmosBottomNav: React.FC<CosmosBottomNavProps> = ({
  activeView,
  onNavigateView,
  onOpenAssistant,
  pendingDraftsCount = 0,
  isAssistantOpen = false,
}) => {
  const isReducedMotionActive = useTabrixReducedMotion();
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setHiddenByScroll(false);
  }, [activeView, isAssistantOpen]);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const curY = window.scrollY || 0;
        const delta = curY - lastScrollYRef.current;
        if (curY < 60) {
          setHiddenByScroll((prev) => (prev ? false : prev));
        } else if (delta > 24) {
          setHiddenByScroll((prev) => (prev ? prev : true));
        } else if (delta < -10) {
          setHiddenByScroll((prev) => (prev ? false : prev));
        }
        lastScrollYRef.current = curY;
      });
    };
    const onResize = () => {
      setHiddenByScroll((prev) => (prev ? false : prev));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Strictly 4 unified main sections in RTL right-to-left order
  const items: FloatingNavItem[] = [
    {
      key: 'lists',
      label: 'القوائم',
      icon: ({ className, strokeWidth }) => (
        <ListChecks className={className} strokeWidth={strokeWidth} />
      ),
      onLongPress: () => onNavigateView('ready_lists'),
    },
    {
      key: 'records',
      label: 'السجلات',
      icon: ({ className, strokeWidth }) => (
        <Table2 className={className} strokeWidth={strokeWidth} />
      ),
      onLongPress: () => onNavigateView('relationships'),
    },
    {
      key: 'accounting',
      label: 'المحاسبة',
      icon: ({ className, strokeWidth }) => (
        <Wallet className={className} strokeWidth={strokeWidth} />
      ),
      onLongPress: () => onNavigateView('finance'),
    },
    {
      key: 'extract',
      label: 'السحب',
      icon: ({ className, strokeWidth }) => (
        <ScanLine className={className} strokeWidth={strokeWidth} />
      ),
      onLongPress: () => onNavigateView('settings'),
    },
  ];

  const resolvedActiveKey =
    activeView === 'hub' || activeView === 'ready_lists'
      ? 'lists'
      : activeView === 'master_roster' ||
        activeView === 'agency_roster' ||
        activeView === 'relationships' ||
        activeView === 'data_archives'
      ? 'records'
      : activeView === 'finance'
      ? 'accounting'
      : activeView === 'quick_extract'
      ? 'extract'
      : undefined;

  const isMorrowBrainActive =
    activeView === 'morrow_center' ||
    activeView === 'smart_models' ||
    isAssistantOpen;

  const handleSelect = (key: string) => {
    switch (key) {
      case 'lists':
        onNavigateView('hub');
        break;
      case 'records':
        onNavigateView('master_roster');
        break;
      case 'accounting':
        onNavigateView('finance');
        break;
      case 'extract':
        onNavigateView('quick_extract');
        break;
      default:
        break;
    }
  };

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav,35)] pointer-events-none flex items-center justify-center gap-2.5 px-2.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] lg:inset-x-auto lg:left-6 lg:bottom-6 lg:px-0 lg:pb-0">
      {/* 4-Section Floating Glass Navigation Bar (mobile/tablet) */}
      <FloatingGlassBottomNav
        items={items}
        activeKey={resolvedActiveKey}
        onChange={handleSelect}
        hiddenByScroll={hiddenByScroll}
        showHomeIndicator={true}
        showLabels={true}
        className="lg:hidden"
      />

      {/* Unified Brain Core (Morrow AI — العقل المدبر) Standalone Floating Capsule */}
      <button
        type="button"
        data-testid="dock-morrow-brain-btn"
        aria-label="المساعد الشخصي الذكي Morrow — عقل التطبيق"
        title="Morrow AI — العقل المدبر"
        aria-pressed={isMorrowBrainActive}
        onClick={() => {
          playTactileFeedback('app_open', {
            haptic: true,
            sound: true,
            reduceMotion: isReducedMotionActive,
          });
          onOpenAssistant();
        }}
        className="cosmos-bottom-orb pointer-events-auto relative flex mb-2 md:mb-0 h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px] border cursor-pointer overflow-visible"
        style={{
          transform: hiddenByScroll
            ? 'translate3d(0, 96px, 0)'
            : 'translate3d(0, 0, 0)',
          opacity: hiddenByScroll ? 0 : 1,
          willChange: 'transform, opacity',
          transition: isReducedMotionActive
            ? 'opacity 80ms linear'
            : `transform 250ms ${SMOOTH_CUBIC}, opacity 220ms ${SMOOTH_CUBIC}`,
          borderColor: isMorrowBrainActive
            ? 'var(--accent-bright, #F4DC8A)'
            : 'color-mix(in srgb, var(--accent, #D4AF37) 58%, var(--border-color))',
          background: isMorrowBrainActive
            ? 'linear-gradient(155deg, color-mix(in srgb, var(--accent) 28%, #15120D) 0%, #090806 100%)'
            : 'linear-gradient(155deg, color-mix(in srgb, var(--bg-table-header, #171410) 92%, var(--accent) 8%) 0%, color-mix(in srgb, var(--bg-main, #070708) 94%, transparent) 100%)',
          backdropFilter: 'blur(14px) saturate(155%)',
          WebkitBackdropFilter: 'blur(14px) saturate(155%)',
          boxShadow: isMorrowBrainActive
            ? 'inset 0 1px 0 rgba(255, 240, 195, 0.36), 0 0 28px -2px color-mix(in srgb, var(--accent, #D4AF37) 60%, transparent), var(--card-shadow, 0 14px 32px -14px rgba(0, 0, 0, 0.72))'
            : 'inset 0 1px 0 rgba(255, 240, 195, 0.24), inset 0 -1px 0 rgba(0, 0, 0, 0.55), 0 0 20px -4px color-mix(in srgb, var(--accent, #D4AF37) 36%, transparent), var(--card-shadow, 0 14px 32px -14px rgba(0, 0, 0, 0.72))',
        }}
      >
        {/* Calm Ambient Neural Pulse outer aura */}
        <span
          aria-hidden="true"
          className="ambient-neural-pulse-ring pointer-events-none absolute -inset-[5px] rounded-[24px]"
          style={{
            border:
              '1px solid color-mix(in srgb, var(--accent-bright, #F4DC8A) 45%, transparent)',
            boxShadow:
              '0 0 18px color-mix(in srgb, var(--accent, #D4AF37) 26%, transparent)',
          }}
        />

        {/* Luxury inner gold glass sheen */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent-bright, #F4DC8A) 20%, transparent) 0%, transparent 62%)',
          }}
        />

        {/* Bespoke Geometric Glowing-Gold Neural Brain Icon */}
        <GeometricNeuralBrain
          size={31}
          active={isMorrowBrainActive}
          className="relative z-10"
        />

        {/* Subtle golden badge for pending drafts awaiting review */}
        {pendingDraftsCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 z-20 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-mono-num text-[10px] font-black"
            style={{
              backgroundColor: 'var(--accent, #D4AF37)',
              color: 'var(--accent-fg, #090806)',
              boxShadow:
                '0 0 10px color-mix(in srgb, var(--accent, #D4AF37) 65%, transparent)',
            }}
          >
            {pendingDraftsCount}
          </span>
        )}
      </button>
    </div>
  );
};
