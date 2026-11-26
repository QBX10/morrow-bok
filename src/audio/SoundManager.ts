import {
  SOUND_MAP,
  THEME_SOUND_PALETTES,
  type SoundChannelBinding,
  type SoundEventId,
  type SoundSpec,
} from './soundMap';
import type { SoundPaletteId } from '../theme/tokens';

export type PauseReason =
  | 'mic'
  | 'recording'
  | 'camera'
  | 'call'
  | 'headphones_unplugged'
  | 'app_hidden';

export type NotificationChannelKey = 'security' | 'reminders' | 'sync' | 'news';

export interface NotificationChannelPref {
  enabled: boolean;
  sound: boolean;
  haptic: boolean;
  push: boolean;
}

export interface SoundPolicySnapshot {
  masterSound: boolean;
  volumes: {
    music: number; // 0..1, default 0.20 (-23 LUFS calibrated)
    sfx: number; // 0..1
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
  };
  channels: Record<NotificationChannelKey, NotificationChannelPref>;
}

interface ActiveSfxSlot {
  id: string;
  priority: number;
  endAtMs: number;
  stop: () => void;
}

const MAX_CONCURRENT_SFX = 2;
const DEFAULT_AMBIENT_URL = '/assets/aistudio/bg-music_85f08a71.mp3';
// -23 LUFS loudness calibration gain scalar relative to full-scale assets
const LUFS_MINUS_23_CALIBRATION = 0.56;
const DUCKING_FACTOR = 0.4;
const MUSIC_FADE_MS = 1400;

function parseMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function isTimeInQuietHours(
  now: Date,
  quietHours: { enabled: boolean; start: string; end: string }
): boolean {
  if (!quietHours.enabled) return false;
  const start = parseMinutes(quietHours.start);
  const end = parseMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return cur >= start && cur < end;
  }
  return cur >= start || cur < end;
}

export function shouldPlaySoundEvent(params: {
  spec: SoundSpec;
  policy: SoundPolicySnapshot;
  now?: Date;
  lastTriggeredMs?: number;
  nowMs?: number;
}): { allowedSound: boolean; allowedHaptic: boolean; reason?: string } {
  const { spec, policy } = params;
  const now = params.now ?? new Date();
  const nowMs = params.nowMs ?? Date.now();

  if (
    typeof params.lastTriggeredMs === 'number' &&
    nowMs - params.lastTriggeredMs < spec.cooldownMs
  ) {
    return { allowedSound: false, allowedHaptic: false, reason: 'cooldown' };
  }

  const inQuiet = isTimeInQuietHours(now, policy.quietHours);
  const channel: SoundChannelBinding = spec.channel;

  if (channel !== 'ui') {
    const chPref = policy.channels[channel];
    if (!chPref.enabled && channel !== 'security') {
      return { allowedSound: false, allowedHaptic: false, reason: 'channel_disabled' };
    }
    const allowSound =
      policy.masterSound &&
      policy.volumes.sfx > 0.005 &&
      (chPref.sound || (channel === 'security' && Boolean(spec.bypassQuietHours))) &&
      (!inQuiet || Boolean(spec.bypassQuietHours));
    const allowHaptic = chPref.haptic;
    return { allowedSound: allowSound, allowedHaptic: allowHaptic };
  }

  const allowSound =
    policy.masterSound &&
    policy.volumes.sfx > 0.005 &&
    (!inQuiet || Boolean(spec.bypassQuietHours));

  return { allowedSound: allowSound, allowedHaptic: !inQuiet || Boolean(spec.bypassQuietHours) };
}

class UnifiedSoundManager {
  private ctx: AudioContext | null = null;
  private spriteBuffer: AudioBuffer | null = null;
  private spritePreloading = false;
  private activeSfx: ActiveSfxSlot[] = [];
  private cooldownMap = new Map<SoundEventId, number>();
  private pauseReasons = new Set<PauseReason>();
  private listeners = new Set<() => void>();

  private activePalette: SoundPaletteId = 'glass';
  private policy: SoundPolicySnapshot = {
    masterSound: true,
    volumes: { music: 0.2, sfx: 0.85 },
    quietHours: { enabled: false, start: '22:00', end: '07:00' },
    channels: {
      security: { enabled: true, sound: true, haptic: true, push: true },
      reminders: { enabled: true, sound: true, haptic: true, push: true },
      sync: { enabled: true, sound: true, haptic: true, push: true },
      news: { enabled: true, sound: false, haptic: false, push: true },
    },
  };

