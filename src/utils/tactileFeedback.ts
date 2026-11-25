// Unified Web Audio Asset Profiles & Global Micro-Tactile Feedback Engine
import { duckBackgroundMusicForUi } from './backgroundMusicEngine';

export type TactileSoundKind =
  | 'tap'
  | 'menu_open'
  | 'menu_close'
  | 'nav'
  | 'app_open'
  | 'app_close'
  | 'toggle_on'
  | 'toggle_off'
  | 'type'
  | 'success'
  | 'warn'
  | 'undo'
  | 'redo'
  | 'cord_tick';

export interface AudioLayerSpec {
  type: OscillatorType;
  startFreq: number;
  endFreq?: number;
  peakGain: number;
  attackSec?: number;
  durationSec: number;
  delaySec?: number;
  rampMode?: 'exp' | 'linear';
  /** When true, base pitch overrides startFreq and scales endFreq proportionally */
  pitchSensitive?: boolean;
}

export interface AudioProfileAsset {
  id: TactileSoundKind;
  label: string;
  layers: AudioLayerSpec[];
}

/**
 * Unified Audio Assets / Profiles Registry synthesized via Web Audio API AudioContext.
 * Every UI interaction (clicks, menu open/close, page switches, app launches, toggles, typing)
 * maps to a distinct calibrated harmonic envelope.
 */
export const AUDIO_PROFILES: Record<TactileSoundKind, AudioProfileAsset> = {
  tap: {
    id: 'tap',
    label: 'Click / Tactile Tap',
    layers: [
      {
        type: 'sine',
        startFreq: 510,
        endFreq: 615,
        peakGain: 0.024,
        attackSec: 0.004,
        durationSec: 0.045,
        rampMode: 'exp',
      },
    ],
  },
  menu_open: {
    id: 'menu_open',
    label: 'Open Menu / Drawer',
    layers: [
      {
        type: 'sine',
        startFreq: 380,
        endFreq: 570,
        peakGain: 0.026,
        attackSec: 0.006,
        durationSec: 0.085,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 760,
        endFreq: 960,
        peakGain: 0.011,
        attackSec: 0.008,
        durationSec: 0.072,
        delaySec: 0.022,
        rampMode: 'exp',
      },
    ],
  },
  menu_close: {
    id: 'menu_close',
    label: 'Close Menu / Drawer',
    layers: [
      {
        type: 'sine',
        startFreq: 540,
        endFreq: 330,
        peakGain: 0.022,
        attackSec: 0.004,
        durationSec: 0.068,
        rampMode: 'exp',
      },
    ],
  },
  nav: {
    id: 'nav',
    label: 'Page / Route Transition',
    layers: [
      {
        type: 'sine',
        startFreq: 415,
        endFreq: 554.37,
        peakGain: 0.028,
        attackSec: 0.006,
        durationSec: 0.075,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 622.25,
        endFreq: 739.99,
        peakGain: 0.013,
        attackSec: 0.008,
        durationSec: 0.068,
        delaySec: 0.02,
        rampMode: 'exp',
      },
    ],
  },
  app_open: {
    id: 'app_open',
    label: 'Launch Applet / Workspace',
    layers: [
      {
        type: 'sine',
        startFreq: 440,
        endFreq: 587.33,
        peakGain: 0.032,
        attackSec: 0.008,
        durationSec: 0.125,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 659.25,
        endFreq: 880,
        peakGain: 0.02,
        attackSec: 0.01,
        durationSec: 0.145,
        delaySec: 0.035,
        rampMode: 'exp',
      },
    ],
  },
  app_close: {
    id: 'app_close',
    label: 'Dismiss Modal / Overlay',
    layers: [
      {
        type: 'sine',
        startFreq: 520,
        endFreq: 310,
        peakGain: 0.024,
        attackSec: 0.005,
        durationSec: 0.078,
        rampMode: 'exp',
      },
    ],
  },
  toggle_on: {
    id: 'toggle_on',
    label: 'Switch Enabled',
    layers: [
      {
        type: 'sine',
        startFreq: 420,
        endFreq: 720,
        peakGain: 0.028,
        attackSec: 0.004,
        durationSec: 0.055,
        rampMode: 'exp',
      },
    ],
  },
  toggle_off: {
    id: 'toggle_off',
    label: 'Switch Disabled',
    layers: [
      {
        type: 'sine',
        startFreq: 600,
        endFreq: 330,
        peakGain: 0.024,
        attackSec: 0.004,
        durationSec: 0.05,
        rampMode: 'exp',
      },
    ],
  },
  type: {
    id: 'type',
    label: 'Keystroke / Input Tick',
    layers: [
      {
        type: 'triangle',
        startFreq: 310,
        endFreq: 185,
        peakGain: 0.012,
        attackSec: 0.002,
        durationSec: 0.02,
        rampMode: 'exp',
      },
    ],
  },
  success: {
    id: 'success',
    label: 'Success Chime',
    layers: [
      {
        type: 'sine',
        startFreq: 523.25,
        endFreq: 659.25,
        peakGain: 0.03,
        attackSec: 0.006,
        durationSec: 0.085,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 659.25,
        endFreq: 783.99,
        peakGain: 0.028,
        attackSec: 0.008,
        durationSec: 0.12,
        delaySec: 0.055,
        rampMode: 'exp',
      },
    ],
  },
  warn: {
    id: 'warn',
    label: 'Warning / Error Pulse',
    layers: [
      {
        type: 'triangle',
        startFreq: 295,
        endFreq: 215,
        peakGain: 0.03,
        attackSec: 0.006,
        durationSec: 0.065,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 245,
        endFreq: 185,
        peakGain: 0.026,
        attackSec: 0.006,
        durationSec: 0.085,
        delaySec: 0.075,
        rampMode: 'exp',
      },
    ],
  },
  undo: {
    id: 'undo',
    label: 'Undo Sweep',
    layers: [
      {
        type: 'sine',
        startFreq: 540,
        endFreq: 360,
        peakGain: 0.026,
        attackSec: 0.005,
        durationSec: 0.068,
        rampMode: 'exp',
      },
    ],
  },
  redo: {
    id: 'redo',
    label: 'Redo Sweep',
    layers: [
      {
        type: 'sine',
        startFreq: 360,
        endFreq: 540,
        peakGain: 0.026,
        attackSec: 0.005,
        durationSec: 0.068,
        rampMode: 'exp',
      },
    ],
  },
  cord_tick: {
    id: 'cord_tick',
    label: 'Mechanical Pull-Cord Ratchet',
    layers: [
      {
        type: 'triangle',
        startFreq: 260,
        endFreq: 358,
        peakGain: 0.022,
        attackSec: 0.003,
        durationSec: 0.024,
        rampMode: 'exp',
        pitchSensitive: true,
      },
    ],
  },
};

