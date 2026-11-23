import * as XLSX from 'xlsx';
import type {
  Agency,
  InferredDocumentMetadata,
  Person,
  QuickExtractEvaluatedRow,
  QuickExtractFocusField,
  QuickExtractRawRow,
  UcrsContentIdentity,
  UcrsExtractedTextEntity,
  UcrsLearningRule,
} from '../types/agency';
import {
  ALL_QUICK_EXTRACT_FIELDS,
  buildArabicNameTree,
  evaluateExtractedRow,
} from './quickExtractEngine';
import {
  applyLearningRulesToName,
  buildIdentityFromParsedText,
  extractDatesAndLocationsFromText,
} from './ucrsEngine';
import { inferMetadataFromText } from './zeroTrustExtract';

export interface LocalParsedDocumentResult {
  rawText: string;
  pageCount: number;
  rows: QuickExtractEvaluatedRow[];
  entities: UcrsExtractedTextEntity[];
  identity: UcrsContentIdentity;
  documentSummary: string;
  inferredMetadata: InferredDocumentMetadata | null;
}

const NAME_HEADER_HINTS = ['اسم', 'الاسم', 'المستفيد', 'رب الاسرة', 'الاسماء', 'name'];
const ELIGIBLE_HEADER_HINTS = ['مستحق', 'المستحق', 'المستحقة', 'المستحقين', 'الصافي', 'الصافية', 'eligible'];
const IND_HEADER_HINTS = ['افراد الكلية', 'الأفراد الكلية', 'اجمالي الافراد', 'إجمالي الأفراد', 'افراد', 'الافراد', 'الأفراد', '\u0627\u0646\u0641\u0627\u0631', '\u0627\u0644\u0623\u0646\u0641\u0627\u0631', 'العدد', 'count', 'individuals'];
const DEC_HEADER_HINTS = ['محجوب', 'محجوبين', 'نزول', 'نقصان', 'نقص', 'حجب', 'decrease', 'blocked'];
const ADD_DEL_HEADER_HINTS = ['اضافة', 'إضافة', 'حذف', 'تعديل', 'التغيير'];
const DATE_HEADER_HINTS = ['تاريخ', 'التاريخ', 'الشهر', 'الفترة', 'date', 'month'];
const NOTE_HEADER_HINTS = ['ملاحظة', 'ملاحظات', 'عنوان', 'سبب', 'note', 'notes'];

function parseIntSafe(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const normalized = String(val)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\d.-]/g, '')
    .trim();
  if (!normalized) return null;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function findColumnIndex(headers: string[], hints: string[]): number {
  return headers.findIndex((h) => {
    const clean = h.toLowerCase().trim();
    return hints.some((hint) => clean.includes(hint.toLowerCase()));
  });
}

