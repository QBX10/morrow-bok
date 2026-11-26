import type {
  AppearanceProfile,
  AppShapeId,
  AppThemeId,
  ArabicFontId,
  AutoAppThemeId,
  CardShadowLevel,
  FontSizeStep,
  FontWeightStep,
  HeavyAppThemeId,
  MarineAppThemeId,
  RowDensityStep,
  TableThemeId,
  ThemePreferences,
} from '../types/agency';

export type ThemeCapsuleGroupId = 'marine' | 'heavy' | 'auto' | 'classic';

export interface AppShapeDefinition {
  id: AppShapeId;
  name: string;
  englishName: string;
  tagline: string;
  description: string;
  cardRadiusPx: number;
  btnRadiusPx: number;
  modalRadiusPx: number;
  capsuleRadiusPx: number;
  patternType: 'isometric' | 'crosshatch' | 'octagram' | 'swiss-dots' | 'concentric';
  swatches: [string, string];
}

export const APP_SHAPES: AppShapeDefinition[] = [
  {
    id: 'geometric-glass',
    name: 'الهندسي المصقول (الافتراضي)',
    englishName: 'Geometric Smoked',
    tagline: 'زجاج مصقول · زوايا 20px متوازنة',
    description:
      'الشكل القياسي: بطاقات بزوايا دائرية متوازنة (20px) وإضاءة حافة 1px مع خطوط استدلال ركنية.',
    cardRadiusPx: 20,
    btnRadiusPx: 9999,
    modalRadiusPx: 22,
    capsuleRadiusPx: 18,
    patternType: 'isometric',
    swatches: ['20px', 'glass'],
  },
  {
    id: 'sharp-monolith',
    name: 'المعماري الحاد',
    englishName: 'Sharp Monolith',
    tagline: 'زوايا قائمة 2px · أزرار هندسية مربعة',
    description:
      'تصميم تقني حاد بالكامل بزوايا 2px وإطارات مزدوجة وأزرار مستطيلة حادة مع شبكة هندسية دقيقة.',
    cardRadiusPx: 3,
    btnRadiusPx: 3,
    modalRadiusPx: 4,
    capsuleRadiusPx: 3,
    patternType: 'crosshatch',
    swatches: ['2px', 'brutalist'],
  },
  {
    id: 'royal-octagram',
    name: 'الملكي المثمّن',
    englishName: 'Royal Octagram',
    tagline: 'زوايا مشطوفة 45° · إطار معدني مزدوج',
    description:
      'تصميم ملكي بحواف مقصوصة بزاوية 45 درجة وإطارات معدنية متداخلة وشبكة نجمية مثمنة.',
    cardRadiusPx: 10,
    btnRadiusPx: 8,
    modalRadiusPx: 12,
    capsuleRadiusPx: 10,
    patternType: 'octagram',
    swatches: ['45°', 'bevel'],
  },
  {
    id: 'swiss-editorial',
    name: 'التحريري السويسري',
    englishName: 'Swiss Editorial',
    tagline: 'أسطح نقية بدون ضباب · خطوط فصل حادة',
    description:
      'أسلوب تحريري مطبوع فائق الوضوح بأسطح صلبة عالية التباين بلا تغبيش وفواصل مسطرية نقية.',
    cardRadiusPx: 12,
    btnRadiusPx: 8,
    modalRadiusPx: 12,
    capsuleRadiusPx: 10,
    patternType: 'swiss-dots',
    swatches: ['1px', 'matte'],
  },
  {
    id: 'floating-capsule',
    name: 'الجُزر الكبسولية المرنة',
    englishName: 'Floating Capsule',
    tagline: 'حواف فائقة الاستدارة 30px · أشرطة عائمة',
    description:
      'أشرطة علوية وجانبية منفصلة كجزر عائمة باستدارة 30px وأزرار كبسولية وحلقات مدارية ناعمة.',
    cardRadiusPx: 30,
    btnRadiusPx: 9999,
    modalRadiusPx: 32,
    capsuleRadiusPx: 28,
    patternType: 'concentric',
    swatches: ['30px', 'island'],
  },
];

export function resolveAppShapeId(rawId?: string | null): AppShapeId {
  if (!rawId) return 'geometric-glass';
  if (APP_SHAPES.some((s) => s.id === rawId)) return rawId as AppShapeId;
  return 'geometric-glass';
}

export function getAppShapeById(rawId?: string | null): AppShapeDefinition {
  const id = resolveAppShapeId(rawId);
  return APP_SHAPES.find((s) => s.id === id) || APP_SHAPES[0];
}

export function applyAppShapeToDocument(shapeId?: string | null): AppShapeDefinition {
  const shape = getAppShapeById(shapeId);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.appShape = shape.id;
    root.style.setProperty('--card-radius', `${shape.cardRadiusPx}px`);
    root.style.setProperty('--btn-radius', `${shape.btnRadiusPx}px`);
    root.style.setProperty('--modal-radius', `${shape.modalRadiusPx}px`);
    root.style.setProperty('--world-radius', `${shape.cardRadiusPx}px`);
    root.style.setProperty('--galaxy-radius', `${shape.cardRadiusPx}px`);
    root.style.setProperty('--capsule-radius', `${shape.capsuleRadiusPx}px`);
  }
  return shape;
}

