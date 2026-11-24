import * as XLSX from 'xlsx';
import type {
  Agency,
  AgencyExpense,
  AppThemeId,
  CalculationSettings,
  Person,
  ReadyList,
  ReadyListItem,
} from '../types/agency.ts';
import type { AssistantUserPref } from '../types/assistant.ts';
import {
  computeAgencyMetrics,
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
  initialLetter,
} from './agencyLogic.ts';
import {
  escapeHtml,
  getExportMemoryFlags,
  normalizeExportFilename,
  resolveThemePrintPalette,
  sanitizeExcelCellText,
} from './exportFormatting.ts';

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
    : item.blockType ??
      (item.status === 'محجوب'
        ? 'full'
        : item.status === 'مؤرشف'
        ? 'archived'
        : 'none');
  const blockedIndividuals = linked
    ? linked.blockedIndividuals
    : item.blockedIndividuals ??
      (item.status === 'محجوب' ? item.individuals ?? 0 : 0);
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

/**
 * Builds an RTL-configured SheetJS worksheet from header banner + structured rows
 * with explicit column widths and UTF-8 / formula-injection protection.
 */
export function buildRtlArabicWorksheet(params: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  columnWidths?: number[];
}): XLSX.WorkSheet {
  const { title, subtitle, headers, rows, columnWidths } = params;
  const dateLabel = new Date().toLocaleDateString('ar-IQ');

  const safeRows = rows.map((row) =>
    row.map((cell) => {
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        return cell;
      }
      if (cell === null || cell === undefined) return '';
      return sanitizeExcelCellText(cell);
    })
  );

  const aoa: Array<Array<string | number>> = [
    [sanitizeExcelCellText(`Morrow — ${title}`)],
    [
      sanitizeExcelCellText(
        subtitle
          ? `${subtitle} | تاريخ التصدير: ${dateLabel}`
          : `تاريخ التصدير: ${dateLabel}`
      ),
    ],
    [],
    headers.map((h) => sanitizeExcelCellText(h)),
    ...safeRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!views'] = [{ rightToLeft: true }];

  if (headers.length > 1) {
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];
  }

  ws['!cols'] = headers.map((h, idx) => {
    const customW = columnWidths?.[idx];
    if (customW) return { wch: customW };
    const maxDataLen = safeRows.reduce((max, r) => {
      const len = String(r[idx] ?? '').length;
      return Math.max(max, len);
    }, h.length);
    return { wch: Math.min(42, Math.max(10, maxDataLen + 4)) };
  });

  return ws;
}

export function createRtlWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

export function exportRosterToExcel(params: {
  filename: string;
  persons: ReadonlyArray<Person>;
  agencies: ReadonlyArray<Agency>;
  settings: Readonly<CalculationSettings>;
  preferences?: ReadonlyArray<AssistantUserPref>;
  hideStatusColumn?: boolean;
  hideAmountColumn?: boolean;
  sheetName?: string;
}) {
  const {
    filename,
    persons,
    agencies,
    settings,
    preferences,
    hideStatusColumn,
    hideAmountColumn,
    sheetName = 'سجل المستفيدين',
  } = params;

  const memFlags = getExportMemoryFlags(preferences);
  const hideAmount = Boolean(hideAmountColumn || memFlags.hideAmountColumn);
  const hideStatus = Boolean(hideStatusColumn || memFlags.hideStatusColumn);
  const hideNotes = memFlags.hideNotesColumn;

  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));

  const headers: string[] = [
    '#',
    'الحرف',
    'الاسم',
    'الوكالة',
    'الأفراد المستحقون',
    'الحصة',
    ...(hideAmount ? [] : ['المبلغ (د.ع)']),
    ...(hideStatus ? [] : ['الحالة']),
    ...(hideNotes ? [] : ['الملاحظات']),
  ];

  const rows = persons.map((person, idx) => {
    const eff = getEffectiveAllocationForPerson(person, settings);
    const indCell =
      eff.summary.scope === 'partial'
        ? `${eff.eligibleIndividuals} من ${person.individuals ?? 0}`
        : eff.summary.scope === 'full'
        ? 0
        : person.individuals ?? 0;

    return [
      idx + 1,
      initialLetter(person.name),
      person.name,
      agencyMap.get(person.agencyId) || '',
      indCell,
      eff.quotaText,
      ...(hideAmount ? [] : [eff.priceIqd ?? 0]),
      ...(hideStatus ? [] : [eff.summary.shortLabel]),
      ...(hideNotes ? [] : [person.notes || '']),
    ];
  });

  const ws = buildRtlArabicWorksheet({
    title: filename.replace(/\.xlsx$/i, ''),
    subtitle:
      memFlags.activeRuleLabels.length > 0
        ? `مُصدّر حسب قواعد الذاكرة (${memFlags.activeRuleLabels.join(' · ')})`
        : 'كشف السجلات والحصص المعتمد',
    headers,
    rows,
  });

  const wb = createRtlWorkbook();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, normalizeExportFilename(filename, '.xlsx'), {
    bookType: 'xlsx',
    compression: true,
  });
}

