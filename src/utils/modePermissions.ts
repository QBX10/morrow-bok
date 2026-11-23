import type { AppModeTier, GranularControlPrefs } from '../types/agency';

export interface ModeCapabilities {
  modeTier: AppModeTier;
  label: string;
  description: string;
  isReadOnlyPdfView: boolean;
  isExpertMode: boolean;
  canSortAndFilter: boolean;
  canViewFinance: boolean;
  canManageFinance: boolean;
  canUseQuickExtract: boolean;
  canToggleEditor: boolean;
  canEditRecords: boolean;
  canUseReadyListBuilder: boolean;
  canManageAgencies: boolean;
  canUseSmartAudit: boolean;
  canUseExcelTools: boolean;
  canCustomizeColumns: boolean;
  canManageCustomCategories: boolean;
  canBulkEdit: boolean;
  canBypassEditConfirm: boolean;
  requireDeleteConfirm: boolean;
  requireEditConfirm: boolean;
  requireAddConfirm: boolean;
}

export const DEFAULT_GRANULAR_CONTROLS: GranularControlPrefs = {
  readonlyPdfMode: false,
  enableSortAndFilter: true,
  enableFinance: true,
  enableManageFinance: true,
  enableQuickExtract: true,
  enableEditRecords: true,
  enableReadyListBuilder: true,
  enableAgencyManagement: true,
  enableSmartAudit: true,
  enableExcelTools: true,
  enableColumnCustomization: true,
  enableCustomCategories: true,
  enableBulkEdit: true,
  bypassEditConfirm: false,
};

