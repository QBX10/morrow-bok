import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DATABASE_STATE } from '../data/seedData';
import type { AssistantUiContext } from '../types/assistant';
import {
  buildAssistantCacheKey,
  getCachedAssistantResponse,
  setCachedAssistantResponse,
  type AssistantCacheEntry,
} from './assistantCache';
import {
  applyDiagnosticAutoFixes,
  runAppDiagnostics,
} from './assistantDiagnostics';
import {
  continueSlotSession,
  getScreenAwareSuggestions,
  runOfflineBrain,
  splitCompoundCommands,
} from './assistantOfflineBrain';
import {
  buildCloudContextPayload,
  enforceSafeArabicTerminology,
  normalizeIraqiDialect,
  redactPotentialPiiText,
} from './assistantPrivacy';
import {
  createInitialQuotaStats,
  DEFAULT_ASSISTANT_SETTINGS,
  deriveAssistantConnectivity,
  evaluateOnlineQuota,
  markQuotaExhausted,
  PRIMARY_FREE_GEMINI_MODEL,
  recordOnlineRequest,
  sanitizeAssistantModelId,
} from './assistantQuota';
import {
  buildBeforeAfterDiff,
  cloneReadOnlySandbox,
  validateToolCall,
} from './assistantTools';
import {
  resolveToolExecution,
  type AssistantActionRuntime,
} from './assistantExecutor';

function makeSeedState() {
  return structuredClone(INITIAL_DATABASE_STATE);
}

function makeTestContext(state = makeSeedState()): AssistantUiContext {
  return {
    activeView: 'hub',
    selectedAgencyId: null,
    focusedPersonId: null,
    modeTier: state.modeTier,
    themeId: state.themePrefs?.appTheme || 'arctic-snow',
    agencies: state.agencies.map((a) => ({ id: a.id, name: a.name })),
    readyLists: state.readyLists.map((l) => ({
      id: l.id,
      name: l.name,
      agencyId: l.agencyId,
    })),
    preferences: [],
    lastBackupAt: new Date().toISOString(),
    totalPersonsCount: state.persons.length,
  };
}

test('enforces الأفراد terminology and normalizes Iraqi dialect + Indic/Persian digits + elongation', () => {
  assert.equal(
    enforceSafeArabicTerminology('تقرير \u0627\u0644\u0623\u0646\u0641\u0627\u0631 بعدد ٥ \u0623\u0646\u0641\u0627\u0631'),
    'تقرير الأفراد بعدد ٥ أفراد'
  );
  const norm = normalizeIraqiDialect('شكد عدد الأفراد هسه ٥ و ۴');
  assert.ok(norm.includes('كم'));
  assert.ok(norm.includes('5'));
  assert.ok(norm.includes('4'));

  const elongated = normalizeIraqiDialect('ضيييف علاوي شلووون');
  assert.ok(elongated.includes('ضيف'));
  assert.ok(elongated.includes('كيف'));
});

test('redactPotentialPiiText masks emails, Iraqi phone numbers, and card IDs before cloud calls', () => {
  const raw = 'راسلني على ali@example.com أو 07701234567 رقم بطاقة 987654321';
  const redacted = redactPotentialPiiText(raw);
  assert.equal(redacted.includes('ali@example.com'), false);
  assert.equal(redacted.includes('07701234567'), false);
  assert.equal(redacted.includes('987654321'), false);
  assert.ok(redacted.includes('[بريد محجوب]'));
  assert.ok(redacted.includes('[رقم هاتف محجوب]'));
  assert.ok(redacted.includes('[رقم بطاقة محجوب]'));
});

test('cloud context masks beneficiary names unless explicit opt-in is enabled and trims history to 4 turns', () => {
  const state = makeSeedState();
  const uiContext = makeTestContext(state);
  const sampleName = state.persons[0].name;

  const history = Array.from({ length: 7 }, (_, i) => ({
    id: String(i),
    role: 'user' as const,
    text: `رسالة رقم ${i} وهاتفي 07701234567`,
    createdAt: '',
  }));

  const masked = buildCloudContextPayload(
    { ...uiContext, focusedPersonName: sampleName },
    history,
    false
  );
  assert.equal(masked.cloudContext.focusedPersonName, undefined);
  assert.equal(masked.cloudContext.privacyMode, 'masked_no_beneficiaries');
  assert.equal(masked.cloudHistory.length, 4);
  assert.equal(masked.cloudHistory[0].text.includes('07701234567'), false);

  const unmasked = buildCloudContextPayload(
    { ...uiContext, focusedPersonName: sampleName },
    history,
    true
  );
  assert.equal(unmasked.cloudContext.focusedPersonName, sampleName);
  assert.equal(unmasked.cloudContext.privacyMode, 'names_allowed_by_user');
});

