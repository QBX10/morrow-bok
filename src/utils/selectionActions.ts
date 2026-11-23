import type { CalculationSettings } from '../types/agency.ts';
import type { SelectablePersonRecord } from '../components/SelectionActionBar.tsx';
import {
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
} from './agencyLogic.ts';

export type SmartCopyMode = 'names_only' | 'details_table' | 'share_summary';

export interface SelectionAggregates {
  count: number;
  activeRecordsCount: number;
  blockedRecordsCount: number;
  totalRawIndividuals: number;
  totalEligibleIndividuals: number;
  totalKg: number;
  fullBags: number;
  remainderKg: number;
  quotaLabel: string;
  totalPriceIqd: number;
  priceLabel: string;
}

export function computeSelectionAggregates(
  records: SelectablePersonRecord[],
  settings: CalculationSettings
): SelectionAggregates {
  let activeRecordsCount = 0;
  let blockedRecordsCount = 0;
  let totalRawIndividuals = 0;
  let totalEligibleIndividuals = 0;
  let totalPriceIqd = 0;

  for (const r of records) {
    const eff = getEffectiveAllocationForPerson(
      {
        individuals: r.individuals,
        legacyQuantity: r.legacyQuantity,
        status: r.status,
        blockType: r.blockType,
        blockedIndividuals: r.blockedIndividuals,
      },
      settings
    );
    totalRawIndividuals += Math.max(0, r.individuals ?? 0);
    if (eff.summary.scope === 'full' || eff.summary.scope === 'archived') {
      blockedRecordsCount += 1;
    } else {
      activeRecordsCount += 1;
    }
    const eligible = eff.eligibleIndividuals ?? 0;
    totalEligibleIndividuals += eligible;
    totalPriceIqd += eff.priceIqd ?? 0;
  }

  const totalKg = totalEligibleIndividuals * settings.kgPerIndividual;
  const fullBags =
    settings.kgPerBag > 0 ? Math.floor(totalKg / settings.kgPerBag) : 0;
  const remainderKg = settings.kgPerBag > 0 ? totalKg % settings.kgPerBag : totalKg;

  return {
    count: records.length,
    activeRecordsCount,
    blockedRecordsCount,
    totalRawIndividuals,
    totalEligibleIndividuals,
    totalKg,
    fullBags,
    remainderKg,
    quotaLabel: formatTotalQuota(totalKg, settings),
    totalPriceIqd,
    priceLabel: formatIqd(totalPriceIqd),
  };
}

export function formatSelectedRecordsCopy(
  records: SelectablePersonRecord[],
  mode: SmartCopyMode,
  settings: CalculationSettings,
  meta?: { title?: string; date?: string }
): string {
  if (records.length === 0) return '';

  if (mode === 'names_only') {
    return records.map((r, i) => `${i + 1}. ${r.name}`).join('\n');
  }

  const agg = computeSelectionAggregates(records, settings);

  if (mode === 'details_table') {
    const lines = records.map((r, i) => {
      const eff = getEffectiveAllocationForPerson(
        {
          individuals: r.individuals,
          legacyQuantity: r.legacyQuantity,
          status: r.status,
          blockType: r.blockType,
          blockedIndividuals: r.blockedIndividuals,
        },
        settings
      );
      const indText = eff.eligibleIndividuals ?? 0;
      const notePart = r.notes ? ` | ${r.notes}` : '';
      return `${i + 1}. ${r.name} — الأفراد: ${indText} — الحصة: ${eff.quotaText} — المبلغ: ${eff.priceText}${notePart}`;
    });
    lines.push('---');
    lines.push(
      `الإجمالي (${agg.count} سجل): ${agg.totalEligibleIndividuals} فرد | ${agg.quotaLabel} | ${agg.priceLabel}`
    );
    return lines.join('\n');
  }

  // mode === 'share_summary' (Ready for WhatsApp / Print share)
  const headerTitle = meta?.title?.trim() || 'كشف المستفيدين المحدد';
  const headerDate = meta?.date?.trim() || new Date().toISOString().slice(0, 10);
  const rowsText = records
    .map((r, i) => {
      const eff = getEffectiveAllocationForPerson(
        {
          individuals: r.individuals,
          legacyQuantity: r.legacyQuantity,
          status: r.status,
          blockType: r.blockType,
          blockedIndividuals: r.blockedIndividuals,
        },
        settings
      );
      const statusSuffix =
        eff.summary.scope === 'none' ? '' : ` [${eff.summary.shortLabel}]`;
      return `${i + 1}) ${r.name}${statusSuffix}\n   • الأفراد: ${
        eff.eligibleIndividuals ?? 0
      } | الحصة: ${eff.quotaText} | الرسوم: ${eff.priceText}${
        r.notes ? `\n   • ملاحظة: ${r.notes}` : ''
      }`;
    })
    .join('\n');

  return [
    `📋 *${headerTitle}*`,
    `📅 التاريخ: ${headerDate}`,
    `━━━━━━━━━━━━━━━━━━`,
    rowsText,
    `━━━━━━━━━━━━━━━━━━`,
    `✅ العدد المحدد: ${agg.count} مستفيد`,
    `👥 إجمالي الأفراد المستحقين: ${agg.totalEligibleIndividuals} فرد`,
    `🌾 إجمالي الحصة: ${agg.quotaLabel}`,
    `💰 إجمالي المبلغ: ${agg.priceLabel}`,
  ].join('\n');
}
