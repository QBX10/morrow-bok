import type { AppModeTier } from '../types/agency';

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
