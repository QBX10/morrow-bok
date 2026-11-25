// Unified App Sound System Architecture — Master Dynamics Bus, 29 Acoustic Profiles, Sound Packs, Notification Tones & Smart Ambient Ducking
import { duckBackgroundMusicForUi } from './backgroundMusicEngine';

export type TactileSoundKind =
  | 'tap'
  | 'menu_open'
  | 'menu_close'
  | 'nav'
  | 'transition_slide'
  | 'app_open'
  | 'app_close'
  | 'sheet_open'
  | 'sheet_close'
  | 'drag_snap'
  | 'toggle_on'
  | 'toggle_off'
  | 'type'
  | 'success'
  | 'warn'
  | 'error'
  | 'undo'
  | 'redo'
  | 'cord_tick'
  | 'notify'
  | 'message_send'
  | 'message_receive'
  | 'record_start'
  | 'record_stop'
  | 'camera_shutter'
  | 'save_complete'
  | 'delete_item'
  | 'search_tick'
  | 'auth_welcome';

export type AppSoundPackId =
  | 'rumi_warm'
  | 'crystal_glass'
  | 'studio_crisp'
  | 'minimal_soft';

export type NotificationSoundId =
  | 'chime_duet'
  | 'bell_crystal'
  | 'harp_pluck'
  | 'soft_pulse'
  | 'silent';

export interface AppSoundPreferences {
  soundPack: AppSoundPackId;
  notificationTone: NotificationSoundId;
  effectsVolume: number; // 0..1
  successErrorEnabled: boolean;
  motionSoundsEnabled: boolean;
  notificationSoundEnabled: boolean;
}

export interface SoundPackOption {
  id: AppSoundPackId;
  label: string;
  description: string;
  pitchScale: number;
  gainScale: number;
  durationScale: number;
  waveform: OscillatorType | 'preserve';
}

export interface NotificationToneOption {
  id: NotificationSoundId;
  label: string;
  description: string;
}

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
  duckAmbient?: { factor: number; holdMs: number };
  layers: AudioLayerSpec[];
}

export const SOUND_PACK_OPTIONS: readonly SoundPackOption[] = [
  {
    id: 'rumi_warm',
    label: 'نغمة RUMI الدافئة',
    description: 'الطابع الافتراضي المتناغم مع الصوت الخلفي للتطبيق',
    pitchScale: 1.0,
    gainScale: 1.0,
    durationScale: 1.0,
    waveform: 'preserve',
  },
  {
    id: 'crystal_glass',
    label: 'كريستال زجاجي',
    description: 'نغمات صافية مرتفعة بلمعة زجاجية هادئة',
    pitchScale: 1.26,
    gainScale: 0.94,
    durationScale: 1.12,
    waveform: 'sine',
  },
  {
    id: 'studio_crisp',
    label: 'استوديو دقيق ومختصر',
    description: 'إيقاع تفاعلي سريع وحاد وواضح لإنجاز الأعمال',
    pitchScale: 1.08,
    gainScale: 1.08,
    durationScale: 0.78,
    waveform: 'triangle',
  },
  {
    id: 'minimal_soft',
    label: 'همس ناعم',
    description: 'لمسة صوتية منخفضة وخفيفة جداً للتركيز الطويل',
    pitchScale: 0.86,
    gainScale: 0.68,
    durationScale: 0.9,
    waveform: 'sine',
  },
] as const;

export const NOTIFICATION_TONE_OPTIONS: readonly NotificationToneOption[] = [
  {
    id: 'chime_duet',
    label: 'رنين مزدوج دافئ',
    description: 'نغمة الإشعار المتناغمة الافتراضية للتطبيق',
  },
  {
    id: 'bell_crystal',
    label: 'جرس كريستال صافي',
    description: 'رنة عالية واضحة ومشرقة للتنبيهات الفورية',
  },
  {
    id: 'harp_pluck',
    label: 'وتر متصاعد هادئ',
    description: 'ثلاث نغمات متدرجة ناعمة تشبه الوتر الخشبي',
  },
  {
    id: 'soft_pulse',
    label: 'نبضة إشعار لطيفة',
    description: 'نغمة دافئة قصيرة ومحدودة التشتيت',
  },
  {
    id: 'silent',
    label: 'إشعارات صامتة',
    description: 'عرض التنبيهات بصرياً فقط بدون صوت إشعار',
  },
] as const;

