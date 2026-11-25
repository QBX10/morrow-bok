import { useEffect, useState } from 'react';

export const DELAYED_LOADER_THRESHOLD_MS = 4000;
export const SIGNATURE_MIN_VISIBLE_MS = 900;

export type LoaderRevealMode = 'delayed' | 'immediate';

export interface LoaderTaskOptions {
  label?: string;
  subtitle?: string;
  mode?: LoaderRevealMode;
  minVisibleMs?: number;
}

export interface TimerDriver {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout> | null) => void;
  now?: () => number;
}

const DEFAULT_TIMER_DRIVER: TimerDriver = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => {
    if (id !== null) {
      globalThis.clearTimeout(id);
    }
  },
  now: () => Date.now(),
};

export interface DelayedLoaderSnapshot {
  visible: boolean;
  label: string;
  subtitle: string;
  mode: LoaderRevealMode;
  activeCount: number;
}

export interface DelayedLoadingController {
  startLoadingWith4SecDelay: (showLoaderFn: () => void) => void;
  startLoadingWith5SecDelay: (showLoaderFn: () => void) => void;
  finishLoading: (hideLoaderFn: () => void) => void;
  beginTask: (labelOrOptions?: string | LoaderTaskOptions) => string;
  endTask: (token: string) => void;
  reset: () => void;
  getSnapshot: () => DelayedLoaderSnapshot;
  subscribe: (listener: (snapshot: DelayedLoaderSnapshot) => void) => () => void;
}

const DEFAULT_LOADING_LABEL = 'جاري المعالجة وتجهيز البيانات...';
const DEFAULT_DELAYED_SUBTITLE =
  'تستغرق هذه العملية وقتاً أطول من المعتاد — لن تظهر النتيجة حتى تكتمل بأمان';
const DEFAULT_IMMEDIATE_SUBTITLE =
  'جاري التجهيز والتطبيق بأمان — ستظهر النتيجة فور الاكتمال';