export const PERMISSION_SWITCH_META: Array<{
  key: keyof GranularControlPrefs;
  title: string;
  description: string;
  tier: 'main' | 'side';
  riskLevel: 'safe' | 'caution' | 'protected';
  why: string;
}> = [
  {
    key: 'enableEditRecords',
    title: 'تحرير وتعديل السجلات والأسماء',
    description: 'يسمح بإضافة المستفيدين وتعديل أعدادهم وملاحظاتهم مباشرة.',
    tier: 'main',
    riskLevel: 'caution',
    why: 'المستخدم يعمل بحرية كاملة؛ يمكنك قفله عند تسليم الجهاز لشخص للمطالعة فقط.',
  },
  {
    key: 'readonlyPdfMode',
    title: 'قفل القراءة فقط (نمط PDF الآمن)',
    description: 'يجعل الجداول للعرض والقراءة فقط ويُخفي أزرار التعديل مؤقتاً.',
    tier: 'main',
    riskLevel: 'protected',
    why: 'يحمي السجلات أثناء الجرد أو العرض السريع دون تغيير أي بيانات.',
  },
  {
    key: 'bypassEditConfirm',
    title: 'حفظ مباشر بدون نوافذ تأكيد',
    description: 'يطبق التعديلات فوراً بنقرة واحدة مع إبقاء سلة الاسترجاع نشطة.',
    tier: 'main',
    riskLevel: 'protected',
    why: 'يزيد سرعة الإدخال عند التعديل المتكرر، مع إمكانية التراجع الفوري.',
  },
  {
    key: 'enableQuickExtract',
    title: 'السحب الذكي (PDF والكاميرا)',
    description: 'استخراج الجداول بالمسح الضوئي أو دفعات الكاميرا.',
    tier: 'main',
    riskLevel: 'safe',
    why: 'مفتوح افتراضياً للجميع لتسريع إدخال الكشوفات.',
  },
  {
    key: 'enableFinance',
    title: 'عرض الحسابات والمالية وصافي الأرباح',
    description: 'إظهار الإيرادات والأرباح وملخصات الرسوم عبر الوكالات.',
    tier: 'main',
    riskLevel: 'caution',
    why: 'يمكنك إخفاء الأرقام المالية عند مشاركة الشاشة مع الغير.',
  },
  {
    key: 'enableManageFinance',
    title: 'تسجيل وإدارة المصاريف والأجور',
    description: 'إضافة أو حذف مصاريف العمال والمصاريف العامة في المالية.',
    tier: 'side',
    riskLevel: 'caution',
    why: 'يتيح ضبط المصاريف التشغيلية بدقة لكل وكالة.',
  },
  {
    key: 'enableAgencyManagement',
    title: 'إضافة الوكالات وتعديل هويتها',
    description: 'إنشاء وكالات جديدة وتعديل أسمائها وألوانها وشعاراتها.',
    tier: 'side',
    riskLevel: 'caution',
    why: 'يدعم التوسع لإضافة وكالات جديدة بأي وقت.',
  },
  {
    key: 'enableColumnCustomization',
    title: 'تخصيص وترتيب أعمدة الجداول',
    description: 'إظهار وإخفاء الأعمدة وحفظ قوالب العرض الجاهزة.',
    tier: 'side',
    riskLevel: 'safe',
    why: 'يتحكم في بوابة التخصيص فوق الجدول دون تغيير الحسابات الداخلية.',
  },
  {
    key: 'enableBulkEdit',
    title: 'التحديد والتعديل الجماعي',
    description: 'تحديد عدة مستفيدين لنقلهم أو تحديث حالتهم دفعة واحدة.',
    tier: 'side',
    riskLevel: 'caution',
    why: 'يسرّع عمليات التنظيم والترحيل الجماعي.',
  },
  {
    key: 'enableExcelTools',
    title: 'أدوات تصدير Excel والتقارير',
    description: 'إنشاء ملفات Excel وتقارير RTL جاهزة للطباعة.',
    tier: 'side',
    riskLevel: 'safe',
    why: 'مفعّل دائماً لدعم التقارير الرسمية.',
  },
  {
    key: 'enableReadyListBuilder',
    title: 'منشئ القوائم الجاهزة',
    description: 'تجميع عائلات مختارة في قوائم توزيع مستقلة.',
    tier: 'side',
    riskLevel: 'safe',
    why: 'تنظيم التوزيع حسب الخطوط أو المندوبين.',
  },
  {
    key: 'enableSmartAudit',
    title: 'التدقيق الذكي وكشف التضاربات',
    description: 'فحص التكرارات والأعداد غير المنطقية تلقائياً.',
    tier: 'side',
    riskLevel: 'safe',
    why: 'يساعد على نظافة البيانات قبل إغلاق الحصة.',
  },
  {
    key: 'enableCustomCategories',
    title: 'الفئات والتصنيفات المخصصة',
    description: 'إنشاء تصنيفات مرنة مثل: أولوية، توصيل مستعجل، مراجعة.',
    tier: 'side',
    riskLevel: 'safe',
    why: 'تساعد في فرز المستفيدين وتنظيم العمل الميداني.',
  },
  {
    key: 'enableSortAndFilter',
    title: 'البحث والفرز المتقدم بالجداول',
    description: 'تفعيل فلاتر الحالة والفئة والبحث السريع.',
    tier: 'side',
    riskLevel: 'safe',
    why: 'وصول لحظي لأي اسم أو رقم بطاقة.',
  },
];

export const MODE_TIER_META: Array<{
  tier: AppModeTier;
  title: string;
  subtitle: string;
}> = [
  {
    tier: 'beginner',
    title: '1. الوضع المبتدئ / السهل (الافتراضي)',
    subtitle:
      'وضع عرض وقراءة فقط كأنه ملف PDF — واجهة نظيفة تمامًا بدون أزرار معقدة أو تعديل بالخطأ.',
  },
  {
    tier: 'intermediate',
    title: '2. الوضع المتوسط',
    subtitle:
      'يفتح أدوات البحث والفرز والتفاصيل الإضافية، مع إمكانية عرض ملخص الحسابات المالية والطباعة.',
  },
  {
    tier: 'professional',
    title: '3. الوضع الاحترافي',
    subtitle:
      'يفعّل السحب السريع من ملفات PDF، إدارة المالية والمصاريف، القوائم الجاهزة، وأدوات التحرير.',
  },
  {
    tier: 'expert',
    title: '4. الوضع الخبير (حرية مطلقة وتحكم فائق)',
    subtitle:
      'أقصى مستوى من الحرية: تخصيص وإعادة ترتيب وإخفاء الأعمدة، أعمدة وفئات مخصصة، تعديل مباشر وفوري، وإدارة كاملة للوكالات.',
  },
];

