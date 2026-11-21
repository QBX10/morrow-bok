import type { Agency, AppDatabaseState, Person } from '../types/agency.ts';
import type {
  AssistantChoiceChip,
  AssistantMessage,
  AssistantSlotSession,
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
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function extractNameFromAddCommand(raw: string): string {
  let clean = enforceSafeArabicTerminology(convertArabicIndicDigits(raw))
    .replace(
      /^(?:ضيفلي|ضفلي|ضيف|ضف|سجلي|سجل|خليلي|خلي|نزلي|نزل|اضف|إضافة|اضافة)\s+/i,
      ''
    )
    .replace(/\b(?:اسم|مستفيد|عائلة|سجل)\b/g, ' ')
    .replace(/(?:لـ|ل|إلى|الى|في|بـ)?\s*وكالة\s+[^\s]+(?:\s+[^\s]+)?/g, ' ')
    .replace(/\b(?:الأولى|الاولى|الثانية|الثانيه|الثالثة|الثالثه)\b/g, ' ')
    .replace(/\b\d+\s*(?:أفراد|افراد|فرد)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean;
}

function extractSearchQuery(raw: string): string {
  return enforceSafeArabicTerminology(convertArabicIndicDigits(raw))
    .replace(
      /^(?:دورلي|دور|ابحثلي|ابحث عن|ابحث|شوفلي|شوف|وينه|وين|طلعلي|طلع|لقالي|ابحث بالاسم|جيبلي)\s+/i,
      ''
    )
    .replace(/(?:في|بـ|من)?\s*وكالة\s+[^\s]+(?:\s+[^\s]+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface OfflineBrainOutcome {
  handled: boolean;
  replyText: string;
  gracefulLevel: 'A' | 'B' | 'C';
  toolCall?: AssistantToolCall;
  nextSlotSession?: AssistantSlotSession | null;
  choices?: AssistantChoiceChip[];
  confirmationDiff?: ReturnType<typeof buildBeforeAfterDiff>;
  spotlightAction?: AssistantMessage['spotlightAction'];
  diagnosticsReport?: ReturnType<typeof runAppDiagnostics>;
  needsCloudReason?: string;
}

export function continueSlotSession(
  slot: AssistantSlotSession,
  userAnswer: string,
  state: AppDatabaseState,
  uiContext: AssistantUiContext
): OfflineBrainOutcome {
  const args = { ...slot.collectedArgs };
  const norm = normalizeIraqiDialect(userAnswer);

  if (norm === 'الغاء' || norm === 'إلغاء' || norm === 'توقف') {
    return {
      handled: true,
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
        gracefulLevel: 'A',
        replyText: `اخترت ${matchedAg.name}. كم عدد الأفراد لهذه العائلة؟`,
        nextSlotSession: {
          ...slot,
          collectedArgs: args,
          missingSlot: 'individuals',
        },
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
      gracefulLevel: 'A',
      replyText: 'جهّزت تفاصيل الإضافة. راجع بطاقة «قبل ← بعد» واضغط موافق للحفظ:',
      toolCall,
      confirmationDiff: diff,
      nextSlotSession: null,
    };
  }

  return {
    handled: false,
    gracefulLevel: 'C',
    replyText: 'احتجت تفاصيل أكثر لإكمال الطلب.',
    nextSlotSession: null,
  };
}

export function runOfflineBrain(params: {
  prompt: string;
  state: AppDatabaseState;
  uiContext: AssistantUiContext;
  slotSession?: AssistantSlotSession | null;
}): OfflineBrainOutcome {
  const { prompt, state, uiContext, slotSession } = params;
  const rawFixed = enforceSafeArabicTerminology(prompt.trim());
  const norm = normalizeIraqiDialect(rawFixed);

  if (!norm) {
    return {
      handled: true,
      gracefulLevel: 'B',
      replyText: 'اكتب طلبك أو اختر أحد الأزرار السريعة بالأعلى.',
    };
  }

  if (slotSession) {
    return continueSlotSession(slotSession, rawFixed, state, uiContext);
  }

  // 1. User Memory Preferences ("لا تخلي عمود الحالة في التقرير" / "احفظ تفضيل")
  if (
    /(اخفي|لا تخلي|احذف|شيل).*(عمود الحالة|الحاله)/.test(norm) ||
    /تفضيل.*اخفاء.*حاله/.test(norm)
  ) {
    return {
      handled: true,
      gracefulLevel: 'A',
      replyText:
        'حفظت تفضيلك: تقارير الإكسل التلقائية تخفي عمود الحالة مستقبلاً. تقدر تراجعه أو تمسحه من التفضيلات بأي وقت.',
      toolCall: {
        name: 'update_settings',
        args: {
          action: 'save_pref',
          key: 'hide_status_in_reports',
          label: 'إخفاء عمود الحالة في التقارير',
          value: 'true',
        },
      },
    };
  }

  // 2. App Diagnostics & Health Check ("افحص التطبيق" / "المكررين" / "الأخطاء")
  if (
    /(افحص|فحص التطبيق|فحص|شيك|دقق صحة|المكررين|مكررين|تكرار|اخطاء السجل)/.test(
      norm
    )
  ) {
    const report = runAppDiagnostics(state, uiContext.lastBackupAt);
    const wantsAutoFix = /(صلح|اصلاح|عالج)/.test(norm);
    const onlyDups = /(مكرر|تكرار)/.test(norm) && !/(افحص|فحص التطبيق)/.test(norm);

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
        gracefulLevel: 'A',
        replyText: reply,
        toolCall: { name: 'run_diagnostics', args: { autoFix: false } },
        diagnosticsReport: report,
      };
    }

    if (wantsAutoFix && report.autoFixableCount > 0) {
      const tc: AssistantToolCall = { name: 'run_diagnostics', args: { autoFix: true } };
      return {
        handled: true,
        gracefulLevel: 'A',
        replyText: `لقيت ${report.autoFixableCount} مشكلة قابلة للإصلاح التلقائي. راجع ملخص «قبل ← بعد» ووافق للتنفيذ:`,
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, uiContext.focusedPersonId),
        diagnosticsReport: report,
      };
    }

    const summaryText =
      report.totalIssues === 0
        ? `فحص التطبيق مكتمل (درجة السلامة ${report.healthScore}%): كل السجلات والحسابات سليمة تماماً.`
        : `نتيجة فحص التطبيق (درجة السلامة ${report.healthScore}%): لقيت ${report.totalIssues} ملاحظة (${report.highCount} مهمة · ${report.autoFixableCount} قابلة للإصلاح التلقائي).`;
    return {
      handled: true,
      gracefulLevel: 'A',
      replyText: summaryText,
      toolCall: { name: 'run_diagnostics', args: { autoFix: false } },
      diagnosticsReport: report,
    };
  }

  // 3. Knowledge Base / Teacher / "وريني"
  if (/^(?:وريني|كيف|اشرح|وين القى|ما فائده|ما هو|ما هي|علمني|ساعدني بـ)/.test(norm) || norm.includes('وريني')) {
    const kb = findKnowledgeEntry(rawFixed);
    if (kb) {
      return {
        handled: true,
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
      };
    }
  }

  // 4. Export on Read-Only Sandbox ("تقرير" / "صدر" / "اكسل" / "اطبع" / "صورة")
  if (/(تقرير|صدر|تصدير|اكسل|excel|بي دي اف|pdf|اطبع|طباعه|صوره)/.test(norm)) {
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
      : /(قائمه جاهزه|القائمه)/.test(norm)
      ? 'ready_list'
      : 'roster';
    const hideStatusPref = uiContext.preferences.some(
      (p) => p.key === 'hide_status_in_reports' && String(p.value) === 'true'
    );
    return {
      handled: true,
      gracefulLevel: 'A',
      replyText: `تم تجهيز التصدير (${format.toUpperCase()}) عبر نسخة معزولة للقراءة فقط (Sandbox) — الجدول الأصلي بقي سليماً بدون أي تعديل.`,
      toolCall: {
        name: 'export_sandbox',
        args: {
          format,
          target,
          agencyId: matchedAg?.id ?? uiContext.selectedAgencyId ?? undefined,
          hideStatusColumn: hideStatusPref,
        },
      },
    };
  }

  // 5. Stats & Net Profit ("احصائيات" / "كم كيس" / "صافي الربح" / "مالية")
  if (/(احصائيات|كم كيس|صافي|ربح|ارباح|ايراد|إيراد|كم فرد|مجموع الأفراد|مجموع الافراد)/.test(norm)) {
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
      gracefulLevel: 'A',
      replyText: reply,
      toolCall: {
        name: 'get_stats_profit',
        args: { agencyId: matchedAg?.id },
      },
    };
  }

  // 6. Backup / Monthly Archive ("نسخة احتياطية" / "أرشف الحصة")
  if (/(نسخه احتياطيه|نسخ احتياطي|json|ارشف الشهر|ارشفه الحصه|البيانات التاريخيه)/.test(norm)) {
    const isArchive = /(ارشف|حصة|شهر)/.test(norm);
    return {
      handled: true,
      gracefulLevel: 'A',
      replyText: isArchive
        ? 'تم فتح أو أرشفة الفترة الحالية في سجل البيانات التاريخية.'
        : 'جاري تنزيل نسخة احتياطية كاملة (JSON) إلى جهازك الآن.',
      toolCall: {
        name: 'backup_restore',
        args: { action: isArchive ? 'archive_period' : 'backup_json' },
      },
    };
  }

  // 7. Quick Extract / Import & Compare
  if (/(سحب سريع|استيراد ومقارنه|استخراج|pdf ودفتر|كاميرا)/.test(norm)) {
    return {
      handled: true,
      gracefulLevel: 'A',
      replyText: 'فتحت لك شاشة السحب السريع (PDF والكاميرا) للاستخراج والمقارنة.',
      toolCall: {
        name: 'open_import_compare',
        args: { source: 'quick_extract' },
      },
    };
  }

  // 8. Filter / Sort / Hide Columns
  if (/(رتب|ترتيب|فلتر|فقط المحجوب|النشطين فقط|اخفي عمود|اظهر عمود)/.test(norm)) {
    const matchedAg = matchAgencyInText(rawFixed, state.agencies);
    const statusFilter: 'all' | 'active' | 'blocked' | 'archived' | undefined =
      /محجوب/.test(norm)
        ? 'blocked'
        : /مؤرشف/.test(norm)
        ? 'archived'
        : /نشط/.test(norm)
        ? 'active'
        : undefined;
    const sortBy: 'default' | 'name_asc' | 'individuals_desc' | undefined =
      /(ابجدي|أبجدي|بالاسم)/.test(norm)
        ? 'name_asc'
        : /(اكثر افراد|أكثر افراد|الأفراد)/.test(norm)
        ? 'individuals_desc'
        : undefined;
    const hideColumns = /الحاله|الحالة/.test(norm) && /اخفي/.test(norm) ? ['status'] : undefined;
    return {
      handled: true,
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
    };
  }

  // 9. Add Expense ("صرفية" / "اجور عمال" / "مصروف")
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
        gracefulLevel: 'A',
        replyText: 'جهّزت قيد المصروف المالي للمراجعة قبل التسجيل:',
        toolCall: tc,
        confirmationDiff: buildBeforeAfterDiff(state, tc, uiContext.focusedPersonId),
      };
    }
  }

  // 10. Add Person with Smart Slot-Filling ("ضيف علي" -> prompt agency -> prompt individuals -> confirm diff)
  if (/^(?:ضيف|ضف|سجل|خلي|نزل|اضف|اضافه)\s+/.test(norm)) {
    const extractedName = extractNameFromAddCommand(rawFixed);
    if (!extractedName || extractedName.length < 2) {
      return {
        handled: true,
        gracefulLevel: 'B',
        replyText: 'اكتب اسم المستفيد الكامل مع أمر الإضافة (مثال: «ضيف علي جاسم 5 أفراد»).',
      };
    }

    const matchedAg = matchAgencyInText(rawFixed, state.agencies);
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
        gracefulLevel: 'B',
        replyText: `وين تحب تضيف «${extractedName}»؟ اختر الوكالة:`,
        nextSlotSession: slot,
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
        gracefulLevel: 'B',
        replyText: `تمام، لإضافة «${extractedName}» في ${matchedAg.name}، كم عدد الأفراد؟`,
        nextSlotSession: slot,
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
      gracefulLevel: 'A',
      replyText: 'جهّزت السجل الجديد، راجع التفاصيل في بطاقة «قبل ← بعد»:',
      toolCall: tc,
      confirmationDiff: buildBeforeAfterDiff(state, tc, uiContext.focusedPersonId),
    };
  }

  // 11. Archive / Block / Edit Person (Context-aware "هذا" or Disambiguation)
  if (/(احجب|حجب|ارشف|امسح|احذف|شيل|عدل|غير|حدث)/.test(norm)) {
    const isArchiveOrDelete = /(ارشف|امسح|احذف|شيل)/.test(norm);
    const isBlock = /(احجب|حجب)/.test(norm);
    const usesFocusedContext = /\b(هذا|هاي|نفسه|نفسها|المحدد)\b/.test(norm);

    let targetPerson: Person | null = null;
    if (usesFocusedContext && uiContext.focusedPersonId !== null) {
      targetPerson =
        state.persons.find((p) => p.id === uiContext.focusedPersonId) || null;
    }

    if (!targetPerson && !usesFocusedContext) {
      const cleanedTarget = rawFixed
        .replace(
          /(?:احجب|حجب|ارشف|امسح|احذف|شيل|عدل|غير|حدث|أفراد|افراد|إلى|الى|لـ)\s*/g,
          ' '
        )
        .replace(/\b\d+\b/g, ' ')
        .trim();
      const candidates = fuzzyMatchPersons(cleanedTarget, state.persons);
      if (candidates.length === 1) {
        targetPerson = candidates[0].person;
      } else if (candidates.length > 1) {
        const agMap = new Map(state.agencies.map((a) => [a.id, a.name]));
        return {
          handled: true,
          gracefulLevel: 'B',
          replyText: `لقيت ${candidates.length} أسماء مطابقة، أي شخص تقصد؟`,
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

    if (targetPerson) {
      if (isArchiveOrDelete) {
        const tc: AssistantToolCall = {
          name: 'archive_person',
          args: { personId: targetPerson.id, targetName: targetPerson.name },
        };
        return {
          handled: true,
          gracefulLevel: 'A',
          replyText:
            'لحماية سجلاتك لا يتم المسح النهائي أبداً — جهّزت لك الأرشفة الآمنة للموافقة:',
          toolCall: tc,
          confirmationDiff: buildBeforeAfterDiff(state, tc, targetPerson.id),
        };
      }
      if (isBlock) {
        const partialCount = extractFirstNumber(rawFixed);
        const blockType =
          partialCount !== null && partialCount > 0 && partialCount < (targetPerson.individuals ?? 0)
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
          gracefulLevel: 'A',
          replyText: 'جهّزت تعديل حالة الحظر للمراجعة:',
          toolCall: tc,
          confirmationDiff: buildBeforeAfterDiff(state, tc, targetPerson.id),
        };
      }
      const nextNum = extractFirstNumber(rawFixed);
      if (nextNum !== null) {
        const tc: AssistantToolCall = {
          name: 'update_person',
          args: { personId: targetPerson.id, individuals: nextNum },
        };
        return {
          handled: true,
          gracefulLevel: 'A',
          replyText: 'جهّزت تعديل عدد الأفراد للمراجعة:',
          toolCall: tc,
          confirmationDiff: buildBeforeAfterDiff(state, tc, targetPerson.id),
        };
      }
    }
  }

  // 12. Navigate / Open Agency or Section
  if (/^(?:افتح|روح|انتقل|وديني|اعرض)\s+/.test(norm)) {
    const matchedAg = matchAgencyInText(rawFixed, state.agencies);
    if (matchedAg) {
      return {
        handled: true,
        gracefulLevel: 'A',
        replyText: `فتحت لك جدول ${matchedAg.name}.`,
        toolCall: {
          name: 'navigate_focus',
          args: { view: 'agency_roster', agencyId: matchedAg.id },
        },
      };
    }
    const kb = findKnowledgeEntry(rawFixed);
    if (kb) {
      return {
        handled: true,
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
      };
    }
  }

  // 13. Fuzzy Search Person (Explicit search command or direct name lookup)
  const searchCandidate = extractSearchQuery(rawFixed);
  const matchedAgForSearch = matchAgencyInText(rawFixed, state.agencies);
  const searchMatches = fuzzyMatchPersons(
    searchCandidate || rawFixed,
    state.persons,
    matchedAgForSearch?.id
  );
  if (
    /(ابحث|دور|شوف|وين|بحث|طلع|جيب)/.test(norm) ||
    searchMatches.length > 0
  ) {
    const agMap = new Map(state.agencies.map((a) => [a.id, a.name]));
    if (searchMatches.length === 0) {
      return {
        handled: true,
        gracefulLevel: 'B',
        replyText: `ما لقيت أي سجل مطابق لـ «${searchCandidate || rawFixed}» في الجداول الحالية.`,
      };
    }
    if (searchMatches.length === 1) {
      const p = searchMatches[0].person;
      return {
        handled: true,
        gracefulLevel: 'A',
        replyText: `لقيت «${p.name}» في ${agMap.get(p.agencyId) || 'الوكالة'} (${
          p.individuals ?? 0
        } أفراد · ${p.status || 'نشط'}). حددته لك في الجدول مباشرة.`,
        toolCall: {
          name: 'search_person',
          args: { query: p.name, agencyId: p.agencyId },
        },
      };
    }
    return {
      handled: true,
      gracefulLevel: 'A',
      replyText: `لقيت ${searchMatches.length} نتائج مطابقة، اختر الشخص لفتحه وإبراز سطره:`,
      choices: searchMatches.slice(0, 6).map(({ person }) => ({
        id: `found_${person.id}`,
        label: person.name,
        sublabel: `${agMap.get(person.agencyId) || ''} · ${person.individuals ?? 0} أفراد`,
        actionType: 'select_person',
        payload: { personId: person.id, followUpAction: 'focus_person' },
      })),
    };
  }

  // 14. Unrecognized free-form prompt -> Pass to Cloud Gemini if online, else Level C graceful queue
  return {
    handled: false,
    gracefulLevel: 'C',
    replyText:
      'هذا الطلب حر ومعقّد ويحتاج التحليل السحابي (Gemini) حتى أعطيك أدق نتيجة.',
    needsCloudReason: 'freeform_reasoning_required',
  };
}
