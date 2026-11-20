import type {
  Agency,
  Person,
  QuickExtractAnalysisResult,
  QuickExtractCaptureMode,
  QuickExtractDestinationSpec,
  QuickExtractEvaluatedRow,
  QuickExtractFocusField,
  QuickExtractMergeStrategy,
  QuickExtractRawRow,
  QuickExtractRoutingConfig,
  QuickExtractRoutingRule,
  QuickExtractScanMode,
  QuickExtractSuspectSegment,
  QuickExtractSuspectSpan,
  ReadyList,
  ReadyListItem,
} from '../types/agency.ts';
import { normalizeArabic } from './agencyLogic.ts';

export const MIN_ACCEPTABLE_CLARITY_SCORE = 55;
export const FAST_MODE_MIN_CLARITY_SCORE = 35;
export const NAME_CONFIDENCE_THRESHOLD = 0.92;
export const NUMBER_CONFIDENCE_THRESHOLD = 0.9;
export const ALL_QUICK_EXTRACT_FIELDS: QuickExtractFocusField[] = [
  'name',
  'individuals',
  'decreaseCount',
  'addOrDelete',
];

export function resolveFocusedFields(
  fields?: QuickExtractFocusField[]
): QuickExtractFocusField[] {
  if (!Array.isArray(fields) || fields.length === 0) {
    return ALL_QUICK_EXTRACT_FIELDS;
  }
  return Array.from(new Set(fields));
}

const GARBAGE_CHAR_REGEX = /[?*@#%^&~_=\\|<>{}\[\]؟!]/;
const DIGITS_INSIDE_NAME_REGEX = /[0-9٠-٩۰-۹]/;
const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;
const DOT_SENSITIVE_CHARS = new Set([
  'ب',
  'ت',
  'ث',
  'ن',
  'ي',
  'ى',
  'ج',
  'ح',
  'خ',
  'ذ',
  'ز',
  'ض',
  'ظ',
  'غ',
  'ف',
  'ق',
]);
const HAMZA_CHARS = new Set(['أ', 'إ', 'آ', 'ؤ', 'ئ', 'ء']);

const CORE_ARABIC_NAME_SEED = [
  'محمد',
  'علي',
  'حسن',
  'حسين',
  'كاظم',
  'جاسم',
  'عباس',
  'فاضل',
  'كريم',
  'مهدي',
  'صالح',
  'حيدر',
  'مصطفى',
  'سعد',
  'جبار',
  'رحيم',
  'شاكر',
  'خضير',
  'طالب',
  'ناصر',
  'منذر',
  'محمود',
  'ابراهيم',
  'اسماعيل',
  'سلمان',
  'داود',
  'جمعة',
  'شهاب',
  'عادل',
  'ستار',
  'رعد',
  'قاسم',
  'باسم',
  'هادي',
  'ياسين',
  'رسول',
  'موسى',
  'عيسى',
  'حمزة',
  'خالد',
  'طارق',
  'عمران',
  'احمد',
  'فلاح',
  'عبد',
  'الله',
  'الرحمن',
  'الامير',
  'الرضا',
  'الزهراء',
  'زهراء',
  'زينب',
  'فاطمة',
  'رقية',
  'مريم',
  'نور',
  'هدى',
  'سجاد',
  'باقر',
  'صادق',
  'جعفر',
  'علاء',
  'ضياء',
  'وسام',
  'مهند',
  'امجد',
  'ماجد',
  'حامد',
  'لطيف',
  'نعيم',
  'سليم',
  'داخل',
  'مطر',
  'عزيز',
  'مجيد',
  'عبدالله',
  'عبدالرحمن',
  'عبدالامير',
  'الحلو',
  'الموسوي',
  'التميمي',
  'الجبوري',
  'الشمري',
  'العامري',
  'الساعدي',
  'الخفاجي',
  'المالكي',
  'الربيعي',
  'الدليمي',
  'الكعبي',
];

export interface ArabicNameTree {
  knownTokens: Set<string>;
  bigramEdges: Map<string, Set<string>>;
  fullNormalizedNames: string[];
  originalNames: string[];
}

export function buildArabicNameTree(persons: Person[] = []): ArabicNameTree {
  const knownTokens = new Set<string>(
    CORE_ARABIC_NAME_SEED.map((w) => normalizeArabic(w))
  );
  const bigramEdges = new Map<string, Set<string>>();
  const fullNormalizedNames: string[] = [];
  const originalNames: string[] = [];

  for (const p of persons) {
    const raw = String(p.name || '').trim();
    const norm = normalizeArabic(raw);
    if (!norm) continue;
    fullNormalizedNames.push(norm);
    originalNames.push(raw);

    const words = norm.split(' ').filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.length >= 2) {
        knownTokens.add(w);
      }
      if (i + 1 < words.length) {
        const next = words[i + 1];
        if (!bigramEdges.has(w)) bigramEdges.set(w, new Set());
        bigramEdges.get(w)!.add(next);
      }
    }
  }

  return {
    knownTokens,
    bigramEdges,
    fullNormalizedNames,
    originalNames,
  };
}

