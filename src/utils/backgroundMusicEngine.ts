export type MusicPauseReason =
  | 'live'
  | 'mic'
  | 'camera'
  | 'tts'
  | 'media'
  | 'alert'
  | 'tab_hidden';

export type BackgroundMusicPlaybackStatus =
  | 'playing'
  | 'paused_manual'
  | 'paused_auto'
  | 'awaiting_gesture'
  | 'muted';

export interface BackgroundMusicSnapshot {
  userPaused: boolean;
  volume: number;
  isPlaying: boolean;
  awaitingGesture: boolean;
  pauseReason: MusicPauseReason | null;
  pauseReasonLabel: string | null;
  status: BackgroundMusicPlaybackStatus;
  hasError: boolean;
}

const STORAGE_KEY = 'morrow_bg_music_prefs_v1';
const PRIMARY_SRC = '/assets/aistudio/bg-music_85f08a71.mp3';
const FALLBACK_SRC = '/bg-music.mp3';
const DEFAULT_VOLUME = 0.34;

const REASON_PRIORITY: MusicPauseReason[] = [
  'live',
  'mic',
  'camera',
  'tts',
  'media',
  'alert',
  'tab_hidden',
];

const REASON_LABELS: Record<MusicPauseReason, string> = {
  live: 'متوقفة مؤقتاً أثناء الجلسة الصوتية المباشرة',
  mic: 'متوقفة مؤقتاً أثناء استخدام الميكروفون',
  camera: 'متوقفة مؤقتاً أثناء تشغيل الكاميرا',
  tts: 'متوقفة مؤقتاً أثناء القراءة الصوتية',
  media: 'متوقفة مؤقتاً أثناء تشغيل صوت أو فيديو آخر',
  alert: 'متوقفة مؤقتاً أثناء تنبيه مهم',
  tab_hidden: 'متوقفة مؤقتاً عند إخفاء النافذة',
};

interface PersistedPrefs {
  userPaused: boolean;
  volume: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(1, value));
}

function loadPrefs(): PersistedPrefs {
  if (typeof window === 'undefined') {
    return { userPaused: false, volume: DEFAULT_VOLUME };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { userPaused: false, volume: DEFAULT_VOLUME };
    const parsed = JSON.parse(raw) as Partial<PersistedPrefs>;
    return {
      userPaused: Boolean(parsed.userPaused),
      volume:
        typeof parsed.volume === 'number'
          ? clamp01(parsed.volume)
          : DEFAULT_VOLUME,
    };
  } catch {
    return { userPaused: false, volume: DEFAULT_VOLUME };
  }
}

function savePrefs(prefs: PersistedPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota / private mode failures
  }
}

class BackgroundMusicController {
  private audio: HTMLAudioElement | null = null;
  private initialized = false;
  private monitorsInstalled = false;
  private usedFallbackSrc = false;

  private prefs: PersistedPrefs = loadPrefs();
  private authAllowed = false;
  private gestureUnlocked = false;
  private awaitingGesture = false;
  private isPlaying = false;
  private hasError = false;

  private currentGain = 0;
  private duckFactor = 1;
  private fadeRafId: number | null = null;
  private duckTimeoutId: number | null = null;
  private alertTimeoutId: number | null = null;
  private speechMonitorId: number | null = null;
  private streamSweepId: number | null = null;
  private internalPauseGuard = false;

  private pauseLocks = new Map<string, MusicPauseReason>();
  private mediaLockMap = new WeakMap<HTMLMediaElement, string>();
  private activeMediaElements = new Set<HTMLMediaElement>();
  private activeStreamLocks = new Map<
    string,
    { tracks: MediaStreamTrack[]; timerId: number | null }
  >();
  private lockSeq = 0;

  private listeners = new Set<() => void>();
  private cachedSnapshot: BackgroundMusicSnapshot;

  constructor() {
    this.cachedSnapshot = this.buildSnapshot();
  }