test('validateToolCall whitelists safe tools and rejects SQL/XSS injection payloads', () => {
  const valid = validateToolCall({
    name: 'search_person',
    args: { query: 'علي' },
  });
  assert.equal(valid.valid, true);

  const badTool = validateToolCall({ name: 'drop_database', args: {} });
  assert.equal(badTool.valid, false);

  const sqlInjection = validateToolCall({
    name: 'search_person',
    args: { query: '; DROP TABLE persons; --' },
  });
  assert.equal(sqlInjection.valid, false);

  const xssInjection = validateToolCall({
    name: 'add_person',
    args: { name: '<script>alert(1)</script>', agencyId: 1, individuals: 4 },
  });
  assert.equal(xssInjection.valid, false);
});

test('cloneReadOnlySandbox produces frozen deep copy isolated from live state', () => {
  const state = makeSeedState();
  const sandbox = cloneReadOnlySandbox(state);
  assert.equal(Object.isFrozen(sandbox), true);
  assert.equal(Object.isFrozen(sandbox.persons), true);
  assert.equal(Object.isFrozen(sandbox.persons[0]), true);
  assert.throws(() => {
    (sandbox.persons[0] as { name: string }).name = 'تم التعديل';
  }, TypeError);
  assert.notEqual(state.persons[0].name, 'تم التعديل');
});

test('diagnostics detects dirty records and applyDiagnosticAutoFixes repairs them safely', () => {
  const state = makeSeedState();
  const dirtyState = {
    ...state,
    persons: [
      {
        ...state.persons[0],
        name: '  علي   كاظم  ',
        individuals: -2,
        blockType: 'full' as const,
        status: '' as const,
      },
      ...state.persons.slice(1),
    ],
  };

  const report = runAppDiagnostics(dirtyState, new Date().toISOString());
  assert.ok(report.totalIssues >= 2);
  assert.ok(report.autoFixableCount >= 2);

  const fixed = applyDiagnosticAutoFixes(dirtyState);
  assert.ok(fixed.fixedCount >= 2);
  assert.equal(fixed.nextState.persons[0].name, 'علي كاظم');
  assert.equal(fixed.nextState.persons[0].individuals, 0);
  assert.equal(fixed.nextState.persons[0].status, 'محجوب');
});

test('offline brain runs slot-filling for incomplete add_person and creates confirmation diff', () => {
  const state = makeSeedState();
  const uiContext = makeTestContext(state);

  const step1 = runOfflineBrain({
    prompt: 'ضيف علي جاسم',
    state,
    uiContext,
    slotSession: null,
  });
  assert.equal(step1.handled, true);
  assert.ok(step1.nextSlotSession);
  assert.equal(step1.nextSlotSession?.missingSlot, 'agencyId');
  assert.ok((step1.choices?.length || 0) >= 3);

  const step2 = continueSlotSession(
    step1.nextSlotSession!,
    String(state.agencies[0].id),
    state,
    uiContext
  );
  assert.equal(step2.nextSlotSession?.missingSlot, 'individuals');
  assert.ok((step2.choices?.length || 0) >= 5);

  const step3 = continueSlotSession(
    step2.nextSlotSession!,
    '5',
    state,
    uiContext
  );
  assert.equal(step3.nextSlotSession, null);
  assert.ok(step3.confirmationDiff);
  assert.equal(step3.confirmationDiff?.toolCall.name, 'add_person');
  assert.equal(step3.confirmationDiff?.status, 'pending');
});

