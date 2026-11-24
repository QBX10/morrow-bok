import type {
  Spatial3DPrefs,
  Spatial3DThemeId,
  SpatialCardDensity,
  SpatialCustomColors,
  SpatialSurfaceTone,
  SpatialTiltIntensity,
} from '../types/agency.ts';

export interface Spatial3DThemeDefinition {
  id: Spatial3DThemeId;
  nameAr: string;
  subtitleAr: string;
  bgMain: string;
  bgSurface: string;
  bgHeader: string;
  bgTableHeader: string;
  accent: string;
  accentBright: string;
  accentDeep: string;
  accentFg: string;
  secondary: string;
  borderColor: string;
  glowRgba: string;
  secondaryGlowRgba: string;
  nodeColorHex: number;
  ringColorHex: number;
  coreColorHex: number;
  swatches: [string, string, string];
}

export interface ResolvedSpatialPalette {
  themeId: Spatial3DThemeId;
  accent: string;
  accentBright: string;
  accentDeep: string;
  accentFg: string;
  secondary: string;
  bgMain: string;
  bgSurface: string;
  bgHeader: string;
  bgTableHeader: string;
  borderColor: string;
  glowRgba: string;
  secondaryGlowRgba: string;
  nodeColorHex: number;
  ringColorHex: number;
  coreColorHex: number;
  isCustomized: boolean;
}

export const DEFAULT_SPATIAL_3D_PREFS: Spatial3DPrefs = {
  themeId: 'emerald_smoked',
  tiltIntensity: 'subtle',
  cardDensity: 'balanced',
};

export const SURFACE_TONE_PRESETS: Record<
  SpatialSurfaceTone,
  {
    labelAr: string;
    bgMain: string;
    bgSurface: string;
    bgHeader: string;
    bgTableHeader: string;
  }
> = {
  abyssal: {
    labelAr: 'أعماق سبجية',
    bgMain: '#04090F',
    bgSurface: '#091422',
    bgHeader: '#060E18',
    bgTableHeader: '#0E1D30',
  },
  midnight: {
    labelAr: 'ليل ياقوتي',
    bgMain: '#050817',
    bgSurface: '#0C122B',
    bgHeader: '#070C1F',
    bgTableHeader: '#121B3D',
  },
  obsidian: {
    labelAr: 'سبج فحمي',
    bgMain: '#08080D',
    bgSurface: '#12121B',
    bgHeader: '#0C0C14',
    bgTableHeader: '#191926',
  },
  graphite: {
    labelAr: 'تيتانيوم داكن',
    bgMain: '#090D12',
    bgSurface: '#131A24',
    bgHeader: '#0D131B',
    bgTableHeader: '#1A2432',
  },
};

export const CURATED_ACCENT_SWATCHES = [
  '#10B981',
  '#22D3EE',
  '#3B82F6',
  '#A855F7',
  '#F43F5E',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
] as const;

export const CURATED_SECONDARY_SWATCHES = [
  '#06B6D4',
  '#8B5CF6',
  '#38BDF8',
  '#F59E0B',
  '#34D399',
  '#FB7185',
  '#6366F1',
  '#F97316',
] as const;

