import type {
  AppearanceProfile,
  AppThemeId,
  ArabicFontId,
  CardShadowLevel,
  FontSizeStep,
  FontWeightStep,
  MarineAppThemeId,
  RowDensityStep,
  TableThemeId,
  ThemePreferences,
} from '../types/agency';

export type ThemeCapsuleGroupId = 'marine' | 'classic';

export interface AppThemeDefinition {
  id: MarineAppThemeId;
  name: string;
  englishName: string;
  description: string;
  mood: string;
  isDark: true;
  capsuleGroup?: ThemeCapsuleGroupId;
  swatches: [string, string, string];
  vars: {
    '--bg-main': string;
    '--bg-surface': string;
    '--bg-header': string;
    '--bg-table-header': string;
    '--bg-nav-active': string;
    '--bg-zebra': string;
    '--bg-numeric': string;
    '--row-hover-bg': string;
    '--text-primary': string;
    '--text-muted': string;
    '--border-color': string;
    '--grid-color': string;
    '--accent': string;
    '--accent-bright': string;
    '--accent-deep': string;
    '--accent-fg': string;
    '--marine-caustic-1': string;
    '--marine-caustic-2': string;
    '--success': string;
    '--success-fg': string;
    '--success-bg': string;
    '--warning': string;
    '--warning-bg': string;
    '--danger': string;
    '--danger-fg': string;
    '--danger-bg': string;
  };
}

export const ABYSSAL_EMERALD_THEME: AppThemeDefinition = {
  id: 'abyssal-emerald',
  name: 'العمق الزمردي',
  englishName: 'Abyssal Emerald',
  mood: 'عمق سبجي بإضاءة زمردية سماوية',
  description:
    'أعماق سبجية ليلية (#040814) مع زجاجية مصقولة وإضاءة زمردية سماوية متلألئة (#10E0A6).',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#040814', '#091326', '#10E0A6'],
  vars: {
    '--bg-main': '#040814',
    '--bg-surface': '#091326',
    '--bg-header': '#060D1B',
    '--bg-table-header': '#0F1E38',
    '--bg-nav-active': 'rgba(16, 224, 166, 0.16)',
    '--bg-zebra': 'rgba(134, 255, 222, 0.028)',
    '--bg-numeric': 'rgba(16, 224, 166, 0.08)',
    '--row-hover-bg': 'rgba(16, 224, 166, 0.12)',
    '--text-primary': '#F1F5F9',
    '--text-muted': '#9FB4CC',
    '--border-color': 'rgba(56, 239, 194, 0.25)',
    '--grid-color': 'rgba(56, 239, 194, 0.13)',
    '--accent': '#10E0A6',
    '--accent-bright': '#86FFDE',
    '--accent-deep': '#059669',
    '--accent-fg': '#021712',
    '--marine-caustic-1': 'rgba(16, 224, 166, 0.18)',
    '--marine-caustic-2': 'rgba(34, 211, 238, 0.13)',
    '--success': '#10E0A6',
    '--success-fg': '#021C15',
    '--success-bg': 'rgba(16, 224, 166, 0.16)',
    '--warning': '#F59E0B',
    '--warning-bg': 'rgba(245, 158, 11, 0.16)',
    '--danger': '#F43F5E',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(244, 63, 94, 0.16)',
  },
};