let sharedAudioCtx: AudioContext | null = null;
let globalSoundEnabled = true;
let lastSoundPlayedMs = 0;
let lastKeyTickMs = 0;

export function setGlobalAppSoundEnabled(enabled: boolean): void {
  globalSoundEnabled = Boolean(enabled);
}

export function isGlobalAppSoundEnabled(): boolean {
  return globalSoundEnabled;
}

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new Ctx();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export async function resumeSharedAudioContext(): Promise<AudioContext | null> {
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    // Ignore autoplay restriction errors prior to first user gesture
  }
  return ctx;
}

function playSynthLayer(
  ctx: AudioContext,
  layer: AudioLayerSpec,
  frequencyPitch?: number
): void {
  const startAt = ctx.currentTime + (layer.delaySec ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = layer.type;

  let startFreq = layer.startFreq;
  let endFreq = layer.endFreq ?? layer.startFreq;
  if (layer.pitchSensitive && typeof frequencyPitch === 'number') {
    const clampedBase = Math.max(180, Math.min(680, frequencyPitch));
    const ratio = layer.startFreq > 0 ? endFreq / layer.startFreq : 1;
    startFreq = clampedBase;
    endFreq = clampedBase * ratio;
  }

  const safeStart = Math.max(20, startFreq);
  const safeEnd = Math.max(20, endFreq);

  osc.frequency.setValueAtTime(safeStart, startAt);
  if (safeEnd !== safeStart) {
    if (layer.rampMode === 'linear') {
      osc.frequency.linearRampToValueAtTime(safeEnd, startAt + layer.durationSec);
    } else {
      osc.frequency.exponentialRampToValueAtTime(
        safeEnd,
        startAt + layer.durationSec
      );
    }
  }

  const attack = Math.min(layer.attackSec ?? 0.008, layer.durationSec * 0.45);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(layer.peakGain, startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + layer.durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + layer.durationSec + 0.015);
}

function playAudioAsset(
  ctx: AudioContext,
  kind: TactileSoundKind,
  frequencyPitch?: number
): void {
  const profile = AUDIO_PROFILES[kind] ?? AUDIO_PROFILES.tap;
  for (const layer of profile.layers) {
    playSynthLayer(ctx, layer, frequencyPitch);
  }
}

export function playTactileFeedback(
  kind: TactileSoundKind = 'tap',
  options?: {
    haptic?: boolean;
    sound?: boolean;
    reduceMotion?: boolean;
    frequencyPitch?: number;
  }
): void {
  const prefersReducedMotion =
    Boolean(options?.reduceMotion) ||
    (typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));

  if (
    options?.haptic &&
    !prefersReducedMotion &&
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator
  ) {
    try {
      const pattern =
        kind === 'success' || kind === 'app_open'
          ? [8, 22, 10]
          : kind === 'warn'
          ? [16, 24, 16]
          : 6;
      navigator.vibrate(pattern);
    } catch {
      // ignore unsupported vibration environments
    }
  }

  const shouldPlaySound =
    options?.sound !== undefined ? options.sound : globalSoundEnabled;

  if (!shouldPlaySound || !globalSoundEnabled || typeof window === 'undefined') {
    return;
  }

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const nowMs =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Prevent harsh stacking while still allowing rapid cord ratchet ticks
    if (kind !== 'cord_tick') {
      lastSoundPlayedMs = nowMs;
    }

    if (kind !== 'cord_tick' && kind !== 'type') {
      duckBackgroundMusicForUi(
        kind === 'warn' ? 0.36 : 0.64,
        kind === 'warn' ? 280 : 150
      );
    }

    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => {
          playAudioAsset(ctx, kind, options?.frequencyPitch);
        })
        .catch(() => {
          // ignore autoplay restriction
        });
      return;
    }

    playAudioAsset(ctx, kind, options?.frequencyPitch);
  } catch {
    // ignore WebAudio restrictions
  }
}