function editDistance(a: string, b: string): number {
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
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

export function decomposeArabicNameGlyphs(name: string): {
  words: string[];
  dotHeavyWords: string[];
  hamzaWords: string[];
  corruptedSegments: Array<{ word: string; wordIndex: number; reason: string }>;
} {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const dotHeavyWords: string[] = [];
  const hamzaWords: string[] = [];
  const corruptedSegments: Array<{
    word: string;
    wordIndex: number;
    reason: string;
  }> = [];

  words.forEach((word, wordIndex) => {
    const chars = Array.from(word);
    const dotCount = chars.filter((c) => DOT_SENSITIVE_CHARS.has(c)).length;
    if (dotCount >= 3) {
      dotHeavyWords.push(word);
    }
    if (chars.some((c) => HAMZA_CHARS.has(c))) {
      hamzaWords.push(word);
    }

    if (GARBAGE_CHAR_REGEX.test(word)) {
      corruptedSegments.push({
        word,
        wordIndex,
        reason: 'رموز غير مقروءة أو علامات تشويش داخل المقطع',
      });
    } else if (DIGITS_INSIDE_NAME_REGEX.test(word)) {
      corruptedSegments.push({
        word,
        wordIndex,
        reason: 'تداخل أرقام داخل الكلمة بدل الحروف',
      });
    } else if (!ARABIC_CHAR_REGEX.test(word)) {
      corruptedSegments.push({
        word,
        wordIndex,
        reason: 'مقطع لا يحتوي على حروف عربية واضحة',
      });
    } else if (chars.length === 1) {
      corruptedSegments.push({
        word,
        wordIndex,
        reason: 'حرف منفرد مبتور (احتمال فقدان بقية الكلمة)',
      });
    } else if (/(.)\1{2,}/.test(word)) {
      corruptedSegments.push({
        word,
        wordIndex,
        reason: 'تكرار غير طبيعي في الحرف ناتج عن سحبة قلم أو تشويش',
      });
    }
  });

  return { words, dotHeavyWords, hamzaWords, corruptedSegments };
}

export function analyzeArabicNameAgainstTree(params: {
  name: string;
  tree: ArabicNameTree;
  suspectSpans?: QuickExtractSuspectSpan[];
  nameConfidence?: number;
  modelDoubtFlag?: boolean;
  modelDoubtReason?: string;
}): {
  suspectSegments: QuickExtractSuspectSegment[];
  suggestedNames: string[];
  treeNotes: string[];
} {
  const trimmed = String(params.name || '').trim();
  if (!trimmed) {
    return { suspectSegments: [], suggestedNames: [], treeNotes: [] };
  }

  const glyph = decomposeArabicNameGlyphs(trimmed);
  const suspectMap = new Map<number, QuickExtractSuspectSegment>();
  const treeNotes: string[] = [];

  const attachSegment = (
    wordIndex: number,
    word: string,
    reason: string,
    explicitChars?: string[]
  ) => {
    const chars =
      explicitChars && explicitChars.length > 0
        ? explicitChars
        : Array.from(word).filter(
            (c) =>
              GARBAGE_CHAR_REGEX.test(c) ||
              DIGITS_INSIDE_NAME_REGEX.test(c) ||
              DOT_SENSITIVE_CHARS.has(c) ||
              HAMZA_CHARS.has(c)
          );
    const existing = suspectMap.get(wordIndex);
    if (existing) {
      if (!existing.reason.includes(reason)) {
        existing.reason = `${existing.reason} · ${reason}`;
      }
      existing.uncertainChars = Array.from(
        new Set([...existing.uncertainChars, ...chars])
      );
    } else {
      suspectMap.set(wordIndex, {
        word,
        wordIndex,
        uncertainChars: chars.length > 0 ? chars : Array.from(word),
        reason,
      });
    }
  };

  // 1. Structural glyph corruption
  for (const seg of glyph.corruptedSegments) {
    attachSegment(seg.wordIndex, seg.word, seg.reason);
  }

  // 2. Explicit suspect spans flagged by Vision / OCR
  if (Array.isArray(params.suspectSpans)) {
    for (const span of params.suspectSpans) {
      const spanNorm = normalizeArabic(span.word);
      if (!spanNorm) continue;
      let matchedAny = false;
      glyph.words.forEach((w, idx) => {
        const wNorm = normalizeArabic(w);
        if (wNorm === spanNorm || wNorm.includes(spanNorm) || spanNorm.includes(wNorm)) {
          attachSegment(idx, w, span.reason || 'حروف غير مؤكدة بصريًا');
          matchedAny = true;
        }
      });
      if (!matchedAny && glyph.words.length > 0) {
        attachSegment(0, glyph.words[0], span.reason || 'مقطع غير مؤكد بصريًا');
      }
    }
  }

  // 3. Tree prefix / token validation against Agency & Arabic lexicon
  const shouldInspectTokensTightly =
    (params.nameConfidence ?? 1) < NAME_CONFIDENCE_THRESHOLD ||
    Boolean(params.modelDoubtFlag) ||
    glyph.corruptedSegments.length > 0;

  glyph.words.forEach((word, wordIndex) => {
    const norm = normalizeArabic(word);
    if (!norm || suspectMap.has(wordIndex)) return;

    // Very near miss (edit distance 1) to a known Arabic/agency token when confidence isn't 100%
    if (norm.length >= 3 && !params.tree.knownTokens.has(norm)) {
      let nearestToken = '';
      for (const known of params.tree.knownTokens) {
        if (Math.abs(known.length - norm.length) <= 1 && editDistance(norm, known) === 1) {
          nearestToken = known;
          break;
        }
      }
      if (nearestToken && shouldInspectTokensTightly) {
        attachSegment(
          wordIndex,
          word,
          `تشابه حروف مع الاسم الشائع «${nearestToken}» (تحقق من النقاط والهمزة)`
        );
        treeNotes.push(`الكلمة «${word}» قريبة إملائيًا من «${nearestToken}».`);
      } else if (
        shouldInspectTokensTightly &&
        (glyph.dotHeavyWords.includes(word) || glyph.hamzaWords.includes(word))
      ) {
        attachSegment(
          wordIndex,
          word,
          'مقطع كثيف النقاط/الهمزات مع انخفاض ثقة القراءة'
        );
      }
    }
  });

  // 4. If modelDoubtFlag or low confidence is set yet no single word was isolated, mark whole tail/unclear words
  if (
    suspectMap.size === 0 &&
    ((params.nameConfidence ?? 1) < NAME_CONFIDENCE_THRESHOLD || params.modelDoubtFlag)
  ) {
    glyph.words.forEach((w, idx) => {
      if (idx === glyph.words.length - 1 || glyph.dotHeavyWords.includes(w)) {
        attachSegment(
          idx,
          w,
          params.modelDoubtReason?.trim() || 'انخفاض نسبة الثقة في قراءة المقطع'
        );
      }
    });
    if (suspectMap.size === 0 && glyph.words.length > 0) {
      attachSegment(
        0,
        glyph.words[0],
        params.modelDoubtReason?.trim() || 'تأكيد بصري مطلوب للاسم'
      );
    }
  }

  // 5. Suggest closest known full names from agency roster tree (top 3)
  const normFull = normalizeArabic(trimmed);
  const scoredSuggestions: Array<{ name: string; score: number }> = [];
  if (normFull.length >= 3) {
    const inputTokens = normFull.split(' ').filter(Boolean);
    for (let i = 0; i < params.tree.fullNormalizedNames.length; i++) {
      const candNorm = params.tree.fullNormalizedNames[i];
      if (candNorm === normFull) {
        scoredSuggestions.push({
          name: params.tree.originalNames[i],
          score: 100,
        });
        continue;
      }
      const candTokens = candNorm.split(' ').filter(Boolean);
      const shared = inputTokens.filter((t) =>
        candTokens.some((ct) => ct === t || (t.length >= 3 && editDistance(t, ct) <= 1))
      ).length;
      if (shared >= Math.min(2, inputTokens.length)) {
        const dist = editDistance(normFull, candNorm);
        const score = shared * 25 - dist;
        if (score > 10) {
          scoredSuggestions.push({
            name: params.tree.originalNames[i],
            score,
          });
        }
      }
    }
  }

  const suggestedNames = Array.from(
    new Set(
      scoredSuggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.name)
    )
  );

  return {
    suspectSegments: Array.from(suspectMap.values()).sort(
      (a, b) => a.wordIndex - b.wordIndex
    ),
    suggestedNames,
    treeNotes,
  };
}

