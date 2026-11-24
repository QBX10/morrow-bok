import type {
  AppearanceProfile,
  AppThemeId,
  ArabicFontId,
  CardShadowLevel,
  FontSizeStep,
  FontWeightStep,
  RowDensityStep,
  TableThemeId,
  ThemePreferences,
} from '../types/agency';

export type ThemeCapsuleGroupId = 'classic';

export interface AppThemeDefinition {
  id: AppThemeId;
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
    '--accent-fg': string;
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

export const OBSIDIAN_GOLD_THEME: AppThemeDefinition = {
  id: 'obsidian-gold',
  name: 'السبج والذهب',
  englishName: 'Obsidian & Gold',
  mood: 'الهوية البصرية الحصرية المعتمدة',
  description:
    'أسود سبجي عميق (#09090B) مع زجاجية داكنة مصقولة ولمسات ذهب معدني فاخرة (#D4AF37).',
  isDark: true,
  swatches: ['#09090B', '#121216', '#D4AF37'],
  vars: {
    '--bg-main': '#09090B',
    '--bg-surface': '#121216',
    '--bg-header': '#0D0D11',
    '--bg-table-header': '#16161C',
    '--bg-nav-active': 'rgba(212, 175, 55, 0.14)',
    '--bg-zebra': 'rgba(255, 255, 255, 0.024)',
    '--bg-numeric': 'rgba(212, 175, 55, 0.055)',
    '--row-hover-bg': 'rgba(212, 175, 55, 0.11)',
    '--text-primary': '#F4F4F6',
    '--text-muted': '#9898AA',
    '--border-color': 'rgba(212, 175, 55, 0.22)',
    '--grid-color': 'rgba(212, 175, 55, 0.12)',
    '--accent': '#D4AF37',
    '--accent-fg': '#09090B',
    '--success': '#10B981',
    '--success-fg': '#04271D',
    '--success-bg': 'rgba(16, 185, 129, 0.16)',
    '--warning': '#F5B041',
    '--warning-bg': 'rgba(245, 176, 65, 0.16)',
    '--danger': '#EF4444',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(239, 68, 68, 0.16)',
  },
};

// Locked single-theme architecture: Obsidian & Gold only.
export const APP_THEMES: AppThemeDefinition[] = [OBSIDIAN_GOLD_THEME];
export const MODERN_APP_THEMES: AppThemeDefinition[] = [];
export const ALL_APP_THEMES: AppThemeDefinition[] = [OBSIDIAN_GOLD_THEME];

export const APP_THEME_CAPSULES: Array<{
  id: ThemeCapsuleGroupId;
  title: string;
  subtitle: string;
  themes: AppThemeDefinition[];
}> = [
  {
    id: 'classic',
    title: 'الهوية المعتمدة — السبج والذهب',
    subtitle: 'نظام الألوان الوحيد المعتمد عبر كامل التطبيق',
    themes: APP_THEMES,
  },
];

export function resolveAppThemeId(_rawId?: string | null): AppThemeId {
  return 'obsidian-gold';
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
      'صفوف شفافة ناعمة بلمسة زجاجية وفواصل ذهبية خفيفة للغاية.',
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
      'رأس بارز باللون الذهبي وتباين واضح للأعمدة الرقمية والحصص.',
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
      'توهج ذهبي خفيف عند التمرير وإبراز رقمي متساوٍ مخصص للتدقيق السريع.',
  },
  {
    id: 'card-based',
    name: 'العرض البطاقي المرن',
    englishName: 'Card-Based Table',
    description:
      'يحول كل سجل إلى بطاقة مستقلة أنيقة تحتوي الاسم والأفراد والحصة والمبلغ والحالة.',
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
  soft: '0 8px 24px -10px rgba(0, 0, 0, 0.55)',
  elevated: '0 18px 42px -14px rgba(0, 0, 0, 0.78)',
};

export const DEFAULT_APPEARANCE_PROFILES: AppearanceProfile[] = [
  {
    id: 'preset_night_work',
    name: 'وضع السبج والذهب القياسي',
    appTheme: 'obsidian-gold',
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
    name: 'وضع التدقيق المكثف',
    appTheme: 'obsidian-gold',
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
  appTheme: 'obsidian-gold',
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
  glassOpacityPct: 68,
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

export function getAppThemeById(_id?: string | null): AppThemeDefinition {
  return OBSIDIAN_GOLD_THEME;
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
  const theme = OBSIDIAN_GOLD_THEME;

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
      : 0.68;

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
  root.style.setProperty('--accent-ai', '#D4AF37');
  root.style.setProperty('--accent-ai-glow', 'rgba(212, 175, 55, 0.42)');
  root.dataset.appTheme = 'obsidian-gold';
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
