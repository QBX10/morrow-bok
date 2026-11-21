import type {
  Person,
  QuickExtractEvaluatedRow,
  QuickExtractFocusField,
  UcrsContentIdentity,
  UcrsContentType,
  UcrsCoverageRegion,
  UcrsDiagnosticEntry,
  UcrsExtractedTextEntity,
  UcrsFusionDiff,
  UcrsLearningRule,
  UcrsReadingPlan,
  UcrsRelevanceLevel,
  UcrsSession,
  UcrsSmartCoverage,
  UcrsSourceKind,
} from '../types/agency.ts';
import { normalizeArabic } from './agencyLogic.ts';
import {
  ALL_QUICK_EXTRACT_FIELDS,
  buildArabicNameTree,
  evaluateExtractedRow,
} from './quickExtractEngine.ts';

export interface UcrsSemanticHit {
  id: string;
  sessionId: string;
  sessionTitle: string;
  sourceKind: 'row' | 'entity';
  rowId?: string;
  matchedText: string;
  context: string;
  pageNumber: number;
  rowOrLineIndex: number;
  confidence: number;
  matchKind: 'exact' | 'fuzzy' | 'semantic' | 'numeric' | 'date';
  box?: QuickExtractEvaluatedRow['suspectBox'];
  rowSnapshot?: QuickExtractEvaluatedRow;
}

export interface UcrsSessionStatistics {
  totalRows: number;
  totalEntities: number;
  uniqueNamesCount: number;
  numbersCount: number;
  notesCount: number;
  datesCount: number;
  locationsCount: number;
  avgIndividuals: number;
  maxIndividuals: number;
  minIndividuals: number;
  totalAdditions: number;
  totalDecreases: number;
  totalDeletions: number;
}

export interface UcrsComparisonResult {
  similarityPercent: number;
  matchedInTargetCount: number;
  newOnlyCount: number;
  changedIndividualsCount: number;
  differences: Array<{
    name: string;
    sessionValue: number | null;
    targetValue: number | null;
    kind: 'new' | 'changed' | 'identical';
  }>;
}

const SEMANTIC_SYNONYM_GROUPS: Record<string, string[]> = {
  حجب: ['حجب', 'محجوب', 'محجوبين', 'موقوف', 'ايقاف', 'ممنوع', 'منع', 'لاغي', 'ملغى', 'مجمد'],
  اضافة: ['اضافة', 'اضافه', 'زيادة', 'ملحق', 'مولود', 'ولادة', 'مضاف', 'تثبيت'],
  نزول: ['نزول', 'نقصان', 'متوفي', 'وفاة', 'مسافر', 'نقل', 'حذف', 'شطب', 'مغادر'],
  توصيل: ['توصيل', 'عنوان', 'حي', 'محلة', 'سائق', 'خط', 'هاتف', 'اتصال', 'منطقة'],
  ملاحظة: ['ملاحظة', 'تنبيه', 'تذكير', 'مهم', 'مؤجل', 'متابعة', 'مراجعة'],
};

const RELEVANCE_PATTERNS = [
  'مستفيد',
  'انفار',
  'افراد',
  'طحين',
  'كمية',
  'وكالة',
  'بطاقة',
  'حصة',
  'تموين',
  'نزول',
  'اضافة',
  'محجوب',
  'حجب',
  'عائلة',
  'نفر',
];

const IRAQI_LOCATION_HINTS = [
  'بغداد',
  'الكرادة',
  'المنصور',
  'الاعظمية',
  'الكاظمية',
  'الشعلة',
  'الصدر',
  'الدورة',
  'البصرة',
  'النجف',
  'كربلاء',
  'بابل',
  'الحلة',
  'الموصل',
  'نينوى',
  'الانبار',
  'الرمادي',
  'كركوك',
  'ديالى',
  'بعقوبة',
  'ذي قار',
  'الناصرية',
  'ميسان',
  'العمارة',
  'واسط',
  'الكوت',
  'المثنى',
  'السماوة',
  'القادسية',
  'الديوانية',
  'صلاح الدين',
  'تكريت',
  'اربيل',
  'السليمانية',
  'دهوك',
];

export function classifyIntakeSource(params: {
  fileName: string;
  mimeType?: string;
  fileCount?: number;
  isCameraBurst?: boolean;
}): {
  kind: UcrsSourceKind;
  label: string;
  supportsOfflineLocalParse: boolean;
} {
  if (params.isCameraBurst) {
    return {
      kind: 'camera_burst',
      label: 'لقطات كاميرا الدفتر اليدوي',
      supportsOfflineLocalParse: false,
    };
  }
  const lower = (params.fileName || '').toLowerCase();
  const mime = (params.mimeType || '').toLowerCase();
  const count = params.fileCount ?? 1;

  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    return { kind: 'pdf', label: 'مستند PDF', supportsOfflineLocalParse: false };
  }
  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    mime.includes('spreadsheet') ||
    mime.includes('ms-excel')
  ) {
    return { kind: 'excel', label: 'جدول Excel', supportsOfflineLocalParse: true };
  }
  if (lower.endsWith('.csv') || mime === 'text/csv') {
    return { kind: 'csv', label: 'ملف CSV', supportsOfflineLocalParse: true };
  }
  if (
    lower.endsWith('.docx') ||
    lower.endsWith('.doc') ||
    mime.includes('wordprocessingml')
  ) {
    return { kind: 'word', label: 'مستند Word', supportsOfflineLocalParse: true };
  }
  if (
    mime.startsWith('text/') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.json')
  ) {
    return { kind: 'text', label: 'ملف نصي', supportsOfflineLocalParse: true };
  }
  if (count > 1) {
    return {
      kind: 'image_batch',
      label: `حزمة صور (${count})`,
      supportsOfflineLocalParse: false,
    };
  }
  return {
    kind: 'image',
    label: 'صورة / لقطة شاشة',
    supportsOfflineLocalParse: false,
  };
}