function buildRowsFromMatrix(
  matrix: string[][],
  options: {
    knownPersons?: Person[];
    learningRules?: UcrsLearningRule[];
    focusedFields?: QuickExtractFocusField[];
  }
): { rows: QuickExtractEvaluatedRow[]; colCount: number; headerColumns: string[] } {
  const nonEmpty = matrix.filter((r) => r.some((cell) => String(cell || '').trim() !== ''));
  if (nonEmpty.length === 0) return { rows: [], colCount: 0, headerColumns: [] };

  const headerRow = nonEmpty[0].map((c) => String(c || '').trim());
  const hasExplicitHeader =
    findColumnIndex(headerRow, NAME_HEADER_HINTS) !== -1 ||
    findColumnIndex(headerRow, IND_HEADER_HINTS) !== -1 ||
    findColumnIndex(headerRow, ELIGIBLE_HEADER_HINTS) !== -1;

  const startIdx = hasExplicitHeader ? 1 : 0;
  let nameCol = hasExplicitHeader ? findColumnIndex(headerRow, NAME_HEADER_HINTS) : -1;
  const eligibleCol = hasExplicitHeader ? findColumnIndex(headerRow, ELIGIBLE_HEADER_HINTS) : -1;
  let indCol = hasExplicitHeader ? findColumnIndex(headerRow, IND_HEADER_HINTS) : -1;
  if (indCol === eligibleCol && eligibleCol !== -1) {
    // Prefer a separate total individuals column if both exist
    const alt = headerRow.findIndex(
      (h, idx) =>
        idx !== eligibleCol &&
        IND_HEADER_HINTS.some((hint) => h.toLowerCase().includes(hint.toLowerCase()))
    );
    if (alt !== -1) indCol = alt;
  }
  const decCol = hasExplicitHeader ? findColumnIndex(headerRow, DEC_HEADER_HINTS) : -1;
  const addDelCol = hasExplicitHeader ? findColumnIndex(headerRow, ADD_DEL_HEADER_HINTS) : -1;
  const dateCol = hasExplicitHeader ? findColumnIndex(headerRow, DATE_HEADER_HINTS) : -1;
  const noteCol = hasExplicitHeader ? findColumnIndex(headerRow, NOTE_HEADER_HINTS) : -1;

  if (nameCol === -1) {
    // Infer column with most Arabic multi-word text
    const sample = nonEmpty.slice(startIdx, startIdx + 8);
    const maxCols = Math.max(...sample.map((r) => r.length), 1);
    let bestCol = 0;
    let bestScore = -1;
    for (let c = 0; c < maxCols; c++) {
      let score = 0;
      for (const r of sample) {
        const val = String(r[c] || '').trim();
        if (/[\u0600-\u06FF]/.test(val) && !/^\d+$/.test(val)) {
          score += val.split(/\s+/).length >= 2 ? 3 : 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }
    nameCol = bestCol;
  }

  if (indCol === -1) {
    const sample = nonEmpty.slice(startIdx, startIdx + 8);
    const maxCols = Math.max(...sample.map((r) => r.length), 1);
    for (let c = 0; c < maxCols; c++) {
      if (c === nameCol || c === eligibleCol) continue;
      const numericHits = sample.filter((r) => parseIntSafe(r[c]) !== null).length;
      if (numericHits > 0) {
        indCol = c;
        break;
      }
    }
  }

  const tree = buildArabicNameTree(options.knownPersons || []);
  const rules = options.learningRules || [];
  const focus = options.focusedFields || ALL_QUICK_EXTRACT_FIELDS;
  const rows: QuickExtractEvaluatedRow[] = [];

  for (let i = startIdx; i < nonEmpty.length; i++) {
    const line = nonEmpty[i];
    const rawName = String(line[nameCol] || '').trim();
    if (!rawName && parseIntSafe(line[indCol]) === null) continue;

    const learned = applyLearningRulesToName(rawName, rules);
    const indVal = indCol >= 0 ? parseIntSafe(line[indCol]) : null;
    const eligibleVal = eligibleCol >= 0 ? parseIntSafe(line[eligibleCol]) : null;
    const decVal = decCol >= 0 ? parseIntSafe(line[decCol]) : 0;
    const addDelRaw = addDelCol >= 0 ? String(line[addDelCol] || '').trim() : '';
    const addDelCount = parseIntSafe(addDelRaw);
    const action: QuickExtractRawRow['addOrDeleteAction'] = addDelRaw.includes('حذف')
      ? 'حذف'
      : addDelRaw.includes('اضاف') || addDelRaw.includes('إضاف') || (addDelCount ?? 0) > 0
      ? 'إضافة'
      : 'لا يوجد';
    const noteVal = noteCol >= 0 ? String(line[noteCol] || '').trim() : '';
    const rowDateVal = dateCol >= 0 ? String(line[dateCol] || '').trim() : '';

    const rawRow: QuickExtractRawRow = {
      rowIndex: rows.length + 1,
      pageNumber: 1,
      name: learned.updatedName || null,
      individuals: indVal,
      eligibleIndividuals: eligibleVal,
      decreaseCount: decVal ?? 0,
      addOrDeleteCount: addDelCount ?? 0,
      addOrDeleteAction: action,
      rowDate: rowDateVal || null,
      nameConfidence: learned.updatedName ? 0.99 : 0.4,
      numbersConfidence: indVal !== null ? 0.99 : 0.7,
      dateConfidence: rowDateVal ? 0.99 : 1,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: line.join(' | '),
    };

    const evaluated = evaluateExtractedRow(rawRow, rows.length, {
      sourceMode: 'pdf',
      scanMode: 'audit',
      focusedFields: focus,
      tree,
      persons: options.knownPersons,
    });
    if (noteVal) {
      evaluated.notes = noteVal;
    }
    rows.push(evaluated);
  }

  const colCount = Math.max(...nonEmpty.map((r) => r.length), 1);
  return {
    rows,
    colCount,
    headerColumns: hasExplicitHeader ? headerRow.filter(Boolean) : [],
  };
}

function buildRowsFromPlainTextLines(
  text: string,
  options: {
    knownPersons?: Person[];
    learningRules?: UcrsLearningRule[];
    focusedFields?: QuickExtractFocusField[];
  }
): {
  matrix: string[][];
  rows: QuickExtractEvaluatedRow[];
  colCount: number;
  headerColumns: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Check if delimiter-separated (tab, pipe, semicolon, comma)
  const delimited = lines.map((l) => {
    if (l.includes('\t')) return l.split('\t').map((c) => c.trim());
    if (l.includes('|')) return l.split('|').map((c) => c.trim());
    if (l.includes('؛')) return l.split('؛').map((c) => c.trim());
    if (l.includes(',')) return l.split(',').map((c) => c.trim());
    // Try extracting Arabic name + trailing number e.g. "أحمد علي حسن 5"
    const m = l.match(/^(?:\d+[\.\-\)]\s*)?([\u0600-\u06FF\s]{4,}?)\s+(\d+)(?:\s+(.*))?$/);
    if (m) {
      return [m[1].trim(), m[2].trim(), (m[3] || '').trim()];
    }
    return [l];
  });

  const multiColLines = delimited.filter((parts) => parts.length >= 2);
  if (multiColLines.length >= 1) {
    const built = buildRowsFromMatrix(multiColLines, options);
    return { matrix: multiColLines, ...built };
  }
  return { matrix: delimited, rows: [], colCount: 1, headerColumns: [] };
}

function buildEntitiesFromText(
  rawText: string,
  rows: QuickExtractEvaluatedRow[]
): UcrsExtractedTextEntity[] {
  const entities: UcrsExtractedTextEntity[] = [];
  const { dates, locations } = extractDatesAndLocationsFromText(rawText);

  dates.forEach((d, idx) => {
    entities.push({
      id: `ent_d_${idx}`,
      kind: 'date',
      text: d,
      context: 'تاريخ مرصود داخل المحتوى',
      pageNumber: 1,
      rowOrLineIndex: idx + 1,
      confidence: 0.96,
      relevance: 'useful',
      relevanceReason: 'يساعد في تحديد الفترة والحصة الزمنية.',
    });
  });

  locations.forEach((loc, idx) => {
    entities.push({
      id: `ent_l_${idx}`,
      kind: 'location',
      text: loc,
      context: 'اسم منطقة / مكان مرصود جغرافيًا',
      pageNumber: 1,
      rowOrLineIndex: idx + 1,
      confidence: 0.94,
      relevance: 'useful',
      relevanceReason: 'يساعد في توزيع خطوط التوصيل أو الوكالات.',
    });
  });

  rows.forEach((r, idx) => {
    if (r.notes?.trim()) {
      entities.push({
        id: `ent_n_${idx}`,
        kind: 'note',
        text: r.notes.trim(),
        context: r.resolvedName || `صف ${r.rowIndex}`,
        pageNumber: r.pageNumber,
        rowOrLineIndex: r.rowIndex,
        confidence: 0.95,
        relevance: 'important',
        relevanceReason: 'ملاحظة مرتبطة بسجل مستفيد.',
      });
    }
  });

  const paragraphs = rawText
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20)
    .slice(0, 12);

  paragraphs.forEach((p, idx) => {
    entities.push({
      id: `ent_p_${idx}`,
      kind: 'paragraph',
      text: p.slice(0, 260),
      context: `فقرة #${idx + 1}`,
      pageNumber: 1,
      rowOrLineIndex: idx + 1,
      confidence: 0.95,
      relevance: 'neutral',
      relevanceReason: 'مقطع نصي مستخرج للقراءة أو البحث الدلالي.',
    });
  });

  return entities;
}

