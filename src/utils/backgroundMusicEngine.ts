export type MusicPauseReason =
  | 'call'
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
  smartModeEnabled: boolean;
  volume: number;
  isPlaying: boolean;
  awaitingGesture: boolean;
  pauseReason: MusicPauseReason | null;
  pauseReasonLabel: string | null;
  activeLockCount: number;
  status: BackgroundMusicPlaybackStatus;
  hasError: boolean;
}

const STORAGE_KEY = 'morrow_bg_music_prefs_v1';
const PRIMARY_SRC = '/assets/aistudio/RUMI-music_0cb9de04.mp3';
const FALLBACK_SRC = '/app-ambient.mp3';
const DEFAULT_VOLUME = 0.27;

export const SMART_AUDIO_REASON_PRIORITY: readonly MusicPauseReason[] = [
  'call',
  'live',
  'mic',
  'camera',
  'tts',
  'media',
  'alert',
  'tab_hidden',
];

export const SMART_AUDIO_REASON_LABELS: Record<MusicPauseReason, string> = {
  call: 'صوت التطبيق متوقف مؤقتاً أثناء إجراء اتصال',
  live: 'صوت التطبيق متوقف مؤقتاً أثناء الجلسة الصوتية المباشرة',
  mic: 'صوت التطبيق متوقف مؤقتاً أثناء التسجيل الصوتي أو استخدام الميكروفون',
  camera: 'صوت التطبيق متوقف مؤقتاً أثناء فتح الكاميرا',
  tts: 'صوت التطبيق متوقف مؤقتاً أثناء القراءة الصوتية',
  media: 'صوت التطبيق متوقف مؤقتاً أثناء تشغيل وسائط أخرى',
  alert: 'صوت التطبيق متوقف مؤقتاً أثناء تنبيه مهم',
  tab_hidden: 'صوت التطبيق متوقف مؤقتاً عند الخروج أو إخفاء التطبيق',
};

export function resolveTopPauseReason(
  locks: Iterable<MusicPauseReason>
): MusicPauseReason | null {
  const active = new Set(locks);
  if (active.size === 0) return null;
  for (const reason of SMART_AUDIO_REASON_PRIORITY) {
    if (active.has(reason)) return reason;
  }
  return active.values().next().value ?? null;
}

export function shouldSmartMusicPlay(params: {
  authAllowed: boolean;
  userPaused: boolean;
  smartModeEnabled: boolean;
  volume: number;
  pauseLocksCount: number;
}): boolean {
  if (!params.authAllowed) return false;
  if (params.userPaused) return false;
  if (params.volume <= 0.005) return false;
  if (params.smartModeEnabled && params.pauseLocksCount > 0) return false;
  return true;
}

interface PersistedPrefs {
  userPaused: boolean;
  smartModeEnabled: boolean;
  volume: number;
  volumeV2Migrated?: boolean;
  smartAudioV3Migrated?: boolean;
  rumiAmbientV4Migrated?: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(1, value));
}

