import type {
  AppThemeId,
  AppView,
  Motion2DIntensity,
  Surface2DPrefs,
  Surface2DThemeId,
  SurfaceCardDensity,
  SurfaceCustomColors,
  SurfaceToneId,
} from '../types/agency.ts';
import {
  DAYLIGHT_ALABASTER_THEME,
  OBSIDIAN_GOLD_THEME,
  resolveAutoThemeTarget,
} from './themes.ts';

export interface Surface2DThemeDefinition {
  id: Surface2DThemeId;
  nameAr: string;
  subtitleAr: string;
  isDark?: boolean;
  isAuto?: boolean;
  bgMain: string;
  bgSurface: string;
  bgHeader: string;
  bgTableHeader: string;
  accent: string;
  accentBright: string;
  accentDeep: string;
  accentFg: string;
  secondary: string;
  textPrimary: string;
  textMuted: string;
  borderColor: string;
  glowRgba: string;
  secondaryGlowRgba: string;
  swatches: [string, string, string];
}

export interface ResolvedSurfacePalette {
  themeId: Surface2DThemeId;
  isDark: boolean;
  accent: string;
  accentBright: string;
  accentDeep: string;
  accentFg: string;
  secondary: string;
  bgMain: string;
  bgSurface: string;
  bgHeader: string;
  bgTableHeader: string;
  textPrimary: string;
  textMuted: string;
  borderColor: string;
  glowRgba: string;
  secondaryGlowRgba: string;
  isCustomized: boolean;
}

export const DEFAULT_SURFACE_2D_PREFS: Surface2DPrefs = {
  themeId: 'obsidian_gold',
  motionIntensity: 'subtle',
  cardDensity: 'balanced',
};

export const SURFACE_TONE_PRESETS: Record<
  SurfaceToneId,
  {
    labelAr: string;
    isDark: boolean;
    bgMain: string;
    bgSurface: string;
    bgHeader: string;
    bgTableHeader: string;
    textPrimary: string;
    textMuted: string;
  }
> = {
  obsidian: {
    labelAr: 'سبج فحمي هادئ',
    isDark: true,
    bgMain: '#070708',
    bgSurface: '#101012',
    bgHeader: '#0B0B0D',
    bgTableHeader: '#171614',
    textPrimary: '#F4F1EA',
    textMuted: '#9E9689',
  },
  abyssal: {
    labelAr: 'أعماق داكنة',
    isDark: true,
    bgMain: '#050A14',
    bgSurface: '#0C172B',
    bgHeader: '#07101F',
    bgTableHeader: '#12223E',
    textPrimary: '#F3F7FC',
    textMuted: '#9FB4CC',
  },
  midnight: {
    labelAr: 'ليل ياقوتي',
    isDark: true,
    bgMain: '#050A18',
    bgSurface: '#0E1935',
    bgHeader: '#081026',
    bgTableHeader: '#152447',
    textPrimary: '#EFF6FF',
    textMuted: '#96ADCF',
  },
  graphite: {
    labelAr: 'تيتانيوم داكن',
    isDark: true,
    bgMain: '#0A0D12',
    bgSurface: '#141922',
    bgHeader: '#0E1219',
    bgTableHeader: '#1B222E',
    textPrimary: '#F1F5F9',
    textMuted: '#94A3B8',
  },
  alabaster: {
    labelAr: 'مرمر نهاري فاتح',
    isDark: false,
    bgMain: '#F2F4F8',
    bgSurface: '#FFFFFF',
    bgHeader: '#F8FAFC',
    bgTableHeader: '#E8EDF4',
    textPrimary: '#0F172A',
    textMuted: '#475569',
  },
};

export const CURATED_ACCENT_SWATCHES = [
  '#D4AF37',
  '#10E0A6',
  '#22D3EE',
  '#60A5FA',
  '#2DD4BF',
  '#A855F7',
  '#F43F5E',
  '#B45309',
] as const;

export const CURATED_SECONDARY_SWATCHES = [
  '#C89B3C',
  '#38BDF8',
  '#818CF8',
  '#34D399',
  '#A78BFA',
  '#FB7185',
  '#059669',
  '#06B6D4',
] as const;