export const SPATIAL_3D_THEMES: Record<Spatial3DThemeId, Spatial3DThemeDefinition> = {
  emerald_smoked: {
    id: 'emerald_smoked',
    nameAr: 'زمرد سبجي مدخّن',
    subtitleAr: 'أعماق داكنة بلمعان زمردي متدرج',
    bgMain: '#040B0F',
    bgSurface: '#091721',
    bgHeader: '#061118',
    bgTableHeader: '#0D202D',
    accent: '#10B981',
    accentBright: '#6EE7B7',
    accentDeep: '#047857',
    accentFg: '#031510',
    secondary: '#06B6D4',
    borderColor: 'rgba(52, 211, 153, 0.26)',
    glowRgba: 'rgba(16, 185, 129, 0.24)',
    secondaryGlowRgba: 'rgba(6, 182, 212, 0.16)',
    nodeColorHex: 0x10b981,
    ringColorHex: 0x22d3ee,
    coreColorHex: 0x6ee7b7,
    swatches: ['#040B0F', '#10B981', '#06B6D4'],
  },
  holographic_cyan: {
    id: 'holographic_cyan',
    nameAr: 'طيف سماوي وبنفسجي',
    subtitleAr: 'تباين أزرق سماوي مع هالة بنفسجية عميقة',
    bgMain: '#050918',
    bgSurface: '#0B132B',
    bgHeader: '#070D20',
    bgTableHeader: '#121D3E',
    accent: '#22D3EE',
    accentBright: '#A5F3FC',
    accentDeep: '#0284C7',
    accentFg: '#03131A',
    secondary: '#8B5CF6',
    borderColor: 'rgba(34, 211, 238, 0.28)',
    glowRgba: 'rgba(34, 211, 238, 0.24)',
    secondaryGlowRgba: 'rgba(139, 92, 246, 0.18)',
    nodeColorHex: 0x22d3ee,
    ringColorHex: 0x8b5cf6,
    coreColorHex: 0xa5f3fc,
    swatches: ['#050918', '#22D3EE', '#8B5CF6'],
  },
  crimson_obsidian: {
    id: 'crimson_obsidian',
    nameAr: 'ياقوت قرمزي وذهبي',
    subtitleAr: 'خلفية سبجية دافئة بحواف قرمزية وكهرمان',
    bgMain: '#10050A',
    bgSurface: '#1B0A13',
    bgHeader: '#14070D',
    bgTableHeader: '#27101C',
    accent: '#F43F5E',
    accentBright: '#FDA4AF',
    accentDeep: '#BE123C',
    accentFg: '#FFF1F2',
    secondary: '#F59E0B',
    borderColor: 'rgba(244, 63, 94, 0.28)',
    glowRgba: 'rgba(244, 63, 94, 0.22)',
    secondaryGlowRgba: 'rgba(245, 158, 11, 0.16)',
    nodeColorHex: 0xf43f5e,
    ringColorHex: 0xf59e0b,
    coreColorHex: 0xfda4af,
    swatches: ['#10050A', '#F43F5E', '#F59E0B'],
  },
  royal_amethyst: {
    id: 'royal_amethyst',
    nameAr: 'جمشت ملكي وأزرق',
    subtitleAr: 'بنفسجي ملكي متلألئ مع لمعان أزرق جليدي',
    bgMain: '#090617',
    bgSurface: '#130D2B',
    bgHeader: '#0D0920',
    bgTableHeader: '#1C143E',
    accent: '#A855F7',
    accentBright: '#D8B4FE',
    accentDeep: '#7E22CE',
    accentFg: '#FAF5FF',
    secondary: '#38BDF8',
    borderColor: 'rgba(168, 85, 247, 0.28)',
    glowRgba: 'rgba(168, 85, 247, 0.24)',
    secondaryGlowRgba: 'rgba(56, 189, 248, 0.18)',
    nodeColorHex: 0xa855f7,
    ringColorHex: 0x38bdf8,
    coreColorHex: 0xd8b4fe,
    swatches: ['#090617', '#A855F7', '#38BDF8'],
  },
  solar_obsidian_gold: {
    id: 'solar_obsidian_gold',
    nameAr: 'ذهب سبجي وكهرمان',
    subtitleAr: 'فخامة ذهبية دافئة على سطح داكن مصقول',
    bgMain: '#0C0904',
    bgSurface: '#191308',
    bgHeader: '#120E05',
    bgTableHeader: '#241B0B',
    accent: '#F59E0B',
    accentBright: '#FDE68A',
    accentDeep: '#B45309',
    accentFg: '#140C02',
    secondary: '#FB7185',
    borderColor: 'rgba(245, 158, 11, 0.28)',
    glowRgba: 'rgba(245, 158, 11, 0.24)',
    secondaryGlowRgba: 'rgba(251, 113, 133, 0.15)',
    nodeColorHex: 0xf59e0b,
    ringColorHex: 0xfb7185,
    coreColorHex: 0xfde68a,
    swatches: ['#0C0904', '#F59E0B', '#FB7185'],
  },
  arctic_titanium: {
    id: 'arctic_titanium',
    nameAr: 'تيتانيوم قطبي',
    subtitleAr: 'رمادي معدني فولاذي بإضاءة سماوية نقية',
    bgMain: '#070B11',
    bgSurface: '#101823',
    bgHeader: '#0B111A',
    bgTableHeader: '#172332',
    accent: '#38BDF8',
    accentBright: '#BAE6FD',
    accentDeep: '#0369A1',
    accentFg: '#03131E',
    secondary: '#34D399',
    borderColor: 'rgba(56, 189, 248, 0.28)',
    glowRgba: 'rgba(56, 189, 248, 0.24)',
    secondaryGlowRgba: 'rgba(52, 211, 153, 0.16)',
    nodeColorHex: 0x38bdf8,
    ringColorHex: 0x34d399,
    coreColorHex: 0xbae6fd,
    swatches: ['#070B11', '#38BDF8', '#34D399'],
  },
};

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeHexColor(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_RE.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const norm = normalizeHexColor(hex) || '#10B981';
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return [r, g, b];
}