export function exportFinancialReportToExcel(params: {
  agencyName: string;
  persons: ReadonlyArray<Person>;
  expenses: ReadonlyArray<AgencyExpense>;
  settings: Readonly<CalculationSettings>;
  preferences?: ReadonlyArray<AssistantUserPref>;
}) {
  const { agencyName, persons, expenses, settings, preferences } = params;
  const memFlags = getExportMemoryFlags(preferences);
  const hideAmount = memFlags.hideAmountColumn;
  const m = computeAgencyMetrics([...persons], [...expenses], settings);

  const summaryRows: Array<[string, string | number]> = [
    ['الوكالة', agencyName],
    ['تاريخ التقرير', new Date().toLocaleDateString('ar-IQ')],
    ['العائلات النشطة', m.activeHouseholds],
    ['عدد الأفراد', m.activeIndividuals],
    ['عدد الأكياس الكاملة', m.fullBags],
    ['إجمالي الحصة', formatTotalQuota(m.totalKg, settings)],
    ...(hideAmount
      ? []
      : ([
          ['الإيرادات', formatIqd(m.revenue)],
          ['أجور العمال', formatIqd(m.workerWages)],
          ['الصرفيات', formatIqd(m.generalExpenses)],
          ['صافي الأرباح', formatIqd(m.profit)],
        ] as Array<[string, string | number]>)),
  ];

  const wb = createRtlWorkbook();
  const wsSummary = buildRtlArabicWorksheet({
    title: `التقرير المالي — ${agencyName}`,
    headers: ['البند', 'القيمة'],
    rows: summaryRows,
    columnWidths: [28, 30],
  });
  XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص المالي');

  if (expenses.length > 0 && !hideAmount) {
    const expRows = expenses.map((e, idx) => [
      idx + 1,
      e.occurredAt,
      e.category === 'worker_wages'
        ? 'أجور العمال'
        : e.category === 'packaging'
          ? 'مستلزمات التعبئة'
          : e.category === 'hospitality'
            ? 'ضيافة وطعام'
            : e.category === 'custom'
              ? e.customCategoryLabel?.trim() || 'مصروفات خاصة'
              : 'صرفيات عامة',
      e.description,
      e.amountIqd,
    ]);
    const wsExp = buildRtlArabicWorksheet({
      title: `سجل المصاريف — ${agencyName}`,
      headers: ['#', 'التاريخ', 'التصنيف', 'البيان', 'المبلغ (د.ع)'],
      rows: expRows,
    });
    XLSX.utils.book_append_sheet(wb, wsExp, 'سجل المصاريف');
  }

  XLSX.writeFile(
    wb,
    normalizeExportFilename(`التقرير_المالي_${agencyName}`, '.xlsx'),
    { bookType: 'xlsx', compression: true }
  );
}