export function evaluateExtractedName(
  name: string | null | undefined,
  confidence: number,
  modelDoubtFlag: boolean,
  modelDoubtReason: string,
  tree?: ArabicNameTree,
  suspectSpans?: QuickExtractSuspectSpan[]
): {
  hasDoubt: boolean;
  reasons: string[];
  suspectSegments: QuickExtractSuspectSegment[];
} {
  const reasons: string[] = [];
  const trimmed = String(name || '').trim();

  if (!trimmed) {
    return { hasDoubt: false, reasons: [], suspectSegments: [] };
  }

  if (modelDoubtFlag) {
    reasons.push(
      modelDoubtReason.trim() || 'رصد المحلل البصري عدم يقين في وضوح الحروف'
    );
  }
  if (confidence < NAME_CONFIDENCE_THRESHOLD) {
    reasons.push(
      `نسبة الثقة في قراءة الاسم منخفضة (${Math.round(confidence * 100)}%)`
    );
  }
  if (GARBAGE_CHAR_REGEX.test(trimmed)) {
    reasons.push('يحتوي الاسم على رموز غير مفهومة ناتجة عن تشويش القراءة');
  }
  if (DIGITS_INSIDE_NAME_REGEX.test(trimmed)) {
    reasons.push('تداخل أرقام داخل خانة الاسم (احتمال اختلاط خلايا الجدول)');
  }
  if (!ARABIC_CHAR_REGEX.test(trimmed)) {
    reasons.push('الاسم لا يحتوي على أحرف عربية واضحة');
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2 || trimmed.length < 5) {
    reasons.push('الاسم قصير جدًا أو مبتور (أقل من اسم ثنائي واضح)');
  }

  if (/(.)\1{3,}/.test(trimmed)) {
    reasons.push('تكرار غير طبيعي في الحروف يشير إلى تشويش بصري');
  }

  const activeTree = tree || buildArabicNameTree([]);
  const treeAnalysis = analyzeArabicNameAgainstTree({
    name: trimmed,
    tree: activeTree,
    suspectSpans,
    nameConfidence: confidence,
    modelDoubtFlag,
    modelDoubtReason,
  });

  for (const n of treeAnalysis.treeNotes) {
    if (!reasons.includes(n)) reasons.push(n);
  }

  return {
    hasDoubt: reasons.length > 0 || treeAnalysis.suspectSegments.length > 0,
    reasons,
    suspectSegments: treeAnalysis.suspectSegments,
  };
}

