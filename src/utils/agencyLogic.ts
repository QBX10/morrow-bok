import type {
  AgencyExpense,
  AuditIssue,
  BlockScope,
  CalculationSettings,
  Person,
} from '../types/agency.ts';

export const DEFAULT_CALCULATION_SETTINGS: CalculationSettings = {
  kgPerIndividual: 9,
  kgPerBag: 50,
  feePerIndividualIqd: 200,
  fixedCardFeeIqd: 250,
  calculationMode: 'instant',
  includeBlockedInFees: false,
  roundingStepIqd: 0,
  discountPercent: 0,
  defaultWorkerWageIqd: 1000,
  defaultGeneralExpenseIqd: 500,
};

export function normalizeArabic(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

export function initialLetter(name: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '—';
  const ch = trimmed[0];
  if (ch === 'أ' || ch === 'إ' || ch === 'آ') return 'ا';
  return ch;
}

export function normalizePhoneNumber(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s\-().]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.slice(2);
  }
  if (/^07\d{9}$/.test(cleaned)) {
    return '+964' + cleaned.slice(1);
  }
  if (/^7\d{9}$/.test(cleaned)) {
    return '+964' + cleaned;
  }
  if (!cleaned.startsWith('+') && /^\d{8,15}$/.test(cleaned)) {
    return '+' + cleaned;
  }
  return cleaned;
}

export interface PersonBlockSummary {
  scope: BlockScope;
  totalIndividuals: number;
  blockedIndividuals: number;
  eligibleIndividuals: number;
  shortLabel: string;
}

export function getPersonBlockSummary(
  person: Pick<Person, 'individuals'> &
    Partial<Pick<Person, 'status' | 'blockType' | 'blockedIndividuals'>>
): PersonBlockSummary {
  const total = Math.max(0, person.individuals ?? 0);

  if (person.status === 'مؤرشف' || person.blockType === 'archived') {
    return {
      scope: 'archived',
      totalIndividuals: total,
      blockedIndividuals: total,
      eligibleIndividuals: 0,
      shortLabel: 'مؤرشف',
    };
  }

  if (person.status === 'محجوب' || person.blockType === 'full') {
    return {
      scope: 'full',
      totalIndividuals: total,
      blockedIndividuals: total,
      eligibleIndividuals: 0,
      shortLabel: 'حظر كامل',
    };
  }

  if (person.blockType === 'partial' && (person.blockedIndividuals ?? 0) > 0) {
    const blocked = Math.min(total, Math.max(0, person.blockedIndividuals ?? 0));
    const eligible = Math.max(0, total - blocked);
    if (eligible === 0 && total > 0) {
      return {
        scope: 'full',
        totalIndividuals: total,
        blockedIndividuals: total,
        eligibleIndividuals: 0,
        shortLabel: 'حظر كامل',
      };
    }
    return {
      scope: 'partial',
      totalIndividuals: total,
      blockedIndividuals: blocked,
      eligibleIndividuals: eligible,
      shortLabel: `حظر جزئي (${blocked})`,
    };
  }

  return {
    scope: 'none',
    totalIndividuals: total,
    blockedIndividuals: 0,
    eligibleIndividuals: total,
    shortLabel: 'نشط',
  };
}

export function applyFeeRules(
  rawPrice: number,
  settings: CalculationSettings = DEFAULT_CALCULATION_SETTINGS
): number {
  const discountPct = Math.max(0, Math.min(100, settings.discountPercent ?? 0));
  const afterDiscount =
    discountPct > 0 ? rawPrice * (1 - discountPct / 100) : rawPrice;
  const step = Math.max(0, settings.roundingStepIqd ?? 0);
  if (step > 0) {
    return Math.round(afterDiscount / step) * step;
  }
  return Math.round(afterDiscount);
}