export function exportReadyListToExcel(params: {
  list: ReadyList;
  items: ReadyListItem[];
  persons: Person[];
  settings: CalculationSettings;
  preferences?: ReadonlyArray<AssistantUserPref>;
}) {
  const { list, items, persons, settings, preferences } = params;
  const memFlags = getExportMemoryFlags(preferences);
  const hideAmount = memFlags.hideAmountColumn;
  const hideStatus = memFlags.hideStatusColumn;
  const hideNotes = memFlags.hideNotesColumn;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const headers: string[] = [
    'التسلسل',
    'الحرف',
    'الاسم',
    'الأفراد',
    'الحصة',
    ...(hideAmount ? [] : ['المبلغ (د.ع)']),
    ...(hideStatus ? [] : ['الحالة']),
    ...(hideNotes ? [] : ['الملاحظات']),
  ];

  const rows = items.map((item, idx) => {
    const rec = resolveReadyListItemRecord(item, personMap);
    const eff = getEffectiveAllocationForPerson(rec, settings);
    const indCell =
      eff.summary.scope === 'partial'
        ? `${eff.eligibleIndividuals} من ${rec.individuals ?? 0}`
        : eff.eligibleIndividuals ?? 0;

    return [
      idx + 1,
      initialLetter(rec.name),
      rec.name,
      indCell,
      eff.quotaText,
      ...(hideAmount ? [] : [eff.priceIqd ?? 0]),
      ...(hideStatus ? [] : [eff.summary.shortLabel]),
      ...(hideNotes ? [] : [rec.notes || '']),
    ];
  });

  const ws = buildRtlArabicWorksheet({
    title: list.name,
    subtitle: [list.subtitle1, list.subtitle2, list.listDate]
      .filter(Boolean)
      .join(' · '),
    headers,
    rows,
  });

  const wb = createRtlWorkbook();
  XLSX.utils.book_append_sheet(wb, ws, 'القائمة الجاهزة');
  XLSX.writeFile(wb, normalizeExportFilename(list.name, '.xlsx'), {
    bookType: 'xlsx',
    compression: true,
  });
}

export function buildReadyListShareText(params: {
  list: ReadyList;
  items: ReadyListItem[];
  persons: Person[];
  settings: CalculationSettings;
  preferences?: ReadonlyArray<AssistantUserPref>;
}): string {
  const { list, items, persons, settings, preferences } = params;
  const memFlags = getExportMemoryFlags(preferences);
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
    const notePart = !memFlags.hideNotesColumn && rec.notes ? ` (${rec.notes})` : '';
    const pricePart = memFlags.hideAmountColumn ? '' : ` — ${eff.priceText}`;
    const statusPart = memFlags.hideStatusColumn ? '' : ` [${eff.summary.shortLabel}]`;
    return `${idx + 1}. ${rec.name} — ${elig} أفراد — ${eff.quotaText}${pricePart}${statusPart}${notePart}`;
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
    `الإجمالي: ${items.length} عائلة | ${totalInd} أفراد | ${formatTotalQuota(
      totalKg,
      settings
    )}${memFlags.hideAmountColumn ? '' : ` | ${formatIqd(totalIqd)}`}`,
  ];

  return [...headerLines, ...lines, ...footerLines].join('\n');
}

