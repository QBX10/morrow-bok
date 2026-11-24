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

export type ThemeCapsuleGroupId = 'classic' | 'modern' | 'glass';

export interface AppThemeDefinition {
  id: AppThemeId;
  name: string;
  englishName: string;
  description: string;
  mood: string;
  isDark: boolean;
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

export const APP_THEMES: AppThemeDefinition[] = [
  {
    id: 'obsidian-gold',
    name: 'السبج والذهب',
    englishName: 'Obsidian & Gold',
    mood: 'فخامة ليلية وتركيز عميق',
    description:
      'أسود سبجي عميق جداً مع لمسات ذهبية راقية تمنح تركيزاً ليلياً مريحاً وفخامة تنفيذية.',
    isDark: true,
    swatches: ['#121212', '#1A1A24', '#F5B041'],
    vars: {
      '--bg-main': '#121212',
      '--bg-surface': '#1A1A24',
      '--bg-header': '#121216',
      '--bg-table-header': '#1E1F2B',
      '--bg-nav-active': 'rgba(245, 176, 65, 0.14)',
      '--bg-zebra': 'rgba(255, 255, 255, 0.025)',
      '--bg-numeric': 'rgba(245, 176, 65, 0.06)',
      '--row-hover-bg': 'rgba(245, 176, 65, 0.11)',
      '--text-primary': '#F0F0F5',
      '--text-muted': '#8A8A9E',
      '--border-color': 'rgba(255, 255, 255, 0.08)',
      '--grid-color': 'rgba(255, 255, 255, 0.07)',
      '--accent': '#F5B041',
      '--accent-fg': '#121212',
      '--success': '#10B981',
      '--success-fg': '#04271D',
      '--success-bg': 'rgba(16, 185, 129, 0.16)',
      '--warning': '#F5B041',
      '--warning-bg': 'rgba(245, 176, 65, 0.16)',
      '--danger': '#EF4444',
      '--danger-fg': '#FFFFFF',
      '--danger-bg': 'rgba(239, 68, 68, 0.16)',
    },
  },
  {
    id: 'aurora',
    name: 'الشفق القطبي',
    englishName: 'Aurora',
    mood: 'تدرجات قطبية متناغمة',
    description:
      'سماء ليلية عميقة بإضاءة خضراء وبنفسجية وزرقاء متوازنة تقلل إجهاد العمل المتأخر.',
    isDark: true,
    swatches: ['#071220', '#0e1d33', '#38bdf8'],
    vars: {
      '--bg-main': '#071220',
      '--bg-surface': '#0e1d33',
      '--bg-header': '#040a14',
      '--bg-table-header': '#162c4a',
      '--bg-nav-active': 'rgba(56, 189, 248, 0.15)',
      '--bg-zebra': 'rgba(30, 58, 95, 0.32)',
      '--bg-numeric': 'rgba(52, 211, 153, 0.055)',
      '--row-hover-bg': 'rgba(56, 189, 248, 0.12)',
      '--text-primary': '#f0f9ff',
      '--text-muted': '#94b3d4',
      '--border-color': '#203b5e',
      '--grid-color': '#1d3657',
      '--accent': '#38bdf8',
      '--accent-fg': '#062033',
      '--success': '#34d399',
      '--success-fg': '#022c22',
      '--success-bg': 'rgba(16, 185, 129, 0.16)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(245, 158, 11, 0.16)',
      '--danger': '#fb7185',
      '--danger-fg': '#4c0519',
      '--danger-bg': 'rgba(251, 113, 133, 0.16)',
    },
  },
  {
    id: 'cyberpunk',
    name: 'النيون السيبراني',
    englishName: 'Cyberpunk',
    mood: 'دقة رقمية وتقنية عالية',
    description:
      'أسود فائق العمق مع لمسات وردية كهربائية وسماوية حادة لبيئات التدقيق الرقمي.',
    isDark: true,
    swatches: ['#090910', '#131422', '#ec4899'],
    vars: {
      '--bg-main': '#090910',
      '--bg-surface': '#131422',
      '--bg-header': '#05050a',
      '--bg-table-header': '#1e2038',
      '--bg-nav-active': 'rgba(236, 72, 153, 0.15)',
      '--bg-zebra': 'rgba(34, 211, 238, 0.04)',
      '--bg-numeric': 'rgba(34, 211, 238, 0.07)',
      '--row-hover-bg': 'rgba(236, 72, 153, 0.12)',
      '--text-primary': '#f8fafc',
      '--text-muted': '#a5b4fc',
      '--border-color': '#2c2f52',
      '--grid-color': '#272a4a',
      '--accent': '#f43f8e',
      '--accent-fg': '#ffffff',
      '--success': '#22d3ee',
      '--success-fg': '#083344',
      '--success-bg': 'rgba(34, 211, 238, 0.14)',
      '--warning': '#facc15',
      '--warning-bg': 'rgba(250, 204, 21, 0.14)',
      '--danger': '#fb7185',
      '--danger-fg': '#4c0519',
      '--danger-bg': 'rgba(251, 113, 133, 0.16)',
    },
  },
  {
    id: 'desert-mirage',
    name: 'السراب الصحراوي',
    englishName: 'Desert Mirage',
    mood: 'دفء ورقي ناعم للقراءة الطويلة',
    description:
      'خلفية رملية عاجية دافئة بنصوص فحمية واضحة وفواصل خشبية هادئة تمنع إرهاق العين.',
    isDark: false,
    swatches: ['#f5efe4', '#fffcf6', '#9a5b13'],
    vars: {
      '--bg-main': '#f5efe4',
      '--bg-surface': '#fffcf6',
      '--bg-header': '#3a2d21',
      '--bg-table-header': '#ece2cf',
      '--bg-nav-active': '#f2e4cc',
      '--bg-zebra': 'rgba(236, 226, 207, 0.48)',
      '--bg-numeric': 'rgba(154, 91, 19, 0.05)',
      '--row-hover-bg': 'rgba(154, 91, 19, 0.09)',
      '--text-primary': '#26211c',
      '--text-muted': '#695b4e',
      '--border-color': '#ddd0b9',
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
    id: 'arctic-snow',
    name: 'الثلج القطبي',
    englishName: 'Arctic Snow',
    mood: 'وضوح نهاري ناصع واحترافي',
    description:
      'واجهة نهارية نقية ومشرقة بتباين مدروس وألوان محايدة واضحة لإنجاز المعاملات السريعة.',
    isDark: false,
    swatches: ['#f4f7fb', '#ffffff', '#1d4ed8'],
    vars: {
      '--bg-main': '#f4f7fb',
      '--bg-surface': '#ffffff',
      '--bg-header': '#0f172a',
      '--bg-table-header': '#eef3f9',
      '--bg-nav-active': '#e8f1ff',
      '--bg-zebra': 'rgba(241, 245, 249, 0.65)',
      '--bg-numeric': 'rgba(29, 78, 216, 0.035)',
      '--row-hover-bg': 'rgba(29, 78, 216, 0.075)',
      '--text-primary': '#0f172a',
      '--text-muted': '#475569',
      '--border-color': '#d9e2ec',
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
    id: 'emerald-forest',
    name: 'غابة الزمرد',
    englishName: 'Emerald Forest',
    mood: 'توازن مالي وهدوء طبيعي',
    description:
      'أخضر غابي عميق ومريح يبرز الأرقام المالية والإنجاز بوضوح هادئ ومستقر.',
    isDark: true,
    swatches: ['#091712', '#10241c', '#10b981'],
    vars: {
      '--bg-main': '#091712',
      '--bg-surface': '#10241c',
      '--bg-header': '#050f0b',
      '--bg-table-header': '#173327',
      '--bg-nav-active': 'rgba(16, 185, 129, 0.16)',
      '--bg-zebra': 'rgba(23, 51, 39, 0.42)',
      '--bg-numeric': 'rgba(16, 185, 129, 0.065)',
      '--row-hover-bg': 'rgba(16, 185, 129, 0.12)',
      '--text-primary': '#ecfdf5',
      '--text-muted': '#86b5a1',
      '--border-color': '#1f4434',
      '--grid-color': '#1b3c2e',
      '--accent': '#10b981',
      '--accent-fg': '#022c22',
      '--success': '#34d399',
      '--success-fg': '#022c22',
      '--success-bg': 'rgba(52, 211, 153, 0.16)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(251, 191, 36, 0.15)',
      '--danger': '#f87171',
      '--danger-fg': '#450a0a',
      '--danger-bg': 'rgba(248, 113, 113, 0.16)',
    },
  },
  {
    id: 'royal-crimson',
    name: 'القرمزي الملكي',
    englishName: 'Royal Crimson',
    mood: 'هيبة إدارية وتباين رفيع',
    description:
      'خلفية داكنة فاخرة بلمسات ياقوتية قرمزية راقية تمنح الجداول حضوراً مهيباً.',
    isDark: true,
    swatches: ['#150b10', '#21121a', '#e11d48'],
    vars: {
      '--bg-main': '#150b10',
      '--bg-surface': '#21121a',
      '--bg-header': '#0d0609',
      '--bg-table-header': '#311a26',
      '--bg-nav-active': 'rgba(225, 29, 72, 0.18)',
      '--bg-zebra': 'rgba(49, 26, 38, 0.42)',
      '--bg-numeric': 'rgba(225, 29, 72, 0.07)',
      '--row-hover-bg': 'rgba(225, 29, 72, 0.13)',
      '--text-primary': '#fff1f2',
      '--text-muted': '#cfa3b0',
      '--border-color': '#442434',
      '--grid-color': '#3c202e',
      '--accent': '#e11d48',
      '--accent-fg': '#ffffff',
      '--success': '#34d399',
      '--success-fg': '#022c22',
      '--success-bg': 'rgba(52, 211, 153, 0.15)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(251, 191, 36, 0.15)',
      '--danger': '#fb7185',
      '--danger-fg': '#4c0519',
      '--danger-bg': 'rgba(251, 113, 133, 0.2)',
    },
  },
  {
    id: 'zen-minimal',
    name: 'البساطة الهادئة',
    englishName: 'Zen Minimal',
    mood: 'صفاء بصري وخلو من المشتتات',
    description:
      'ألوان حجرية وزيتية ناعمة بلا حدة بصرية للتركيز الكامل على قوائم الأسماء والأرقام.',
    isDark: false,
    swatches: ['#eff4f2', '#fafcfb', '#0f766e'],
    vars: {
      '--bg-main': '#eff4f2',
      '--bg-surface': '#fafcfb',
      '--bg-header': '#183632',
      '--bg-table-header': '#e4edea',
      '--bg-nav-active': '#d8ebe5',
      '--bg-zebra': 'rgba(228, 237, 234, 0.5)',
      '--bg-numeric': 'rgba(15, 118, 110, 0.045)',
      '--row-hover-bg': 'rgba(15, 118, 110, 0.08)',
      '--text-primary': '#162825',
      '--text-muted': '#4c6763',
      '--border-color': '#cadbd5',
      '--grid-color': '#d5e3de',
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

export const MODERN_APP_THEMES: AppThemeDefinition[] = [
  {
    id: 'alabaster-glass',
    name: 'المرمر الزجاجي',
    englishName: 'Alabaster Glass',
    mood: 'زجاجية نهارية هادئة وتباين ناصع',
    description:
      'سطح خزفي شفاف ناعم مع لمسات زرقاء هادئة يمنح البطاقات عمقاً زجاجياً مريحاً للعين.',
    isDark: false,
    capsuleGroup: 'glass',
    swatches: ['#eef3f9', '#ffffff', '#2563eb'],
    vars: {
      '--bg-main': '#eef3f9',
      '--bg-surface': '#fbfdff',
      '--bg-header': '#0f172a',
      '--bg-table-header': '#e5edf7',
      '--bg-nav-active': '#e0ecff',
      '--bg-zebra': 'rgba(226, 236, 248, 0.55)',
      '--bg-numeric': 'rgba(37, 99, 235, 0.04)',
      '--row-hover-bg': 'rgba(37, 99, 235, 0.08)',
      '--text-primary': '#0f172a',
      '--text-muted': '#475569',
      '--border-color': '#d2deec',
      '--grid-color': '#dde7f2',
      '--accent': '#2563eb',
      '--accent-fg': '#ffffff',
      '--success': '#15803d',
      '--success-fg': '#ffffff',
      '--success-bg': '#ecfdf5',
      '--warning': '#b45309',
      '--warning-bg': '#fffbeb',
      '--danger': '#dc2626',
      '--danger-fg': '#ffffff',
      '--danger-bg': '#fef2f2',
    },
  },
  {
    id: 'sage-linen',
    name: 'الكتان الحكيم',
    englishName: 'Sage Linen',
    mood: 'هدوء طبيعي دافئ للقراءة والتركيز',
    description:
      'خلفية كتانية دافئة بلمسات خضراء حريرية تخفف إجهاد النظر أثناء مراجعة القوائم الطويلة.',
    isDark: false,
    capsuleGroup: 'modern',
    swatches: ['#f3f5f1', '#fcfdfb', '#0d9488'],
    vars: {
      '--bg-main': '#f3f5f1',
      '--bg-surface': '#fcfdfb',
      '--bg-header': '#172826',
      '--bg-table-header': '#e7ece6',
      '--bg-nav-active': '#dcf0ec',
      '--bg-zebra': 'rgba(231, 236, 230, 0.54)',
      '--bg-numeric': 'rgba(13, 148, 136, 0.045)',
      '--row-hover-bg': 'rgba(13, 148, 136, 0.085)',
      '--text-primary': '#1a2523',
      '--text-muted': '#526360',
      '--border-color': '#d3dcd4',
      '--grid-color': '#dfe6e0',
      '--accent': '#0d9488',
      '--accent-fg': '#ffffff',
      '--success': '#15803d',
      '--success-fg': '#ffffff',
      '--success-bg': '#ecfdf5',
      '--warning': '#b45309',
      '--warning-bg': '#fef7e6',
      '--danger': '#be123c',
      '--danger-fg': '#ffffff',
      '--danger-bg': '#fff1f2',
    },
  },
  {
    id: 'nordic-dusk',
    name: 'غسق الشمال',
    englishName: 'Nordic Dusk',
    mood: 'ليلي هادئ بدون حدة بصرية',
    description:
      'أردواز ليلي معتدل العمق مع تمييز فيروزي ناعم لتجربة إعدادات وجداول مريحة ليلاً.',
    isDark: true,
    capsuleGroup: 'modern',
    swatches: ['#0f1722', '#172232', '#2dd4bf'],
    vars: {
      '--bg-main': '#0f1722',
      '--bg-surface': '#172232',
      '--bg-header': '#091019',
      '--bg-table-header': '#1f2e42',
      '--bg-nav-active': 'rgba(45, 212, 191, 0.15)',
      '--bg-zebra': 'rgba(31, 46, 66, 0.42)',
      '--bg-numeric': 'rgba(45, 212, 191, 0.06)',
      '--row-hover-bg': 'rgba(45, 212, 191, 0.11)',
      '--text-primary': '#f1f5f9',
      '--text-muted': '#94a3b8',
      '--border-color': '#26364d',
      '--grid-color': '#213044',
      '--accent': '#2dd4bf',
      '--accent-fg': '#042f2e',
      '--success': '#34d399',
      '--success-fg': '#022c22',
      '--success-bg': 'rgba(52, 211, 153, 0.16)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(251, 191, 36, 0.16)',
      '--danger': '#fb7185',
      '--danger-fg': '#4c0519',
      '--danger-bg': 'rgba(251, 113, 133, 0.16)',
    },
  },
  {
    id: 'midnight-indigo',
    name: 'نيلي منتصف الليل',
    englishName: 'Midnight Indigo',
    mood: 'زجاجية ليلية عصرية بعمق متدرج',
    description:
      'خلفية نيلية عميقة مع طبقات زجاجية مصقولة وبنفسجي هادئ للوحات التحكم المتقدمة.',
    isDark: true,
    capsuleGroup: 'glass',
    swatches: ['#0b1021', '#141b34', '#818cf8'],
    vars: {
      '--bg-main': '#0b1021',
      '--bg-surface': '#141b34',
      '--bg-header': '#070b18',
      '--bg-table-header': '#1d2749',
      '--bg-nav-active': 'rgba(129, 140, 248, 0.16)',
      '--bg-zebra': 'rgba(29, 39, 73, 0.4)',
      '--bg-numeric': 'rgba(129, 140, 248, 0.065)',
      '--row-hover-bg': 'rgba(129, 140, 248, 0.12)',
      '--text-primary': '#eef2ff',
      '--text-muted': '#a5b4fc',
      '--border-color': '#293561',
      '--grid-color': '#232e54',
      '--accent': '#818cf8',
      '--accent-fg': '#0f172a',
      '--success': '#34d399',
      '--success-fg': '#022c22',
      '--success-bg': 'rgba(52, 211, 153, 0.15)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(251, 191, 36, 0.15)',
      '--danger': '#fb7185',
      '--danger-fg': '#4c0519',
      '--danger-bg': 'rgba(251, 113, 133, 0.16)',
    },
  },
];

export const ALL_APP_THEMES: AppThemeDefinition[] = [
  ...APP_THEMES,
  ...MODERN_APP_THEMES,
];

export const APP_THEME_CAPSULES: Array<{
  id: ThemeCapsuleGroupId;
  title: string;
  subtitle: string;
  themes: AppThemeDefinition[];
}> = [
  {
    id: 'classic',
    title: 'الثيمات الكلاسيكية الأصيلة',
    subtitle: 'الثيمات الثمانية الأصلية بألوانها الكاملة المحمية',
    themes: APP_THEMES,
  },
  {
    id: 'modern',
    title: 'ثيمات عصرية هادئة',
    subtitle: 'لوحات لونية معاصرة مريحة للعمل الطويل',
    themes: MODERN_APP_THEMES.filter((t) => t.capsuleGroup === 'modern'),
  },
  {
    id: 'glass',
    title: 'ثيمات زجاجية مصقولة',
    subtitle: 'شفافية وطبقات عمق ناعمة لبطاقات الواجهة',
    themes: MODERN_APP_THEMES.filter((t) => t.capsuleGroup === 'glass'),
  },
];

const LEGACY_THEME_MAP: Record<string, AppThemeId> = {
  'midnight-slate': 'obsidian-gold',
  'warm-paper': 'desert-mirage',
  'crisp-daylight': 'arctic-snow',
  'charcoal-emerald': 'emerald-forest',
  'nordic-navy': 'aurora',
  'soft-mint': 'zen-minimal',
};

export function resolveAppThemeId(rawId?: string | null): AppThemeId {
  if (!rawId) return 'arctic-snow';
  if (ALL_APP_THEMES.some((t) => t.id === rawId)) return rawId as AppThemeId;
  return LEGACY_THEME_MAP[rawId] || 'arctic-snow';
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
      'صفوف شفافة ناعمة بلمسة زجاجية وفواصل أفقية خفيفة للغاية.',
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
      'رأس بارز باللون المميز وتباين واضح للأعمدة الرقمية والحصص.',
  },
  {
    id: 'pastel-blocks',
    name: 'الكتل اللطيفة',
    englishName: 'Pastel Blocks',
    description:
      'فصل هادئ بين الصفوف بظلال باستيل لطيفة تناسب القوائم اليومية.',
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
      'توهج خفيف عند التمرير وإبراز رقمي متساوٍ مخصص للتدقيق السريع.',
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
  if (!rawId) return 'paper-ledger';
  if (TABLE_THEMES.some((t) => t.id === rawId)) return rawId as TableThemeId;
  return LEGACY_TABLE_MAP[rawId] || 'paper-ledger';
}

export const ARABIC_FONTS: Array<{
  id: ArabicFontId;
  name: string;
  cssFamily: string;
  description: string;
}> = [
  {
    id: 'cairo',
    name: 'Cairo',
    cssFamily: "'Cairo', 'IBM Plex Sans Arabic', system-ui, sans-serif",
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
  {
    id: 'ibm-plex',
    name: 'IBM Plex Sans Arabic',
    cssFamily: "'IBM Plex Sans Arabic', 'Cairo', system-ui, sans-serif",
    description: 'احترافي ومثالي للأرقام المحاسبية والمحاذاة الجدولية الدقيقة.',
  },
];

export function resolveArabicFontId(rawId?: string | null): ArabicFontId {
  if (!rawId) return 'cairo';
  if (rawId === 'noto-sans') return 'ibm-plex';
  if (ARABIC_FONTS.some((f) => f.id === rawId)) return rawId as ArabicFontId;
  return 'cairo';
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
  soft: '0 2px 10px -2px rgba(0, 0, 0, 0.08)',
  elevated: '0 10px 28px -6px rgba(0, 0, 0, 0.22)',
};

export const DEFAULT_APPEARANCE_PROFILES: AppearanceProfile[] = [
  {
    id: 'preset_night_work',
    name: 'وضع العمل الليلي',
    appTheme: 'obsidian-gold',
    tableTheme: 'data-grid',
    fontFamily: 'ibm-plex',
    fontSizePx: 15,
    rowHeightPx: 40,
    colWidthScale: 100,
    borderRadiusPx: 24,
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
    name: 'وضع القراءة السريعة',
    appTheme: 'desert-mirage',
    tableTheme: 'paper-ledger',
    fontFamily: 'tajawal',
    fontSizePx: 16,
    rowHeightPx: 46,
    colWidthScale: 105,
    borderRadiusPx: 20,
    cardShadowLevel: 'none',
    glassEffect: false,
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
  borderRadiusPx: 24,
  cardShadowLevel: 'soft',
  glassEffect: true,
  glassOpacityPct: 62,
  themeColorMode: 'auto',
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
  const resolved = resolveAppThemeId(id);
  return ALL_APP_THEMES.find((t) => t.id === resolved) || APP_THEMES[4];
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
  let theme = getAppThemeById(prefs.appTheme);

  // Honor themeColorMode ('auto' follows OS prefers-color-scheme if user hasn't forced dark/light theme choice explicitly via classic override)
  if (prefs.themeColorMode === 'dark' && !theme.isDark) {
    theme = getAppThemeById('midnight-indigo');
  } else if (prefs.themeColorMode === 'light' && theme.isDark) {
    theme = getAppThemeById('arctic-snow');
  }

  const fontId = resolveArabicFontId(prefs.fontFamily);
  const font = ARABIC_FONTS.find((f) => f.id === fontId) || ARABIC_FONTS[0];
  const sizeStep = FONT_SIZE_MAP[prefs.fontSize] || FONT_SIZE_MAP.md;
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

  if (prefs.customBgColor?.trim()) {
    root.style.setProperty('--bg-main', prefs.customBgColor.trim());
  }
  if (prefs.customSurfaceColor?.trim()) {
    root.style.setProperty('--bg-surface', prefs.customSurfaceColor.trim());
  }
  if (prefs.customTextColor?.trim()) {
    root.style.setProperty('--text-primary', prefs.customTextColor.trim());
  }
  if (prefs.customAccentColor?.trim()) {
    root.style.setProperty('--accent', prefs.customAccentColor.trim());
  }

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
      : 14;

  const glassOpacity =
    typeof prefs.glassOpacityPct === 'number' &&
    prefs.glassOpacityPct >= 40 &&
    prefs.glassOpacityPct <= 100
      ? prefs.glassOpacityPct / 100
      : 0.86;

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
  root.style.setProperty('--accent-ai', '#5B4FE9');
  root.style.setProperty('--accent-ai-glow', 'rgba(91, 79, 233, 0.42)');
  root.dataset.appTheme = theme.id;
  root.dataset.tableTheme = resolveTableThemeId(prefs.tableTheme);
  root.dataset.glass = prefs.glassEffect ? '1' : '0';
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
