import { useEffect, useState } from 'react';

export const DELAYED_LOADER_THRESHOLD_MS = 5000;

export interface TimerDriver {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout> | null) => void;
}

const DEFAULT_TIMER_DRIVER: TimerDriver = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => {
    if (id !== null) {
      globalThis.clearTimeout(id);
    }
  },
};

export interface DelayedLoaderSnapshot {
  visible: boolean;
  label: string;
  activeCount: number;
}

export interface DelayedLoadingController {
  startLoadingWith5SecDelay: (showLoaderFn: () => void) => void;
  finishLoading: (hideLoaderFn: () => void) => void;
  beginTask: (label?: string) => string;
  endTask: (token: string) => void;
  reset: () => void;
  getSnapshot: () => DelayedLoaderSnapshot;
  subscribe: (listener: (snapshot: DelayedLoaderSnapshot) => void) => () => void;
}

const DEFAULT_LOADING_LABEL = 'جاري المعالجة وتجهيز البيانات...';

/**
 * Creates an isolated delayed loading controller enforcing the strict 5000ms threshold:
 * - Starts a 5000ms timer (`timer5Sec`) when loading begins.
 * - Cancels `timer5Sec` immediately if loading finishes before 5000ms (loader never appears).
 * - Reveals the loader at 5000ms if still loading, and hides smoothly on completion.
 */
export function createDelayedLoadingController(
  delayMs: number = DELAYED_LOADER_THRESHOLD_MS,
  timers: TimerDriver = DEFAULT_TIMER_DRIVER
): DelayedLoadingController {
  let timer5Sec: ReturnType<typeof setTimeout> | null = null;
  let visible = false;
  let seq = 0;
  const activeTasks = new Map<string, string>();
  const listeners = new Set<(snapshot: DelayedLoaderSnapshot) => void>();

  const currentLabel = (): string => {
    let latest = DEFAULT_LOADING_LABEL;
    for (const val of activeTasks.values()) {
      if (val.trim()) latest = val;
    }
    return latest;
  };

  const getSnapshot = (): DelayedLoaderSnapshot => ({
    visible,
    label: currentLabel(),
    activeCount: activeTasks.size,
  });

  const emit = () => {
    const snap = getSnapshot();
    listeners.forEach((listener) => {
      listener(snap);
    });
  };

  function startLoadingWith5SecDelay(showLoaderFn: () => void): void {
    timers.clearTimeout(timer5Sec);
    timer5Sec = null;
    timer5Sec = timers.setTimeout(() => {
      timer5Sec = null;
      showLoaderFn();
    }, delayMs);
  }

  function finishLoading(hideLoaderFn: () => void): void {
    timers.clearTimeout(timer5Sec);
    timer5Sec = null;
    hideLoaderFn();
  }

  const showGlobal = () => {
    if (activeTasks.size === 0) return;
    if (!visible) {
      visible = true;
      emit();
    }
  };

  const hideGlobal = () => {
    if (visible) {
      visible = false;
      emit();
    }
  };

  const beginTask = (label?: string): string => {
    seq += 1;
    const token = `delayed_task_${seq}`;
    const wasIdle = activeTasks.size === 0;
    activeTasks.set(token, label?.trim() || DEFAULT_LOADING_LABEL);

    if (wasIdle) {
      startLoadingWith5SecDelay(showGlobal);
    } else if (visible) {
      emit();
    }

    return token;
  };

  const endTask = (token: string): void => {
    if (!activeTasks.has(token)) return;
    activeTasks.delete(token);

    if (activeTasks.size === 0) {
      finishLoading(hideGlobal);
    } else if (visible) {
      emit();
    }
  };

  const reset = (): void => {
    activeTasks.clear();
    finishLoading(hideGlobal);
  };

  const subscribe = (
    listener: (snapshot: DelayedLoaderSnapshot) => void
  ): (() => void) => {
    listeners.add(listener);
    listener(getSnapshot());
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    startLoadingWith5SecDelay,
    finishLoading,
    beginTask,
    endTask,
    reset,
    getSnapshot,
    subscribe,
  };
}

let timer5Sec: ReturnType<typeof setTimeout> | null = null;

/**
 * Standalone direct helper matching the canonical 5000ms timer contract.
 */
export function startLoadingWith5SecDelay(showLoaderFn: () => void): void {
  clearTimeout(timer5Sec ?? undefined);
  timer5Sec = setTimeout(() => {
    timer5Sec = null;
    showLoaderFn();
  }, DELAYED_LOADER_THRESHOLD_MS);
}

/**
 * Standalone direct helper cancelling any active 5000ms timer and hiding the loader.
 */
export function finishLoading(hideLoaderFn: () => void): void {
  clearTimeout(timer5Sec ?? undefined);
  timer5Sec = null;
  hideLoaderFn();
}

const globalDelayedController = createDelayedLoadingController(
  DELAYED_LOADER_THRESHOLD_MS
);

/**
 * Starts tracking an async loading operation. Returns a cleanup `finish()` function.
 */
export function startDelayedLoading(label?: string): () => void {
  const token = globalDelayedController.beginTask(label);
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    globalDelayedController.endTask(token);
  };
}

/**
 * Wraps any Promise or async callback with automatic 5-second delayed loading tracking.
 */
export async function trackDelayedLoading<T>(
  task: Promise<T> | (() => Promise<T>),
  label?: string
): Promise<T> {
  const finish = startDelayedLoading(label);
  try {
    return await (typeof task === 'function' ? task() : task);
  } finally {
    finish();
  }
}

/**
 * React hook binding a boolean busy state into the unified 5-second delayed loader.
 */
export function useDelayedLoading(active: boolean, label?: string): void {
  useEffect(() => {
    if (!active) return;
    const finish = startDelayedLoading(label);
    return () => {
      finish();
    };
  }, [active, label]);
}

/**
 * Subscribes a UI overlay component to the global delayed loader snapshot.
 */
export function useDelayedLoadingState(): DelayedLoaderSnapshot {
  const [snapshot, setSnapshot] = useState<DelayedLoaderSnapshot>(() =>
    globalDelayedController.getSnapshot()
  );

  useEffect(() => {
    return globalDelayedController.subscribe(setSnapshot);
  }, []);

  return snapshot;
}

export function resetGlobalDelayedLoaderForTests(): void {
  globalDelayedController.reset();
}