export function exportReadyListToTextFile(params: {
  list: ReadyList;
  items: ReadyListItem[];
  persons: Person[];
  settings: CalculationSettings;
  preferences?: ReadonlyArray<AssistantUserPref>;
}) {
  const text = buildReadyListShareText(params);
  const blob = new Blob(['\uFEFF' + text], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = normalizeExportFilename(params.list.name, '.txt');
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Generates an official, UTF-8 Arabic RTL PDF print HTML document with embedded
 * Cairo + Amiri typography, active Theme colors, escaped fields, and Memory column hiding.
 */
export function buildFormattedRosterPdfHtml(params: {
  title: string;
  subtitle?: string;
  metaLine?: string;
  topCustomTitle?: string;
  align?: 'right' | 'center' | 'left';
  persons: ReadonlyArray<Person>;
  agencies: ReadonlyArray<Agency>;
  settings: Readonly<CalculationSettings>;
  preferences?: ReadonlyArray<AssistantUserPref>;
  hideAgencyColumn?: boolean;
  hideAmountColumn?: boolean;
  hideStatusColumn?: boolean;
  themeId?: AppThemeId;
  sandboxNotice?: string;
}): string {
  const {
    title,
    subtitle,
    metaLine,
    topCustomTitle,
    align = 'right',
    persons,
    agencies,
    settings,
    preferences,
    hideAgencyColumn = false,
    hideAmountColumn,
    hideStatusColumn,
    themeId,
    sandboxNotice,
  } = params;

  const memFlags = getExportMemoryFlags(preferences);
  const hideAmount = Boolean(hideAmountColumn || memFlags.hideAmountColumn);
  const hideStatus = Boolean(hideStatusColumn || memFlags.hideStatusColumn);
  const hideNotes = memFlags.hideNotesColumn;
  const palette = resolveThemePrintPalette(themeId);
  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));

  let totalInd = 0;
  let totalKg = 0;
  let totalIqd = 0;

  const rowsHtml = persons
    .map((p, idx) => {
      const eff = getEffectiveAllocationForPerson(p, settings);
      const elig = eff.eligibleIndividuals ?? 0;
      totalInd += elig;
      totalKg += elig * settings.kgPerIndividual;
      totalIqd += eff.priceIqd ?? 0;

      const indLabel =
        eff.summary.scope === 'partial'
          ? `${eff.eligibleIndividuals} من ${p.individuals ?? 0}`
          : String(eff.eligibleIndividuals ?? 0);

      return `<tr>
        <td class="num">${idx + 1}</td>
        <td>${escapeHtml(initialLetter(p.name))}</td>
        <td style="text-align:right;font-weight:700">${escapeHtml(p.name)}</td>
        ${hideAgencyColumn ? '' : `<td>${escapeHtml(agencyMap.get(p.agencyId) || '')}</td>`}
        <td class="num">${escapeHtml(indLabel)}</td>
        <td class="num">${escapeHtml(eff.quotaText)}</td>
        ${hideAmount ? '' : `<td class="num">${escapeHtml(eff.priceText)}</td>`}
        ${hideStatus ? '' : `<td>${escapeHtml(eff.summary.shortLabel)}</td>`}
        ${hideNotes ? '' : `<td style="text-align:right">${escapeHtml(p.notes || '')}</td>`}
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Amiri', Tahoma, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 16px;
      direction: rtl;
      background: #ffffff;
    }
    .sheet-head {
      background: ${palette.headerBg};
      color: ${palette.headerText};
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 12px;
      text-align: ${align};
      border-bottom: 4px solid ${palette.accent};
    }
    .sheet-brand {
      font-size: 11px;
      font-weight: 700;
      opacity: 0.85;
      margin-bottom: 4px;
    }
    .sheet-head h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      line-height: 1.4;
    }
    .sheet-sub {
      margin-top: 4px;
      font-size: 12px;
      opacity: 0.9;
    }
    .meta-strip {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      background: ${palette.tableHeadBg};
      border: 1px solid ${palette.border};
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 11.5px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    th, td {
      border: 1px solid ${palette.border};
      padding: 6px 8px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background: ${palette.tableHeadBg};
      color: #0f172a;
      font-weight: 800;
    }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .num {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .sheet-foot {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid ${palette.border};
      background: #f8fafc;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
    }
  </style>
</head>
<body>
  <div class="sheet-head">
    ${topCustomTitle ? `<div class="sheet-brand">${escapeHtml(topCustomTitle)}</div>` : '<div class="sheet-brand">تقرير Morrow الرسمي</div>'}
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<div class="sheet-sub">${escapeHtml(subtitle)}</div>` : ''}
  </div>
  <div class="meta-strip">
    <span>${escapeHtml(metaLine || `التاريخ: ${new Date().toLocaleDateString('ar-IQ')}`)}</span>
    ${sandboxNotice ? `<span>${escapeHtml(sandboxNotice)}</span>` : ''}
    ${memFlags.activeRuleLabels.length > 0 ? `<span>قواعد الذاكرة المطبّقة: ${escapeHtml(memFlags.activeRuleLabels.join(' · '))}</span>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>الحرف</th>
        <th>الاسم</th>
        ${hideAgencyColumn ? '' : '<th>الوكالة</th>'}
        <th>الأفراد</th>
        <th>الحصة</th>
        ${hideAmount ? '' : '<th>المبلغ</th>'}
        ${hideStatus ? '' : '<th>الحالة</th>'}
        ${hideNotes ? '' : '<th>الملاحظات</th>'}
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="sheet-foot">
    <span>إجمالي السجلات: ${persons.length}</span>
    <span>الأفراد المستحقون: ${totalInd}</span>
    <span>إجمالي الحصة: ${escapeHtml(formatTotalQuota(totalKg, settings))}</span>
    ${hideAmount ? '' : `<span>إجمالي المبلغ: ${escapeHtml(formatIqd(totalIqd))}</span>`}
  </div>
</body>
</html>`;
}

export function exportFormattedRosterToPdf(params: Parameters<typeof buildFormattedRosterPdfHtml>[0]): void {
  const html = buildFormattedRosterPdfHtml(params);
  printViaIframe(html);
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

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

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

  const cols = [
    { label: '#', x: width - 32, w: 48, align: 'center' as const },
    { label: 'الاسم', x: width - 88, w: 280, align: 'right' as const },
    { label: 'الأفراد', x: width - 380, w: 110, align: 'center' as const },
    { label: 'الحصة', x: width - 500, w: 170, align: 'center' as const },
    { label: 'المبلغ', x: width - 680, w: 140, align: 'center' as const },
    { label: 'الحالة', x: width - 830, w: 110, align: 'center' as const },
    { label: 'الملاحظات', x: width - 950, w: 140, align: 'right' as const },
  ];

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
    ctx.fillText(
      'لا توجد أسماء في هذه القائمة',
      width / 2,
      tableTop + tableHeadHeight + 26
    );
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
        const text =
          vals[cIdx].length > 34 ? vals[cIdx].slice(0, 32) + '…' : vals[cIdx];
        ctx.fillText(text, tx, y + 26);
      });
    });
  }

  const footerY =
    tableTop + tableHeadHeight + Math.max(1, items.length) * rowHeight + 12;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px Cairo, Tahoma, sans-serif';
  ctx.fillText(
    `الإجمالي: ${items.length} عائلة  |  ${totalInd} أفراد  |  ${formatTotalQuota(
      totalKg,
      settings
    )}  |  ${formatIqd(totalIqd)}`,
    width - 32,
    footerY + 26
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('تعذر توليد ملف الصورة.');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = normalizeExportFilename(list.name, '.png');
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
  }, 300);
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
    a.href = url;
    a.download = normalizeExportFilename(rec.name, '.png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

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
      const txt =
        vals[cIdx].length > 34 ? vals[cIdx].slice(0, 32) + '…' : vals[cIdx];
      ctx.fillText(txt, tx, y + 26);
    });
  });

  const footerY =
    tableTop + tableHeadHeight + records.length * rowHeight + 12;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px Cairo, Tahoma, sans-serif';
  ctx.fillText(
    `الإجمالي: ${records.length} سجل  |  ${totalInd} أفراد  |  ${formatTotalQuota(
      totalKg,
      settings
    )}  |  ${formatIqd(totalIqd)}`,
    width - 32,
    footerY + 24
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('تعذر توليد ملف الصورة.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = normalizeExportFilename(`${title}_${records.length}`, '.png');
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