/**
 * Unified Mode Capabilities — All privileges are open by default for everyone,
 * governed individually by granular controls in Settings -> "الصلاحيات والتحكم".
 */
export function getUnifiedCapabilities(
  granular?: Partial<GranularControlPrefs>,
  confirmBeforeEdit = true,
  confirmBeforeDelete = true,
  legacyExpertAllowNoConfirm = false
): ModeCapabilities {
  const g: GranularControlPrefs = {
    ...DEFAULT_GRANULAR_CONTROLS,
    ...(granular || {}),
  };

  const readOnly = Boolean(g.readonlyPdfMode);
  const canEdit = !readOnly && g.enableEditRecords;
  const bypassConfirm = g.bypassEditConfirm || legacyExpertAllowNoConfirm;

  return {
    modeTier: 'expert',
    label: readOnly ? 'قفل القراءة فقط' : 'الوضع الموحّد',
    description: readOnly
      ? 'الجدول في وضع القراءة الآمنة فقط — يمكنك فتح التحرير من الصلاحيات والتحكم.'
      : 'جميع الميزات والأدوات متاحة افتراضياً مع تحكم فردي مستقل من قسم الصلاحيات.',
    isReadOnlyPdfView: readOnly,
    isExpertMode: !readOnly,
    canSortAndFilter: g.enableSortAndFilter,
    canViewFinance: g.enableFinance,
    canManageFinance: !readOnly && g.enableFinance && g.enableManageFinance,
    canUseQuickExtract: !readOnly && g.enableQuickExtract,
    canToggleEditor: true,
    canEditRecords: canEdit,
    canUseReadyListBuilder: !readOnly && g.enableReadyListBuilder,
    canManageAgencies: !readOnly && g.enableAgencyManagement,
    canUseSmartAudit: g.enableSmartAudit,
    canUseExcelTools: g.enableExcelTools,
    canCustomizeColumns: g.enableColumnCustomization,
    canManageCustomCategories: !readOnly && g.enableCustomCategories,
    canBulkEdit: !readOnly && g.enableBulkEdit,
    canBypassEditConfirm: bypassConfirm,
    requireDeleteConfirm: bypassConfirm ? false : confirmBeforeDelete,
    requireEditConfirm: bypassConfirm ? false : confirmBeforeEdit,
    requireAddConfirm: false,
  };
}

export function getModeCapabilities(
  modeTier: AppModeTier,
  editorEnabled: boolean,
  expertAllowNoConfirm = false,
  confirmBeforeEdit = true,
  confirmBeforeDelete = true
): ModeCapabilities {
  const isBeginner = modeTier === 'beginner';
  const isIntermediate = modeTier === 'intermediate';
  const isProfessional = modeTier === 'professional';
  const isExpert = modeTier === 'expert';

  const canToggleEditor = !isBeginner;
  const canEditRecords = isExpert
    ? true
    : !isBeginner && (isProfessional ? editorEnabled : editorEnabled);

  const meta =
    MODE_TIER_META.find((m) => m.tier === modeTier) || MODE_TIER_META[0];

  const canBypassEditConfirm = isExpert && expertAllowNoConfirm;

  return {
    modeTier,
    label: meta.title,
    description: meta.subtitle,
    isReadOnlyPdfView: isBeginner,
    isExpertMode: isExpert,
    canSortAndFilter: !isBeginner,
    canViewFinance: isIntermediate || isProfessional || isExpert,
    canManageFinance: isProfessional || isExpert,
    canUseQuickExtract: isProfessional || isExpert,
    canToggleEditor,
    canEditRecords,
    canUseReadyListBuilder: isProfessional || isExpert,
    canManageAgencies: isExpert,
    canUseSmartAudit: isExpert,
    canUseExcelTools: isProfessional || isExpert,
    canCustomizeColumns: isExpert,
    canManageCustomCategories: isExpert,
    canBulkEdit: isExpert,
    canBypassEditConfirm,
    requireDeleteConfirm: isExpert && expertAllowNoConfirm ? false : confirmBeforeDelete,
    requireEditConfirm: canBypassEditConfirm ? false : confirmBeforeEdit,
    requireAddConfirm: false,
  };
}