export function buildDefaultReadingPlan(
  intent: UcrsReadingPlan['intent'],
  customCommand?: string
): UcrsReadingPlan {
  const byIntent: Record<
    UcrsReadingPlan['intent'],
    { willExtract: string[]; willIgnore: string[] }
  > = {
    discover: {
      willExtract: [
        'نوع المحتوى وموضوعه وجودته',
        'الأسماء والأرقام والتواريخ والأماكن المحتملة',
        'تقييم الفائدة والملاءمة لعملك',
      ],
      willIgnore: ['الزخارف والأطر والتواقيع المتكررة'],
    },
    extract_all: {
      willExtract: [
        'جميع الأسماء الكاملة',
        'عدد الأفراد',
        'النزول/النقصان والإضافة/الحذف',
        'الملاحظات والتواريخ المرافقة',
      ],
      willIgnore: ['الأرقام التسلسلية الهامشية', 'التواقيع والأختام'],
    },
    extract_useful: {
      willExtract: [
        'السجلات المطابقة لنمط الوكالات والمستفيدين فقط',
        'تغييرات الأفراد والحجب',
      ],
      willIgnore: ['البيانات الدعائية أو غير المرتبطة بالعمل'],
    },
    semantic_search: {
      willExtract: [
        'المطابقات الدلالية والضبابية لاستعلامك',
        'السياق المحيط وموقع الصفحة/السطر',
      ],
      willIgnore: ['الفقرات غير المرتبطة ببحثك'],
    },
    understand_book: {
      willExtract: [
        'ملخص الفكرة والموضوع الرئيسي',
        'الأسماء المرجعية والتواريخ والأماكن',
      ],
      willIgnore: ['الحشو الإملائي أو التكرار'],
    },
    focus_notes: {
      willExtract: ['الملاحظات، حالات التوصيل، وأسباب الحجب/التذكير فقط'],
      willIgnore: ['الأعمدة الرقمية الثانوية'],
    },
    custom: {
      willExtract: [
        customCommand?.trim()
          ? `تنفيذ الأمر: ${customCommand.trim()}`
          : 'استخراج موجّه حسب أمرك المخصص',
      ],
      willIgnore: ['أي عناصر خارج نطاق الأمر المحدد'],
    },
  };

  const chosen = byIntent[intent] || byIntent.extract_all;
  return {
    intent,
    customCommand,
    willExtract: chosen.willExtract,
    willIgnore: chosen.willIgnore,
    minCoverageThreshold: 90,
    autoApplyLearningRules: true,
    approved: false,
  };
}

export function judgeContentRelevance(params: {
  textSample: string;
  contentType: UcrsContentType;
  rowCount: number;
  customCommand?: string;
  knownPersons?: Person[];
}): {
  level: UcrsRelevanceLevel;
  reasons: string[];
  opinion: string;
} {
  const norm = normalizeArabic(params.textSample);
  const reasons: string[] = [];
  let score = 0;

  if (
    params.contentType === 'جدول مستفيدين' ||
    params.contentType === 'دفتر يدوي' ||
    params.contentType === 'قائمة أسماء'
  ) {
    score += 45;
    reasons.push(`نوع المحتوى (${params.contentType}) يطابق نمط سجلات الوكالات مباشرة.`);
  } else if (params.contentType === 'وثيقة رسمية') {
    score += 25;
    reasons.push('وثيقة رسمية قد تحتوي قرارات حجب أو نقل أو تعديل حصص.');
  } else if (params.contentType === 'فاتورة') {
    score -= 20;
    reasons.push('محتوى مالي/مشتريات لا يطابق جداول المستفيدين الأساسية.');
  }

  const matchedTerms = RELEVANCE_PATTERNS.filter((t) => norm.includes(t));
  if (matchedTerms.length >= 2) {
    score += 35;
    reasons.push(`يتضمن مصطلحات عملك الأساسية (${matchedTerms.slice(0, 4).join('، ')}).`);
  } else if (matchedTerms.length === 1) {
    score += 15;
    reasons.push(`يحتوي إشارة إلى (${matchedTerms[0]}).`);
  }

  if (params.knownPersons && params.knownPersons.length > 0 && norm.length > 4) {
    let nameOverlap = 0;
    for (const p of params.knownPersons.slice(0, 120)) {
      const firstTwo = normalizeArabic(p.name).split(' ').slice(0, 2).join(' ');
      if (firstTwo.length >= 5 && norm.includes(firstTwo)) {
        nameOverlap += 1;
      }
      if (nameOverlap >= 3) break;
    }
    if (nameOverlap > 0) {
      score += 30;
      reasons.push(`تمت مطابقة (${nameOverlap}+) أسماء مع سجلاتك الحالية في النظام.`);
    }
  }

  if (params.rowCount >= 3) {
    score += 20;
    reasons.push(`يرصد (${params.rowCount}) صفوف منظمة جاهزة للمعالجة.`);
  }

  if (params.customCommand?.trim()) {
    const cmdTokens = normalizeArabic(params.customCommand)
      .split(' ')
      .filter((w) => w.length >= 2);
    const hits = cmdTokens.filter((t) => norm.includes(t));
    if (hits.length > 0) {
      score += 25;
      reasons.push(`يطابق أمرك المخصص (${hits.join('، ')}).`);
    }
  }

  if (score >= 60) {
    return {
      level: 'important',
      reasons,
      opinion: 'هذا محتوى قيّم ويطابق عملك مباشرة. يُنصح باستخراجه ومراجعته بالكامل.',
    };
  }
  if (score >= 25) {
    return {
      level: 'useful',
      reasons: reasons.length
        ? reasons
        : ['يحتوي أسماء أو بيانات قد تفيدك كمرجع أو تدقيق لاحق.'],
      opinion: 'محتوى مفيد محتمل — يمكنك استخراج الأسماء أو البحث فيه أو حفظه كمرجع.',
    };
  }
  if (score >= 5) {
    return {
      level: 'neutral',
      reasons: reasons.length
        ? reasons
        : ['محتوى عام لا يرتبط مباشرة بجداول الوكالات لكنه قد يحوي معلومات مرجعية.'],
      opinion: 'محتوى محايد — استعرض ملخصه قبل تقرير الاستخراج أو التجاهل.',
    };
  }
  return {
    level: 'irrelevant',
    reasons: reasons.length
      ? reasons
      : ['لا يطابق أنماط جداول المستفيدين أو أوامرك المحفوظة.'],
    opinion: 'لا يبدو أن هذا المحتوى يخص عملك المباشر. يمكنك تجاهله أو البحث فيه فقط.',
  };
}