export function auditExtractedRowMath(
  row: Pick<
    QuickExtractEvaluatedRow,
    | 'resolvedName'
    | 'resolvedIndividuals'
    | 'resolvedDecreaseCount'
    | 'resolvedAddOrDeleteCount'
    | 'resolvedAddOrDeleteAction'
  >,
  matchedPerson?: Person | null,
  focusedFields: QuickExtractFocusField[] = ALL_QUICK_EXTRACT_FIELDS
): string[] {
  const focusSet = new Set(resolveFocusedFields(focusedFields));
  if (!focusSet.has('individuals')) {
    return [];
  }

  const issues: string[] = [];
  const base = row.resolvedIndividuals;
  const dec = focusSet.has('decreaseCount') ? row.resolvedDecreaseCount : null;
  const addDel = focusSet.has('addOrDelete')
    ? row.resolvedAddOrDeleteCount
    : null;
  const action = focusSet.has('addOrDelete')
    ? row.resolvedAddOrDeleteAction
    : 'لا يوجد';

  const isInt = (v: number | null): v is number =>
    v !== null && Number.isInteger(v) && v >= 0;

  if (focusSet.has('decreaseCount') && isInt(base) && isInt(dec) && dec > base) {
    issues.push(
      `عدد النزول/النقصان (${dec}) أكبر من عدد الأفراد الأساسي (${base})`
    );
  }

  if (
    focusSet.has('addOrDelete') &&
    isInt(addDel) &&
    addDel > 0 &&
    action === 'لا يوجد'
  ) {
    issues.push(
      `تم تسجيل قيمة (${addDel}) في خانة الإضافة/الحذف دون تحديد نوع الإجراء (إضافة أم حذف)`
    );
  }

  if (
    focusSet.has('addOrDelete') &&
    isInt(base) &&
    isInt(addDel) &&
    action === 'حذف' &&
    addDel > base
  ) {
    issues.push(
      `عدد الحذف (${addDel}) أكبر من عدد الأفراد الأساسي (${base})`
    );
  }

  if (
    focusSet.has('decreaseCount') &&
    focusSet.has('addOrDelete') &&
    isInt(base) &&
    isInt(dec) &&
    isInt(addDel) &&
    action === 'حذف' &&
    dec + addDel > base
  ) {
    issues.push(
      `مجموع النزول (${dec}) والحذف (${addDel}) يتجاوز إجمالي الأفراد (${base})`
    );
  }

  if (
    base === 0 &&
    ((focusSet.has('decreaseCount') && (dec ?? 0) > 0) ||
      (focusSet.has('addOrDelete') && action === 'حذف' && (addDel ?? 0) > 0))
  ) {
    issues.push('عدد الأفراد الأساسي صفر رغم وجود عملية نقصان أو حذف');
  }

  if (
    matchedPerson &&
    matchedPerson.individuals !== null &&
    isInt(base)
  ) {
    const net =
      base +
      (action === 'إضافة' ? addDel ?? 0 : 0) -
      (dec ?? 0) -
      (action === 'حذف' ? addDel ?? 0 : 0);
    const diff = Math.abs(net - matchedPerson.individuals);
    if (diff >= 6) {
      issues.push(
        `فارق رقمي كبير عن المسجل حاليًا في النظام (${matchedPerson.individuals} ← ${net}، بفارق ${diff} أنفار)`
      );
    }
  }

  return issues;
}