function isReducedMotionActive(): boolean {
  if (
    typeof document !== 'undefined' &&
    document.documentElement?.dataset?.reduceMotion === '1'
  ) {
    return true;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

export function resolveDefaultSignatureMinMs(overrideMs?: number): number {
  if (typeof overrideMs === 'number') return Math.max(0, overrideMs);
  if (typeof window === 'undefined') return 0;
  if (isReducedMotionActive()) return 0;
  return SIGNATURE_MIN_VISIBLE_MS;
}

interface InternalTaskRecord {
  label: string;
  subtitle?: string;
  mode: LoaderRevealMode;
  minVisibleUntilMs: number;
}

/**
 * Creates an isolated delayed & milestone loading controller:
 * - Delayed tasks (`mode: 'delayed'`, default) enforce a strict 4000ms threshold:
 *   fast operations (< 4000ms) never show the overlay; slow operations (>= 4000ms)
 *   reveal the signature truck loader and hold until completion.
 * - Immediate milestone tasks (`mode: 'immediate'`) reveal the signature loader
 *   immediately with contextual Arabic title/subtitle and respect `minVisibleMs`.
 */
export function createDelayedLoadingController(
  delayMs: number = DELAYED_LOADER_THRESHOLD_MS,
  timers: TimerDriver = DEFAULT_TIMER_DRIVER
): DelayedLoadingController {
  const nowFn = timers.now ?? (() => Date.now());
  let timer4Sec: ReturnType<typeof setTimeout> | null = null;
  let visible = false;
  let seq = 0;
  const activeTasks = new Map<string, InternalTaskRecord>();
  const pendingEndTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<(snapshot: DelayedLoaderSnapshot) => void>();

  const pickDisplayTask = (): {
    label: string;
    subtitle: string;
    mode: LoaderRevealMode;
  } => {
    let latest: InternalTaskRecord | null = null;
    let latestImmediate: InternalTaskRecord | null = null;
    for (const task of activeTasks.values()) {
      latest = task;
      if (task.mode === 'immediate') {
        latestImmediate = task;
      }
    }
    const chosen = latestImmediate ?? latest;
    if (!chosen) {
      return {
        label: DEFAULT_LOADING_LABEL,
        subtitle: DEFAULT_DELAYED_SUBTITLE,
        mode: 'delayed',
      };
    }
    const fallbackSubtitle =
      chosen.mode === 'immediate'
        ? DEFAULT_IMMEDIATE_SUBTITLE
        : DEFAULT_DELAYED_SUBTITLE;
    return {
      label: chosen.label || DEFAULT_LOADING_LABEL,
      subtitle: chosen.subtitle?.trim() || fallbackSubtitle,
      mode: chosen.mode,
    };
  };

  const getSnapshot = (): DelayedLoaderSnapshot => {
    const picked = pickDisplayTask();
    return {
      visible,
      label: picked.label,
      subtitle: picked.subtitle,
      mode: picked.mode,
      activeCount: activeTasks.size,
    };
  };

  const emit = () => {
    const snap = getSnapshot();
    listeners.forEach((listener) => {
      listener(snap);
    });
  };

  function startLoadingWith4SecDelay(showLoaderFn: () => void): void {
    timers.clearTimeout(timer4Sec);
    timer4Sec = null;
    timer4Sec = timers.setTimeout(() => {
      timer4Sec = null;
      showLoaderFn();
    }, delayMs);
  }

  function finishLoading(hideLoaderFn: () => void): void {
    timers.clearTimeout(timer4Sec);
    timer4Sec = null;
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

  const finalizeEndTask = (token: string) => {
    const pendingTimer = pendingEndTimers.get(token);
    if (pendingTimer !== undefined) {
      timers.clearTimeout(pendingTimer);
      pendingEndTimers.delete(token);
    }
    if (!activeTasks.has(token)) return;
    activeTasks.delete(token);

    if (activeTasks.size === 0) {
      finishLoading(hideGlobal);
    } else if (visible) {
      emit();
    }
  };

  const beginTask = (labelOrOptions?: string | LoaderTaskOptions): string => {
    seq += 1;
    const token = `delayed_task_${seq}`;
    const opts: LoaderTaskOptions =
      typeof labelOrOptions === 'string'
        ? { label: labelOrOptions }
        : labelOrOptions || {};
    const mode: LoaderRevealMode = opts.mode || 'delayed';
    const minMs = Math.max(0, opts.minVisibleMs ?? 0);
    const wasIdle = activeTasks.size === 0;

    activeTasks.set(token, {
      label: opts.label?.trim() || DEFAULT_LOADING_LABEL,
      subtitle: opts.subtitle?.trim() || undefined,
      mode,
      minVisibleUntilMs: mode === 'immediate' && minMs > 0 ? nowFn() + minMs : 0,
    });

    if (mode === 'immediate') {
      timers.clearTimeout(timer4Sec);
      timer4Sec = null;
      if (!visible) {
        visible = true;
      }
      emit();
    } else if (wasIdle && !visible) {
      startLoadingWith4SecDelay(showGlobal);
    } else if (visible) {
      emit();
    }

    return token;
  };

  const endTask = (token: string): void => {
    const task = activeTasks.get(token);
    if (!task) return;
    if (pendingEndTimers.has(token)) return;

    if (
      visible &&
      task.mode === 'immediate' &&
      task.minVisibleUntilMs > 0
    ) {
      const remaining = task.minVisibleUntilMs - nowFn();
      if (remaining > 0) {
        const tId = timers.setTimeout(() => {
          pendingEndTimers.delete(token);
          finalizeEndTask(token);
        }, remaining);
        pendingEndTimers.set(token, tId);
        return;
      }
    }

    finalizeEndTask(token);
  };

  const reset = (): void => {
    pendingEndTimers.forEach((tId) => {
      timers.clearTimeout(tId);
    });
    pendingEndTimers.clear();
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
    startLoadingWith4SecDelay,
    startLoadingWith5SecDelay: startLoadingWith4SecDelay,
    finishLoading,
    beginTask,
    endTask,
    reset,
    getSnapshot,
    subscribe,
  };
}

let timer4Sec: ReturnType<typeof setTimeout> | null = null;

/**
 * Standalone direct helper matching the canonical 4000ms timer contract.
 */
export function startLoadingWith4SecDelay(showLoaderFn: () => void): void {
  clearTimeout(timer4Sec ?? undefined);
  timer4Sec = setTimeout(() => {
    timer4Sec = null;
    showLoaderFn();
  }, DELAYED_LOADER_THRESHOLD_MS);
}

/**
 * Backward-compatible alias for the 4000ms delayed loader trigger.
 */
export const startLoadingWith5SecDelay = startLoadingWith4SecDelay;

/**
 * Standalone direct helper cancelling any active 4000ms timer and hiding the loader.
 */
export function finishLoading(hideLoaderFn: () => void): void {
  clearTimeout(timer4Sec ?? undefined);
  timer4Sec = null;
  hideLoaderFn();
}

const globalDelayedController = createDelayedLoadingController(
  DELAYED_LOADER_THRESHOLD_MS
);

/**
 * Starts tracking a loading operation. Returns a cleanup `finish()` function.
 */
export function startDelayedLoading(
  labelOrOptions?: string | LoaderTaskOptions
): () => void {
  const token = globalDelayedController.beginTask(labelOrOptions);
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    globalDelayedController.endTask(token);
  };
}

/**
 * Starts an immediate milestone loader task with smooth minimum visibility.
 */
export function startSignatureLoading(
  label: string,
  subtitle?: string,
  minVisibleMs?: number
): () => void {
  return startDelayedLoading({
    label,
    subtitle,
    mode: 'immediate',
    minVisibleMs: resolveDefaultSignatureMinMs(minVisibleMs),
  });
}

/**
 * Wraps any Promise or async callback with automatic 4-second delayed loading tracking
 * (or immediate mode if configured in options).
 */
export async function trackDelayedLoading<T>(
  task: Promise<T> | (() => Promise<T>),
  labelOrOptions?: string | LoaderTaskOptions
): Promise<T> {
  const finish = startDelayedLoading(labelOrOptions);
  try {
    return await (typeof task === 'function' ? task() : task);
  } finally {
    finish();
  }
}

/**
 * Executes a milestone operation while displaying the signature truck loader immediately,
 * ensuring the loader completes its minimum animation before resolving so results
 * never flash prematurely.
 */
export async function runWithSignatureLoader<T>(
  options: {
    label: string;
    subtitle?: string;
    minVisibleMs?: number;
  },
  task: () => T | Promise<T>
): Promise<T> {
  const effectiveMinMs = resolveDefaultSignatureMinMs(options.minVisibleMs);
  const startedAt = Date.now();
  const finish = startDelayedLoading({
    label: options.label,
    subtitle: options.subtitle,
    mode: 'immediate',
    minVisibleMs: effectiveMinMs,
  });

  try {
    const result = await task();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, effectiveMinMs - elapsed);
    if (remaining > 0) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, remaining);
      });
    }
    return result;
  } finally {
    finish();
  }
}

/**
 * React hook binding a boolean busy state into the unified loader (4s delayed by default,
 * or immediate milestone mode when `options.immediate === true`).
 */
export function useDelayedLoading(
  active: boolean,
  label?: string,
  options?: {
    immediate?: boolean;
    subtitle?: string;
    minVisibleMs?: number;
  }
): void {
  const immediate = options?.immediate ?? false;
  const subtitle = options?.subtitle;
  const minVisibleMs = options?.minVisibleMs;

  useEffect(() => {
    if (!active) return;
    const finish = startDelayedLoading({
      label,
      subtitle,
      mode: immediate ? 'immediate' : 'delayed',
      minVisibleMs: immediate
        ? resolveDefaultSignatureMinMs(minVisibleMs)
        : 0,
    });
    return () => {
      finish();
    };
  }, [active, label, immediate, subtitle, minVisibleMs]);
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