/**
 * Pure cooldown guard preventing rapid focus+pointerdown double chimes on input fields.
 */
export function shouldFireTactileEvent(
  nowMs: number,
  lastFiredMs: number,
  cooldownMs = 85
): boolean {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastFiredMs)) return true;
  if (lastFiredMs <= 0) return true;
  return nowMs - lastFiredMs >= Math.max(0, cooldownMs);
}

function classifyInteractiveElementSound(el: HTMLElement): TactileSoundKind {
  const explicit = el.getAttribute('data-sound') as TactileSoundKind | null;
  if (explicit && explicit in AUDIO_PROFILES) return explicit;

  const role = el.getAttribute('role') || '';
  const testId = (el.getAttribute('data-testid') || '').toLowerCase();
  const hasPopup = el.getAttribute('aria-haspopup');
  const ariaExpanded = el.getAttribute('aria-expanded');
  const label = `${el.getAttribute('aria-label') || ''} ${
    el.getAttribute('title') || ''
  } ${el.textContent?.slice(0, 48) || ''}`.toLowerCase();

  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      return el.checked ? 'toggle_on' : 'toggle_off';
    }
    return 'type';
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return 'type';
  }

  if (role === 'switch' || role === 'checkbox') {
    const checked = el.getAttribute('aria-checked') === 'true';
    return checked ? 'toggle_on' : 'toggle_off';
  }

  if (
    hasPopup ||
    ariaExpanded !== null ||
    role === 'menuitem' ||
    testId.includes('menu') ||
    testId.includes('drawer') ||
    testId.includes('popover') ||
    label.includes('القائمة') ||
    label.includes('menu')
  ) {
    if (ariaExpanded === 'true') return 'menu_close';
    return 'menu_open';
  }

  if (
    label.includes('إغلاق') ||
    label.includes('close') ||
    testId.includes('close') ||
    testId.includes('cancel')
  ) {
    return 'app_close';
  }

  if (
    role === 'tab' ||
    el.closest('nav') ||
    el.closest('[role="tablist"]') ||
    testId.includes('nav') ||
    testId.includes('tab')
  ) {
    return 'nav';
  }

  if (
    testId.includes('hub-') ||
    testId.includes('world') ||
    testId.includes('agency') ||
    testId.includes('open') ||
    testId.includes('assistant') ||
    testId.includes('brain') ||
    el.closest('.galaxy-card') ||
    el.closest('.capsule-card')
  ) {
    return 'app_open';
  }

  return 'tap';
}

/**
 * Installs a lightweight global document listener so every button, menu, tab,
 * app launcher, toggle, modal, and input produces refined Web Audio feedback without
 * overlapping with explicit component cues.
 */
