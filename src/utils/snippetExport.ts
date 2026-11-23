import type {
  CalculationSettings,
  FreeformHeaderConfig,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
} from '../types/agency';
import {
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
} from './agencyLogic';
import {
  buildSnippetCardDetails,
  formatPeriodDateYMD,
  resolvePeriodMeta,
  type SnippetRecordInput,
} from './archiveLogic';
import { printViaIframe } from './excelExport';
import { escapeHtml, getExportMemoryFlags } from './exportFormatting';

function sanitizeFilePart(raw: string, fallback: string): string {
  return (
    raw
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .trim() || fallback
  );
}

export async function generateSmartSnippetBlob(params: {
  tableTitle: string;
  tableSubtitle?: string;
  periodMeta?: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
  records: SnippetRecordInput[];
  settings: CalculationSettings;
}): Promise<{ blob: Blob; filename: string; dataUrl: string }> {
  const {
    tableTitle,
    tableSubtitle,
    periodMeta,
    freeformHeader,
    records,
    settings,
  } = params;

  const resolvedPeriod = resolvePeriodMeta(periodMeta);
  const topTitle = freeformHeader?.topCustomTitle?.trim();
  const freeSubtitles = (freeformHeader?.freeSubtitles || []).filter((s) =>
    s.trim()
  );

  const width = 1160;
  const topBannerH =
    96 +
    (topTitle ? 30 : 0) +
    (freeSubtitles.length > 0 ? 24 : 0) +
    (tableSubtitle ? 22 : 0);
  const periodStripH = 44;
  const tableHeadH = 44;
  const isSingle = records.length === 1;
  const rowsBodyH = isSingle ? 250 : Math.max(1, records.length) * 46;
  const footerH = 56;
  const paddingGap = 24;
  const height =
    topBannerH + periodStripH + tableHeadH + rowsBodyH + footerH + paddingGap;

  const dpr = 2.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر توليد القصاصة المصورة في المتصفح.');
  }

  ctx.scale(dpr, dpr);
  ctx.direction = 'rtl';

  // Paper backdrop
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Outer cropped frame border
  ctx.strokeStyle = freeformHeader?.borderColor || '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Top Masthead
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(10, 10, width - 20, topBannerH - 10);

  const align = freeformHeader?.align || 'right';
  ctx.textAlign =
    align === 'center' ? 'center' : align === 'left' ? 'left' : 'right';
  const anchorX =
    align === 'center' ? width / 2 : align === 'left' ? 36 : width - 36;

  let cursorY = 40;
  if (topTitle) {
    ctx.fillStyle = freeformHeader?.customColor || '#38bdf8';
    ctx.font = 'bold 16px Cairo, Tahoma, sans-serif';
    ctx.fillText(topTitle, anchorX, cursorY);
    cursorY += 30;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Cairo, Tahoma, sans-serif';
  ctx.fillText(tableTitle || 'سجل Morrow الرسمي', anchorX, cursorY);
  cursorY += 26;

  if (tableSubtitle) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 14px Cairo, Tahoma, sans-serif';
    ctx.fillText(tableSubtitle, anchorX, cursorY);
    cursorY += 22;
  }

  if (freeSubtitles.length > 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px Cairo, Tahoma, sans-serif';
    ctx.fillText(freeSubtitles.join('  ·  '), anchorX, cursorY);
  }

  // Period & Quota Bar
  const stripY = topBannerH;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(10, stripY, width - 20, periodStripH);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, stripY + periodStripH);
  ctx.lineTo(width - 10, stripY + periodStripH);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px Cairo, Tahoma, sans-serif';
  const periodSummary = `التاريخ: ${formatPeriodDateYMD(
    resolvedPeriod.fullDate
  )}   |   ${resolvedPeriod.monthName} (شهر ${
    resolvedPeriod.monthNumber
  })   |   ${resolvedPeriod.quotaName} — رقم الحصة: ${
    resolvedPeriod.quotaNumber
  }   |   تاريخ الحصة: ${formatPeriodDateYMD(resolvedPeriod.quotaDate)}`;
  ctx.fillText(periodSummary, width - 32, stripY + 27);

  // Table Header Slice
  const tableTop = stripY + periodStripH + 10;
  const cols = [
    { label: '#', x: width - 28, w: 40, align: 'center' as const },
    { label: 'الاسم الكامل', x: width - 74, w: 230, align: 'right' as const },
    { label: 'الأفراد', x: width - 314, w: 85, align: 'center' as const },
    { label: 'النزول/النقصان', x: width - 404, w: 96, align: 'center' as const },
    { label: 'الإضافة/الحذف', x: width - 506, w: 110, align: 'center' as const },
    { label: 'الحصة', x: width - 622, w: 130, align: 'center' as const },
    { label: 'المبلغ', x: width - 758, w: 110, align: 'center' as const },
    { label: 'الحالة', x: width - 874, w: 96, align: 'center' as const },
    { label: 'الملاحظات', x: width - 976, w: 166, align: 'right' as const },
  ];

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(20, tableTop, width - 40, tableHeadH);
  ctx.strokeStyle = '#94a3b8';
  ctx.strokeRect(20, tableTop, width - 40, tableHeadH);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Cairo, Tahoma, sans-serif';
  for (const col of cols) {
    ctx.textAlign = col.align;
    const tx = col.align === 'center' ? col.x - col.w / 2 : col.x - 6;
    ctx.fillText(col.label, tx, tableTop + 27);
  }

  let totalInd = 0;
  let totalKg = 0;
  let totalIqd = 0;

  if (isSingle) {
    const rec = records[0];
    const details = buildSnippetCardDetails({
      record: rec,
      fallbackTitle: tableTitle,
      periodMeta: resolvedPeriod,
      settings,
    });
    const eff = getEffectiveAllocationForPerson(rec, settings);
    totalInd = eff.eligibleIndividuals ?? 0;
    totalKg = totalInd * settings.kgPerIndividual;
    totalIqd = eff.priceIqd ?? 0;

    // Official single clipped row directly under header
    const rowY = tableTop + tableHeadH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20, rowY, width - 40, 48);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(20, rowY, width - 40, 48);

    const rowVals = [
      '1',
      details.name,
      details.individualsLabel,
      details.decreaseLabel,
      details.addOrDeleteLabel,
      details.quotaLabel,
      details.priceLabel,
      details.statusLabel,
      details.notesLabel,
    ];

    ctx.font = 'bold 13px Cairo, Tahoma, sans-serif';
    cols.forEach((col, cIdx) => {
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = col.align;
      const tx = col.align === 'center' ? col.x - col.w / 2 : col.x - 6;
      const txt =
        rowVals[cIdx].length > 28
          ? `${rowVals[cIdx].slice(0, 26)}…`
          : rowVals[cIdx];
      ctx.fillText(txt, tx, rowY + 29);
    });

    // Detailed structured audit breakdown box for single beneficiary
    const cardY = rowY + 62;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(20, cardY, width - 40, 174);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(20, cardY, width - 40, 174);

    const pairs: Array<[string, string]> = [
      ['الوكالة / القائمة', details.agencyName],
      ['رقم البطاقة التموينية', details.nationalId],
      ['اسم المستفيد', details.name],
      ['عدد الأفراد', details.individualsLabel],
      ['النزول / النقصان', details.decreaseLabel],
      ['الإضافة / الحذف', details.addOrDeleteLabel],
      ['الحصة المقررة والمبلغ', `${details.quotaLabel}  ·  ${details.priceLabel}`],
      ['الملاحظات والتدقيق', details.notesLabel],
    ];

    pairs.forEach(([k, v], idx) => {
      const colIdx = idx % 2;
      const rIdx = Math.floor(idx / 2);
      const cellW = (width - 64) / 2;
      const xStart = colIdx === 0 ? width - 32 : width - 32 - cellW - 12;
      const yCell = cardY + 18 + rIdx * 38;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px Cairo, Tahoma, sans-serif';
      ctx.fillText(`${k}:`, xStart, yCell + 10);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px Cairo, Tahoma, sans-serif';
      const valClip = v.length > 42 ? `${v.slice(0, 40)}…` : v;
      ctx.fillText(valClip, xStart - 145, yCell + 10);
    });
  } else {
    records.forEach((rec, idx) => {
      const y = tableTop + tableHeadH + idx * 46;
      const details = buildSnippetCardDetails({
        record: rec,
        fallbackTitle: tableTitle,
        periodMeta: resolvedPeriod,
        settings,
      });
      const eff = getEffectiveAllocationForPerson(rec, settings);
      const elig = eff.eligibleIndividuals ?? 0;
      totalInd += elig;
      totalKg += elig * settings.kgPerIndividual;
      totalIqd += eff.priceIqd ?? 0;

      ctx.fillStyle = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(20, y, width - 40, 46);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(20, y, width - 40, 46);

      const vals = [
        String(idx + 1),
        details.name,
        details.individualsLabel,
        details.decreaseLabel,
        details.addOrDeleteLabel,
        details.quotaLabel,
        details.priceLabel,
        details.statusLabel,
        details.notesLabel,
      ];

      ctx.font = '600 13px Cairo, Tahoma, sans-serif';
      cols.forEach((col, cIdx) => {
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = col.align;
        const tx = col.align === 'center' ? col.x - col.w / 2 : col.x - 6;
        const txt =
          vals[cIdx].length > 28 ? `${vals[cIdx].slice(0, 26)}…` : vals[cIdx];
        ctx.fillText(txt, tx, y + 28);
      });
    });
  }

  // Footer Audit Strip
  const footerY = tableTop + tableHeadH + rowsBodyH + 10;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px Cairo, Tahoma, sans-serif';
  ctx.fillText(
    `قصاصة رسمية للتدقيق — Morrow  |  السجلات: ${records.length}  |  الأفراد: ${totalInd}  |  ${formatTotalQuota(
      totalKg,
      settings
    )}  |  ${formatIqd(totalIqd)}`,
    width - 28,
    footerY + 24
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) {
    throw new Error('تعذر حفظ القصاصة كصورة.');
  }
  const dataUrl = canvas.toDataURL('image/png');
  const filename = isSingle
    ? `قصاصة_${sanitizeFilePart(records[0].name, 'مستفيد')}.png`
    : `قصاصة_${sanitizeFilePart(tableTitle, 'جدول')}_${records.length}.png`;

  return { blob, filename, dataUrl };
}

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printSmartSnippetPdf(params: {
  tableTitle: string;
  tableSubtitle?: string;
  periodMeta?: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
  records: SnippetRecordInput[];
  settings: CalculationSettings;
}): void {
  const {
    tableTitle,
    tableSubtitle,
    periodMeta,
    freeformHeader,
    records,
    settings,
  } = params;
  const p = resolvePeriodMeta(periodMeta);
  const topTitle = freeformHeader?.topCustomTitle?.trim();
  const freeSubs = (freeformHeader?.freeSubtitles || []).filter((s) =>
    s.trim()
  );

  const memFlags = getExportMemoryFlags();
  const hideAmount = memFlags.hideAmountColumn;
  const hideStatus = memFlags.hideStatusColumn;
  const hideNotes = memFlags.hideNotesColumn;

  let totalInd = 0;
  let totalKg = 0;
  let totalIqd = 0;

  const rowsHtml = records
    .map((rec, idx) => {
      const d = buildSnippetCardDetails({
        record: rec,
        fallbackTitle: tableTitle,
        periodMeta: p,
        settings,
      });
      const eff = getEffectiveAllocationForPerson(rec, settings);
      const elig = eff.eligibleIndividuals ?? 0;
      totalInd += elig;
      totalKg += elig * settings.kgPerIndividual;
      totalIqd += eff.priceIqd ?? 0;
      return `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:right;font-weight:bold">${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.individualsLabel)}</td>
        <td>${escapeHtml(d.decreaseLabel)}</td>
        <td>${escapeHtml(d.addOrDeleteLabel)}</td>
        <td>${escapeHtml(d.quotaLabel)}</td>
        ${hideAmount ? '' : `<td>${escapeHtml(d.priceLabel)}</td>`}
        ${hideStatus ? '' : `<td>${escapeHtml(d.statusLabel)}</td>`}
        ${hideNotes ? '' : `<td style="text-align:right">${escapeHtml(d.notesLabel)}</td>`}
      </tr>`;
    })
    .join('');

  printViaIframe(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>قصاصة — ${escapeHtml(tableTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Cairo', 'Amiri', Tahoma, Arial, sans-serif; padding: 20px; color: #0f172a; direction: rtl; }
  .snippet-box { border: 2px solid #0f172a; border-radius: 10px; overflow: hidden; }
  .masthead { background: #0f172a; color: #ffffff; padding: 14px 18px; text-align: ${
    freeformHeader?.align || 'right'
  }; }
  .masthead .top { color: #38bdf8; font-size: 13px; font-weight: bold; margin-bottom: 4px; }
  .masthead h1 { margin: 0; font-size: 20px; }
  .masthead .sub { color: #cbd5e1; font-size: 12px; margin-top: 4px; }
  .period-bar { background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 8px 18px; font-size: 12px; font-weight: bold; display: flex; flex-wrap: wrap; gap: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
  th { background: #e2e8f0; }
  .footer { background: #f8fafc; padding: 10px 18px; font-size: 12px; font-weight: bold; border-top: 1px solid #cbd5e1; }
</style>
</head>
<body>
  <div class="snippet-box">
    <div class="masthead">
      ${topTitle ? `<div class="top">${escapeHtml(topTitle)}</div>` : ''}
      <h1>${escapeHtml(tableTitle)}</h1>
      ${tableSubtitle ? `<div class="sub">${escapeHtml(tableSubtitle)}</div>` : ''}
      ${freeSubs.length > 0 ? `<div class="sub">${escapeHtml(freeSubs.join(' · '))}</div>` : ''}
    </div>
    <div class="period-bar">
      <span>التاريخ: ${escapeHtml(formatPeriodDateYMD(p.fullDate))}</span>
      <span>الشهر: ${escapeHtml(p.monthName)} (شهر ${p.monthNumber})</span>
      <span>الحصة: ${escapeHtml(p.quotaName)} (${escapeHtml(p.quotaNumber)})</span>
      <span>تاريخ الحصة: ${escapeHtml(formatPeriodDateYMD(p.quotaDate))}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th><th>الاسم</th><th>الأفراد</th><th>النزول/النقصان</th><th>الإضافة/الحذف</th><th>الحصة</th>${
            hideAmount ? '' : '<th>المبلغ</th>'
          }${hideStatus ? '' : '<th>الحالة</th>'}${hideNotes ? '' : '<th>الملاحظات</th>'}
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">قصاصة تدقيق — Morrow | السجلات: ${
      records.length
    } | الأفراد: ${totalInd} | ${escapeHtml(
      formatTotalQuota(totalKg, settings)
    )}${hideAmount ? '' : ` | ${escapeHtml(formatIqd(totalIqd))}`}</div>
  </div>
</body></html>`);
}

export function printArchiveRecordPdf(archive: MonthlyArchiveRecord): void {
  const p = resolvePeriodMeta(archive.periodMeta);
  const memFlags = getExportMemoryFlags();
  const hideAmount = memFlags.hideAmountColumn;
  const hideStatus = memFlags.hideStatusColumn;
  const hideNotes = memFlags.hideNotesColumn;
  const agencyMap = new Map(archive.agencies.map((a) => [a.id, a.name]));
  const rowsHtml = archive.persons
    .map((person, idx) => {
      const eff = getEffectiveAllocationForPerson(
        person,
        archive.calculationSettings
      );
      return `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:right;font-weight:bold">${escapeHtml(person.name)}</td>
        <td>${escapeHtml(agencyMap.get(person.agencyId) || '')}</td>
        <td>${
          eff.summary.scope === 'partial'
            ? `${eff.eligibleIndividuals} من ${person.individuals ?? 0}`
            : eff.eligibleIndividuals ?? 0
        }</td>
        <td>${person.decreaseCount ?? 0}</td>
        <td>${
          person.addOrDeleteAction && person.addOrDeleteAction !== 'لا يوجد'
            ? escapeHtml(`${person.addOrDeleteAction} (${person.addOrDeleteCount ?? 0})`)
            : '—'
        }</td>
        <td>${escapeHtml(eff.quotaText)}</td>
        ${hideAmount ? '' : `<td>${escapeHtml(eff.priceText)}</td>`}
        ${hideStatus ? '' : `<td>${escapeHtml(eff.summary.shortLabel)}</td>`}
        ${hideNotes ? '' : `<td style="text-align:right">${escapeHtml(person.notes || '')}</td>`}
      </tr>`;
    })
    .join('');

  printViaIframe(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>${escapeHtml(archive.label)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Cairo', 'Amiri', Tahoma, Arial, sans-serif; padding: 18px; color: #0f172a; direction: rtl; }
  .header { border: 2px solid #0f172a; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
  .header h1 { margin: 0 0 6px; font-size: 20px; }
  .meta { font-size: 12px; color: #334155; display: flex; flex-wrap: wrap; gap: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { border: 1px solid #94a3b8; padding: 6px; text-align: center; }
  th { background: #e2e8f0; }
  .footer { margin-top: 12px; font-size: 12px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    ${
      archive.freeformHeader?.topCustomTitle
        ? `<div style="font-size:12px;font-weight:bold;color:#1d4ed8">${escapeHtml(archive.freeformHeader.topCustomTitle)}</div>`
        : ''
    }
    <h1>${escapeHtml(archive.label)}</h1>
    <div class="meta">
      <span>التاريخ: ${escapeHtml(formatPeriodDateYMD(p.fullDate))}</span>
      <span>الشهر: ${escapeHtml(p.monthName)} (شهر ${p.monthNumber})</span>
      <span>الحصة: ${escapeHtml(p.quotaName)} (${escapeHtml(p.quotaNumber)})</span>
      <span>تاريخ الحصة: ${escapeHtml(formatPeriodDateYMD(p.quotaDate))}</span>
      <span>الحالة: ${archive.isClosed ? 'مؤرشف ومغلق' : 'نسخة مفتوحة'}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>الاسم</th><th>الوكالة</th><th>الأفراد</th><th>النزول</th><th>إضافة/حذف</th><th>الحصة</th>${
        hideAmount ? '' : '<th>المبلغ</th>'
      }${hideStatus ? '' : '<th>الحالة</th>'}${hideNotes ? '' : '<th>الملاحظات</th>'}</tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">الإجمالي المؤرشف: ${
    archive.summary.totalHouseholds
  } عائلة | ${archive.summary.totalIndividuals} أفراد | ${escapeHtml(
    formatTotalQuota(archive.summary.totalKg, archive.calculationSettings)
  )}${hideAmount ? '' : ` | الإيرادات: ${escapeHtml(formatIqd(archive.summary.totalRevenueIqd))}`}</div>
</body></html>`);
}

export function exportArchiveToCloudJson(archive: MonthlyArchiveRecord): void {
  const payload = {
    app: 'Morrow — أرشيف السجلات الشهرية',
    exportedAt: new Date().toISOString(),
    archive,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  downloadBlobFile(
    blob,
    `morrow_archive_${archive.periodMeta.year}_${String(
      archive.periodMeta.monthNumber
    ).padStart(2, '0')}_q${sanitizeFilePart(
      archive.periodMeta.quotaNumber,
      '1'
    )}.json`
  );
}
