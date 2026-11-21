import type {
  Agency,
  CalculationSettings,
  Person,
  RelationCategory,
  SectionTableHeaderMeta,
} from '../types/agency';
import { getEffectiveAllocationForPerson } from './agencyLogic';

export interface RelationCategoryMeta {
  id: RelationCategory;
  label: string;
  shortLabel: string;
  description: string;
  badgeColorVar: string;
  badgeBgVar: string;
}

export const RELATION_CATEGORIES: RelationCategoryMeta[] = [
  {
    id: 'favorites',
    label: 'المفضلة',
    shortLabel: 'مفضل',
    description: 'أسماء أو عائلات يتكرر الاعتماد عليها أو تحتاج وصولاً سريعًا.',
    badgeColorVar: 'var(--accent)',
    badgeBgVar: 'var(--bg-nav-active)',
  },
  {
    id: 'edit_later',
    label: 'التعديل لاحقًا',
    shortLabel: 'تعديل لاحقًا',
    description: 'أسماء تم تأجيل تعديل بياناتها أو أعدادها لوقت لاحق كي لا تُنسى.',
    badgeColorVar: 'var(--warning)',
    badgeBgVar: 'var(--warning-bg)',
  },
  {
    id: 'reminder',
    label: 'التذكير',
    shortLabel: 'تذكير',
    description: 'عرض الاسم مع الملاحظة أو الموضوع والتاريخ المطلوب تذكره.',
    badgeColorVar: 'var(--danger)',
    badgeBgVar: 'var(--danger-bg)',
  },
  {
    id: 'delivery_notes',
    label: 'ملاحظات التوصيل / الخط',
    shortLabel: 'توصيل',
    description: 'حفظ موقع السكن، رقم التواصل، والتوقيت المناسب لعمال التوصيل.',
    badgeColorVar: 'var(--success)',
    badgeBgVar: 'var(--success-bg)',
  },
  {
    id: 'pending_audit',
    label: 'قيد المتابعة / المراجعة',
    shortLabel: 'مراجعة',
    description: 'تمييز الأسماء التي تحتاج مراجعة حسابية أو مطابقة حصة قبل اعتمادها.',
    badgeColorVar: 'var(--warning)',
    badgeBgVar: 'var(--warning-bg)',
  },
];

export function getRelationCategoryMeta(
  category: RelationCategory
): RelationCategoryMeta {
  return (
    RELATION_CATEGORIES.find((c) => c.id === category) ||
    RELATION_CATEGORIES[0]
  );
}

export function resolveSectionTableHeader(params: {
  key: string;
  tableHeaders: Record<string, SectionTableHeaderMeta>;
  fallbackTitle: string;
  fallbackSubtitle?: string;
}): SectionTableHeaderMeta {
  const existing = params.tableHeaders?.[params.key];
  const today = new Date().toISOString().slice(0, 10);
  if (existing) return existing;
  return {
    title: params.fallbackTitle,
    subtitle: params.fallbackSubtitle || '',
    date: today,
    autoUpdateDate: true,
    lastUpdatedAt: today,
  };
}

export function buildSelectedRecordsCopyText(params: {
  persons: Array<{
    name: string;
    agencyName?: string;
    nationalId?: string;
    individuals: number | null;
    blockType?: Person['blockType'];
    blockedIndividuals?: number;
    blockReason?: string;
    status?: Person['status'];
    notes?: string;
  }>;
  settings: CalculationSettings;
  agencies?: Agency[];
}): string {
  const { persons, settings } = params;
  if (persons.length === 0) return '';

  if (persons.length === 1) {
    const p = persons[0];
    const eff = getEffectiveAllocationForPerson(p, settings);
    const indStr =
      eff.summary.scope === 'partial'
        ? `${eff.eligibleIndividuals} من ${p.individuals ?? 0}`
        : String(eff.eligibleIndividuals ?? 0);
    return [
      `الاسم: ${p.name}`,
      p.agencyName ? `الوكالة: ${p.agencyName}` : '',
      p.nationalId ? `رقم البطاقة: ${p.nationalId}` : '',
      `الأفراد المستحقون: ${indStr}`,
      `الحصة: ${eff.quotaText}`,
      `المبلغ: ${eff.priceText}`,
      `الحالة: ${eff.summary.shortLabel}`,
      p.blockReason ? `سبب الحظر: ${p.blockReason}` : '',
      p.notes ? `الملاحظات: ${p.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return persons
    .map((p, i) => {
      const eff = getEffectiveAllocationForPerson(p, settings);
      const note = p.notes ? ` (${p.notes})` : '';
      return `${i + 1}. ${p.name} — ${eff.eligibleIndividuals ?? 0} أفراد — ${eff.quotaText} — ${eff.priceText} [${eff.summary.shortLabel}]${note}`;
    })
    .join('\n');
}
