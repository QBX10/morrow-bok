export type ThemeId =
  | 'quantum_glass'
  | 'terminal_brutalist'
  | 'solar_paper'
  | 'aurora_bento';

export type WorkspaceModeId = 'focus' | 'creative' | 'audit' | 'night';

export type SoundPaletteId = 'glass' | 'terminal' | 'paper' | 'bento';

export interface ModeDefinition {
  id: WorkspaceModeId;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  accentOverrideByTheme: Record<ThemeId, string>;
  glowColor: string;
  ambientRate: number;
  ambientDetune: number;
}

export interface ThemeTokens {
  id: ThemeId;
  nameAr: string;
  nameEn: string;
  subtitleAr: string;
  subtitleEn: string;
  colorScheme: 'dark' | 'light';
  soundPalette: SoundPaletteId;
  bgApp: string;
  bgSurface: string;
  bgSurfaceElevated: string;
  bgInput: string;
  surfaceBorder: string;
  surfaceBlur: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentFg: string;
  accentGlow: string;
  warning: string;
  danger: string;
  success: string;
  radiusCard: string;
  radiusControl: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  cardShadow: string;
  gridOverlay: string;
  scanlineOpacity: number;
  noiseOpacity: number;
  springConfig: { stiffness: number; damping: number; mass: number };
  bentoGradients: {
    violet: string;
    teal: string;
    coral: string;
    amber: string;
  };
}

export const MODES: Record<WorkspaceModeId, ModeDefinition> = {
  focus: {
    id: 'focus',
    labelAr: 'تركيز عميق',
    labelEn: 'Deep Focus',
    descAr: 'تباين هادئ وإيقاع صوتي مستقر لجلسات التحليل والجداول.',
    descEn: 'Balanced contrast and steady acoustic pacing for deep work.',
    accentOverrideByTheme: {
      quantum_glass: '#3DD6F5',
      terminal_brutalist: '#39FF88',
      solar_paper: '#D9481F',
      aurora_bento: '#2DD4BF',
    },
    glowColor: 'rgba(61, 214, 245, 0.36)',
    ambientRate: 1.0,
    ambientDetune: 0,
  },
  creative: {
    id: 'creative',
    labelAr: 'إبداع وتوليد',
    labelEn: 'Creative Flow',
    descAr: 'توهج أوسع وألوان حيوية للتعاون مع المساعد وبناء النماذج.',
    descEn: 'Expressive accent energy tailored for AI co-creation.',
    accentOverrideByTheme: {
      quantum_glass: '#A78BFA',
      terminal_brutalist: '#5CE1E6',
      solar_paper: '#C2410C',
      aurora_bento: '#F472B6',
    },
    glowColor: 'rgba(167, 139, 250, 0.4)',
    ambientRate: 1.04,
    ambientDetune: 60,
  },
  audit: {
    id: 'audit',
    labelAr: 'تدقيق محاسبي',
    labelEn: 'Precision Audit',
    descAr: 'سطوح عالية الوضوح وأرقام جدولية دقيقة لفحص الصيغ.',
    descEn: 'High-clarity tabular contrast tuned for spreadsheet auditing.',
    accentOverrideByTheme: {
      quantum_glass: '#34D399',
      terminal_brutalist: '#FFB000',
      solar_paper: '#B45309',
      aurora_bento: '#FBBF24',
    },
    glowColor: 'rgba(52, 211, 153, 0.36)',
    ambientRate: 0.96,
    ambientDetune: -40,
  },
  night: {
    id: 'night',
    labelAr: 'عمل ليلي هادئ',
    labelEn: 'Night Shift',
    descAr: 'سطوع مخفّض وإشارات صوتية ناعمة لساعات العمل المتأخرة.',
    descEn: 'Low-glare luminance and softened transients for late sessions.',
    accentOverrideByTheme: {
      quantum_glass: '#60A5FA',
      terminal_brutalist: '#22C55E',
      solar_paper: '#9A3412',
      aurora_bento: '#818CF8',
    },
    glowColor: 'rgba(96, 165, 250, 0.32)',
    ambientRate: 0.92,
    ambientDetune: -80,
  },
};