export const MIDNIGHT_TRENCH_THEME: AppThemeDefinition = {
  id: 'midnight-trench',
  name: 'خندق ماريانا',
  englishName: 'Mariana Trench',
  mood: 'أزرق أعماق كهربائي نقي',
  description:
    'أزرق محيطي سحيق (#030812) بطبقات زجاجية شفافة وإشعاع فيروزي متوهج (#06B6D4).',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#030812', '#081426', '#06B6D4'],
  vars: {
    '--bg-main': '#030812',
    '--bg-surface': '#081426',
    '--bg-header': '#050D1A',
    '--bg-table-header': '#0C1C34',
    '--bg-nav-active': 'rgba(6, 182, 212, 0.17)',
    '--bg-zebra': 'rgba(103, 232, 249, 0.024)',
    '--bg-numeric': 'rgba(6, 182, 212, 0.075)',
    '--row-hover-bg': 'rgba(6, 182, 212, 0.12)',
    '--text-primary': '#ECFEFF',
    '--text-muted': '#8AA8C2',
    '--border-color': 'rgba(34, 211, 238, 0.24)',
    '--grid-color': 'rgba(34, 211, 238, 0.13)',
    '--accent': '#06B6D4',
    '--accent-bright': '#67E8F9',
    '--accent-deep': '#0E7490',
    '--accent-fg': '#03131A',
    '--marine-caustic-1': 'rgba(6, 182, 212, 0.17)',
    '--marine-caustic-2': 'rgba(59, 130, 246, 0.12)',
    '--success': '#10B981',
    '--success-fg': '#031F16',
    '--success-bg': 'rgba(16, 185, 129, 0.16)',
    '--warning': '#F59E0B',
    '--warning-bg': 'rgba(245, 158, 11, 0.16)',
    '--danger': '#F43F5E',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(244, 63, 94, 0.16)',
  },
};

export const BIOLUMINESCENT_REEF_THEME: AppThemeDefinition = {
  id: 'bioluminescent-reef',
  name: 'الشعاب المضيئة',
  englishName: 'Bioluminescent Reef',
  mood: 'توهج مرجاني وأكوامارين حي',
  description:
    'خلفية بحرية نيلية داكنة (#050C16) مع بريق الأكوامارين المضيء (#2DD4BF) وتدرج حريري.',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#050C16', '#0B1A2D', '#2DD4BF'],
  vars: {
    '--bg-main': '#050C16',
    '--bg-surface': '#0B1A2D',
    '--bg-header': '#071221',
    '--bg-table-header': '#10243C',
    '--bg-nav-active': 'rgba(45, 212, 191, 0.16)',
    '--bg-zebra': 'rgba(153, 246, 228, 0.025)',
    '--bg-numeric': 'rgba(45, 212, 191, 0.07)',
    '--row-hover-bg': 'rgba(45, 212, 191, 0.12)',
    '--text-primary': '#F0FDFA',
    '--text-muted': '#8FB2BA',
    '--border-color': 'rgba(45, 212, 191, 0.24)',
    '--grid-color': 'rgba(45, 212, 191, 0.13)',
    '--accent': '#2DD4BF',
    '--accent-bright': '#99F6E4',
    '--accent-deep': '#0F766E',
    '--accent-fg': '#041A18',
    '--marine-caustic-1': 'rgba(45, 212, 191, 0.16)',
    '--marine-caustic-2': 'rgba(16, 185, 129, 0.11)',
    '--success': '#10B981',
    '--success-fg': '#031F16',
    '--success-bg': 'rgba(16, 185, 129, 0.16)',
    '--warning': '#FBBF24',
    '--warning-bg': 'rgba(251, 191, 36, 0.16)',
    '--danger': '#FB7185',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(251, 113, 133, 0.16)',
  },
};