test('offline brain tolerates typos and splits compound Iraqi commands safely', () => {
  const state = makeSeedState();
  const uiContext = makeTestContext(state);

  // Typo tolerance on diagnostics ("افحس" -> diagnostics)
  const diagTypo = runOfflineBrain({
    prompt: 'افحس التطبيق',
    state,
    uiContext,
  });
  assert.equal(diagTypo.handled, true);
  assert.equal(diagTypo.toolCall?.name, 'run_diagnostics');

  // Compound command splitting & safe Arabic name with ending و ("ابو علي")
  assert.deepEqual(splitCompoundCommands('ضيف ابو علي 4 أفراد'), ['ضيف ابو علي 4 أفراد']);
  assert.deepEqual(splitCompoundCommands('ضيف علي وحسن واطبع تقرير'), [
    'ضيف علي',
    'ضيف حسن',
    'اطبع تقرير',
  ]);

  const compoundOutcome = runOfflineBrain({
    prompt: 'ضيف علي وحسن واطبع تقرير',
    state,
    uiContext,
  });
  assert.equal(compoundOutcome.handled, true);
  assert.equal(compoundOutcome.compoundSteps?.length, 3);
  assert.equal(compoundOutcome.compoundSteps?.[2].toolCall?.name, 'export_sandbox');
});

test('offline brain uses conversation memory for pronouns, relative delta edits, archive confirmation, and undo', () => {
  const state = makeSeedState();
  const target = state.persons[0];
  const uiContext = makeTestContext(state);
  const memory = {
    lastPersonId: target.id,
    lastPersonName: target.name,
    lastAgencyId: target.agencyId,
  };

  // Relative delta: "زوده فردين"
  const plusOutcome = runOfflineBrain({
    prompt: 'زوده فردين',
    state,
    uiContext,
    memory,
  });
  assert.equal(plusOutcome.handled, true);
  assert.equal(plusOutcome.toolCall?.name, 'update_person');
  assert.equal(plusOutcome.toolCall?.args.personId, target.id);
  assert.equal(plusOutcome.toolCall?.args.individuals, (target.individuals ?? 0) + 2);

  // Archive with pronoun requires confirmation diff: "احذفه"
  const archiveOutcome = runOfflineBrain({
    prompt: 'احذفه',
    state,
    uiContext,
    memory,
  });
  assert.equal(archiveOutcome.handled, true);
  assert.equal(archiveOutcome.confirmationDiff?.toolCall.name, 'archive_person');
  assert.equal(archiveOutcome.confirmationDiff?.toolCall.args.personId, target.id);

  // Undo trigger: "تراجع"
  const undoOutcome = runOfflineBrain({
    prompt: 'تراجع',
    state,
    uiContext,
    memory,
  });
  assert.equal(undoOutcome.handled, true);
  assert.equal(undoOutcome.wantsUndo, true);
});

test('offline brain asks short clarification on low-confidence vague prompt and gives screen-aware suggestions', () => {
  const state = makeSeedState();
  const uiContext = makeTestContext(state);

  const vague = runOfflineBrain({
    prompt: 'غير',
    state,
    uiContext,
  });
  assert.equal(vague.handled, true);
  assert.ok(vague.confidence < 0.65);
  assert.equal(vague.needsClarification, true);
  assert.ok((vague.choices?.length || 0) >= 2);

  const financeSug = getScreenAwareSuggestions('finance');
  assert.ok(financeSug.some((s) => s.prompt.includes('صافي الربح')));

  const rosterSug = getScreenAwareSuggestions('agency_roster', 'حيدر كاظم');
  assert.ok(rosterSug.some((s) => s.label.includes('حيدر')));
});

test('offline brain supports focused row pronoun edit and knowledge-base spotlight', () => {
  const state = makeSeedState();
  const target = state.persons[0];
  const uiContext = {
    ...makeTestContext(state),
    focusedPersonId: target.id,
    focusedPersonName: target.name,
  };

  const editOutcome = runOfflineBrain({
    prompt: 'سوي هذا 9 أفراد',
    state,
    uiContext,
    slotSession: null,
  });
  assert.equal(editOutcome.handled, true);
  assert.ok(editOutcome.toolCall);
  const diff = buildBeforeAfterDiff(state, editOutcome.toolCall!, target.id);
  assert.ok(diff);
  assert.equal(diff?.toolCall.args.personId, target.id);
  assert.equal(diff?.toolCall.args.individuals, 9);

  const guideOutcome = runOfflineBrain({
    prompt: 'وريني القوائم الجاهزة',
    state,
    uiContext,
    slotSession: null,
  });
  assert.equal(guideOutcome.handled, true);
  assert.equal(guideOutcome.toolCall?.name, 'explain_feature');
});

import {
  getEngineDisplayMeta,
  isDeepAnalyticalPrompt,
  planBrainEscalation,
} from './morrowRouter';
import { autoLinkQuickNoteToPerson } from './quickNotesMatcher';
import {
  escapeHtml,
  getExportMemoryFlags,
  sanitizeExcelCellText,
} from './exportFormatting';
import { buildRtlArabicWorksheet } from './excelExport';

