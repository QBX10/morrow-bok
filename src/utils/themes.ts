import type {
  AppThemeId,
  ArabicFontId,
  FontSizeStep,
  FontWeightStep,
  RowDensityStep,
  TableThemeId,
  ThemePreferences,
} from '../types/agency';

export interface AppThemeDefinition {
  id: AppThemeId;
  name: string;
  englishName: string;
  description: string;
  isDark: boolean;
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

export const APP_THEMES: AppThemeDefinition[] = [
  {
    id: 'midnight-slate',
    name: 'الليلي العميق المريح',
    englishName: 'Midnight Slate Dark',
    description:
      'خلفية رمادية داكنة جداً مريحة للعين في الإضاءة المنخفضة، مع بطاقات أغمق ولمسات أزرق سماوي هادئ.',
    isDark: true,
    swatches: ['#0b1120', '#111827', '#38bdf8'],
    vars: {
      '--bg-main': '#0b1120',
      '--bg-surface': '#111827',
      '--bg-header': '#030712',
      '--bg-table-header': '#1e293b',
      '--bg-nav-active': '#0c2a44',
      '--bg-zebra': 'rgba(30, 41, 59, 0.42)',
      '--bg-numeric': 'rgba(56, 189, 248, 0.06)',
      '--row-hover-bg': 'rgba(56, 189, 248, 0.12)',
      '--text-primary': '#f1f5f9',
      '--text-muted': '#94a3b8',
      '--border-color': '#263348',
      '--grid-color': '#243145',
      '--accent': '#38bdf8',
      '--accent-fg': '#082f49',
      '--success': '#34d399',
      '--success-fg': '#022c22',
      '--success-bg': 'rgba(16, 185, 129, 0.14)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(245, 158, 11, 0.14)',
      '--danger': '#f87171',
      '--danger-fg': '#450a0a',
      '--danger-bg': 'rgba(239, 68, 68, 0.16)',
    },
  },
  {
    id: 'warm-paper',
    name: 'الورقي الدافئ',
    englishName: 'Warm Paper / Cream',
    description:
      'خلفية دافئة قريبة من لون الورق العاجي لتقليل إجهاد العين أثناء القراءة المطولة، مع نصوص فحمية واضحة.',
    isDark: false,
    swatches: ['#f7f3e9', '#fffdf8', '#9a5b13'],
    vars: {
      '--bg-main': '#f6f1e6',
      '--bg-surface': '#fffcf5',
      '--bg-header': '#3e3226',
      '--bg-table-header': '#efe7d6',
      '--bg-nav-active': '#f3e5cc',
      '--bg-zebra': 'rgba(239, 231, 214, 0.45)',
      '--bg-numeric': 'rgba(154, 91, 19, 0.05)',
      '--row-hover-bg': 'rgba(154, 91, 19, 0.09)',
      '--text-primary': '#292524',
      '--text-muted': '#6b5e51',
      '--border-color': '#dfd3be',
      '--grid-color': '#e2d7c3',
      '--accent': '#9a5b13',
      '--accent-fg': '#ffffff',
      '--success': '#166534',
      '--success-fg': '#ffffff',
      '--success-bg': '#eef7f0',
      '--warning': '#b45309',
      '--warning-bg': '#fef5e7',
      '--danger': '#b91c1c',
      '--danger-fg': '#ffffff',
      '--danger-bg': '#fdf0ef',
    },
  },
  {
    id: 'crisp-daylight',
    name: 'الاحترافي النقي',
    englishName: 'Crisp Daylight Light',
    description:
      'واجهة بيضاء نقية ومشرقة بظلال خفيفة جداً وألوان حيادية منظمة، مثالية للعمل النهاري السريع.',
    isDark: false,
    swatches: ['#f8fafc', '#ffffff', '#1d4ed8'],
    vars: {
      '--bg-main': '#f8fafc',
      '--bg-surface': '#ffffff',
      '--bg-header': '#0f172a',
      '--bg-table-header': '#f1f5f9',
      '--bg-nav-active': '#eff6ff',
      '--bg-zebra': 'rgba(241, 245, 249, 0.6)',
      '--bg-numeric': 'rgba(29, 78, 216, 0.035)',
      '--row-hover-bg': 'rgba(29, 78, 216, 0.07)',
      '--text-primary': '#0f172a',
      '--text-muted': '#475569',
      '--border-color': '#dbe3ee',
      '--grid-color': '#e2e8f0',
      '--accent': '#1d4ed8',
      '--accent-fg': '#ffffff',
      '--success': '#15803d',
      '--success-fg': '#ffffff',
      '--success-bg': '#f0fdf4',
      '--warning': '#b45309',
      '--warning-bg': '#fffbeb',
      '--danger': '#b91c1c',
      '--danger-fg': '#ffffff',
      '--danger-bg': '#fef2f2',
    },
  },
  {
    id: 'charcoal-emerald',
    name: 'الغرافيتي المودرن',
    englishName: 'Charcoal & Emerald',
    description:
      'ثيم داكن أنيق يعتمد على الرمادي الغرافيتي مع لمسات أخضر زمردي هادئ لتمييز الحالات الإيجابية والحسابات.',
    isDark: true,
    swatches: ['#121417', '#1b1f24', '#10b981'],
    vars: {
      '--bg-main': '#121417',
      '--bg-surface': '#1b1f24',
      '--bg-header': '#0b0d0f',
      '--bg-table-header': '#252a31',
      '--bg-nav-active': 'rgba(16, 185, 129, 0.14)',
      '--bg-zebra': 'rgba(37, 42, 49, 0.45)',
      '--bg-numeric': 'rgba(16, 185, 129, 0.06)',
      '--row-hover-bg': 'rgba(16, 185, 129, 0.12)',
      '--text-primary': '#eef2f6',
      '--text-muted': '#9ca3af',
      '--border-color': '#323943',
      '--grid-color': '#2e343e',
      '--accent': '#10b981',
      '--accent-fg': '#022c22',
      '--success': '#34d399',
      '--success-fg': '#022c22',
      '--success-bg': 'rgba(16, 185, 129, 0.14)',
      '--warning': '#f59e0b',
      '--warning-bg': 'rgba(245, 158, 11, 0.14)',
      '--danger': '#f87171',
      '--danger-fg': '#450a0a',
      '--danger-bg': 'rgba(239, 68, 68, 0.16)',
    },
  },
  {
    id: 'nordic-navy',
    name: 'الهادئ الأزرق',
    englishName: 'Nordic Navy & Ice',
    description:
      'درجات أزرق بحري عميق ومريح مع تباين مدروس للنصوص، يمنح إحساساً بالهدوء والانضباط في الجداول المالية.',
    isDark: true,
    swatches: ['#091526', '#102138', '#7dd3fc'],
    vars: {
      '--bg-main': '#091526',
      '--bg-surface': '#102138',
      '--bg-header': '#050c17',
      '--bg-table-header': '#173052',
      '--bg-nav-active': '#16375d',
      '--bg-zebra': 'rgba(23, 48, 82, 0.42)',
      '--bg-numeric': 'rgba(125, 211, 252, 0.06)',
      '--row-hover-bg': 'rgba(125, 211, 252, 0.12)',
      '--text-primary': '#eef6ff',
      '--text-muted': '#9bb6d6',
      '--border-color': '#24426b',
      '--grid-color': '#203c62',
      '--accent': '#7dd3fc',
      '--accent-fg': '#082f49',
      '--success': '#4ade80',
      '--success-fg': '#052e16',
      '--success-bg': 'rgba(74, 222, 128, 0.14)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(251, 191, 36, 0.14)',
      '--danger': '#fb7185',
      '--danger-fg': '#4c0519',
      '--danger-bg': 'rgba(251, 113, 133, 0.16)',
    },
  },
  {
    id: 'soft-mint',
    name: 'الباستيل اللطيف',
    englishName: 'Soft Mint & Mist',
    description:
      'ثيم ناعم ومشرق بألوان هادئة غير مرهقة للبصر، يعطي طابعاً لطيفاً وعصرياً بعيداً عن الحدة البصرية.',
    isDark: false,
    swatches: ['#eef6f3', '#fbfefd', '#0f766e'],
    vars: {
      '--bg-main': '#eef6f3',
      '--bg-surface': '#fbfefd',
      '--bg-header': '#134e4a',
      '--bg-table-header': '#e2f0eb',
      '--bg-nav-active': '#d5ece5',
      '--bg-zebra': 'rgba(226, 240, 235, 0.5)',
      '--bg-numeric': 'rgba(15, 118, 110, 0.045)',
      '--row-hover-bg': 'rgba(15, 118, 110, 0.08)',
      '--text-primary': '#132a27',
      '--text-muted': '#4c6b66',
      '--border-color': '#c7dfd7',
      '--grid-color': '#d2e5de',
      '--accent': '#0f766e',
      '--accent-fg': '#ffffff',
      '--success': '#15803d',
      '--success-fg': '#ffffff',
      '--success-bg': '#e8f8ee',
      '--warning': '#b45309',
      '--warning-bg': '#fef6e7',
      '--danger': '#be123c',
      '--danger-fg': '#ffffff',
      '--danger-bg': '#fdf0f3',
    },
  },
];

export interface TableThemeDefinition {
  id: TableThemeId;
  name: string;
  description: string;
}

export const TABLE_THEMES: TableThemeDefinition[] = [
  {
    id: 'classic-quota',
    name: 'ثيم الحصص الكلاسيكي',
    description:
      'خطوط أفقية خفيفة، تظليل ناعم للصفوف الزوجية، وتباين واضح للأرقام لتسهيل التتبع.',
  },
  {
    id: 'financial-audit',
    name: 'ثيم التدقيق المالي',
    description:
      'إبراز الأعمدة الرقمية بمحاذاة دقيقة وفواصل عمودية خفيفة جداً، مع تمييز هادئ للفروقات.',
  },
  {
    id: 'pdf-reader',
    name: 'ثيم القراءة الهادئة (PDF Reader)',
    description:
      'مظهر بسيط خالٍ من الزخرفة أو الألوان الصاخبة يبدو كصفحة مطبوعة مرتبة.',
  },
  {
    id: 'high-contrast',
    name: 'ثيم التباين العالي للوضوح',
    description:
      'حدود واضحة وحروف عريضة نسبياً لتقليل الخطأ في قراءة الأسماء المتشابهة والأرقام الصغيرة.',
  },
  {
    id: 'compact-modern',
    name: 'ثيم البطاقات المدمجة (Compact Modern)',
    description:
      'تقليل الفراغات الزائدة مع الحفاظ على تنفس بصري كافٍ لعرض أكبر عدد من الصفوف.',
  },
];

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
    description: 'واضح جداً في الأرقام والحروف العربية، ومتوازن في الجداول الطويلة.',
  },
  {
    id: 'cairo',
    name: 'Cairo',
    cssFamily: "'Cairo', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    description: 'عصري ومألوف، يعطي حضوراً أنيقاً في العناوين والبطاقات والواجهة.',
  },
  {
    id: 'tajawal',
    name: 'Tajawal',
    cssFamily: "'Tajawal', 'Cairo', system-ui, sans-serif",
    description: 'ناعم ومريح للعين وسهل القراءة في النصوص المتوسطة والبيانات.',
  },
  {
    id: 'noto-sans',
    name: 'Noto Sans Arabic',
    cssFamily: "'Noto Sans Arabic', 'Cairo', system-ui, sans-serif",
    description: 'عملي وثابت في عرض مختلف الحروف والأرقام بوضوح عالٍ.',
  },
];