export function extractDatesAndLocationsFromText(text: string): {
  dates: string[];
  locations: string[];
} {
  const dateMatches =
    text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2}|19\d{2}|20\d{2})\b/g) ||
    [];
  const dates = Array.from(new Set(dateMatches)).slice(0, 12);
  const norm = normalizeArabic(text);
  const locations = IRAQI_LOCATION_HINTS.filter((loc) =>
    norm.includes(normalizeArabic(loc))
  );
  return { dates, locations };
}

export function buildIdentityFromParsedText(params: {
  fileName: string;
  rawText: string;
  rowsCount: number;
  colCount: number;
  knownPersons?: Person[];
  customCommand?: string;
}): UcrsContentIdentity {
  const cleanText = params.rawText.trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const norm = normalizeArabic(cleanText);

  let contentType: UcrsContentType = 'بيانات عامة';
  if (params.rowsCount >= 2 && params.colCount >= 2) {
    contentType = 'جدول مستفيدين';
  } else if (norm.includes('فاتورة') || norm.includes('المبلغ') || norm.includes('دينار')) {
    contentType = 'فاتورة';
  } else if (norm.includes('الفصل') || norm.includes('كتاب') || words.length > 140) {
    contentType = 'كتاب / مقال';
  } else if (norm.includes('مديرية') || norm.includes('كتاب رسمي') || norm.includes('المرقم')) {
    contentType = 'وثيقة رسمية';
  } else if (params.rowsCount >= 1) {
    contentType = 'قائمة أسماء';
  }

  const { dates, locations } = extractDatesAndLocationsFromText(cleanText);
  const relevance = judgeContentRelevance({
    textSample: cleanText.slice(0, 3000),
    contentType,
    rowCount: params.rowsCount,
    customCommand: params.customCommand,
    knownPersons: params.knownPersons,
  });

  const topic =
    contentType === 'جدول مستفيدين'
      ? `جدول مستفيدين وكميات (${params.fileName})`
      : contentType === 'فاتورة'
      ? `فاتورة / كشف حساب (${params.fileName})`
      : contentType === 'كتاب / مقال'
      ? `نص / مرجع مقروء (${params.fileName})`
      : `محتوى مستخرج من ${params.fileName}`;

  return {
    contentType,
    topic,
    qualityLabel: 'واضح',
    qualityScore: 96,
    relevanceLevel: relevance.level,
    relevanceReasons: relevance.reasons,
    languageSummary: /[a-zA-Z]{3,}/.test(cleanText)
      ? 'عربي + إنجليزي وأرقام'
      : 'عربي وأرقام',
    estimatedTotalRows: params.rowsCount,
    estimatedColumns: params.colCount,
    estimatedConfidentCount: params.rowsCount,
    estimatedDoubtfulCount: 0,
    estimatedUnreadableCount: 0,
    wordCount: words.length,
    detectedNamesCount: params.rowsCount,
    detectedDates: dates,
    detectedLocations: locations,
    opinionAndRecommendation: relevance.opinion,
    suggestedActions: [
      { id: 'act_all', label: 'استخراج كامل الجدول', intent: 'extract_all' },
      { id: 'act_useful', label: 'استخراج ما يفيدني فقط', intent: 'extract_useful' },
      { id: 'act_search', label: 'بحث دلالي في المحتوى', intent: 'semantic_search' },
    ],
  };
}

export function applyLearningRulesToName(
  rawName: string,
  rules: UcrsLearningRule[]
): {
  updatedName: string;
  appliedRules: UcrsLearningRule[];
} {
  let result = rawName;
  const applied: UcrsLearningRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled || !rule.wrongToken.trim()) continue;
    const escaped = rule.wrongToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g');
    if (regex.test(result)) {
      result = result.replace(regex, `$1${rule.correctedToken}`);
      applied.push(rule);
    }
  }
  return { updatedName: result.replace(/\s+/g, ' ').trim(), appliedRules: applied };
}

