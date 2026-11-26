import type { SoundPaletteId } from '../theme/tokens';

export type SoundEventId =
  | 'navigate'
  | 'tab_switch'
  | 'back'
  | 'open_panel'
  | 'close_panel'
  | 'flashlight_on'
  | 'flashlight_off'
  | 'loading_complete'
  | 'sync_complete'
  | 'sync_failed'
  | 'search_start'
  | 'results_found'
  | 'no_results'
  | 'delete'
  | 'undo'
  | 'move_to_trash'
  | 'success'
  | 'error'
  | 'warning'
  | 'button_tap'
  | 'toggle_on'
  | 'toggle_off'
  | 'login_success'
  | 'logout'
  | 'otp_digit'
  | 'otp_verified'
  | 'notify_security'
  | 'notify_reminders'
  | 'notify_sync'
  | 'notify_news'
  | 'mode_change'
  | 'mic_open'
  | 'mic_close'
  | 'ai_thinking_start'
  | 'ai_thinking_finish';

export type SoundChannelBinding = 'security' | 'reminders' | 'sync' | 'news' | 'ui';

export interface SoundSpec {
  id: SoundEventId;
  /** Audio sprite slice window in seconds (all < 1s) */
  spriteOffsetSec: number;
  spriteDurationSec: number;
  /** Higher priority preempts lower priority when max-2 SFX cap is hit */
  priority: number;
  /** Minimum interval in ms before same sound can re-trigger */
  cooldownMs: number;
  /** Distinct vibration pattern (ms) synced with acoustic transient */
  hapticPattern: number[];
  /** Notification channel gating if triggered by alert */
  channel: SoundChannelBinding;
  /** Base frequencies (Hz) for theme-adaptive sprite/synthesis */
  tones: number[];
  /** Default waveform for neutral palette */
  waveform: OscillatorType;
  /** Ducks ambient background music to 40% during SFX */
  duckMusic?: boolean;
  /** Critical security alerts bypass quiet hours sound suppression */
  bypassQuietHours?: boolean;
}

export interface ThemeSoundPaletteProfile {
  id: SoundPaletteId;
  labelAr: string;
  labelEn: string;
  pitchScale: number;
  decayScale: number;
  gainScale: number;
  waveformOverride: OscillatorType | 'preserve';
  filterCutoffHz: number;
}

export const THEME_SOUND_PALETTES: Record<SoundPaletteId, ThemeSoundPaletteProfile> = {
  glass: {
    id: 'glass',
    labelAr: 'توليف هوائي زجاجي',
    labelEn: 'Airy Synth Glass',
    pitchScale: 1.18,
    decayScale: 1.15,
    gainScale: 0.9,
    waveformOverride: 'sine',
    filterCutoffHz: 4800,
  },
  terminal: {
    id: 'terminal',
    labelAr: 'نبضات وطرقات طرفية',
    labelEn: 'Phosphor Beeps & Clicks',
    pitchScale: 1.04,
    decayScale: 0.72,
    gainScale: 0.86,
    waveformOverride: 'square',
    filterCutoffHz: 2600,
  },
  paper: {
    id: 'paper',
    labelAr: 'نقرات خشب وورق',
    labelEn: 'Wood & Paper Taps',
    pitchScale: 0.82,
    decayScale: 0.68,
    gainScale: 0.92,
    waveformOverride: 'triangle',
    filterCutoffHz: 1850,
  },
  bento: {
    id: 'bento',
    labelAr: 'فقاعات مرنة حيوية',
    labelEn: 'Playful Spring Pops',
    pitchScale: 1.24,
    decayScale: 0.95,
    gainScale: 1.0,
    waveformOverride: 'sine',
    filterCutoffHz: 5200,
  },
};