export const THEMES: Record<ThemeId, ThemeTokens> = {
  quantum_glass: {
    id: 'quantum_glass',
    nameAr: 'زجاج كمومي',
    nameEn: 'Quantum Glass',
    subtitleAr: 'سطوح زجاجية عميقة مع شبكة هندسية وتوهج سماوي',
    subtitleEn: 'Deep obsidian canvas, 24px frosted glass & blueprint grid',
    colorScheme: 'dark',
    soundPalette: 'glass',
    bgApp: '#05070F',
    bgSurface: 'rgba(12, 18, 36, 0.72)',
    bgSurfaceElevated: 'rgba(18, 26, 48, 0.86)',
    bgInput: 'rgba(8, 12, 24, 0.85)',
    surfaceBorder: 'rgba(255, 255, 255, 0.12)',
    surfaceBlur: '24px',
    textPrimary: '#F1F5FF',
    textMuted: '#94A3C4',
    accent: '#3DD6F5',
    accentFg: '#03131A',
    accentGlow: 'rgba(61, 214, 245, 0.34)',
    warning: '#FBBF24',
    danger: '#FB7185',
    success: '#34D399',
    radiusCard: '20px',
    radiusControl: '14px',
    fontDisplay: "'IBM Plex Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif",
    fontBody: "'IBM Plex Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif",
    fontMono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
    cardShadow: '0 20px 44px -20px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    gridOverlay:
      'linear-gradient(to right, rgba(61, 214, 245, 0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(61, 214, 245, 0.055) 1px, transparent 1px)',
    scanlineOpacity: 0,
    noiseOpacity: 0.045,
    springConfig: { stiffness: 300, damping: 28, mass: 0.9 },
    bentoGradients: {
      violet: 'linear-gradient(145deg, rgba(99, 102, 241, 0.16), rgba(15, 23, 42, 0.72))',
      teal: 'linear-gradient(145deg, rgba(61, 214, 245, 0.16), rgba(15, 23, 42, 0.72))',
      coral: 'linear-gradient(145deg, rgba(251, 113, 133, 0.14), rgba(15, 23, 42, 0.72))',
      amber: 'linear-gradient(145deg, rgba(251, 191, 36, 0.14), rgba(15, 23, 42, 0.72))',
    },
  },
  terminal_brutalist: {
    id: 'terminal_brutalist',
    nameAr: 'طرفية فوسفورية',
    nameEn: 'Terminal Brutalist',
    subtitleAr: 'أحادية عالية الكثافة بحدود 1px بدون انحناء وخطوط فوسفورية',
    subtitleEn: 'Pure black phosphor green, 0px radius, scanlines & monospace',
    colorScheme: 'dark',
    soundPalette: 'terminal',
    bgApp: '#000000',
    bgSurface: '#050805',
    bgSurfaceElevated: '#09110A',
    bgInput: '#000000',
    surfaceBorder: 'rgba(57, 255, 136, 0.42)',
    surfaceBlur: '0px',
    textPrimary: '#D9FFE7',
    textMuted: '#68B888',
    accent: '#39FF88',
    accentFg: '#001407',
    accentGlow: 'rgba(57, 255, 136, 0.34)',
    warning: '#FFB000',
    danger: '#FF3B30',
    success: '#39FF88',
    radiusCard: '0px',
    radiusControl: '0px',
    fontDisplay: "'JetBrains Mono', 'IBM Plex Mono', 'IBM Plex Sans Arabic', monospace",
    fontBody: "'IBM Plex Mono', 'IBM Plex Sans Arabic', monospace",
    fontMono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
    cardShadow: 'none',
    gridOverlay: 'none',
    scanlineOpacity: 0.16,
    noiseOpacity: 0.02,
    springConfig: { stiffness: 520, damping: 36, mass: 0.7 },
    bentoGradients: {
      violet: 'linear-gradient(180deg, #040B06 0%, #000000 100%)',
      teal: 'linear-gradient(180deg, #061209 0%, #000000 100%)',
      coral: 'linear-gradient(180deg, #120904 0%, #000000 100%)',
      amber: 'linear-gradient(180deg, #100D03 0%, #000000 100%)',
    },
  },
  solar_paper: {
    id: 'solar_paper',
    nameAr: 'ورق هندسي دافئ',
    nameEn: 'Solar Paper',
    subtitleAr: 'خلفية ورقية دافئة، خطوط طباعية معمارية ولمسة برتقالية واحدة',
    subtitleEn: 'Warm drafting paper, ink serif headings & crisp engineering rules',
    colorScheme: 'light',
    soundPalette: 'paper',
    bgApp: '#F7F2E8',
    bgSurface: '#FCF9F2',
    bgSurfaceElevated: '#FFFFFF',
    bgInput: '#F2EBE0',
    surfaceBorder: 'rgba(26, 22, 18, 0.16)',
    surfaceBlur: '0px',
    textPrimary: '#1A1612',
    textMuted: '#685D51',
    accent: '#D9481F',
    accentFg: '#FFFBF7',
    accentGlow: 'rgba(217, 72, 31, 0.22)',
    warning: '#B45309',
    danger: '#B91C1C',
    success: '#15803D',
    radiusCard: '8px',
    radiusControl: '6px',
    fontDisplay: "'Amiri', 'Playfair Display', 'IBM Plex Sans Arabic', serif",
    fontBody: "'IBM Plex Sans Arabic', 'DM Sans', system-ui, sans-serif",
    fontMono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
    cardShadow: '0 8px 24px -14px rgba(26, 22, 18, 0.18)',
    gridOverlay:
      'linear-gradient(to right, rgba(26, 22, 18, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(26, 22, 18, 0.04) 1px, transparent 1px)',
    scanlineOpacity: 0,
    noiseOpacity: 0.03,
    springConfig: { stiffness: 280, damping: 26, mass: 1 },
    bentoGradients: {
      violet: 'linear-gradient(180deg, #FCF9F2 0%, #F3ECE0 100%)',
      teal: 'linear-gradient(180deg, #FCF9F2 0%, #EFE8DC 100%)',
      coral: 'linear-gradient(180deg, #FCF6F2 0%, #F6E6DE 100%)',
      amber: 'linear-gradient(180deg, #FCF9F0 0%, #F4EBDA 100%)',
    },
  },
  aurora_bento: {
    id: 'aurora_bento',
    nameAr: 'بنتو شفق لوني',
    nameEn: 'Aurora Bento',
    subtitleAr: 'بلاطات لونية مشبعة بزوايا 28px وطباعة جريئة وفيزياء زنبركية',
    subtitleEn: 'Deep indigo canvas, saturated bento tiles & 28px playful geometry',
    colorScheme: 'dark',
    soundPalette: 'bento',
    bgApp: '#0E0B1F',
    bgSurface: '#171230',
    bgSurfaceElevated: '#211B42',
    bgInput: '#120E28',
    surfaceBorder: 'rgba(196, 181, 253, 0.2)',
    surfaceBlur: '14px',
    textPrimary: '#F7F5FF',
    textMuted: '#B7AFDA',
    accent: '#2DD4BF',
    accentFg: '#061B19',
    accentGlow: 'rgba(45, 212, 191, 0.36)',
    warning: '#FBBF24',
    danger: '#FB7185',
    success: '#34D399',
    radiusCard: '28px',
    radiusControl: '18px',
    fontDisplay: "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    fontBody: "'IBM Plex Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif",
    fontMono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
    cardShadow: '0 22px 46px -18px rgba(6, 4, 22, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
    gridOverlay: 'none',
    scanlineOpacity: 0,
    noiseOpacity: 0.025,
    springConfig: { stiffness: 390, damping: 21, mass: 0.85 },
    bentoGradients: {
      violet: 'linear-gradient(145deg, rgba(139, 92, 246, 0.42), rgba(49, 46, 129, 0.65))',
      teal: 'linear-gradient(145deg, rgba(20, 184, 166, 0.38), rgba(17, 94, 89, 0.62))',
      coral: 'linear-gradient(145deg, rgba(244, 63, 94, 0.38), rgba(136, 19, 55, 0.62))',
      amber: 'linear-gradient(145deg, rgba(245, 158, 11, 0.36), rgba(120, 53, 15, 0.62))',
    },
  },
};