export const ARCTIC_FJORD_THEME: AppThemeDefinition = {
  id: 'arctic-fjord',
  name: 'المضيق القطبي',
  englishName: 'Arctic Fjord',
  mood: 'جليد بحري صافٍ وإضاءة سماوية',
  description:
    'أردواز بحري عميق (#07111C) مع أسطح كريستالية صافية ولمسات سماوية باردة (#38BDF8).',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#07111C', '#0F1E30', '#38BDF8'],
  vars: {
    '--bg-main': '#07111C',
    '--bg-surface': '#0F1E30',
    '--bg-header': '#091624',
    '--bg-table-header': '#14273E',
    '--bg-nav-active': 'rgba(56, 189, 248, 0.17)',
    '--bg-zebra': 'rgba(186, 230, 253, 0.024)',
    '--bg-numeric': 'rgba(56, 189, 248, 0.075)',
    '--row-hover-bg': 'rgba(56, 189, 248, 0.12)',
    '--text-primary': '#F0F9FF',
    '--text-muted': '#90ACC4',
    '--border-color': 'rgba(56, 189, 248, 0.25)',
    '--grid-color': 'rgba(56, 189, 248, 0.13)',
    '--accent': '#38BDF8',
    '--accent-bright': '#BAE6FD',
    '--accent-deep': '#0284C7',
    '--accent-fg': '#041421',
    '--marine-caustic-1': 'rgba(56, 189, 248, 0.16)',
    '--marine-caustic-2': 'rgba(45, 212, 191, 0.11)',
    '--success': '#10B981',
    '--success-fg': '#031F16',
    '--success-bg': 'rgba(16, 185, 129, 0.16)',
    '--warning': '#F59E0B',
    '--warning-bg': 'rgba(245, 158, 11, 0.16)',
    '--danger': '#F43F5E',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(244, 63, 94, 0.16)',
  },
};

export const PELAGIC_SAPPHIRE_THEME: AppThemeDefinition = {
  id: 'pelagic-sapphire',
  name: 'العمق الياقوتي',
  englishName: 'Pelagic Sapphire',
  mood: 'ياقوت بحري ملكي وعمق مهيب',
  description:
    'أعماق المحيط الهادئ الليلية (#050A18) مع زجاجية ياقوتية فاخرة (#60A5FA) وتباين حاد.',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#050A18', '#0D1730', '#60A5FA'],
  vars: {
    '--bg-main': '#050A18',
    '--bg-surface': '#0D1730',
    '--bg-header': '#081024',
    '--bg-table-header': '#132142',
    '--bg-nav-active': 'rgba(96, 165, 250, 0.17)',
    '--bg-zebra': 'rgba(191, 219, 254, 0.024)',
    '--bg-numeric': 'rgba(96, 165, 250, 0.075)',
    '--row-hover-bg': 'rgba(96, 165, 250, 0.12)',
    '--text-primary': '#EFF6FF',
    '--text-muted': '#92A8CC',
    '--border-color': 'rgba(96, 165, 250, 0.25)',
    '--grid-color': 'rgba(96, 165, 250, 0.13)',
    '--accent': '#60A5FA',
    '--accent-bright': '#BFDBFE',
    '--accent-deep': '#2563EB',
    '--accent-fg': '#040B1C',
    '--marine-caustic-1': 'rgba(96, 165, 250, 0.17)',
    '--marine-caustic-2': 'rgba(34, 211, 238, 0.11)',
    '--success': '#10B981',
    '--success-fg': '#031F16',
    '--success-bg': 'rgba(16, 185, 129, 0.16)',
    '--warning': '#F59E0B',
    '--warning-bg': 'rgba(245, 158, 11, 0.16)',
    '--danger': '#F43F5E',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(244, 63, 94, 0.16)',
  },
};

export const OBSIDIAN_GOLD_THEME = ABYSSAL_EMERALD_THEME;

export const MARINE_THEMES: AppThemeDefinition[] = [
  ABYSSAL_EMERALD_THEME,
  MIDNIGHT_TRENCH_THEME,
  BIOLUMINESCENT_REEF_THEME,
  ARCTIC_FJORD_THEME,
  PELAGIC_SAPPHIRE_THEME,
];

export const APP_THEMES: AppThemeDefinition[] = MARINE_THEMES;
export const MODERN_APP_THEMES: AppThemeDefinition[] = MARINE_THEMES;
export const ALL_APP_THEMES: AppThemeDefinition[] = MARINE_THEMES;

