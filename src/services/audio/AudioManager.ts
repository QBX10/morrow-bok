import { authFetch, getStoredSession } from '../../lib/authClient.ts';
import { getOrCreateDeviceId } from '../storage/syncEngine.ts';
import {
  acquireMusicPauseLock,
  applySyncedBackgroundMusicSettings,
  duckBackgroundMusicForUi,
  getBackgroundMusicSnapshot,
  initBackgroundMusicEngine,
  pauseBackgroundMusicForAlert,
  releaseMusicPauseLock,
  retryBackgroundMusicPlayback,
  setBackgroundMusicAuthReady,
  setBackgroundMusicPauseOnExit,
  setBackgroundMusicPaused,
  setBackgroundMusicSmartMode,
  setBackgroundMusicVolume,
  stopWatchingSpeechSynthesisForMusic,
  watchSpeechSynthesisForMusic,
  type MusicPauseReason,
} from '../../utils/backgroundMusicEngine.ts';
import {
  applySyncedTactileSettings,
  DEFAULT_APP_SOUND_PREFS,
  getAppSoundPrefs,
  installGlobalAppSoundRouter,
  isGlobalAppSoundEnabled,
  playTactileFeedback,
  preloadSfxBus,
  resumeSharedAudioContext,
  setExternalSfxGate,
  setGlobalAppSoundEnabled,
  updateAppSoundPrefs,
  type AppSoundPackId,
  type NotificationSoundId,
  type TactileSoundKind,
} from '../../utils/tactileFeedback.ts';

export type NotificationChannelId =
  | 'security'
  | 'reminders'
  | 'sync'
  | 'whats_new';

export type AppAudioEventName =
  | 'click'
  | 'nav'
  | 'route_shift'
  | 'login_success'
  | 'login_fail'
  | 'sync_complete'
  | 'sync_fail'
  | 'notify'
  | 'warn'
  | 'error'
  | 'success'
  | 'toggle_on'
  | 'toggle_off'
  | 'menu_open'
  | 'menu_close'
  | 'app_open'
  | 'app_close'
  | 'record_start'
  | 'record_stop'
  | 'camera_shutter'
  | 'delete_item'
  | 'search_tick'
  | 'message_send'
  | 'message_receive'
  | 'settings_changed';

export const SFX_EVENT_TABLE: Record<AppAudioEventName, TactileSoundKind> = {
  click: 'tap',
  nav: 'nav',
  route_shift: 'transition_slide',
  login_success: 'auth_welcome',
  login_fail: 'error',
  sync_complete: 'save_complete',
  sync_fail: 'warn',
  notify: 'notify',
  warn: 'warn',
  error: 'error',
  success: 'success',
  toggle_on: 'toggle_on',
  toggle_off: 'toggle_off',
  menu_open: 'menu_open',
  menu_close: 'menu_close',
  app_open: 'app_open',
  app_close: 'app_close',
  record_start: 'record_start',
  record_stop: 'record_stop',
  camera_shutter: 'camera_shutter',
  delete_item: 'delete_item',
  search_tick: 'search_tick',
  message_send: 'message_send',
  message_receive: 'message_receive',
  settings_changed: 'save_complete',
};

export interface NotificationChannelMeta {
  id: NotificationChannelId;
  label: string;
  description: string;
  locked: boolean;
  bypassesQuietHours: boolean;
}

export const NOTIFICATION_CHANNELS_META: readonly NotificationChannelMeta[] = [
  {
    id: 'security',
    label: 'الأمان والدخول',
    description: 'دخول من جهاز جديد أو تنبيه أمني — يعمل دائماً ويكسر ساعات الهدوء',
    locked: true,
    bypassesQuietHours: true,
  },
  {
    id: 'reminders',
    label: 'التذكيرات والإكمال',
    description: 'تذكير المهام واكتمال الحفظ والتصدير والمعالجات',
    locked: false,
    bypassesQuietHours: false,
  },
  {
    id: 'sync',
    label: 'المزامنة الفورية',
    description: 'اكتمال أو تعذر المزامنة وتحديث الإعدادات من أجهزة أخرى',
    locked: false,
    bypassesQuietHours: false,
  },
  {
    id: 'whats_new',
    label: 'الجديد في التطبيق',
    description: 'تنبيهات عند فتح قسم جديد أو تفعيل ميزة مضافة للمرة الأولى',
    locked: false,
    bypassesQuietHours: false,
  },
] as const;

