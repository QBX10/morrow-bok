import type { Agency, AppDatabaseState, AppView, Person } from '../types/agency.ts';
import type {
  AssistantChoiceChip,
  AssistantConversationMemory,
  AssistantMessage,
  AssistantSlotSession,
  AssistantSmartSuggestion,
  AssistantToolCall,
  AssistantUiContext,
} from '../types/assistant.ts';
import {
  computeAgencyMetrics,
  formatIqd,
  formatTotalQuota,
  normalizeArabic,
} from './agencyLogic.ts';
import { runAppDiagnostics } from './assistantDiagnostics.ts';
import {
  findKnowledgeEntry,
  formatKnowledgeAnswer,
} from './assistantKnowledgeBase.ts';
import {
  convertArabicIndicDigits,
  enforceSafeArabicTerminology,
  normalizeIraqiDialect,
} from './assistantPrivacy.ts';
import { buildBeforeAfterDiff } from './assistantTools.ts';

/**
 * Simple Levenshtein distance for Iraqi/Arabic typo tolerance.
 */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

function fuzzyHasToken(norm: string, targets: string[], maxDist = 1): boolean {
  const tokens = norm.split(' ').filter((t) => t.length >= 3);
  for (const tok of tokens) {
    for (const target of targets) {
      if (tok === target) return true;
      if (Math.abs(tok.length - target.length) <= maxDist && target.length >= 4) {
        if (editDistance(tok, target) <= maxDist) return true;
      }
    }
  }
  return false;
}

