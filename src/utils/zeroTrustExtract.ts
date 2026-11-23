import type {
  Agency,
  InferredDocumentMetadata,
  NormalizedBox,
  QuickExtractEvaluatedRow,
  ZeroTrustCellStatus,
} from '../types/agency.ts';
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
  worstStatus: ZeroTrustCellStatus;
} {
  const confirmed = Boolean(row.zeroTrustConfirmed || (row.doubtConfirmed && !hasLowConfidenceUnder99(row)));

  const name = evaluateZeroTrustCell({
    valueDisplay: row.resolvedName,
    confidence: row.nameConfidence,
    hasStructuralError:
      row.hasDoubt ||
      row.missingFields.includes('name') ||
      row.suspectSegments.length > 0,
    explicitConfirmed: Boolean(row.zeroTrustConfirmed || (row.doubtConfirmed && row.nameConfidence >= ZERO_TRUST_CONFIDENCE_THRESHOLD)),
    fieldLabel: 'الاسم',
  });

  const numSummaryText = [
    row.resolvedIndividuals !== null ? `الأفراد: ${row.resolvedIndividuals}` : 'الأفراد: مفقود',
    (row.resolvedDecreaseCount ?? 0) > 0 ? `نزول: ${row.resolvedDecreaseCount}` : '',
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
      row.mathIssues.length > 0 ||
      row.missingFields.includes('individuals') ||
      row.missingFields.includes('decreaseCount') ||
      row.missingFields.includes('addOrDeleteCount'),
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

  const anyDoubt = !confirmed && (name.needsReview || numbers.needsReview || date.needsReview);
  const worstStatus: ZeroTrustCellStatus =
    name.status === 'red' || numbers.status === 'red' || date.status === 'red'
      ? 'red'
      : name.status === 'yellow' || numbers.status === 'yellow' || date.status === 'yellow'
        ? 'yellow'
        : 'verified';

  return { name, numbers, date, anyDoubt, worstStatus };
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
export function getFullRowCropBox(row: Pick<QuickExtractEvaluatedRow, 'rowBox' | 'suspectBox'>): NormalizedBox | null {
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

const ARABIC_MONTHS_REGEX =
  /(كانون الثاني|شباط|آذار|اذار|نيسان|أيار|ايار|حزيران|تموز|آب|اب|أيلول|ايلول|تشرين الأول|تشرين الاول|تشرين الثاني|كانون الأول|كانون الاول|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/i;

export function inferMetadataFromText(
  rawText: string,
  agencies: Agency[] = [],
  fallbackFilename?: string
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

  if (!agencyName && !tableDateLabel && !centerOrAgencyNumber) {
    return null;
  }

  const matched = matchAgencyByName(agencyName, agencies);
  return {
    agencyName: agencyName || matched?.name || null,
    agencyNameConfidence,
    matchedAgencyId: matched?.id ?? null,
    tableDateLabel,
    tableDateConfidence,
    centerOrAgencyNumber,
    centerNumberConfidence,
    headerSnippet: lines.slice(0, 3).join(' | '),
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

  if (!agencyName && !tableDateLabel && !centerOrAgencyNumber) return null;

  const matched = matchAgencyByName(agencyName, agencies);
  return {
    agencyName,
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
    confirmedByUser: Boolean(raw.confirmedByUser),
  };
}