export const DEFAULT_APP_SOUND_PREFS: AppSoundPreferences = {
  soundPack: 'rumi_warm',
  notificationTone: 'chime_duet',
  effectsVolume: 0.85,
  successErrorEnabled: true,
  motionSoundsEnabled: true,
  notificationSoundEnabled: true,
};

const SOUND_PREFS_STORAGE_KEY = 'morrow_app_sound_prefs_v1';

/**
 * Harmonically calibrated in D Minor Acoustic (D4=293.66, F4=349.23, A4=440, C5=523.25, D5=587.33)
 * so every UI feedback sound blends naturally with the app's warm ambient RUMI soundscape.
 */
export const AUDIO_PROFILES: Record<TactileSoundKind, AudioProfileAsset> = {
  tap: {
    id: 'tap',
    label: 'Click / Soft Tactile Tap',
    layers: [
      {
        type: 'sine',
        startFreq: 440,
        endFreq: 523.25,
        peakGain: 0.021,
        attackSec: 0.004,
        durationSec: 0.042,
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
        startFreq: 349.23,
        endFreq: 523.25,
        peakGain: 0.024,
        attackSec: 0.006,
        durationSec: 0.085,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 659.25,
        endFreq: 880,
        peakGain: 0.01,
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
        startFreq: 523.25,
        endFreq: 293.66,
        peakGain: 0.021,
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
        startFreq: 392.0,
        endFreq: 523.25,
        peakGain: 0.024,
        attackSec: 0.006,
        durationSec: 0.078,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 587.33,
        endFreq: 698.46,
        peakGain: 0.011,
        attackSec: 0.008,
        durationSec: 0.068,
        delaySec: 0.022,
        rampMode: 'exp',
      },
    ],
  },
  transition_slide: {
    id: 'transition_slide',
    label: 'View / Sub-tab Planar Glide',
    layers: [
      {
        type: 'sine',
        startFreq: 329.63,
        endFreq: 493.88,
        peakGain: 0.02,
        attackSec: 0.006,
        durationSec: 0.082,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 659.25,
        endFreq: 783.99,
        peakGain: 0.01,
        attackSec: 0.008,
        durationSec: 0.072,
        delaySec: 0.024,
        rampMode: 'exp',
      },
    ],
  },
  app_open: {
    id: 'app_open',
    label: 'Launch Workspace / Panel',
    duckAmbient: { factor: 0.72, holdMs: 170 },
    layers: [
      {
        type: 'sine',
        startFreq: 440,
        endFreq: 587.33,
        peakGain: 0.028,
        attackSec: 0.008,
        durationSec: 0.125,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 659.25,
        endFreq: 880,
        peakGain: 0.018,
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
        startFreq: 493.88,
        endFreq: 293.66,
        peakGain: 0.022,
        attackSec: 0.005,
        durationSec: 0.078,
        rampMode: 'exp',
      },
    ],
  },
  sheet_open: {
    id: 'sheet_open',
    label: 'Full-Screen Push / Sheet Enter',
    duckAmbient: { factor: 0.76, holdMs: 150 },
    layers: [
      {
        type: 'sine',
        startFreq: 349.23,
        endFreq: 587.33,
        peakGain: 0.024,
        attackSec: 0.007,
        durationSec: 0.105,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 523.25,
        endFreq: 783.99,
        peakGain: 0.012,
        attackSec: 0.009,
        durationSec: 0.095,
        delaySec: 0.028,
        rampMode: 'exp',
      },
    ],
  },
  sheet_close: {
    id: 'sheet_close',
    label: 'Full-Screen Push / Sheet Exit',
    layers: [
      {
        type: 'sine',
        startFreq: 523.25,
        endFreq: 329.63,
        peakGain: 0.02,
        attackSec: 0.005,
        durationSec: 0.08,
        rampMode: 'exp',
      },
    ],
  },
  drag_snap: {
    id: 'drag_snap',
    label: 'Drag / Snap Mechanical Settle',
    layers: [
      {
        type: 'triangle',
        startFreq: 415.3,
        endFreq: 246.94,
        peakGain: 0.018,
        attackSec: 0.002,
        durationSec: 0.034,
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
        startFreq: 392,
        endFreq: 659.25,
        peakGain: 0.026,
        attackSec: 0.004,
        durationSec: 0.056,
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
        startFreq: 587.33,
        endFreq: 329.63,
        peakGain: 0.022,
        attackSec: 0.004,
        durationSec: 0.052,
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
        startFreq: 293.66,
        endFreq: 174.61,
        peakGain: 0.011,
        attackSec: 0.002,
        durationSec: 0.02,
        rampMode: 'exp',
      },
    ],
  },
  success: {
    id: 'success',
    label: 'Operation Success Chime',
    duckAmbient: { factor: 0.65, holdMs: 210 },
    layers: [
      {
        type: 'sine',
        startFreq: 523.25,
        endFreq: 659.25,
        peakGain: 0.028,
        attackSec: 0.006,
        durationSec: 0.088,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 659.25,
        endFreq: 880,
        peakGain: 0.026,
        attackSec: 0.008,
        durationSec: 0.13,
        delaySec: 0.055,
        rampMode: 'exp',
      },
    ],
  },
  warn: {
    id: 'warn',
    label: 'Warning Caution Pulse',
    duckAmbient: { factor: 0.56, holdMs: 220 },
    layers: [
      {
        type: 'triangle',
        startFreq: 349.23,
        endFreq: 261.63,
        peakGain: 0.025,
        attackSec: 0.006,
        durationSec: 0.068,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 293.66,
        endFreq: 220,
        peakGain: 0.021,
        attackSec: 0.006,
        durationSec: 0.088,
        delaySec: 0.075,
        rampMode: 'exp',
      },
    ],
  },
  error: {
    id: 'error',
    label: 'Operation Error Alert Sound',
    duckAmbient: { factor: 0.48, holdMs: 260 },
    layers: [
      {
        type: 'triangle',
        startFreq: 293.66,
        endFreq: 185.0,
        peakGain: 0.03,
        attackSec: 0.004,
        durationSec: 0.082,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 233.08,
        endFreq: 138.59,
        peakGain: 0.026,
        attackSec: 0.004,
        durationSec: 0.125,
        delaySec: 0.082,
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
        startFreq: 523.25,
        endFreq: 349.23,
        peakGain: 0.024,
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
        startFreq: 349.23,
        endFreq: 523.25,
        peakGain: 0.024,
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
  notify: {
    id: 'notify',
    label: 'System Notification Bell',
    duckAmbient: { factor: 0.62, holdMs: 220 },
    layers: [
      {
        type: 'sine',
        startFreq: 440,
        endFreq: 587.33,
        peakGain: 0.024,
        attackSec: 0.005,
        durationSec: 0.095,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 880,
        endFreq: 880,
        peakGain: 0.015,
        attackSec: 0.008,
        durationSec: 0.16,
        delaySec: 0.048,
        rampMode: 'exp',
      },
    ],
  },
  message_send: {
    id: 'message_send',
    label: 'Prompt / Message Dispatch',
    layers: [
      {
        type: 'sine',
        startFreq: 349.23,
        endFreq: 587.33,
        peakGain: 0.024,
        attackSec: 0.005,
        durationSec: 0.08,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 587.33,
        endFreq: 880,
        peakGain: 0.011,
        attackSec: 0.006,
        durationSec: 0.07,
        delaySec: 0.026,
        rampMode: 'exp',
      },
    ],
  },
  message_receive: {
    id: 'message_receive',
    label: 'Assistant Response Arrival',
    duckAmbient: { factor: 0.66, holdMs: 220 },
    layers: [
      {
        type: 'sine',
        startFreq: 293.66,
        endFreq: 440,
        peakGain: 0.024,
        attackSec: 0.008,
        durationSec: 0.11,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 587.33,
        endFreq: 698.46,
        peakGain: 0.019,
        attackSec: 0.01,
        durationSec: 0.15,
        delaySec: 0.06,
        rampMode: 'exp',
      },
    ],
  },
  record_start: {
    id: 'record_start',
    label: 'Voice Recording Engaged',
    layers: [
      {
        type: 'sine',
        startFreq: 349.23,
        endFreq: 440,
        peakGain: 0.026,
        attackSec: 0.006,
        durationSec: 0.075,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 523.25,
        endFreq: 587.33,
        peakGain: 0.02,
        attackSec: 0.006,
        durationSec: 0.09,
        delaySec: 0.045,
        rampMode: 'exp',
      },
    ],
  },
  record_stop: {
    id: 'record_stop',
    label: 'Voice Recording Released',
    layers: [
      {
        type: 'sine',
        startFreq: 523.25,
        endFreq: 349.23,
        peakGain: 0.024,
        attackSec: 0.005,
        durationSec: 0.085,
        rampMode: 'exp',
      },
    ],
  },
  camera_shutter: {
    id: 'camera_shutter',
    label: 'Acoustic Camera Shutter',
    layers: [
      {
        type: 'triangle',
        startFreq: 460,
        endFreq: 180,
        peakGain: 0.032,
        attackSec: 0.002,
        durationSec: 0.026,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 680,
        endFreq: 260,
        peakGain: 0.024,
        attackSec: 0.002,
        durationSec: 0.034,
        delaySec: 0.032,
        rampMode: 'exp',
      },
    ],
  },
  save_complete: {
    id: 'save_complete',
    label: 'Save / Export / Archive Resolve',
    duckAmbient: { factor: 0.64, holdMs: 240 },
    layers: [
      {
        type: 'sine',
        startFreq: 293.66,
        endFreq: 440,
        peakGain: 0.026,
        attackSec: 0.006,
        durationSec: 0.09,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 440,
        endFreq: 587.33,
        peakGain: 0.024,
        attackSec: 0.008,
        durationSec: 0.12,
        delaySec: 0.048,
        rampMode: 'exp',
      },
      {
        type: 'triangle',
        startFreq: 587.33,
        endFreq: 880,
        peakGain: 0.015,
        attackSec: 0.008,
        durationSec: 0.16,
        delaySec: 0.095,
        rampMode: 'exp',
      },
    ],
  },
  delete_item: {
    id: 'delete_item',
    label: 'Delete / Recycle Transition',
    layers: [
      {
        type: 'triangle',
        startFreq: 260,
        endFreq: 130,
        peakGain: 0.025,
        attackSec: 0.004,
        durationSec: 0.075,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 196,
        endFreq: 110,
        peakGain: 0.016,
        attackSec: 0.004,
        durationSec: 0.09,
        delaySec: 0.028,
        rampMode: 'exp',
      },
    ],
  },
  search_tick: {
    id: 'search_tick',
    label: 'Spotlight / Search Command Focus',
    layers: [
      {
        type: 'sine',
        startFreq: 587.33,
        endFreq: 783.99,
        peakGain: 0.02,
        attackSec: 0.004,
        durationSec: 0.055,
        rampMode: 'exp',
      },
    ],
  },
  auth_welcome: {
    id: 'auth_welcome',
    label: 'Workspace Entry Harmonic Bloom',
    duckAmbient: { factor: 0.56, holdMs: 300 },
    layers: [
      {
        type: 'sine',
        startFreq: 293.66,
        endFreq: 293.66,
        peakGain: 0.024,
        attackSec: 0.012,
        durationSec: 0.22,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 349.23,
        endFreq: 349.23,
        peakGain: 0.02,
        attackSec: 0.014,
        durationSec: 0.24,
        delaySec: 0.055,
        rampMode: 'exp',
      },
      {
        type: 'sine',
        startFreq: 440,
        endFreq: 587.33,
        peakGain: 0.022,
        attackSec: 0.016,
        durationSec: 0.28,
        delaySec: 0.11,
        rampMode: 'exp',
      },
    ],
  },
};

const MOTION_SOUND_KINDS = new Set<TactileSoundKind>([
  'nav',
  'transition_slide',
  'menu_open',
  'menu_close',
  'app_open',
  'app_close',
  'sheet_open',
  'sheet_close',
  'drag_snap',
  'cord_tick',
]);

const OUTCOME_SOUND_KINDS = new Set<TactileSoundKind>([
  'success',
  'save_complete',
  'warn',
  'error',
  'delete_item',
]);

const NOTIFICATION_SOUND_KINDS = new Set<TactileSoundKind>([
  'notify',
  'message_receive',
]);

export function resolveNotificationLayers(
  toneId: NotificationSoundId
): AudioLayerSpec[] {
  switch (toneId) {
    case 'silent':
      return [];
    case 'bell_crystal':
      return [
        {
          type: 'sine',
          startFreq: 659.25,
          endFreq: 987.77,
          peakGain: 0.024,
          attackSec: 0.005,
          durationSec: 0.11,
          rampMode: 'exp',
        },
        {
          type: 'sine',
          startFreq: 1318.51,
          endFreq: 1318.51,
          peakGain: 0.014,
          attackSec: 0.006,
          durationSec: 0.18,
          delaySec: 0.055,
          rampMode: 'exp',
        },
      ];
    case 'harp_pluck':
      return [
        {
          type: 'triangle',
          startFreq: 440,
          endFreq: 440,
          peakGain: 0.02,
          attackSec: 0.004,
          durationSec: 0.08,
          rampMode: 'exp',
        },
        {
          type: 'triangle',
          startFreq: 587.33,
          endFreq: 587.33,
          peakGain: 0.02,
          attackSec: 0.004,
          durationSec: 0.095,
          delaySec: 0.05,
          rampMode: 'exp',
        },
        {
          type: 'sine',
          startFreq: 880,
          endFreq: 880,
          peakGain: 0.017,
          attackSec: 0.005,
          durationSec: 0.145,
          delaySec: 0.1,
          rampMode: 'exp',
        },
      ];
    case 'soft_pulse':
      return [
        {
          type: 'sine',
          startFreq: 349.23,
          endFreq: 523.25,
          peakGain: 0.022,
          attackSec: 0.007,
          durationSec: 0.105,
          rampMode: 'exp',
        },
      ];
    case 'chime_duet':
    default:
      return AUDIO_PROFILES.notify.layers;
  }
}

export function applySoundPackToLayer(
  layer: AudioLayerSpec,
  packId: AppSoundPackId,
  effectsVolume = 0.85
): AudioLayerSpec {
  const pack =
    SOUND_PACK_OPTIONS.find((p) => p.id === packId) ?? SOUND_PACK_OPTIONS[0];
  const clampedVol = Math.max(0.05, Math.min(1.25, Number.isFinite(effectsVolume) ? effectsVolume : 0.85));
  const scaledStart = Math.max(40, Math.min(2600, layer.startFreq * pack.pitchScale));
  const scaledEnd =
    typeof layer.endFreq === 'number'
      ? Math.max(40, Math.min(2800, layer.endFreq * pack.pitchScale))
      : undefined;
  const scaledGain = Math.max(
    0.0005,
    Math.min(0.05, layer.peakGain * pack.gainScale * clampedVol)
  );
  const scaledDuration = Math.max(
    0.015,
    Math.min(0.65, layer.durationSec * pack.durationScale)
  );

  return {
    ...layer,
    type: pack.waveform === 'preserve' ? layer.type : pack.waveform,
    startFreq: scaledStart,
    endFreq: scaledEnd,
    peakGain: scaledGain,
    durationSec: scaledDuration,
  };
}

let sharedAudioCtx: AudioContext | null = null;
let masterBusNode: GainNode | null = null;
let globalSoundEnabled = true;
let lastSoundPlayedMs = 0;
let lastKeyTickMs = 0;

function readInitialSoundPrefs(): AppSoundPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_APP_SOUND_PREFS };
  try {
    const raw = window.localStorage.getItem(SOUND_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SOUND_PREFS };
    const parsed = JSON.parse(raw) as Partial<AppSoundPreferences>;
    const validPack = SOUND_PACK_OPTIONS.some((p) => p.id === parsed.soundPack)
      ? (parsed.soundPack as AppSoundPackId)
      : DEFAULT_APP_SOUND_PREFS.soundPack;
    const validTone = NOTIFICATION_TONE_OPTIONS.some(
      (t) => t.id === parsed.notificationTone
    )
      ? (parsed.notificationTone as NotificationSoundId)
      : DEFAULT_APP_SOUND_PREFS.notificationTone;
    const vol =
      typeof parsed.effectsVolume === 'number' &&
      Number.isFinite(parsed.effectsVolume)
        ? Math.max(0, Math.min(1, parsed.effectsVolume))
        : DEFAULT_APP_SOUND_PREFS.effectsVolume;

    return {
      soundPack: validPack,
      notificationTone: validTone,
      effectsVolume: vol,
      successErrorEnabled:
        typeof parsed.successErrorEnabled === 'boolean'
          ? parsed.successErrorEnabled
          : true,
      motionSoundsEnabled:
        typeof parsed.motionSoundsEnabled === 'boolean'
          ? parsed.motionSoundsEnabled
          : true,
      notificationSoundEnabled:
        typeof parsed.notificationSoundEnabled === 'boolean'
          ? parsed.notificationSoundEnabled
          : true,
    };
  } catch {
    return { ...DEFAULT_APP_SOUND_PREFS };
  }
}

let currentSoundPrefs: AppSoundPreferences = readInitialSoundPrefs();
const soundPrefListeners = new Set<() => void>();

function emitSoundPrefChange(): void {
  soundPrefListeners.forEach((fn) => fn());
}

function persistSoundPrefs(next: AppSoundPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
}

export function getAppSoundPrefs(): AppSoundPreferences {
  return currentSoundPrefs;
}

export function subscribeAppSoundPrefs(listener: () => void): () => void {
  soundPrefListeners.add(listener);
  return () => {
    soundPrefListeners.delete(listener);
  };
}

export function updateAppSoundPrefs(
  patch: Partial<AppSoundPreferences>
): AppSoundPreferences {
  const next: AppSoundPreferences = {
    ...currentSoundPrefs,
    ...patch,
    effectsVolume:
      typeof patch.effectsVolume === 'number' &&
      Number.isFinite(patch.effectsVolume)
        ? Math.max(0, Math.min(1, patch.effectsVolume))
        : currentSoundPrefs.effectsVolume,
  };
  currentSoundPrefs = next;
  persistSoundPrefs(next);
  emitSoundPrefChange();
  return next;
}

export function resetAppSoundPrefs(): AppSoundPreferences {
  currentSoundPrefs = { ...DEFAULT_APP_SOUND_PREFS };
  persistSoundPrefs(currentSoundPrefs);
  emitSoundPrefChange();
  return currentSoundPrefs;
}

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
      masterBusNode = null;
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function getMasterSoundDestination(ctx: AudioContext): AudioNode {
  if (masterBusNode && masterBusNode.context === ctx) {
    return masterBusNode;
  }
  try {
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1.0, ctx.currentTime);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, ctx.currentTime);
    comp.knee.setValueAtTime(12, ctx.currentTime);
    comp.ratio.setValueAtTime(4, ctx.currentTime);
    comp.attack.setValueAtTime(0.004, ctx.currentTime);
    comp.release.setValueAtTime(0.14, ctx.currentTime);
    bus.connect(comp);
    comp.connect(ctx.destination);
    masterBusNode = bus;
    return bus;
  } catch {
    return ctx.destination;
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
  destination: AudioNode,
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
  gain.connect(destination);
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      // ignore disconnect errors
    }
  };
  osc.start(startAt);
  osc.stop(startAt + layer.durationSec + 0.02);
}

