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
    tier: 'expert',
    title: 'التحرير القياسي الكامل',
    subtitle:
      'جميع أدوات التعديل وتخصيص الجداول والمالية والسحب الذكي متاحة بشكل طبيعي مباشر.',
  },
];

/**
 * Unified Capabilities — Single natural state where all tools and editing
 * are natively open, respecting user confirmation preferences.
 */
export function getUnifiedCapabilities(
  _granular?: Partial<GranularControlPrefs>,
  confirmBeforeEdit = true,
  confirmBeforeDelete = true,
  allowDirectNoConfirm = false
): ModeCapabilities {
  const bypassConfirm = Boolean(allowDirectNoConfirm);

  return {
    modeTier: 'expert',
    label: 'الوضع القياسي الموحد',
    description:
      'جميع أدوات التحرير والجداول والمالية والسحب الذكي مفعّلة بالكامل.',
    isReadOnlyPdfView: false,
    isExpertMode: true,
    canSortAndFilter: true,
    canViewFinance: true,
    canManageFinance: true,
    canUseQuickExtract: true,
    canToggleEditor: true,
    canEditRecords: true,
    canUseReadyListBuilder: true,
    canManageAgencies: true,
    canUseSmartAudit: true,
    canUseExcelTools: true,
    canCustomizeColumns: true,
    canManageCustomCategories: true,
    canBulkEdit: true,
    canBypassEditConfirm: bypassConfirm,
    requireDeleteConfirm: bypassConfirm ? false : confirmBeforeDelete,
    requireEditConfirm: bypassConfirm ? false : confirmBeforeEdit,
    requireAddConfirm: false,
  };
}

export function getModeCapabilities(
  _modeTier: AppModeTier,
  _editorEnabled: boolean,
  expertAllowNoConfirm = false,
  confirmBeforeEdit = true,
  confirmBeforeDelete = true
): ModeCapabilities {
  return getUnifiedCapabilities(
    undefined,
    confirmBeforeEdit,
    confirmBeforeDelete,
    expertAllowNoConfirm
  );
}
