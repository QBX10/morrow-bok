import * as XLSX from 'xlsx';
import type { AppDatabaseState, AuthUser, WorkspaceNoteCategory } from '../types/agency.ts';
import { getEffectiveAllocationForPerson, initialLetter } from './agencyLogic.ts';
import { buildRtlArabicWorksheet, createRtlWorkbook } from './excelExport.ts';
import { buildZipArchive, type ZipEntryInput } from './zipBuilder.ts';

export interface StructuredExportSummary {
  rootFolder: string;
  zipFilename: string;
  fileCount: number;
  uncompressedBytes: number;
  compressedBytes: number;
  crc32Hex: string;
  foldersSummary: Array<{ folder: string; itemsCount: number }>;
  blob: Blob;
}

const CATEGORY_LABELS: Record<WorkspaceNoteCategory, string> = {
  quick: 'ملاحظات سريعة',
  idea: 'أفكار تطويرية',
  suggestion: 'اقتراحات',
  info: 'معلومات عامة',
};

function sanitizePathSegment(raw: string): string {
  return (raw || 'عنصر')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 48);
}

function csvEscape(val: string | number | null | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildUtf8Csv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const bom = '\uFEFF';
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];
  return bom + lines.join('\r\n');
}

function workbookToUint8Array(wb: XLSX.WorkBook): Uint8Array {
  const arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer | Uint8Array;
  return arr instanceof Uint8Array ? arr : new Uint8Array(arr);
}

function decodeDataUrlToBytes(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  try {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl.trim());
    if (!match) return null;
    const mime = match[1].toLowerCase();
    const ext = mime.includes('png')
      ? 'png'
      : mime.includes('webp')
      ? 'webp'
      : mime.includes('svg')
      ? 'svg'
      : 'jpg';
    const base64 = match[2];
    const bin =
      typeof atob !== 'undefined'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return { bytes, ext };
  } catch {
    return null;
  }
}