export function calculateAllocation(
  individuals: number | null | undefined,
  settings: CalculationSettings = DEFAULT_CALCULATION_SETTINGS
): {
  totalKg: number;
  fullBags: number;
  remainderKg: number;
  priceIqd: number;
} | null {
  if (individuals === null || individuals === undefined || individuals < 0) {
    return null;
  }
  if (individuals === 0) {
    return { totalKg: 0, fullBags: 0, remainderKg: 0, priceIqd: 0 };
  }
  const totalKg = individuals * settings.kgPerIndividual;
  const fullBags = Math.floor(totalKg / settings.kgPerBag);
  const remainderKg = totalKg % settings.kgPerBag;
  const rawPrice =
    individuals * settings.feePerIndividualIqd + settings.fixedCardFeeIqd;
  const priceIqd = applyFeeRules(rawPrice, settings);
  return { totalKg, fullBags, remainderKg, priceIqd };
}

export function formatNumberCompact(num: number): string {
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

export function formatQuota(
  individuals: number | null | undefined,
  legacyQuantity?: string,
  settings: CalculationSettings = DEFAULT_CALCULATION_SETTINGS
): string {
  const alloc = calculateAllocation(individuals, settings);
  if (!alloc) return legacyQuantity || '—';
  if (alloc.totalKg === 0) return '0 كغم';
  if (alloc.fullBags === 0) return `${formatNumberCompact(alloc.remainderKg)} كغم`;
  if (alloc.remainderKg === 0) return `${alloc.fullBags} كيس`;
  return `${alloc.fullBags} كيس + ${formatNumberCompact(alloc.remainderKg)} كغم`;
}

export function formatTotalQuota(
  totalKg: number,
  settings: CalculationSettings = DEFAULT_CALCULATION_SETTINGS
): string {
  const fullBags = Math.floor(totalKg / settings.kgPerBag);
  const remainderKg = totalKg % settings.kgPerBag;
  if (totalKg === 0) return '0 كغم';
  if (fullBags === 0) return `${formatNumberCompact(remainderKg)} كغم`;
  if (remainderKg === 0) return `${fullBags} كيس`;
  return `${fullBags} كيس + ${formatNumberCompact(remainderKg)} كغم`;
}

export function formatIqd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `${amount.toLocaleString('en-US')} د.ع`;
}

export function getEffectiveAllocationForPerson(
  person: Pick<Person, 'individuals'> &
    Partial<
      Pick<Person, 'legacyQuantity' | 'status' | 'blockType' | 'blockedIndividuals'>
    >,
  settings: CalculationSettings = DEFAULT_CALCULATION_SETTINGS
): {
  summary: PersonBlockSummary;
  eligibleIndividuals: number | null;
  quotaText: string;
  priceIqd: number | null;
  priceText: string;
} {
  const summary = getPersonBlockSummary(person);
  if (summary.scope === 'full' || summary.scope === 'archived') {
    const blockedCardFee =
      summary.scope === 'full' && settings.includeBlockedInFees
        ? applyFeeRules(settings.fixedCardFeeIqd, settings)
        : 0;
    return {
      summary,
      eligibleIndividuals: 0,
      quotaText: summary.scope === 'full' ? 'مستبعد (0 كغم)' : 'مؤرشف',
      priceIqd: blockedCardFee,
      priceText: formatIqd(blockedCardFee),
    };
  }

  const eligible =
    person.individuals === null || person.individuals === undefined
      ? null
      : summary.eligibleIndividuals;

  const alloc = calculateAllocation(eligible, settings);
  return {
    summary,
    eligibleIndividuals: eligible,
    quotaText: formatQuota(eligible, person.legacyQuantity, settings),
    priceIqd: alloc ? alloc.priceIqd : null,
    priceText: alloc ? formatIqd(alloc.priceIqd) : '—',
  };
}

export interface AgencyFinancialMetrics {
  registeredHouseholds: number;
  activeHouseholds: number;
  activeIndividuals: number;
  blockedCount: number;
  blockedIndividualsTotal: number;
  totalKg: number;
  fullBags: number;
  remainderKg: number;
  revenue: number;
  workerWages: number;
  generalExpenses: number;
  totalExpenses: number;
  profit: number;
}