export function hexToNumber(hex: string): number {
  const norm = normalizeHexColor(hex) || '#10B981';
  return parseInt(norm.slice(1), 16);
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbTuple(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function mixHexWithTarget(
  hex: string,
  target: [number, number, number],
  ratio: number
): string {
  const [r, g, b] = hexToRgbTuple(hex);
  const t = Math.max(0, Math.min(1, ratio));
  const nr = Math.round(r + (target[0] - r) * t);
  const ng = Math.round(g + (target[1] - g) * t);
  const nb = Math.round(b + (target[2] - b) * t);
  return (
    '#' +
    [nr, ng, nb]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Computes high-contrast foreground color (#041014 dark or #FFFFFF light)
 * using W3C relative luminance against any user-selected accent hex.
 */
export function computeReadableForeground(bgHex: string): string {
  const [r, g, b] = hexToRgbTuple(bgHex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.34 ? '#041216' : '#FFFFFF';
}

function sanitizeCustomColors(
  raw?: SpatialCustomColors | null
): SpatialCustomColors | undefined {
  if (!raw) return undefined;
  const accent = normalizeHexColor(raw.accent);
  const secondary = normalizeHexColor(raw.secondary);
  const surfaceTone =
    raw.surfaceTone && raw.surfaceTone in SURFACE_TONE_PRESETS
      ? raw.surfaceTone
      : undefined;

  if (!accent && !secondary && !surfaceTone) return undefined;
  const cleaned: SpatialCustomColors = {};
  if (accent) cleaned.accent = accent;
  if (secondary) cleaned.secondary = secondary;
  if (surfaceTone) cleaned.surfaceTone = surfaceTone;
  return cleaned;
}

export function resolveSpatial3DPrefs(
  input?: Partial<Spatial3DPrefs> | null
): Spatial3DPrefs {
  const themeId: Spatial3DThemeId =
    input?.themeId && input.themeId in SPATIAL_3D_THEMES
      ? input.themeId
      : DEFAULT_SPATIAL_3D_PREFS.themeId;

  const tiltIntensity: SpatialTiltIntensity =
    input?.tiltIntensity === 'off' ||
    input?.tiltIntensity === 'subtle' ||
    input?.tiltIntensity === 'dynamic'
      ? input.tiltIntensity
      : DEFAULT_SPATIAL_3D_PREFS.tiltIntensity;

  const cardDensity: SpatialCardDensity =
    input?.cardDensity === 'compact' ||
    input?.cardDensity === 'balanced' ||
    input?.cardDensity === 'spacious'
      ? input.cardDensity
      : DEFAULT_SPATIAL_3D_PREFS.cardDensity;

  const customColors = sanitizeCustomColors(input?.customColors);

  return customColors
    ? { themeId, tiltIntensity, cardDensity, customColors }
    : { themeId, tiltIntensity, cardDensity };
}

export function getSpatialThemeDef(themeId?: Spatial3DThemeId | null): Spatial3DThemeDefinition {
  if (themeId && themeId in SPATIAL_3D_THEMES) {
    return SPATIAL_3D_THEMES[themeId];
  }
  return SPATIAL_3D_THEMES.emerald_smoked;
}

export function resolveActiveSpatialPalette(
  rawPrefs?: Partial<Spatial3DPrefs> | null
): ResolvedSpatialPalette {
  const prefs = resolveSpatial3DPrefs(rawPrefs);
  const base = getSpatialThemeDef(prefs.themeId);
  const custom = prefs.customColors;

  const accent = custom?.accent || base.accent;
  const secondary = custom?.secondary || base.secondary;
  const accentBright = custom?.accent
    ? mixHexWithTarget(accent, [255, 255, 255], 0.48)
    : base.accentBright;
  const accentDeep = custom?.accent
    ? mixHexWithTarget(accent, [4, 10, 18], 0.45)
    : base.accentDeep;
  const accentFg = custom?.accent
    ? computeReadableForeground(accent)
    : base.accentFg;

  const surface =
    custom?.surfaceTone && custom.surfaceTone in SURFACE_TONE_PRESETS
      ? SURFACE_TONE_PRESETS[custom.surfaceTone]
      : null;

  return {
    themeId: prefs.themeId,
    accent,
    accentBright,
    accentDeep,
    accentFg,
    secondary,
    bgMain: surface ? surface.bgMain : base.bgMain,
    bgSurface: surface ? surface.bgSurface : base.bgSurface,
    bgHeader: surface ? surface.bgHeader : base.bgHeader,
    bgTableHeader: surface ? surface.bgTableHeader : base.bgTableHeader,
    borderColor: custom?.accent ? hexToRgba(accent, 0.28) : base.borderColor,
    glowRgba: custom?.accent ? hexToRgba(accent, 0.24) : base.glowRgba,
    secondaryGlowRgba: custom?.secondary
      ? hexToRgba(secondary, 0.17)
      : base.secondaryGlowRgba,
    nodeColorHex: hexToNumber(accent),
    ringColorHex: hexToNumber(secondary),
    coreColorHex: hexToNumber(accentBright),
    isCustomized: Boolean(custom),
  };
}

export function getTiltConfig(intensity: SpatialTiltIntensity): {
  enabled: boolean;
  maxDeg: number;
  scaleHover: number;
} {
  if (intensity === 'off') {
    return { enabled: false, maxDeg: 0, scaleHover: 1 };
  }
  if (intensity === 'dynamic') {
    return { enabled: true, maxDeg: 4.5, scaleHover: 1.012 };
  }
  return { enabled: true, maxDeg: 2.2, scaleHover: 1.005 };
}

export function getDensityPaddingClass(density: SpatialCardDensity): string {
  if (density === 'compact') return 'p-3.5 sm:p-4';
  if (density === 'spacious') return 'p-6 sm:p-7';
  return 'p-4 sm:p-5';
}

export function applySpatial3DPrefsToDocument(
  rawPrefs?: Partial<Spatial3DPrefs> | null
): Spatial3DPrefs {
  const prefs = resolveSpatial3DPrefs(rawPrefs);
  if (typeof document === 'undefined') return prefs;

  const palette = resolveActiveSpatialPalette(prefs);
  const root = document.documentElement;

  root.dataset.spatialTheme = prefs.themeId;
  root.dataset.spatialTilt = prefs.tiltIntensity;
  root.dataset.spatialDensity = prefs.cardDensity;
  if (prefs.customColors?.surfaceTone) {
    root.dataset.spatialSurface = prefs.customColors.surfaceTone;
  } else {
    delete root.dataset.spatialSurface;
  }

  root.style.setProperty('--spatial-accent', palette.accent);
  root.style.setProperty('--spatial-secondary', palette.secondary);
  root.style.setProperty('--spatial-glow', palette.glowRgba);
  root.style.setProperty('--spatial-glow-secondary', palette.secondaryGlowRgba);

  root.style.setProperty('--bg-main', palette.bgMain);
  root.style.setProperty('--bg-surface', palette.bgSurface);
  root.style.setProperty('--bg-header', palette.bgHeader);
  root.style.setProperty('--bg-table-header', palette.bgTableHeader);
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-bright', palette.accentBright);
  root.style.setProperty('--accent-deep', palette.accentDeep);
  root.style.setProperty('--accent-fg', palette.accentFg);
  root.style.setProperty(
    '--bg-nav-active',
    `color-mix(in srgb, ${palette.accent} 17%, transparent)`
  );
  root.style.setProperty(
    '--row-hover-bg',
    `color-mix(in srgb, ${palette.accent} 12%, transparent)`
  );
  root.style.setProperty('--border-color', palette.borderColor);
  root.style.setProperty('--marine-caustic-1', palette.glowRgba);
  root.style.setProperty('--marine-caustic-2', palette.secondaryGlowRgba);
  root.style.setProperty('--accent-ai', palette.accent);
  root.style.setProperty('--accent-ai-glow', palette.glowRgba);

  return prefs;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.\-]{3,32}$/;

export function normalizeUsernameInput(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '');
}

export function validateAuthUsername(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeUsernameInput(raw);
  if (!normalized) {
    return { valid: false, normalized, error: 'يرجى إدخال اسم المستخدم (Username).' };
  }
  if (normalized.length < 3 || normalized.length > 32) {
    return {
      valid: false,
      normalized,
      error: 'يجب أن يكون اسم المستخدم بين 3 و 32 حرفًا أو رقمًا.',
    };
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'اسم المستخدم يقبل أحرفًا إنجليزية وأرقامًا والرموز (_ . -) فقط بدون مسافات.',
    };
  }
  return { valid: true, normalized };
}

export interface GradientMeshOrbSpec {
  id: string;
  gradient: string;
  sizeClass: string;
  initialPos: { top?: string; bottom?: string; left?: string; right?: string };
  animateX: number[];
  animateY: number[];
  animateScale: number[];
  animateRotate: number[];
  durationSec: number;
  opacity: number;
}

/**
 * Generates deterministic, theme-synchronized Gradient Mesh orb trajectories
 * that smoothly shift focal balance across slides without runtime color parsing bugs.
 */
export function buildGradientMeshLayers(
  rawPrefs?: Partial<Spatial3DPrefs> | null,
  slideIndex = 0,
  intensity: 'vibrant' | 'medium' | 'subtle' = 'vibrant'
): {
  palette: ResolvedSpatialPalette;
  orbs: GradientMeshOrbSpec[];
} {
  const palette = resolveActiveSpatialPalette(rawPrefs);
  const idx = ((Math.trunc(slideIndex) % 3) + 3) % 3;
  const alphaBoost = intensity === 'vibrant' ? 1 : intensity === 'medium' ? 0.72 : 0.44;

  const shiftX = idx === 0 ? 0 : idx === 1 ? 52 : -44;
  const shiftY = idx === 0 ? 0 : idx === 1 ? -34 : 38;

  const orbs: GradientMeshOrbSpec[] = [
    {
      id: 'aurora-primary',
      gradient: `radial-gradient(circle at 38% 38%, ${hexToRgba(palette.accent, 0.52 * alphaBoost)} 0%, ${hexToRgba(palette.accentDeep, 0.24 * alphaBoost)} 48%, transparent 74%)`,
      sizeClass: 'w-[540px] h-[540px] sm:w-[700px] sm:h-[700px]',
      initialPos: { top: '-16%', right: '-10%' },
      animateX: [shiftX, shiftX - 58, shiftX + 26, shiftX],
      animateY: [shiftY, shiftY + 42, shiftY - 22, shiftY],
      animateScale: [1, 1.14, 0.94, 1],
      animateRotate: [0, 22, -14, 0],
      durationSec: 16,
      opacity: 0.92,
    },
    {
      id: 'aurora-secondary',
      gradient: `radial-gradient(circle at 55% 45%, ${hexToRgba(palette.secondary, 0.46 * alphaBoost)} 0%, ${hexToRgba(palette.accent, 0.18 * alphaBoost)} 52%, transparent 76%)`,
      sizeClass: 'w-[480px] h-[480px] sm:w-[640px] sm:h-[640px]',
      initialPos: { bottom: '-18%', left: '-12%' },
      animateX: [-shiftX * 0.7, -shiftX * 0.7 + 64, -shiftX * 0.7 - 30, -shiftX * 0.7],
      animateY: [-shiftY * 0.7, -shiftY * 0.7 - 48, -shiftY * 0.7 + 28, -shiftY * 0.7],
      animateScale: [1.04, 0.92, 1.16, 1.04],
      animateRotate: [0, -28, 16, 0],
      durationSec: 19,
      opacity: 0.88,
    },
    {
      id: 'aurora-prism-core',
      gradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(palette.accentBright, 0.34 * alphaBoost)} 0%, ${hexToRgba(palette.secondary, 0.16 * alphaBoost)} 44%, transparent 72%)`,
      sizeClass: 'w-[380px] h-[380px] sm:w-[520px] sm:h-[520px]',
      initialPos: { top: '24%', left: '22%' },
      animateX: [idx * 24 - 24, idx * 24 + 48, idx * 24 - 56, idx * 24 - 24],
      animateY: [idx * -18 + 18, idx * -18 - 32, idx * -18 + 44, idx * -18 + 18],
      animateScale: [0.95, 1.18, 0.98, 0.95],
      animateRotate: [0, 35, -25, 0],
      durationSec: 14,
      opacity: 0.8,
    },
    {
      id: 'aurora-deep-caustic',
      gradient: `conic-gradient(from ${idx * 60}deg at 50% 50%, ${hexToRgba(palette.accent, 0.28 * alphaBoost)}, ${hexToRgba(palette.secondary, 0.24 * alphaBoost)}, transparent 58%, ${hexToRgba(palette.accentBright, 0.22 * alphaBoost)}, transparent)`,
      sizeClass: 'w-[620px] h-[620px] sm:w-[820px] sm:h-[820px]',
      initialPos: { top: '8%', right: '14%' },
      animateX: [0, -34, 28, 0],
      animateY: [0, 24, -30, 0],
      animateScale: [1, 1.06, 0.96, 1],
      animateRotate: [0, 120, 240, 360],
      durationSec: 28,
      opacity: 0.55,
    },
  ];

  return { palette, orbs };
}

export interface HubOrbTelemetry {
  satelliteCount: number;
  ringSpinRate: number;
  healthPct: number;
  alertIntensity: number;
}

/**
 * Maps real portfolio telemetry into geometric astrolabe parameters for MorrowHubOrb3D.
 */
export function computeHubOrbTelemetry(
  agencyCount: number,
  activeIndividuals: number,
  issueCount: number
): HubOrbTelemetry {
  const safeAgencies = Math.max(0, Math.trunc(agencyCount));
  const safeIndividuals = Math.max(0, Math.trunc(activeIndividuals));
  const safeIssues = Math.max(0, Math.trunc(issueCount));

  const satelliteCount = Math.min(8, Math.max(3, safeAgencies || 3));
  const activityFactor = Math.min(1, safeIndividuals / 600);
  const ringSpinRate = Number((0.42 + activityFactor * 0.55).toFixed(2));

  const denominator = Math.max(1, safeAgencies * 2);
  const healthPct =
    safeAgencies === 0
      ? 100
      : Math.max(18, Math.min(100, Math.round(100 - (safeIssues / denominator) * 70)));
  const alertIntensity =
    safeAgencies === 0 ? 0 : Number(Math.min(1, safeIssues / denominator).toFixed(2));

  return {
    satelliteCount,
    ringSpinRate,
    healthPct,
    alertIntensity,
  };
}