export function extractLearningRuleFromCorrection(params: {
  originalName: string;
  correctedName: string;
  sourceContext: string;
}): UcrsLearningRule | null {
  const origWords = params.originalName.trim().split(/\s+/).filter(Boolean);
  const corrWords = params.correctedName.trim().split(/\s+/).filter(Boolean);
  if (origWords.length === 0 || origWords.length !== corrWords.length) {
    return null;
  }

  for (let i = 0; i < origWords.length; i++) {
    if (origWords[i] !== corrWords[i] && origWords[i].length >= 2 && corrWords[i].length >= 2) {
      return {
        id: `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        wrongToken: origWords[i],
        correctedToken: corrWords[i],
        sourceContext: params.sourceContext || 'تصحيح يدوي من جلسة استخراج',
        usageCount: 1,
        createdAt: new Date().toISOString().slice(0, 10),
        enabled: true,
      };
    }
  }
  return null;
}

export function computeSmartCoverage(params: {
  rows: QuickExtractEvaluatedRow[];
  estimatedTotalItems?: number;
  unreadableCount?: number;
  pageCount?: number;
  coveredPages?: number;
  missingHint?: string;
}): UcrsSmartCoverage {
  const rows = params.rows || [];
  const totalEstimated = Math.max(
    rows.length + (params.unreadableCount ?? 0),
    params.estimatedTotalItems ?? 0
  );

  let confidentCount = 0;
  let doubtfulCount = 0;
  let explicitUnreadable = params.unreadableCount ?? 0;

  let nameFilled = 0;
  let indFilled = 0;
  let decFilled = 0;
  let addDelFilled = 0;
  let notesFilled = 0;

  for (const r of rows) {
    const isRowUnreadable =
      !r.resolvedName.trim() &&
      r.resolvedIndividuals === null &&
      r.nameConfidence < 0.35;
    if (isRowUnreadable) {
      explicitUnreadable += 1;
      continue;
    }

    const rowConfident =
      (!r.hasDoubt || r.doubtConfirmed) &&
      (r.mathIssues.length === 0 || r.mathConfirmed) &&
      r.isComplete;

    if (rowConfident) confidentCount += 1;
    else doubtfulCount += 1;

    if (r.resolvedName.trim()) nameFilled += 1;
    if (r.resolvedIndividuals !== null) indFilled += 1;
    if (r.resolvedDecreaseCount !== null) decFilled += 1;
    if (r.resolvedAddOrDeleteCount !== null) addDelFilled += 1;
    if ((r.notes || '').trim()) notesFilled += 1;
  }

  const denom = Math.max(1, totalEstimated);
  const overallPercent =
    totalEstimated === 0
      ? 0
      : Math.min(100, Math.round((confidentCount / denom) * 100));
  const itemsCoveragePercent =
    totalEstimated === 0
      ? 0
      : Math.min(
          100,
          Math.round(((confidentCount + doubtfulCount) / denom) * 100)
        );
  const contentCoveragePercent =
    (params.pageCount ?? 1) > 0
      ? Math.min(
          100,
          Math.round(
            ((params.coveredPages ?? params.pageCount ?? 1) /
              Math.max(1, params.pageCount ?? 1)) *
              100
          )
        )
      : 100;
  const qualityCoveragePercent =
    rows.length === 0
      ? 0
      : Math.round((confidentCount / Math.max(1, rows.length)) * 100);

  const rowDenom = Math.max(1, totalEstimated);
  const fieldsCoverage = {
    namePercent: totalEstimated === 0 ? 0 : Math.min(100, Math.round((nameFilled / rowDenom) * 100)),
    individualsPercent: totalEstimated === 0 ? 0 : Math.min(100, Math.round((indFilled / rowDenom) * 100)),
    decreasePercent: totalEstimated === 0 ? 0 : Math.min(100, Math.round((decFilled / rowDenom) * 100)),
    addOrDeletePercent: totalEstimated === 0 ? 0 : Math.min(100, Math.round((addDelFilled / rowDenom) * 100)),
    notesPercent: totalEstimated === 0 ? 0 : Math.min(100, Math.round((notesFilled / rowDenom) * 100)),
  };

  let missingHint = params.missingHint || '';
  if (!missingHint) {
    if (explicitUnreadable > 0) {
      missingHint = `لإكمال الـ${100 - overallPercent}% المتبقية: أضف صورة أوضح للأجزاء غير المقروءة (${explicitUnreadable} عناصر) أو قم بقصها يدويًا.`;
    } else if (doubtfulCount > 0) {
      missingHint = `بقي (${doubtfulCount}) عناصر مشكوكة — يمكنك مراجعتها وتأكيدها أو إضافة صورة أوضح لتغطية 100%.`;
    } else if (totalEstimated > 0 && overallPercent === 100) {
      missingHint = 'التغطية مكتملة 100% — جميع العناصر مقروءة بثقة عالية.';
    }
  }

  return {
    overallPercent,
    contentCoveragePercent,
    itemsCoveragePercent,
    fieldsCoverage,
    qualityCoveragePercent,
    totalEstimatedItems: totalEstimated,
    confidentCount,
    doubtfulCount,
    unreadableCount: explicitUnreadable,
    missingHint,
  };
}

export function buildCoverageRegionsFromRows(
  rows: QuickExtractEvaluatedRow[],
  extraUnreadableRegions: UcrsCoverageRegion[] = []
): UcrsCoverageRegion[] {
  const regions: UcrsCoverageRegion[] = [];
  for (const row of rows) {
    if (!row.suspectBox) continue;
    const isConfident =
      (!row.hasDoubt || row.doubtConfirmed) &&
      (row.mathIssues.length === 0 || row.mathConfirmed) &&
      row.isComplete;
    const isUnreadable =
      !row.resolvedName.trim() && row.nameConfidence < 0.35;

    regions.push({
      id: `cov_${row.id}`,
      pageNumber: row.pageNumber,
      label: row.resolvedName || `صف #${row.rowIndex}`,
      state: isUnreadable ? 'unreadable' : isConfident ? 'confident' : 'doubtful',
      box: row.suspectBox,
      extractedText: row.resolvedName || row.rawSnippet,
      reason: isConfident
        ? `مقروء بثقة ${Math.round(row.nameConfidence * 100)}%`
        : row.doubtReasons[0] || 'يحتاج مراجعة أو صورة أوضح',
    });
  }
  return [...regions, ...extraUnreadableRegions];
}

