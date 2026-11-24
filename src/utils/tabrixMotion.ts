import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion, type Variants } from 'motion/react';
import type { AppView } from '../types/agency';

/* ─── Tabrix Motion Physics Constants ─────────────────────────────────────── */
export const TABRIX_EASE = [0.22, 1, 0.36, 1] as const;
export const TABRIX_EXIT_EASE = [0.4, 0, 0.85, 0.35] as const;

export const TABRIX_SPRING = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 30,
  mass: 0.85,
};

export const TABRIX_TACTILE_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 28,
  mass: 0.65,
};

export const TABRIX_3D_SPRING = {
  type: 'spring' as const,
  stiffness: 270,
  damping: 26,
  mass: 0.9,
};

/* ─── Spatial Route Topology (RTL-Aware Directional Axis) ─────────────────── */
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

/* ─── Tabrix 3D Framer Motion Variants ────────────────────────────────────── */

/**
 * Primary route / page enter-exit 3D spatial transition.
 * `custom` = direction (1 forward, -1 backward). RTL-natural horizontal glide + subtle 3D depth arc.
 */
export const TABRIX_PAGE_VARIANTS: Variants = {
  initial: (dir: number = 1) => ({
    opacity: 0,
    x: dir * -28,
    y: 10,
    scale: 0.986,
    rotateY: dir * -2.2,
    rotateX: 1.4,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotateY: 0,
    rotateX: 0,
    transition: {
      duration: 0.3,
      ease: TABRIX_EASE,
    },
  },
  exit: (dir: number = 1) => ({
    opacity: 0,
    x: dir * 22,
    y: -6,
    scale: 0.988,
    rotateY: dir * 1.6,
    rotateX: -1,
    transition: {
      duration: 0.16,
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
    x: dir * -18,
    y: 8,
    scale: 0.99,
    rotateX: 1.2,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      duration: 0.24,
      ease: TABRIX_EASE,
    },
  },
  exit: (dir: number = 1) => ({
    opacity: 0,
    x: dir * 14,
    y: -4,
    scale: 0.992,
    transition: {
      duration: 0.14,
      ease: TABRIX_EXIT_EASE,
    },
  }),
};

/**
 * FullScreenPushPage & Drawer 3D spatial depth push enter/exit.
 */
export const TABRIX_PUSH_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.976,
    rotateX: 2.2,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      duration: 0.28,
      ease: TABRIX_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: 14,
    scale: 0.98,
    rotateX: -1.4,
    transition: {
      duration: 0.17,
      ease: TABRIX_EXIT_EASE,
    },
  },
};

/**
 * Floating Modal / Privacy Lock / Sync Overlay 3D card pop enter/exit.
 */
export const TABRIX_MODAL_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 16,
    scale: 0.94,
    rotateX: 4,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: TABRIX_3D_SPRING,
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.96,
    rotateX: -2,
    transition: {
      duration: 0.15,
      ease: TABRIX_EXIT_EASE,
    },
  },
};

/**
 * TopBar Popovers & Floating Menus 3D unfold.
 */
export const TABRIX_POPOVER_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    rotateX: -4,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      duration: 0.2,
      ease: TABRIX_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.965,
    transition: {
      duration: 0.13,
      ease: TABRIX_EXIT_EASE,
    },
  },
};

/**
 * Toast Notifications 3D spring pop-in/out.
 */
export const TABRIX_TOAST_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 18,
    scale: 0.92,
    rotateX: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: TABRIX_TACTILE_SPRING,
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.94,
    transition: {
      duration: 0.16,
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

/* ─── GPU-Smooth rAF Pointer-Tracked 3D Tilt Hook ─────────────────────────── */
export interface Tabrix3DTiltOptions {
  maxTiltX?: number;
  maxTiltY?: number;
  disabled?: boolean;
}

export function useTabrix3DTilt<T extends HTMLElement = HTMLElement>({
  maxTiltX = 5.4,
  maxTiltY = 6.6,
  disabled = false,
}: Tabrix3DTiltOptions = {}) {
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
        const rx = ((0.5 - ny) * maxTiltX).toFixed(2);
        const ry = ((nx - 0.5) * maxTiltY).toFixed(2);
        el.style.setProperty('--card-mx', `${(nx * 100).toFixed(1)}%`);
        el.style.setProperty('--card-my', `${(ny * 100).toFixed(1)}%`);
        el.style.setProperty('--card-rx', `${rx}deg`);
        el.style.setProperty('--card-ry', `${ry}deg`);
      });
    },
    [disabled, maxTiltX, maxTiltY]
  );

  const onMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = elementRef.current;
    if (!el) return;
    el.style.setProperty('--card-rx', '0deg');
    el.style.setProperty('--card-ry', '0deg');
  }, []);

  return {
    tiltRef: elementRef,
    tiltHandlers: {
      onMouseMove,
      onMouseLeave,
    },
  };
}