test('assistantCache caches safe responses with TTL expiry and rejects mutating tools', () => {
  const now = 1_700_000_000_000;
  const key = buildAssistantCacheKey({
    prompt: 'شكد سعر الطحين؟',
    brainMode: 'auto',
    modelId: PRIMARY_FREE_GEMINI_MODEL,
    activeView: 'hub',
    selectedAgencyId: null,
  });

  let cache: AssistantCacheEntry[] = [];
  cache = setCachedAssistantResponse(
    cache,
    {
      key,
      text: 'سعر الكيس يظهر حسب إعدادات الحساب.',
      engineUsed: 'gemini_2_5_flash',
      engineLabel: 'Gemini 2.5 Flash',
    },
    now
  );
  assert.equal(cache.length, 1);
  assert.ok(getCachedAssistantResponse(cache, key, now + 5_000));
  assert.equal(getCachedAssistantResponse(cache, key, now + 11 * 60 * 1000), null);

  // Mutating tool responses must never be cached
  const mutatingCache = setCachedAssistantResponse(
    cache,
    {
      key: 'mutating-key',
      text: 'تمت الإضافة',
      engineUsed: 'gemini_2_5_flash',
      engineLabel: 'Gemini 2.5 Flash',
      toolCalls: [{ name: 'add_person', args: { name: 'علي' } }],
    },
    now
  );
  assert.equal(mutatingCache.some((c) => c.key === 'mutating-key'), false);
});

test('assistantQuota sanitizes banned/legacy models to gemini-2.5-flash and permits only 2.5-flash / 2.5-pro', () => {
  assert.equal(sanitizeAssistantModelId('gemini-2.0-flash'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-1.5-pro'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-3.1-flash-lite'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-4-hydrogen'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-2.5-flash'), 'gemini-2.5-flash');
  assert.equal(sanitizeAssistantModelId('gemini-2.5-pro'), 'gemini-2.5-pro');

  const now = 1_700_000_000_000;
  let stats = createInitialQuotaStats(now);
  for (let i = 0; i < 8; i++) {
    stats = recordOnlineRequest(stats, PRIMARY_FREE_GEMINI_MODEL, now + i * 10);
  }

  const check = evaluateOnlineQuota(
    stats,
    { ...DEFAULT_ASSISTANT_SETTINGS, dailyRequestLimit: 10, quotaWarningPercent: 80 },
    now + 100
  );
  assert.equal(check.allowed, true);
  assert.equal(check.nearDailyLimit, true);
  assert.equal(check.dailyUsed, 8);

  const exhaustedStats = markQuotaExhausted(stats, 60_000, now);
  const connectivityExhausted = deriveAssistantConnectivity({
    browserOnline: true,
    cloudConfigured: true,
    settings: DEFAULT_ASSISTANT_SETTINGS,
    stats: exhaustedStats,
    nowMs: now + 1000,
  });
  assert.equal(connectivityExhausted, 'quota_exhausted');

  const connectivityHardOffline = deriveAssistantConnectivity({
    browserOnline: true,
    cloudConfigured: true,
    settings: { ...DEFAULT_ASSISTANT_SETTINGS, onlineDisabled: true },
    stats,
    nowMs: now + 1000,
  });
  assert.equal(connectivityHardOffline, 'offline');
});

test('strict 3-brain escalation router routes Morrow Local -> gemini-2.5-flash -> gemini-2.5-pro cleanly', () => {
  const localMeta = getEngineDisplayMeta('morrow_local');
  const flashMeta = getEngineDisplayMeta('gemini_2_5_flash');
  const proMeta = getEngineDisplayMeta('gemini_2_5_pro');
  assert.equal(localMeta.modelId, 'morrow-local');
  assert.equal(flashMeta.modelId, 'gemini-2.5-flash');
  assert.equal(proMeta.modelId, 'gemini-2.5-pro');

  const localHandledPlan = planBrainEscalation({
    prompt: 'اعرض المحجوبين',
    brainMode: 'auto',
    localHandled: true,
    offlineOnly: false,
  });
  assert.equal(localHandledPlan.cloudChain.length, 0);

  const flashEscalation = planBrainEscalation({
    prompt: 'اكتب رسالة رسمية قصيرة للمستفيدين',
    brainMode: 'auto',
    localHandled: false,
    offlineOnly: false,
  });
  assert.deepEqual(flashEscalation.cloudChain, ['gemini-2.5-flash', 'gemini-2.5-pro']);

  assert.equal(isDeepAnalyticalPrompt('اعطنا تحليل عميق وتقييم أداء الوكالات وتوصيات استراتيجية'), true);
  const proEscalation = planBrainEscalation({
    prompt: 'اعطنا تحليل عميق وتقييم أداء الوكالات وتوصيات استراتيجية',
    brainMode: 'auto',
    localHandled: false,
    offlineOnly: false,
  });
  assert.deepEqual(proEscalation.cloudChain, ['gemini-2.5-pro', 'gemini-2.5-flash']);
});