export const SURFACE_2D_THEMES: Record<Surface2DThemeId, Surface2DThemeDefinition> = {
  obsidian_gold: {
    id: 'obsidian_gold',
    nameAr: 'السبح والذهب (التلقائي)',
    subtitleAr: 'تناغم هادئ وعصري بين السواد السبجي والذهب المصقول',
    isDark: true,
    bgMain: '#070708',
    bgSurface: '#101012',
    bgHeader: '#0B0B0D',
    bgTableHeader: '#171614',
    accent: '#D4AF37',
    accentBright: '#EED278',
    accentDeep: '#9F7F22',
    accentFg: '#0B0904',
    secondary: '#C89B3C',
    textPrimary: '#F4F1EA',
    textMuted: '#9E9689',
    borderColor: 'rgba(212, 175, 55, 0.22)',
    glowRgba: 'rgba(212, 175, 55, 0.14)',
    secondaryGlowRgba: 'rgba(200, 155, 60, 0.08)',
    swatches: ['#070708', '#101012', '#D4AF37'],
  },
  emerald_smoked: {
    id: 'emerald_smoked',
    nameAr: 'العمق الزمردي',
    subtitleAr: 'خلفية داكنة هادئة بإضاءة زمردية متوازنة (60-30-10)',
    isDark: true,
    bgMain: '#050A14',
    bgSurface: '#0C172B',
    bgHeader: '#07101F',
    bgTableHeader: '#12223E',
    accent: '#10E0A6',
    accentBright: '#86FFDE',
    accentDeep: '#059669',
    accentFg: '#021712',
    secondary: '#38BDF8',
    textPrimary: '#F3F7FC',
    textMuted: '#9FB4CC',
    borderColor: 'rgba(56, 239, 194, 0.22)',
    glowRgba: 'rgba(16, 224, 166, 0.15)',
    secondaryGlowRgba: 'rgba(56, 189, 248, 0.10)',
    swatches: ['#050A14', '#0C172B', '#10E0A6'],
  },
  holographic_cyan: {
    id: 'holographic_cyan',
    nameAr: 'خندق ماريانا السماوي',
    subtitleAr: 'أزرق عميق هادئ مع لمسة سماوية صافية',
    isDark: true,
    bgMain: '#040914',
    bgSurface: '#0B182E',
    bgHeader: '#060F20',
    bgTableHeader: '#112340',
    accent: '#22D3EE',
    accentBright: '#A5F3FC',
    accentDeep: '#0284C7',
    accentFg: '#03131A',
    secondary: '#818CF8',
    textPrimary: '#EFFBFF',
    textMuted: '#90AECB',
    borderColor: 'rgba(34, 211, 238, 0.22)',
    glowRgba: 'rgba(34, 211, 238, 0.14)',
    secondaryGlowRgba: 'rgba(129, 140, 248, 0.10)',
    swatches: ['#040914', '#0B182E', '#22D3EE'],
  },
  crimson_obsidian: {
    id: 'crimson_obsidian',
    nameAr: 'الشعاب والأكوامارين',
    subtitleAr: 'أكوامارين متزن مع خلفية ليلية مريحة للعين',
    isDark: true,
    bgMain: '#050D17',
    bgSurface: '#0C1B2D',
    bgHeader: '#071322',
    bgTableHeader: '#12263F',
    accent: '#2DD4BF',
    accentBright: '#99F6E4',
    accentDeep: '#0F766E',
    accentFg: '#041A18',
    secondary: '#34D399',
    textPrimary: '#F0FDFA',
    textMuted: '#94B5BD',
    borderColor: 'rgba(45, 212, 191, 0.22)',
    glowRgba: 'rgba(45, 212, 191, 0.14)',
    secondaryGlowRgba: 'rgba(52, 211, 153, 0.10)',
    swatches: ['#050D17', '#0C1B2D', '#2DD4BF'],
  },
  royal_amethyst: {
    id: 'royal_amethyst',
    nameAr: 'العمق الياقوتي',
    subtitleAr: 'ياقوت ملكي وأردواز نيلي بتباين هادئ',
    isDark: true,
    bgMain: '#050A18',
    bgSurface: '#0E1935',
    bgHeader: '#081026',
    bgTableHeader: '#152447',
    accent: '#60A5FA',
    accentBright: '#BFDBFE',
    accentDeep: '#2563EB',
    accentFg: '#040B1C',
    secondary: '#A78BFA',
    textPrimary: '#EFF6FF',
    textMuted: '#96ADCF',
    borderColor: 'rgba(96, 165, 250, 0.22)',
    glowRgba: 'rgba(96, 165, 250, 0.14)',
    secondaryGlowRgba: 'rgba(167, 139, 250, 0.10)',
    swatches: ['#050A18', '#0E1935', '#60A5FA'],
  },
  velvet_garnet: {
    id: 'velvet_garnet',
    nameAr: 'العنابي المخملي والذهب الوردي',
    subtitleAr: 'فخامة عنابية ثقيلة مع إضاءة وردية ذهبية دافئة',
    isDark: true,
    bgMain: '#090406',
    bgSurface: '#14090D',
    bgHeader: '#0D0508',
    bgTableHeader: '#1F0F15',
    accent: '#E14B6B',
    accentBright: '#FDA4AF',
    accentDeep: '#9F1239',
    accentFg: '#FFFFFF',
    secondary: '#E5B869',
    textPrimary: '#FDF2F4',
    textMuted: '#C49AA6',
    borderColor: 'rgba(225, 75, 107, 0.24)',
    glowRgba: 'rgba(225, 75, 107, 0.16)',
    secondaryGlowRgba: 'rgba(229, 184, 105, 0.10)',
    swatches: ['#090406', '#1F0F15', '#E14B6B'],
  },
  espresso_bronze: {
    id: 'espresso_bronze',
    nameAr: 'الإسبرسو الداكن والنحاس المعتّق',
    subtitleAr: 'دفء نحاسي معتّق مع خشب إسبرسو داكن رصين',
    isDark: true,
    bgMain: '#090604',
    bgSurface: '#140E0A',
    bgHeader: '#0D0906',
    bgTableHeader: '#211710',
    accent: '#C87D4B',
    accentBright: '#F0B98A',
    accentDeep: '#8C4E26',
    accentFg: '#0F0905',
    secondary: '#D4AF37',
    textPrimary: '#F7EFE7',
    textMuted: '#B5A08F',
    borderColor: 'rgba(200, 125, 75, 0.24)',
    glowRgba: 'rgba(200, 125, 75, 0.16)',
    secondaryGlowRgba: 'rgba(212, 175, 55, 0.10)',
    swatches: ['#090604', '#211710', '#C87D4B'],
  },
  royal_plum: {
    id: 'royal_plum',
    nameAr: 'الأرجوان الإمبراطوري والشمبانيا',
    subtitleAr: 'عمق أرجواني ملكي مع إضاءة جمشتية وذهبية ناعمة',
    isDark: true,
    bgMain: '#08050E',
    bgSurface: '#130D20',
    bgHeader: '#0C0815',
    bgTableHeader: '#1D1530',
    accent: '#B374F7',
    accentBright: '#E9D5FF',
    accentDeep: '#7E22CE',
    accentFg: '#0B0514',
    secondary: '#E8C587',
    textPrimary: '#F6F2FF',
    textMuted: '#A89BC2',
    borderColor: 'rgba(179, 116, 247, 0.24)',
    glowRgba: 'rgba(179, 116, 247, 0.16)',
    secondaryGlowRgba: 'rgba(232, 197, 135, 0.10)',
    swatches: ['#08050E', '#1D1530', '#B374F7'],
  },
  platinum_graphite: {
    id: 'platinum_graphite',
    nameAr: 'الجرافيت البلاتيني الثقيل',
    subtitleAr: 'وقار معماري بلاتيني مع وضوح تنفيذي عالي التباين',
    isDark: true,
    bgMain: '#080A0D',
    bgSurface: '#11161D',
    bgHeader: '#0B0E13',
    bgTableHeader: '#1A212B',
    accent: '#CBD5E1',
    accentBright: '#F8FAFC',
    accentDeep: '#64748B',
    accentFg: '#080A0D',
    secondary: '#38BDF8',
    textPrimary: '#F1F5F9',
    textMuted: '#94A3B8',
    borderColor: 'rgba(203, 213, 225, 0.22)',
    glowRgba: 'rgba(203, 213, 225, 0.15)',
    secondaryGlowRgba: 'rgba(56, 189, 248, 0.10)',
    swatches: ['#080A0D', '#1A212B', '#CBD5E1'],
  },
  auto_adaptive: {
    id: 'auto_adaptive',
    nameAr: 'التكيّف التلقائي (نهاري / ليلي)',
    subtitleAr: 'المرمر النهاري الفاتح نهاراً والسبح والذهب ليلاً',
    isDark: true,
    isAuto: true,
    bgMain: '#F2F4F8',
    bgSurface: '#FFFFFF',
    bgHeader: '#F8FAFC',
    bgTableHeader: '#E8EDF4',
    accent: '#B45309',
    accentBright: '#92400E',
    accentDeep: '#78350F',
    accentFg: '#FFFFFF',
    secondary: '#059669',
    textPrimary: '#0F172A',
    textMuted: '#475569',
    borderColor: 'rgba(15, 23, 42, 0.13)',
    glowRgba: 'rgba(180, 83, 9, 0.12)',
    secondaryGlowRgba: 'rgba(5, 150, 105, 0.08)',
    swatches: ['#F2F4F8', '#D4AF37', '#070708'],
  },
  arctic_titanium: {
    id: 'arctic_titanium',
    nameAr: 'تيتانيوم قطبي',
    subtitleAr: 'رمادي معدني فولاذي مع إضاءة سماوية رصينة',
    isDark: true,
    bgMain: '#070B11',
    bgSurface: '#101823',
    bgHeader: '#0B111A',
    bgTableHeader: '#172332',
    accent: '#38BDF8',
    accentBright: '#BAE6FD',
    accentDeep: '#0369A1',
    accentFg: '#03131E',
    secondary: '#34D399',
    textPrimary: '#F0F9FF',
    textMuted: '#90ACC4',
    borderColor: 'rgba(56, 189, 248, 0.22)',
    glowRgba: 'rgba(56, 189, 248, 0.14)',
    secondaryGlowRgba: 'rgba(52, 211, 153, 0.10)',
    swatches: ['#070B11', '#101823', '#38BDF8'],
  },
};