export function evaluateExtractedRow(
  raw: QuickExtractRawRow,
  index: number,
  options?: {
    sourceMode?: QuickExtractCaptureMode;
    scanMode?: QuickExtractScanMode;
    focusedFields?: QuickExtractFocusField[];
    tree?: ArabicNameTree;
    persons?: Person[];
  }
): QuickExtractEvaluatedRow {
  const focus = resolveFocusedFields(options?.focusedFields);
  const focusSet = new Set(focus);
  const scanMode: QuickExtractScanMode = options?.scanMode || 'audit';

  const activeTree =
    options?.tree ||
    (options?.persons ? buildArabicNameTree(options.persons) : buildArabicNameTree([]));

  const nameEval = focusSet.has('name')
    ? evaluateExtractedName(
        raw.name,
        raw.nameConfidence,
        raw.modelDoubtFlag,
        raw.modelDoubtReason,
        activeTree,
        raw.suspectSpans
      )
    : { hasDoubt: false, reasons: [], suspectSegments: [] };

  let doubtReasons = [...nameEval.reasons];
  let suspectSegments = [...nameEval.suspectSegments];
  const missingFields: QuickExtractEvaluatedRow['missingFields'] = [];

  const cleanName = String(raw.name || '').trim();
  if (focusSet.has('name') && !cleanName) {
    missingFields.push('name');
  }

  const isValidInt = (v: number | null | undefined): v is number =>
    v !== null && v !== undefined && Number.isInteger(v) && v >= 0;

  if (focusSet.has('individuals') && !isValidInt(raw.individuals)) {
    missingFields.push('individuals');
  }
  if (focusSet.has('decreaseCount') && !isValidInt(raw.decreaseCount)) {
    missingFields.push('decreaseCount');
  }
  if (focusSet.has('addOrDelete') && !isValidInt(raw.addOrDeleteCount)) {
    missingFields.push('addOrDeleteCount');
  }

  const hasNumericFocus =
    focusSet.has('individuals') ||
    focusSet.has('decreaseCount') ||
    focusSet.has('addOrDelete');

  if (
    scanMode === 'audit' &&
    hasNumericFocus &&
    raw.numbersConfidence < NUMBER_CONFIDENCE_THRESHOLD
  ) {
    doubtReasons.push(
      `ثقة الأرقام غير مكتملة (${Math.round(raw.numbersConfidence * 100)}%) — يُرجى مطابقتها`
    );
  }

  // Fast Mode bypasses minor confidence nudges unless severe corruption exists
  if (scanMode === 'fast') {
    const glyph = decomposeArabicNameGlyphs(cleanName);
    const hasSevereNameCorruption = glyph.corruptedSegments.length > 0;
    if (!hasSevereNameCorruption && raw.nameConfidence >= 0.72) {
      doubtReasons = [];
      suspectSegments = [];
    }
  }

  const resolvedAction: QuickExtractEvaluatedRow['resolvedAddOrDeleteAction'] =
    !focusSet.has('addOrDelete')
      ? 'لا يوجد'
      : raw.addOrDeleteAction === 'إضافة' ||
        raw.addOrDeleteAction === 'حذف' ||
        raw.addOrDeleteAction === 'لا يوجد'
      ? raw.addOrDeleteAction
      : (raw.addOrDeleteCount ?? 0) > 0
      ? 'إضافة'
      : 'لا يوجد';

  const resolvedRowBase = {
    resolvedName: cleanName,
    resolvedIndividuals: focusSet.has('individuals')
      ? isValidInt(raw.individuals)
        ? raw.individuals
        : null
      : 0,
    resolvedDecreaseCount: focusSet.has('decreaseCount')
      ? isValidInt(raw.decreaseCount)
        ? raw.decreaseCount
        : null
      : 0,
    resolvedAddOrDeleteCount: focusSet.has('addOrDelete')
      ? isValidInt(raw.addOrDeleteCount)
        ? raw.addOrDeleteCount
        : null
      : 0,
    resolvedAddOrDeleteAction: resolvedAction,
  };

  const matched =
    cleanName && options?.persons
      ? findExistingMatchInAgency(cleanName, options.persons)
      : null;

  const mathIssues =
    scanMode === 'fast'
      ? []
      : auditExtractedRowMath(resolvedRowBase, matched, focus);

  const rowHasDoubt = doubtReasons.length > 0 || suspectSegments.length > 0;

  return {
    ...raw,
    id: `qe_${raw.pageNumber}_${raw.rowIndex}_${index}`,
    sourceMode: options?.sourceMode || 'pdf',
    hasDoubt: rowHasDoubt,
    doubtReasons,
    doubtConfirmed: !rowHasDoubt,
    suspectSegments,
    mathIssues,
    mathConfirmed: mathIssues.length === 0,
    missingFields,
    isComplete: missingFields.length === 0,
    ...resolvedRowBase,
    notes: '',
  };
}