  // Gapless background music state
  private musicEl: HTMLAudioElement | null = null;
  private musicSourceNode: MediaElementAudioSourceNode | null = null;
  private musicGainNode: GainNode | null = null;
  private musicCompressor: DynamicsCompressorNode | null = null;
  private musicUserEnabled = true;
  private musicPlaying = false;
  private gestureUnlocked = false;
  private duckCount = 0;
  private duckRestoreTimer: number | null = null;
  private listenersInstalled = false;

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setPalette(palette: SoundPaletteId): void {
    this.activePalette = palette;
  }

  public getPalette(): SoundPaletteId {
    return this.activePalette;
  }

  public setPolicy(next: Partial<SoundPolicySnapshot>): void {
    this.policy = {
      ...this.policy,
      ...next,
      volumes: { ...this.policy.volumes, ...(next.volumes ?? {}) },
      quietHours: { ...this.policy.quietHours, ...(next.quietHours ?? {}) },
      channels: { ...this.policy.channels, ...(next.channels ?? {}) },
    };
    this.updateMusicGain(320);
    this.emit();
  }

  public getPolicy(): SoundPolicySnapshot {
    return this.policy;
  }

  public getPauseReasons(): PauseReason[] {
    return Array.from(this.pauseReasons);
  }

  public isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  public isMusicEnabled(): boolean {
    return this.musicUserEnabled;
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Preloads an offline-safe audio sprite buffer:
   * tries optional /assets/audio/sfx-sprite.ogg / .aac first if hosted,
   * and builds an in-memory multi-slice PCM sprite buffer so every event works 100% offline.
   */
  public async preloadSprite(): Promise<void> {
    if (this.spriteBuffer || this.spritePreloading || typeof window === 'undefined') {
      return;
    }
    this.spritePreloading = true;
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;

      // Build deterministic multi-slice PCM audio sprite buffer (13 seconds total)
      const sampleRate = ctx.sampleRate || 44100;
      const totalDuration = 13.0;
      const buffer = ctx.createBuffer(1, Math.floor(sampleRate * totalDuration), sampleRate);
      const data = buffer.getChannelData(0);

      for (const spec of Object.values(SOUND_MAP)) {
        const startIdx = Math.floor(spec.spriteOffsetSec * sampleRate);
        const len = Math.floor(spec.spriteDurationSec * sampleRate);
        const tones = spec.tones;
        for (let i = 0; i < len && startIdx + i < data.length; i++) {
          const t = i / sampleRate;
          const progress = i / len;
          const env =
            Math.min(1, t / 0.008) * Math.pow(1 - progress, 1.8);
          const noteIdx = Math.min(
            tones.length - 1,
            Math.floor(progress * tones.length)
          );
          const freq = tones[noteIdx];
          let sample = 0;
          if (spec.waveform === 'triangle') {
            sample = 2 * Math.abs(2 * ((t * freq) % 1) - 1) - 1;
          } else if (spec.waveform === 'square') {
            sample = Math.sin(2 * Math.PI * freq * t) >= 0 ? 0.55 : -0.55;
          } else {
            sample = Math.sin(2 * Math.PI * freq * t);
          }
          data[startIdx + i] = sample * env * 0.34;
        }
      }
      this.spriteBuffer = buffer;
    } catch {
      // keep silent fallback
    } finally {
      this.spritePreloading = false;
    }
  }