export const APP_THEME_CAPSULES: Array<{
  id: ThemeCapsuleGroupId;
  title: string;
  subtitle: string;
  themes: AppThemeDefinition[];
}> = [
  {
    id: 'marine',
    title: 'الثيمات البحرية المطلقة — Absolute Marine',
    subtitle: 'خمس هويات محيطية ثلاثية الأبعاد مصممة بأعماق مائية وزجاج مصقول',
    themes: MARINE_THEMES,
  },
];

const LEGACY_APP_THEME_MAP: Record<string, MarineAppThemeId> = {
  'emerald-forest': 'bioluminescent-reef',
  'charcoal-emerald': 'bioluminescent-reef',
  'soft-mint': 'bioluminescent-reef',
  'sage-linen': 'bioluminescent-reef',
  'arctic-snow': 'arctic-fjord',
  'nordic-dusk': 'arctic-fjord',
  'alabaster-glass': 'arctic-fjord',
  aurora: 'pelagic-sapphire',
  'nordic-navy': 'pelagic-sapphire',
  'midnight-slate': 'pelagic-sapphire',
  'midnight-indigo': 'pelagic-sapphire',
  cyberpunk: 'midnight-trench',
  'obsidian-gold': 'abyssal-emerald',
  'desert-mirage': 'abyssal-emerald',
  'royal-crimson': 'abyssal-emerald',
  'zen-minimal': 'arctic-fjord',
  'warm-paper': 'arctic-fjord',
  'crisp-daylight': 'arctic-fjord',
};

export function resolveAppThemeId(rawId?: string | null): MarineAppThemeId {
  if (!rawId) return 'abyssal-emerald';
  if (MARINE_THEMES.some((t) => t.id === rawId)) {
    return rawId as MarineAppThemeId;
  }
  return LEGACY_APP_THEME_MAP[rawId] || 'abyssal-emerald';
}

export interface TableThemeDefinition {
  id: TableThemeId;
  name: string;
  englishName: string;
  description: string;
}

export const TABLE_THEMES: TableThemeDefinition[] = [
  {
    id: 'glass',
    name: 'الجدول الزجاجي',
    englishName: 'Glass Table',
    description:
      'صفوف شفافة ناعمة بلمسة زجاجية بحرية وفواصل ضوئية خفيفة للغاية.',
  },
  {
    id: 'paper-ledger',
    name: 'الدفتر الورقي المحاسبي',
    englishName: 'Paper Ledger',
    description:
      'تصميم سجلات رسمية مطبوعة بخطوط واضحة وتظليل كلاسيكي للصفوف الزوجية.',
  },
  {
    id: 'data-grid',
    name: 'شبكة البيانات الاحترافية',
    englishName: 'Data Grid Pro',
    description:
      'شبكة متكاملة بحدود عمودية وأفقية دقيقة تمنع تداخل الأرقام الطويلة.',
  },
  {
    id: 'royal-executive',
    name: 'التنفيذي الملكي',
    englishName: 'Royal Executive',
    description:
      'رأس بارز باللون البحري المعتمد وتباين واضح للأعمدة الرقمية والحصص.',
  },
  {
    id: 'pastel-blocks',
    name: 'الكتل اللطيفة',
    englishName: 'Pastel Blocks',
    description:
      'فصل هادئ بين الصفوف بظلال ناعمة تناسب القوائم اليومية.',
  },
  {
    id: 'minimalist-lines',
    name: 'الخطوط الهادئة',
    englishName: 'Minimalist Lines',
    description:
      'أقصى بساطة بلا زخرفة مع خطوط فاصلة رفيعة لقراءة مريحة كالمستند.',
  },
  {
    id: 'neon-matrix',
    name: 'المصفوفة الرقمية',
    englishName: 'Neon Matrix',
    description:
      'توهج مائي خفيف عند التمرير وإبراز رقمي متساوٍ مخصص للتدقيق السريع.',
  },
  {
    id: 'card-based',
    name: 'العرض البطاقي المرن',
    englishName: 'Card-Based Table',
    description:
      'يحول كل سجل إلى بطاقة مستقلة ثلاثية الأبعاد تحتوي الاسم والأفراد والحصة والمبلغ والحالة.',
  },
];