export const THEME_LIST: ThemeTokens[] = [
  THEMES.quantum_glass,
  THEMES.terminal_brutalist,
  THEMES.solar_paper,
  THEMES.aurora_bento,
];

export const MODE_LIST: ModeDefinition[] = [
  MODES.focus,
  MODES.creative,
  MODES.audit,
  MODES.night,
];

export function resolveThemeTokens(
  themeId: ThemeId,
  modeId: WorkspaceModeId
): ThemeTokens {
  const base = THEMES[themeId] ?? THEMES.quantum_glass;
  const mode = MODES[modeId] ?? MODES.focus;
  const modeAccent = mode.accentOverrideByTheme[base.id] ?? base.accent;
  return {
    ...base,
    accent: modeAccent,
    accentGlow: mode.glowColor || base.accentGlow,
  };
}

export function applyThemeTokensToDocument(
  themeId: ThemeId,
  modeId: WorkspaceModeId,
  dir: 'rtl' | 'ltr' = 'rtl'
): ThemeTokens {
  const tokens = resolveThemeTokens(themeId, modeId);
  if (typeof document === 'undefined') return tokens;

  const root = document.documentElement;
  root.setAttribute('data-theme', tokens.id);
  root.setAttribute('data-mode', modeId);
  root.setAttribute('data-color-scheme', tokens.colorScheme);
  root.setAttribute('dir', dir);
  root.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
  if (tokens.colorScheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const vars: Record<string, string> = {
    '--bg-main': tokens.bgApp,
    '--bg-app': tokens.bgApp,
    '--bg-surface': tokens.bgSurface,
    '--bg-surface-elevated': tokens.bgSurfaceElevated,
    '--bg-table-header': tokens.bgSurfaceElevated,
    '--bg-input': tokens.bgInput,
    '--border-color': tokens.surfaceBorder,
    '--surface-border': tokens.surfaceBorder,
    '--grid-color': tokens.surfaceBorder,
    '--surface-blur': tokens.surfaceBlur,
    '--text-primary': tokens.textPrimary,
    '--text-muted': tokens.textMuted,
    '--accent': tokens.accent,
    '--accent-bright': tokens.accent,
    '--accent-deep': tokens.accent,
    '--accent-fg': tokens.accentFg,
    '--accent-glow': tokens.accentGlow,
    '--warning': tokens.warning,
    '--danger': tokens.danger,
    '--success': tokens.success,
    '--radius-card': tokens.radiusCard,
    '--card-radius': tokens.radiusCard,
    '--radius-control': tokens.radiusControl,
    '--btn-radius': tokens.radiusControl,
    '--font-display': tokens.fontDisplay,
    '--font-body': tokens.fontBody,
    '--app-font-family': tokens.fontBody,
    '--font-mono': tokens.fontMono,
    '--font-mono-num': tokens.fontMono,
    '--card-shadow': tokens.cardShadow,
    '--grid-overlay': tokens.gridOverlay,
    '--scanline-opacity': String(tokens.scanlineOpacity),
    '--noise-opacity': String(tokens.noiseOpacity),
    '--bento-violet': tokens.bentoGradients.violet,
    '--bento-teal': tokens.bentoGradients.teal,
    '--bento-coral': tokens.bentoGradients.coral,
    '--bento-amber': tokens.bentoGradients.amber,
  };

  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }

  return tokens;
}