export async function generateStructuredWorkspaceZip(params: {
  state: AppDatabaseState;
  authUser?: AuthUser | null;
  appName?: string;
}): Promise<StructuredExportSummary> {
  const { state, authUser, appName = 'Morrow' } = params;
  const dateStamp = new Date().toISOString().slice(0, 10);
  const rootFolder = `${sanitizePathSegment(appName)}_بيانات_${dateStamp}`;
  const agencyMap = new Map(state.agencies.map((a) => [a.id, a.name]));
  const entries: ZipEntryInput[] = [];

  // 1) Folder: الأسماء/
  const namesCsv = buildUtf8Csv(
    ['المعرف', 'الاسم الكامل', 'الحرف', 'الوكالة', 'الهوية الوطنية', 'الأفراد', 'الحالة', 'آخر تحديث'],
    state.persons.map((p) => [
      p.id,
      p.name,
      initialLetter(p.name),
      agencyMap.get(p.agencyId) || '',
      p.nationalId || '',
      p.individuals ?? 0,
      p.status || 'نشط',
      p.updatedAt || dateStamp,
    ])
  );
  entries.push({
    path: `${rootFolder}/الأسماء/أسماء_المستفيدين_${dateStamp}.csv`,
    data: namesCsv,
  });
  entries.push({
    path: `${rootFolder}/الأسماء/الوكالات_${dateStamp}.csv`,
    data: buildUtf8Csv(
      ['معرف الوكالة', 'اسم الوكالة', 'الرمز', 'حالة القفل'],
      state.agencies.map((a) => [a.id, a.name, a.icon, a.isLocked ? 'مقفلة' : 'مفتوحة'])
    ),
  });

  // 2) Folder: العناوين/
  const deliveryRelations = state.relations || [];
  const addressesCsv = buildUtf8Csv(
    ['الاسم', 'الوكالة', 'التصنيف', 'عنوان التوصيل', 'رقم الهاتف', 'وقت التوصيل', 'ملاحظة'],
    deliveryRelations.map((r) => [
      r.personName,
      agencyMap.get(r.agencyId) || '',
      r.category,
      r.deliveryAddress || 'غير محدد',
      r.deliveryPhone || '',
      r.deliveryTime || '',
      r.note || '',
    ])
  );
  entries.push({
    path: `${rootFolder}/العناوين/العناوين_والتوصيل_${dateStamp}.csv`,
    data: addressesCsv,
  });
  entries.push({
    path: `${rootFolder}/العناوين/العناوين_والتوصيل_${dateStamp}.json`,
    data: JSON.stringify(
      deliveryRelations.map((r) => ({
        personName: r.personName,
        agency: agencyMap.get(r.agencyId) || '',
        deliveryAddress: r.deliveryAddress || '',
        deliveryPhone: r.deliveryPhone || '',
        deliveryTime: r.deliveryTime || '',
        note: r.note,
      })),
      null,
      2
    ),
  });

  // 3) Folder: ملفات الإكسل والجداول/
  let excelCount = 0;
  const masterWb = createRtlWorkbook();
  const masterSheet = buildRtlArabicWorksheet({
    title: 'السجل الشامل للمستفيدين',
    subtitle: `تصدير منظم بتاريخ ${dateStamp}`,
    headers: ['ت', 'الاسم الكامل', 'الوكالة', 'الأفراد', 'الحصة (كغم)', 'المبلغ (د.ع)', 'الحالة', 'ملاحظات'],
    rows: state.persons.map((p, idx) => {
      const alloc = getEffectiveAllocationForPerson(p, state.calculationSettings);
      return [
        idx + 1,
        p.name,
        agencyMap.get(p.agencyId) || '',
        alloc.eligibleIndividuals ?? 0,
        alloc.quotaText,
        alloc.priceIqd ?? 0,
        p.status || 'نشط',
        p.notes || '',
      ];
    }),
  });
  XLSX.utils.book_append_sheet(masterWb, masterSheet, 'السجل الشامل');
  entries.push({
    path: `${rootFolder}/ملفات_الإكسل_والجداول/السجل_الشامل_${dateStamp}.xlsx`,
    data: workbookToUint8Array(masterWb),
  });
  excelCount += 1;

  for (const ag of state.agencies) {
    const agPersons = state.persons.filter((p) => p.agencyId === ag.id);
    const agWb = createRtlWorkbook();
    const agSheet = buildRtlArabicWorksheet({
      title: ag.name,
      subtitle: `عدد المستفيدين: ${agPersons.length}`,
      headers: ['ت', 'الاسم', 'الهوية', 'الأفراد', 'الحالة', 'ملاحظات'],
      rows: agPersons.map((p, idx) => [
        idx + 1,
        p.name,
        p.nationalId || '',
        p.individuals ?? 0,
        p.status || 'نشط',
        p.notes || '',
      ]),
    });
    XLSX.utils.book_append_sheet(agWb, agSheet, 'السجل');
    entries.push({
      path: `${rootFolder}/ملفات_الإكسل_والجداول/كشف_${sanitizePathSegment(ag.name)}_${dateStamp}.xlsx`,
      data: workbookToUint8Array(agWb),
    });
    excelCount += 1;
  }

  const financeWb = createRtlWorkbook();
  const financeSheet = buildRtlArabicWorksheet({
    title: 'المصروفات والحسابات المالية',
    subtitle: `إجمالي الحركات: ${state.expenses.length}`,
    headers: ['ت', 'الوكالة', 'الوصف', 'التصنيف', 'المبلغ (د.ع)', 'التاريخ'],
    rows: state.expenses.map((ex, idx) => [
      idx + 1,
      agencyMap.get(ex.agencyId) || '',
      ex.description,
      ex.category,
      ex.amountIqd,
      ex.occurredAt,
    ]),
  });
  XLSX.utils.book_append_sheet(financeWb, financeSheet, 'المالية');
  entries.push({
    path: `${rootFolder}/ملفات_الإكسل_والجداول/المالية_والمصروفات_${dateStamp}.xlsx`,
    data: workbookToUint8Array(financeWb),
  });
  excelCount += 1;

  // 4) Folder: الصور والمرفقات/
  let attachmentCount = 0;
  if (authUser?.avatarUrl) {
    const decoded = decodeDataUrlToBytes(authUser.avatarUrl);
    if (decoded) {
      entries.push({
        path: `${rootFolder}/الصور_والمرفقات/صورة_الحساب_${dateStamp}.${decoded.ext}`,
        data: decoded.bytes,
      });
      attachmentCount += 1;
    }
  }
  for (const ag of state.agencies) {
    if (ag.logoDataUrl) {
      const decoded = decodeDataUrlToBytes(ag.logoDataUrl);
      if (decoded) {
        entries.push({
          path: `${rootFolder}/الصور_والمرفقات/شعار_${sanitizePathSegment(ag.name)}_${dateStamp}.${decoded.ext}`,
          data: decoded.bytes,
        });
        attachmentCount += 1;
      }
    }
  }
  for (const session of state.ucrsSessions || []) {
    for (let i = 0; i < (session.sources || []).length; i++) {
      const src = session.sources[i];
      if (src.previewDataUrl) {
        const decoded = decodeDataUrlToBytes(src.previewDataUrl);
        if (decoded) {
          entries.push({
            path: `${rootFolder}/الصور_والمرفقات/مرفق_سحب_${sanitizePathSegment(src.label || `صورة_${i + 1}`)}_${dateStamp}.${decoded.ext}`,
            data: decoded.bytes,
          });
          attachmentCount += 1;
        }
      }
    }
  }
  if (attachmentCount === 0) {
    entries.push({
      path: `${rootFolder}/الصور_والمرفقات/دليل_المرفقات_${dateStamp}.txt`,
      data: 'لا توجد صور أو مرفقات مضمنة حالياً في الوكالات أو جلسات السحب.\n',
    });
  }

  // 5) Folder: الملاحظات والأفكار/
  const notes = state.workspaceNotes || [];
  const notesText =
    notes.length === 0
      ? 'لا توجد ملاحظات أو أفكار مسجلة حالياً.\n'
      : notes
          .map(
            (n, idx) =>
              `[${idx + 1}] ${n.title}\nالتصنيف: ${CATEGORY_LABELS[n.category]}\nالتاريخ: ${n.updatedAt.slice(0, 10)}\n${n.content}\n----------------------------------------`
          )
          .join('\n\n');
  entries.push({
    path: `${rootFolder}/الملاحظات_والأفكار/الملاحظات_والأفكار_${dateStamp}.txt`,
    data: notesText,
  });
  entries.push({
    path: `${rootFolder}/الملاحظات_والأفكار/الملاحظات_والأفكار_${dateStamp}.json`,
    data: JSON.stringify(notes, null, 2),
  });

  // Root summary README
  entries.push({
    path: `${rootFolder}/ملخص_الحزمة_${dateStamp}.txt`,
    data: [
      `تطبيق Morrow — حزمة التصدير المنظمة`,
      `تاريخ التصدير: ${dateStamp}`,
      `عدد الوكالات: ${state.agencies.length}`,
      `عدد المستفيدين: ${state.persons.length}`,
      `العناوين وسجلات التوصيل: ${deliveryRelations.length}`,
      `ملفات الإكسل المولدة: ${excelCount}`,
      `الصور والمرفقات: ${attachmentCount}`,
      `الملاحظات والأفكار: ${notes.length}`,
    ].join('\n'),
  });

  const zipResult = await buildZipArchive(entries, { compress: true });
  return {
    rootFolder,
    zipFilename: `${rootFolder}.zip`,
    fileCount: entries.length,
    uncompressedBytes: zipResult.uncompressedBytes,
    compressedBytes: zipResult.compressedBytes,
    crc32Hex: zipResult.crc32Hex,
    foldersSummary: [
      { folder: 'الأسماء', itemsCount: 2 },
      { folder: 'العناوين', itemsCount: 2 },
      { folder: 'ملفات الإكسل والجداول', itemsCount: excelCount },
      { folder: 'الصور والمرفقات', itemsCount: Math.max(1, attachmentCount) },
      { folder: 'الملاحظات والأفكار', itemsCount: 2 },
    ],
    blob: zipResult.blob,
  };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function directShareStructuredExport(
  summary: StructuredExportSummary,
  textSummary: string
): Promise<'shared' | 'downloaded'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([summary.blob], summary.zipFilename, {
        type: 'application/zip',
      });
      const canShareFiles =
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({
          title: `بيانات Morrow (${summary.rootFolder})`,
          text: textSummary,
          files: [file],
        });
        return 'shared';
      }
      await navigator.share({
        title: `ملخص بيانات Morrow`,
        text: textSummary,
      });
      triggerBlobDownload(summary.blob, summary.zipFilename);
      return 'shared';
    } catch {
      // Fallback to direct download if user cancels share sheet or share API fails
    }
  }

  triggerBlobDownload(summary.blob, summary.zipFilename);
  return 'downloaded';
}