export function computeAgencyMetrics(
  persons: Person[],
  expenses: AgencyExpense[],
  settings: CalculationSettings = DEFAULT_CALCULATION_SETTINGS
): AgencyFinancialMetrics {
  let registeredHouseholds = 0;
  let activeHouseholds = 0;
  let activeIndividuals = 0;
  let blockedCount = 0;
  let blockedIndividualsTotal = 0;
  let totalKg = 0;
  let revenue = 0;

  for (const p of persons) {
    const summary = getPersonBlockSummary(p);
    if (summary.scope === 'archived') {
      continue;
    }
    registeredHouseholds += 1;

    if (summary.scope === 'full') {
      blockedCount += 1;
      blockedIndividualsTotal += summary.blockedIndividuals;
      if (settings.includeBlockedInFees) {
        revenue += applyFeeRules(settings.fixedCardFeeIqd, settings);
      }
      continue;
    }

    if (summary.scope === 'partial') {
      blockedCount += 1;
      blockedIndividualsTotal += summary.blockedIndividuals;
    }

    if (summary.eligibleIndividuals > 0) {
      activeHouseholds += 1;
      activeIndividuals += summary.eligibleIndividuals;
      const alloc = calculateAllocation(summary.eligibleIndividuals, settings);
      if (alloc) {
        totalKg += alloc.totalKg;
        revenue += alloc.priceIqd;
      }
    }
  }

  const fullBags = Math.floor(totalKg / settings.kgPerBag);
  const remainderKg = totalKg % settings.kgPerBag;

  let workerWages = 0;
  let generalExpenses = 0;
  for (const exp of expenses) {
    if (exp.category === 'worker_wages') {
      workerWages += exp.amountIqd;
    } else {
      generalExpenses += exp.amountIqd;
    }
  }

  const totalExpenses = workerWages + generalExpenses;
  const profit = revenue - totalExpenses;

  return {
    registeredHouseholds,
    activeHouseholds,
    activeIndividuals,
    blockedCount,
    blockedIndividualsTotal,
    totalKg,
    fullBags,
    remainderKg,
    revenue,
    workerWages,
    generalExpenses,
    totalExpenses,
    profit,
  };
}

export function auditAgencyPersons(persons: Person[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const seenNames = new Map<string, Person>();

  for (const p of persons) {
    if (p.status === 'مؤرشف' || p.blockType === 'archived') continue;

    const norm = normalizeArabic(p.name);
    if (norm) {
      const existing = seenNames.get(norm);
      if (existing) {
        issues.push({
          id: `dup_${p.id}_${existing.id}`,
          severity: 'high',
          personId: p.id,
          personName: p.name,
          agencyId: p.agencyId,
          message: `اسم مكرر مع السجل #${existing.id} في الوكالة`,
        });
      } else {
        seenNames.set(norm, p);
      }
    }

    if (p.individuals === null || p.individuals <= 0) {
      issues.push({
        id: `ind_${p.id}`,
        severity: 'high',
        personId: p.id,
        personName: p.name,
        agencyId: p.agencyId,
        message: 'عدد الأفراد مفقود أو يساوي صفرًا',
      });
    }

    if (
      p.blockType === 'partial' &&
      p.individuals !== null &&
      p.blockedIndividuals >= p.individuals
    ) {
      issues.push({
        id: `blk_${p.id}`,
        severity: 'medium',
        personId: p.id,
        personName: p.name,
        agencyId: p.agencyId,
        message: 'عدد المحظورين جزئيًا يساوي أو يتجاوز إجمالي الأفراد',
      });
    }

    if (!p.nationalId || p.nationalId.trim().length < 5) {
      issues.push({
        id: `nid_${p.id}`,
        severity: 'medium',
        personId: p.id,
        personName: p.name,
        agencyId: p.agencyId,
        message: 'رقم البطاقة التموينية / الهوية غير مكتمل',
      });
    }
  }

  return issues;
}