export const FONT_SIZE_MAP: Record<FontSizeStep, { label: string; px: string }> = {
  sm: { label: 'صغير', px: '13px' },
  md: { label: 'عادي', px: '15px' },
  lg: { label: 'كبير', px: '17px' },
  xl: { label: 'كبير جداً', px: '19px' },
};

export const FONT_WEIGHT_MAP: Record<FontWeightStep, { label: string; weight: string }> = {
  light: { label: 'هادئ (400)', weight: '400' },
  normal: { label: 'متوازن (500)', weight: '500' },
  bold: { label: 'عريض للوضوح (700)', weight: '700' },
};

export const ROW_DENSITY_MAP: Record<
  RowDensityStep,
  { label: string; py: string; lineHeight: string }
> = {
  compact: { label: 'مضغوط', py: '6px', lineHeight: '1.45' },
  comfortable: { label: 'متوازن', py: '10px', lineHeight: '1.6' },
  spacious: { label: 'مريح', py: '14px', lineHeight: '1.75' },
};

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  appTheme: 'crisp-daylight',
  tableTheme: 'classic-quota',
  fontFamily: 'cairo',
  fontSize: 'md',
  fontWeight: 'normal',
  rowDensity: 'comfortable',
  tabularNumerals: true,
  rowHoverHighlight: true,
  stickyHeaderAndName: true,
  compactStatusBadges: true,
  smartNumericSplit: true,
  softGroupDividers: true,
  activeRowFocusMode: true,
};

export function getAppThemeById(id: AppThemeId): AppThemeDefinition {
  return APP_THEMES.find((t) => t.id === id) || APP_THEMES[2];
}

export function applyThemePreferencesToDocument(prefs: ThemePreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = getAppThemeById(prefs.appTheme);
  const font =
    ARABIC_FONTS.find((f) => f.id === prefs.fontFamily) || ARABIC_FONTS[1];
  const size = FONT_SIZE_MAP[prefs.fontSize] || FONT_SIZE_MAP.md;
  const weight = FONT_WEIGHT_MAP[prefs.fontWeight] || FONT_WEIGHT_MAP.normal;
  const density =
    ROW_DENSITY_MAP[prefs.rowDensity] || ROW_DENSITY_MAP.comfortable;

  if (theme.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = theme.isDark ? 'dark' : 'light';

  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });

  root.style.setProperty('--app-font-family', font.cssFamily);
  root.style.setProperty('--app-font-size', size.px);
  root.style.setProperty('--app-font-weight', weight.weight);
  root.style.setProperty('--table-cell-py', density.py);
  root.style.setProperty('--table-line-height', density.lineHeight);
}