export function installGlobalAppSoundRouter(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onPointerDown = () => {
    void resumeSharedAudioContext();
  };

  const onClick = (ev: MouseEvent) => {
    if (!globalSoundEnabled) return;
    const rawTarget = ev.target;
    if (!(rawTarget instanceof HTMLElement)) return;

    const interactive = rawTarget.closest(
      'button, a, [role="tab"], [role="button"], [role="menuitem"], [role="switch"], [role="option"], [role="checkbox"], summary, input, textarea, select, [data-sound]'
    );
    if (!(interactive instanceof HTMLElement)) return;
    if (
      (interactive as HTMLButtonElement).disabled ||
      interactive.getAttribute('aria-disabled') === 'true'
    ) {
      return;
    }

    // Lamp pull-cord & shade manage their own mechanical Web Audio synthesizer
    const tid = interactive.getAttribute('data-testid') || '';
    if (tid.startsWith('lamp-')) return;

    const nowMs =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Skip fallback tap if an explicit component handler already played a sound on this click
    if (nowMs - lastSoundPlayedMs < 75) return;

    const kind = classifyInteractiveElementSound(interactive);
    playTactileFeedback(kind, { sound: true, haptic: false });
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (!globalSoundEnabled || ev.repeat) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;

    if (ev.key === 'Escape') {
      const nowMs =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (nowMs - lastSoundPlayedMs >= 80) {
        playTactileFeedback('menu_close', { sound: true, haptic: false });
      }
      return;
    }

    const isEditable =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;
    if (!isEditable) return;

    if (
      ev.key === 'Shift' ||
      ev.key === 'CapsLock' ||
      ev.key === 'Tab' ||
      ev.key === 'ArrowLeft' ||
      ev.key === 'ArrowRight' ||
      ev.key === 'ArrowUp' ||
      ev.key === 'ArrowDown'
    ) {
      return;
    }

    const nowMs =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - lastKeyTickMs < 55) return;
    lastKeyTickMs = nowMs;
    playTactileFeedback('type', { sound: true, haptic: false });
  };

  document.addEventListener('pointerdown', onPointerDown, {
    capture: true,
    passive: true,
  });
  document.addEventListener('click', onClick, { passive: true });
  document.addEventListener('keydown', onKeyDown, {
    capture: true,
    passive: true,
  });

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeyDown, { capture: true });
  };
}

let lampPadTimerId: number | null = null;
let lampPadActive = false;

export function stopLampAmbiencePad(): void {
  lampPadActive = false;
  if (lampPadTimerId !== null && typeof window !== 'undefined') {
    window.clearInterval(lampPadTimerId);
    lampPadTimerId = null;
  }
}

export function playLampHumAndChord(chord: number[]): void {
  stopLampAmbiencePad();
  if (!globalSoundEnabled || typeof window === 'undefined') return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;

  const triggerCycle = () => {
    if (!globalSoundEnabled || !lampPadActive) return;
    const activeCtx = getSharedAudioContext();
    if (!activeCtx) return;

    const runNotes = () => {
      if (!globalSoundEnabled || !lampPadActive) return;
      const now = activeCtx.currentTime;
      chord.forEach((freq, idx) => {
        if (!Number.isFinite(freq) || freq <= 0) return;
        const osc = activeCtx.createOscillator();
        const gain = activeCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.32);

        gain.gain.setValueAtTime(0.0005, now + idx * 0.32);
        gain.gain.linearRampToValueAtTime(0.018, now + 1.05 + idx * 0.32);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 4.9 + idx * 0.32);

        osc.connect(gain);
        gain.connect(activeCtx.destination);
        osc.start(now + idx * 0.32);
        osc.stop(now + 5.0 + idx * 0.32);
      });
    };

    if (activeCtx.state === 'suspended') {
      void activeCtx.resume().then(runNotes).catch(() => {});
    } else {
      runNotes();
    }
  };

  lampPadActive = true;

  const playWarmHum = () => {
    if (!globalSoundEnabled || !lampPadActive) return;
    const now = ctx.currentTime;
    const hum = ctx.createOscillator();
    const humGain = ctx.createGain();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(120, now + 0.04);
    humGain.gain.setValueAtTime(0.001, now);
    humGain.gain.linearRampToValueAtTime(0.048, now + 0.08);
    humGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    hum.connect(humGain);
    humGain.connect(ctx.destination);
    hum.start(now + 0.04);
    hum.stop(now + 0.36);
    triggerCycle();
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(playWarmHum).catch(() => {});
  } else {
    playWarmHum();
  }

  lampPadTimerId = window.setInterval(triggerCycle, 5200);
}