const LEGACY_TABLE_MAP: Record<string, TableThemeId> = {
  'classic-quota': 'paper-ledger',
  'financial-audit': 'data-grid',
  'pdf-reader': 'minimalist-lines',
  'high-contrast': 'royal-executive',
  'compact-modern': 'glass',
};

export function resolveTableThemeId(rawId?: string | null): TableThemeId {
  if (!rawId) return 'glass';
  if (TABLE_THEMES.some((t) => t.id === rawId)) return rawId as TableThemeId;
  return LEGACY_TABLE_MAP[rawId] || 'glass';
}

export const ARABIC_FONTS: Array<{
  id: ArabicFontId;
  name: string;
  cssFamily: string;
  description: string;
}> = [
  {
    id: 'ibm-plex',
    name: 'IBM Plex Sans Arabic',
    cssFamily: "'IBM Plex Sans Arabic', 'Cairo', system-ui, sans-serif",
    description: 'الخط الافتراضي للقراءة والواجهات والأرقام المحاسبية الدقيقة.',
  },
  {
    id: 'cairo',
    name: 'Cairo',
    cssFamily: "'Cairo', 'Readex Pro', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    description: 'حديث وواضح في العناوين والبطاقات والجداول اليومية.',
  },
  {
    id: 'tajawal',
    name: 'Tajawal',
    cssFamily: "'Tajawal', 'Cairo', system-ui, sans-serif",
    description: 'ناعم ومريح جداً أثناء القراءة المطولة للأسماء والملاحظات.',
  },
  {
    id: 'almarai',
    name: 'Almarai',
    cssFamily: "'Almarai', 'Cairo', system-ui, sans-serif",
    description: 'هندسي متوازن عالي الوضوح حتى في الأحجام الصغيرة والمدمجة.',
  },
  {
    id: 'changa',
    name: 'Changa',
    cssFamily: "'Changa', 'Cairo', system-ui, sans-serif",
    description: 'عريض الحضور يميز الأرقام والعناوين الرئيسية بوضوح فوري.',
  },
  {
    id: 'el-messiri',
    name: 'El Messiri',
    cssFamily: "'El Messiri', 'Cairo', system-ui, sans-serif",
    description: 'طابع عربي أنيق وفخم يناسب التقارير الرسمية والبطاقات.',
  },
];

export function resolveArabicFontId(rawId?: string | null): ArabicFontId {
  if (!rawId) return 'ibm-plex';
  if (rawId === 'noto-sans') return 'ibm-plex';
  if (ARABIC_FONTS.some((f) => f.id === rawId)) return rawId as ArabicFontId;
  return 'ibm-plex';
}

export const FONT_SIZE_MAP: Record<FontSizeStep, { label: string; px: string; num: number }> = {
  sm: { label: 'صغير', px: '13px', num: 13 },
  md: { label: 'عادي', px: '15px', num: 15 },
  lg: { label: 'كبير', px: '17px', num: 17 },
  xl: { label: 'كبير جداً', px: '19px', num: 19 },
};

export const FONT_WEIGHT_MAP: Record<FontWeightStep, { label: string; weight: string }> = {
  light: { label: 'هادئ (400)', weight: '400' },
  normal: { label: 'متوازن (500)', weight: '500' },
  bold: { label: 'عريض للوضوح (700)', weight: '700' },
};

export const ROW_DENSITY_MAP: Record<
  RowDensityStep,
  { label: string; py: string; rowHeightPx: number; lineHeight: string }
> = {
  compact: { label: 'مضغوط', py: '6px', rowHeightPx: 34, lineHeight: '1.45' },
  comfortable: { label: 'متوازن', py: '10px', rowHeightPx: 42, lineHeight: '1.6' },
  spacious: { label: 'مريح', py: '14px', rowHeightPx: 52, lineHeight: '1.75' },
};