export function fuzzyMatchPersons(
  query: string,
  persons: Person[],
  agencyId?: number | null
): Array<{ person: Person; score: number }> {
  const qNorm = normalizeArabic(convertArabicIndicDigits(query));
  if (!qNorm) return [];
  const qTokens = qNorm.split(' ').filter((t) => t.length >= 2);
  const pool =
    agencyId && agencyId > 0
      ? persons.filter((p) => p.agencyId === agencyId)
      : persons;

  const scored: Array<{ person: Person; score: number }> = [];
  for (const p of pool) {
    const pNorm = normalizeArabic(p.name);
    let score = 0;
    if (pNorm === qNorm) score += 100;
    else if (pNorm.startsWith(qNorm)) score += 75;
    else if (pNorm.includes(qNorm)) score += 60;

    if (p.nationalId && p.nationalId.includes(qNorm)) score += 85;

    const pTokens = pNorm.split(' ');
    for (const qt of qTokens) {
      if (pTokens.some((pt) => pt === qt)) {
        score += 22;
      } else if (pTokens.some((pt) => pt.startsWith(qt))) {
        score += 14;
      } else if (qt.length >= 3) {
        const minEd = Math.min(...pTokens.map((pt) => editDistance(qt, pt)));
        if (minEd <= 1) score += 12;
      }
    }

    if (score >= 12) {
      scored.push({ person: p, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function matchAgencyInText(
  text: string,
  agencies: Agency[]
): Agency | null {
  const norm = normalizeIraqiDialect(text);
  if (!norm) return null;

  for (const ag of agencies) {
    const agNorm = normalizeIraqiDialect(ag.name);
    const shortWords = agNorm
      .replace(/^وكاله\s+/, '')
      .split(' ')
      .filter((w) => w.length >= 3);
    if (norm.includes(agNorm)) return ag;
    if (shortWords.some((w) => norm.includes(w))) return ag;
  }

  if (/(الاولى|اولى|وكاله 1|رقم 1|اول وكاله)/.test(norm) && agencies[0]) {
    return agencies[0];
  }
  if (/(الثانيه|ثانيه|وكاله 2|رقم 2|ثاني وكاله)/.test(norm) && agencies[1]) {
    return agencies[1];
  }
  if (/(الثالثه|ثالثه|وكاله 3|رقم 3|ثالث وكاله)/.test(norm) && agencies[2]) {
    return agencies[2];
  }
  return null;
}

function extractFirstNumber(text: string): number | null {
  const clean = convertArabicIndicDigits(text);
  const m = clean.match(/\b(\d{1,7})\b/);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  const norm = normalizeIraqiDialect(text);
  if (/(?:^|\s)(?:فردين|اثنين|ثنين)(?=\s|$)/.test(norm)) return 2;
  if (/(?:^|\s)(?:فرد واحد|واحد)(?=\s|$)/.test(norm)) return 1;
  if (/(?:^|\s)(?:ثلاثه|ثلاث)(?=\s|$)/.test(norm)) return 3;
  if (/(?:^|\s)(?:اربعه|اربع)(?=\s|$)/.test(norm)) return 4;
  if (/(?:^|\s)(?:خمسه|خمس)(?=\s|$)/.test(norm)) return 5;
  if (/(?:^|\s)(?:سته|ست)(?=\s|$)/.test(norm)) return 6;
  return null;
}

function extractNameFromAddCommand(raw: string): string {
  const clean = enforceSafeArabicTerminology(convertArabicIndicDigits(raw))
    .replace(
      /^(?:ضي+فلي|ضفلي|ضي+ف|ضف|سجلي|سجل|خليلي|خلي|نزلي|نزل|اضف|إضافة|اضافة|دخلي|دخل|اكتبلي|ثبتلي)\s+/i,
      ''
    )
    .replace(/(?:^|\s)(?:اسم|مستفيد|عائلة|سجل)(?=\s|$)/g, ' ')
    .replace(/(?:لـ|ل|إلى|الى|في|بـ)?\s*وكالة\s+[^\s]+(?:\s+[^\s]+)?/g, ' ')
    .replace(/(?:^|\s)(?:الأولى|الاولى|الثانية|الثانيه|الثالثة|الثالثه)(?=\s|$)/g, ' ')
    .replace(/(?:^|\s)\d+\s*(?:أفراد|افراد|فرد)?(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean;
}

function extractSearchQuery(raw: string): string {
  return enforceSafeArabicTerminology(convertArabicIndicDigits(raw))
    .replace(
      /^(?:دورلي|دور|ابح[ثس]لي|ابح[ثس] عن|ابح[ثس]|شوفلي|شوف|وينه|وين|طلعلي|طلع|لقالي|ابحث بالاسم|جيبلي|فتشلي|فتش|لكيلي|اندل)\s+/i,
      ''
    )
    .replace(/(?:في|بـ|من)?\s*وكالة\s+[^\s]+(?:\s+[^\s]+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMPOUND_ACTION_VERBS =
  '(?:اطبع|طبع|صدر|ابح[ثس]|دور|شوف|افح[صس]|فحص|شيك|احسب|احصائيات|افتح|روح|انتقل|وديني|اعرض|ارشف|احذف|امسح|شيل|عدل|غير|بدل|ضيف|ضف|سجل|اضف|احجب|رتب|فلتر|نسخه|تقرير)';

/**
 * Splits compound Iraqi sentences into sub-commands, e.g.:
 * - "ضيف علي وحسن واطبع تقرير" -> ["ضيف علي", "ضيف حسن", "اطبع تقرير"]
 * - "ابحث عن علي ثم افحص التطبيق" -> ["ابحث عن علي", "افحص التطبيق"]
 */
export function splitCompoundCommands(rawPrompt: string): string[] {
  const clean = enforceSafeArabicTerminology(convertArabicIndicDigits(rawPrompt))
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];

  // 1. Split on explicit sequential connectors (" ثم ", " وبعدين ", " وبعدها ", "،", ",")
  const primaryChunks = clean
    .split(/\s*(?:،|,|(?:^|\s)(?:ثم|وبعدين|بعدين|وبعدها)(?=\s|$))\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);

  // 2. Further split on " و<verb>" where a new action starts after conjunction
  const verbSplitRe = new RegExp(`\\s+و(?=${COMPOUND_ACTION_VERBS}(?=\\s|$))`, 'g');
  const stepChunks: string[] = [];
  for (const chunk of primaryChunks) {
    const parts = chunk
      .split(verbSplitRe)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      // 3. Handle multi-person add: "ضيف علي وحسن" or "ضيف علي و حسن 4 أفراد"
      const multiAddMatch = part.match(
        /^(ضيفلي|ضفلي|ضيف|ضف|سجلي|سجل|اضف)\s+(.+)$/i
      );
      if (multiAddMatch) {
        const verb = multiAddMatch[1];
        const rest = multiAddMatch[2];
        // Split names joined with " و" or " و " (leading space prevents breaking names like "ابو علي")
        const peopleParts = rest
          .split(/\s+و\s*/g)
          .map((p) => p.trim())
          .filter((p) => p.length >= 2);
        if (
          peopleParts.length >= 2 &&
          peopleParts.length <= 5 &&
          peopleParts.every((p) => p.split(' ').length <= 4)
        ) {
          for (const personChunk of peopleParts) {
            stepChunks.push(`${verb} ${personChunk}`);
          }
          continue;
        }
      }
      stepChunks.push(part);
    }
  }

  return stepChunks.filter((s) => s.length >= 2);
}

/**
 * Generates contextual quick suggestions tailored to the currently opened screen.
 */
export function getScreenAwareSuggestions(
  activeView: AppView,
  focusedPersonName?: string,
  memory?: AssistantConversationMemory
): AssistantSmartSuggestion[] {
  const targetName = focusedPersonName || memory?.lastPersonName;
  const targetRefChip: AssistantSmartSuggestion | null = targetName
    ? {
        id: 'sug_context_edit',
        label: `تعديل ${targetName.split(' ')[0]}`,
        prompt: 'عدله 5 أفراد',
      }
    : null;

  switch (activeView) {
    case 'agency_roster':
    case 'master_roster':
      return [
        ...(targetRefChip ? [targetRefChip] : []),
        { id: 'sug_sort_ind', label: 'رتب بالأكثر أفراد', prompt: 'رتب الجدول حسب الأكثر أفراد' },
        { id: 'sug_filter_blk', label: 'اعرض المحجوبين', prompt: 'فلتر المحجوبين فقط' },
        { id: 'sug_export_xls', label: 'تقرير إكسل معزول', prompt: 'صدر تقرير اكسل' },
        { id: 'sug_dups', label: 'كشف المكررين', prompt: 'المكررين' },
      ].slice(0, 4);

    case 'finance':
      return [
        { id: 'sug_fin_stats', label: 'ملخص الأرباح', prompt: 'احسب صافي الربح لكل الوكالات' },
        { id: 'sug_fin_exp', label: 'سجّل أجور عمال', prompt: 'سجل مصروف أجور عمال 25000' },
        { id: 'sug_fin_xls', label: 'تقرير مالي إكسل', prompt: 'صدر تقرير مالي اكسل' },
        { id: 'sug_fin_chk', label: 'فحص الحسابات', prompt: 'افحص التطبيق' },
      ];

    case 'ready_lists':
      return [
        { id: 'sug_rl_exp', label: 'تصدير القائمة إكسل', prompt: 'صدر القائمة الجاهزة اكسل' },
        { id: 'sug_rl_txt', label: 'تصدير نص واتساب', prompt: 'صدر القائمة الجاهزة نص' },
        { id: 'sug_rl_how', label: 'شرح القوائم', prompt: 'وريني القوائم الجاهزة' },
        { id: 'sug_rl_chk', label: 'فحص السجلات', prompt: 'افحص التطبيق' },
      ];

    case 'quick_extract':
      return [
        { id: 'sug_qe_guide', label: 'كيف أستخدم السحب؟', prompt: 'وريني السحب السريع' },
        { id: 'sug_qe_master', label: 'افتح السجل الشامل', prompt: 'افتح السجل الشامل' },
        { id: 'sug_qe_chk', label: 'فحص التكرارات', prompt: 'المكررين' },
      ];

    case 'data_archives':
      return [
        { id: 'sug_arc_now', label: 'أرشف الحصة الحالية', prompt: 'ارشف الحصة الحالية' },
        { id: 'sug_arc_bak', label: 'نسخة احتياطية JSON', prompt: 'نسخة احتياطية json' },
        { id: 'sug_arc_stats', label: 'إحصائيات التوزيع', prompt: 'احصائيات جميع الوكالات' },
      ];

    default:
      return [
        { id: 'sug_hub_stats', label: 'إحصائيات شاملة', prompt: 'كم كيس وصافي الربح للجميع؟' },
        { id: 'sug_hub_chk', label: 'فحص سلامة البيانات', prompt: 'افحص التطبيق' },
        { id: 'sug_hub_xls', label: 'تقرير إكسل سريع', prompt: 'صدر تقرير اكسل' },
        { id: 'sug_hub_bak', label: 'نسخة احتياطية', prompt: 'نسخة احتياطية json' },
      ];
  }
}

export interface OfflineBrainOutcome {
  handled: boolean;
  confidence: number;
  needsClarification?: boolean;
  wantsUndo?: boolean;
  canUseCloudInAuto?: boolean;
  stealthAutoExecute?: boolean;
  autoCloseChat?: boolean;
  replyText: string;
  gracefulLevel: 'A' | 'B' | 'C';
  toolCall?: AssistantToolCall;
  nextSlotSession?: AssistantSlotSession | null;
  choices?: AssistantChoiceChip[];
  confirmationDiff?: ReturnType<typeof buildBeforeAfterDiff>;
  spotlightAction?: AssistantMessage['spotlightAction'];
  diagnosticsReport?: ReturnType<typeof runAppDiagnostics>;
  needsCloudReason?: string;
  memoryPatch?: Partial<AssistantConversationMemory>;
  compoundSteps?: OfflineBrainOutcome[];
}

export function continueSlotSession(
  slot: AssistantSlotSession,
  userAnswer: string,
  state: AppDatabaseState,
  uiContext: AssistantUiContext
): OfflineBrainOutcome {
  const args = { ...slot.collectedArgs };
  const norm = normalizeIraqiDialect(userAnswer);

  if (norm === 'الغاء' || norm === 'إلغاء' || norm === 'توقف' || norm === 'بطلت') {
    return {
      handled: true,
      confidence: 0.99,
      gracefulLevel: 'A',
      replyText: 'تمام، ألغيت الخطوة الحالية. تقدر تبدأ طلب جديد بأي وقت.',
      nextSlotSession: null,
    };
  }

  if (slot.missingSlot === 'agencyId') {
    const matchedAg =
      matchAgencyInText(userAnswer, state.agencies) ||
      state.agencies.find((a) => String(a.id) === convertArabicIndicDigits(userAnswer).trim());
    if (!matchedAg) {
      return {
        handled: true,
        confidence: 0.55,
        needsClarification: true,
        gracefulLevel: 'B',
        replyText: 'ما حددت الوكالة بعد. اختر واحدة من الوكالات التالية:',
        nextSlotSession: slot,
        choices: state.agencies.map((ag) => ({
          id: `slot_ag_${ag.id}`,
          label: `${ag.icon} ${ag.name}`,
          actionType: 'slot_answer',
          payload: { agencyId: ag.id },
        })),
      };
    }
    args.agencyId = matchedAg.id;

    if (slot.intent === 'add_person' && args.individuals === undefined) {
      return {
        handled: true,
        confidence: 0.9,
        gracefulLevel: 'A',
        replyText: `اخترت ${matchedAg.name}. كم عدد الأفراد لهذه العائلة؟`,
        nextSlotSession: {
          ...slot,
          collectedArgs: args,
          missingSlot: 'individuals',
        },
        memoryPatch: { lastAgencyId: matchedAg.id },
        choices: [2, 3, 4, 5, 6, 7, 8].map((n) => ({
          id: `slot_ind_${n}`,
          label: `${n} أفراد`,
          actionType: 'slot_answer',
          payload: { individuals: n },
        })),
      };
    }
  }

  if (slot.missingSlot === 'individuals') {
    const num = extractFirstNumber(userAnswer);
    if (num === null || num < 0 || num > 50) {
      return {
        handled: true,
        confidence: 0.5,
        needsClarification: true,
        gracefulLevel: 'B',
        replyText: 'اكتب عدد الأفراد بالأرقام (مثال: 5) أو اختر من الأزرار:',
        nextSlotSession: slot,
        choices: [2, 3, 4, 5, 6, 7, 8].map((n) => ({
          id: `slot_ind_${n}`,
          label: `${n} أفراد`,
          actionType: 'slot_answer',
          payload: { individuals: n },
        })),
      };
    }
    args.individuals = num;
  }

  if (slot.intent === 'add_person') {
    const toolCall: AssistantToolCall = { name: 'add_person', args };
    const diff = buildBeforeAfterDiff(state, toolCall, uiContext.focusedPersonId);
    return {
      handled: true,
      confidence: 0.96,
      gracefulLevel: 'A',
      replyText: 'جهّزت تفاصيل الإضافة. راجع بطاقة «قبل ← بعد» واضغط موافق للحفظ:',
      toolCall,
      confirmationDiff: diff,
      nextSlotSession: null,
      memoryPatch: {
        lastPersonName: String(args.name || ''),
        lastAgencyId: Number(args.agencyId) || undefined,
        lastIntent: 'add_person',
      },
    };
  }

  return {
    handled: false,
    confidence: 0.3,
    canUseCloudInAuto: true,
    gracefulLevel: 'C',
    replyText: 'احتجت تفاصيل أكثر لإكمال الطلب.',
    nextSlotSession: null,
  };
}

function runSingleOfflineClause(params: {
  prompt: string;
  state: AppDatabaseState;
  uiContext: AssistantUiContext;
  memory?: AssistantConversationMemory;
}): OfflineBrainOutcome {
  const { prompt, state, uiContext, memory } = params;
  const rawFixed = enforceSafeArabicTerminology(prompt.trim());
  const norm = normalizeIraqiDialect(rawFixed);

  if (!norm) {
    return {
      handled: true,
      confidence: 0.4,
      needsClarification: true,
      gracefulLevel: 'B',
      replyText: 'اكتب طلبك أو اختر أحد الأزرار السريعة بالأعلى.',
    };
  }

  // 0. Instant Undo command ("تراجع" / "رجع آخر عملية")
  if (/^(?:تراجع|رجع|الغي اخر عمليه|رجعني)$/.test(norm) || /(تراجع عن اخر|الغي التعديل الاخير)/.test(norm)) {
    return {
      handled: true,
      confidence: 0.98,
      wantsUndo: true,
      gracefulLevel: 'A',
      replyText: 'تم تنفيذ التراجع عن آخر عملية مسجلة.',
    };
  }

  // Detect tasks specifically needing Cloud Gemini in Auto mode (summarization, copywriting, open-ended advice)
  if (
    /^(?:لخص|ملخص|اكتب رساله|صيغ رساله|جهز رساله|اقترح|ما رايك|شنو رايك|نصحني|انصحني)(?=\s|$)/.test(
      norm
    )
  ) {
    return {
      handled: false,
      confidence: 0.25,
      canUseCloudInAuto: true,
      gracefulLevel: 'C',
      replyText: 'هذا الطلب يحتاج صياغة أو تلخيص ذكي عبر نموذج Gemini السحابي.',
      needsCloudReason: 'generative_reasoning_required',
    };
  }

  // 1. User Memory Preferences (Hide Amount, Hide Status, Hide Notes in Reports)
  if (
    /(اخفي|لا تخلي|احذف|شيل|بدون).*(المبلغ|السعر|مبلغ|سعر|الفلوس)/.test(norm) ||
    /تفضيل.*اخفاء.*(مبلغ|سعر)/.test(norm)
  ) {
    return {
      handled: true,
      confidence: 0.96,
      gracefulLevel: 'A',
      replyText:
        'حفظت القاعدة في الذاكرة: «دائماً أخفي المبلغ في التقارير» — ستُطبق تلقائياً على جميع تقارير PDF وExcel.',
      toolCall: {
        name: 'update_settings',
        args: {
          action: 'save_pref',
          key: 'hide_amount_in_reports',
          label: 'دائماً أخفي المبلغ في التقارير',
          value: 'true',
        },
      },
      memoryPatch: { lastIntent: 'update_settings' },
    };
  }

  if (
    /(اخفي|لا تخلي|احذف|شيل|بدون).*(عمود الحالة|الحاله|الحالة)/.test(norm) ||
    /تفضيل.*اخفاء.*حاله/.test(norm)
  ) {
    return {
      handled: true,
      confidence: 0.96,
      gracefulLevel: 'A',
      replyText:
        'حفظت القاعدة في الذاكرة: «دائماً أخفي عمود الحالة في التقارير» — ستُطبق تلقائياً على جميع تقارير PDF وExcel.',
      toolCall: {
        name: 'update_settings',
        args: {
          action: 'save_pref',
          key: 'hide_status_in_reports',
          label: 'دائماً أخفي عمود الحالة في التقارير',
          value: 'true',
        },
      },
      memoryPatch: { lastIntent: 'update_settings' },
    };
  }

  if (/(اخفي|لا تخلي|احذف|شيل|بدون).*(الملاحظات|ملاحظات)/.test(norm)) {
    return {
      handled: true,
      confidence: 0.94,
      gracefulLevel: 'A',
      replyText:
        'حفظت القاعدة في الذاكرة: «دائماً أخفي الملاحظات في التقارير».',
      toolCall: {
        name: 'update_settings',
        args: {
          action: 'save_pref',
          key: 'hide_notes_in_reports',
          label: 'دائماً أخفي الملاحظات في التقارير',
          value: 'true',
        },
      },
      memoryPatch: { lastIntent: 'update_settings' },
    };
  }

  // 1.5 Semantic Intent Analyzer: Anomaly Detection ("الرقم غريب" / "اكو رقم غلط" / "أرقام غريبة")
  if (
    /(الرقم غريب|رقم غريب|ارقام غريبه|رقم غلط|العدد غلط|افراد غلط|عدد مو طبيعي|رقم مشكوك|شاذ|اشك بالرقم|ارقام شاذه)/.test(
      norm
    )
  ) {
    const report = runAppDiagnostics(state, uiContext.lastBackupAt);
    const numIssues = report.issues.filter(
      (i) => i.category === 'invalid_individuals' || i.category === 'calculation_mismatch'
    );
    const firstAnomalyPersonId = numIssues.find((i) => i.personId)?.personId;
    const firstAnomalyPerson = firstAnomalyPersonId
      ? state.persons.find((p) => p.id === firstAnomalyPersonId)
      : undefined;

    if (numIssues.length === 0) {
      return {
        handled: true,
        confidence: 0.94,
        stealthAutoExecute: true,
        gracefulLevel: 'A',
        replyText:
          'فحصت جميع أرقام الأفراد والحصص فوراً: لا توجد أرقام غريبة أو غير منطقية في السجلات الحالية.',
        diagnosticsReport: report,
        memoryPatch: { lastIntent: 'run_diagnostics' },
      };
    }

    return {
      handled: true,
      confidence: 0.96,
      stealthAutoExecute: true,
      gracefulLevel: 'A',
      replyText: `تم رصد ${numIssues.length} حالة رقم أفراد أو احتساب غير اعتيادي${
        firstAnomalyPerson ? ` — تم إبراز سجل «${firstAnomalyPerson.name}» للفحص الفوري` : ''
      }:`,
      toolCall: firstAnomalyPerson
        ? {
            name: 'navigate_focus',
            args: {
              view: 'agency_roster',
              agencyId: firstAnomalyPerson.agencyId,
              personId: firstAnomalyPerson.id,
            },
          }
        : { name: 'run_diagnostics', args: { autoFix: false } },
      diagnosticsReport: report,
      choices: [
        ...(firstAnomalyPerson
          ? [
              {
                id: `anom_focus_${firstAnomalyPerson.id}`,
                label: `الانتقال إلى ${firstAnomalyPerson.name}`,
                sublabel: `${firstAnomalyPerson.individuals ?? 0} أفراد`,
                tone: 'warning' as const,
                actionType: 'select_person' as const,
                payload: {
                  personId: firstAnomalyPerson.id,
                  followUpAction: 'focus_person',
                },
              },
            ]
          : []),
        ...(report.autoFixableCount > 0
          ? [
              {
                id: 'anom_autofix',
                label: 'تجهيز مسودة الإصلاح الآمن',
                tone: 'accent' as const,
                actionType: 'send_prompt' as const,
                payload: { prompt: 'صلح مشاكل الفحص تلقائياً' },
              },
            ]
          : []),
      ],
      memoryPatch: {
        lastPersonId: firstAnomalyPerson?.id,
        lastPersonName: firstAnomalyPerson?.name,
        lastIntent: 'run_diagnostics',
      },
    };
  }

  // 1.8 Stealth Dark/Light Theme Toggle
  if (/(الوضع الليلي|الثيم الداكن|الوضع الداكن|شغل الليلي|ليلي)/.test(norm)) {
    return {
      handled: true,
      confidence: 0.96,
      stealthAutoExecute: true,
      autoCloseChat: true,
      gracefulLevel: 'A',
      replyText: 'تم تفعيل الوضع الليلي بصمت.',
      toolCall: {
        name: 'update_settings',
        args: { action: 'set_dark_theme', value: 'true' },
      },
      memoryPatch: { lastIntent: 'update_settings' },
    };
  }
  if (/(الوضع النهاري|الوضع الفاتح|الثيم الفاتح|النهاري)/.test(norm)) {
    return {
      handled: true,
      confidence: 0.96,
      stealthAutoExecute: true,
      autoCloseChat: true,
      gracefulLevel: 'A',
      replyText: 'تم تفعيل الوضع النهاري بصمت.',
      toolCall: {
        name: 'update_settings',
        args: { action: 'set_dark_theme', value: 'false' },
      },
      memoryPatch: { lastIntent: 'update_settings' },
    };
  }

  // 2. App Diagnostics & Health Check (with typo tolerance e.g. "افحس", "مكرين")
  if (
    /(افحص|فحص التطبيق|فحص|شيك|دقق صحة|المكررين|مكررين|تكرار|اخطاء السجل)/.test(
      norm
    ) ||
    fuzzyHasToken(norm, ['افحص', 'المكررين', 'مكررين', 'فحص'])
  ) {
    const report = runAppDiagnostics(state, uiContext.lastBackupAt);
    const wantsAutoFix = /(صلح|اصلاح|عالج)/.test(norm);
    const onlyDups =
      (/(مكرر|تكرار)/.test(norm) || fuzzyHasToken(norm, ['المكررين', 'مكررين'])) &&
      !/(افحص|فحص التطبيق)/.test(norm);

    if (onlyDups) {
      const dups = report.issues.filter((i) => i.category === 'duplicate_name');
      const reply =
        dups.length === 0
          ? 'فحصت كل الوكالات: ما لقيت أي اسم مكرر حالياً.'
          : `لقيت ${dups.length} تكرار بالأسماء:\n${dups
              .slice(0, 6)
              .map((d, i) => `${i + 1}. ${d.title} — ${d.detail}`)
              .join('\n')}`;
      return {
        handled: true,
        confidence: 0.96,
        gracefulLevel: 'A',
        replyText: reply,
        toolCall: { name: 'run_diagnostics', args: { autoFix: false } },
        diagnosticsReport: report,
        memoryPatch: { lastIntent: 'run_diagnostics' },
      };
    }

    if (wantsAutoFix && report.autoFixableCount > 0) {
      const tc: AssistantToolCall = { name: 'run_diagnostics', args: { autoFix: true } };
      return {
        handled: true,
        confidence: 0.95,
        gracefulLevel: 'A',
        replyText: `لقيت ${report.autoFixableCount} مشكلة قابلة للإصلاح التلقائي. راجع ملخص «قبل ← بعد» ووافق للتنفيذ:`,
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, uiContext.focusedPersonId),
        diagnosticsReport: report,
        memoryPatch: { lastIntent: 'run_diagnostics' },
      };
    }

    const summaryText =
      report.totalIssues === 0
        ? `فحص التطبيق مكتمل (درجة السلامة ${report.healthScore}%): كل السجلات والحسابات سليمة تماماً.`
        : `نتيجة فحص التطبيق (درجة السلامة ${report.healthScore}%): لقيت ${report.totalIssues} ملاحظة (${report.highCount} مهمة · ${report.autoFixableCount} قابلة للإصلاح التلقائي).`;
    return {
      handled: true,
      confidence: 0.95,
      gracefulLevel: 'A',
      replyText: summaryText,
      toolCall: { name: 'run_diagnostics', args: { autoFix: false } },
      diagnosticsReport: report,
      memoryPatch: { lastIntent: 'run_diagnostics' },
    };
  }

  // 3. Knowledge Base / Teacher / "وريني"
  if (
    /^(?:وريني|كيف|اشرح|وين القى|ما فائده|ما هو|ما هي|علمني|ساعدني بـ)/.test(norm) ||
    norm.includes('وريني')
  ) {
    const kb = findKnowledgeEntry(rawFixed);
    if (kb) {
      return {
        handled: true,
        confidence: 0.92,
        gracefulLevel: 'A',
        replyText: formatKnowledgeAnswer(kb),
        toolCall: {
          name: 'explain_feature',
          args: { topicId: kb.id, query: rawFixed },
        },
        spotlightAction: {
          label: `وريني (${kb.title})`,
          view: kb.targetView,
          settingsSection: kb.settingsSection,
          targetId: kb.domTargetId,
        },
        memoryPatch: { lastIntent: 'explain_feature' },
      };
    }
  }

  // 4. Export on Read-Only Sandbox ("تقرير" / "صدر" / "اكسل" / "اطبع" / "صورة")
  if (
    /(تقرير|صدر|تصدير|اكسل|excel|بي دي اف|pdf|اطبع|طباعه|صوره)/.test(norm) ||
    fuzzyHasToken(norm, ['تقرير', 'اكسل', 'اطبع', 'تصدير'])
  ) {
    const matchedAg = matchAgencyInText(rawFixed, state.agencies);
    const format: 'excel' | 'pdf' | 'image' | 'text' =
      /(pdf|بي دي اف|اطبع|طباعه)/.test(norm)
        ? 'pdf'
        : /(صوره|png)/.test(norm)
        ? 'image'
        : /(نص|واتساب)/.test(norm)
        ? 'text'
        : 'excel';
    const target: 'roster' | 'finance' | 'ready_list' = /(مالي|ارباح|مصاريف)/.test(
      norm
    )
      ? 'finance'
      : /(قائمه جاهزه|القائمه|قائمه)/.test(norm)
      ? 'ready_list'
      : 'roster';
    const hideStatusPref = uiContext.preferences.some(
      (p) => p.key === 'hide_status_in_reports' && String(p.value) === 'true'
    );
    const hideAmountPref = uiContext.preferences.some(
      (p) => p.key === 'hide_amount_in_reports' && String(p.value) === 'true'
    );
    return {
      handled: true,
      confidence: 0.94,
      stealthAutoExecute: true,
      autoCloseChat: true,
      gracefulLevel: 'A',
      replyText: `تم تجهيز التصدير (${format.toUpperCase()}) عبر نسخة معزولة للقراءة فقط (Sandbox) — الجدول الأصلي بقي سليماً بدون أي تعديل.`,
      toolCall: {
        name: 'export_sandbox',
        args: {
          format,
          target,
          agencyId: matchedAg?.id ?? uiContext.selectedAgencyId ?? undefined,
          hideStatusColumn: hideStatusPref,
          hideAmountColumn: hideAmountPref,
        },
      },
      memoryPatch: {
        lastAgencyId: matchedAg?.id ?? uiContext.selectedAgencyId ?? undefined,
        lastIntent: 'export_sandbox',
      },
    };
  }

  // 5. Stats & Net Profit
  if (
    /(احصائيات|كم كيس|صافي|ربح|ارباح|ايراد|إيراد|كم فرد|مجموع الأفراد|مجموع الافراد)/.test(
      norm
    ) ||
    fuzzyHasToken(norm, ['احصائيات', 'الارباح', 'ارباح'])
  ) {
    const matchedAg = matchAgencyInText(rawFixed, state.agencies);
    const scopedPersons = matchedAg
      ? state.persons.filter((p) => p.agencyId === matchedAg.id)
      : state.persons;
    const scopedExpenses = matchedAg
      ? state.expenses.filter((e) => e.agencyId === matchedAg.id)
      : state.expenses;
    const m = computeAgencyMetrics(
      scopedPersons,
      scopedExpenses,
      state.calculationSettings
    );
    const scopeTitle = matchedAg ? matchedAg.name : 'جميع الوكالات';
    const reply = [
      `ملخص ${scopeTitle} (حسب إعدادات الحاسبة الحالية):`,
      `• العائلات النشطة: ${m.activeHouseholds} من أصل ${m.registeredHouseholds}`,
      `• الأفراد المستحقون: ${m.activeIndividuals} فرد`,
      `• إجمالي الحصة: ${formatTotalQuota(m.totalKg, state.calculationSettings)} (${m.fullBags} كيس كامل)`,
      `• الإيرادات: ${formatIqd(m.revenue)} | المصاريف: ${formatIqd(m.totalExpenses)}`,
      `• صافي الربح: ${formatIqd(m.profit)}`,
    ].join('\n');
    return {
      handled: true,
      confidence: 0.95,
      gracefulLevel: 'A',
      replyText: reply,
      toolCall: {
        name: 'get_stats_profit',
        args: { agencyId: matchedAg?.id },
      },
      memoryPatch: {
        lastAgencyId: matchedAg?.id ?? undefined,
        lastIntent: 'get_stats_profit',
      },
    };
  }

  // 6. Backup / Monthly Archive
  if (/(نسخه احتياطيه|نسخ احتياطي|json|ارشف الشهر|ارشفه الحصه|ارشف الحصه|البيانات التاريخيه)/.test(norm)) {
    const isArchive = /(ارشف|حصه|حصة|شهر)/.test(norm);
    return {
      handled: true,
      confidence: 0.95,
      gracefulLevel: 'A',
      replyText: isArchive
        ? 'تم حفظ أو فتح الأرشفة الحالية في سجل البيانات التاريخية.'
        : 'جاري تنزيل نسخة احتياطية كاملة (JSON) إلى جهازك الآن.',
      toolCall: {
        name: 'backup_restore',
        args: { action: isArchive ? 'archive_period' : 'backup_json' },
      },
      memoryPatch: { lastIntent: 'backup_restore' },
    };
  }

  // 7. Quick Extract / Import & Compare
  if (/(سحب سريع|استيراد ومقارنه|استخراج|pdf ودفتر|كاميرا)/.test(norm)) {
    return {
      handled: true,
      confidence: 0.93,
      gracefulLevel: 'A',
      replyText: 'فتحت لك شاشة السحب السريع (PDF والكاميرا) للاستخراج والمقارنة.',
      toolCall: {
        name: 'open_import_compare',
        args: { source: 'quick_extract' },
      },
      memoryPatch: { lastIntent: 'open_import_compare' },
    };
  }

  // 8. Filter / Sort / Hide Columns (Stealth Execution: auto-mutates UI state + auto-closes drawer)
  if (
    /(رتب|ترتيب|فلتر|فقط المحجوب|المحجوبين|اعرض المحجوبين|النشطين فقط|اعرض النشطين|اعرض الكل|الغاء الفلتر|اخفي عمود|اظهر عمود)/.test(
      norm
    )
  ) {
    const matchedAg = matchAgencyInText(rawFixed, state.agencies);
    const statusFilter: 'all' | 'active' | 'blocked' | 'archived' | undefined =
      /محجوب/.test(norm)
        ? 'blocked'
        : /مؤرشف/.test(norm)
        ? 'archived'
        : /نشط/.test(norm)
        ? 'active'
        : /(الكل|الغاء الفلتر)/.test(norm)
        ? 'all'
        : undefined;
    const sortBy: 'default' | 'name_asc' | 'individuals_desc' | undefined =
      /(ابجدي|أبجدي|بالاسم)/.test(norm)
        ? 'name_asc'
        : /(اكثر افراد|أكثر افراد|الأفراد|افراد)/.test(norm)
        ? 'individuals_desc'
        : undefined;
    const hideColumns = /الحاله|الحالة/.test(norm) && /اخفي/.test(norm) ? ['status'] : undefined;
    return {
      handled: true,
      confidence: 0.94,
      stealthAutoExecute: true,
      autoCloseChat: true,
      gracefulLevel: 'A',
      replyText: 'طبّقت الفلترة والترتيب المطلوب على الجدول.',
      toolCall: {
        name: 'filter_sort_table',
        args: {
          agencyId: matchedAg?.id ?? uiContext.selectedAgencyId ?? undefined,
          statusFilter,
          sortBy,
          hideColumns,
        },
      },
      memoryPatch: { lastIntent: 'filter_sort_table' },
    };
  }

  // 9. Add Expense
  if (/(مصروف|صرفيه|صرفيات|اجور عمال|أجور)/.test(norm) && /(ضيف|سجل|اضف)/.test(norm)) {
    const matchedAg =
      matchAgencyInText(rawFixed, state.agencies) ||
      state.agencies.find((a) => a.id === uiContext.selectedAgencyId) ||
      state.agencies[0];
    const amount = extractFirstNumber(rawFixed);
    const cat = /عمال|اجور/.test(norm) ? 'worker_wages' : 'general';
    if (amount && amount > 0 && matchedAg) {
      const tc: AssistantToolCall = {
        name: 'manage_expense',
        args: {
          action: 'add',
          agencyId: matchedAg.id,
          amountIqd: amount,
          category: cat,
          description: cat === 'worker_wages' ? 'أجور عمال' : 'صرفية تشغيلية',
        },
      };
      return {
        handled: true,
        confidence: 0.94,
        gracefulLevel: 'A',
        replyText: 'جهّزت قيد المصروف المالي للمراجعة قبل التسجيل:',
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, uiContext.focusedPersonId),
        memoryPatch: { lastAgencyId: matchedAg.id, lastIntent: 'manage_expense' },
      };
    }
    return {
      handled: true,
      confidence: 0.55,
      needsClarification: true,
      gracefulLevel: 'B',
      replyText: 'كم مبلغ المصروف بالدينار لتسجيله؟ (مثال: «سجل مصروف عمال 25000»)',
    };
  }

  // 10. Add Person with Smart Slot-Filling
  if (/^(?:ضيف|ضف|سجل|خلي|نزل|اضف|اضافه)(?=\s|$)/.test(norm)) {
    const extractedName = extractNameFromAddCommand(rawFixed);
    if (!extractedName || extractedName.length < 2) {
      return {
        handled: true,
        confidence: 0.5,
        needsClarification: true,
        gracefulLevel: 'B',
        replyText: 'ما اسم المستفيد الذي تريد إضافته؟ (مثال: «ضيف علي جاسم 5 أفراد»)',
      };
    }

    const matchedAg =
      matchAgencyInText(rawFixed, state.agencies) ||
      (uiContext.selectedAgencyId
        ? state.agencies.find((a) => a.id === uiContext.selectedAgencyId) || null
        : null);
    const num = extractFirstNumber(rawFixed);

    if (!matchedAg) {
      const slot: AssistantSlotSession = {
        intent: 'add_person',
        collectedArgs: {
          name: extractedName,
          ...(num !== null ? { individuals: num } : {}),
        },
        missingSlot: 'agencyId',
        originalPrompt: rawFixed,
      };
      return {
        handled: true,
        confidence: 0.85,
        gracefulLevel: 'B',
        replyText: `وين تحب تضيف «${extractedName}»؟ اختر الوكالة:`,
        nextSlotSession: slot,
        memoryPatch: { lastPersonName: extractedName, lastIntent: 'add_person' },
        choices: state.agencies.map((ag) => ({
          id: `ag_${ag.id}`,
          label: `${ag.icon} ${ag.name}`,
          actionType: 'slot_answer',
          payload: { agencyId: ag.id },
        })),
      };
    }

    if (num === null) {
      const slot: AssistantSlotSession = {
        intent: 'add_person',
        collectedArgs: { name: extractedName, agencyId: matchedAg.id },
        missingSlot: 'individuals',
        originalPrompt: rawFixed,
      };
      return {
        handled: true,
        confidence: 0.86,
        gracefulLevel: 'B',
        replyText: `تمام، لإضافة «${extractedName}» في ${matchedAg.name}، كم عدد الأفراد؟`,
        nextSlotSession: slot,
        memoryPatch: {
          lastPersonName: extractedName,
          lastAgencyId: matchedAg.id,
          lastIntent: 'add_person',
        },
        choices: [2, 3, 4, 5, 6, 7, 8].map((n) => ({
          id: `ind_${n}`,
          label: `${n} أفراد`,
          actionType: 'slot_answer',
          payload: { individuals: n },
        })),
      };
    }

    const tc: AssistantToolCall = {
      name: 'add_person',
      args: {
        name: extractedName,
        agencyId: matchedAg.id,
        individuals: num,
        nationalId: '',
        notes: '',
      },
    };
    return {
      handled: true,
      confidence: 0.96,
      gracefulLevel: 'A',
      replyText: 'جهّزت السجل الجديد، راجع التفاصيل في بطاقة «قبل ← بعد»:',
      toolCall: tc,
      confirmationDiff: buildBeforeAfterDiff(state, tc, uiContext.focusedPersonId),
      memoryPatch: {
        lastPersonName: extractedName,
        lastAgencyId: matchedAg.id,
        lastIntent: 'add_person',
      },
    };
  }

  // 11. Archive / Block / Edit / Relative Adjust / Open Person from Context Memory or Fuzzy Match
  const hasPronounObject =
    /(?:^|\s)(هذا|هاي|نفسه|نفسها|المحدد|اياه|جدوله)(?=\s|$)/.test(norm) ||
    /(?:^|\s)(عدله|ارشفه|احذفه|امسحه|احجبه|زوده|نقصه|افتحه|شوفه)(?=\s|$)/.test(norm);

  if (
    /(احجب|حجب|ارشف|امسح|احذف|شيل|عدل|عدله|غير|حدث|سوي|سو\s|خلي|خليه|اجعل|زود|زوده|نقص|نقصه|ارشفه)/.test(
      norm
    )
  ) {
    const isArchiveOrDelete = /(ارشف|ارشفه|امسح|احذف|شيل)/.test(norm);
    const isBlock = /(احجب|حجب)/.test(norm);
    const isIncrement = /(زود|زوده|زيد)/.test(norm);
    const isDecrement = /(نقص|نقصه|قلل)/.test(norm);

    let targetPerson: Person | null = null;

    // Prioritize explicit focused UI row if user said "هذا / المحدد", OR conversation memory if pronoun ("عدله / احذفه / زوده")
    if (hasPronounObject) {
      const preferUi = /(هذا|هاي|المحدد)/.test(norm);
      const preferredId = preferUi
        ? uiContext.focusedPersonId ?? memory?.lastPersonId
        : memory?.lastPersonId ?? uiContext.focusedPersonId;
      if (preferredId !== null && preferredId !== undefined) {
        targetPerson = state.persons.find((p) => p.id === preferredId) || null;
      }
    }

    if (!targetPerson && !hasPronounObject) {
      const cleanedTarget = rawFixed
        .replace(
          /(?:احجب|حجب|ارشف|امسح|احذف|شيل|عدل|عدله|غير|حدث|سوي|سو|خلي|خليه|اجعل|زود|زوده|نقص|نقصه|أفراد|افراد|فرد|إلى|الى|لـ)\s*/g,
          ' '
        )
        .replace(/\b\d+\b/g, ' ')
        .trim();
      const candidates = fuzzyMatchPersons(cleanedTarget, state.persons);
      if (candidates.length === 1 && candidates[0].score >= 22) {
        targetPerson = candidates[0].person;
      } else if (candidates.length >= 1) {
        // Ask short clarifying question if multiple or low-confidence match
        const agMap = new Map(state.agencies.map((a) => [a.id, a.name]));
        return {
          handled: true,
          confidence: candidates.length === 1 ? 0.58 : 0.62,
          needsClarification: true,
          gracefulLevel: 'B',
          replyText:
            candidates.length === 1
              ? `هل تقصد «${candidates[0].person.name}»؟ اضغط للتأكيد:`
              : `لقيت ${candidates.length} أسماء مطابقة، أي شخص تقصد؟`,
          choices: candidates.slice(0, 5).map(({ person }) => ({
            id: `pick_p_${person.id}`,
            label: person.name,
            sublabel: `${agMap.get(person.agencyId) || ''} · ${person.individuals ?? 0} أفراد`,
            actionType: 'select_person',
            payload: {
              personId: person.id,
              followUpAction: isArchiveOrDelete
                ? 'archive_person'
                : isBlock
                ? 'block_person'
                : 'update_person',
              extractedNumber: extractFirstNumber(rawFixed),
            },
          })),
        };
      }
    }

    if (!targetPerson) {
      return {
        handled: true,
        confidence: 0.42,
        needsClarification: true,
        gracefulLevel: 'B',
        replyText: isArchiveOrDelete
          ? 'ما عرفت أي شخص تقصد للأرشفة/الحذف. حدده في الجدول أو اكتب اسمه بعد الأمر.'
          : 'أي شخص تقصد بالتعديل؟ اكتب اسمه بعد الأمر أو اختر أحد الإجراءات:',
        choices: [
          {
            id: 'clarify_open_master',
            label: 'فتح السجل الشامل',
            actionType: 'send_prompt',
            payload: { prompt: 'افتح السجل الشامل' },
          },
          {
            id: 'clarify_stats_help',
            label: 'إحصائيات جميع الوكالات',
            actionType: 'send_prompt',
            payload: { prompt: 'احصائيات جميع الوكالات' },
          },
        ],
      };
    }

    const personMemory: Partial<AssistantConversationMemory> = {
      lastPersonId: targetPerson.id,
      lastPersonName: targetPerson.name,
      lastAgencyId: targetPerson.agencyId,
    };

    if (isArchiveOrDelete) {
      const tc: AssistantToolCall = {
        name: 'archive_person',
        args: { personId: targetPerson.id, targetName: targetPerson.name },
      };
      return {
        handled: true,
        confidence: 0.94,
        gracefulLevel: 'A',
        replyText:
          'لحماية سجلاتك يتطلب الحذف/الأرشفة تأكيدك أولاً (ولا يتم مسح السجل نهائياً أبداً):',
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, targetPerson.id),
        memoryPatch: { ...personMemory, lastIntent: 'archive_person' },
      };
    }

    if (isBlock) {
      const partialCount = extractFirstNumber(rawFixed);
      const blockType =
        partialCount !== null &&
        partialCount > 0 &&
        partialCount < (targetPerson.individuals ?? 0)
          ? 'partial'
          : 'full';
      const tc: AssistantToolCall = {
        name: 'update_person',
        args: {
          personId: targetPerson.id,
          blockType,
          ...(blockType === 'partial' ? { blockedIndividuals: partialCount } : {}),
        },
      };
      return {
        handled: true,
        confidence: 0.93,
        gracefulLevel: 'A',
        replyText: 'جهّزت تعديل حالة الحظر للمراجعة:',
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, targetPerson.id),
        memoryPatch: { ...personMemory, lastIntent: 'update_person' },
      };
    }

    if (isIncrement || isDecrement) {
      const delta = extractFirstNumber(rawFixed) ?? 1;
      const current = targetPerson.individuals ?? 0;
      const nextNum = Math.max(0, isIncrement ? current + delta : current - delta);
      const tc: AssistantToolCall = {
        name: 'update_person',
        args: { personId: targetPerson.id, individuals: nextNum },
      };
      return {
        handled: true,
        confidence: 0.93,
        gracefulLevel: 'A',
        replyText: `جهّزت ${isIncrement ? 'زيادة' : 'إنقاص'} عدد الأفراد لـ «${targetPerson.name}» من ${current} إلى ${nextNum}:`,
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, targetPerson.id),
        memoryPatch: { ...personMemory, lastIntent: 'update_person' },
      };
    }

    const nextNum = extractFirstNumber(rawFixed);
    if (nextNum !== null) {
      if (nextNum === (targetPerson.individuals ?? 0)) {
        return {
          handled: true,
          confidence: 0.94,
          gracefulLevel: 'A',
          replyText: `عدد الأفراد لدى «${targetPerson.name}» هو ${nextNum} أفراد بالفعل — لا يوجد تغيير مطلوب.`,
          memoryPatch: personMemory,
        };
      }
      const tc: AssistantToolCall = {
        name: 'update_person',
        args: { personId: targetPerson.id, individuals: nextNum },
      };
      return {
        handled: true,
        confidence: 0.95,
        gracefulLevel: 'A',
        replyText: 'جهّزت تعديل عدد الأفراد للمراجعة:',
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, targetPerson.id),
        memoryPatch: { ...personMemory, lastIntent: 'update_person' },
      };
    }

    // User said e.g. "عدله" without specifying what value -> ask short clarifying prompt!
    return {
      handled: true,
      confidence: 0.56,
      needsClarification: true,
      gracefulLevel: 'B',
      replyText: `ماذا تحب تعدّل على «${targetPerson.name}» (الحالي: ${targetPerson.individuals ?? 0} أفراد)؟ اكتب مثلاً «سويه 6 أفراد» أو اختر:`,
      memoryPatch: personMemory,
      choices: [
        ...[3, 4, 5, 6].map((n) => ({
          id: `quick_edit_${targetPerson!.id}_${n}`,
          label: `جعله ${n} أفراد`,
          actionType: 'select_person' as const,
          payload: {
            personId: targetPerson!.id,
            followUpAction: 'update_person',
            extractedNumber: n,
          },
        })),
        {
          id: `quick_arch_${targetPerson.id}`,
          label: 'أرشفة السجل',
          tone: 'warning',
          actionType: 'select_person',
          payload: {
            personId: targetPerson.id,
            followUpAction: 'archive_person',
          },
        },
      ],
    };
  }

  // 12. Navigate / Open Agency, Section, OR Pronoun "افتح جدوله / افتحه" (Stealth Execution)
  if (/^(?:افتح|روح|انتقل|وديني|اعرض)(?=\s|$)/.test(norm)) {
    if (/(مركز morrow|مركز المساعد|القياده|مركز التحكم)/.test(norm)) {
      return {
        handled: true,
        confidence: 0.96,
        stealthAutoExecute: true,
        autoCloseChat: true,
        gracefulLevel: 'A',
        replyText: 'فتحت لك مركز Morrow.',
        toolCall: {
          name: 'navigate_focus',
          args: { view: 'morrow_center' },
        },
        memoryPatch: { lastIntent: 'navigate_focus' },
      };
    }

    if (/(جدوله|افتحه|صفحته)/.test(norm) && (memory?.lastPersonId || uiContext.focusedPersonId)) {
      const targetId = memory?.lastPersonId ?? uiContext.focusedPersonId;
      const person = state.persons.find((p) => p.id === targetId);
      if (person) {
        return {
          handled: true,
          confidence: 0.94,
          stealthAutoExecute: true,
          autoCloseChat: true,
          gracefulLevel: 'A',
          replyText: `فتحت جدول الوكالة وحددت سطر «${person.name}».`,
          toolCall: {
            name: 'navigate_focus',
            args: {
              view: 'agency_roster',
              agencyId: person.agencyId,
              personId: person.id,
            },
          },
          memoryPatch: {
            lastPersonId: person.id,
            lastPersonName: person.name,
            lastAgencyId: person.agencyId,
          },
        };
      }
    }

    const matchedAg = matchAgencyInText(rawFixed, state.agencies);
    if (matchedAg) {
      return {
        handled: true,
        confidence: 0.94,
        stealthAutoExecute: true,
        autoCloseChat: true,
        gracefulLevel: 'A',
        replyText: `فتحت لك جدول ${matchedAg.name}.`,
        toolCall: {
          name: 'navigate_focus',
          args: { view: 'agency_roster', agencyId: matchedAg.id },
        },
        memoryPatch: { lastAgencyId: matchedAg.id, lastIntent: 'navigate_focus' },
      };
    }
    const kb = findKnowledgeEntry(rawFixed);
    if (kb) {
      return {
        handled: true,
        confidence: 0.92,
        stealthAutoExecute: true,
        autoCloseChat: true,
        gracefulLevel: 'A',
        replyText: `فتحت لك ${kb.title}.`,
        toolCall: {
          name: 'navigate_focus',
          args: {
            view: kb.targetView,
            ...(kb.settingsSection ? { settingsSection: kb.settingsSection } : {}),
            highlightTargetId: kb.domTargetId,
          },
        },
        memoryPatch: { lastIntent: 'navigate_focus' },
      };
    }
  }

  // 13. Fuzzy Search Person (including typo tolerance on "ابحس" / "شوفلي")
  const searchCandidate = extractSearchQuery(rawFixed);
  const matchedAgForSearch = matchAgencyInText(rawFixed, state.agencies);
  const searchMatches = fuzzyMatchPersons(
    searchCandidate || rawFixed,
    state.persons,
    matchedAgForSearch?.id
  );
  if (
    /(ابحث|دور|شوف|وين|بحث|طلع|جيب|فتش)/.test(norm) ||
    fuzzyHasToken(norm, ['ابحث', 'شوفلي', 'دورلي']) ||
    searchMatches.length > 0
  ) {
    const agMap = new Map(state.agencies.map((a) => [a.id, a.name]));
    if (searchMatches.length === 0) {
      return {
        handled: true,
        confidence: 0.55,
        needsClarification: true,
        gracefulLevel: 'B',
        replyText: `ما لقيت أي سجل مطابق لـ «${searchCandidate || rawFixed}» في الجداول الحالية. جرّب الاسم الأول أو الوكالة.`,
      };
    }
    if (searchMatches.length === 1) {
      const p = searchMatches[0].person;
      const confidence = searchMatches[0].score >= 60 ? 0.96 : 0.72;
      if (confidence < 0.65) {
        return {
          handled: true,
          confidence,
          needsClarification: true,
          gracefulLevel: 'B',
          replyText: `أقرب اسم لقيته هو «${p.name}» — هل تقصده؟`,
          choices: [
            {
              id: `confirm_sr_${p.id}`,
              label: `نعم، افتح «${p.name}»`,
              sublabel: `${agMap.get(p.agencyId) || ''} · ${p.individuals ?? 0} أفراد`,
              actionType: 'select_person',
              payload: { personId: p.id, followUpAction: 'focus_person' },
            },
          ],
        };
      }
      return {
        handled: true,
        confidence,
        gracefulLevel: 'A',
        replyText: `لقيت «${p.name}» في ${agMap.get(p.agencyId) || 'الوكالة'} (${
          p.individuals ?? 0
        } أفراد · ${p.status || 'نشط'}). حددته لك في الجدول مباشرة.`,
        toolCall: {
          name: 'search_person',
          args: { query: p.name, agencyId: p.agencyId },
        },
        memoryPatch: {
          lastPersonId: p.id,
          lastPersonName: p.name,
          lastAgencyId: p.agencyId,
          lastQuery: p.name,
          lastIntent: 'search_person',
        },
      };
    }
    return {
      handled: true,
      confidence: 0.85,
      gracefulLevel: 'A',
      replyText: `لقيت ${searchMatches.length} نتائج مطابقة، اختر الشخص لفتحه وإبراز سطره:`,
      memoryPatch: { lastQuery: searchCandidate || rawFixed, lastIntent: 'search_person' },
      choices: searchMatches.slice(0, 6).map(({ person }) => ({
        id: `found_${person.id}`,
        label: person.name,
        sublabel: `${agMap.get(person.agencyId) || ''} · ${person.individuals ?? 0} أفراد`,
        actionType: 'select_person',
        payload: { personId: person.id, followUpAction: 'focus_person' },
      })),
    };
  }

  // 14. Very short or vague single-token ambiguity -> ask short clarification instead of guessing
  if (norm.split(' ').length === 1 && norm.length <= 4) {
    return {
      handled: true,
      confidence: 0.35,
      needsClarification: true,
      gracefulLevel: 'B',
      replyText: `الطلب «${rawFixed}» غير واضح تماماً. هل تقصد البحث عن اسم أم تنفيذ إجراء سريع؟`,
      choices: [
        {
          id: 'clarify_stats',
          label: 'إحصائيات شاملة',
          actionType: 'send_prompt',
          payload: { prompt: 'احصائيات جميع الوكالات' },
        },
        {
          id: 'clarify_diag',
          label: 'فحص التطبيق',
          actionType: 'send_prompt',
          payload: { prompt: 'افحص التطبيق' },
        },
        {
          id: 'clarify_report',
          label: 'تقرير إكسل',
          actionType: 'send_prompt',
          payload: { prompt: 'صدر تقرير اكسل' },
        },
      ],
    };
  }

  // 15. Unrecognized free-form prompt -> Escalate to Cloud Gemini in Auto/Cloud modes, or Level C queue offline
  return {
    handled: false,
    confidence: 0.25,
    canUseCloudInAuto: true,
    gracefulLevel: 'C',
    replyText:
      'هذا الطلب حر أو تحليلي ويحتاج نموذج Gemini السحابي لأفضل إجابة.',
    needsCloudReason: 'freeform_reasoning_required',
  };
}

export function runOfflineBrain(params: {
  prompt: string;
  state: AppDatabaseState;
  uiContext: AssistantUiContext;
  slotSession?: AssistantSlotSession | null;
  memory?: AssistantConversationMemory;
}): OfflineBrainOutcome {
  const { prompt, state, uiContext, slotSession, memory } = params;
  const rawFixed = enforceSafeArabicTerminology(prompt.trim());

  if (slotSession) {
    return continueSlotSession(slotSession, rawFixed, state, uiContext);
  }

  // Compound Command Support ("ضيف علي وحسن واطبع تقرير", "ابحث عن محمد ثم افحص التطبيق")
  const parts = splitCompoundCommands(rawFixed);
  if (parts.length > 1) {
    let rollingMemory: AssistantConversationMemory = { ...(memory || {}) };
    const outcomes: OfflineBrainOutcome[] = [];

    for (const part of parts) {
      const sub = runSingleOfflineClause({
        prompt: part,
        state,
        uiContext,
        memory: rollingMemory,
      });
      if (sub.memoryPatch) {
        rollingMemory = { ...rollingMemory, ...sub.memoryPatch };
      }
      outcomes.push(sub);
    }

    const handledCount = outcomes.filter((o) => o.handled).length;
    if (handledCount > 0) {
      const avgConfidence =
        outcomes.reduce((acc, o) => acc + o.confidence, 0) / outcomes.length;
      return {
        handled: true,
        confidence: Number(avgConfidence.toFixed(2)),
        gracefulLevel: outcomes.some((o) => o.gracefulLevel === 'B') ? 'B' : 'A',
        replyText: `تم تقسيم أمرك المركّب إلى ${outcomes.length} خطوات:`,
        compoundSteps: outcomes,
        memoryPatch: rollingMemory,
      };
    }
  }

  return runSingleOfflineClause({
    prompt: rawFixed,
    state,
    uiContext,
    memory,
  });
}