export function recomputeRowValidation(
  row: QuickExtractEvaluatedRow,
  options?: {
    tree?: ArabicNameTree;
    persons?: Person[];
    resetConfirmOnNameEdit?: boolean;
    focusedFields?: QuickExtractFocusField[];
    scanMode?: QuickExtractScanMode;
  }
): QuickExtractEvaluatedRow {
  const focus = resolveFocusedFields(options?.focusedFields);
  const focusSet = new Set(focus);
  const scanMode: QuickExtractScanMode = options?.scanMode || 'audit';

  const missingFields: QuickExtractEvaluatedRow['missingFields'] = [];
  if (focusSet.has('name') && !row.resolvedName.trim()) {
    missingFields.push('name');
  }

  const isInt = (v: number | null) =>
    v !== null && Number.isInteger(v) && v >= 0;
  if (focusSet.has('individuals') && !isInt(row.resolvedIndividuals)) {
    missingFields.push('individuals');
  }
  if (focusSet.has('decreaseCount') && !isInt(row.resolvedDecreaseCount)) {
    missingFields.push('decreaseCount');
  }
  if (focusSet.has('addOrDelete') && !isInt(row.resolvedAddOrDeleteCount)) {
    missingFields.push('addOrDeleteCount');
  }

  const matched =
    row.resolvedName.trim() && options?.persons
      ? findExistingMatchInAgency(row.resolvedName, options.persons)
      : null;

  const mathIssues =
    scanMode === 'fast'
      ? []
      : auditExtractedRowMath(row, matched, focus);

  let suspectSegments = row.suspectSegments;
  let doubtReasons = row.doubtReasons;
  let hasDoubt = row.hasDoubt;
  let doubtConfirmed = row.doubtConfirmed;

  let nameConfidence = row.nameConfidence;
  let modelDoubtFlag = row.modelDoubtFlag;
  let modelDoubtReason = row.modelDoubtReason;
  let suspectSpans = row.suspectSpans;

  if (options?.resetConfirmOnNameEdit) {
    const activeTree =
      options.tree ||
      (options.persons ? buildArabicNameTree(options.persons) : undefined);
    const reEval = evaluateExtractedName(
      row.resolvedName,
      1, // user explicitly selected a verified suggestion
      false,
      '',
      activeTree
    );
    nameConfidence = 1;
    modelDoubtFlag = false;
    modelDoubtReason = '';
    suspectSpans = [];
    suspectSegments = reEval.suspectSegments;
    doubtReasons =
      reEval.reasons.length > 0
        ? reEval.reasons
        : ['تم اختيار المطابقة — اضغط «اعتماد وتأكيد الصف» للتأكيد النهائي'];
    hasDoubt = row.hasDoubt || reEval.hasDoubt;
    doubtConfirmed = false;
  }

  return {
    ...row,
    nameConfidence,
    modelDoubtFlag,
    modelDoubtReason,
    suspectSpans,
    missingFields,
    isComplete: missingFields.length === 0,
    mathIssues,
    mathConfirmed: mathIssues.length === 0 ? true : row.mathConfirmed,
    suspectSegments,
    doubtReasons,
    hasDoubt,
    doubtConfirmed,
  };
}

export function buildSafeQuickExtractResult(params: {
  sourceMode?: QuickExtractCaptureMode;
  scanMode?: QuickExtractScanMode;
  focusedFields?: QuickExtractFocusField[];
  clarityThreshold?: number;
  clarityScore: number;
  legibilityStatus: 'clear' | 'needs_review' | 'rejected';
  pageCount: number;
  rejectionReasons: string[];
  documentSummary: string;
  rawRows: QuickExtractRawRow[];
  persons?: Person[];
}): QuickExtractAnalysisResult {
  const sourceMode = params.sourceMode || 'pdf';
  const scanMode: QuickExtractScanMode = params.scanMode || 'audit';
  const focusedFields = resolveFocusedFields(params.focusedFields);
  const threshold =
    scanMode === 'fast'
      ? Math.min(params.clarityThreshold ?? MIN_ACCEPTABLE_CLARITY_SCORE, FAST_MODE_MIN_CLARITY_SCORE)
      : params.clarityThreshold ?? MIN_ACCEPTABLE_CLARITY_SCORE;

  const reasons = [...params.rejectionReasons];
  const score = Math.max(0, Math.min(100, Math.round(params.clarityScore)));

  if (score < threshold && reasons.length === 0) {
    reasons.push(
      `درجة وضوح ${
        sourceMode === 'camera_burst' ? 'اللقطات' : 'الملف'
      } (${score}%) أقل من الحد الآمن المطلوب (${threshold}%) لقراءة الجداول العربية دون أخطاء.`
    );
  }

  const shouldReject =
    params.legibilityStatus === 'rejected' ||
    score < threshold ||
    (params.rawRows.length === 0 && reasons.length === 0);

  if (params.rawRows.length === 0 && !shouldReject) {
    reasons.push('لم يتم العثور على صفوف جدول قابلة للاستخراج في المستند.');
  }

  if (shouldReject || params.rawRows.length === 0) {
    return {
      status: 'rejected',
      sourceMode,
      scanMode,
      focusedFields,
      clarityScore: score,
      pageCount: params.pageCount,
      rejectionReasons:
        reasons.length > 0
          ? reasons
          : ['المستند غير واضح أو تالف ولا يمكن ضمان دقة الاستخراج منه.'],
      documentSummary: params.documentSummary || '',
      rows: [],
    };
  }

  const tree = buildArabicNameTree(params.persons || []);
  const evaluatedRows = params.rawRows.map((r, i) =>
    evaluateExtractedRow(r, i, {
      sourceMode,
      scanMode,
      focusedFields,
      tree,
      persons: params.persons,
    })
  );
  const hasAnyDoubtOrMissing = evaluatedRows.some(
    (r) =>
      (r.hasDoubt && !r.doubtConfirmed) ||
      !r.isComplete ||
      (r.mathIssues.length > 0 && !r.mathConfirmed)
  );

  return {
    status: hasAnyDoubtOrMissing ? 'needs_review' : 'clear',
    sourceMode,
    scanMode,
    focusedFields,
    clarityScore: score,
    pageCount: params.pageCount,
    rejectionReasons: [],
    documentSummary: params.documentSummary || '',
    rows: evaluatedRows,
  };
}

