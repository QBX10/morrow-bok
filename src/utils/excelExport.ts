import * as XLSX from 'xlsx';
import type {
  Agency,
  AgencyExpense,
  CalculationSettings,
  Person,
  ReadyList,
  ReadyListItem,
} from '../types/agency';
import {
  computeAgencyMetrics,
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
  initialLetter,
} from './agencyLogic';

export function resolveReadyListItemRecord(
  item: ReadyListItem,
  personMap: Map<number, Person>
) {
  const linked =
    !item.isOverridden && item.sourcePersonId
      ? personMap.get(item.sourcePersonId)
      : undefined;

  const name = linked ? linked.name : item.name;
  const nationalId = linked ? linked.nationalId : item.nationalId || '';
  const notes = linked ? linked.notes : item.notes;
  const blockType = linked
    ? linked.blockType
    : item.blockType ?? (item.status === 'محجوب' ? 'full' : item.status === 'مؤرشف' ? 'archived' : 'none');
  const blockedIndividuals = linked
    ? linked.blockedIndividuals
    : item.blockedIndividuals ?? (item.status === 'محجوب' ? item.individuals ?? 0 : 0);
  const status = linked ? linked.status : item.status;
  const individuals = linked ? linked.individuals : item.individuals;
  const blockReason = linked ? linked.blockReason : item.blockReason || '';

  return {
    name,
    nationalId,
    notes,
    blockType,
    blockedIndividuals,
    status,
    individuals,
    blockReason,
  };
}