function playAudioAsset(
  ctx: AudioContext,
  kind: TactileSoundKind,
  options?: {
    frequencyPitch?: number;
    soundPackOverride?: AppSoundPackId;
    notificationToneOverride?: NotificationSoundId;
  }
): void {
  const profile = AUDIO_PROFILES[kind] ?? AUDIO_PROFILES.tap;
  const destination = getMasterSoundDestination(ctx);
  const packId = options?.soundPackOverride ?? currentSoundPrefs.soundPack;
  const effectsVol = currentSoundPrefs.effectsVolume;

  const baseLayers =
    kind === 'notify'
      ? resolveNotificationLayers(
          options?.notificationToneOverride ?? currentSoundPrefs.notificationTone
        )
      : profile.layers;

  for (const rawLayer of baseLayers) {
    const transformed = applySoundPackToLayer(rawLayer, packId, effectsVol);
    playSynthLayer(ctx, destination, transformed, options?.frequencyPitch);
  }
}

export function playTactileFeedback(
  kind: TactileSoundKind = 'tap',
  options?: {
    haptic?: boolean;
    sound?: boolean;
    reduceMotion?: boolean;
    frequencyPitch?: number;
    bypassPrefGate?: boolean;
    soundPackOverride?: AppSoundPackId;
    notificationToneOverride?: NotificationSoundId;
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
        kind === 'error'
          ? [24, 30, 24]
          : kind === 'success' ||
            kind === 'app_open' ||
            kind === 'save_complete' ||
            kind === 'auth_welcome'
          ? [8, 22, 10]
          : kind === 'warn' || kind === 'delete_item'
          ? [16, 24, 16]
          : kind === 'sheet_open' || kind === 'transition_slide'
          ? [5]
          : kind === 'drag_snap'
          ? [4]
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

  if (!options?.bypassPrefGate) {
    if (currentSoundPrefs.effectsVolume <= 0.01) return;
    if (
      MOTION_SOUND_KINDS.has(kind) &&
      !currentSoundPrefs.motionSoundsEnabled
    ) {
      return;
    }
    if (
      OUTCOME_SOUND_KINDS.has(kind) &&
      !currentSoundPrefs.successErrorEnabled
    ) {
      return;
    }
    if (
      NOTIFICATION_SOUND_KINDS.has(kind) &&
      !currentSoundPrefs.notificationSoundEnabled
    ) {
      return;
    }
    if (kind === 'notify' && currentSoundPrefs.notificationTone === 'silent') {
      return;
    }
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

    const profile = AUDIO_PROFILES[kind] ?? AUDIO_PROFILES.tap;
    if (profile.duckAmbient) {
      duckBackgroundMusicForUi(
        profile.duckAmbient.factor,
        profile.duckAmbient.holdMs
      );
    }

    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => {
          playAudioAsset(ctx, kind, options);
        })
        .catch(() => {
          // ignore autoplay restriction
        });
      return;
    }

    playAudioAsset(ctx, kind, options);
  } catch {
    // ignore WebAudio restrictions
  }
}