test('semantic anomaly detection triggers on "الرقم غريب" and stealth filters emit stealthAutoExecute', () => {
  const state = makeSeedState();
  const anomalyState = {
    ...state,
    persons: [
      { ...state.persons[0], individuals: 29 },
      ...state.persons.slice(1),
    ],
  };
  const uiContext = makeTestContext(anomalyState);

  const semantic = runOfflineBrain({
    prompt: 'الرقم غريب',
    state: anomalyState,
    uiContext,
  });
  assert.equal(semantic.handled, true);
  assert.ok(semantic.diagnosticsReport);
  assert.ok(semantic.diagnosticsReport!.totalIssues >= 1);
  assert.ok((semantic.choices?.length || 0) >= 1);

  const stealth = runOfflineBrain({
    prompt: 'اعرض المحجوبين',
    state,
    uiContext,
  });
  assert.equal(stealth.handled, true);
  assert.equal(stealth.stealthAutoExecute, true);
  assert.equal(stealth.autoCloseChat, true);
  assert.equal(stealth.toolCall?.name, 'filter_sort_table');
  assert.equal(stealth.toolCall?.args.statusFilter, 'blocked');
});

test('autoLinkQuickNoteToPerson matches beneficiary names cleanly from free Arabic notes', () => {
  const state = makeSeedState();
  const sample = state.persons[0];
  const firstTwoWords = sample.name.split(' ').slice(0, 2).join(' ');
  const res = autoLinkQuickNoteToPerson(
    `ملاحظة عاجلة بخصوص عائلة ${firstTwoWords} مراجعة يوم الخميس`,
    state.persons,
    state.agencies
  );
  assert.ok(res.person);
  assert.equal(res.person?.id, sample.id);
  assert.ok(res.confidence > 0);
});

test('Memory rules, formula injection escaping, HTML escaping, and RTL Excel views work cleanly', () => {
  const flags = getExportMemoryFlags([
    {
      id: 'p1',
      key: 'custom_rule',
      label: 'دائماً أخفي المبلغ في التقارير',
      value: 'true',
      createdAt: '2026-01-01',
    },
    {
      id: 'p2',
      key: 'hide_status_in_reports',
      label: 'إخفاء عمود الحالة',
      value: 'true',
      createdAt: '2026-01-01',
    },
  ]);
  assert.equal(flags.hideAmountColumn, true);
  assert.equal(flags.hideStatusColumn, true);

  assert.equal(sanitizeExcelCellText('=CMD|calc'), "'=CMD|calc");
  assert.equal(sanitizeExcelCellText('حيدر كاظم'), 'حيدر كاظم');
  assert.equal(escapeHtml('<script>علي & أحمد</script>'), '&lt;script&gt;علي &amp; أحمد&lt;/script&gt;');

  const ws = buildRtlArabicWorksheet({
    title: 'كشف وكالة تجريبي',
    headers: ['#', 'الاسم', 'الأفراد'],
    rows: [[1, 'حيدر كاظم', 5]],
  });
  assert.deepEqual(ws['!views'], [{ rightToLeft: true }]);
  assert.ok(Array.isArray(ws['!cols']) && ws['!cols'].length === 3);
});