  private getTopPauseReason(): MusicPauseReason | null {
    if (this.pauseLocks.size === 0) return null;
    for (const reason of REASON_PRIORITY) {
      for (const value of this.pauseLocks.values()) {
        if (value === reason) return reason;
      }
    }
    return this.pauseLocks.values().next().value ?? null;
  }

  private buildSnapshot(): BackgroundMusicSnapshot {
    const pauseReason = this.getTopPauseReason();
    const status: BackgroundMusicPlaybackStatus = this.prefs.userPaused
      ? 'paused_manual'
      : pauseReason
      ? 'paused_auto'
      : this.prefs.volume <= 0.005
      ? 'muted'
      : this.isPlaying
      ? 'playing'
      : this.awaitingGesture
      ? 'awaiting_gesture'
      : 'paused_auto';

    return {
      userPaused: this.prefs.userPaused,
      volume: this.prefs.volume,
      isPlaying: this.isPlaying,
      awaitingGesture: this.awaitingGesture,
      pauseReason,
      pauseReasonLabel: pauseReason ? REASON_LABELS[pauseReason] : null,
      status,
      hasError: this.hasError,
    };
  }

  private emitIfChanged(): void {
    const next = this.buildSnapshot();
    const prev = this.cachedSnapshot;
    if (
      prev.userPaused === next.userPaused &&
      Math.abs(prev.volume - next.volume) < 0.001 &&
      prev.isPlaying === next.isPlaying &&
      prev.awaitingGesture === next.awaitingGesture &&
      prev.pauseReason === next.pauseReason &&
      prev.status === next.status &&
      prev.hasError === next.hasError
    ) {
      return;
    }
    this.cachedSnapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): BackgroundMusicSnapshot => {
    return this.cachedSnapshot;
  };