export function computeAdjustedIndividuals(row: QuickExtractEvaluatedRow): {
  finalIndividuals: number;
  netDelta: number;
  adjustmentNote: string;
} {
  const base = row.resolvedIndividuals ?? 0;
  const dec = row.resolvedDecreaseCount ?? 0;
  const addDel = row.resolvedAddOrDeleteCount ?? 0;
  const add = row.resolvedAddOrDeleteAction === 'إضافة' ? addDel : 0;
  const del = row.resolvedAddOrDeleteAction === 'حذف' ? addDel : 0;

  const netDelta = add - dec - del;
  const finalIndividuals = Math.max(0, base + netDelta);

  const parts: string[] = [];
  if (dec > 0) parts.push(`نزول/نقصان: ${dec}`);
  if (add > 0) parts.push(`إضافة: ${add}`);
  if (del > 0) parts.push(`حذف: ${del}`);

  const sourceTag =
    row.sourceMode === 'camera_burst' ? 'سحب بالكاميرا' : 'سحب سريع PDF';

  const baseNote = parts.length
    ? `${sourceTag} (${parts.join(' | ')})`
    : sourceTag;

  return {
    finalIndividuals,
    netDelta,
    adjustmentNote: row.notes?.trim()
      ? `${row.notes.trim()} · ${baseNote}`
      : baseNote,
  };
}

export function findExistingMatchInAgency(
  name: string,
  targetPersons: Person[]
): Person | null {
  const target = normalizeArabic(name);
  if (!target) return null;
  return (
    targetPersons.find(
      (p) => p.status !== 'مؤرشف' && normalizeArabic(p.name) === target
    ) || null
  );
}

export interface QuickExtractPlannedRowAction {
  row: QuickExtractEvaluatedRow;
  destination: QuickExtractDestinationSpec;
  destinationLabel: string;
  actionType: 'add_new' | 'update_matched' | 'replace' | 'skip_unmatched';
  mergeStrategy: QuickExtractMergeStrategy;
  matchedRuleLabel?: string;
  isOverridden?: boolean;
  matchedPerson: Person | null;
  finalIndividuals: number;
  adjustmentNote: string;
  bucketKey: string;
}

export function describeDestinationSpec(
  spec: QuickExtractDestinationSpec,
  agencies: Agency[],
  readyLists: ReadyList[] = []
): string {
  if (spec.kind === 'master_roster') {
    return 'السجل الشامل (مطابقة كل وكالة)';
  }
  if (spec.kind === 'existing_ready_list') {
    const found = readyLists.find((l) => l.id === spec.existingReadyListId);
    return found
      ? `قائمة محددة: ${found.name}`
      : 'قائمة جاهزة محددة';
  }
  if (spec.kind === 'ready_list') {
    return `قائمة جديدة: ${spec.readyListMeta.name || 'قائمة مستخرجة'}`;
  }
  const ag = agencies.find((a) => a.id === spec.agencyId);
  return ag ? `${ag.icon} ${ag.name}` : 'الوكالة المختارة';
}

export function classifyRowChangeCategory(
  row: QuickExtractEvaluatedRow
): 'addition' | 'decrease' | 'unchanged' {
  const dec = row.resolvedDecreaseCount ?? 0;
  const addDel = row.resolvedAddOrDeleteCount ?? 0;
  if (row.resolvedAddOrDeleteAction === 'إضافة' && addDel > 0) {
    return 'addition';
  }
  if (dec > 0 || (row.resolvedAddOrDeleteAction === 'حذف' && addDel > 0)) {
    return 'decrease';
  }
  return 'unchanged';
}

export function evaluateRoutingRuleCondition(
  row: QuickExtractEvaluatedRow,
  rule: QuickExtractRoutingRule,
  persons: Person[]
): boolean {
  if (!rule.enabled) return false;
  const dec = row.resolvedDecreaseCount ?? 0;
  const addDel = row.resolvedAddOrDeleteCount ?? 0;
  const calc = computeAdjustedIndividuals(row);

  switch (rule.condition) {
    case 'has_addition':
      return row.resolvedAddOrDeleteAction === 'إضافة' && addDel > 0;
    case 'has_decrease':
      return dec > 0;
    case 'has_deletion':
      return row.resolvedAddOrDeleteAction === 'حذف' && addDel > 0;
    case 'name_contains': {
      const q = normalizeArabic(rule.textValue || '');
      return Boolean(q) && normalizeArabic(row.resolvedName).includes(q);
    }
    case 'individuals_gte':
      return calc.finalIndividuals >= (rule.numberValue ?? 0);
    case 'individuals_lte':
      return calc.finalIndividuals <= (rule.numberValue ?? 0);
    case 'matched_existing':
      return findExistingMatchInAgency(row.resolvedName, persons) !== null;
    case 'unmatched_new':
      return findExistingMatchInAgency(row.resolvedName, persons) === null;
    default:
      return false;
  }
}