function loadPrefs(): { prefs: PersistedPrefs; hasSavedPrefs: boolean } {
  const defaultPrefs: PersistedPrefs = {
    userPaused: false,
    smartModeEnabled: true,
    volume: DEFAULT_VOLUME,
    volumeV2Migrated: true,
    smartAudioV3Migrated: true,
    rumiAmbientV4Migrated: true,
  };
  if (typeof window === 'undefined') {
    return { prefs: defaultPrefs, hasSavedPrefs: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { prefs: defaultPrefs, hasSavedPrefs: false };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedPrefs>;
    let volume =
      typeof parsed.volume === 'number'
        ? clamp01(parsed.volume)
        : DEFAULT_VOLUME;
    let userPaused = Boolean(parsed.userPaused);
    const smartModeEnabled =
      typeof parsed.smartModeEnabled === 'boolean'
        ? parsed.smartModeEnabled
        : true;
    let v2Migrated = Boolean(parsed.volumeV2Migrated);
    if (!v2Migrated && typeof parsed.volume === 'number') {
      volume = clamp01(Math.round(volume * 0.8 * 100) / 100);
      v2Migrated = true;
    }

    // Migrate cleanly to UI-less System Ambient Smart Mode
    let v3Migrated = Boolean(parsed.smartAudioV3Migrated);
    let v4Migrated = Boolean(parsed.rumiAmbientV4Migrated);
    if (!v3Migrated || !v4Migrated) {
      userPaused = false;
      if (volume <= 0.02) {
        volume = DEFAULT_VOLUME;
      }
      v3Migrated = true;
      v4Migrated = true;
      savePrefs({
        userPaused,
        smartModeEnabled: true,
        volume,
        volumeV2Migrated: true,
        smartAudioV3Migrated: true,
        rumiAmbientV4Migrated: true,
      });
    }

    return {
      prefs: {
        userPaused,
        smartModeEnabled,
        volume,
        volumeV2Migrated: v2Migrated || true,
        smartAudioV3Migrated: v3Migrated,
        rumiAmbientV4Migrated: v4Migrated,
      },
      hasSavedPrefs: true,
    };
  } catch {
    return { prefs: defaultPrefs, hasSavedPrefs: false };
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

  private readonly initialLoad = loadPrefs();
  private prefs: PersistedPrefs = this.initialLoad.prefs;
  private hasSavedPrefs = this.initialLoad.hasSavedPrefs;
  private authAllowed = true;
  private gestureUnlocked = false;
  private awaitingGesture = false;
  private isPlaying = false;
  private hasError = false;
  private startingPlayback = false;
  private osInterruptedPause = false;

  private currentGain = 0;
  private duckFactor = 1;
  private fadeRafId: number | null = null;
  private pauseSafetyTimerId: number | null = null;
  private blurDebounceTimerId: number | null = null;
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
    { tracks: MediaStreamTrack[]; releaseTimerId: number | null }
  >();
  private activeRecorders = new Map<string, MediaRecorder>();
  private activePeerConnections = new Map<string, RTCPeerConnection>();
  private activeRecognitions = new Map<string, { startedAt: number }>();
  private lockSeq = 0;

  private listeners = new Set<() => void>();
  private cachedSnapshot: BackgroundMusicSnapshot;

  constructor() {
    this.cachedSnapshot = this.buildSnapshot();
  }

  private getEffectivePauseLockCount(): number {
    return this.prefs.smartModeEnabled ? this.pauseLocks.size : 0;
  }

  private getTopPauseReason(): MusicPauseReason | null {
    if (!this.prefs.smartModeEnabled || this.pauseLocks.size === 0) return null;
    return resolveTopPauseReason(this.pauseLocks.values());
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
      smartModeEnabled: this.prefs.smartModeEnabled,
      volume: this.prefs.volume,
      isPlaying: this.isPlaying,
      awaitingGesture: this.awaitingGesture,
      pauseReason,
      pauseReasonLabel: pauseReason
        ? SMART_AUDIO_REASON_LABELS[pauseReason]
        : null,
      activeLockCount: this.pauseLocks.size,
      status,
      hasError: this.hasError,
    };
  }

  private emitIfChanged(): void {
    const next = this.buildSnapshot();
    const prev = this.cachedSnapshot;
    if (
      prev.userPaused === next.userPaused &&
      prev.smartModeEnabled === next.smartModeEnabled &&
      Math.abs(prev.volume - next.volume) < 0.001 &&
      prev.isPlaying === next.isPlaying &&
      prev.awaitingGesture === next.awaitingGesture &&
      prev.pauseReason === next.pauseReason &&
      prev.activeLockCount === next.activeLockCount &&
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
    audio.preload = 'auto';
    audio.loop = true;
    audio.src = PRIMARY_SRC;
    this.setAudioVolumeSafe(audio, 0);

    audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.awaitingGesture = false;
      this.osInterruptedPause = false;
      this.hasError = false;
      this.emitIfChanged();
    });

    audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.awaitingGesture = false;
      this.osInterruptedPause = false;
      this.hasError = false;
      this.emitIfChanged();
    });

    audio.addEventListener('pause', () => {
      this.isPlaying = false;
      if (
        !this.internalPauseGuard &&
        !this.prefs.userPaused &&
        this.getEffectivePauseLockCount() === 0
      ) {
        // OS or external audio focus interruption (e.g. cellular call / media control)
        this.osInterruptedPause = true;
      }
      this.internalPauseGuard = false;
      this.emitIfChanged();
    });

    audio.addEventListener('error', () => {
      if (!this.usedFallbackSrc) {
        this.usedFallbackSrc = true;
        audio.src = FALLBACK_SRC;
        audio.load();
        if (this.canPlayRightNow() && this.gestureUnlocked) {
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

  private clearPauseSafetyTimer(): void {
    if (this.pauseSafetyTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.pauseSafetyTimerId);
      this.pauseSafetyTimerId = null;
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

    if (durationMs <= 14 || Math.abs(endGain - startGain) < 0.002) {
      this.currentGain = endGain;
      this.setAudioVolumeSafe(audio, endGain);
      onDone?.();
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
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

  private canPlayRightNow(): boolean {
    return shouldSmartMusicPlay({
      authAllowed: this.authAllowed,
      userPaused: this.prefs.userPaused,
      smartModeEnabled: this.prefs.smartModeEnabled,
      volume: this.prefs.volume,
      pauseLocksCount: this.pauseLocks.size,
    });
  }

  private async startOrResumePlayback(isAutoResume = false): Promise<void> {
    const audio = this.ensureAudioElement();
    if (!audio) {
      this.emitIfChanged();
      return;
    }
    if (!this.canPlayRightNow()) {
      this.emitIfChanged();
      return;
    }

    this.clearPauseSafetyTimer();
    const target = this.getTargetActiveVolume();

    if (!audio.paused) {
      this.rampVolume(target, isAutoResume ? 420 : 280);
      this.emitIfChanged();
      return;
    }

    if (this.startingPlayback) {
      this.emitIfChanged();
      return;
    }
    this.startingPlayback = true;
    this.emitIfChanged();

    try {
      this.hasError = false;
      this.currentGain = 0;
      this.setAudioVolumeSafe(audio, 0);
      await audio.play();
      this.gestureUnlocked = true;
      this.awaitingGesture = false;
      this.osInterruptedPause = false;
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
    } finally {
      this.startingPlayback = false;
    }
  }

  private pauseAudioImmediately(): void {
    const audio = this.audio;
    if (!audio) return;
    this.cancelFade();
    this.clearPauseSafetyTimer();
    this.currentGain = 0;
    this.setAudioVolumeSafe(audio, 0);
    if (!audio.paused) {
      this.internalPauseGuard = true;
      try {
        audio.pause();
      } catch {
        this.internalPauseGuard = false;
      }
    }
    this.isPlaying = false;
    this.emitIfChanged();
  }

  private fadeOutAndPause(fadeMs = 180): void {
    const audio = this.audio;
    if (!audio) return;
    const hiddenNow =
      typeof document !== 'undefined' &&
      (document.hidden || document.visibilityState === 'hidden');

    if (audio.paused || fadeMs <= 20 || hiddenNow) {
      this.pauseAudioImmediately();
      return;
    }

    const finalizePause = () => {
      this.clearPauseSafetyTimer();
      if (!this.canPlayRightNow()) {
        this.internalPauseGuard = true;
        try {
          audio.pause();
        } catch {
          this.internalPauseGuard = false;
        }
        this.currentGain = 0;
        this.setAudioVolumeSafe(audio, 0);
        this.isPlaying = false;
        this.emitIfChanged();
      }
    };

    // Safety timer guarantees pause finishes even if background throttling pauses rAF
    this.clearPauseSafetyTimer();
    if (typeof window !== 'undefined') {
      this.pauseSafetyTimerId = window.setTimeout(finalizePause, fadeMs + 60);
    }

    this.rampVolume(0, fadeMs, finalizePause);
  }

  private syncPlaybackState(fadeOutMs = 180, isAutoResume = false): void {
    if (!this.canPlayRightNow()) {
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
      if (this.canPlayRightNow()) {
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

    // 1) Gesture unlocker & OS-interruption recovery on return interaction
    const onUserInteraction = () => {
      const wasUnlocked = this.gestureUnlocked;
      this.gestureUnlocked = true;
      if (
        this.canPlayRightNow() &&
        (this.awaitingGesture ||
          this.osInterruptedPause ||
          (!wasUnlocked && !this.isPlaying))
      ) {
        this.awaitingGesture = false;
        this.osInterruptedPause = false;
        void this.startOrResumePlayback(false);
      }
    };
    window.addEventListener('pointerdown', onUserInteraction, true);
    window.addEventListener('keydown', onUserInteraction, true);
    window.addEventListener('touchstart', onUserInteraction, true);

    // 2) Leaving app / hiding tab / freezing / closing lifecycle monitors
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden || document.visibilityState === 'hidden') {
          this.acquireLock('env:visibility', 'tab_hidden', 0);
        } else {
          this.releaseLock('env:visibility');
          this.releaseLock('env:pagehide');
          this.releaseLock('env:freeze');
          if (document.hasFocus()) {
            this.releaseLock('env:window-focus');
          }
          if (this.osInterruptedPause && this.canPlayRightNow()) {
            this.osInterruptedPause = false;
            void this.startOrResumePlayback(true);
          }
        }
      });

      document.addEventListener('freeze', () => {
        this.acquireLock('env:freeze', 'tab_hidden', 0);
      });
      document.addEventListener('resume', () => {
        this.releaseLock('env:freeze');
        this.releaseLock('env:pagehide');
        if (!document.hidden) {
          this.releaseLock('env:visibility');
        }
      });

      // 3) Capture-phase DOM <audio> and <video> monitor (camera srcObject or audible media)
      const onMediaPlay = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLMediaElement)) return;
        if (target === this.audio) return;
        const hasCameraStream = Boolean(target.srcObject);
        // Ignore silent ambient background videos unless carrying a live camera stream
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
        this.acquireLock(lockId, hasCameraStream ? 'camera' : 'media', 90);
        this.ensureStreamSweep();
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
      this.acquireLock('env:pagehide', 'tab_hidden', 0);
    });
    window.addEventListener('pageshow', () => {
      this.releaseLock('env:pagehide');
      if (typeof document !== 'undefined' && !document.hidden) {
        this.releaseLock('env:visibility');
      }
    });
    window.addEventListener('beforeunload', () => {
      this.pauseAudioImmediately();
    });

    // Window focus loss detection (handles switching apps/windows without triggering on internal clicks)
    window.addEventListener('blur', () => {
      if (this.blurDebounceTimerId !== null) {
        window.clearTimeout(this.blurDebounceTimerId);
      }
      this.blurDebounceTimerId = window.setTimeout(() => {
        this.blurDebounceTimerId = null;
        if (typeof document !== 'undefined' && !document.hasFocus()) {
          this.acquireLock('env:window-focus', 'tab_hidden', 90);
        }
      }, 150);
    });
    window.addEventListener('focus', () => {
      if (this.blurDebounceTimerId !== null) {
        window.clearTimeout(this.blurDebounceTimerId);
        this.blurDebounceTimerId = null;
      }
      this.releaseLock('env:window-focus');
      this.releaseLock('env:pagehide');
      this.releaseLock('env:freeze');
      if (typeof document !== 'undefined' && !document.hidden) {
        this.releaseLock('env:visibility');
      }
      if (this.osInterruptedPause && this.canPlayRightNow()) {
        this.osInterruptedPause = false;
        void this.startOrResumePlayback(true);
      }
    });

    // 4) Camera / Microphone streams
    this.installMediaDevicesMonitor();

    // 5) MediaRecorder & SpeechRecognition monitors (voice recording / dictation)
    this.installMediaRecorderMonitor();
    this.installSpeechRecognitionMonitor();

    // 6) WebRTC calls & iOS/OS AudioSession call interruptions
    this.installPeerConnectionMonitor();
    this.installAudioSessionMonitor();
    this.installMediaSessionHandlers();

    // 7) Automatic Text-to-Speech (speechSynthesis) monitor
    this.installSpeechSynthesisMonitor();

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
      Boolean(constraints?.audio) || tracks.some((t) => t.kind === 'audio');
    const hasVideo =
      Boolean(constraints?.video) || tracks.some((t) => t.kind === 'video');
    const reason: MusicPauseReason = hasAudio
      ? 'mic'
      : hasVideo
      ? 'camera'
      : 'media';

    // Acquire immediately so audio stops smoothly as soon as camera/mic opens
    this.acquireLock(lockId, reason, 70);
    this.ensureStreamSweep();

    const releaseIfDead = () => {
      const stillLive = tracks.some((t) => t.readyState === 'live');
      if (stillLive) return;
      const entry = this.activeStreamLocks.get(lockId);
      if (!entry) {
        this.releaseLock(lockId);
        return;
      }
      if (entry.releaseTimerId !== null) return;
      // Short 150ms grace bridge prevents blip between permission probe & real recorder/stream
      entry.releaseTimerId = window.setTimeout(() => {
        const cur = this.activeStreamLocks.get(lockId);
        if (cur && !cur.tracks.some((t) => t.readyState === 'live')) {
          this.activeStreamLocks.delete(lockId);
          this.releaseLock(lockId);
        }
      }, 150);
    };

    for (const track of tracks) {
      track.addEventListener('ended', releaseIfDead, { once: true });
      const origStop = track.stop.bind(track);
      track.stop = () => {
        origStop();
        releaseIfDead();
      };
    }

    this.activeStreamLocks.set(lockId, { tracks, releaseTimerId: null });
    if (!tracks.some((t) => t.readyState === 'live')) {
      releaseIfDead();
    }
  }

  private installMediaRecorderMonitor(): void {
    try {
      const w = window as unknown as {
        MediaRecorder?: typeof MediaRecorder & { __bgMusicWrapped?: boolean };
      };
      const OrigRecorder = w.MediaRecorder;
      if (typeof OrigRecorder !== 'function' || OrigRecorder.__bgMusicWrapped) {
        return;
      }

      const controller = this;
      const WrappedRecorder = new Proxy(OrigRecorder, {
        construct(target, args, newTarget) {
          const instance = Reflect.construct(
            target,
            args,
            newTarget
          ) as MediaRecorder;
          controller.lockSeq += 1;
          const lockId = `recorder:${controller.lockSeq}`;

          const origStart = instance.start.bind(instance);
          const origStop = instance.stop.bind(instance);
          const origPause = instance.pause.bind(instance);
          const origResume = instance.resume.bind(instance);

          const releaseRec = () => {
            controller.activeRecorders.delete(lockId);
            controller.releaseLock(lockId);
          };

          instance.addEventListener('start', () => {
            controller.activeRecorders.set(lockId, instance);
            controller.acquireLock(lockId, 'mic', 65);
            controller.ensureStreamSweep();
          });
          instance.addEventListener('resume', () => {
            controller.activeRecorders.set(lockId, instance);
            controller.acquireLock(lockId, 'mic', 65);
            controller.ensureStreamSweep();
          });
          instance.addEventListener('pause', releaseRec);
          instance.addEventListener('stop', releaseRec);
          instance.addEventListener('error', releaseRec);

          instance.start = ((timeslice?: number) => {
            controller.activeRecorders.set(lockId, instance);
            controller.acquireLock(lockId, 'mic', 65);
            controller.ensureStreamSweep();
            return timeslice !== undefined ? origStart(timeslice) : origStart();
          }) as MediaRecorder['start'];

          instance.stop = (() => {
            releaseRec();
            return origStop();
          }) as MediaRecorder['stop'];

          instance.pause = (() => {
            releaseRec();
            return origPause();
          }) as MediaRecorder['pause'];

          instance.resume = (() => {
            controller.activeRecorders.set(lockId, instance);
            controller.acquireLock(lockId, 'mic', 65);
            controller.ensureStreamSweep();
            return origResume();
          }) as MediaRecorder['resume'];

          return instance;
        },
      }) as typeof MediaRecorder & { __bgMusicWrapped?: boolean };

      WrappedRecorder.__bgMusicWrapped = true;
      w.MediaRecorder = WrappedRecorder;
    } catch {
      // ignore non-configurable MediaRecorder environments
    }
  }

  private installSpeechRecognitionMonitor(): void {
    try {
      type SpeechRecCtor = (new () => {
        start: () => void;
        stop: () => void;
        abort: () => void;
        addEventListener?: (
          type: string,
          listener: EventListenerOrEventListenerObject
        ) => void;
      }) & { __bgMusicWrapped?: boolean };

      const w = window as unknown as {
        SpeechRecognition?: SpeechRecCtor;
        webkitSpeechRecognition?: SpeechRecCtor;
      };

      const wrapCtor = (key: 'SpeechRecognition' | 'webkitSpeechRecognition') => {
        const Orig = w[key];
        if (typeof Orig !== 'function' || Orig.__bgMusicWrapped) return;
        const controller = this;

        const Wrapped = new Proxy(Orig, {
          construct(target, args, newTarget) {
            const rec = Reflect.construct(target, args, newTarget) as InstanceType<SpeechRecCtor>;
            controller.lockSeq += 1;
            const lockId = `sr:${controller.lockSeq}`;

            const releaseSr = () => {
              controller.activeRecognitions.delete(lockId);
              controller.releaseLock(lockId);
            };

            const origStart = rec.start.bind(rec);
            const origStop = rec.stop.bind(rec);
            const origAbort = rec.abort.bind(rec);

            rec.addEventListener?.('start', () => {
              controller.activeRecognitions.set(lockId, {
                startedAt: Date.now(),
              });
              controller.acquireLock(lockId, 'mic', 65);
              controller.ensureStreamSweep();
            });
            rec.addEventListener?.('end', releaseSr);
            rec.addEventListener?.('error', releaseSr);

            rec.start = () => {
              controller.activeRecognitions.set(lockId, {
                startedAt: Date.now(),
              });
              controller.acquireLock(lockId, 'mic', 65);
              controller.ensureStreamSweep();
              return origStart();
            };
            rec.stop = () => {
              releaseSr();
              return origStop();
            };
            rec.abort = () => {
              releaseSr();
              return origAbort();
            };

            return rec;
          },
        }) as SpeechRecCtor;

        Wrapped.__bgMusicWrapped = true;
        w[key] = Wrapped;
      };

      wrapCtor('SpeechRecognition');
      wrapCtor('webkitSpeechRecognition');
    } catch {
      // ignore environments without SpeechRecognition
    }
  }

  private installPeerConnectionMonitor(): void {
    try {
      const w = window as unknown as {
        RTCPeerConnection?: typeof RTCPeerConnection & {
          __bgMusicWrapped?: boolean;
        };
      };
      const OrigRtc = w.RTCPeerConnection;
      if (typeof OrigRtc !== 'function' || OrigRtc.__bgMusicWrapped) return;
      const controller = this;

      const WrappedRtc = new Proxy(OrigRtc, {
        construct(target, args, newTarget) {
          const pc = Reflect.construct(
            target,
            args,
            newTarget
          ) as RTCPeerConnection;
          controller.lockSeq += 1;
          const lockId = `webrtc:${controller.lockSeq}`;

          const syncPcState = () => {
            const cState = pc.connectionState;
            const iState = pc.iceConnectionState;
            const active =
              cState === 'connecting' ||
              cState === 'connected' ||
              iState === 'checking' ||
              iState === 'connected' ||
              iState === 'completed';
            const ended =
              cState === 'closed' ||
              cState === 'failed' ||
              cState === 'disconnected' ||
              iState === 'closed' ||
              iState === 'failed';

            if (active) {
              controller.activePeerConnections.set(lockId, pc);
              controller.acquireLock(lockId, 'call', 60);
              controller.ensureStreamSweep();
            } else if (ended) {
              controller.activePeerConnections.delete(lockId);
              controller.releaseLock(lockId);
            }
          };

          pc.addEventListener('connectionstatechange', syncPcState);
          pc.addEventListener('iceconnectionstatechange', syncPcState);

          const origClose = pc.close.bind(pc);
          pc.close = () => {
            controller.activePeerConnections.delete(lockId);
            controller.releaseLock(lockId);
            return origClose();
          };

          return pc;
        },
      }) as typeof RTCPeerConnection & { __bgMusicWrapped?: boolean };

      WrappedRtc.__bgMusicWrapped = true;
      w.RTCPeerConnection = WrappedRtc;
    } catch {
      // ignore non-configurable RTCPeerConnection
    }
  }

  private installAudioSessionMonitor(): void {
    try {
      const nav = navigator as Navigator & {
        audioSession?: EventTarget & {
          state?: string;
          type?: string;
        };
      };
      const session = nav.audioSession;
      if (!session) return;

      const syncAudioSession = () => {
        const isCallSession =
          session.state === 'interrupted' ||
          session.type === 'play-and-record';
        if (isCallSession) {
          this.acquireLock('env:audio-session', 'call', 40);
        } else {
          this.releaseLock('env:audio-session');
        }
      };

      session.addEventListener?.('statechange', syncAudioSession);
      syncAudioSession();
    } catch {
      // ignore unsupported navigator.audioSession
    }
  }

  private installMediaSessionHandlers(): void {
    try {
      const ms = navigator.mediaSession as
        | (MediaSession & { playbackState?: MediaSessionPlaybackState })
        | undefined;
      if (!ms) return;
      // Ensure OS does not treat integrated app ambient sound as a standalone music player card
      try {
        ms.metadata = null;
        ms.playbackState = 'none';
      } catch {
        // ignore read-only mediaSession metadata
      }
      if (typeof ms.setActionHandler === 'function') {
        ms.setActionHandler('pause', () => {
          this.osInterruptedPause = true;
          this.pauseAudioImmediately();
        });
        ms.setActionHandler('stop', () => {
          this.osInterruptedPause = true;
          this.pauseAudioImmediately();
        });
      }
    } catch {
      // ignore restricted MediaSession environments
    }
  }

  private installSpeechSynthesisMonitor(): void {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      const synth = window.speechSynthesis as SpeechSynthesis & {
        __bgMusicWrapped?: boolean;
      };
      if (!synth || typeof synth.speak !== 'function' || synth.__bgMusicWrapped) {
        return;
      }
      const origSpeak = synth.speak.bind(synth);
      const origCancel = synth.cancel.bind(synth);
      synth.__bgMusicWrapped = true;

      synth.speak = (utterance: SpeechSynthesisUtterance) => {
        this.watchSpeechSynthesis('speech-synthesis:auto');
        if (utterance && typeof utterance.addEventListener === 'function') {
          const done = () => {
            if (!synth.speaking && !synth.pending) {
              this.stopWatchingSpeechSynthesis('speech-synthesis:auto');
            }
          };
          utterance.addEventListener('end', done, { once: true });
          utterance.addEventListener('error', done, { once: true });
        }
        return origSpeak(utterance);
      };

      synth.cancel = () => {
        this.stopWatchingSpeechSynthesis('speech-synthesis:auto');
        return origCancel();
      };
    } catch {
      // ignore restricted speechSynthesis
    }
  }

  private ensureStreamSweep(): void {
    if (this.streamSweepId !== null || typeof window === 'undefined') return;
    this.streamSweepId = window.setInterval(() => {
      this.sweepEndedStreams();
    }, 900);
  }

  private sweepEndedStreams(): void {
    for (const [lockId, entry] of this.activeStreamLocks.entries()) {
      if (!entry.tracks.some((t) => t.readyState === 'live')) {
        if (entry.releaseTimerId !== null) {
          window.clearTimeout(entry.releaseTimerId);
        }
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

    for (const [lockId, rec] of this.activeRecorders.entries()) {
      if (rec.state !== 'recording') {
        this.activeRecorders.delete(lockId);
        this.releaseLock(lockId);
      }
    }

    for (const [lockId, pc] of this.activePeerConnections.entries()) {
      if (
        pc.connectionState === 'closed' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected' ||
        pc.iceConnectionState === 'closed'
      ) {
        this.activePeerConnections.delete(lockId);
        this.releaseLock(lockId);
      }
    }

    const now = Date.now();
    for (const [lockId, entry] of this.activeRecognitions.entries()) {
      // Safety ceiling in case browser swallowed recognition 'end'
      if (now - entry.startedAt > 120000) {
        this.activeRecognitions.delete(lockId);
        this.releaseLock(lockId);
      }
    }

    if (
      this.activeStreamLocks.size === 0 &&
      this.activeMediaElements.size === 0 &&
      this.activeRecorders.size === 0 &&
      this.activePeerConnections.size === 0 &&
      this.activeRecognitions.size === 0 &&
      this.streamSweepId !== null
    ) {
      window.clearInterval(this.streamSweepId);
      this.streamSweepId = null;
    }
  }

  public acquireLock(
    id: string,
    reason: MusicPauseReason,
    fadeOutMs = 130
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
    if (this.getEffectivePauseLockCount() === 0) {
      this.syncPlaybackState(180, true);
    } else {
      this.emitIfChanged();
    }
  }

  public setSmartModeEnabled(enabled: boolean): void {
    if (this.prefs.smartModeEnabled === enabled) return;
    this.prefs = {
      ...this.prefs,
      smartModeEnabled: enabled,
      smartAudioV3Migrated: true,
    };
    savePrefs(this.prefs);
    this.syncPlaybackState(180, enabled);
  }

  public watchSpeechSynthesis(lockId = 'speech-synthesis:global'): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.acquireLock(lockId, 'tts', 100);
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
    }, 200);
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
    if (!this.canPlayRightNow() || !this.isPlaying) {
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
      if (this.canPlayRightNow() && this.isPlaying) {
        this.rampVolume(this.getTargetActiveVolume(), 240);
      }
    }, holdMs);
  }

  public pauseBrieflyForAlert(durationMs = 1350): void {
    if (typeof window === 'undefined') return;
    if (!this.prefs.smartModeEnabled || this.prefs.userPaused || !this.gestureUnlocked) {
      return;
    }
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
      this.fadeOutAndPause(200);
      return;
    }
    if (this.canPlayRightNow()) {
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
    this.prefs = {
      ...this.prefs,
      userPaused: paused,
      smartAudioV3Migrated: true,
    };
    savePrefs(this.prefs);

    if (paused) {
      this.syncPlaybackState(220, false);
    } else {
      if (this.prefs.volume <= 0.01) {
        this.prefs = { ...this.prefs, volume: DEFAULT_VOLUME };
        savePrefs(this.prefs);
      }
      if (this.canPlayRightNow()) {
        void this.startOrResumePlayback(false);
      } else {
        this.emitIfChanged();
      }
    }
  }

  public setVolume(nextVolume: number): void {
    const clamped = clamp01(nextVolume);
    this.hasSavedPrefs = true;
    this.gestureUnlocked = true;
    this.prefs = {
      ...this.prefs,
      volume: clamped,
      volumeV2Migrated: true,
      smartAudioV3Migrated: true,
    };
    savePrefs(this.prefs);

    if (this.canPlayRightNow() && !this.isPlaying) {
      void this.startOrResumePlayback(false);
    } else if (this.canPlayRightNow() && this.isPlaying) {
      this.rampVolume(this.getTargetActiveVolume(), 90);
    } else if (clamped <= 0.005) {
      this.fadeOutAndPause(120);
    }
    this.emitIfChanged();
  }

  public syncInitialContext(volume: number, soundEnabled: boolean): void {
    // Only apply server volume when no local preference existed yet; Smart Mode handles auto playback
    if (!this.hasSavedPrefs) {
      const clamped = clamp01(volume > 0.02 ? volume : DEFAULT_VOLUME);
      this.prefs = {
        ...this.prefs,
        volume: clamped,
        userPaused: soundEnabled === false ? false : this.prefs.userPaused,
        volumeV2Migrated: true,
        smartAudioV3Migrated: true,
      };
      if (this.isPlaying) {
        this.rampVolume(this.getTargetActiveVolume(), 120);
      }
      this.emitIfChanged();
    }
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

export function setBackgroundMusicSmartMode(enabled: boolean): void {
  engine.setSmartModeEnabled(enabled);
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

export function syncBackgroundMusicInitialContext(
  volume: number,
  soundEnabled: boolean
): void {
  engine.syncInitialContext(volume, soundEnabled);
}