export function buildDiagnosticsForSession(params: {
  rows: QuickExtractEvaluatedRow[];
  identity?: UcrsContentIdentity | null;
  coverage?: UcrsSmartCoverage;
}): UcrsDiagnosticEntry[] {
  const entries: UcrsDiagnosticEntry[] = [];

  if (params.identity && params.identity.qualityScore < 75) {
    entries.push({
      id: 'diag_intake_quality',
      targetId: 'source',
      targetLabel: params.identity.topic,
      layer: 'intake',
      severity: params.identity.qualityScore < 55 ? 'critical' : 'warning',
      whyMessage: `جودة المصدر (${params.identity.qualityScore}% — ${params.identity.qualityLabel}) تؤثر على قراءة النقاط والأرقام الصغيرة.`,
      reasoningChain: [
        'فحص التباين والحدة البصرية في طبقة الاستقبال',
        `رصْد وضوح ${params.identity.qualityScore}% وتقدير ${params.identity.estimatedUnreadableCount} عناصر صعبة`,
      ],
      hypotheses: [
        {
          label: 'إضاءة جانبية أو ظل فوق جزء من الورقة',
          probability: 55,
          suggestedFix: 'أضف صورة مكمّلة للجزء المعتم فقط لدمجها بالجلسة.',
        },
        {
          label: 'تداخل خط اليد أو ضغط ملف PDF',
          probability: 45,
          suggestedFix: 'استخدم ميزة القص اليدوي للجزء غير المقروء أو فعّل النموذج المرجعي.',
        },
      ],
    });
  }

  for (const row of params.rows) {
    const hasNameDoubt = row.hasDoubt && !row.doubtConfirmed;
    const hasMathIssue = row.mathIssues.length > 0 && !row.mathConfirmed;
    if (!hasNameDoubt && !hasMathIssue && row.isComplete) continue;

    const hypotheses: UcrsDiagnosticEntry['hypotheses'] = [];
    if (row.suspectSegments.length > 0) {
      hypotheses.push({
        label: `التباس بصري في المقطع «${row.suspectSegments[0].word}» (${row.suspectSegments[0].reason})`,
        probability: 68,
        suggestedFix: 'طابق المقطع مع صورة القصاصة أو اختر المطابقة من شجرة الأسماء.',
      });
    }
    if (!row.isComplete) {
      hypotheses.push({
        label: `نقص في الحقول الإلزامية (${row.missingFields.join('، ')})`,
        probability: 80,
        suggestedFix: 'أكمل الحقول الناقصة يدويًا أو التقط صورة أوضح لنفس الصف.',
      });
    }
    if (hasMathIssue) {
      hypotheses.push({
        label: row.mathIssues[0],
        probability: 90,
        suggestedFix: 'تحقق من أرقام الأفراد والنزول والإضافة مقارنةً بالسجل.',
      });
    }
    if (hypotheses.length === 0) {
      hypotheses.push({
        label: 'انخفاض ثقة القراءة عن الحد الآمن',
        probability: 60,
        suggestedFix: 'راجع الصف وأكد صحته صراحةً.',
      });
    }

    entries.push({
      id: `diag_${row.id}`,
      targetId: row.id,
      targetLabel: row.resolvedName || `صف #${row.rowIndex}`,
      layer: hasMathIssue ? 'math' : 'extraction',
      severity: !row.isComplete || hasMathIssue ? 'critical' : 'warning',
      whyMessage:
        row.doubtReasons[0] ||
        row.mathIssues[0] ||
        `حقول ناقصة في الصف #${row.rowIndex}`,
      reasoningChain: [
        `فحص الصف #${row.rowIndex} (صفحة ${row.pageNumber})`,
        `ثقة الاسم: ${Math.round(row.nameConfidence * 100)}% · ثقة الأرقام: ${Math.round(row.numbersConfidence * 100)}%`,
        ...(row.doubtReasons.length ? row.doubtReasons : ['رصد نقص حقول أو تعارض حسابي']),
      ],
      hypotheses: hypotheses.sort((a, b) => b.probability - a.probability),
    });
  }

  return entries;
}

/**
 * Progressive Extraction Fusion: merges newly extracted rows/entities from a supplementary
 * image/PDF/source into an existing session without duplicating high-confidence records.
 */