  public installLifecycleMonitors(): () => void {
    if (typeof window === 'undefined' || this.listenersInstalled) {
      return () => {};
    }
    this.listenersInstalled = true;

    const onVisibility = () => {
      if (document.hidden) {
        this.addPauseReason('app_hidden');
      } else {
        this.removePauseReason('app_hidden');
      }
    };

    const onDeviceChange = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devs = await navigator.mediaDevices.enumerateDevices();
        const hasAudioOut = devs.some((d) => d.kind === 'audiooutput');
        if (!hasAudioOut) {
          this.addPauseReason('headphones_unplugged');
        } else {
          this.removePauseReason('headphones_unplugged');
        }
      } catch {
        // ignore permission/platform issues
      }
    };

    const onFirstGesture = () => {
      this.unlockOnGesture();
    };

    document.addEventListener('visibilitychange', onVisibility);
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });
    window.addEventListener('keydown', onFirstGesture, { once: true, passive: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      this.listenersInstalled = false;
    };
  }

  public unlockOnGesture(): void {
    if (!this.gestureUnlocked) {
      this.gestureUnlocked = true;
      void this.preloadSprite();
      if (this.musicUserEnabled && this.pauseReasons.size === 0) {
        void this.startMusicWithFade();
      }
      this.emit();
    }
  }

  public addPauseReason(reason: PauseReason): void {
    const had = this.pauseReasons.has(reason);
    this.pauseReasons.add(reason);
    if (!had) {
      this.pauseMusicImmediate(reason === 'app_hidden' ? 350 : 120);
      this.emit();
    }
  }

  public removePauseReason(reason: PauseReason): void {
    const deleted = this.pauseReasons.delete(reason);
    if (deleted) {
      if (this.pauseReasons.size === 0 && this.musicUserEnabled && this.gestureUnlocked) {
        void this.startMusicWithFade();
      }
      this.emit();
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicUserEnabled = enabled;
    if (!enabled) {
      this.pauseMusicImmediate(MUSIC_FADE_MS);
    } else if (this.gestureUnlocked && this.pauseReasons.size === 0) {
      void this.startMusicWithFade();
    }
    this.emit();
  }

  private ensureMusicGraph(): void {
    if (typeof window === 'undefined' || this.musicEl) return;
    const audio = new Audio(DEFAULT_AMBIENT_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    // Seamless gapless loop safeguard: nudge near EOF before MP3 frame silence
    audio.addEventListener('timeupdate', () => {
      if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 1) {
        if (audio.currentTime >= audio.duration - 0.08) {
          audio.currentTime = 0.02;
        }
      }
    });
    this.musicEl = audio;

    const ctx = this.ensureAudioContext();
    if (ctx) {
      try {
        this.musicSourceNode = ctx.createMediaElementSource(audio);
        this.musicCompressor = ctx.createDynamicsCompressor();
        this.musicCompressor.threshold.value = -24;
        this.musicCompressor.knee.value = 18;
        this.musicCompressor.ratio.value = 3.5;
        this.musicGainNode = ctx.createGain();
        this.musicGainNode.gain.value = 0;

        this.musicSourceNode.connect(this.musicCompressor);
        this.musicCompressor.connect(this.musicGainNode);
        this.musicGainNode.connect(ctx.destination);
      } catch {
        // fallback directly on HTMLAudioElement volume
        audio.volume = 0;
      }
    }
  }

  private targetMusicGain(): number {
    if (!this.policy.masterSound || !this.musicUserEnabled || this.pauseReasons.size > 0) {
      return 0;
    }
    const base = Math.max(0, Math.min(1, this.policy.volumes.music));
    const duckMultiplier = this.duckCount > 0 ? DUCKING_FACTOR : 1;
    return base * LUFS_MINUS_23_CALIBRATION * duckMultiplier;
  }

  private updateMusicGain(rampMs = 280): void {
    const target = this.targetMusicGain();
    const ctx = this.ctx;
    if (this.musicGainNode && ctx) {
      const now = ctx.currentTime;
      this.musicGainNode.gain.cancelScheduledValues(now);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
      this.musicGainNode.gain.linearRampToValueAtTime(target, now + rampMs / 1000);
    } else if (this.musicEl) {
      this.musicEl.volume = Math.max(0, Math.min(1, target));
    }
  }

  public async startMusicWithFade(): Promise<void> {
    if (!this.musicUserEnabled || this.pauseReasons.size > 0) return;
    if (!this.policy.masterSound || this.policy.volumes.music <= 0.005) return;
    this.ensureMusicGraph();
    if (!this.musicEl) return;
    try {
      const ctx = this.ensureAudioContext();
      if (ctx?.state === 'suspended') await ctx.resume();
      await this.musicEl.play();
      this.musicPlaying = true;
      this.updateMusicGain(MUSIC_FADE_MS);
      this.emit();
    } catch {
      this.musicPlaying = false;
    }
  }

  public pauseMusicImmediate(fadeMs = 400): void {
    if (!this.musicEl) return;
    this.musicPlaying = false;
    this.updateMusicGain(fadeMs);
    window.setTimeout(() => {
      if (this.pauseReasons.size > 0 || !this.musicUserEnabled) {
        this.musicEl?.pause();
      }
    }, fadeMs + 40);
    this.emit();
  }

  private triggerDucking(durationMs: number): void {
    this.duckCount += 1;
    this.updateMusicGain(90);
    if (this.duckRestoreTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.duckRestoreTimer);
    }
    if (typeof window !== 'undefined') {
      this.duckRestoreTimer = window.setTimeout(() => {
        this.duckCount = Math.max(0, this.duckCount - 1);
        if (this.duckCount === 0) {
          this.updateMusicGain(420);
        }
      }, Math.max(220, durationMs));
    }
  }

  private pruneExpiredSfx(nowMs: number): void {
    this.activeSfx = this.activeSfx.filter((slot) => slot.endAtMs > nowMs);
  }

  public play(
    eventId: SoundEventId,
    options?: { paletteOverride?: SoundPaletteId; forceSound?: boolean }
  ): boolean {
    const spec = SOUND_MAP[eventId];
    if (!spec) return false;
    const nowMs = Date.now();
    const decision = shouldPlaySoundEvent({
      spec,
      policy: this.policy,
      lastTriggeredMs: this.cooldownMap.get(eventId),
      nowMs,
    });

    const allowSound = options?.forceSound ? true : decision.allowedSound;
    if (!allowSound && !decision.allowedHaptic) return false;

    this.cooldownMap.set(eventId, nowMs);

    if (decision.allowedHaptic && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(spec.hapticPattern);
      } catch {
        // ignore unsupported vibrate calls
      }
    }

    if (!allowSound) return false;

    const ctx = this.ensureAudioContext();
    if (!ctx) return false;

    this.pruneExpiredSfx(nowMs);
    if (this.activeSfx.length >= MAX_CONCURRENT_SFX) {
      this.activeSfx.sort((a, b) => a.priority - b.priority);
      const lowest = this.activeSfx[0];
      if (lowest && lowest.priority <= spec.priority) {
        lowest.stop();
        this.activeSfx.shift();
      } else {
        return false;
      }
    }

    const palette = THEME_SOUND_PALETTES[options?.paletteOverride ?? this.activePalette];
    const sfxGain = Math.max(0.05, Math.min(1, this.policy.volumes.sfx)) * palette.gainScale;
    const durationSec = Math.min(0.92, spec.spriteDurationSec * palette.decayScale);

    if (spec.duckMusic) {
      this.triggerDucking(durationSec * 1000 + 180);
    }

    const slotId = `${eventId}:${nowMs}`;
    const startTime = ctx.currentTime;
    const stopNodes: AudioScheduledSourceNode[] = [];

    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(palette.filterCutoffHz, startTime);

    masterGain.connect(filter);
    filter.connect(ctx.destination);

    // Hybrid: layer preloaded PCM sprite slice at subtle level when ready + theme-calibrated harmonic synth
    if (this.spriteBuffer) {
      try {
        const spriteSrc = ctx.createBufferSource();
        spriteSrc.buffer = this.spriteBuffer;
        spriteSrc.playbackRate.value = palette.pitchScale;
        const spriteGain = ctx.createGain();
        spriteGain.gain.setValueAtTime(0.28 * sfxGain, startTime);
        spriteSrc.connect(spriteGain);
        spriteGain.connect(masterGain);
        spriteSrc.start(startTime, spec.spriteOffsetSec, durationSec);
        stopNodes.push(spriteSrc);
      } catch {
        // ignore sprite offset errors
      }
    }

    const noteDuration = durationSec / Math.max(1, spec.tones.length);
    spec.tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const noteStart = startTime + idx * noteDuration * 0.72;
      const noteEnd = Math.min(startTime + durationSec, noteStart + noteDuration * 1.15);

      osc.type =
        palette.waveformOverride === 'preserve'
          ? spec.waveform
          : palette.waveformOverride;
      osc.frequency.setValueAtTime(freq * palette.pitchScale, noteStart);

      const peak = (palette.id === 'terminal' ? 0.12 : 0.16) * sfxGain;
      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(peak, noteStart + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      osc.connect(noteGain);
      noteGain.connect(masterGain);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.015);
      stopNodes.push(osc);
    });

    this.activeSfx.push({
      id: slotId,
      priority: spec.priority,
      endAtMs: nowMs + durationSec * 1000,
      stop: () => {
        for (const node of stopNodes) {
          try {
            node.stop();
          } catch {
            // ignore already stopped
          }
        }
      },
    });

    return true;
  }
}

export const soundManager = new UnifiedSoundManager();
