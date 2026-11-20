import type {
  Agency,
  AgencyExpense,
  CalculationSettings,
  FreeformHeaderConfig,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
  ReadyList,
  ReadyListItem,
  RelationEntry,
  SectionTableHeaderMeta,
} from '../types/agency.ts';
import {
  computeAgencyMetrics,
  getEffectiveAllocationForPerson,
  normalizeArabic,
} from './agencyLogic.ts';

export const ARABIC_MONTH_NAMES: Record<number, string> = {
  1: 'كانون الثاني',
  2: 'شباط',
  3: 'آذار',
  4: 'نيسان',
  5: 'أيار',
  6: 'حزيران',
  7: 'تموز',
  8: 'آب',
  9: 'أيلول',
  10: 'تشرين الأول',
  11: 'تشرين الثاني',
  12: 'كانون الأول',
};

export function getArabicMonthName(monthNumber: number): string {
  const m = Math.max(1, Math.min(12, Math.round(monthNumber || 1)));
  return ARABIC_MONTH_NAMES[m] || `شهر ${m}`;
}

export function formatPeriodDateYMD(isoDate?: string): string {
  const clean = String(isoDate || '').trim();
  const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    const today = new Date().toISOString().slice(0, 10).split('-');
    return `${today[0]} / ${today[1]} / ${today[2]}`;
  }
  return `${match[1]} / ${match[2].padStart(2, '0')} / ${match[3].padStart(2, '0')}`;
}

export function buildDefaultPeriodMeta(params?: {
  date?: string;
  quotaName?: string;
  quotaNumber?: string;
}): PeriodQuotaMeta {
  const iso =
    params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);
  const [yStr, mStr] = iso.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const monthNumber = Math.max(1, Math.min(12, Number(mStr) || 1));
  return {
    fullDate: iso,
    year,
    monthNumber,
    monthName: getArabicMonthName(monthNumber),
    quotaName: params?.quotaName?.trim() || 'الحصة التموينية المعتمدة',
    quotaNumber: params?.quotaNumber?.trim() || '1',
    quotaDate: iso,
  };
}

export function resolvePeriodMeta(
  period?: Partial<PeriodQuotaMeta> | null,
  fallbackDate?: string
): PeriodQuotaMeta {
  const base = buildDefaultPeriodMeta({ date: fallbackDate });
  if (!period) return base;
  const fullDate =
    period.fullDate && /^\d{4}-\d{2}-\d{2}$/.test(period.fullDate)
      ? period.fullDate
      : base.fullDate;
  const parsedYear = Number(fullDate.slice(0, 4)) || base.year;
  const parsedMonth = Number(fullDate.slice(5, 7)) || base.monthNumber;
  const monthNumber =
    typeof period.monthNumber === 'number' &&
    period.monthNumber >= 1 &&
    period.monthNumber <= 12
      ? period.monthNumber
      : parsedMonth;
  const year =
    typeof period.year === 'number' && period.year >= 1990
      ? period.year
      : parsedYear;
  return {
    fullDate,
    year,
    monthNumber,
    monthName: period.monthName?.trim() || getArabicMonthName(monthNumber),
    quotaName: period.quotaName?.trim() || base.quotaName,
    quotaNumber: period.quotaNumber?.trim() || base.quotaNumber,
    quotaDate:
      period.quotaDate && /^\d{4}-\d{2}-\d{2}$/.test(period.quotaDate)
        ? period.quotaDate
        : fullDate,
  };
}