export function mapAppThemeToSurfaceTheme(appThemeId?: string | null): Surface2DThemeId {
  switch (appThemeId) {
    case 'obsidian-gold':
      return 'obsidian_gold';
    case 'abyssal-emerald':
      return 'emerald_smoked';
    case 'midnight-trench':
      return 'holographic_cyan';
    case 'bioluminescent-reef':
      return 'crimson_obsidian';
    case 'pelagic-sapphire':
      return 'royal_amethyst';
    case 'velvet-garnet':
      return 'velvet_garnet';
    case 'espresso-bronze':
      return 'espresso_bronze';
    case 'royal-plum':
      return 'royal_plum';
    case 'platinum-graphite':
      return 'platinum_graphite';
    case 'auto':
    case 'daylight-alabaster':
      return 'auto_adaptive';
    default:
      return 'obsidian_gold';
  }
}

export function mapSurfaceThemeToAppTheme(surfaceId?: Surface2DThemeId | null): AppThemeId {
  switch (surfaceId) {
    case 'obsidian_gold':
      return 'obsidian-gold';
    case 'emerald_smoked':
      return 'abyssal-emerald';
    case 'holographic_cyan':
      return 'midnight-trench';
    case 'crimson_obsidian':
      return 'bioluminescent-reef';
    case 'royal_amethyst':
      return 'pelagic-sapphire';
    case 'velvet_garnet':
      return 'velvet-garnet';
    case 'espresso_bronze':
      return 'espresso-bronze';
    case 'royal_plum':
      return 'royal-plum';
    case 'platinum_graphite':
      return 'platinum-graphite';
    case 'auto_adaptive':
      return 'auto';
    case 'arctic_titanium':
      return 'midnight-trench';
    default:
      return 'obsidian-gold';
  }
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeHexColor(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_RE.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const norm = normalizeHexColor(hex) || '#D4AF37';
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return [r, g, b];
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
 * Computes high-contrast foreground color (#041216 dark or #FFFFFF light)
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
  raw?: SurfaceCustomColors | null
): SurfaceCustomColors | undefined {
  if (!raw) return undefined;
  const accent = normalizeHexColor(raw.accent);
  const secondary = normalizeHexColor(raw.secondary);
  const surfaceTone =
    raw.surfaceTone && raw.surfaceTone in SURFACE_TONE_PRESETS
      ? raw.surfaceTone
      : undefined;

  if (!accent && !secondary && !surfaceTone) return undefined;
  const cleaned: SurfaceCustomColors = {};
  if (accent) cleaned.accent = accent;
  if (secondary) cleaned.secondary = secondary;
  if (surfaceTone) cleaned.surfaceTone = surfaceTone;
  return cleaned;
}

export function resolveSurface2DPrefs(
  input?: (Partial<Surface2DPrefs> & { tiltIntensity?: unknown }) | null
): Surface2DPrefs {
  const rawTheme = input?.themeId as string | undefined;
  const normalizedTheme =
    rawTheme === 'solar_obsidian_gold' ? 'obsidian_gold' : rawTheme;
  const themeId: Surface2DThemeId =
    normalizedTheme && normalizedTheme in SURFACE_2D_THEMES
      ? (normalizedTheme as Surface2DThemeId)
      : DEFAULT_SURFACE_2D_PREFS.themeId;

  const rawMotion = input?.motionIntensity ?? input?.tiltIntensity;
  const motionIntensity: Motion2DIntensity =
    rawMotion === 'off' || rawMotion === 'subtle' || rawMotion === 'dynamic'
      ? rawMotion
      : DEFAULT_SURFACE_2D_PREFS.motionIntensity;

  const cardDensity: SurfaceCardDensity =
    input?.cardDensity === 'compact' ||
    input?.cardDensity === 'balanced' ||
    input?.cardDensity === 'spacious'
      ? input.cardDensity
      : DEFAULT_SURFACE_2D_PREFS.cardDensity;

  const customColors = sanitizeCustomColors(input?.customColors);

  return customColors
    ? { themeId, motionIntensity, cardDensity, customColors }
    : { themeId, motionIntensity, cardDensity };
}

export function getSurfaceThemeDef(themeId?: Surface2DThemeId | null): Surface2DThemeDefinition {
  if (themeId && themeId in SURFACE_2D_THEMES) {
    return SURFACE_2D_THEMES[themeId];
  }
  return SURFACE_2D_THEMES.obsidian_gold;
}

export function resolveActiveSurfacePalette(
  rawPrefs?: Partial<Surface2DPrefs> | null
): ResolvedSurfacePalette {
  const prefs = resolveSurface2DPrefs(rawPrefs);
  const custom = prefs.customColors;

  let base = getSurfaceThemeDef(prefs.themeId);
  if (prefs.themeId === 'auto_adaptive') {
    const target = resolveAutoThemeTarget();
    const isLight = !target.isDark;
    base = {
      ...base,
      isDark: target.isDark,
      bgMain: target.vars['--bg-main'],
      bgSurface: target.vars['--bg-surface'],
      bgHeader: target.vars['--bg-header'],
      bgTableHeader: target.vars['--bg-table-header'],
      accent: target.vars['--accent'],
      accentBright: target.vars['--accent-bright'],
      accentDeep: target.vars['--accent-deep'],
      accentFg: target.vars['--accent-fg'],
      secondary: target.vars['--spatial-secondary'],
      textPrimary: target.vars['--text-primary'],
      textMuted: target.vars['--text-muted'],
      borderColor: target.vars['--border-color'],
      glowRgba: target.vars['--marine-caustic-1'],
      secondaryGlowRgba: target.vars['--marine-caustic-2'],
      swatches: isLight
        ? [DAYLIGHT_ALABASTER_THEME.vars['--bg-main'], DAYLIGHT_ALABASTER_THEME.vars['--bg-surface'], DAYLIGHT_ALABASTER_THEME.vars['--accent']]
        : [OBSIDIAN_GOLD_THEME.vars['--bg-main'], OBSIDIAN_GOLD_THEME.vars['--bg-surface'], OBSIDIAN_GOLD_THEME.vars['--accent']],
    };
  }

  const surface =
    custom?.surfaceTone && custom.surfaceTone in SURFACE_TONE_PRESETS
      ? SURFACE_TONE_PRESETS[custom.surfaceTone]
      : null;

  const isDark = surface ? surface.isDark : base.isDark !== false;
  const accent = custom?.accent || base.accent;
  const secondary = custom?.secondary || base.secondary;
  const accentBright = custom?.accent
    ? isDark
      ? mixHexWithTarget(accent, [255, 255, 255], 0.42)
      : mixHexWithTarget(accent, [15, 23, 42], 0.25)
    : base.accentBright;
  const accentDeep = custom?.accent
    ? mixHexWithTarget(accent, [6, 6, 8], 0.45)
    : base.accentDeep;
  const accentFg = custom?.accent
    ? computeReadableForeground(accent)
    : base.accentFg;

  return {
    themeId: prefs.themeId,
    isDark,
    accent,
    accentBright,
    accentDeep,
    accentFg,
    secondary,
    bgMain: surface ? surface.bgMain : base.bgMain,
    bgSurface: surface ? surface.bgSurface : base.bgSurface,
    bgHeader: surface ? surface.bgHeader : base.bgHeader,
    bgTableHeader: surface ? surface.bgTableHeader : base.bgTableHeader,
    textPrimary: surface ? surface.textPrimary : base.textPrimary,
    textMuted: surface ? surface.textMuted : base.textMuted,
    borderColor: custom?.accent
      ? hexToRgba(accent, isDark ? 0.24 : 0.22)
      : base.borderColor,
    glowRgba: custom?.accent ? hexToRgba(accent, isDark ? 0.16 : 0.12) : base.glowRgba,
    secondaryGlowRgba: custom?.secondary
      ? hexToRgba(secondary, isDark ? 0.12 : 0.08)
      : base.secondaryGlowRgba,
    isCustomized: Boolean(custom),
  };
}

export function getMotion2DConfig(intensity: Motion2DIntensity): {
  enabled: boolean;
  liftPx: number;
  scaleHover: number;
} {
  if (intensity === 'off') {
    return { enabled: false, liftPx: 0, scaleHover: 1 };
  }
  if (intensity === 'dynamic') {
    return { enabled: true, liftPx: 3, scaleHover: 1.01 };
  }
  return { enabled: true, liftPx: 1.5, scaleHover: 1.004 };
}

export function getDensityPaddingClass(density: SurfaceCardDensity): string {
  if (density === 'compact') return 'p-3.5 sm:p-4';
  if (density === 'spacious') return 'p-6 sm:p-7';
  return 'p-4 sm:p-5';
}

export function applySurface2DPrefsToDocument(
  rawPrefs?: Partial<Surface2DPrefs> | null
): Surface2DPrefs {
  const prefs = resolveSurface2DPrefs(rawPrefs);
  if (typeof document === 'undefined') return prefs;

  const palette = resolveActiveSurfacePalette(prefs);
  const root = document.documentElement;

  root.dataset.surfaceTheme = prefs.themeId;
  root.dataset.motionIntensity = prefs.motionIntensity;
  root.dataset.surfaceDensity = prefs.cardDensity;
  if (prefs.customColors?.surfaceTone) {
    root.dataset.surfaceTone = prefs.customColors.surfaceTone;
  } else {
    delete root.dataset.surfaceTone;
  }

  if (palette.isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    root.dataset.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    root.dataset.colorScheme = 'light';
  }

  root.style.setProperty('--spatial-accent', palette.accent);
  root.style.setProperty('--spatial-secondary', palette.secondary);
  root.style.setProperty('--spatial-glow', palette.glowRgba);
  root.style.setProperty('--spatial-glow-secondary', palette.secondaryGlowRgba);

  root.style.setProperty('--bg-main', palette.bgMain);
  root.style.setProperty('--bg-surface', palette.bgSurface);
  root.style.setProperty('--bg-header', palette.bgHeader);
  root.style.setProperty('--bg-table-header', palette.bgTableHeader);
  root.style.setProperty('--text-primary', palette.textPrimary);
  root.style.setProperty('--text-muted', palette.textMuted);
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-bright', palette.accentBright);
  root.style.setProperty('--accent-deep', palette.accentDeep);
  root.style.setProperty('--accent-fg', palette.accentFg);
  root.style.setProperty(
    '--bg-nav-active',
    `color-mix(in srgb, ${palette.accent} ${palette.isDark ? '14%' : '11%'}, transparent)`
  );
  root.style.setProperty(
    '--row-hover-bg',
    `color-mix(in srgb, ${palette.accent} ${palette.isDark ? '11%' : '9%'}, transparent)`
  );
  root.style.setProperty(
    '--surface-well',
    palette.isDark
      ? 'color-mix(in srgb, var(--bg-main) 88%, #000000)'
      : 'color-mix(in srgb, var(--bg-table-header) 86%, var(--bg-main))'
  );
  root.style.setProperty(
    '--surface-subtle',
    palette.isDark
      ? 'color-mix(in srgb, var(--accent) 5%, transparent)'
      : 'color-mix(in srgb, var(--text-primary) 4%, transparent)'
  );
  root.style.setProperty(
    '--surface-pill',
    palette.isDark
      ? 'color-mix(in srgb, var(--bg-surface) 92%, transparent)'
      : '#FFFFFF'
  );
  root.style.setProperty(
    '--surface-overlay',
    palette.isDark ? 'rgba(5, 5, 6, 0.84)' : 'rgba(15, 23, 42, 0.42)'
  );
  root.style.setProperty('--border-color', palette.borderColor);
  root.style.setProperty(
    '--grid-color',
    palette.isDark
      ? `color-mix(in srgb, ${palette.accent} 11%, transparent)`
      : 'rgba(15, 23, 42, 0.09)'
  );
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

export interface Ambient2DLayerSpec {
  id: string;
  gradient: string;
  sizeClass: string;
  initialPos: { top?: string; bottom?: string; left?: string; right?: string };
  animateX: number[];
  animateY: number[];
  animateScale: number[];
  durationSec: number;
  opacity: number;
}

/**
 * Generates calm, GPU-friendly pure 2D ambient radial washes synchronized with the active theme.
 */
export function buildAmbientBackdropLayers(
  rawPrefs?: Partial<Surface2DPrefs> | null,
  slideIndex = 0,
  intensity: 'calm' | 'medium' = 'calm'
): {
  palette: ResolvedSurfacePalette;
  layers: Ambient2DLayerSpec[];
} {
  const palette = resolveActiveSurfacePalette(rawPrefs);
  const idx = ((Math.trunc(slideIndex) % 3) + 3) % 3;
  const alphaBoost = intensity === 'calm' ? 0.55 : 0.85;

  const shiftX = idx === 0 ? 0 : idx === 1 ? 36 : -32;
  const shiftY = idx === 0 ? 0 : idx === 1 ? -24 : 28;

  const layers: Ambient2DLayerSpec[] = [
    {
      id: 'ambient-primary',
      gradient: `radial-gradient(closest-side at 50% 50%, ${hexToRgba(palette.accent, 0.22 * alphaBoost)} 0%, ${hexToRgba(palette.accentDeep, 0.08 * alphaBoost)} 56%, transparent 100%)`,
      sizeClass: 'w-[520px] h-[520px] sm:w-[700px] sm:h-[700px]',
      initialPos: { top: '-16%', right: '-10%' },
      animateX: [shiftX, shiftX - 30, shiftX + 18, shiftX],
      animateY: [shiftY, shiftY + 24, shiftY - 14, shiftY],
      animateScale: [1, 1.06, 0.97, 1],
      durationSec: 22,
      opacity: 0.78,
    },
    {
      id: 'ambient-secondary',
      gradient: `radial-gradient(closest-side at 50% 50%, ${hexToRgba(palette.secondary, 0.16 * alphaBoost)} 0%, ${hexToRgba(palette.accent, 0.06 * alphaBoost)} 58%, transparent 100%)`,
      sizeClass: 'w-[460px] h-[460px] sm:w-[620px] sm:h-[620px]',
      initialPos: { bottom: '-18%', left: '-12%' },
      animateX: [-shiftX * 0.6, -shiftX * 0.6 + 32, -shiftX * 0.6 - 18, -shiftX * 0.6],
      animateY: [-shiftY * 0.6, -shiftY * 0.6 - 24, -shiftY * 0.6 + 16, -shiftY * 0.6],
      animateScale: [1.02, 0.96, 1.05, 1.02],
      durationSec: 26,
      opacity: 0.72,
    },
  ];

  return { palette, layers };
}

export interface HubDialTelemetry {
  satelliteCount: number;
  ringDurationSec: number;
  healthPct: number;
  alertIntensity: number;
}

/**
 * Maps live portfolio metrics into pure 2D SVG dial parameters for PortfolioDial2D.
 */
export function computeHubDialTelemetry(
  agencyCount: number,
  activeIndividuals: number,
  issueCount: number
): HubDialTelemetry {
  const safeAgencies = Math.max(0, Math.trunc(agencyCount));
  const safeIndividuals = Math.max(0, Math.trunc(activeIndividuals));
  const safeIssues = Math.max(0, Math.trunc(issueCount));

  const satelliteCount = Math.min(8, Math.max(3, safeAgencies || 3));
  const activityFactor = Math.min(1, safeIndividuals / 600);
  const ringDurationSec = Number((26 - activityFactor * 10).toFixed(1));

  const denominator = Math.max(1, safeAgencies * 2);
  const healthPct =
    safeAgencies === 0
      ? 100
      : Math.max(18, Math.min(100, Math.round(100 - (safeIssues / denominator) * 70)));
  const alertIntensity =
    safeAgencies === 0 ? 0 : Number(Math.min(1, safeIssues / denominator).toFixed(2));

  return {
    satelliteCount,
    ringDurationSec,
    healthPct,
    alertIntensity,
  };
}

export interface ViewBackdropPreset2D {
  offsetX: number;
  offsetY: number;
  ringOpacity: number;
}

const VIEW_BACKDROP_PRESETS: Record<AppView, ViewBackdropPreset2D> = {
  hub: { offsetX: 0, offsetY: 0, ringOpacity: 0.22 },
  agency_roster: { offsetX: 18, offsetY: -12, ringOpacity: 0.14 },
  master_roster: { offsetX: -16, offsetY: 14, ringOpacity: 0.14 },
  ready_lists: { offsetX: 12, offsetY: 16, ringOpacity: 0.18 },
  relationships: { offsetX: -20, offsetY: -10, ringOpacity: 0.18 },
  finance: { offsetX: 22, offsetY: 8, ringOpacity: 0.16 },
  quick_extract: { offsetX: -14, offsetY: -16, ringOpacity: 0.22 },
  data_archives: { offsetX: 14, offsetY: 18, ringOpacity: 0.14 },
  google_workspace: { offsetX: -12, offsetY: 12, ringOpacity: 0.16 },
  morrow_center: { offsetX: 8, offsetY: -14, ringOpacity: 0.24 },
  smart_models: { offsetX: -8, offsetY: -12, ringOpacity: 0.24 },
  account_security: { offsetX: 16, offsetY: -8, ringOpacity: 0.15 },
  settings: { offsetX: -10, offsetY: 10, ringOpacity: 0.15 },
};

export function getViewBackdropPreset(view: AppView = 'hub'): ViewBackdropPreset2D {
  return VIEW_BACKDROP_PRESETS[view] || VIEW_BACKDROP_PRESETS.hub;
}

export type MorrowCompanionMood = 'greet' | 'excited' | 'focus';

export interface MorrowCompanion2DState {
  orbitDurationSec: number;
  breathAmplitudePx: number;
  pulseScale: number;
  ringOpacity: number;
}

/**
 * Pure 2D state mapping for the calm geometric MorrowEmblem2D companion.
 */
export function resolveMorrowCompanionState(
  mood: MorrowCompanionMood,
  slideIndex = 0,
  pulseActive = false
): MorrowCompanion2DState {
  const safeSlide = ((Math.trunc(slideIndex) % 3) + 3) % 3;
  const baseOrbit = mood === 'excited' ? 14 : mood === 'focus' ? 20 : 26;
  return {
    orbitDurationSec: Math.max(10, baseOrbit - safeSlide * 2 - (pulseActive ? 3 : 0)),
    breathAmplitudePx: mood === 'excited' ? 6 : mood === 'focus' ? 2 : 4,
    pulseScale: pulseActive ? 1.05 : mood === 'excited' ? 1.03 : 1,
    ringOpacity: mood === 'excited' ? 0.52 : mood === 'focus' ? 0.42 : 0.34,
  };
}

export const MOTION_PULSE_EVENT = 'morrow:motion-pulse';

export function triggerGlobalMotionPulse(intensity = 1): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MOTION_PULSE_EVENT, {
      detail: {
        intensity: Math.max(0.2, Math.min(2, intensity)),
        timestamp: performance.now(),
      },
    })
  );
}