export const SOUND_MAP: Record<SoundEventId, SoundSpec> = {
  navigate: {
    id: 'navigate',
    spriteOffsetSec: 0.0,
    spriteDurationSec: 0.14,
    priority: 3,
    cooldownMs: 70,
    hapticPattern: [8],
    channel: 'ui',
    tones: [440, 554.37],
    waveform: 'sine',
  },
  tab_switch: {
    id: 'tab_switch',
    spriteOffsetSec: 0.25,
    spriteDurationSec: 0.1,
    priority: 2,
    cooldownMs: 60,
    hapticPattern: [6],
    channel: 'ui',
    tones: [523.25],
    waveform: 'triangle',
  },
  back: {
    id: 'back',
    spriteOffsetSec: 0.5,
    spriteDurationSec: 0.13,
    priority: 3,
    cooldownMs: 70,
    hapticPattern: [10],
    channel: 'ui',
    tones: [493.88, 369.99],
    waveform: 'sine',
  },
  open_panel: {
    id: 'open_panel',
    spriteOffsetSec: 0.75,
    spriteDurationSec: 0.18,
    priority: 3,
    cooldownMs: 90,
    hapticPattern: [10, 18],
    channel: 'ui',
    tones: [349.23, 523.25],
    waveform: 'sine',
  },
  close_panel: {
    id: 'close_panel',
    spriteOffsetSec: 1.05,
    spriteDurationSec: 0.16,
    priority: 3,
    cooldownMs: 90,
    hapticPattern: [8],
    channel: 'ui',
    tones: [523.25, 349.23],
    waveform: 'sine',
  },
  flashlight_on: {
    id: 'flashlight_on',
    spriteOffsetSec: 1.35,
    spriteDurationSec: 0.16,
    priority: 6,
    cooldownMs: 140,
    hapticPattern: [16, 20, 12],
    channel: 'ui',
    tones: [620, 930],
    waveform: 'triangle',
  },
  flashlight_off: {
    id: 'flashlight_off',
    spriteOffsetSec: 1.65,
    spriteDurationSec: 0.14,
    priority: 6,
    cooldownMs: 140,
    hapticPattern: [12],
    channel: 'ui',
    tones: [740, 410],
    waveform: 'triangle',
  },
  loading_complete: {
    id: 'loading_complete',
    spriteOffsetSec: 1.95,
    spriteDurationSec: 0.28,
    priority: 5,
    cooldownMs: 250,
    hapticPattern: [12, 24, 18],
    channel: 'ui',
    tones: [440, 587.33, 880],
    waveform: 'sine',
    duckMusic: true,
  },
  sync_complete: {
    id: 'sync_complete',
    spriteOffsetSec: 2.35,
    spriteDurationSec: 0.3,
    priority: 6,
    cooldownMs: 400,
    hapticPattern: [10, 22, 14],
    channel: 'sync',
    tones: [523.25, 659.25, 783.99],
    waveform: 'sine',
    duckMusic: true,
  },
  sync_failed: {
    id: 'sync_failed',
    spriteOffsetSec: 2.75,
    spriteDurationSec: 0.34,
    priority: 9,
    cooldownMs: 500,
    hapticPattern: [30, 35, 30],
    channel: 'sync',
    tones: [311.13, 233.08],
    waveform: 'sawtooth',
    duckMusic: true,
  },
  search_start: {
    id: 'search_start',
    spriteOffsetSec: 3.2,
    spriteDurationSec: 0.1,
    priority: 2,
    cooldownMs: 120,
    hapticPattern: [6],
    channel: 'ui',
    tones: [660],
    waveform: 'sine',
  },
  results_found: {
    id: 'results_found',
    spriteOffsetSec: 3.45,
    spriteDurationSec: 0.2,
    priority: 4,
    cooldownMs: 180,
    hapticPattern: [8, 16],
    channel: 'ui',
    tones: [523.25, 659.25],
    waveform: 'sine',
  },
  no_results: {
    id: 'no_results',
    spriteOffsetSec: 3.75,
    spriteDurationSec: 0.22,
    priority: 4,
    cooldownMs: 220,
    hapticPattern: [18, 25],
    channel: 'ui',
    tones: [329.63, 277.18],
    waveform: 'triangle',
  },
  delete: {
    id: 'delete',
    spriteOffsetSec: 4.1,
    spriteDurationSec: 0.22,
    priority: 7,
    cooldownMs: 150,
    hapticPattern: [24, 14],
    channel: 'ui',
    tones: [392, 220],
    waveform: 'triangle',
    duckMusic: true,
  },
  undo: {
    id: 'undo',
    spriteOffsetSec: 4.45,
    spriteDurationSec: 0.2,
    priority: 6,
    cooldownMs: 120,
    hapticPattern: [12, 16],
    channel: 'ui',
    tones: [349.23, 523.25],
    waveform: 'sine',
  },
  move_to_trash: {
    id: 'move_to_trash',
    spriteOffsetSec: 4.75,
    spriteDurationSec: 0.24,
    priority: 6,
    cooldownMs: 150,
    hapticPattern: [20, 15, 10],
    channel: 'ui',
    tones: [329.63, 246.94],
    waveform: 'triangle',
  },
  success: {
    id: 'success',
    spriteOffsetSec: 5.1,
    spriteDurationSec: 0.3,
    priority: 7,
    cooldownMs: 160,
    hapticPattern: [12, 22, 16],
    channel: 'ui',
    tones: [523.25, 659.25, 1046.5],
    waveform: 'sine',
    duckMusic: true,
  },
  error: {
    id: 'error',
    spriteOffsetSec: 5.5,
    spriteDurationSec: 0.34,
    priority: 9,
    cooldownMs: 200,
    hapticPattern: [35, 35, 35],
    channel: 'ui',
    tones: [246.94, 196.0],
    waveform: 'sawtooth',
    duckMusic: true,
  },
  warning: {
    id: 'warning',
    spriteOffsetSec: 5.95,
    spriteDurationSec: 0.28,
    priority: 8,
    cooldownMs: 250,
    hapticPattern: [25, 30, 25],
    channel: 'ui',
    tones: [440, 392],
    waveform: 'triangle',
    duckMusic: true,
  },
  button_tap: {
    id: 'button_tap',
    spriteOffsetSec: 6.35,
    spriteDurationSec: 0.06,
    priority: 1,
    cooldownMs: 45,
    hapticPattern: [6],
    channel: 'ui',
    tones: [480],
    waveform: 'sine',
  },
  toggle_on: {
    id: 'toggle_on',
    spriteOffsetSec: 6.55,
    spriteDurationSec: 0.12,
    priority: 3,
    cooldownMs: 65,
    hapticPattern: [10],
    channel: 'ui',
    tones: [440, 659.25],
    waveform: 'sine',
  },
  toggle_off: {
    id: 'toggle_off',
    spriteOffsetSec: 6.8,
    spriteDurationSec: 0.11,
    priority: 3,
    cooldownMs: 65,
    hapticPattern: [8],
    channel: 'ui',
    tones: [587.33, 392],
    waveform: 'sine',
  },
  login_success: {
    id: 'login_success',
    spriteOffsetSec: 7.05,
    spriteDurationSec: 0.45,
    priority: 10,
    cooldownMs: 500,
    hapticPattern: [14, 24, 20, 32],
    channel: 'security',
    tones: [440, 554.37, 659.25, 880],
    waveform: 'sine',
    duckMusic: true,
  },
  logout: {
    id: 'logout',
    spriteOffsetSec: 7.6,
    spriteDurationSec: 0.34,
    priority: 9,
    cooldownMs: 400,
    hapticPattern: [16, 20],
    channel: 'security',
    tones: [659.25, 493.88, 329.63],
    waveform: 'sine',
    duckMusic: true,
  },
  otp_digit: {
    id: 'otp_digit',
    spriteOffsetSec: 8.05,
    spriteDurationSec: 0.08,
    priority: 4,
    cooldownMs: 35,
    hapticPattern: [7],
    channel: 'ui',
    tones: [740],
    waveform: 'sine',
  },
  otp_verified: {
    id: 'otp_verified',
    spriteOffsetSec: 8.25,
    spriteDurationSec: 0.38,
    priority: 9,
    cooldownMs: 300,
    hapticPattern: [12, 18, 28],
    channel: 'security',
    tones: [587.33, 783.99, 1174.66],
    waveform: 'sine',
    duckMusic: true,
  },
  notify_security: {
    id: 'notify_security',
    spriteOffsetSec: 8.75,
    spriteDurationSec: 0.48,
    priority: 10,
    cooldownMs: 350,
    hapticPattern: [40, 30, 40, 30],
    channel: 'security',
    tones: [880, 659.25, 987.77],
    waveform: 'triangle',
    duckMusic: true,
    bypassQuietHours: true,
  },
  notify_reminders: {
    id: 'notify_reminders',
    spriteOffsetSec: 9.35,
    spriteDurationSec: 0.34,
    priority: 7,
    cooldownMs: 300,
    hapticPattern: [14, 24, 14],
    channel: 'reminders',
    tones: [587.33, 880],
    waveform: 'sine',
    duckMusic: true,
  },
  notify_sync: {
    id: 'notify_sync',
    spriteOffsetSec: 9.8,
    spriteDurationSec: 0.26,
    priority: 6,
    cooldownMs: 400,
    hapticPattern: [10, 20],
    channel: 'sync',
    tones: [523.25, 783.99],
    waveform: 'sine',
    duckMusic: true,
  },
  notify_news: {
    id: 'notify_news',
    spriteOffsetSec: 10.2,
    spriteDurationSec: 0.32,
    priority: 5,
    cooldownMs: 350,
    hapticPattern: [12, 18],
    channel: 'news',
    tones: [440, 587.33, 659.25],
    waveform: 'sine',
    duckMusic: true,
  },
  mode_change: {
    id: 'mode_change',
    spriteOffsetSec: 10.65,
    spriteDurationSec: 0.42,
    priority: 8,
    cooldownMs: 220,
    hapticPattern: [16, 22, 26],
    channel: 'ui',
    tones: [392, 587.33, 783.99],
    waveform: 'sine',
    duckMusic: true,
  },
  mic_open: {
    id: 'mic_open',
    spriteOffsetSec: 11.2,
    spriteDurationSec: 0.16,
    priority: 8,
    cooldownMs: 180,
    hapticPattern: [14, 14],
    channel: 'ui',
    tones: [523.25, 783.99],
    waveform: 'sine',
  },
  mic_close: {
    id: 'mic_close',
    spriteOffsetSec: 11.45,
    spriteDurationSec: 0.16,
    priority: 8,
    cooldownMs: 180,
    hapticPattern: [12],
    channel: 'ui',
    tones: [659.25, 440],
    waveform: 'sine',
  },
  ai_thinking_start: {
    id: 'ai_thinking_start',
    spriteOffsetSec: 11.75,
    spriteDurationSec: 0.24,
    priority: 5,
    cooldownMs: 250,
    hapticPattern: [8, 14],
    channel: 'ui',
    tones: [392, 493.88],
    waveform: 'sine',
  },
  ai_thinking_finish: {
    id: 'ai_thinking_finish',
    spriteOffsetSec: 12.1,
    spriteDurationSec: 0.3,
    priority: 6,
    cooldownMs: 250,
    hapticPattern: [10, 20, 12],
    channel: 'ui',
    tones: [493.88, 659.25, 987.77],
    waveform: 'sine',
    duckMusic: true,
  },
};

export const ALL_SOUND_EVENT_IDS = Object.keys(SOUND_MAP) as SoundEventId[];
