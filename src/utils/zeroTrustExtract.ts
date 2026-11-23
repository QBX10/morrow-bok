import type {
  Agency,
  InferredDocumentMetadata,
  NormalizedBox,
  QuickExtractEvaluatedRow,
  SemanticColumnMapping,
  ZeroTrustCellStatus,
} from '../types/agency.ts';
import type { AiTaskRoutingMap } from '../types/assistant.ts';
import { normalizeArabic } from './agencyLogic.ts';

export const ZERO_TRUST_CONFIDENCE_THRESHOLD = 0.99;

export interface ZeroTrustCellEvaluation {
  status: ZeroTrustCellStatus;
  confidencePct: number;
  needsReview: boolean;
  tooltipQuestion: string;
}

export function evaluateZeroTrustCell(params: {
  valueDisplay: string;
  confidence: number | undefined;
  hasStructuralError?: boolean;
  hasMathWarning?: boolean;
  mathWarningText?: string;
  explicitConfirmed?: boolean;
  fieldLabel: string;
}): ZeroTrustCellEvaluation {
  const conf =
    typeof params.confidence === 'number' && Number.isFinite(params.confidence)
      ? Math.max(0, Math.min(1, params.confidence))
      : 1;
  const pct = Math.round(conf * 100);

  if (params.explicitConfirmed) {
    return {
      status: 'verified',
      confidencePct: 100,
      needsReview: false,
      tooltipQuestion: '',
    };
  }

  const val = params.valueDisplay.trim() || 'غير مقروء';
  if (params.hasStructuralError || conf < 0.85) {
    return {
      status: 'red',
      confidencePct: pct,
      needsReview: true,
      tooltipQuestion: `هل هذا صحيح؟ لقد قرأت (${val}) بنسبة ثقة ${pct}% ولكن الخط غير واضح أو توجد علامة شك في ${params.fieldLabel}.`,
    };
  }

  if (params.hasMathWarning) {
    return {
      status: 'yellow',
      confidencePct: pct,
      needsReview: true,
      tooltipQuestion:
        params.mathWarningText ||
        `تعارض رياضي في ${params.fieldLabel} (${val}) — يُرجى مراجعة تطابق الكلي مع المستحق والمحجوب.`,
    };
  }

  if (conf < ZERO_TRUST_CONFIDENCE_THRESHOLD) {
    return {
      status: 'yellow',
      confidencePct: pct,
      needsReview: true,
      tooltipQuestion: `هل هذا صحيح؟ لقد قرأت (${val}) بنسبة ثقة ${pct}% (أقل من 99%) — يُرجى التأكد من ${params.fieldLabel}.`,
    };
  }

  return {
    status: 'verified',
    confidencePct: pct,
    needsReview: false,
    tooltipQuestion: '',
  };
}