export function mergeSupplementaryExtraction(params: {
  session: UcrsSession;
  sourceLabel: string;
  incomingRows: QuickExtractEvaluatedRow[];
  incomingEntities?: UcrsExtractedTextEntity[];
  incomingRegions?: UcrsCoverageRegion[];
  knownPersons?: Person[];
  learningRules?: UcrsLearningRule[];
  focusedFields?: QuickExtractFocusField[];
}): {
  updatedSession: UcrsSession;
  diff: UcrsFusionDiff;
} {
  const prevCoverage = params.session.coverage.overallPercent;
  const focus = params.focusedFields || ALL_QUICK_EXTRACT_FIELDS;
  const tree = buildArabicNameTree(params.knownPersons || []);
  const rules = params.learningRules || [];

  const mergedRows = [...params.session.rows];
  let newlyRecoveredCount = 0;
  let upgradedFromDoubtCount = 0;
  let duplicatesSkippedCount = 0;

  for (const rawIncoming of params.incomingRows) {
    const learned = applyLearningRulesToName(rawIncoming.resolvedName, rules);
    const incoming =
      learned.appliedRules.length > 0
        ? evaluateExtractedRow(
            {
              ...rawIncoming,
              name: learned.updatedName,
            },
            mergedRows.length,
            {
              sourceMode: rawIncoming.sourceMode,
              focusedFields: focus,
              tree,
              persons: params.knownPersons,
            }
          )
        : rawIncoming;

    const incomingNorm = normalizeArabic(incoming.resolvedName);
    if (!incomingNorm) continue;

    // Try matching existing row by normalized name or same rowIndex+pageNumber
    const existingIdx = mergedRows.findIndex((existing) => {
      const exNorm = normalizeArabic(existing.resolvedName);
      if (exNorm && exNorm === incomingNorm) return true;
      if (
        existing.pageNumber === incoming.pageNumber &&
        existing.rowIndex === incoming.rowIndex &&
        existing.hasDoubt &&
        !existing.doubtConfirmed
      ) {
        return true;
      }
      return false;
    });

    if (existingIdx === -1) {
      mergedRows.push({
        ...incoming,
        id: `${incoming.id}_f_${mergedRows.length}`,
      });
      newlyRecoveredCount += 1;
    } else {
      const existing = mergedRows[existingIdx];
      const existingConfident =
        (!existing.hasDoubt || existing.doubtConfirmed) && existing.isComplete;
      const incomingBetter =
        incoming.nameConfidence > existing.nameConfidence ||
        (!existing.isComplete && incoming.isComplete) ||
        (existing.hasDoubt && !incoming.hasDoubt);

      if (!existingConfident && incomingBetter) {
        mergedRows[existingIdx] = {
          ...incoming,
          id: existing.id,
          notes: incoming.notes || existing.notes,
        };
        upgradedFromDoubtCount += 1;
      } else {
        duplicatesSkippedCount += 1;
      }
    }
  }

  const prevEntities = params.session.entities || [];
  const mergedEntities = [...prevEntities];
  for (const ent of params.incomingEntities || []) {
    const entNorm = normalizeArabic(ent.text);
    if (!mergedEntities.some((e) => normalizeArabic(e.text) === entNorm && e.kind === ent.kind)) {
      mergedEntities.push(ent);
    }
  }

  const remainingUnreadable = Math.max(
    0,
    (params.session.identity?.estimatedTotalRows ?? mergedRows.length) -
      mergedRows.filter((r) => r.resolvedName.trim().length > 0).length
  );

  const nextCoverage = computeSmartCoverage({
    rows: mergedRows,
    estimatedTotalItems: Math.max(
      params.session.coverage.totalEstimatedItems,
      mergedRows.length
    ),
    unreadableCount: remainingUnreadable,
    pageCount: params.session.identity ? Math.max(1, params.session.sources.length) : 1,
  });

  const nextRegions = buildCoverageRegionsFromRows(
    mergedRows,
    params.incomingRegions || []
  );

  const summaryMessage =
    newlyRecoveredCount > 0 || upgradedFromDoubtCount > 0
      ? `تم دمج «${params.sourceLabel}»: استُخرج ${newlyRecoveredCount} سجلًا جديدًا، وتُحسن ${upgradedFromDoubtCount} سجلًا مشكوكًا، وتُجنب تكرار ${duplicatesSkippedCount}. ارتفعت التغطية من ${prevCoverage}% إلى ${nextCoverage.overallPercent}%.`
      : `تمت مقارنة «${params.sourceLabel}»: جميع السجلات الواضحة (${duplicatesSkippedCount}) موجودة مسبقًا ولم يتم تكرارها.`;

  const diff: UcrsFusionDiff = {
    addedAt: new Date().toISOString(),
    sourceLabel: params.sourceLabel,
    newlyRecoveredCount,
    upgradedFromDoubtCount,
    duplicatesSkippedCount,
    previousCoveragePercent: prevCoverage,
    newCoveragePercent: nextCoverage.overallPercent,
    remainingUnreadableCount: nextCoverage.unreadableCount,
    summaryMessage,
  };

  const nextDiagnostics = buildDiagnosticsForSession({
    rows: mergedRows,
    identity: params.session.identity,
    coverage: nextCoverage,
  });

  const nextStatus: UcrsSession['status'] =
    nextCoverage.overallPercent >= params.session.plan.minCoverageThreshold &&
    nextCoverage.doubtfulCount === 0 &&
    nextCoverage.unreadableCount === 0
      ? 'ready'
      : 'needs_completion';

  return {
    updatedSession: {
      ...params.session,
      updatedAt: new Date().toISOString(),
      status: nextStatus,
      rows: mergedRows,
      entities: mergedEntities,
      coverage: nextCoverage,
      coverageRegions: nextRegions,
      diagnostics: nextDiagnostics,
      lastFusionDiff: diff,
    },
    diff,
  };
}

function tinyLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function expandSemanticTerms(queryNorm: string): string[] {
  const expanded = new Set<string>();
  const words = queryNorm.split(/\s+/).filter(Boolean);
  for (const w of words) {
    expanded.add(w);
    for (const [root, synonyms] of Object.entries(SEMANTIC_SYNONYM_GROUPS)) {
      if (synonyms.some((s) => s === w || w.includes(s) || s.includes(w)) || root === w) {
        synonyms.forEach((s) => expanded.add(s));
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Semantic + Fuzzy + Numeric + Date Search across one or many UCRS sessions.
 */
export function runSemanticSearch(params: {
  query: string;
  sessions: UcrsSession[];
}): UcrsSemanticHit[] {
  const rawQuery = params.query.trim();
  if (!rawQuery) return [];

  const qNorm = normalizeArabic(rawQuery);
  const hits: UcrsSemanticHit[] = [];

  // Parse numeric queries like "> 5", "أكبر من 5", "بين 5 و 10"
  const rangeMatch = qNorm.match(/بين\s+(\d+)\s+و\s*(\d+)/);
  const gtMatch = qNorm.match(/(?:>|اكبر من|فوق)\s*(\d+)/);
  const ltMatch = qNorm.match(/(?:<|اصغر من|اقل من)\s*(\d+)/);
  const monthMatch = qNorm.match(/(?:شهر|تاريخ)\s*(\d{1,2}|20\d{2})/);

  const semanticTerms = expandSemanticTerms(qNorm);

  for (const session of params.sessions) {
    for (const row of session.rows) {
      const combinedText = [
        row.resolvedName,
        row.notes || '',
        row.rawSnippet || '',
        row.resolvedAddOrDeleteAction,
      ]
        .join(' ')
        .trim();
      const combinedNorm = normalizeArabic(combinedText);
      const numVal = row.resolvedIndividuals ?? 0;

      if (rangeMatch) {
        const low = Number(rangeMatch[1]);
        const high = Number(rangeMatch[2]);
        if (numVal >= low && numVal <= high) {
          hits.push({
            id: `hit_${session.id}_${row.id}`,
            sessionId: session.id,
            sessionTitle: session.title,
            sourceKind: 'row',
            rowId: row.id,
            matchedText: `${row.resolvedName} (${numVal} أفراد)`,
            context: `صف ${row.rowIndex} — النزول: ${row.resolvedDecreaseCount ?? 0} · ${row.resolvedAddOrDeleteAction}: ${row.resolvedAddOrDeleteCount ?? 0}`,
            pageNumber: row.pageNumber,
            rowOrLineIndex: row.rowIndex,
            confidence: row.numbersConfidence,
            matchKind: 'numeric',
            box: row.suspectBox,
            rowSnapshot: row,
          });
        }
        continue;
      }

      if (gtMatch) {
        const target = Number(gtMatch[1]);
        if (numVal > target) {
          hits.push({
            id: `hit_${session.id}_${row.id}`,
            sessionId: session.id,
            sessionTitle: session.title,
            sourceKind: 'row',
            rowId: row.id,
            matchedText: `${row.resolvedName} (${numVal} أفراد)`,
            context: `أكبر من ${target} · صف ${row.rowIndex}`,
            pageNumber: row.pageNumber,
            rowOrLineIndex: row.rowIndex,
            confidence: row.numbersConfidence,
            matchKind: 'numeric',
            box: row.suspectBox,
            rowSnapshot: row,
          });
        }
        continue;
      }

      if (ltMatch) {
        const target = Number(ltMatch[1]);
        if (numVal < target) {
          hits.push({
            id: `hit_${session.id}_${row.id}`,
            sessionId: session.id,
            sessionTitle: session.title,
            sourceKind: 'row',
            rowId: row.id,
            matchedText: `${row.resolvedName} (${numVal} أفراد)`,
            context: `أقل من ${target} · صف ${row.rowIndex}`,
            pageNumber: row.pageNumber,
            rowOrLineIndex: row.rowIndex,
            confidence: row.numbersConfidence,
            matchKind: 'numeric',
            box: row.suspectBox,
            rowSnapshot: row,
          });
        }
        continue;
      }

      // Exact match
      if (combinedNorm.includes(qNorm)) {
        hits.push({
          id: `hit_${session.id}_${row.id}`,
          sessionId: session.id,
          sessionTitle: session.title,
          sourceKind: 'row',
          rowId: row.id,
          matchedText: row.resolvedName || combinedText,
          context: `الأفراد: ${row.resolvedIndividuals ?? '—'} · ${row.notes || row.rawSnippet || 'مطابقة مباشرة'}`,
          pageNumber: row.pageNumber,
          rowOrLineIndex: row.rowIndex,
          confidence: row.nameConfidence,
          matchKind: 'exact',
          box: row.suspectBox,
          rowSnapshot: row,
        });
        continue;
      }

      // Semantic synonym match
      if (
        semanticTerms.some(
          (term) => term.length >= 3 && combinedNorm.includes(term)
        )
      ) {
        hits.push({
          id: `hit_${session.id}_${row.id}`,
          sessionId: session.id,
          sessionTitle: session.title,
          sourceKind: 'row',
          rowId: row.id,
          matchedText: row.resolvedName || combinedText,
          context: `مطابقة بالمعنى · ${row.notes || row.rawSnippet || row.resolvedAddOrDeleteAction}`,
          pageNumber: row.pageNumber,
          rowOrLineIndex: row.rowIndex,
          confidence: Math.min(0.95, row.nameConfidence),
          matchKind: 'semantic',
          box: row.suspectBox,
          rowSnapshot: row,
        });
        continue;
      }

      // Fuzzy token match (e.g. محمد vs محمذ or محمدًا)
      const tokens = combinedNorm.split(/\s+/).filter(Boolean);
      const qTokens = qNorm.split(/\s+/).filter((t) => t.length >= 3);
      const fuzzyMatched = qTokens.some((qt) =>
        tokens.some(
          (tok) =>
            Math.abs(tok.length - qt.length) <= 1 &&
            tinyLevenshtein(tok, qt) <= 1
        )
      );
      if (fuzzyMatched) {
        hits.push({
          id: `hit_${session.id}_${row.id}`,
          sessionId: session.id,
          sessionTitle: session.title,
          sourceKind: 'row',
          rowId: row.id,
          matchedText: row.resolvedName,
          context: `مطابقة ضبابية قريبة لإملاء «${rawQuery}» · صف ${row.rowIndex}`,
          pageNumber: row.pageNumber,
          rowOrLineIndex: row.rowIndex,
          confidence: Math.max(0.65, row.nameConfidence - 0.1),
          matchKind: 'fuzzy',
          box: row.suspectBox,
          rowSnapshot: row,
        });
      }
    }

    for (const ent of session.entities || []) {
      const entNorm = normalizeArabic(`${ent.text} ${ent.context}`);
      const isDateQuery = Boolean(monthMatch) && ent.kind === 'date';
      const dateMatched =
        isDateQuery && monthMatch
          ? entNorm.includes(monthMatch[1])
          : false;

      if (
        dateMatched ||
        entNorm.includes(qNorm) ||
        semanticTerms.some((t) => t.length >= 3 && entNorm.includes(t))
      ) {
        hits.push({
          id: `hit_${session.id}_${ent.id}`,
          sessionId: session.id,
          sessionTitle: session.title,
          sourceKind: 'entity',
          matchedText: ent.text,
          context: ent.context || ent.relevanceReason,
          pageNumber: ent.pageNumber,
          rowOrLineIndex: ent.rowOrLineIndex,
          confidence: ent.confidence,
          matchKind: dateMatched ? 'date' : entNorm.includes(qNorm) ? 'exact' : 'semantic',
          box: ent.box,
        });
      }
    }
  }

  return hits.sort((a, b) => b.confidence - a.confidence);
}

export function computeSessionStatistics(session: UcrsSession): UcrsSessionStatistics {
  const rows = session.rows || [];
  const entities = session.entities || [];
  const uniqueNames = new Set(
    rows.map((r) => normalizeArabic(r.resolvedName)).filter(Boolean)
  );
  const nums = rows
    .map((r) => r.resolvedIndividuals)
    .filter((v): v is number => v !== null && v >= 0);

  const avgIndividuals =
    nums.length > 0
      ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10
      : 0;

  return {
    totalRows: rows.length,
    totalEntities: entities.length,
    uniqueNamesCount: uniqueNames.size,
    numbersCount: nums.length,
    notesCount:
      rows.filter((r) => (r.notes || '').trim().length > 0).length +
      entities.filter((e) => e.kind === 'note').length,
    datesCount:
      (session.identity?.detectedDates.length ?? 0) +
      entities.filter((e) => e.kind === 'date').length,
    locationsCount:
      (session.identity?.detectedLocations.length ?? 0) +
      entities.filter((e) => e.kind === 'location').length,
    avgIndividuals,
    maxIndividuals: nums.length ? Math.max(...nums) : 0,
    minIndividuals: nums.length ? Math.min(...nums) : 0,
    totalAdditions: rows.reduce(
      (s, r) =>
        s +
        (r.resolvedAddOrDeleteAction === 'إضافة'
          ? r.resolvedAddOrDeleteCount ?? 0
          : 0),
      0
    ),
    totalDecreases: rows.reduce((s, r) => s + (r.resolvedDecreaseCount ?? 0), 0),
    totalDeletions: rows.reduce(
      (s, r) =>
        s +
        (r.resolvedAddOrDeleteAction === 'حذف'
          ? r.resolvedAddOrDeleteCount ?? 0
          : 0),
      0
    ),
  };
}

export function compareSessionWithRoster(
  session: UcrsSession,
  targetPersons: Person[]
): UcrsComparisonResult {
  const map = new Map<string, Person>();
  for (const p of targetPersons) {
    if (p.status === 'مؤرشف') continue;
    map.set(normalizeArabic(p.name), p);
  }

  let matchedInTargetCount = 0;
  let newOnlyCount = 0;
  let changedIndividualsCount = 0;
  const differences: UcrsComparisonResult['differences'] = [];

  for (const row of session.rows) {
    const norm = normalizeArabic(row.resolvedName);
    if (!norm) continue;
    const found = map.get(norm);
    const sessionVal = row.resolvedIndividuals;
    if (!found) {
      newOnlyCount += 1;
      differences.push({
        name: row.resolvedName,
        sessionValue: sessionVal,
        targetValue: null,
        kind: 'new',
      });
    } else {
      matchedInTargetCount += 1;
      if (
        sessionVal !== null &&
        found.individuals !== null &&
        sessionVal !== found.individuals
      ) {
        changedIndividualsCount += 1;
        differences.push({
          name: row.resolvedName,
          sessionValue: sessionVal,
          targetValue: found.individuals,
          kind: 'changed',
        });
      }
    }
  }

  const total = Math.max(1, session.rows.length);
  const similarityPercent = Math.round((matchedInTargetCount / total) * 100);
  return {
    similarityPercent,
    matchedInTargetCount,
    newOnlyCount,
    changedIndividualsCount,
    differences,
  };
}