export const DEFAULT_FREEFORM_HEADER: FreeformHeaderConfig = {
  topCustomTitle: '',
  freeSubtitles: [],
  subtitlesLayout: 'stacked',
  align: 'right',
  size: 'lg',
  stylePreset: 'classic_official',
  customColor: '',
  borderColor: '',
  showPeriodCard: true,
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMonthlyArchiveSnapshot(params: {
  id?: string;
  label?: string;
  archiveSource: 'manual' | 'auto';
  isClosed: boolean;
  periodMeta: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  readyListItems: ReadyListItem[];
  expenses: AgencyExpense[];
  relations: RelationEntry[];
  tableHeaders: Record<string, SectionTableHeaderMeta>;
  calculationSettings: CalculationSettings;
}): MonthlyArchiveRecord {
  const nowIso = new Date().toISOString();
  const resolvedPeriod = resolvePeriodMeta(params.periodMeta);
  const metrics = computeAgencyMetrics(
    params.persons,
    params.expenses,
    params.calculationSettings
  );

  const defaultLabel = `${resolvedPeriod.monthName} ${resolvedPeriod.year} — ${resolvedPeriod.quotaName} (${resolvedPeriod.quotaNumber})`;

  return {
    id:
      params.id ||
      `arch_${resolvedPeriod.year}_${String(resolvedPeriod.monthNumber).padStart(
        2,
        '0'
      )}_q${resolvedPeriod.quotaNumber}_${Date.now().toString(36)}`,
    label: params.label?.trim() || defaultLabel,
    createdAt: nowIso.slice(0, 10),
    closedAt: params.isClosed ? nowIso.slice(0, 10) : undefined,
    isClosed: params.isClosed,
    archiveSource: params.archiveSource,
    periodMeta: deepClone(resolvedPeriod),
    freeformHeader: params.freeformHeader
      ? deepClone(params.freeformHeader)
      : undefined,
    agencies: deepClone(params.agencies),
    persons: deepClone(params.persons),
    readyLists: deepClone(params.readyLists),
    readyListItems: deepClone(params.readyListItems),
    expenses: deepClone(params.expenses),
    relations: deepClone(params.relations),
    tableHeaders: deepClone(params.tableHeaders),
    calculationSettings: deepClone(params.calculationSettings),
    summary: {
      totalAgencies: params.agencies.length,
      totalHouseholds: params.persons.length,
      activeHouseholds: metrics.activeHouseholds,
      totalIndividuals: metrics.activeIndividuals,
      totalKg: metrics.totalKg,
      totalRevenueIqd: metrics.revenue,
      totalExpensesIqd: metrics.totalExpenses,
    },
  };
}

export function prepareNextMonthRollover(params: {
  currentPeriod: PeriodQuotaMeta;
  nextQuotaName?: string;
  nextQuotaNumber?: string;
  nextDate?: string;
}): PeriodQuotaMeta {
  const cur = resolvePeriodMeta(params.currentPeriod);
  const nextMonth = cur.monthNumber === 12 ? 1 : cur.monthNumber + 1;
  const nextYear = cur.monthNumber === 12 ? cur.year + 1 : cur.year;
  const fallbackDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const fullDate =
    params.nextDate && /^\d{4}-\d{2}-\d{2}$/.test(params.nextDate)
      ? params.nextDate
      : fallbackDate;

  const numericQuota = Number(cur.quotaNumber);
  const defaultNextQuotaNum = Number.isFinite(numericQuota)
    ? String(numericQuota + 1)
    : '1';

  return {
    fullDate,
    year: nextYear,
    monthNumber: nextMonth,
    monthName: getArabicMonthName(nextMonth),
    quotaName:
      params.nextQuotaName?.trim() ||
      `حصة شهر ${getArabicMonthName(nextMonth)}`,
    quotaNumber: params.nextQuotaNumber?.trim() || defaultNextQuotaNum,
    quotaDate: fullDate,
  };
}

export type ArchiveChangeFilter =
  | 'all'
  | 'active'
  | 'decreased'
  | 'added_or_deleted'
  | 'partial_block'
  | 'full_block'
  | 'archived';

export function filterArchivePersons(params: {
  persons: Person[];
  periodMeta?: PeriodQuotaMeta;
  query: string;
  agencyId: number | 'all';
  changeFilter: ArchiveChangeFilter;
}): Person[] {
  const q = normalizeArabic(params.query);
  const quotaMetaText = params.periodMeta
    ? normalizeArabic(
        `${params.periodMeta.quotaName} ${params.periodMeta.quotaNumber} ${params.periodMeta.monthName} ${params.periodMeta.year}`
      )
    : '';

  return params.persons.filter((p) => {
    if (params.agencyId !== 'all' && p.agencyId !== params.agencyId) {
      return false;
    }

    if (params.changeFilter === 'active' && p.blockType !== 'none') {
      return false;
    }
    if (params.changeFilter === 'partial_block' && p.blockType !== 'partial') {
      return false;
    }
    if (
      params.changeFilter === 'full_block' &&
      p.blockType !== 'full' &&
      p.status !== 'محجوب'
    ) {
      return false;
    }
    if (
      params.changeFilter === 'archived' &&
      p.blockType !== 'archived' &&
      p.status !== 'مؤرشف'
    ) {
      return false;
    }
    if (params.changeFilter === 'decreased') {
      const hasDecrease =
        (p.decreaseCount ?? 0) > 0 ||
        normalizeArabic(p.notes).includes('نزول') ||
        normalizeArabic(p.notes).includes('نقص');
      if (!hasDecrease) return false;
    }
    if (params.changeFilter === 'added_or_deleted') {
      const hasAddDel =
        (p.addOrDeleteCount ?? 0) > 0 ||
        p.addOrDeleteAction === 'إضافة' ||
        p.addOrDeleteAction === 'حذف' ||
        normalizeArabic(p.notes).includes('اضاف') ||
        normalizeArabic(p.notes).includes('حذف');
      if (!hasAddDel) return false;
    }

    if (!q) return true;
    const haystack = normalizeArabic(
      `${p.name} ${p.nationalId || ''} ${p.notes || ''} ${p.blockReason || ''} ${p.customCategory || ''} ${quotaMetaText}`
    );
    return haystack.includes(q);
  });
}

export function filterMonthlyArchives(params: {
  archives: MonthlyArchiveRecord[];
  query: string;
  yearFilter: number | 'all';
  monthFilter: number | 'all';
  quotaFilter: string;
}): MonthlyArchiveRecord[] {
  const q = normalizeArabic(params.query);
  const qQuota = normalizeArabic(params.quotaFilter);
  return params.archives.filter((arch) => {
    if (
      params.yearFilter !== 'all' &&
      arch.periodMeta.year !== params.yearFilter
    ) {
      return false;
    }
    if (
      params.monthFilter !== 'all' &&
      arch.periodMeta.monthNumber !== params.monthFilter
    ) {
      return false;
    }
    if (
      qQuota &&
      !normalizeArabic(arch.periodMeta.quotaNumber).includes(qQuota) &&
      !normalizeArabic(arch.periodMeta.quotaName).includes(qQuota)
    ) {
      return false;
    }
    if (!q) return true;
    const metaText = normalizeArabic(
      `${arch.label} ${arch.periodMeta.monthName} ${arch.periodMeta.monthNumber} ${arch.periodMeta.year} ${arch.periodMeta.quotaName} ${arch.periodMeta.quotaNumber}`
    );
    if (metaText.includes(q)) return true;
    return arch.persons.some((p) =>
      normalizeArabic(`${p.name} ${p.nationalId} ${p.notes}`).includes(q)
    );
  });
}

export interface SnippetRecordInput {
  name: string;
  agencyName?: string;
  nationalId?: string;
  individuals: number | null;
  decreaseCount?: number;
  addOrDeleteCount?: number;
  addOrDeleteAction?: 'إضافة' | 'حذف' | 'لا يوجد';
  blockType?: Person['blockType'];
  blockedIndividuals?: number;
  blockReason?: string;
  status?: Person['status'];
  notes?: string;
  updatedAt?: string;
}

export interface SnippetCardDetails {
  name: string;
  agencyName: string;
  nationalId: string;
  individualsLabel: string;
  decreaseLabel: string;
  addOrDeleteLabel: string;
  quotaLabel: string;
  priceLabel: string;
  statusLabel: string;
  notesLabel: string;
  periodLine: string;
}

export function buildSnippetCardDetails(params: {
  record: SnippetRecordInput;
  fallbackTitle: string;
  periodMeta?: PeriodQuotaMeta;
  settings: CalculationSettings;
}): SnippetCardDetails {
  const { record, fallbackTitle, periodMeta, settings } = params;
  const eff = getEffectiveAllocationForPerson(record, settings);
  const resolvedPeriod = resolvePeriodMeta(periodMeta, record.updatedAt);

  const decreaseCount = record.decreaseCount ?? 0;
  const addDelCount = record.addOrDeleteCount ?? 0;
  const addDelAction = record.addOrDeleteAction || 'لا يوجد';

  const addOrDeleteLabel =
    addDelAction !== 'لا يوجد' && addDelCount > 0
      ? `${addDelAction} (${addDelCount})`
      : addDelAction !== 'لا يوجد'
      ? addDelAction
      : 'لا يوجد';

  return {
    name: record.name,
    agencyName: record.agencyName || fallbackTitle,
    nationalId: record.nationalId || '—',
    individualsLabel:
      eff.summary.scope === 'partial'
        ? `${eff.eligibleIndividuals ?? 0} مستحق من أصل ${record.individuals ?? 0}`
        : String(eff.eligibleIndividuals ?? record.individuals ?? 0),
    decreaseLabel: decreaseCount > 0 ? `${decreaseCount} أنفار` : '0',
    addOrDeleteLabel,
    quotaLabel: eff.quotaText,
    priceLabel: eff.priceText,
    statusLabel: eff.summary.shortLabel,
    notesLabel: record.notes?.trim() || record.blockReason?.trim() || 'لا توجد ملاحظات',
    periodLine: `${formatPeriodDateYMD(resolvedPeriod.fullDate)} · ${resolvedPeriod.monthName} (شهر ${resolvedPeriod.monthNumber}) · ${resolvedPeriod.quotaName} (${resolvedPeriod.quotaNumber})`,
  };
}