export interface AppThemeDefinition {
  id: MarineAppThemeId | AutoAppThemeId;
  name: string;
  englishName: string;
  description: string;
  mood: string;
  isDark: boolean;
  isAuto?: boolean;
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
    '--surface-well': string;
    '--surface-subtle': string;
    '--surface-pill': string;
    '--surface-overlay': string;
    '--text-primary': string;
    '--text-muted': string;
    '--border-color': string;
    '--grid-color': string;
    '--accent': string;
    '--accent-bright': string;
    '--accent-deep': string;
    '--accent-fg': string;
    '--spatial-secondary': string;
    '--spatial-aurora': string;
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
  mood: 'سبج ليلي عميق بإضاءة زمردية متزنة',
  description:
    'لوحة 60-30-10 متوازنة: قاعدة داكنة صافية (#050A14)، بطاقات مرتفعة (#0C172B)، ولمسة زمردية حادة (#10E0A6).',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#050A14', '#0C172B', '#10E0A6'],
  vars: {
    '--bg-main': '#050A14',
    '--bg-surface': '#0C172B',
    '--bg-header': '#07101F',
    '--bg-table-header': '#12223E',
    '--bg-nav-active': 'rgba(16, 224, 166, 0.16)',
    '--bg-zebra': 'rgba(134, 255, 222, 0.03)',
    '--bg-numeric': 'rgba(16, 224, 166, 0.08)',
    '--row-hover-bg': 'rgba(16, 224, 166, 0.12)',
    '--surface-well': 'rgba(4, 10, 22, 0.72)',
    '--surface-subtle': 'rgba(16, 224, 166, 0.05)',
    '--surface-pill': 'rgba(12, 23, 43, 0.85)',
    '--surface-overlay': 'rgba(3, 8, 18, 0.82)',
    '--text-primary': '#F3F7FC',
    '--text-muted': '#9FB4CC',
    '--border-color': 'rgba(56, 239, 194, 0.24)',
    '--grid-color': 'rgba(56, 239, 194, 0.13)',
    '--accent': '#10E0A6',
    '--accent-bright': '#86FFDE',
    '--accent-deep': '#059669',
    '--accent-fg': '#021712',
    '--spatial-secondary': '#38BDF8',
    '--spatial-aurora': '#6366F1',
    '--marine-caustic-1': 'rgba(16, 224, 166, 0.18)',
    '--marine-caustic-2': 'rgba(56, 189, 248, 0.13)',
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
  mood: 'أزرق محيطي سحيق وتوهج سماوي نقي',
  description:
    'أزرق محيطي نقي (#040914) بطبقات أردوازية (#0B182E) وتباين فيروزي عالي الوضوح (#22D3EE).',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#040914', '#0B182E', '#22D3EE'],
  vars: {
    '--bg-main': '#040914',
    '--bg-surface': '#0B182E',
    '--bg-header': '#060F20',
    '--bg-table-header': '#112340',
    '--bg-nav-active': 'rgba(34, 211, 238, 0.16)',
    '--bg-zebra': 'rgba(103, 232, 249, 0.028)',
    '--bg-numeric': 'rgba(34, 211, 238, 0.075)',
    '--row-hover-bg': 'rgba(34, 211, 238, 0.12)',
    '--surface-well': 'rgba(4, 9, 20, 0.74)',
    '--surface-subtle': 'rgba(34, 211, 238, 0.05)',
    '--surface-pill': 'rgba(11, 24, 46, 0.85)',
    '--surface-overlay': 'rgba(3, 8, 18, 0.82)',
    '--text-primary': '#EFFBFF',
    '--text-muted': '#90AECB',
    '--border-color': 'rgba(34, 211, 238, 0.25)',
    '--grid-color': 'rgba(34, 211, 238, 0.13)',
    '--accent': '#22D3EE',
    '--accent-bright': '#A5F3FC',
    '--accent-deep': '#0284C7',
    '--accent-fg': '#03131A',
    '--spatial-secondary': '#818CF8',
    '--spatial-aurora': '#3B82F6',
    '--marine-caustic-1': 'rgba(34, 211, 238, 0.17)',
    '--marine-caustic-2': 'rgba(129, 140, 248, 0.12)',
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
  mood: 'أكوامارين هادئ مع عمق بحري متوازن',
  description:
    'لوحة بحرية مريحة للعين الطويلة (#050D17) مع لمسة أكوامارين حريرية (#2DD4BF) وتباين نصي صافٍ.',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#050D17', '#0C1B2D', '#2DD4BF'],
  vars: {
    '--bg-main': '#050D17',
    '--bg-surface': '#0C1B2D',
    '--bg-header': '#071322',
    '--bg-table-header': '#12263F',
    '--bg-nav-active': 'rgba(45, 212, 191, 0.16)',
    '--bg-zebra': 'rgba(153, 246, 228, 0.026)',
    '--bg-numeric': 'rgba(45, 212, 191, 0.075)',
    '--row-hover-bg': 'rgba(45, 212, 191, 0.12)',
    '--surface-well': 'rgba(5, 13, 23, 0.72)',
    '--surface-subtle': 'rgba(45, 212, 191, 0.05)',
    '--surface-pill': 'rgba(12, 27, 45, 0.85)',
    '--surface-overlay': 'rgba(4, 10, 20, 0.82)',
    '--text-primary': '#F0FDFA',
    '--text-muted': '#94B5BD',
    '--border-color': 'rgba(45, 212, 191, 0.24)',
    '--grid-color': 'rgba(45, 212, 191, 0.13)',
    '--accent': '#2DD4BF',
    '--accent-bright': '#99F6E4',
    '--accent-deep': '#0F766E',
    '--accent-fg': '#041A18',
    '--spatial-secondary': '#34D399',
    '--spatial-aurora': '#0EA5E9',
    '--marine-caustic-1': 'rgba(45, 212, 191, 0.16)',
    '--marine-caustic-2': 'rgba(52, 211, 153, 0.11)',
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

export const PELAGIC_SAPPHIRE_THEME: AppThemeDefinition = {
  id: 'pelagic-sapphire',
  name: 'العمق الياقوتي',
  englishName: 'Pelagic Sapphire',
  mood: 'ياقوت ملكي عميق بتباين دقيق',
  description:
    'أزرق ليلي ملكي (#050A18) مع بطاقات نيلية (#0E1935) وبريق ياقوتي رصين (#60A5FA).',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#050A18', '#0E1935', '#60A5FA'],
  vars: {
    '--bg-main': '#050A18',
    '--bg-surface': '#0E1935',
    '--bg-header': '#081026',
    '--bg-table-header': '#152447',
    '--bg-nav-active': 'rgba(96, 165, 250, 0.17)',
    '--bg-zebra': 'rgba(191, 219, 254, 0.026)',
    '--bg-numeric': 'rgba(96, 165, 250, 0.075)',
    '--row-hover-bg': 'rgba(96, 165, 250, 0.12)',
    '--surface-well': 'rgba(5, 10, 24, 0.74)',
    '--surface-subtle': 'rgba(96, 165, 250, 0.05)',
    '--surface-pill': 'rgba(14, 25, 53, 0.85)',
    '--surface-overlay': 'rgba(4, 8, 20, 0.82)',
    '--text-primary': '#EFF6FF',
    '--text-muted': '#96ADCF',
    '--border-color': 'rgba(96, 165, 250, 0.25)',
    '--grid-color': 'rgba(96, 165, 250, 0.13)',
    '--accent': '#60A5FA',
    '--accent-bright': '#BFDBFE',
    '--accent-deep': '#2563EB',
    '--accent-fg': '#040B1C',
    '--spatial-secondary': '#A78BFA',
    '--spatial-aurora': '#38BDF8',
    '--marine-caustic-1': 'rgba(96, 165, 250, 0.17)',
    '--marine-caustic-2': 'rgba(167, 139, 250, 0.12)',
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

export const OBSIDIAN_GOLD_THEME: AppThemeDefinition = {
  id: 'obsidian-gold',
  name: 'السبح والذهب',
  englishName: 'Obsidian & Gold',
  mood: 'تناغم هادئ وعصري بين السواد السبجي والذهب المصقول',
  description:
    'الثيم التلقائي الافتراضي: سواد سبجي هادئ (#070708) وأسطح كربونية ناعمة (#101012) منسقة مع ذهب مصقول متوازن (#D4AF37) وتباين قرائي مريح.',
  isDark: true,
  capsuleGroup: 'marine',
  swatches: ['#070708', '#101012', '#D4AF37'],
  vars: {
    '--bg-main': '#070708',
    '--bg-surface': '#101012',
    '--bg-header': '#0B0B0D',
    '--bg-table-header': '#171614',
    '--bg-nav-active': 'rgba(212, 175, 55, 0.14)',
    '--bg-zebra': 'rgba(238, 210, 120, 0.024)',
    '--bg-numeric': 'rgba(212, 175, 55, 0.075)',
    '--row-hover-bg': 'rgba(212, 175, 55, 0.11)',
    '--surface-well': 'rgba(11, 10, 9, 0.84)',
    '--surface-subtle': 'rgba(212, 175, 55, 0.05)',
    '--surface-pill': 'rgba(20, 18, 15, 0.92)',
    '--surface-overlay': 'rgba(5, 5, 6, 0.84)',
    '--text-primary': '#F4F1EA',
    '--text-muted': '#9E9689',
    '--border-color': 'rgba(212, 175, 55, 0.22)',
    '--grid-color': 'rgba(212, 175, 55, 0.11)',
    '--accent': '#D4AF37',
    '--accent-bright': '#EED278',
    '--accent-deep': '#9F7F22',
    '--accent-fg': '#0B0904',
    '--spatial-secondary': '#C89B3C',
    '--spatial-aurora': '#7C5E18',
    '--marine-caustic-1': 'rgba(212, 175, 55, 0.13)',
    '--marine-caustic-2': 'rgba(200, 155, 60, 0.08)',
    '--success': '#34D399',
    '--success-fg': '#041B12',
    '--success-bg': 'rgba(52, 211, 153, 0.14)',
    '--warning': '#FBBF24',
    '--warning-bg': 'rgba(251, 191, 36, 0.14)',
    '--danger': '#F43F5E',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(244, 63, 94, 0.15)',
  },
};

export const DAYLIGHT_ALABASTER_THEME: AppThemeDefinition = {
  id: 'daylight-alabaster',
  name: 'المرمر النهاري',
  englishName: 'Daylight Alabaster',
  mood: 'إضاءة نهارية عالية الوضوح مع لمسات ذهبية وزجاج نقي',
  description:
    'واجهة نهارية صافية بتباين عالٍ (#F4F6F9) وبطاقات ناصعة (#FFFFFF) ونص أردوازي حاد لراحة العين في الإضاءة الساطعة.',
  isDark: false,
  capsuleGroup: 'auto',
  swatches: ['#F4F6F9', '#FFFFFF', '#B45309'],
  vars: {
    '--bg-main': '#F2F4F8',
    '--bg-surface': '#FFFFFF',
    '--bg-header': '#F8FAFC',
    '--bg-table-header': '#E8EDF4',
    '--bg-nav-active': 'rgba(180, 83, 9, 0.11)',
    '--bg-zebra': 'rgba(15, 23, 42, 0.028)',
    '--bg-numeric': 'rgba(180, 83, 9, 0.06)',
    '--row-hover-bg': 'rgba(180, 83, 9, 0.09)',
    '--surface-well': '#E9EEF5',
    '--surface-subtle': 'rgba(15, 23, 42, 0.038)',
    '--surface-pill': '#FFFFFF',
    '--surface-overlay': 'rgba(15, 23, 42, 0.42)',
    '--text-primary': '#0F172A',
    '--text-muted': '#475569',
    '--border-color': 'rgba(15, 23, 42, 0.13)',
    '--grid-color': 'rgba(15, 23, 42, 0.09)',
    '--accent': '#B45309',
    '--accent-bright': '#92400E',
    '--accent-deep': '#78350F',
    '--accent-fg': '#FFFFFF',
    '--spatial-secondary': '#059669',
    '--spatial-aurora': '#D97706',
    '--marine-caustic-1': 'rgba(180, 83, 9, 0.12)',
    '--marine-caustic-2': 'rgba(5, 150, 105, 0.10)',
    '--success': '#047857',
    '--success-fg': '#FFFFFF',
    '--success-bg': 'rgba(4, 120, 87, 0.11)',
    '--warning': '#B45309',
    '--warning-bg': 'rgba(180, 83, 9, 0.11)',
    '--danger': '#BE123C',
    '--danger-fg': '#FFFFFF',
    '--danger-bg': 'rgba(190, 18, 60, 0.10)',
  },
};

export const AUTO_ADAPTIVE_THEME: AppThemeDefinition = {
  id: 'auto',
  name: 'الثيم التلقائي',
  englishName: 'Auto Adaptive',
  mood: 'تكيّف تلقائي بين النهار الصافي والسبح والذهب ليلاً',
  description:
    'يتبدل تلقائياً حسب وقت اليوم ونظام الجهاز بين المرمر النهاري الفاتح نهاراً والسبح والذهب الفاخر ليلاً.',
  isDark: true,
  isAuto: true,
  capsuleGroup: 'auto',
  swatches: ['#F4F6F9', '#D4AF37', '#050506'],
  vars: OBSIDIAN_GOLD_THEME.vars,
};

export const VELVET_GARNET_THEME: AppThemeDefinition = {
  id: 'velvet-garnet',
  name: 'العنابي المخملي والذهب الوردي',
  englishName: 'Velvet Garnet & Rose Gold',
  mood: 'فخامة عنابية ثقيلة مع إضاءة وردية ذهبية دافئة',
  description:
    'خلفية مخملية داكنة بعمق العناب الداكن مع إبراز ياقوتي دافئ وذهب وردي هادئ للقراءة الطويلة.',
  isDark: true,
  capsuleGroup: 'heavy',
  swatches: ['#090406', '#1F0F15', '#E14B6B'],
  vars: {
    '--bg-main': '#090406',
    '--bg-surface': '#14090D',
    '--bg-header': '#0D0508',
    '--bg-table-header': '#1F0F15',
    '--bg-nav-active': 'rgba(225, 75, 107, 0.14)',
    '--bg-zebra': 'rgba(253, 164, 175, 0.032)',
    '--bg-numeric': 'rgba(225, 75, 107, 0.08)',
    '--row-hover-bg': 'rgba(225, 75, 107, 0.12)',
    '--surface-well': '#11070B',
    '--surface-subtle': 'rgba(253, 164, 175, 0.04)',
    '--surface-pill': '#1D0D13',
    '--surface-overlay': 'rgba(9, 4, 6, 0.78)',
    '--text-primary': '#FDF2F4',
    '--text-muted': '#C49AA6',
    '--border-color': 'rgba(225, 75, 107, 0.24)',
    '--grid-color': 'rgba(225, 75, 107, 0.13)',
    '--accent': '#E14B6B',
    '--accent-bright': '#FDA4AF',
    '--accent-deep': '#9F1239',
    '--accent-fg': '#FFFFFF',
    '--spatial-secondary': '#E5B869',
    '--spatial-aurora': '#F4A261',
    '--marine-caustic-1': 'rgba(225, 75, 107, 0.18)',
    '--marine-caustic-2': 'rgba(229, 184, 105, 0.12)',
    '--success': '#34D399',
    '--success-fg': '#041A12',
    '--success-bg': 'rgba(52, 211, 153, 0.14)',
    '--warning': '#FBBF24',
    '--warning-bg': 'rgba(251, 191, 36, 0.14)',
    '--danger': '#FB7185',
    '--danger-fg': '#1D040A',
    '--danger-bg': 'rgba(251, 113, 133, 0.16)',
  },
};

export const ESPRESSO_BRONZE_THEME: AppThemeDefinition = {
  id: 'espresso-bronze',
  name: 'الإسبرسو الداكن والنحاس المعتّق',
  englishName: 'Espresso & Aged Bronze',
  mood: 'دفء نحاسي معتّق مع خشب إسبرسو داكن رصين',
  description:
    'ثيم ثقيل بدرجات البنّي الإسبريسو الفاخر مع لمسات النحاس المعتّق وتباين مريح للغاية للأرقام الطويلة.',
  isDark: true,
  capsuleGroup: 'heavy',
  swatches: ['#090604', '#211710', '#C87D4B'],
  vars: {
    '--bg-main': '#090604',
    '--bg-surface': '#140E0A',
    '--bg-header': '#0D0906',
    '--bg-table-header': '#211710',
    '--bg-nav-active': 'rgba(200, 125, 75, 0.15)',
    '--bg-zebra': 'rgba(240, 185, 138, 0.03)',
    '--bg-numeric': 'rgba(200, 125, 75, 0.08)',
    '--row-hover-bg': 'rgba(200, 125, 75, 0.13)',
    '--surface-well': '#110B08',
    '--surface-subtle': 'rgba(240, 185, 138, 0.042)',
    '--surface-pill': '#1D140E',
    '--surface-overlay': 'rgba(9, 6, 4, 0.78)',
    '--text-primary': '#F7EFE7',
    '--text-muted': '#B5A08F',
    '--border-color': 'rgba(200, 125, 75, 0.24)',
    '--grid-color': 'rgba(200, 125, 75, 0.13)',
    '--accent': '#C87D4B',
    '--accent-bright': '#F0B98A',
    '--accent-deep': '#8C4E26',
    '--accent-fg': '#0F0905',
    '--spatial-secondary': '#D4AF37',
    '--spatial-aurora': '#EA580C',
    '--marine-caustic-1': 'rgba(200, 125, 75, 0.18)',
    '--marine-caustic-2': 'rgba(212, 175, 55, 0.12)',
    '--success': '#34D399',
    '--success-fg': '#041A12',
    '--success-bg': 'rgba(52, 211, 153, 0.14)',
    '--warning': '#F59E0B',
    '--warning-bg': 'rgba(245, 158, 11, 0.15)',
    '--danger': '#F87171',
    '--danger-fg': '#1F0606',
    '--danger-bg': 'rgba(248, 113, 113, 0.16)',
  },
};

export const ROYAL_PLUM_THEME: AppThemeDefinition = {
  id: 'royal-plum',
  name: 'الأرجوان الإمبراطوري والشمبانيا',
  englishName: 'Imperial Plum & Champagne',
  mood: 'عمق أرجواني ملكي مع إضاءة جمشتية وذهبية ناعمة',
  description:
    'خلفية ليلية داكنة بنبض الجمشت الإمبراطوري مع لمسات الشمبانيا الذهبية لتجربة قيادية فاخرة.',
  isDark: true,
  capsuleGroup: 'heavy',
  swatches: ['#08050E', '#1D1530', '#B374F7'],
  vars: {
    '--bg-main': '#08050E',
    '--bg-surface': '#130D20',
    '--bg-header': '#0C0815',
    '--bg-table-header': '#1D1530',
    '--bg-nav-active': 'rgba(179, 116, 247, 0.14)',
    '--bg-zebra': 'rgba(233, 213, 255, 0.03)',
    '--bg-numeric': 'rgba(179, 116, 247, 0.08)',
    '--row-hover-bg': 'rgba(179, 116, 247, 0.12)',
    '--surface-well': '#100A1B',
    '--surface-subtle': 'rgba(233, 213, 255, 0.04)',
    '--surface-pill': '#1B132C',
    '--surface-overlay': 'rgba(8, 5, 14, 0.78)',
    '--text-primary': '#F6F2FF',
    '--text-muted': '#A89BC2',
    '--border-color': 'rgba(179, 116, 247, 0.24)',
    '--grid-color': 'rgba(179, 116, 247, 0.13)',
    '--accent': '#B374F7',
    '--accent-bright': '#E9D5FF',
    '--accent-deep': '#7E22CE',
    '--accent-fg': '#0B0514',
    '--spatial-secondary': '#E8C587',
    '--spatial-aurora': '#38BDF8',
    '--marine-caustic-1': 'rgba(179, 116, 247, 0.18)',
    '--marine-caustic-2': 'rgba(232, 197, 135, 0.12)',
    '--success': '#34D399',
    '--success-fg': '#041A12',
    '--success-bg': 'rgba(52, 211, 153, 0.14)',
    '--warning': '#FBBF24',
    '--warning-bg': 'rgba(251, 191, 36, 0.14)',
    '--danger': '#FB7185',
    '--danger-fg': '#1D040A',
    '--danger-bg': 'rgba(251, 113, 133, 0.16)',
  },
};

export const PLATINUM_GRAPHITE_THEME: AppThemeDefinition = {
  id: 'platinum-graphite',
  name: 'الجرافيت البلاتيني الثقيل',
  englishName: 'Heavy Platinum Graphite',
  mood: 'وقار معماري بلاتيني مع وضوح تنفيذي عالي التباين',
  description:
    'سطح جرافيتي ثقيل مكسو بالبلاتين المصقول ولمعة فولاذية باردة مناسب لجلسات الجرد والحسابات المكثفة.',
  isDark: true,
  capsuleGroup: 'heavy',
  swatches: ['#080A0D', '#1A212B', '#CBD5E1'],
  vars: {
    '--bg-main': '#080A0D',
    '--bg-surface': '#11161D',
    '--bg-header': '#0B0E13',
    '--bg-table-header': '#1A212B',
    '--bg-nav-active': 'rgba(203, 213, 225, 0.12)',
    '--bg-zebra': 'rgba(248, 250, 252, 0.03)',
    '--bg-numeric': 'rgba(203, 213, 225, 0.07)',
    '--row-hover-bg': 'rgba(203, 213, 225, 0.11)',
    '--surface-well': '#0E1218',
    '--surface-subtle': 'rgba(248, 250, 252, 0.04)',
    '--surface-pill': '#181F29',
    '--surface-overlay': 'rgba(8, 10, 13, 0.80)',
    '--text-primary': '#F1F5F9',
    '--text-muted': '#94A3B8',
    '--border-color': 'rgba(203, 213, 225, 0.22)',
    '--grid-color': 'rgba(203, 213, 225, 0.12)',
    '--accent': '#CBD5E1',
    '--accent-bright': '#F8FAFC',
    '--accent-deep': '#64748B',
    '--accent-fg': '#080A0D',
    '--spatial-secondary': '#38BDF8',
    '--spatial-aurora': '#94A3B8',
    '--marine-caustic-1': 'rgba(203, 213, 225, 0.16)',
    '--marine-caustic-2': 'rgba(56, 189, 248, 0.12)',
    '--success': '#34D399',
    '--success-fg': '#041A12',
    '--success-bg': 'rgba(52, 211, 153, 0.14)',
    '--warning': '#FBBF24',
    '--warning-bg': 'rgba(251, 191, 36, 0.14)',
    '--danger': '#FB7185',
    '--danger-fg': '#1D040A',
    '--danger-bg': 'rgba(251, 113, 133, 0.16)',
  },
};

export const CORE_FIVE_THEMES: AppThemeDefinition[] = [
  OBSIDIAN_GOLD_THEME,
  ABYSSAL_EMERALD_THEME,
  MIDNIGHT_TRENCH_THEME,
  BIOLUMINESCENT_REEF_THEME,
  PELAGIC_SAPPHIRE_THEME,
];

export const HEAVY_FOUR_THEMES: AppThemeDefinition[] = [
  VELVET_GARNET_THEME,
  ESPRESSO_BRONZE_THEME,
  ROYAL_PLUM_THEME,
  PLATINUM_GRAPHITE_THEME,
];

export const MARINE_THEMES: AppThemeDefinition[] = CORE_FIVE_THEMES;
export const APP_THEMES: AppThemeDefinition[] = CORE_FIVE_THEMES;
export const MODERN_APP_THEMES: AppThemeDefinition[] = [
  ...CORE_FIVE_THEMES,
  AUTO_ADAPTIVE_THEME,
];
export const ALL_APP_THEMES: AppThemeDefinition[] = [
  ...CORE_FIVE_THEMES,
  AUTO_ADAPTIVE_THEME,
];
export const CURATED_APP_THEMES: AppThemeDefinition[] = [
  ...CORE_FIVE_THEMES,
  ...HEAVY_FOUR_THEMES,
  AUTO_ADAPTIVE_THEME,
];

export const APP_THEME_CAPSULES: Array<{
  id: ThemeCapsuleGroupId;
  title: string;
  subtitle: string;
  themes: AppThemeDefinition[];
}> = [
  {
    id: 'marine',
    title: 'الثيمات الأساسية (السبح والذهب + 4 ثيمات هادئة)',
    subtitle: 'ألوان متزنة بنظام 60-30-10 مع تباين مريح وواضح لكل الشاشات',
    themes: CORE_FIVE_THEMES,
  },
  {
    id: 'heavy',
    title: 'الثيمات الفاخرة الثقيلة (4 ثيمات إضافية راقية)',
    subtitle: 'عنابي مخملي، إسبرسو نحاسي، أرجوان إمبراطوري، وجرافيت بلاتيني عالي التباين',
    themes: HEAVY_FOUR_THEMES,
  },
  {
    id: 'auto',
    title: 'التكيّف التلقائي (نهاري / ليلي)',
    subtitle: 'المرمر النهاري نهاراً + السبح والذهب ليلاً حسب الجهاز والساعة',
    themes: [AUTO_ADAPTIVE_THEME],
  },
];

const LEGACY_APP_THEME_MAP: Record<string, AppThemeId> = {
  'emerald-forest': 'bioluminescent-reef',
  'charcoal-emerald': 'bioluminescent-reef',
  'soft-mint': 'bioluminescent-reef',
  'sage-linen': 'bioluminescent-reef',
  'arctic-snow': 'auto',
  'nordic-dusk': 'pelagic-sapphire',
  'alabaster-glass': 'auto',
  'arctic-fjord': 'midnight-trench',
  aurora: 'pelagic-sapphire',
  'nordic-navy': 'pelagic-sapphire',
  'midnight-slate': 'pelagic-sapphire',
  'midnight-indigo': 'pelagic-sapphire',
  cyberpunk: 'midnight-trench',
  'obsidian-gold': 'obsidian-gold',
  'desert-mirage': 'espresso-bronze',
  'royal-crimson': 'velvet-garnet',
  'velvet-garnet': 'velvet-garnet',
  'espresso-bronze': 'espresso-bronze',
  'royal-plum': 'royal-plum',
  'platinum-graphite': 'platinum-graphite',
  'zen-minimal': 'auto',
  'warm-paper': 'auto',
  'crisp-daylight': 'auto',
  'daylight-alabaster': 'daylight-alabaster',
  auto: 'auto',
};

export function resolveAppThemeId(
  rawId?: string | null
): MarineAppThemeId | HeavyAppThemeId | AutoAppThemeId {
  if (!rawId) return 'obsidian-gold';
  if (rawId === 'auto' || rawId === 'daylight-alabaster') return rawId;
  if (CORE_FIVE_THEMES.some((t) => t.id === rawId)) {
    return rawId as MarineAppThemeId;
  }
  if (HEAVY_FOUR_THEMES.some((t) => t.id === rawId)) {
    return rawId as HeavyAppThemeId;
  }
  return (LEGACY_APP_THEME_MAP[rawId] as MarineAppThemeId | HeavyAppThemeId | AutoAppThemeId) || 'obsidian-gold';
}

/**
 * Resolves which concrete palette Auto Theme renders based on OS color scheme and local hour.
 * Daytime (06:00 - 17:59) or OS light preference -> Daylight Alabaster (light)
 * Nighttime (18:00 - 05:59) or OS dark preference -> Obsidian & Gold (dark)
 */
export function resolveAutoThemeTarget(options?: {
  prefersLight?: boolean;
  hour?: number;
}): AppThemeDefinition {
  let prefersLight = options?.prefersLight;
  if (prefersLight === undefined && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  }
  const hour =
    typeof options?.hour === 'number' ? options.hour : new Date().getHours();
  const isDaytime = hour >= 6 && hour < 18;
  let prefersDark = false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (prefersLight === true) return DAYLIGHT_ALABASTER_THEME;
  if (prefersDark && options?.prefersLight === undefined) return OBSIDIAN_GOLD_THEME;
  return isDaytime ? DAYLIGHT_ALABASTER_THEME : OBSIDIAN_GOLD_THEME;
}

export function getEffectiveAppTheme(
  id?: string | null,
  autoOptions?: { prefersLight?: boolean; hour?: number }
): AppThemeDefinition {
  const resolvedId = resolveAppThemeId(id);
  if (resolvedId === 'auto') {
    return resolveAutoThemeTarget(autoOptions);
  }
  if (resolvedId === 'daylight-alabaster') {
    return DAYLIGHT_ALABASTER_THEME;
  }
  return (
    CORE_FIVE_THEMES.find((t) => t.id === resolvedId) ||
    HEAVY_FOUR_THEMES.find((t) => t.id === resolvedId) ||
    OBSIDIAN_GOLD_THEME
  );
}

export function getAppThemeById(id?: string | null): AppThemeDefinition {
  const resolvedId = resolveAppThemeId(id);
  if (resolvedId === 'auto') return AUTO_ADAPTIVE_THEME;
  if (resolvedId === 'daylight-alabaster') return DAYLIGHT_ALABASTER_THEME;
  return (
    CORE_FIVE_THEMES.find((t) => t.id === resolvedId) ||
    HEAVY_FOUR_THEMES.find((t) => t.id === resolvedId) ||
    OBSIDIAN_GOLD_THEME
  );
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
      'صفوف شفافة ناعمة بلمسة زجاجية وفواصل ضوئية خفيفة للغاية.',
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
      'رأس بارز باللون المعتمد وتباين واضح للأعمدة الرقمية والحصص.',
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
      'توهج خفيف عند التمرير وإبراز رقمي متساوٍ مخصص للتدقيق السريع.',
  },
  {
    id: 'card-based',
    name: 'العرض البطاقي المرن',
    englishName: 'Card-Based Table',
    description:
      'يحول كل سجل إلى بطاقة مستقلة تحتوي الاسم والأفراد والحصة والمبلغ والحالة.',
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
  soft: '0 8px 20px -12px rgba(0, 0, 0, 0.36)',
  elevated: '0 14px 32px -14px rgba(0, 0, 0, 0.48)',
};

export const DEFAULT_APPEARANCE_PROFILES: AppearanceProfile[] = [
  {
    id: 'preset_obsidian_gold',
    name: 'وضع السبح والذهب التلقائي',
    appTheme: 'obsidian-gold',
    appShape: 'geometric-glass',
    tableTheme: 'glass',
    fontFamily: 'ibm-plex',
    fontSizePx: 15,
    rowHeightPx: 44,
    colWidthScale: 100,
    borderRadiusPx: 20,
    cardShadowLevel: 'soft',
    glassEffect: true,
    conditionalFormatting: {
      highlightBlockedRows: true,
      highlightDuplicateNames: true,
      highlightZeroIndividuals: true,
    },
  },
  {
    id: 'preset_night_work',
    name: 'وضع العمق الزمردي الهادئ',
    appTheme: 'abyssal-emerald',
    appShape: 'geometric-glass',
    tableTheme: 'glass',
    fontFamily: 'ibm-plex',
    fontSizePx: 15,
    rowHeightPx: 42,
    colWidthScale: 100,
    borderRadiusPx: 20,
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
    name: 'وضع السويسري السريع للتدقيق',
    appTheme: 'auto',
    appShape: 'swiss-editorial',
    tableTheme: 'data-grid',
    fontFamily: 'ibm-plex',
    fontSizePx: 16,
    rowHeightPx: 44,
    colWidthScale: 105,
    borderRadiusPx: 12,
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
  appShape: 'geometric-glass',
  tableTheme: 'glass',
  fontFamily: 'ibm-plex',
  fontSize: 'md',
  fontWeight: 'normal',
  rowDensity: 'comfortable',
  fontSizePx: 15,
  rowHeightPx: 44,
  colWidthScale: 100,
  borderRadiusPx: 20,
  cardShadowLevel: 'soft',
  glassEffect: true,
  glassOpacityPct: 76,
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

export function applyThemePreferencesToDocument(
  prefs: ThemePreferences,
  accessibility?: {
    reduceMotion?: boolean;
    oneHandedMode?: boolean;
    numeralSystem?: 'western' | 'hindi';
    calendarSystem?: 'gregorian' | 'hijri';
  }
): AppThemeDefinition {
  const effectiveTheme = getEffectiveAppTheme(prefs.appTheme);
  if (typeof document === 'undefined') return effectiveTheme;
  const root = document.documentElement;

  const fontId = resolveArabicFontId(prefs.fontFamily);
  const font = ARABIC_FONTS.find((f) => f.id === fontId) || ARABIC_FONTS[0];
  const sizeStep = FONT_SIZE_MAP[prefs.fontSize] || FONT_SIZE_MAP.md;
  const weight = FONT_WEIGHT_MAP[prefs.fontWeight] || FONT_WEIGHT_MAP.normal;
  const density =
    ROW_DENSITY_MAP[prefs.rowDensity] || ROW_DENSITY_MAP.comfortable;

  if (effectiveTheme.isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    root.dataset.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    root.dataset.colorScheme = 'light';
  }

  Object.entries(effectiveTheme.vars).forEach(([key, val]) => {
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

  const shape = applyAppShapeToDocument(prefs.appShape);

  const radiusPx =
    prefs.appShape && prefs.appShape !== 'geometric-glass'
      ? shape.cardRadiusPx
      : typeof prefs.borderRadiusPx === 'number' &&
        prefs.borderRadiusPx >= 2 &&
        prefs.borderRadiusPx <= 32
      ? prefs.borderRadiusPx
      : shape.cardRadiusPx;

  const glassOpacity =
    typeof prefs.glassOpacityPct === 'number' &&
    prefs.glassOpacityPct >= 40 &&
    prefs.glassOpacityPct <= 100
      ? prefs.glassOpacityPct / 100
      : 0.76;

  const shadowCss =
    shape.id === 'swiss-editorial'
      ? 'none'
      : SHADOW_LEVEL_CSS[prefs.cardShadowLevel || 'soft'] || SHADOW_LEVEL_CSS.soft;

  root.style.setProperty('--app-font-family', font.cssFamily);
  root.style.setProperty('--app-font-size', `${effectiveFontSizePx}px`);
  root.style.setProperty('--app-font-weight', weight.weight);
  root.style.setProperty('--table-cell-py', `${computedPy}px`);
  root.style.setProperty('--table-line-height', density.lineHeight);
  root.style.setProperty('--table-col-scale', String(colWidthScale));
  root.style.setProperty('--card-radius', `${radiusPx}px`);
  root.style.setProperty('--glass-opacity', String(glassOpacity));
  root.style.setProperty('--card-shadow', shadowCss);
  root.style.setProperty('--accent-ai', effectiveTheme.vars['--accent']);
  root.style.setProperty('--accent-ai-glow', effectiveTheme.vars['--marine-caustic-1']);
  root.style.setProperty('--spatial-accent', effectiveTheme.vars['--accent']);
  root.style.setProperty('--spatial-glow', effectiveTheme.vars['--marine-caustic-1']);
  root.style.setProperty('--spatial-glow-secondary', effectiveTheme.vars['--marine-caustic-2']);

  root.dataset.appTheme = resolveAppThemeId(prefs.appTheme);
  root.dataset.resolvedTheme = effectiveTheme.id;
  root.dataset.tableTheme = resolveTableThemeId(prefs.tableTheme);
  root.dataset.glass =
    shape.id === 'swiss-editorial' ? '0' : prefs.glassEffect !== false ? '1' : '0';
  root.dataset.reduceMotion = accessibility?.reduceMotion ? '1' : '0';
  root.dataset.oneHanded = accessibility?.oneHandedMode ? '1' : '0';
  root.dataset.numerals = accessibility?.numeralSystem || 'western';
  root.dataset.calendar = accessibility?.calendarSystem || 'gregorian';

  return effectiveTheme;
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