test('offline brain supports agency comparison, quick notes recording, unblocking, agency transfer, ready lists, and morrow_center suggestions', () => {
  const state = makeSeedState();
  const sample = state.persons[0];
  const sampleFirstTwo = sample.name.split(' ').slice(0, 2).join(' ');
  const blockedPerson = {
    ...sample,
    blockType: 'full' as const,
    blockedIndividuals: sample.individuals ?? 4,
    status: 'محجوب' as const,
    blockReason: 'مراجعة',
  };
  const stateWithBlocked = {
    ...state,
    persons: [blockedPerson, ...state.persons.slice(1)],
  };
  const uiContext = makeTestContext(stateWithBlocked);

  // 1. Compare agencies intent + executor ResultCard
  const cmp = runOfflineBrain({
    prompt: 'قارن بين الوكالات',
    state: stateWithBlocked,
    uiContext,
  });
  assert.equal(cmp.handled, true);
  assert.equal(cmp.toolCall?.name, 'compare_agencies');

  let capturedNoteText = '';
  const noopRuntime: AssistantActionRuntime = {
    state: stateWithBlocked,
    uiContext,
    mutations: {
      addPersonDirect: () => {},
      updatePersonConfirmed: () => {},
      createReadyList: () => 1,
      addPersonsToReadyList: () => 1,
      addExpense: () => {},
      upsertRelationEntry: () => {},
    },
    navigate: () => {},
    selectAgency: () => {},
    focusPerson: () => {},
    issueTableCommand: () => {},
    triggerSpotlight: () => {},
    setModeTier: () => {},
    setAppTheme: () => {},
    setDarkTheme: () => {},
    setAllowCloudNames: () => {},
    saveUserPref: () => {},
    deleteUserPref: () => {},
    applyAutoFixes: () => ({ fixedCount: 0, summaryLines: [] }),
    exportBackupJson: () => {},
    archiveCurrentPeriod: () => {},
    addQuickNote: ({ text }) => {
      capturedNoteText = text;
      return {
        id: 'qn_test',
        text,
        source: 'voice',
        createdAt: new Date().toISOString(),
        syncedToPersonNotes: true,
      };
    },
  };

  const cmpExec = resolveToolExecution(cmp.toolCall!, noopRuntime);
  assert.ok(cmpExec.resultCard);
  assert.ok((cmpExec.resultCard?.bars?.length || 0) >= state.agencies.length);

  // 2. Quick note intent + executor callback
  const noteCmd = runOfflineBrain({
    prompt: `سجل ملاحظة: مراجعة عائلة ${sampleFirstTwo} يوم الأحد`,
    state: stateWithBlocked,
    uiContext,
  });
  assert.equal(noteCmd.handled, true);
  assert.equal(noteCmd.toolCall?.name, 'add_quick_note');
  const noteExec = resolveToolExecution(noteCmd.toolCall!, noopRuntime);
  assert.equal(noteExec.gracefulLevel, 'A');
  assert.ok(capturedNoteText.includes('مراجعة'));

  // 3. Unblocking ("فك الحظر عن ...") before archive/block
  const unblockCmd = runOfflineBrain({
    prompt: `فك الحظر عن ${sampleFirstTwo}`,
    state: stateWithBlocked,
    uiContext,
  });
  assert.equal(unblockCmd.handled, true);
  assert.equal(unblockCmd.confirmationDiff?.toolCall.name, 'update_person');
  assert.equal(unblockCmd.confirmationDiff?.toolCall.args.blockType, 'none');

  // 4. Transfer to another agency ("انقل ... وكالة 2")
  const targetAgency = state.agencies[1] || state.agencies[0];
  const transferState = {
    ...state,
    persons: [{ ...sample, agencyId: state.agencies[0].id }, ...state.persons.slice(1)],
  };
  if (state.agencies.length >= 2) {
    const transferCmd = runOfflineBrain({
      prompt: `انقل ${sampleFirstTwo} إلى ${targetAgency.name}`,
      state: transferState,
      uiContext: makeTestContext(transferState),
    });
    assert.equal(transferCmd.handled, true);
    assert.equal(transferCmd.confirmationDiff?.toolCall.name, 'update_person');
    assert.equal(transferCmd.confirmationDiff?.toolCall.args.agencyId, targetAgency.id);
  }

  // 5. Ready list creation ("انشئ قائمة جاهزة مستحقين الصباح")
  const listCmd = runOfflineBrain({
    prompt: 'انشئ قائمة جاهزة مستحقين الصباح',
    state,
    uiContext,
  });
  assert.equal(listCmd.handled, true);
  assert.equal(listCmd.confirmationDiff?.toolCall.name, 'manage_ready_list');
  assert.equal(listCmd.confirmationDiff?.toolCall.args.action, 'create');

  // 6. Screen-aware suggestions for morrow_center
  const morrowSug = getScreenAwareSuggestions('morrow_center');
  assert.ok(morrowSug.some((s) => s.prompt.includes('قارن بين الوكالات')));
});