export function computeRowZeroTrustSummary(row: QuickExtractEvaluatedRow): {
  name: ZeroTrustCellEvaluation;
  numbers: ZeroTrustCellEvaluation;
  date: ZeroTrustCellEvaluation;
  anyDoubt: boolean;
  hasMathConflict: boolean;
  worstStatus: ZeroTrustCellStatus;
} {
  const hasMathConflict = row.mathIssues.length > 0 && !row.mathConfirmed;
  const confirmed = Boolean(
    row.zeroTrustConfirmed ||
      (row.doubtConfirmed && !hasLowConfidenceUnder99(row) && !hasMathConflict)
  );

  const name = evaluateZeroTrustCell({
    valueDisplay: row.resolvedName,
    confidence: row.nameConfidence,
    hasStructuralError:
      row.hasDoubt ||
      row.missingFields.includes('name') ||
      row.suspectSegments.length > 0,
    explicitConfirmed: Boolean(
      row.zeroTrustConfirmed ||
        (row.doubtConfirmed && row.nameConfidence >= ZERO_TRUST_CONFIDENCE_THRESHOLD)
    ),
    fieldLabel: 'الاسم',
  });

  const numSummaryText = [
    row.resolvedIndividuals !== null ? `الأفراد: ${row.resolvedIndividuals}` : 'الأفراد: مفقود',
    typeof row.resolvedEligibleIndividuals === 'number'
      ? `مستحق: ${row.resolvedEligibleIndividuals}`
      : '',
    (row.resolvedDecreaseCount ?? 0) > 0 ? `محجوب/نزول: ${row.resolvedDecreaseCount}` : '',
    (row.resolvedAddOrDeleteCount ?? 0) > 0
      ? `${row.resolvedAddOrDeleteAction}: ${row.resolvedAddOrDeleteCount}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const numbers = evaluateZeroTrustCell({
    valueDisplay: numSummaryText,
    confidence: row.numbersConfidence,
    hasStructuralError:
      row.missingFields.includes('individuals') ||
      row.missingFields.includes('decreaseCount') ||
      row.missingFields.includes('addOrDeleteCount'),
    hasMathWarning: hasMathConflict,
    mathWarningText: hasMathConflict ? row.mathIssues.join(' · ') : undefined,
    explicitConfirmed: Boolean(
      row.zeroTrustConfirmed ||
        (row.mathConfirmed &&
          row.doubtConfirmed &&
          row.numbersConfidence >= ZERO_TRUST_CONFIDENCE_THRESHOLD)
    ),
    fieldLabel: 'الأرقام',
  });

  const dateText = (row.resolvedRowDate ?? row.rowDate ?? '').trim();
  const hasDate = dateText.length > 0;
  const date = hasDate
    ? evaluateZeroTrustCell({
        valueDisplay: dateText,
        confidence: row.dateConfidence ?? 1,
        hasStructuralError: false,
        explicitConfirmed: Boolean(row.zeroTrustConfirmed),
        fieldLabel: 'التاريخ',
      })
    : {
        status: 'verified' as ZeroTrustCellStatus,
        confidencePct: 100,
        needsReview: false,
        tooltipQuestion: '',
      };

  const anyDoubt =
    (!confirmed && (name.needsReview || numbers.needsReview || date.needsReview)) ||
    hasMathConflict;
  const worstStatus: ZeroTrustCellStatus =
    name.status === 'red' || numbers.status === 'red' || date.status === 'red'
      ? 'red'
      : name.status === 'yellow' || numbers.status === 'yellow' || date.status === 'yellow'
        ? 'yellow'
        : 'verified';

  return { name, numbers, date, anyDoubt, hasMathConflict, worstStatus };
}

export function hasLowConfidenceUnder99(row: QuickExtractEvaluatedRow): boolean {
  if (row.zeroTrustConfirmed) return false;
  if (row.nameConfidence < ZERO_TRUST_CONFIDENCE_THRESHOLD) return true;
  if (row.numbersConfidence < ZERO_TRUST_CONFIDENCE_THRESHOLD) return true;
  if (
    (row.resolvedRowDate || row.rowDate) &&
    typeof row.dateConfidence === 'number' &&
    row.dateConfidence < ZERO_TRUST_CONFIDENCE_THRESHOLD
  ) {
    return true;
  }
  return false;
}

/**
 * Computes a full-row bounding box (0..1000) spanning horizontally across the entire table row
 * so Contextual Row Snippet always displays the full context (name + neighboring numbers/notes).
 */
export function getFullRowCropBox(
  row: Pick<QuickExtractEvaluatedRow, 'rowBox' | 'suspectBox'>
): NormalizedBox | null {
  const base = row.rowBox || row.suspectBox;
  if (!base || base.ymax <= base.ymin) return null;

  const rowHeight = Math.max(18, base.ymax - base.ymin);
  const verticalPad = Math.max(10, Math.round(rowHeight * 0.35));

  return {
    ymin: Math.max(0, base.ymin - verticalPad),
    ymax: Math.min(1000, base.ymax + verticalPad),
    // Always stretch horizontally to capture the entire table row from edge to edge
    xmin: row.rowBox ? Math.min(15, row.rowBox.xmin) : 0,
    xmax: row.rowBox ? Math.max(985, row.rowBox.xmax) : 1000,
  };
}

export function matchAgencyByName(
  agencyName: string | null | undefined,
  agencies: Agency[]
): Agency | null {
  const normTarget = normalizeArabic(agencyName || '');
  if (!normTarget || agencies.length === 0) return null;

  // Exact or substring match
  for (const ag of agencies) {
    const normAg = normalizeArabic(ag.name);
    if (!normAg) continue;
    if (normAg === normTarget || normTarget.includes(normAg) || normAg.includes(normTarget)) {
      return ag;
    }
  }

  // Token overlap match (excluding generic "وكاله" / "مركز")
  const stopWords = new Set(['وكاله', 'وكيل', 'مركز', 'فرع', 'جدول', 'كشف']);
  const targetTokens = normTarget
    .split(' ')
    .filter((t) => t.length >= 2 && !stopWords.has(t));
  if (targetTokens.length === 0) return null;

  let best: Agency | null = null;
  let bestScore = 0;
  for (const ag of agencies) {
    const agTokens = normalizeArabic(ag.name)
      .split(' ')
      .filter((t) => t.length >= 2 && !stopWords.has(t));
    const hits = targetTokens.filter((t) => agTokens.includes(t)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = ag;
    }
  }
  return bestScore > 0 ? best : null;
}

export function mapColumnHeaderSemantically(
  header: string
): SemanticColumnMapping | null {
  const raw = String(header || '').trim();
  if (!raw || raw.length > 48) return null;
  const norm = normalizeArabic(raw).toLowerCase();

  if (
    /(مستحق|مستحقه|مستحقين|الصافيه|الصافي|eligible)/i.test(norm)
  ) {
    return {
      sourceHeader: raw,
      targetField: 'eligibleIndividuals',
      targetLabel: 'الأفراد المستحقة',
      confidence: 0.98,
    };
  }

  if (
    /(محجوب|محجوبين|حجب|نزول|نقصان|نقص|decrease|blocked)/i.test(norm)
  ) {
    return {
      sourceHeader: raw,
      targetField: 'decreaseCount',
      targetLabel: 'الحجب / النزول',
      confidence: 0.98,
    };
  }

  if (
    /(افراد|الافراد الكليه|كلي|اجمالي|العدد|total|individuals|count)/i.test(norm)
  ) {
    return {
      sourceHeader: raw,
      targetField: 'individuals',
      targetLabel: 'إجمالي الأفراد',
      confidence: 0.98,
    };
  }

  if (/(اضافه|حذف|تغيير|تعديل)/i.test(norm)) {
    return {
      sourceHeader: raw,
      targetField: 'addOrDelete',
      targetLabel: 'الإضافة والحذف',
      confidence: 0.96,
    };
  }

  if (/(الاسم|اسم|المستفيد|رب الاسره|name)/i.test(norm)) {
    return {
      sourceHeader: raw,
      targetField: 'name',
      targetLabel: 'الاسم الكامل',
      confidence: 0.99,
    };
  }

  if (/(تاريخ|الشهر|الفتره|date|month)/i.test(norm)) {
    return {
      sourceHeader: raw,
      targetField: 'rowDate',
      targetLabel: 'التاريخ',
      confidence: 0.95,
    };
  }

  if (/(ملاحظ|سبب|عنوان|note)/i.test(norm)) {
    return {
      sourceHeader: raw,
      targetField: 'notes',
      targetLabel: 'الملاحظات',
      confidence: 0.95,
    };
  }

  return null;
}

export function buildSemanticColumnMappings(
  headers: string[]
): SemanticColumnMapping[] {
  const seen = new Set<string>();
  const mappings: SemanticColumnMapping[] = [];
  for (const h of headers) {
    const clean = String(h || '').trim();
    if (!clean) continue;
    const mapped = mapColumnHeaderSemantically(clean);
    if (mapped && !seen.has(`${mapped.sourceHeader}:${mapped.targetField}`)) {
      seen.add(`${mapped.sourceHeader}:${mapped.targetField}`);
      mappings.push(mapped);
    }
  }
  return mappings;
}

export function extractHeaderColumnsFromText(rawText: string): string[] {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 14);

  for (const line of lines) {
    const parts = line
      .split(/\t|\||؛|,/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p.length <= 45);
    if (parts.length >= 2) {
      const semanticHits = parts.filter((p) => mapColumnHeaderSemantically(p) !== null);
      if (semanticHits.length >= 2) {
        return parts;
      }
    }
  }
  return [];
}

export function buildProactiveHeaderGreeting(
  meta: Pick<
    InferredDocumentMetadata,
    'agencyName' | 'tableDateLabel' | 'detectedColumns' | 'semanticMapping'
  >
): string {
  const agencyPart = meta.agencyName
    ? `لـ (${meta.agencyName})`
    : 'لمستفيدين';
  const monthPart = meta.tableDateLabel
    ? ` لشهر (${meta.tableDateLabel})`
    : '';
  const cols =
    meta.detectedColumns && meta.detectedColumns.length > 0
      ? meta.detectedColumns
      : (meta.semanticMapping || []).map((m) => m.sourceHeader);
  const colsPart =
    cols.length > 0
      ? ` الأعمدة المكتشفة: (${cols.join('، ')}).`
      : '';
  return `يبدو أن هذا جدول ${agencyPart}${monthPart}.${colsPart} هل أبدأ السحب بناءً على ذلك؟`;
}

const ARABIC_MONTHS_REGEX =
  /(كانون الثاني|شباط|آذار|اذار|نيسان|أيار|ايار|حزيران|تموز|آب|اب|أيلول|ايلول|تشرين الأول|تشرين الاول|تشرين الثاني|كانون الأول|كانون الاول|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/i;

export function inferMetadataFromText(
  rawText: string,
  agencies: Agency[] = [],
  fallbackFilename?: string,
  explicitHeaders?: string[]
): InferredDocumentMetadata | null {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 14);

  const headerSample = `${lines.join('\n')}\n${fallbackFilename || ''}`;
  if (!headerSample.trim()) return null;

  let agencyName: string | null = null;
  let agencyNameConfidence = 0;

  // Try matching known agency directly from header or filename
  for (const ag of agencies) {
    const normAg = normalizeArabic(ag.name);
    if (normAg && normalizeArabic(headerSample).includes(normAg)) {
      agencyName = ag.name;
      agencyNameConfidence = 0.99;
      break;
    }
  }

  if (!agencyName) {
    const agencyMatch = headerSample.match(
      /(?:وكالة|وكيل)\s+([^\n,|،\-:]{3,45})/i
    );
    if (agencyMatch?.[1]) {
      agencyName = `وكالة ${agencyMatch[1].trim()}`;
      agencyNameConfidence = 0.92;
    }
  }

  let tableDateLabel: string | null = null;
  let tableDateConfidence = 0;

  const monthMatch = headerSample.match(
    new RegExp(`${ARABIC_MONTHS_REGEX.source}(?:\\s*[-/،]?\\s*20\\d{2})?`, 'i')
  );
  if (monthMatch?.[0]) {
    tableDateLabel = monthMatch[0].trim();
    tableDateConfidence = 0.96;
  } else {
    const numericDateMatch = headerSample.match(
      /\b(20\d{2}[-/]\d{1,2}(?:[-/]\d{1,2})?|\d{1,2}[-/]\d{1,2}[-/]20\d{2}|\d{1,2}[-/]20\d{2})\b/
    );
    if (numericDateMatch?.[0]) {
      tableDateLabel = numericDateMatch[0].trim();
      tableDateConfidence = 0.95;
    }
  }

  let centerOrAgencyNumber: string | null = null;
  let centerNumberConfidence = 0;
  const centerMatch = headerSample.match(
    /(?:رقم\s*(?:المركز|الوكالة|الوكيل)|(?:ال)?مركز\s*(?:رقم)?)\s*[:#\-]?\s*([0-9٠-٩][0-9٠-٩A-Za-z\-]{0,15})/i
  );
  if (centerMatch?.[1]) {
    centerOrAgencyNumber = centerMatch[1].trim();
    centerNumberConfidence = 0.94;
  }

  const detectedColumns =
    explicitHeaders && explicitHeaders.length > 0
      ? explicitHeaders.filter(Boolean)
      : extractHeaderColumnsFromText(rawText);
  const semanticMapping = buildSemanticColumnMappings(detectedColumns);

  if (
    !agencyName &&
    !tableDateLabel &&
    !centerOrAgencyNumber &&
    semanticMapping.length === 0
  ) {
    return null;
  }

  const matched = matchAgencyByName(agencyName, agencies);
  const resolvedAgencyName = agencyName || matched?.name || null;
  const proactivePrompt = buildProactiveHeaderGreeting({
    agencyName: resolvedAgencyName,
    tableDateLabel,
    detectedColumns,
    semanticMapping,
  });

  return {
    agencyName: resolvedAgencyName,
    agencyNameConfidence,
    matchedAgencyId: matched?.id ?? null,
    tableDateLabel,
    tableDateConfidence,
    centerOrAgencyNumber,
    centerNumberConfidence,
    headerSnippet: lines.slice(0, 3).join(' | '),
    detectedColumns,
    semanticMapping,
    proactivePrompt,
    confirmedByUser: false,
  };
}

export function normalizeInferredMetadata(
  raw: Partial<InferredDocumentMetadata> | null | undefined,
  agencies: Agency[]
): InferredDocumentMetadata | null {
  if (!raw) return null;
  const agencyName = raw.agencyName ? String(raw.agencyName).trim() : null;
  const tableDateLabel = raw.tableDateLabel
    ? String(raw.tableDateLabel).trim()
    : null;
  const centerOrAgencyNumber = raw.centerOrAgencyNumber
    ? String(raw.centerOrAgencyNumber).trim()
    : null;

  const detectedColumns = Array.isArray(raw.detectedColumns)
    ? raw.detectedColumns.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  const semanticMapping =
    Array.isArray(raw.semanticMapping) && raw.semanticMapping.length > 0
      ? raw.semanticMapping
      : buildSemanticColumnMappings(detectedColumns);

  if (
    !agencyName &&
    !tableDateLabel &&
    !centerOrAgencyNumber &&
    semanticMapping.length === 0
  ) {
    return null;
  }

  const matched = matchAgencyByName(agencyName, agencies);
  const resolvedAgencyName = agencyName || matched?.name || null;
  const proactivePrompt =
    raw.proactivePrompt ||
    buildProactiveHeaderGreeting({
      agencyName: resolvedAgencyName,
      tableDateLabel,
      detectedColumns,
      semanticMapping,
    });

  return {
    agencyName: resolvedAgencyName,
    agencyNameConfidence:
      typeof raw.agencyNameConfidence === 'number'
        ? raw.agencyNameConfidence
        : agencyName
          ? 0.92
          : 0,
    matchedAgencyId: matched?.id ?? raw.matchedAgencyId ?? null,
    tableDateLabel,
    tableDateConfidence:
      typeof raw.tableDateConfidence === 'number'
        ? raw.tableDateConfidence
        : tableDateLabel
          ? 0.92
          : 0,
    centerOrAgencyNumber,
    centerNumberConfidence:
      typeof raw.centerNumberConfidence === 'number'
        ? raw.centerNumberConfidence
        : centerOrAgencyNumber
          ? 0.9
          : 0,
    headerSnippet: raw.headerSnippet ? String(raw.headerSnippet).trim() : undefined,
    detectedColumns,
    semanticMapping,
    proactivePrompt,
    fallbackUsed: raw.fallbackUsed,
    executedModelId: raw.executedModelId,
    executedProvider: raw.executedProvider,
    executedModelLabel: raw.executedModelLabel,
    confirmedByUser: Boolean(raw.confirmedByUser),
  };
}

export type MetadataInferenceInput =
  | string
  | File
  | {
      filename?: string;
      mimeType?: string;
      base64Pdf?: string;
      imageDataUrl?: string;
      frames?: Array<{ mimeType?: string; data?: string; label?: string }>;
      rawText?: string;
      explicitHeaders?: string[];
    };

async function readFileAsDataUrlSafe(file: File): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
  const buf = await file.arrayBuffer();
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(buf).toString('base64')
      : '';
  const mime = file.type || 'application/octet-stream';
  return `data:${mime};base64,${base64}`;
}

function isBrowserFile(val: unknown): val is File {
  return typeof File !== 'undefined' && val instanceof File;
}

/**
 * Analyzes table headers from raw text, File, PDF, or camera frames using Vision AI
 * (`/api/quick-extract/metadata-inference`) to infer agency name, month, and year,
 * with automatic local fallback when offline or unconfigured.
 */
export async function performMetadataInference(
  fileContent: MetadataInferenceInput,
  agencies: Agency[] = [],
  taskRouting?: AiTaskRoutingMap
): Promise<InferredDocumentMetadata | null> {
  let payload: {
    filename?: string;
    mimeType?: string;
    base64Pdf?: string;
    imageDataUrl?: string;
    frames?: Array<{ mimeType?: string; data?: string; label?: string }>;
    rawText?: string;
    explicitHeaders?: string[];
  };

  if (typeof fileContent === 'string') {
    payload = { rawText: fileContent };
  } else if (isBrowserFile(fileContent)) {
    const lower = fileContent.name.toLowerCase();
    const isPdf =
      fileContent.type === 'application/pdf' || lower.endsWith('.pdf');
    const isImage =
      fileContent.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|bmp)$/i.test(lower);
    if (isPdf) {
      payload = {
        filename: fileContent.name,
        mimeType: 'application/pdf',
        base64Pdf: await readFileAsDataUrlSafe(fileContent),
      };
    } else if (isImage) {
      payload = {
        filename: fileContent.name,
        mimeType: fileContent.type || 'image/jpeg',
        imageDataUrl: await readFileAsDataUrlSafe(fileContent),
      };
    } else {
      const txt = await fileContent.text().catch(() => '');
      payload = {
        filename: fileContent.name,
        mimeType: fileContent.type || 'text/plain',
        rawText: txt,
      };
    }
  } else {
    payload = { ...fileContent };
  }

  const localFallback = inferMetadataFromText(
    payload.rawText || '',
    agencies,
    payload.filename,
    payload.explicitHeaders
  );

  // Use Vision AI endpoint whenever visual source (PDF / image / frames) or text is present in a browser/fetch environment
  const hasVisualPayload = Boolean(
    payload.base64Pdf ||
      payload.imageDataUrl ||
      (payload.frames && payload.frames.length > 0)
  );
  if (typeof fetch !== 'function' || (!hasVisualPayload && !payload.rawText)) {
    return localFallback;
  }

  try {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      controller && typeof setTimeout === 'function'
        ? setTimeout(() => controller.abort(), 9000)
        : null;

    const res = await fetch('/api/quick-extract/metadata-inference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller?.signal,
      body: JSON.stringify({
        filename: payload.filename,
        mimeType: payload.mimeType,
        base64Pdf: payload.base64Pdf,
        imageDataUrl: payload.imageDataUrl,
        frames: payload.frames?.slice(0, 1),
        rawText: payload.rawText?.slice(0, 6000),
        taskRouting,
      }),
    });
    if (timer) clearTimeout(timer);

    if (!res.ok) return localFallback;
    const data = (await res.json()) as {
      ok?: boolean;
      modelId?: string;
      modelLabel?: string;
      fallbackUsed?: boolean;
      metadata?: Partial<InferredDocumentMetadata> | null;
    };
    const mergedMeta = data.metadata
      ? {
          ...data.metadata,
          executedModelId: data.metadata.executedModelId || data.modelId,
          executedModelLabel: data.metadata.executedModelLabel || data.modelLabel,
          fallbackUsed:
            data.metadata.fallbackUsed !== undefined
              ? data.metadata.fallbackUsed
              : data.fallbackUsed,
        }
      : null;
    const normalized = normalizeInferredMetadata(mergedMeta, agencies);
    return normalized ? { ...normalized, confirmedByUser: false } : localFallback;
  } catch {
    return localFallback;
  }
}