export function exportRosterToExcel(params: {
  filename: string;
  persons: Person[];
  agencies: Agency[];
  settings: CalculationSettings;
}) {
  const { filename, persons, agencies, settings } = params;
  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));

  const rows = persons.map((person, idx) => {
    const eff = getEffectiveAllocationForPerson(person, settings);
    return {
      '#': idx + 1,
      الحرف: initialLetter(person.name),
      الاسم: person.name,
      الوكالة: agencyMap.get(person.agencyId) || '',
      'الأفراد المستحقون':
        eff.summary.scope === 'partial'
          ? `${eff.eligibleIndividuals} من ${person.individuals ?? 0}`
          : eff.summary.scope === 'full'
          ? 0
          : person.individuals ?? '',
      الحصة: eff.quotaText,
      'المبلغ (د.ع)': eff.priceIqd ?? 0,
      الحالة: eff.summary.shortLabel,
      الملاحظات: person.notes || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, 'سجل المستفيدين');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportFinancialReportToExcel(params: {
  agencyName: string;
  persons: Person[];
  expenses: AgencyExpense[];
  settings: CalculationSettings;
}) {
  const { agencyName, persons, expenses, settings } = params;
  const m = computeAgencyMetrics(persons, expenses, settings);

  const summaryRows = [
    { البند: 'الوكالة', القيمة: agencyName },
    { البند: 'تاريخ التقرير', القيمة: new Date().toLocaleDateString('ar-IQ') },
    { البند: 'العائلات النشطة', القيمة: m.activeHouseholds },
    { البند: 'عدد الأفراد', القيمة: m.activeIndividuals },
    { البند: 'عدد الأكياس الكاملة', القيمة: m.fullBags },
    { البند: 'إجمالي الحصة', القيمة: formatTotalQuota(m.totalKg, settings) },
    { البند: 'الإيرادات', القيمة: formatIqd(m.revenue) },
    { البند: 'أجور العمال', القيمة: formatIqd(m.workerWages) },
    { البند: 'الصرفيات', القيمة: formatIqd(m.generalExpenses) },
    { البند: 'صافي الأرباح', القيمة: formatIqd(m.profit) },
  ];

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'الملخص المالي');

  if (expenses.length > 0) {
    const expRows = expenses.map((e, idx) => ({
      '#': idx + 1,
      التاريخ: e.occurredAt,
      التصنيف: e.category === 'worker_wages' ? 'أجور العمال' : 'صرفيات',
      البيان: e.description,
      'المبلغ (د.ع)': e.amountIqd,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), 'سجل المصاريف');
  }

  const safe = agencyName.replace(/[<>:"/\\|?*]/g, '').trim() || 'مالية';
  XLSX.writeFile(wb, `التقرير_المالي_${safe}.xlsx`);
}

export function exportReadyListToExcel(params: {
  list: ReadyList;
  items: ReadyListItem[];
  persons: Person[];
  settings: CalculationSettings;
}) {
  const { list, items, persons, settings } = params;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const rows = items.map((item, idx) => {
    const rec = resolveReadyListItemRecord(item, personMap);
    const eff = getEffectiveAllocationForPerson(rec, settings);
    return {
      التسلسل: idx + 1,
      الحرف: initialLetter(rec.name),
      الاسم: rec.name,
      الأفراد:
        eff.summary.scope === 'partial'
          ? `${eff.eligibleIndividuals} من ${rec.individuals ?? 0}`
          : eff.eligibleIndividuals ?? 0,
      الحصة: eff.quotaText,
      'المبلغ (د.ع)': eff.priceIqd ?? 0,
      الحالة: eff.summary.shortLabel,
      الملاحظات: rec.notes || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, 'القائمة الجاهزة');
  const safe = list.name.replace(/[<>:"/\\|?*]/g, '').trim() || 'قائمة';
  XLSX.writeFile(wb, `${safe}.xlsx`);
}

export function buildReadyListShareText(params: {
  list: ReadyList;
  items: ReadyListItem[];
  persons: Person[];
  settings: CalculationSettings;
}): string {
  const { list, items, persons, settings } = params;
  const personMap = new Map(persons.map((p) => [p.id, p]));
  let totalInd = 0;
  let totalKg = 0;
  let totalIqd = 0;

  const lines = items.map((item, idx) => {
    const rec = resolveReadyListItemRecord(item, personMap);
    const eff = getEffectiveAllocationForPerson(rec, settings);
    const elig = eff.eligibleIndividuals ?? 0;
    totalInd += elig;
    totalKg += elig * settings.kgPerIndividual;
    totalIqd += eff.priceIqd ?? 0;
    const notePart = rec.notes ? ` (${rec.notes})` : '';
    return `${idx + 1}. ${rec.name} — ${elig} أفراد — ${eff.quotaText} — ${eff.priceText} [${eff.summary.shortLabel}]${notePart}`;
  });

  const headerLines = [
    `📋 ${list.name}`,
    `📅 التاريخ: ${list.listDate || list.createdAt}`,
    list.subtitle1 ? `• ${list.subtitle1}` : '',
    list.subtitle2 ? `• ${list.subtitle2}` : '',
    '────────────────────────',
  ].filter(Boolean);

  const footerLines = [
    '────────────────────────',
    `الإجمالي: ${items.length} عائلة | ${totalInd} أفراد | ${formatTotalQuota(totalKg, settings)} | ${formatIqd(totalIqd)}`,
  ];

  return [...headerLines, ...lines, ...footerLines].join('\n');
}

export function exportReadyListToTextFile(params: {
  list: ReadyList;
  items: ReadyListItem[];
  persons: Person[];
  settings: CalculationSettings;
}) {
  const text = buildReadyListShareText(params);
  const blob = new Blob(['\uFEFF' + text], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = params.list.name.replace(/[<>:"/\\|?*]/g, '').trim() || 'قائمة';
  a.href = url;
  a.download = `${safe}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportReadyListToImage(params: {
  list: ReadyList;
  items: ReadyListItem[];
  persons: Person[];
  settings: CalculationSettings;
}): Promise<void> {
  const { list, items, persons, settings } = params;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const width = 1120;
  const rowHeight = 42;
  const headerHeight = 148;
  const tableHeadHeight = 46;
  const footerHeight = 64;
  const height =
    headerHeight +
    tableHeadHeight +
    Math.max(1, items.length) * rowHeight +
    footerHeight;

  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر إنشاء الصورة في المتصفح.');
  }

  ctx.scale(dpr, dpr);
  ctx.direction = 'rtl';

  // Crisp printable white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header Banner
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, 128);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.font = 'bold 24px Cairo, Tahoma, sans-serif';
  ctx.fillText(list.name, width - 32, 42);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 15px Cairo, Tahoma, sans-serif';
  if (list.subtitle1) ctx.fillText(list.subtitle1, width - 32, 76);
  if (list.subtitle2) ctx.fillText(list.subtitle2, width - 32, 104);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px Cairo, Tahoma, sans-serif';
  ctx.fillText(`التاريخ: ${list.listDate || list.createdAt}`, 32, 42);

  // Columns (RTL right-to-left x coordinates)
  const cols = [
    { label: '#', x: width - 32, w: 48, align: 'center' as const },
    { label: 'الاسم', x: width - 88, w: 280, align: 'right' as const },
    { label: 'الأفراد', x: width - 380, w: 110, align: 'center' as const },
    { label: 'الحصة', x: width - 500, w: 170, align: 'center' as const },
    { label: 'المبلغ', x: width - 680, w: 140, align: 'center' as const },
    { label: 'الحالة', x: width - 830, w: 110, align: 'center' as const },
    { label: 'الملاحظات', x: width - 950, w: 140, align: 'right' as const },
  ];

  // Table Head
  const tableTop = headerHeight;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, tableTop, width - 48, tableHeadHeight);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, tableTop, width - 48, tableHeadHeight);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Cairo, Tahoma, sans-serif';
  for (const col of cols) {
    ctx.textAlign = col.align;
    const tx = col.align === 'center' ? col.x - col.w / 2 : col.x - 6;
    ctx.fillText(col.label, tx, tableTop + 28);
  }

  let totalInd = 0;
  let totalKg = 0;
  let totalIqd = 0;

  if (items.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.font = '500 15px Cairo, Tahoma, sans-serif';
    ctx.fillText('لا توجد أسماء في هذه القائمة', width / 2, tableTop + tableHeadHeight + 26);
  } else {
    items.forEach((item, idx) => {
      const y = tableTop + tableHeadHeight + idx * rowHeight;
      const rec = resolveReadyListItemRecord(item, personMap);
      const eff = getEffectiveAllocationForPerson(rec, settings);
      const elig = eff.eligibleIndividuals ?? 0;
      totalInd += elig;
      totalKg += elig * settings.kgPerIndividual;
      totalIqd += eff.priceIqd ?? 0;

      ctx.fillStyle = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(24, y, width - 48, rowHeight);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(24, y, width - 48, rowHeight);

      const vals = [
        String(idx + 1),
        rec.name,
        eff.summary.scope === 'partial'
          ? `${eff.eligibleIndividuals} من ${rec.individuals ?? 0}`
          : String(eff.eligibleIndividuals),
        eff.quotaText,
        eff.priceText,
        eff.summary.shortLabel,
        rec.notes || '—',
      ];

      ctx.font = '600 13px Cairo, Tahoma, sans-serif';
      cols.forEach((col, cIdx) => {
        ctx.fillStyle =
          cIdx === 5
            ? eff.summary.scope === 'none'
              ? '#15803d'
              : eff.summary.scope === 'partial'
              ? '#b45309'
              : '#b91c1c'
            : '#0f172a';
        ctx.textAlign = col.align;
        const tx = col.align === 'center' ? col.x - col.w / 2 : col.x - 6;
        const text = vals[cIdx].length > 34 ? vals[cIdx].slice(0, 32) + '…' : vals[cIdx];
        ctx.fillText(text, tx, y + 26);
      });
    });
  }

  // Footer Summary
  const footerY = tableTop + tableHeadHeight + Math.max(1, items.length) * rowHeight + 12;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px Cairo, Tahoma, sans-serif';
  ctx.fillText(
    `الإجمالي: ${items.length} عائلة  |  ${totalInd} أفراد  |  ${formatTotalQuota(totalKg, settings)}  |  ${formatIqd(totalIqd)}`,
    width - 32,
    footerY + 26
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('تعذر توليد ملف الصورة.');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = list.name.replace(/[<>:"/\\|?*]/g, '').trim() || 'قائمة';
  a.href = url;
  a.download = `${safe}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 250);
}

export async function exportSelectedRecordsToImage(params: {
  title: string;
  date?: string;
  records: Array<{
    name: string;
    agencyName?: string;
    nationalId?: string;
    individuals: number | null;
    blockType?: Person['blockType'];
    blockedIndividuals?: number;
    blockReason?: string;
    status?: Person['status'];
    notes?: string;
    updatedAt?: string;
  }>;
  settings: CalculationSettings;
}): Promise<void> {
  const { title, date, records, settings } = params;
  if (records.length === 0) return;

  const dpr = 2;
  const today = date || new Date().toISOString().slice(0, 10);

  if (records.length === 1) {
    const rec = records[0];
    const eff = getEffectiveAllocationForPerson(rec, settings);
    const width = 820;
    const height = 430;
    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء الصورة.');

    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, 96);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px Cairo, Tahoma, sans-serif';
    ctx.fillText(rec.name, width - 28, 44);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px Cairo, Tahoma, sans-serif';
    ctx.fillText(
      [rec.agencyName || title, rec.nationalId ? `بطاقة: ${rec.nationalId}` : '']
        .filter(Boolean)
        .join('  ·  '),
      width - 28,
      74
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px Cairo, Tahoma, sans-serif';
    ctx.fillText(`التاريخ: ${today}`, 28, 42);

    const rows: Array<[string, string]> = [
      [
        'عدد الأفراد',
        eff.summary.scope === 'partial'
          ? `${eff.eligibleIndividuals ?? 0} مستحق من أصل ${rec.individuals ?? 0}`
          : String(eff.eligibleIndividuals ?? 0),
      ],
      ['الحصة المقررة', eff.quotaText],
      ['المبلغ المطلوب', eff.priceText],
      ['الحالة', eff.summary.shortLabel],
      ['سبب الحظر / التقييد', rec.blockReason || 'لا يوجد'],
      ['الملاحظات', rec.notes || 'لا توجد ملاحظات'],
    ];

    rows.forEach(([label, val], idx) => {
      const y = 114 + idx * 48;
      ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(24, y, width - 48, 44);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(24, y, width - 48, 44);

      ctx.fillStyle = '#475569';
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px Cairo, Tahoma, sans-serif';
      ctx.fillText(label, width - 40, y + 27);

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px Cairo, Tahoma, sans-serif';
      const clipped = val.length > 52 ? val.slice(0, 50) + '…' : val;
      ctx.fillText(clipped, 40, y + 27);
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) throw new Error('تعذر توليد ملف الصورة.');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = rec.name.replace(/[<>:"/\\|?*]/g, '').trim() || 'بطاقة';
    a.href = url;
    a.download = `${safe}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  // Multi-selection table PNG export reuses clean ReadyList renderer layout
  const width = 1120;
  const rowHeight = 42;
  const headerHeight = 120;
  const tableHeadHeight = 44;
  const footerHeight = 58;
  const height =
    headerHeight + tableHeadHeight + records.length * rowHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر إنشاء الصورة.');

  ctx.scale(dpr, dpr);
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, 100);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px Cairo, Tahoma, sans-serif';
  ctx.fillText(title, width - 28, 42);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 14px Cairo, Tahoma, sans-serif';
  ctx.fillText(`كشف أسماء محددين (${records.length})`, width - 28, 72);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px Cairo, Tahoma, sans-serif';
  ctx.fillText(`التاريخ: ${today}`, 28, 42);

  const cols = [
    { label: '#', x: width - 32, w: 48, align: 'center' as const },
    { label: 'الاسم', x: width - 88, w: 300, align: 'right' as const },
    { label: 'الأفراد', x: width - 400, w: 110, align: 'center' as const },
    { label: 'الحصة', x: width - 520, w: 170, align: 'center' as const },
    { label: 'المبلغ', x: width - 700, w: 140, align: 'center' as const },
    { label: 'الحالة', x: width - 850, w: 110, align: 'center' as const },
    { label: 'الملاحظات', x: width - 970, w: 120, align: 'right' as const },
  ];

  const tableTop = headerHeight;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, tableTop, width - 48, tableHeadHeight);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(24, tableTop, width - 48, tableHeadHeight);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Cairo, Tahoma, sans-serif';
  for (const col of cols) {
    ctx.textAlign = col.align;
    const tx = col.align === 'center' ? col.x - col.w / 2 : col.x - 6;
    ctx.fillText(col.label, tx, tableTop + 27);
  }

  let totalInd = 0;
  let totalKg = 0;
  let totalIqd = 0;

  records.forEach((rec, idx) => {
    const y = tableTop + tableHeadHeight + idx * rowHeight;
    const eff = getEffectiveAllocationForPerson(rec, settings);
    const elig = eff.eligibleIndividuals ?? 0;
    totalInd += elig;
    totalKg += elig * settings.kgPerIndividual;
    totalIqd += eff.priceIqd ?? 0;

    ctx.fillStyle = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(24, y, width - 48, rowHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(24, y, width - 48, rowHeight);

    const vals = [
      String(idx + 1),
      rec.name,
      eff.summary.scope === 'partial'
        ? `${elig} من ${rec.individuals ?? 0}`
        : String(elig),
      eff.quotaText,
      eff.priceText,
      eff.summary.shortLabel,
      rec.notes || '—',
    ];

    ctx.font = '600 13px Cairo, Tahoma, sans-serif';
    cols.forEach((col, cIdx) => {
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = col.align;
      const tx = col.align === 'center' ? col.x - col.w / 2 : col.x - 6;
      const txt = vals[cIdx].length > 34 ? vals[cIdx].slice(0, 32) + '…' : vals[cIdx];
      ctx.fillText(txt, tx, y + 26);
    });
  });

  const footerY = tableTop + tableHeadHeight + records.length * rowHeight + 12;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px Cairo, Tahoma, sans-serif';
  ctx.fillText(
    `الإجمالي: ${records.length} سجل  |  ${totalInd} أفراد  |  ${formatTotalQuota(totalKg, settings)}  |  ${formatIqd(totalIqd)}`,
    width - 32,
    footerY + 24
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('تعذر توليد ملف الصورة.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = title.replace(/[<>:"/\\|?*]/g, '').trim() || 'المحددين';
  a.href = url;
  a.download = `${safe}_${records.length}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