/**
 * Lightweight browser & Node compatible DOCX (ZIP -> word/document.xml) text extractor.
 */
async function extractTextFromDocxBuffer(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  let offset = 0;

  while (offset + 30 < bytes.length) {
    // ZIP Local File Header signature: 0x04034b50
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLen);
    const fileName = new TextDecoder().decode(nameBytes);
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;

    if (fileName === 'word/document.xml' && compressedSize > 0 && dataEnd <= bytes.length) {
      const payload = bytes.slice(dataStart, dataEnd);
      let xmlText = '';
      if (compressionMethod === 0) {
        xmlText = new TextDecoder().decode(payload);
      } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        void writer.write(payload);
        void writer.close();
        const decompressed = await new Response(ds.readable).arrayBuffer();
        xmlText = new TextDecoder().decode(decompressed);
      }
      if (xmlText) {
        return xmlText
          .replace(/<\/w:tc>/g, '\t')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
    }

    if (compressedSize === 0 && dataStart === offset + 30 + fileNameLen + extraLen) {
      offset = dataStart + 1;
    } else {
      offset = Math.max(offset + 30, dataEnd);
    }
  }
  return '';
}

export async function parseLocalStructuredDocument(params: {
  file?: File;
  rawTextInput?: string;
  agencies?: Agency[];
  knownPersons?: Person[];
  learningRules?: UcrsLearningRule[];
  focusedFields?: QuickExtractFocusField[];
  customCommand?: string;
}): Promise<LocalParsedDocumentResult> {
  const fileName = params.file?.name || 'نص_مباشر.txt';
  const lower = fileName.toLowerCase();

  let rawText = params.rawTextInput || '';
  let rows: QuickExtractEvaluatedRow[] = [];
  let colCount = 1;
  let headerColumns: string[] = [];

  if (params.file) {
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      const buf = await params.file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: '',
      }) as string[][];
      const built = buildRowsFromMatrix(matrix, {
        knownPersons: params.knownPersons,
        learningRules: params.learningRules,
        focusedFields: params.focusedFields,
      });
      rows = built.rows;
      colCount = built.colCount;
      headerColumns = built.headerColumns;
      rawText = matrix
        .map((r) => r.map((c) => String(c ?? '')).join(' | '))
        .join('\n');
    } else if (lower.endsWith('.docx')) {
      const buf = await params.file.arrayBuffer();
      rawText = await extractTextFromDocxBuffer(buf);
      if (!rawText) {
        throw new Error('تعذر استخراج النص من ملف Word. تأكد من سلامة صيغة .docx.');
      }
      const built = buildRowsFromPlainTextLines(rawText, {
        knownPersons: params.knownPersons,
        learningRules: params.learningRules,
        focusedFields: params.focusedFields,
      });
      rows = built.rows;
      colCount = built.colCount;
      headerColumns = built.headerColumns;
    } else {
      rawText = await params.file.text();
      const built = buildRowsFromPlainTextLines(rawText, {
        knownPersons: params.knownPersons,
        learningRules: params.learningRules,
        focusedFields: params.focusedFields,
      });
      rows = built.rows;
      colCount = built.colCount;
      headerColumns = built.headerColumns;
    }
  } else if (rawText.trim()) {
    const built = buildRowsFromPlainTextLines(rawText, {
      knownPersons: params.knownPersons,
      learningRules: params.learningRules,
      focusedFields: params.focusedFields,
    });
    rows = built.rows;
    colCount = built.colCount;
    headerColumns = built.headerColumns;
  }

  const identity = buildIdentityFromParsedText({
    fileName,
    rawText,
    rowsCount: rows.length,
    colCount,
    knownPersons: params.knownPersons,
    customCommand: params.customCommand,
  });

  const entities = buildEntitiesFromText(rawText, rows);
  const inferredMetadata = inferMetadataFromText(
    rawText,
    params.agencies || [],
    fileName,
    headerColumns
  );

  return {
    rawText,
    pageCount: 1,
    rows,
    entities,
    identity,
    documentSummary:
      rows.length > 0
        ? `تمت قراءة ${rows.length} صفًا من «${fileName}» (${identity.contentType}).`
        : `تمت قراءة محتوى نصي من «${fileName}» (${identity.wordCount} كلمة).`,
    inferredMetadata,
  };
}