  private ensureAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null;
    }
    if (this.audio) return this.audio;

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = true;
    audio.src = PRIMARY_SRC;
    this.setAudioVolumeSafe(audio, 0);

    audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.awaitingGesture = false;
      this.hasError = false;
      this.emitIfChanged();
    });

    audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.awaitingGesture = false;
      this.hasError = false;
      this.emitIfChanged();
    });

    audio.addEventListener('pause', () => {
      this.isPlaying = false;
      if (!this.internalPauseGuard && !this.prefs.userPaused && this.pauseLocks.size === 0) {
        // OS or external audio focus interruption (e.g. hardware media key / call)
        this.emitIfChanged();
      } else {
        this.internalPauseGuard = false;
        this.emitIfChanged();
      }
    });

    audio.addEventListener('error', () => {
      if (!this.usedFallbackSrc) {
        this.usedFallbackSrc = true;
        audio.src = FALLBACK_SRC;
        audio.load();
        if (!this.prefs.userPaused && this.pauseLocks.size === 0 && this.gestureUnlocked) {
          void this.startOrResumePlayback(true);
        }
        return;
      }
      this.hasError = true;
      this.isPlaying = false;
      this.emitIfChanged();
    });

    this.audio = audio;
    return audio;
  }

  private setAudioVolumeSafe(audio: HTMLAudioElement, value: number): void {
    try {
      audio.volume = clamp01(value);
    } catch {
      // Some strict mobile browsers keep audio.volume read-only
    }
  }

  private cancelFade(): void {
    if (this.fadeRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
  }

  private rampVolume(
    targetGain: number,
    durationMs: number,
    onDone?: () => void
  ): void {
    const audio = this.audio;
    if (!audio) {
      this.currentGain = clamp01(targetGain);
      onDone?.();
      return;
    }

    this.cancelFade();
    const startGain = this.currentGain;
    const endGain = clamp01(targetGain);

    if (durationMs <= 12 || Math.abs(endGain - startGain) < 0.002) {
      this.currentGain = endGain;
      this.setAudioVolumeSafe(audio, endGain);
      onDone?.();
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Smooth cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startGain + (endGain - startGain) * eased;
      this.currentGain = next;
      this.setAudioVolumeSafe(audio, next);

      if (t < 1) {
        this.fadeRafId = window.requestAnimationFrame(step);
      } else {
        this.fadeRafId = null;
        this.currentGain = endGain;
        this.setAudioVolumeSafe(audio, endGain);
        onDone?.();
      }
    };

    this.fadeRafId = window.requestAnimationFrame(step);
  }

  private getTargetActiveVolume(): number {
    return clamp01(this.prefs.volume * this.duckFactor);
  }

  private async startOrResumePlayback(isAutoResume = false): Promise<void> {
    const audio = this.ensureAudioElement();
    if (!audio) return;
    if (!this.authAllowed || this.prefs.userPaused || this.pauseLocks.size > 0) return;

    const target = this.getTargetActiveVolume();

    if (!audio.paused) {
      this.rampVolume(target, isAutoResume ? 420 : 280);
      return;
    }

    try {
      this.currentGain = 0;
      this.setAudioVolumeSafe(audio, 0);
      await audio.play();
      this.gestureUnlocked = true;
      this.awaitingGesture = false;
      this.isPlaying = true;
      this.hasError = false;
      this.rampVolume(target, isAutoResume ? 520 : 380);
      this.emitIfChanged();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || !this.gestureUnlocked) {
        this.awaitingGesture = true;
        this.isPlaying = false;
        this.emitIfChanged();
      }
    }
  }

  private fadeOutAndPause(fadeMs = 200): void {
    const audio = this.audio;
    if (!audio) return;
    if (audio.paused) {
      this.cancelFade();
      this.currentGain = 0;
      this.setAudioVolumeSafe(audio, 0);
      this.isPlaying = false;
      this.emitIfChanged();
      return;
    }

    this.rampVolume(0, fadeMs, () => {
      if (!this.authAllowed || this.prefs.userPaused || this.pauseLocks.size > 0) {
        this.internalPauseGuard = true;
        audio.pause();
        this.isPlaying = false;
        this.emitIfChanged();
      }
    });
  }

  private syncPlaybackState(fadeOutMs = 200, isAutoResume = false): void {
    if (!this.authAllowed || this.prefs.userPaused || this.pauseLocks.size > 0) {
      this.fadeOutAndPause(fadeOutMs);
      this.emitIfChanged();
      return;
    }

    if (this.gestureUnlocked) {
      void this.startOrResumePlayback(isAutoResume);
    } else {
      this.emitIfChanged();
    }
  }

  public init(): () => void {
    if (typeof window === 'undefined') return () => {};

    this.ensureAudioElement();
    this.installMonitors();

    if (!this.initialized) {
      this.initialized = true;
      if (typeof document !== 'undefined' && document.hidden) {
        this.pauseLocks.set('env:visibility', 'tab_hidden');
      }
      if (!this.prefs.userPaused && this.pauseLocks.size === 0) {
        void this.startOrResumePlayback(false);
      } else {
        this.emitIfChanged();
      }
    }

    return () => {
      // Singleton survives view unmounts cleanly
    };
  }

  private installMonitors(): void {
    if (this.monitorsInstalled || typeof window === 'undefined') return;
    this.monitorsInstalled = true;

    // 1) First-gesture autoplay unlocker
    const onFirstGesture = () => {
      this.gestureUnlocked = true;
      if (
        this.authAllowed &&
        (this.awaitingGesture ||
          (!this.prefs.userPaused && this.pauseLocks.size === 0 && !this.isPlaying))
      ) {
        this.awaitingGesture = false;
        void this.startOrResumePlayback(false);
      }
      if (this.gestureUnlocked && !this.awaitingGesture) {
        window.removeEventListener('pointerdown', onFirstGesture, true);
        window.removeEventListener('keydown', onFirstGesture, true);
        window.removeEventListener('touchstart', onFirstGesture, true);
      }
    };
    window.addEventListener('pointerdown', onFirstGesture, true);
    window.addEventListener('keydown', onFirstGesture, true);
    window.addEventListener('touchstart', onFirstGesture, true);

    // 2) Tab visibility / page hide focus awareness
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.acquireLock('env:visibility', 'tab_hidden', 180);
        } else {
          this.releaseLock('env:visibility');
        }
      });

      // 3) Capture-phase monitor for ANY <audio> or unmuted <video> inside DOM
      const onMediaPlay = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLMediaElement)) return;
        if (target === this.audio) return;
        // Ignore silent muted ambient/preview video unless it holds a live camera srcObject
        const hasCameraStream = Boolean(target.srcObject);
        if (target instanceof HTMLVideoElement && target.muted && !hasCameraStream) {
          return;
        }
        let lockId = this.mediaLockMap.get(target);
        if (!lockId) {
          this.lockSeq += 1;
          lockId = `dom-media:${this.lockSeq}`;
          this.mediaLockMap.set(target, lockId);
        }
        this.activeMediaElements.add(target);
        this.acquireLock(lockId, hasCameraStream ? 'camera' : 'media', 110);
      };

      const onMediaStop = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLMediaElement)) return;
        if (target === this.audio) return;
        const lockId = this.mediaLockMap.get(target);
        this.activeMediaElements.delete(target);
        if (lockId) {
          this.releaseLock(lockId);
        }
      };

      document.addEventListener('play', onMediaPlay, true);
      document.addEventListener('playing', onMediaPlay, true);
      document.addEventListener('pause', onMediaStop, true);
      document.addEventListener('ended', onMediaStop, true);
      document.addEventListener('emptied', onMediaStop, true);
    }

    window.addEventListener('pagehide', () => {
      this.acquireLock('env:pagehide', 'tab_hidden', 120);
    });
    window.addEventListener('pageshow', () => {
      this.releaseLock('env:pagehide');
    });

    // 4) Intercept navigator.mediaDevices.getUserMedia cleanly for any mic/camera stream
    this.installMediaDevicesMonitor();

    // 5) Watch navigator.mediaDevices audio focus / device changes
    try {
      navigator.mediaDevices?.addEventListener?.('devicechange', () => {
        this.sweepEndedStreams();
      });
    } catch {
      // ignore unsupported devicechange
    }
  }

  private installMediaDevicesMonitor(): void {
    try {
      const mediaDevices = navigator.mediaDevices as
        | (MediaDevices & { __bgMusicWrapped?: boolean })
        | undefined;
      if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') return;
      if (mediaDevices.__bgMusicWrapped) return;

      const origGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.__bgMusicWrapped = true;

      mediaDevices.getUserMedia = async (
        constraints?: MediaStreamConstraints
      ): Promise<MediaStream> => {
        const stream = await origGetUserMedia(constraints);
        this.trackMediaStream(stream, constraints);
        return stream;
      };
    } catch {
      // ignore read-only navigator.mediaDevices environments
    }
  }

  private trackMediaStream(
    stream: MediaStream,
    constraints?: MediaStreamConstraints
  ): void {
    const tracks = stream.getTracks();
    if (tracks.length === 0) return;

    this.lockSeq += 1;
    const lockId = `stream:${this.lockSeq}`;
    const hasAudio =
      Boolean(constraints?.audio) ||
      tracks.some((t) => t.kind === 'audio');
    const hasVideo =
      Boolean(constraints?.video) ||
      tracks.some((t) => t.kind === 'video');
    const reason: MusicPauseReason = hasAudio
      ? 'mic'
      : hasVideo
      ? 'camera'
      : 'media';

    const checkAndRelease = () => {
      const stillLive = tracks.some((t) => t.readyState === 'live');
      if (!stillLive) {
        const entry = this.activeStreamLocks.get(lockId);
        if (entry?.timerId !== null && entry?.timerId !== undefined) {
          window.clearTimeout(entry.timerId);
        }
        this.activeStreamLocks.delete(lockId);
        this.releaseLock(lockId);
      }
    };

    for (const track of tracks) {
      track.addEventListener('ended', checkAndRelease, { once: true });
      const origStop = track.stop.bind(track);
      track.stop = () => {
        origStop();
        checkAndRelease();
      };
    }

    // Small 100ms delay avoids flickering when code merely probes mic permission & immediately stops track
    const timerId = window.setTimeout(() => {
      const entry = this.activeStreamLocks.get(lockId);
      if (!entry) return;
      entry.timerId = null;
      if (tracks.some((t) => t.readyState === 'live')) {
        this.acquireLock(lockId, reason, 85);
        this.ensureStreamSweep();
      } else {
        this.activeStreamLocks.delete(lockId);
      }
    }, 100);

    this.activeStreamLocks.set(lockId, { tracks, timerId });
  }

  private ensureStreamSweep(): void {
    if (this.streamSweepId !== null || typeof window === 'undefined') return;
    this.streamSweepId = window.setInterval(() => {
      this.sweepEndedStreams();
    }, 1200);
  }

  private sweepEndedStreams(): void {
    for (const [lockId, entry] of this.activeStreamLocks.entries()) {
      if (!entry.tracks.some((t) => t.readyState === 'live')) {
        if (entry.timerId !== null) window.clearTimeout(entry.timerId);
        this.activeStreamLocks.delete(lockId);
        this.releaseLock(lockId);
      }
    }
    for (const el of Array.from(this.activeMediaElements)) {
      if (el.paused || el.ended || (!el.isConnected && !el.srcObject)) {
        const lockId = this.mediaLockMap.get(el);
        this.activeMediaElements.delete(el);
        if (lockId) this.releaseLock(lockId);
      }
    }
    if (
      this.activeStreamLocks.size === 0 &&
      this.activeMediaElements.size === 0 &&
      this.streamSweepId !== null
    ) {
      window.clearInterval(this.streamSweepId);
      this.streamSweepId = null;
    }
  }

  public acquireLock(
    id: string,
    reason: MusicPauseReason,
    fadeOutMs = 150
  ): void {
    const prevReason = this.pauseLocks.get(id);
    this.pauseLocks.set(id, reason);
    if (prevReason !== reason) {
      this.syncPlaybackState(fadeOutMs, false);
    }
  }

  public releaseLock(id: string): void {
    if (!this.pauseLocks.has(id)) return;
    this.pauseLocks.delete(id);
    if (this.pauseLocks.size === 0) {
      this.syncPlaybackState(200, true);
    } else {
      this.emitIfChanged();
    }
  }

  public watchSpeechSynthesis(lockId = 'speech-synthesis:global'): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.acquireLock(lockId, 'tts', 110);
    if (this.speechMonitorId !== null) {
      window.clearInterval(this.speechMonitorId);
    }
    let checks = 0;
    this.speechMonitorId = window.setInterval(() => {
      checks += 1;
      const speaking =
        window.speechSynthesis.speaking || window.speechSynthesis.pending;
      if (!speaking || checks > 240) {
        if (this.speechMonitorId !== null) {
          window.clearInterval(this.speechMonitorId);
          this.speechMonitorId = null;
        }
        this.releaseLock(lockId);
      }
    }, 220);
  }

  public stopWatchingSpeechSynthesis(lockId = 'speech-synthesis:global'): void {
    if (this.speechMonitorId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.speechMonitorId);
      this.speechMonitorId = null;
    }
    this.releaseLock(lockId);
  }

  public duckTemporarily(factor = 0.56, holdMs = 170): void {
    if (typeof window === 'undefined') return;
    if (this.prefs.userPaused || this.pauseLocks.size > 0 || !this.isPlaying) {
      return;
    }

    this.duckFactor = Math.max(0.1, Math.min(1, factor));
    this.rampVolume(this.getTargetActiveVolume(), 75);

    if (this.duckTimeoutId !== null) {
      window.clearTimeout(this.duckTimeoutId);
    }
    this.duckTimeoutId = window.setTimeout(() => {
      this.duckTimeoutId = null;
      this.duckFactor = 1;
      if (!this.prefs.userPaused && this.pauseLocks.size === 0 && this.isPlaying) {
        this.rampVolume(this.getTargetActiveVolume(), 240);
      }
    }, holdMs);
  }

  public pauseBrieflyForAlert(durationMs = 1350): void {
    if (typeof window === 'undefined') return;
    if (this.prefs.userPaused || !this.gestureUnlocked) return;
    if (this.alertTimeoutId !== null) {
      window.clearTimeout(this.alertTimeoutId);
    }
    this.acquireLock('app:alert-toast', 'alert', 95);
    this.alertTimeoutId = window.setTimeout(() => {
      this.alertTimeoutId = null;
      this.releaseLock('app:alert-toast');
    }, durationMs);
  }

  public toggleManualPlayPause(): void {
    this.setManualPaused(!this.prefs.userPaused);
  }

  public setAuthAllowed(allowed: boolean): void {
    if (this.authAllowed === allowed) return;
    this.authAllowed = allowed;
    if (!allowed) {
      this.fadeOutAndPause(220);
      return;
    }
    if (!this.prefs.userPaused && this.pauseLocks.size === 0) {
      if (this.gestureUnlocked) {
        void this.startOrResumePlayback(false);
      } else {
        this.awaitingGesture = true;
        this.emitIfChanged();
      }
    }
  }

  public setManualPaused(paused: boolean): void {
    this.gestureUnlocked = true;
    this.awaitingGesture = false;
    this.prefs = { ...this.prefs, userPaused: paused };
    savePrefs(this.prefs);

    if (paused) {
      this.syncPlaybackState(240, false);
    } else {
      if (this.prefs.volume <= 0.01) {
        this.prefs = { ...this.prefs, volume: DEFAULT_VOLUME };
        savePrefs(this.prefs);
      }
      if (this.authAllowed && this.pauseLocks.size === 0) {
        void this.startOrResumePlayback(false);
      } else {
        this.emitIfChanged();
      }
    }
  }

  public setVolume(nextVolume: number): void {
    const clamped = clamp01(nextVolume);
    this.gestureUnlocked = true;
    this.prefs = { ...this.prefs, volume: clamped };
    savePrefs(this.prefs);

    if (
      clamped > 0.01 &&
      !this.prefs.userPaused &&
      this.pauseLocks.size === 0 &&
      !this.isPlaying
    ) {
      void this.startOrResumePlayback(false);
    } else if (!this.prefs.userPaused && this.pauseLocks.size === 0 && this.isPlaying) {
      this.rampVolume(this.getTargetActiveVolume(), 90);
    }
    this.emitIfChanged();
  }
}