export interface AudioNotificationSettings {
  masterSoundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number; // 0..1 (default 0.20)
  smartPauseEnabled: boolean;
  pauseOnExit: boolean;
  effectsVolume: number; // 0..1
  soundPack: AppSoundPackId;
  notificationTone: NotificationSoundId;
  successErrorEnabled: boolean;
  motionSoundsEnabled: boolean;
  notificationSoundEnabled: boolean;
  notificationsMasterEnabled: boolean;
  channels: {
    security: true;
    reminders: boolean;
    sync: boolean;
    whats_new: boolean;
  };
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string; // HH:mm
  updatedAt?: string;
}

const STORAGE_KEY = 'morrow_audio_notifications_v1';
const SEEN_FEATURES_STORAGE_KEY = 'morrow_seen_feature_announcements_v1';
const TOAST_EVENT_NAME = 'morrow:toast';

export const DEFAULT_AUDIO_NOTIFICATION_SETTINGS: AudioNotificationSettings = {
  masterSoundEnabled: true,
  musicEnabled: true,
  musicVolume: 0.2,
  smartPauseEnabled: true,
  pauseOnExit: true,
  effectsVolume: DEFAULT_APP_SOUND_PREFS.effectsVolume,
  soundPack: DEFAULT_APP_SOUND_PREFS.soundPack,
  notificationTone: DEFAULT_APP_SOUND_PREFS.notificationTone,
  successErrorEnabled: DEFAULT_APP_SOUND_PREFS.successErrorEnabled,
  motionSoundsEnabled: DEFAULT_APP_SOUND_PREFS.motionSoundsEnabled,
  notificationSoundEnabled: DEFAULT_APP_SOUND_PREFS.notificationSoundEnabled,
  notificationsMasterEnabled: true,
  channels: {
    security: true,
    reminders: true,
    sync: true,
    whats_new: true,
  },
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function normalizeHHMM(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return fallback;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function sanitizeAudioNotificationSettings(
  raw?: Partial<AudioNotificationSettings> | null,
  base: AudioNotificationSettings = DEFAULT_AUDIO_NOTIFICATION_SETTINGS
): AudioNotificationSettings {
  const input = raw || {};
  const rawChannels: Partial<AudioNotificationSettings['channels']> =
    input.channels && typeof input.channels === 'object' ? input.channels : {};
  return {
    masterSoundEnabled:
      typeof input.masterSoundEnabled === 'boolean'
        ? input.masterSoundEnabled
        : base.masterSoundEnabled,
    musicEnabled:
      typeof input.musicEnabled === 'boolean'
        ? input.musicEnabled
        : base.musicEnabled,
    musicVolume:
      typeof input.musicVolume === 'number'
        ? clamp01(input.musicVolume, base.musicVolume)
        : base.musicVolume,
    smartPauseEnabled:
      typeof input.smartPauseEnabled === 'boolean'
        ? input.smartPauseEnabled
        : base.smartPauseEnabled,
    pauseOnExit:
      typeof input.pauseOnExit === 'boolean'
        ? input.pauseOnExit
        : base.pauseOnExit,
    effectsVolume:
      typeof input.effectsVolume === 'number'
        ? clamp01(input.effectsVolume, base.effectsVolume)
        : base.effectsVolume,
    soundPack: input.soundPack || base.soundPack,
    notificationTone: input.notificationTone || base.notificationTone,
    successErrorEnabled:
      typeof input.successErrorEnabled === 'boolean'
        ? input.successErrorEnabled
        : base.successErrorEnabled,
    motionSoundsEnabled:
      typeof input.motionSoundsEnabled === 'boolean'
        ? input.motionSoundsEnabled
        : base.motionSoundsEnabled,
    notificationSoundEnabled:
      typeof input.notificationSoundEnabled === 'boolean'
        ? input.notificationSoundEnabled
        : base.notificationSoundEnabled,
    notificationsMasterEnabled:
      typeof input.notificationsMasterEnabled === 'boolean'
        ? input.notificationsMasterEnabled
        : base.notificationsMasterEnabled,
    channels: {
      security: true, // Always locked ON
      reminders:
        typeof rawChannels.reminders === 'boolean'
          ? rawChannels.reminders
          : base.channels.reminders,
      sync:
        typeof rawChannels.sync === 'boolean'
          ? rawChannels.sync
          : base.channels.sync,
      whats_new:
        typeof rawChannels.whats_new === 'boolean'
          ? rawChannels.whats_new
          : base.channels.whats_new,
    },
    quietHoursEnabled:
      typeof input.quietHoursEnabled === 'boolean'
        ? input.quietHoursEnabled
        : base.quietHoursEnabled,
    quietHoursStart: normalizeHHMM(
      input.quietHoursStart,
      base.quietHoursStart
    ),
    quietHoursEnd: normalizeHHMM(input.quietHoursEnd, base.quietHoursEnd),
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt
        ? input.updatedAt
        : base.updatedAt,
  };
}

function parseMinutesFromHHMM(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Checks whether the provided Date falls inside the configured [startHHMM, endHHMM) window.
 * Properly handles overnight spans such as 22:00 -> 07:00.
 */
export function isWithinQuietHours(
  date: Date,
  startHHMM: string,
  endHHMM: string
): boolean {
  const startMin = parseMinutesFromHHMM(startHHMM);
  const endMin = parseMinutesFromHHMM(endHHMM);
  if (startMin === null || endMin === null) return false;
  if (startMin === endMin) return false;
  const nowMin = date.getHours() * 60 + date.getMinutes();
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Overnight wrap (e.g. 22:00 to 07:00)
  return nowMin >= startMin || nowMin < endMin;
}

export function canDeliverChannelNotification(
  channel: NotificationChannelId,
  settings: AudioNotificationSettings,
  date: Date = new Date()
): {
  allowed: boolean;
  playSound: boolean;
  inQuietHours: boolean;
  bypassedQuietHours: boolean;
} {
  const inQuietHours =
    settings.quietHoursEnabled &&
    isWithinQuietHours(date, settings.quietHoursStart, settings.quietHoursEnd);

  // Security alerts are ALWAYS ON, locked, and break through Quiet Hours
  if (channel === 'security') {
    return {
      allowed: true,
      playSound: settings.masterSoundEnabled,
      inQuietHours,
      bypassedQuietHours: inQuietHours,
    };
  }

  if (!settings.notificationsMasterEnabled || !settings.channels[channel]) {
    return {
      allowed: false,
      playSound: false,
      inQuietHours,
      bypassedQuietHours: false,
    };
  }

  const canChime =
    settings.masterSoundEnabled &&
    settings.notificationSoundEnabled &&
    settings.notificationTone !== 'silent' &&
    !inQuietHours;

  return {
    allowed: true,
    playSound: canChime,
    inQuietHours,
    bypassedQuietHours: false,
  };
}

function loadLocalAudioNotificationSettings(): AudioNotificationSettings {
  const bg = getBackgroundMusicSnapshot();
  const tactile = getAppSoundPrefs();
  const engineBaseline = sanitizeAudioNotificationSettings({
    masterSoundEnabled: isGlobalAppSoundEnabled(),
    musicEnabled: !bg.userPaused,
    musicVolume: bg.volume,
    smartPauseEnabled: bg.smartModeEnabled,
    pauseOnExit: bg.pauseOnExit,
    effectsVolume: tactile.effectsVolume,
    soundPack: tactile.soundPack,
    notificationTone: tactile.notificationTone,
    successErrorEnabled: tactile.successErrorEnabled,
    motionSoundsEnabled: tactile.motionSoundsEnabled,
    notificationSoundEnabled: tactile.notificationSoundEnabled,
  });

  if (typeof window === 'undefined') return engineBaseline;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return engineBaseline;
    const parsed = JSON.parse(raw) as Partial<AudioNotificationSettings>;
    return sanitizeAudioNotificationSettings(parsed, engineBaseline);
  } catch {
    return engineBaseline;
  }
}

function saveLocalAudioNotificationSettings(
  settings: AudioNotificationSettings
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

class CentralAudioManager {
  private settings: AudioNotificationSettings =
    loadLocalAudioNotificationSettings();
  private listeners = new Set<() => void>();
  private externalAudio: HTMLAudioElement | null = null;
  private externalLockId: string | null = null;
  private syncTimerId: number | null = null;
  private lastSyncStatus: 'idle' | 'syncing' | 'synced' | 'error' = 'idle';
  private gateInstalled = false;

  constructor() {
    this.installSfxGate();
  }

  private installSfxGate(): void {
    if (this.gateInstalled) return;
    this.gateInstalled = true;
    setExternalSfxGate((_kind, opts) => {
      if (opts?.bypassPrefGate || opts?.channel === 'security') {
        return true;
      }
      if (!this.settings.masterSoundEnabled) return false;
      if (
        this.settings.quietHoursEnabled &&
        isWithinQuietHours(
          new Date(),
          this.settings.quietHoursStart,
          this.settings.quietHoursEnd
        )
      ) {
        return false;
      }
      return true;
    });
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public init(): () => void {
    this.installSfxGate();
    const cleanupSfxRouter = installGlobalAppSoundRouter();
    const cleanupMusic = initBackgroundMusicEngine();
    preloadSfxBus();
    return () => {
      cleanupSfxRouter();
      cleanupMusic();
    };
  }

  public preload(): void {
    preloadSfxBus();
    void resumeSharedAudioContext();
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSettings = (): AudioNotificationSettings => {
    const bg = getBackgroundMusicSnapshot();
    const tactile = getAppSoundPrefs();
    const merged = sanitizeAudioNotificationSettings(
      {
        ...this.settings,
        masterSoundEnabled: isGlobalAppSoundEnabled(),
        musicEnabled: !bg.userPaused,
        musicVolume: bg.volume,
        smartPauseEnabled: bg.smartModeEnabled,
        pauseOnExit: bg.pauseOnExit,
        effectsVolume: tactile.effectsVolume,
        soundPack: tactile.soundPack,
        notificationTone: tactile.notificationTone,
        successErrorEnabled: tactile.successErrorEnabled,
        motionSoundsEnabled: tactile.motionSoundsEnabled,
        notificationSoundEnabled: tactile.notificationSoundEnabled,
      },
      this.settings
    );
    this.settings = merged;
    return this.settings;
  };

  public getSyncStatus(): 'idle' | 'syncing' | 'synced' | 'error' {
    return this.lastSyncStatus;
  }

  public isQuietHoursNow(date: Date = new Date()): boolean {
    const cur = this.getSettings();
    return (
      cur.quietHoursEnabled &&
      isWithinQuietHours(date, cur.quietHoursStart, cur.quietHoursEnd)
    );
  }

  public playEvent(
    eventName: AppAudioEventName | TactileSoundKind,
    options?: {
      haptic?: boolean;
      sound?: boolean;
      reduceMotion?: boolean;
      frequencyPitch?: number;
      bypassPrefGate?: boolean;
      channel?: NotificationChannelId;
      bypassCooldown?: boolean;
    }
  ): void {
    const mappedKind: TactileSoundKind =
      eventName in SFX_EVENT_TABLE
        ? SFX_EVENT_TABLE[eventName as AppAudioEventName]
        : (eventName as TactileSoundKind);
    playTactileFeedback(mappedKind, options);
  }

  public duckBackgroundMusic(factor = 0.4, holdMs = 380): void {
    duckBackgroundMusicForUi(factor, holdMs);
  }

  public setAuthReady(ready: boolean): void {
    setBackgroundMusicAuthReady(ready);
  }

  public acquirePauseLock(
    lockId: string,
    reason: MusicPauseReason,
    fadeOutMs?: number
  ): void {
    acquireMusicPauseLock(lockId, reason, fadeOutMs);
  }

  public releasePauseLock(lockId: string): void {
    releaseMusicPauseLock(lockId);
  }

  public stopExternalAudio(): void {
    if (this.externalAudio) {
      try {
        this.externalAudio.pause();
        this.externalAudio.src = '';
      } catch {
        // ignore audio stop errors
      }
      this.externalAudio = null;
    }
    if (this.externalLockId) {
      releaseMusicPauseLock(this.externalLockId);
      this.externalLockId = null;
    }
  }

  public async playExternalAudio(params: {
    src: string;
    lockId?: string;
    reason?: MusicPauseReason;
    onEnded?: () => void;
    onError?: () => void;
  }): Promise<HTMLAudioElement | null> {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null;
    }
    this.stopExternalAudio();
    const lockId = params.lockId || 'audio-manager:external-clip';
    const reason = params.reason || 'tts';
    const audio = new Audio(params.src);
    this.externalAudio = audio;
    this.externalLockId = lockId;

    acquireMusicPauseLock(lockId, reason, 100);
    const cleanup = () => {
      if (this.externalAudio === audio) {
        this.externalAudio = null;
      }
      if (this.externalLockId === lockId) {
        this.externalLockId = null;
      }
      releaseMusicPauseLock(lockId);
    };

    audio.onended = () => {
      cleanup();
      params.onEnded?.();
    };
    audio.onerror = () => {
      cleanup();
      params.onError?.();
    };
    audio.onpause = () => {
      cleanup();
    };

    try {
      await audio.play();
      return audio;
    } catch (err) {
      cleanup();
      throw err;
    }
  }

  public speakTextWithBrowserTts(params: {
    text: string;
    lang?: string;
    rate?: number;
    lockId?: string;
    onEnd?: () => void;
    onError?: () => void;
  }): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    const lockId = params.lockId || 'audio-manager:tts';
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(params.text);
    utter.lang = params.lang || 'ar-IQ';
    utter.rate = params.rate ?? 0.95;
    utter.onend = () => {
      stopWatchingSpeechSynthesisForMusic(lockId);
      params.onEnd?.();
    };
    utter.onerror = () => {
      stopWatchingSpeechSynthesisForMusic(lockId);
      params.onError?.();
    };
    watchSpeechSynthesisForMusic(lockId);
    window.speechSynthesis.speak(utter);
    return true;
  }

  public canDeliverNotification(
    channel: NotificationChannelId,
    date: Date = new Date()
  ) {
    return canDeliverChannelNotification(channel, this.getSettings(), date);
  }

  public notify(
    channel: NotificationChannelId,
    input: {
      title: string;
      description?: string;
      tone?: 'info' | 'success' | 'warning' | 'error';
      sfxEvent?: AppAudioEventName;
    }
  ): boolean {
    const decision = this.canDeliverNotification(channel);
    if (!decision.allowed) return false;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(TOAST_EVENT_NAME, {
          detail: {
            title: input.title,
            description: input.description,
            tone:
              input.tone || (channel === 'security' ? 'warning' : 'info'),
            channel,
            suppressSound: !decision.playSound,
            sfxEvent: input.sfxEvent,
          },
        })
      );
    }

    if (decision.playSound && channel === 'security') {
      pauseBackgroundMusicForAlert(1350);
    }
    return true;
  }

  public notifyFeatureDiscovery(
    featureKey: string,
    title: string,
    description: string
  ): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(SEEN_FEATURES_STORAGE_KEY);
      const seen = raw ? (JSON.parse(raw) as string[]) : [];
      if (Array.isArray(seen) && seen.includes(featureKey)) {
        return false;
      }
      const nextSeen = [...(Array.isArray(seen) ? seen.slice(-30) : []), featureKey];
      window.localStorage.setItem(
        SEEN_FEATURES_STORAGE_KEY,
        JSON.stringify(nextSeen)
      );
    } catch {
      // ignore storage failures
    }
    return this.notify('whats_new', {
      title,
      description,
      tone: 'info',
      sfxEvent: 'notify',
    });
  }

  private applyToSubsystems(next: AudioNotificationSettings): void {
    setGlobalAppSoundEnabled(next.masterSoundEnabled);
    updateAppSoundPrefs({
      soundPack: next.soundPack,
      notificationTone: next.notificationTone,
      effectsVolume: next.effectsVolume,
      successErrorEnabled: next.successErrorEnabled,
      motionSoundsEnabled: next.motionSoundsEnabled,
      notificationSoundEnabled: next.notificationSoundEnabled,
    });
    setBackgroundMusicPaused(!next.musicEnabled);
    setBackgroundMusicVolume(next.musicVolume);
    setBackgroundMusicSmartMode(next.smartPauseEnabled);
    setBackgroundMusicPauseOnExit(next.pauseOnExit);
  }

  public updateSettings(
    patch: Partial<AudioNotificationSettings> & {
      channels?: Partial<AudioNotificationSettings['channels']>;
    },
    options?: {
      syncToServer?: boolean;
      debounceSyncMs?: number;
      showLocalToast?: boolean;
      toastTitle?: string;
    }
  ): AudioNotificationSettings {
    const current = this.getSettings();
    const merged = sanitizeAudioNotificationSettings(
      {
        ...current,
        ...patch,
        channels: {
          ...current.channels,
          ...(patch.channels || {}),
          security: true,
        },
        updatedAt: new Date().toISOString(),
      },
      current
    );

    this.settings = merged;
    this.applyToSubsystems(merged);
    saveLocalAudioNotificationSettings(merged);
    this.emit();

    if (options?.showLocalToast) {
      this.notify('reminders', {
        title: options.toastTitle || 'تم تحديث إعدادات الصوت والإشعارات',
        tone: 'success',
        sfxEvent: 'settings_changed',
      });
    }

    if (options?.syncToServer !== false) {
      this.scheduleServerSync(merged, options?.debounceSyncMs ?? 120);
    }

    return merged;
  }

  public resetToDefaults(syncToServer = true): AudioNotificationSettings {
    const next = this.updateSettings(
      {
        ...DEFAULT_AUDIO_NOTIFICATION_SETTINGS,
        updatedAt: new Date().toISOString(),
      },
      {
        syncToServer,
        debounceSyncMs: 0,
        showLocalToast: false,
      }
    );
    this.playEvent('settings_changed', {
      sound: true,
      haptic: true,
      bypassPrefGate: true,
    });
    return next;
  }

  private scheduleServerSync(
    snapshot: AudioNotificationSettings,
    delayMs: number
  ): void {
    if (typeof window === 'undefined') return;
    if (this.syncTimerId !== null) {
      window.clearTimeout(this.syncTimerId);
    }
    this.syncTimerId = window.setTimeout(() => {
      this.syncTimerId = null;
      void this.pushSettingsToServer(snapshot);
    }, Math.max(0, delayMs));
  }

  public async pushSettingsToServer(
    settingsToPush: AudioNotificationSettings = this.getSettings()
  ): Promise<boolean> {
    const session = getStoredSession();
    if (!session?.user) return false;
    this.lastSyncStatus = 'syncing';
    this.emit();
    try {
      const res = await authFetch('/api/settings/audio-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToPush,
          deviceId: getOrCreateDeviceId(),
        }),
      });
      if (!res.ok) {
        this.lastSyncStatus = 'error';
        this.emit();
        return false;
      }
      this.lastSyncStatus = 'synced';
      this.emit();
      return true;
    } catch {
      this.lastSyncStatus = 'error';
      this.emit();
      return false;
    }
  }

  public async fetchAndHydrateFromServer(): Promise<AudioNotificationSettings | null> {
    const session = getStoredSession();
    if (!session?.user) return null;
    try {
      const res = await authFetch('/api/settings/audio-notifications');
      if (!res.ok) return null;
      const json = (await res.json()) as {
        exists?: boolean;
        settings?: Partial<AudioNotificationSettings>;
      };
      if (!json.exists || !json.settings) return null;
      const hydrated = sanitizeAudioNotificationSettings(
        json.settings,
        this.getSettings()
      );
      this.settings = hydrated;
      applySyncedBackgroundMusicSettings({
        userPaused: !hydrated.musicEnabled,
        smartModeEnabled: hydrated.smartPauseEnabled,
        pauseOnExit: hydrated.pauseOnExit,
        volume: hydrated.musicVolume,
      });
      applySyncedTactileSettings({
        globalSoundEnabled: hydrated.masterSoundEnabled,
        prefs: {
          soundPack: hydrated.soundPack,
          notificationTone: hydrated.notificationTone,
          effectsVolume: hydrated.effectsVolume,
          successErrorEnabled: hydrated.successErrorEnabled,
          motionSoundsEnabled: hydrated.motionSoundsEnabled,
          notificationSoundEnabled: hydrated.notificationSoundEnabled,
        },
      });
      saveLocalAudioNotificationSettings(hydrated);
      this.lastSyncStatus = 'synced';
      this.emit();
      return hydrated;
    } catch {
      return null;
    }
  }

  public applyRemoteSettings(
    remote: Partial<AudioNotificationSettings>,
    fromDeviceLabel?: string
  ): AudioNotificationSettings {
    const next = sanitizeAudioNotificationSettings(remote, this.getSettings());
    this.settings = next;
    applySyncedBackgroundMusicSettings({
      userPaused: !next.musicEnabled,
      smartModeEnabled: next.smartPauseEnabled,
      pauseOnExit: next.pauseOnExit,
      volume: next.musicVolume,
    });
    applySyncedTactileSettings({
      globalSoundEnabled: next.masterSoundEnabled,
      prefs: {
        soundPack: next.soundPack,
        notificationTone: next.notificationTone,
        effectsVolume: next.effectsVolume,
        successErrorEnabled: next.successErrorEnabled,
        motionSoundsEnabled: next.motionSoundsEnabled,
        notificationSoundEnabled: next.notificationSoundEnabled,
      },
    });
    saveLocalAudioNotificationSettings(next);
    this.lastSyncStatus = 'synced';
    this.emit();

    this.notify('sync', {
      title: `تغيّرت الإعدادات من جهاز ${fromDeviceLabel || 'آخر'}`,
      description: 'تم تطبيق تفضيلات الصوت والإشعارات المحدّثة تلقائياً.',
      tone: 'info',
      sfxEvent: 'sync_complete',
    });

    return next;
  }

  public retryMusic(): void {
    retryBackgroundMusicPlayback();
  }
}

export const audioManager = new CentralAudioManager();