export function computeQuickExtractRoutingPlan(params: {
  rows: QuickExtractEvaluatedRow[];
  routing: QuickExtractRoutingConfig;
  agencies: Agency[];
  persons: Person[];
  readyLists?: ReadyList[];
  readyListItems?: ReadyListItem[];
}): {
  items: QuickExtractPlannedRowAction[];
  counts: { add: number; update: number; replace: number; skip: number };
} {
  const {
    rows,
    routing,
    agencies,
    persons,
    readyLists = [],
    readyListItems = [],
  } = params;
  const items: QuickExtractPlannedRowAction[] = [];
  let add = 0;
  let update = 0;
  let replace = 0;
  let skip = 0;

  const destinationKey = (spec: QuickExtractDestinationSpec): string => {
    if (spec.kind === 'master_roster') return 'master_roster';
    if (spec.kind === 'existing_ready_list') {
      return `existing_ready_list:${spec.existingReadyListId || 0}`;
    }
    if (spec.kind === 'ready_list') {
      return `ready_list:${spec.agencyId}:${spec.readyListMeta.name}:${spec.readyListMeta.listDate}`;
    }
    return `agency:${spec.agencyId}`;
  };

  for (const row of rows) {
    const rowOverride = routing.rowOverrides?.[row.id];
    const calc = computeAdjustedIndividuals(row);

    if (rowOverride?.excluded) {
      skip += 1;
      items.push({
        row,
        destination: routing.primaryDestination,
        destinationLabel: 'مستبعد من الترحيل',
        actionType: 'skip_unmatched',
        mergeStrategy: routing.mergeStrategy,
        isOverridden: true,
        matchedPerson: null,
        finalIndividuals: calc.finalIndividuals,
        adjustmentNote: calc.adjustmentNote,
        bucketKey: 'excluded',
      });
      continue;
    }

    let dest: QuickExtractDestinationSpec = routing.primaryDestination;
    let strategy: QuickExtractMergeStrategy =
      routing.primaryDestination.mergeStrategy || routing.mergeStrategy;
    let matchedRuleLabel: string | undefined;

    if (routing.mode === 'custom_rules') {
      const matchedRule = (routing.customRules || []).find((rule) =>
        evaluateRoutingRuleCondition(row, rule, persons)
      );
      if (matchedRule) {
        dest = matchedRule.destination;
        strategy = matchedRule.mergeStrategy;
        matchedRuleLabel = matchedRule.label;
      } else {
        dest = routing.primaryDestination;
        strategy =
          routing.primaryDestination.mergeStrategy || routing.mergeStrategy;
      }
    } else if (routing.mode === 'split_by_change') {
      const cat = classifyRowChangeCategory(row);
      if (cat === 'addition') {
        dest = routing.additionsDestination;
        strategy =
          routing.additionsDestination.mergeStrategy || routing.mergeStrategy;
      } else if (cat === 'decrease') {
        dest = routing.decreasesDestination;
        strategy =
          routing.decreasesDestination.mergeStrategy || routing.mergeStrategy;
      } else {
        dest = routing.primaryDestination;
        strategy =
          routing.primaryDestination.mergeStrategy || routing.mergeStrategy;
      }
    } else {
      dest = routing.primaryDestination;
      strategy = routing.mergeStrategy;
    }

    if (rowOverride?.destination) {
      dest = rowOverride.destination;
    }
    if (rowOverride?.mergeStrategy) {
      strategy = rowOverride.mergeStrategy;
    }

    const scopePersons =
      dest.kind === 'master_roster'
        ? persons
        : persons.filter((p) => p.agencyId === dest.agencyId);

    const matchedPerson = findExistingMatchInAgency(
      row.resolvedName,
      scopePersons
    );

    let actionType: QuickExtractPlannedRowAction['actionType'];
    if (dest.kind === 'existing_ready_list') {
      const listId = dest.existingReadyListId;
      const existsInList =
        Boolean(listId) &&
        readyListItems.some(
          (it) =>
            it.listId === listId &&
            normalizeArabic(it.name) === normalizeArabic(row.resolvedName)
        );
      if (strategy === 'replace') {
        actionType = 'replace';
      } else if (strategy === 'update_matched' && existsInList) {
        actionType = 'update_matched';
      } else {
        actionType = 'add_new';
      }
    } else if (dest.kind === 'ready_list') {
      actionType = strategy === 'replace' ? 'replace' : 'add_new';
    } else if (strategy === 'replace') {
      actionType = 'replace';
    } else if (strategy === 'add_new') {
      actionType = 'add_new';
    } else {
      actionType = matchedPerson ? 'update_matched' : 'add_new';
    }

    if (actionType === 'add_new') add += 1;
    else if (actionType === 'update_matched') update += 1;
    else if (actionType === 'replace') replace += 1;
    else skip += 1;

    items.push({
      row,
      destination: dest,
      destinationLabel: describeDestinationSpec(dest, agencies, readyLists),
      actionType,
      mergeStrategy: strategy,
      matchedRuleLabel,
      isOverridden: Boolean(rowOverride),
      matchedPerson,
      finalIndividuals: calc.finalIndividuals,
      adjustmentNote: calc.adjustmentNote,
      bucketKey: destinationKey(dest),
    });
  }

  return { items, counts: { add, update, replace, skip } };
}