export const SHADOW_LEVEL_CSS: Record<CardShadowLevel, string> = {
  none: 'none',
  soft: '0 12px 28px -12px rgba(2, 10, 22, 0.65)',
  elevated: '0 22px 48px -14px rgba(2, 10, 22, 0.85)',
};

export const DEFAULT_APPEARANCE_PROFILES: AppearanceProfile[] = [
  {
    id: 'preset_night_work',
    name: 'وضع العمق الزمردي القياسي',
    appTheme: 'abyssal-emerald',
    tableTheme: 'glass',
    fontFamily: 'ibm-plex',
    fontSizePx: 15,
    rowHeightPx: 42,
    colWidthScale: 100,
    borderRadiusPx: 22,
    cardShadowLevel: 'soft',
    glassEffect: true,
    conditionalFormatting: {
      highlightBlockedRows: true,
      highlightDuplicateNames: true,
      highlightZeroIndividuals: true,
    },
  },
  {
    id: 'preset_fast_reading',
    name: 'وضع خندق ماريانا المكثف',
    appTheme: 'midnight-trench',
    tableTheme: 'data-grid',
    fontFamily: 'cairo',
    fontSizePx: 16,
    rowHeightPx: 46,
    colWidthScale: 105,
    borderRadiusPx: 20,
    cardShadowLevel: 'elevated',
    glassEffect: true,
    conditionalFormatting: {
      highlightBlockedRows: true,
      highlightDuplicateNames: true,
      highlightZeroIndividuals: true,
    },
  },
];

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  appTheme: 'abyssal-emerald',
  tableTheme: 'glass',
  fontFamily: 'ibm-plex',
  fontSize: 'md',
  fontWeight: 'normal',
  rowDensity: 'comfortable',
  fontSizePx: 15,
  rowHeightPx: 44,
  colWidthScale: 100,
  borderRadiusPx: 22,
  cardShadowLevel: 'soft',
  glassEffect: true,
  glassOpacityPct: 70,
  themeColorMode: 'dark',
  customBgColor: '',
  customSurfaceColor: '',
  customTextColor: '',
  customAccentColor: '',
  customSavedThemes: [],
  conditionalFormatting: {
    highlightBlockedRows: true,
    highlightDuplicateNames: true,
    highlightZeroIndividuals: true,
  },
  savedProfiles: DEFAULT_APPEARANCE_PROFILES,
  activeProfileId: null,
  tabularNumerals: true,
  rowHoverHighlight: true,
  stickyHeaderAndName: true,
  compactStatusBadges: true,
  smartNumericSplit: true,
  softGroupDividers: true,
  activeRowFocusMode: true,
};

export function getAppThemeById(id?: string | null): AppThemeDefinition {
  const resolvedId = resolveAppThemeId(id);
  return (
    ALL_APP_THEMES.find((t) => t.id === resolvedId) || ABYSSAL_EMERALD_THEME
  );
}

