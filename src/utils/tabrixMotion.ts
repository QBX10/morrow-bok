import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion, type Variants } from 'motion/react';
import type { AppView } from '../types/agency';

/* ─── Pure 2D Tabrix Spring & Easing Physics ──────────────────────────────── */
export const TABRIX_EASE = [0.22, 1, 0.36, 1] as const;
export const TABRIX_EXIT_EASE = [0.4, 0, 0.85, 0.35] as const;

export const TABRIX_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 28,
  mass: 0.8,
};

export const TABRIX_TACTILE_SPRING = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 26,
  mass: 0.65,
};

export const TABRIX_INDICATOR_SPRING = {
  type: 'spring' as const,
  stiffness: 390,
  damping: 29,
  mass: 0.78,
};

export const TABRIX_SMOOTH_SPRING = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 30,
  mass: 0.85,
};

export const TABRIX_BUTTON_HOVER = {
  y: -1.5,
  scale: 1.015,
};

export const TABRIX_BUTTON_TAP = {
  y: 0.5,
  scale: 0.96,
};

/* ─── Route Topology (RTL-Aware Directional Axis) ─────────────────────────── */
const VIEW_ORDER: Record<AppView, number> = {
  hub: 0,
  agency_roster: 1,
  master_roster: 2,
  ready_lists: 3,
  relationships: 4,
  finance: 5,
  quick_extract: 6,
  data_archives: 7,
  google_workspace: 8,
  morrow_center: 9,
  smart_models: 10,
  account_security: 11,
  settings: 12,
};

export function getTabrixViewOrder(view: AppView): number {
  return VIEW_ORDER[view] ?? 0;
}

export function getTabrixViewDirection(
  fromView: AppView,
  toView: AppView,
  fromAgencyId?: number,
  toAgencyId?: number
): 1 | -1 {
  if (
    fromView === 'agency_roster' &&
    toView === 'agency_roster' &&
    typeof fromAgencyId === 'number' &&
    typeof toAgencyId === 'number' &&
    fromAgencyId !== toAgencyId
  ) {
    return toAgencyId > fromAgencyId ? 1 : -1;
  }
  const fromIdx = getTabrixViewOrder(fromView);
  const toIdx = getTabrixViewOrder(toView);
  if (fromIdx === toIdx) return 1;
  return toIdx > fromIdx ? 1 : -1;
}

/* ─── Pure 2D 60fps Framer Motion Variants (Compositor-Only) ─────────────── */

/**
 * Primary route / page enter-exit 2D planar glide transition.
 */
export const TABRIX_PAGE_VARIANTS: Variants = {
  initial: (dir: number = 1) => ({
    opacity: 0,
    x: dir * -16,
    y: 6,
    scale: 0.994,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: TABRIX_EASE,
    },
  },
  exit: (dir: number = 1) => ({
    opacity: 0,
    x: dir * 12,
    y: -3,
    scale: 0.995,
    transition: {
      duration: 0.1,
      ease: TABRIX_EXIT_EASE,
    },
  }),
};

/**
 * In-page sub-view / tab / settings hierarchy level enter-exit transition.
 */
export const TABRIX_SUBVIEW_VARIANTS: Variants = {
  initial: (dir: number = 1) => ({
    opacity: 0,
    x: dir * -12,
    y: 4,
    scale: 0.994,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.17,
      ease: TABRIX_EASE,
    },
  },
  exit: (dir: number = 1) => ({
    opacity: 0,
    x: dir * 10,
    y: -2,
    scale: 0.995,
    transition: {
      duration: 0.09,
      ease: TABRIX_EXIT_EASE,
    },
  }),
};

/**
 * FullScreenPushPage & Drawer crisp 2D push enter/exit.
 */
export const TABRIX_PUSH_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 16,
    scale: 0.986,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.24,
      ease: TABRIX_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.988,
    transition: {
      duration: 0.15,
      ease: TABRIX_EXIT_EASE,
    },
  },
};

/**
 * Floating Modal / Privacy Lock / Sync Overlay 2D spring pop enter/exit.
 */
export const TABRIX_MODAL_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TABRIX_SPRING,
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.97,
    transition: {
      duration: 0.14,
      ease: TABRIX_EXIT_EASE,
    },
  },
};

/**
 * TopBar Popovers & Floating Menus crisp 2D unfold.
 */
export const TABRIX_POPOVER_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: -5,
    scale: 0.97,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: TABRIX_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -3,
    scale: 0.98,
    transition: {
      duration: 0.09,
      ease: TABRIX_EXIT_EASE,
    },
  },
};

/**
 * Toast Notifications 2D spring pop-in/out.
 */
export const TABRIX_TOAST_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 14,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TABRIX_SPRING,
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.96,
    transition: {
      duration: 0.14,
      ease: TABRIX_EXIT_EASE,
    },
  },
};

export const TABRIX_REDUCED_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.05 } },
  exit: { opacity: 0, transition: { duration: 0.05 } },
};

/* ─── Reactive Reduced Motion Hook ────────────────────────────────────────── */
export function useTabrixReducedMotion(): boolean {
  const osReduced = useReducedMotion();
  const [docReduced, setDocReduced] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.dataset.reduceMotion === '1';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => {
      setDocReduced(document.documentElement.dataset.reduceMotion === '1');
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduce-motion'],
    });
    return () => obs.disconnect();
  }, []);

  return Boolean(osReduced || docReduced);
}

/**
 * Pure render-safe directional tracker for Tabrix Enter/Exit transitions.
 */
export function useTabrixDirection<T>(
  value: T,
  compare: (prev: T, next: T) => 1 | -1
): 1 | -1 {
  const prevRef = useRef<T>(value);
  const dir: 1 | -1 =
    prevRef.current === value ? 1 : compare(prevRef.current, value);

  useEffect(() => {
    prevRef.current = value;
  }, [value]);

  return dir;
}

/**
 * Ordered key directional helper for multi-tab workspaces & hierarchies.
 */
export function useTabrixOrderedDirection(
  key: string,
  order: Record<string, number> | readonly string[]
): 1 | -1 {
  return useTabrixDirection(key, (prev, next) => {
    const getIndex = (k: string): number => {
      if (Array.isArray(order)) {
        const idx = order.indexOf(k);
        return idx >= 0 ? idx : 0;
      }
      return (order as Record<string, number>)[k] ?? 0;
    };
    return getIndex(next) >= getIndex(prev) ? 1 : -1;
  });
}

/* ─── GPU-Smooth rAF 2D Specular Spotlight Hook ──────────────────────────── */
export interface SurfaceSheen2DOptions {
  disabled?: boolean;
}

export function useSurfaceSheen2D<T extends HTMLElement = HTMLElement>({
  disabled = false,
}: SurfaceSheen2DOptions = {}) {
  const elementRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      if (disabled) return;
      const el = elementRef.current;
      if (!el) return;
      if (
        typeof document !== 'undefined' &&
        document.documentElement.dataset.reduceMotion === '1'
      ) {
        return;
      }
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        el.style.setProperty('--card-mx', `${(nx * 100).toFixed(1)}%`);
        el.style.setProperty('--card-my', `${(ny * 100).toFixed(1)}%`);
      });
    },
    [disabled]
  );

  const onMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = elementRef.current;
    if (!el) return;
    el.style.setProperty('--card-mx', '50%');
    el.style.setProperty('--card-my', '0%');
  }, []);

  return {
    surfaceRef: elementRef,
    surfaceHandlers: {
      onMouseMove,
      onMouseLeave,
    },
  };
}