export function previewSoundPack(packId: AppSoundPackId): void {
  playTactileFeedback('success', {
    sound: true,
    haptic: true,
    bypassPrefGate: true,
    soundPackOverride: packId,
  });
}

export function previewNotificationTone(toneId: NotificationSoundId): void {
  if (toneId === 'silent') return;
  playTactileFeedback('notify', {
    sound: true,
    haptic: true,
    bypassPrefGate: true,
    notificationToneOverride: toneId,
  });
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

export function classifyInteractiveElementSound(
  el: HTMLElement
): TactileSoundKind {
  const explicit = el.getAttribute('data-sound') as TactileSoundKind | null;
  if (explicit && explicit in AUDIO_PROFILES) return explicit;

  const role = el.getAttribute('role') || '';
  const testId = (el.getAttribute('data-testid') || '').toLowerCase();
  const hasPopup = el.getAttribute('aria-haspopup');
  const ariaExpanded = el.getAttribute('aria-expanded');
  const label = `${el.getAttribute('aria-label') || ''} ${
    el.getAttribute('title') || ''
  } ${el.textContent?.slice(0, 64) || ''}`.toLowerCase();

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
    label.includes('حذف') ||
    label.includes('إزالة') ||
    label.includes('مسح') ||
    label.includes('سلة') ||
    label.includes('delete') ||
    label.includes('remove') ||
    testId.includes('delete')
  ) {
    return 'delete_item';
  }

  if (
    label.includes('حفظ') ||
    label.includes('تصدير') ||
    label.includes('اعتماد') ||
    label.includes('نسخ احتياطي') ||
    label.includes('save') ||
    label.includes('export')
  ) {
    return 'save_complete';
  }

  if (
    label.includes('إرسال') ||
    label.includes('send') ||
    testId.includes('send')
  ) {
    return 'message_send';
  }

  if (
    label.includes('التقاط') ||
    label.includes('تصوير') ||
    label.includes('كاميرا') ||
    label.includes('camera') ||
    testId.includes('capture')
  ) {
    return 'camera_shutter';
  }

  if (
    label.includes('بحث') ||
    label.includes('أمر') ||
    label.includes('search') ||
    testId.includes('search') ||
    testId.includes('command')
  ) {
    return 'search_tick';
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
    label.includes('رجوع') ||
    label.includes('عودة') ||
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

let lampPadActive = false;

export function stopLampAmbiencePad(): void {
  lampPadActive = false;
}

export function playLampHumAndChord(chord: number[]): void {
  stopLampAmbiencePad();
  if (!globalSoundEnabled || typeof window === 'undefined') return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;

  lampPadActive = true;

  const playGentleShimmer = () => {
    if (!globalSoundEnabled || !lampPadActive) return;
    const now = ctx.currentTime;
    const destination = getMasterSoundDestination(ctx);
    chord.slice(0, 3).forEach((freq, idx) => {
      if (!Number.isFinite(freq) || freq <= 0) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const offset = 0.05 + idx * 0.09;
      osc.frequency.setValueAtTime(freq, now + offset);

      gain.gain.setValueAtTime(0.0004, now + offset);
      gain.gain.linearRampToValueAtTime(0.009, now + offset + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0004, now + offset + 1.25);

      osc.connect(gain);
      gain.connect(destination);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore disconnect errors
        }
      };
      osc.start(now + offset);
      osc.stop(now + offset + 1.3);
    });
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(playGentleShimmer).catch(() => {});
  } else {
    playGentleShimmer();
  }
}