export function applyThemePreferencesToDocument(
  prefs: ThemePreferences,
  accessibility?: {
    reduceMotion?: boolean;
    oneHandedMode?: boolean;
    numeralSystem?: 'western' | 'hindi';
    calendarSystem?: 'gregorian' | 'hijri';
  }
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = getAppThemeById(prefs.appTheme);

  const fontId = resolveArabicFontId(prefs.fontFamily);
  const font = ARABIC_FONTS.find((f) => f.id === fontId) || ARABIC_FONTS[0];
  const sizeStep = FONT_SIZE_MAP[prefs.fontSize] || FONT_SIZE_MAP.md;
  const weight = FONT_WEIGHT_MAP[prefs.fontWeight] || FONT_WEIGHT_MAP.normal;
  const density =
    ROW_DENSITY_MAP[prefs.rowDensity] || ROW_DENSITY_MAP.comfortable;

  root.classList.add('dark');
  root.style.colorScheme = 'dark';

  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });

  const effectiveFontSizePx =
    typeof prefs.fontSizePx === 'number' && prefs.fontSizePx >= 11 && prefs.fontSizePx <= 26
      ? prefs.fontSizePx
      : sizeStep.num;

  const effectiveRowHeightPx =
    typeof prefs.rowHeightPx === 'number' && prefs.rowHeightPx >= 24 && prefs.rowHeightPx <= 84
      ? prefs.rowHeightPx
      : density.rowHeightPx;
  const computedPy = Math.max(3, Math.round((effectiveRowHeightPx - 20) / 2));

  const colWidthScale =
    typeof prefs.colWidthScale === 'number' &&
    prefs.colWidthScale >= 80 &&
    prefs.colWidthScale <= 140
      ? prefs.colWidthScale / 100
      : 1;

  const radiusPx =
    typeof prefs.borderRadiusPx === 'number' &&
    prefs.borderRadiusPx >= 2 &&
    prefs.borderRadiusPx <= 28
      ? prefs.borderRadiusPx
      : 22;

  const glassOpacity =
    typeof prefs.glassOpacityPct === 'number' &&
    prefs.glassOpacityPct >= 40 &&
    prefs.glassOpacityPct <= 100
      ? prefs.glassOpacityPct / 100
      : 0.7;

  const shadowCss =
    SHADOW_LEVEL_CSS[prefs.cardShadowLevel || 'soft'] || SHADOW_LEVEL_CSS.soft;

  root.style.setProperty('--app-font-family', font.cssFamily);
  root.style.setProperty('--app-font-size', `${effectiveFontSizePx}px`);
  root.style.setProperty('--app-font-weight', weight.weight);
  root.style.setProperty('--table-cell-py', `${computedPy}px`);
  root.style.setProperty('--table-line-height', density.lineHeight);
  root.style.setProperty('--table-col-scale', String(colWidthScale));
  root.style.setProperty('--card-radius', `${radiusPx}px`);
  root.style.setProperty('--glass-opacity', String(glassOpacity));
  root.style.setProperty('--card-shadow', shadowCss);
  root.style.setProperty('--accent-ai', theme.vars['--accent']);
  root.style.setProperty('--accent-ai-glow', theme.vars['--marine-caustic-1']);
  root.dataset.appTheme = theme.id;
  root.dataset.tableTheme = resolveTableThemeId(prefs.tableTheme);
  root.dataset.glass = prefs.glassEffect !== false ? '1' : '0';
  root.dataset.reduceMotion = accessibility?.reduceMotion ? '1' : '0';
  root.dataset.oneHanded = accessibility?.oneHandedMode ? '1' : '0';
  root.dataset.numerals = accessibility?.numeralSystem || 'western';
  root.dataset.calendar = accessibility?.calendarSystem || 'gregorian';
}

const HINDI_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function formatCosmosNumerals(
  input: string | number,
  numeralSystem: 'western' | 'hindi' = 'western'
): string {
  const str = String(input);
  if (numeralSystem !== 'hindi') return str;
  return str.replace(/\d/g, (d) => HINDI_DIGITS[Number(d)] || d);
}

export function formatCosmosDate(
  dateInput: string | Date,
  calendarSystem: 'gregorian' | 'hijri' = 'gregorian',
  numeralSystem: 'western' | 'hindi' = 'western'
): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return String(dateInput);
  try {
    const locale =
      calendarSystem === 'hijri'
        ? numeralSystem === 'hindi'
          ? 'ar-SA-u-ca-islamic-umalqura-nu-arab'
          : 'ar-IQ-u-ca-islamic-umalqura-nu-latn'
        : numeralSystem === 'hindi'
        ? 'ar-IQ-u-nu-arab'
        : 'ar-IQ-u-nu-latn';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return formatCosmosNumerals(d.toISOString().slice(0, 10), numeralSystem);
  }
}