const engine = new BackgroundMusicController();

export function initBackgroundMusicEngine(): () => void {
  return engine.init();
}

export function subscribeBackgroundMusic(listener: () => void): () => void {
  return engine.subscribe(listener);
}

export function getBackgroundMusicSnapshot(): BackgroundMusicSnapshot {
  return engine.getSnapshot();
}

export function toggleBackgroundMusic(): void {
  engine.toggleManualPlayPause();
}

export function setBackgroundMusicPaused(paused: boolean): void {
  engine.setManualPaused(paused);
}

export function setBackgroundMusicVolume(volume: number): void {
  engine.setVolume(volume);
}

export function acquireMusicPauseLock(
  lockId: string,
  reason: MusicPauseReason,
  fadeOutMs?: number
): void {
  engine.acquireLock(lockId, reason, fadeOutMs);
}

export function releaseMusicPauseLock(lockId: string): void {
  engine.releaseLock(lockId);
}

export function watchSpeechSynthesisForMusic(lockId?: string): void {
  engine.watchSpeechSynthesis(lockId);
}

export function stopWatchingSpeechSynthesisForMusic(lockId?: string): void {
  engine.stopWatchingSpeechSynthesis(lockId);
}

export function duckBackgroundMusicForUi(factor?: number, holdMs?: number): void {
  engine.duckTemporarily(factor, holdMs);
}

export function pauseBackgroundMusicForAlert(durationMs?: number): void {
  engine.pauseBrieflyForAlert(durationMs);
}

export function setBackgroundMusicAuthReady(allowed: boolean): void {
  engine.setAuthAllowed(allowed);
}

