import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DATABASE_STATE } from '../data/seedData';
import {
  AI_FREE_MODELS,
  AI_ROUTING_PIPELINES,
  ALL_REGISTERED_CLOUD_MODELS,
  DEFAULT_TASK_ROUTING,
  MORROW_LOCAL_MODEL_ID,
  SIX_FREE_CLOUD_MODELS,
  formatMatrixAsCsvMarkdown,
  resolveCollaborativeReviewerChain,
  resolveOrderedTaskChain,
} from '../aiConfig';
import {
  CORE_SIX_SPECIALIZED_MODELS,
  SAFETY_FALLBACK_MODELS,
  classifyPromptSpecialtyAndPriority,
  detectWeakAssistantPayload,
  executeWithSmartFallback,
  getModelHealthSnapshot,
  markModelSuccess,
  resetModelHealthRegistry,
} from '../lib/aiConfig';
import {
  applyServerHealthOrdering,
  detectModelOutputWeakness,
  markServerModelFailure,
  markServerModelSuccess,
  resetServerModelHealth,
} from '../server/aiOrchestrator';
import { evaluateZeroTrustCell } from './zeroTrustExtract';
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
  buildLiveWorkspaceContext,
  enforceSafeArabicTerminology,
  normalizeIraqiDialect,
  redactPotentialPiiText,
} from './assistantPrivacy';
import { findKnowledgeEntry } from './assistantKnowledgeBase';
import {
  createInitialQuotaStats,
  DEFAULT_ASSISTANT_SETTINGS,
  deriveAssistantConnectivity,
  evaluateOnlineQuota,
  markQuotaExhausted,
  normalizeAssistantSettings,
  PRIMARY_FREE_GEMINI_MODEL,
  recordOnlineRequest,
  sanitizeAssistantModelId,
} from './assistantQuota';
import {
  buildBeforeAfterDiff,
  cloneReadOnlySandbox,
  computeWhatIfSimulation,
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
    themeId: state.themePrefs?.appTheme || 'abyssal-emerald',
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
      engineUsed: 'gemini_3_5_flash',
      engineLabel: 'Gemini 3.5 Flash',
      modelId: 'gemini-3.5-flash',
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
      engineUsed: 'gemini_3_8_flash',
      engineLabel: 'Gemini 3.8 Flash',
      modelId: 'gemini-3.8-flash',
      toolCalls: [{ name: 'add_person', args: { name: 'علي' } }],
    },
    now
  );
  assert.equal(mutatingCache.some((c) => c.key === 'mutating-key'), false);
});

test('aiConfig and assistantQuota register 6 free models, sanitize legacy models, and format CSV/Markdown', () => {
  assert.equal(SIX_FREE_CLOUD_MODELS.length, 6);
  assert.ok(ALL_REGISTERED_CLOUD_MODELS.some((m) => m.id === 'gemini-3.8-flash'));
  assert.ok(ALL_REGISTERED_CLOUD_MODELS.some((m) => m.id === 'gemini-3.8-live'));
  const googleCount = SIX_FREE_CLOUD_MODELS.filter((m) => m.provider === 'google').length;
  const externalCount = SIX_FREE_CLOUD_MODELS.filter((m) => m.provider !== 'google').length;
  assert.equal(googleCount, 3);
  assert.equal(externalCount, 3);

  assert.equal(sanitizeAssistantModelId('gemini-2.0-flash'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-1.5-pro'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-2.5-flash'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-2.5-pro'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-3.1-flash-lite'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-4-hydrogen'), PRIMARY_FREE_GEMINI_MODEL);
  assert.equal(sanitizeAssistantModelId('gemini-3.5-transcribe'), PRIMARY_FREE_GEMINI_MODEL);

  assert.equal(sanitizeAssistantModelId('gemini-3.8-flash'), AI_FREE_MODELS.GEMINI_3_8_FLASH);
  assert.equal(sanitizeAssistantModelId('gemini-3.8-live'), AI_FREE_MODELS.GEMINI_3_8_LIVE);
  assert.equal(sanitizeAssistantModelId('gemini-3.5-flash'), AI_FREE_MODELS.GEMINI_3_5_FLASH);
  assert.equal(sanitizeAssistantModelId('gemini-3.5-flash-lite'), AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE);
  assert.equal(sanitizeAssistantModelId('whisper-large-v3-turbo'), AI_FREE_MODELS.GROQ_WHISPER_TURBO);
  assert.equal(sanitizeAssistantModelId('nvidia/nemotron-3.5-super-vl:free'), AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL);
  assert.equal(sanitizeAssistantModelId('openrouter/free'), AI_FREE_MODELS.OPENROUTER_FREE_AUTO);

  const md = formatMatrixAsCsvMarkdown([
    ['الاسم', 'الافراد'],
    ['علي حسن', '5'],
  ]);
  assert.ok(md.includes('### Markdown Table Preview'));
  assert.ok(md.includes('### Full CSV Data'));
  assert.ok(md.includes('| الاسم | الافراد |'));
  assert.ok(md.includes('علي حسن,5'));

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

test('priority-ordered AI router preserves Morrow Local and escalates across the 6 free models by task', () => {
  const localMeta = getEngineDisplayMeta('morrow_local');
  const heavyMeta = getEngineDisplayMeta('gemini_3_8_flash');
  const balancedMeta = getEngineDisplayMeta('gemini_3_5_flash');
  const liteMeta = getEngineDisplayMeta('gemini_3_5_flash_lite');
  const nemotronMeta = getEngineDisplayMeta('nemotron_free');
  const orMeta = getEngineDisplayMeta('openrouter_free');
  const whisperMeta = getEngineDisplayMeta('whisper_large_v3_turbo');

  assert.equal(localMeta.modelId, 'morrow-local');
  assert.equal(heavyMeta.modelId, 'gemini-3.8-flash');
  assert.equal(balancedMeta.modelId, 'gemini-3.5-flash');
  assert.equal(liteMeta.modelId, 'gemini-3.5-flash-lite');
  assert.equal(nemotronMeta.modelId, 'nvidia/nemotron-3.5-super-vl:free');
  assert.equal(orMeta.modelId, 'openrouter/free');
  assert.equal(whisperMeta.modelId, 'whisper-large-v3-turbo');

  assert.equal(AI_ROUTING_PIPELINES.audio[0], 'whisper-large-v3-turbo');
  assert.deepEqual(AI_ROUTING_PIPELINES.heavy_extraction.slice(0, 3), [
    'gemini-3.8-flash',
    'nvidia/nemotron-3.5-super-vl:free',
    'gemini-3.5-flash',
  ]);
  assert.deepEqual(AI_ROUTING_PIPELINES.data_processing.slice(0, 3), [
    'gemini-3.5-flash',
    'nvidia/nemotron-3.5-super-vl:free',
    'openrouter/free',
  ]);
  assert.deepEqual(AI_ROUTING_PIPELINES.fast_assistant.slice(0, 2), [
    'gemini-3.5-flash-lite',
    'openrouter/free',
  ]);

  // Default routingStrategy ('strongest_first'): commands escalate Strongest Cloud -> Backup -> Descending -> Morrow Local anchor
  const strongestDefaultPlan = planBrainEscalation({
    prompt: 'اعرض المحجوبين',
    brainMode: 'auto',
    localHandled: true,
    offlineOnly: false,
  });
  assert.equal(strongestDefaultPlan.tryLocalFirst, false);
  assert.equal(strongestDefaultPlan.taskKey, 'command_orchestration');
  assert.equal(strongestDefaultPlan.finalAnchorModel, MORROW_LOCAL_MODEL_ID);
  assert.equal(strongestDefaultPlan.cloudChain[0], 'gemini-3.8-flash');
  assert.deepEqual(strongestDefaultPlan.cloudChain.slice(0, 3), [
    'gemini-3.8-flash',
    'nvidia/nemotron-3.5-super-vl:free',
    'gemini-3.5-flash',
  ]);

  const strongestFastPrompt = planBrainEscalation({
    prompt: 'اكتب رسالة رسمية قصيرة',
    brainMode: 'auto',
    localHandled: false,
    offlineOnly: false,
  });
  assert.equal(strongestFastPrompt.cloudChain[0], 'gemini-3.8-flash');
  assert.equal(strongestFastPrompt.finalAnchorModel, 'morrow-local');

  // Custom per-task primary & backup routing override
  const customNormalized = normalizeAssistantSettings({
    routingStrategy: 'strongest_first',
    taskRouting: {
      ...DEFAULT_TASK_ROUTING,
      command_orchestration: {
        primaryModelId: 'gemini-3.5-flash',
        backupModelId: 'openrouter/free',
        finalLocalFallback: true,
      },
    },
  });
  const customChain = resolveOrderedTaskChain('command_orchestration', customNormalized.taskRouting);
  assert.equal(customChain.cloudChain[0], 'gemini-3.5-flash');
  assert.equal(customChain.cloudChain[1], 'openrouter/free');
  assert.equal(customChain.finalAnchorModel, 'morrow-local');

  const customPlan = planBrainEscalation({
    prompt: 'اكتب رسالة رسمية قصيرة',
    brainMode: 'auto',
    localHandled: false,
    offlineOnly: false,
    routingStrategy: customNormalized.routingStrategy,
    taskRouting: customNormalized.taskRouting,
  });
  assert.equal(customPlan.cloudChain[0], 'gemini-3.5-flash');
  assert.equal(customPlan.cloudChain[1], 'openrouter/free');

  // Explicit Economy Mode ('local_first_economy'): local handles zero-latency deterministic commands first
  const localHandledEconomyPlan = planBrainEscalation({
    prompt: 'اعرض المحجوبين',
    brainMode: 'auto',
    localHandled: true,
    offlineOnly: false,
    routingStrategy: 'local_first_economy',
  });
  assert.equal(localHandledEconomyPlan.tryLocalFirst, true);
  assert.equal(localHandledEconomyPlan.cloudChain.length, 0);

  const economyFastEscalation = planBrainEscalation({
    prompt: 'اكتب رسالة رسمية قصيرة',
    brainMode: 'auto',
    localHandled: false,
    offlineOnly: false,
    routingStrategy: 'local_first_economy',
  });
  assert.equal(economyFastEscalation.pipeline, 'fast_assistant');
  assert.deepEqual(economyFastEscalation.cloudChain.slice(0, 2), ['gemini-3.5-flash-lite', 'openrouter/free']);

  const excelEscalation = planBrainEscalation({
    prompt: 'نظم جدول excel لبيانات الوكالات',
    brainMode: 'auto',
    localHandled: false,
    offlineOnly: false,
  });
  assert.equal(excelEscalation.pipeline, 'data_processing');
  assert.equal(excelEscalation.taskKey, 'structured_excel_csv');
  assert.deepEqual(excelEscalation.cloudChain.slice(0, 3), [
    'gemini-3.5-flash',
    'nvidia/nemotron-3.5-super-vl:free',
    'gemini-3.8-flash',
  ]);

  assert.equal(isDeepAnalyticalPrompt('اعطنا تحليل عميق وتقييم أداء الوكالات وتوصيات استراتيجية'), true);
  const deepEscalation = planBrainEscalation({
    prompt: 'اعطنا تحليل عميق وتقييم أداء الوكالات وتوصيات استراتيجية',
    brainMode: 'auto',
    localHandled: false,
    offlineOnly: false,
  });
  assert.equal(deepEscalation.pipeline, 'deep_assistant');
  assert.deepEqual(deepEscalation.cloudChain.slice(0, 3), [
    'gemini-3.8-flash',
    'nvidia/nemotron-3.5-super-vl:free',
    'gemini-3.5-flash',
  ]);
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

test('src/lib/aiConfig defines the 6 core specialized models + safety fallbacks and ranks priorities by specialty', () => {
  resetModelHealthRegistry();

  const coreIds = CORE_SIX_SPECIALIZED_MODELS.map((m) => m.id);
  assert.equal(coreIds.length, 6);
  assert.deepEqual(coreIds, [
    'gemini-3.8-flash',
    'gemini-3.8-live',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'whisper-large-v3-turbo',
    'nvidia/nemotron-3.5-super-vl:free',
  ]);
  assert.ok(SAFETY_FALLBACK_MODELS.some((m) => m.id === 'openrouter/free'));
  assert.ok(SAFETY_FALLBACK_MODELS.some((m) => m.id === 'morrow-local'));

  const audioRouting = classifyPromptSpecialtyAndPriority({
    prompt: 'فرغ الرسالة الصوتية',
    modality: 'audio',
    brainMode: 'auto',
  });
  assert.equal(audioRouting.specialty, 'audio_transcription');
  assert.equal(audioRouting.primaryModelId, 'whisper-large-v3-turbo');

  const liveRouting = classifyPromptSpecialtyAndPriority({
    prompt: 'جلسة صوتية حية',
    modality: 'live_session',
    brainMode: 'auto',
  });
  assert.equal(liveRouting.specialty, 'live_realtime_session');
  assert.equal(liveRouting.primaryModelId, 'gemini-3.8-live');

  const pdfRouting = classifyPromptSpecialtyAndPriority({
    prompt: 'اقرأ ملف PDF هذا واستخرج الجداول',
    modality: 'pdf_vision',
    brainMode: 'auto',
  });
  assert.equal(pdfRouting.specialty, 'heavy_pdf_vision');
  assert.equal(pdfRouting.primaryModelId, 'gemini-3.8-flash');
  assert.equal(pdfRouting.backupModelId, 'nvidia/nemotron-3.5-super-vl:free');

  const sheetRouting = classifyPromptSpecialtyAndPriority({
    prompt: 'نظم بيانات Excel وأخرج ملخص CSV',
    modality: 'spreadsheet',
    brainMode: 'auto',
  });
  assert.equal(sheetRouting.specialty, 'structured_excel_csv');
  assert.equal(sheetRouting.primaryModelId, 'gemini-3.5-flash');

  const fastGreeting = classifyPromptSpecialtyAndPriority({
    prompt: 'مرحبا',
    modality: 'chat',
    brainMode: 'auto',
  });
  assert.equal(fastGreeting.specialty, 'fast_copilot_actions');
  assert.equal(fastGreeting.primaryModelId, 'gemini-3.5-flash-lite');

  const deepOrchestration = classifyPromptSpecialtyAndPriority({
    prompt: 'اعطنا تحليل استراتيجي شامل لأداء جميع الوكالات والمقارنة المالية',
    modality: 'chat',
    brainMode: 'auto',
  });
  assert.equal(deepOrchestration.specialty, 'command_orchestration');
  assert.equal(deepOrchestration.primaryModelId, 'gemini-3.8-flash');
});

test('executeWithSmartFallback fails over cleanly on 503/429, honors circuit-breaker cooldowns, and stops on user abort', async () => {
  resetModelHealthRegistry();

  const switches: string[] = [];
  const res = await executeWithSmartFallback({
    priorityModels: [
      'gemini-3.8-flash',
      'nvidia/nemotron-3.5-super-vl:free',
      'gemini-3.5-flash',
    ],
    onFallbackSwitch: ({ fromModelId, toModelId }) => {
      switches.push(`${fromModelId}->${toModelId}`);
    },
    executor: async (modelId) => {
      if (modelId === 'gemini-3.8-flash') {
        throw new Error('503 Service Unavailable - high demand');
      }
      if (modelId === 'nvidia/nemotron-3.5-super-vl:free') {
        throw new Error('429 Rate limit reached');
      }
      return { value: `ok:${modelId}` };
    },
  });

  assert.equal(res.ok, true);
  assert.equal(res.data, 'ok:gemini-3.5-flash');
  assert.equal(res.usedModelId, 'gemini-3.5-flash');
  assert.equal(res.fallbackUsed, true);
  assert.equal(res.quotaOrRateLimited, true);
  assert.equal(res.attempts.length, 3);
  assert.deepEqual(switches, [
    'gemini-3.8-flash->nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3.5-super-vl:free->gemini-3.5-flash',
  ]);

  // Circuit-breaker puts failed models in cooldown so healthy model is prioritized first
  assert.equal(getModelHealthSnapshot('gemini-3.8-flash').status, 'cooldown');
  assert.equal(getModelHealthSnapshot('nvidia/nemotron-3.5-super-vl:free').status, 'cooldown');
  assert.equal(getModelHealthSnapshot('gemini-3.5-flash').status, 'healthy');

  const nextDecision = classifyPromptSpecialtyAndPriority({
    prompt: 'حلل أداء الوكالات وتوزيع الحصص بالتفصيل',
    brainMode: 'auto',
  });
  assert.equal(nextDecision.healthyPriorityOrder[0], 'gemini-3.5-flash');

  // Recover primary model health via markModelSuccess
  markModelSuccess('gemini-3.8-flash', 280);
  assert.equal(getModelHealthSnapshot('gemini-3.8-flash').status, 'healthy');

  // External abort stops immediately without invoking backup models
  const controller = new AbortController();
  const attemptedOnAbort: string[] = [];
  const abortRes = await executeWithSmartFallback({
    priorityModels: ['gemini-3.8-flash', 'gemini-3.5-flash'],
    externalSignal: controller.signal,
    executor: async (modelId, signal) => {
      attemptedOnAbort.push(modelId);
      controller.abort();
      if (signal.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      return { value: 'unreachable' };
    },
  });
  assert.equal(abortRes.ok, false);
  assert.equal(abortRes.abortedByUser, true);
  assert.deepEqual(attemptedOnAbort, ['gemini-3.8-flash']);

  resetModelHealthRegistry();
});

test('validateToolCall validates and sanitizes run_morrow_macro, analyze_period_forecast, and summon_workspace_canvas', () => {
  const validMacro = validateToolCall({
    name: 'run_morrow_macro',
    args: { triggerPhrase: 'إغلاق الشهر' },
  });
  assert.equal(validMacro.valid, true);
  assert.equal(validMacro.sanitized?.args.triggerPhrase, 'إغلاق الشهر');

  const validForecast = validateToolCall({
    name: 'analyze_period_forecast',
    args: { agencyId: 1 },
  });
  assert.equal(validForecast.valid, true);
  assert.equal(validForecast.sanitized?.args.agencyId, 1);

  const validCanvas = validateToolCall({
    name: 'summon_workspace_canvas',
    args: { canvasMode: 'text_analysis', agencyId: 2 },
  });
  assert.equal(validCanvas.valid, true);
  assert.equal(validCanvas.sanitized?.args.canvasMode, 'text_analysis');
  assert.equal(validCanvas.sanitized?.args.agencyId, 2);

  // Invalid canvasMode safely falls back to overview_charts
  const invalidCanvasMode = validateToolCall({
    name: 'summon_workspace_canvas',
    args: { canvasMode: 'unknown_panel' },
  });
  assert.equal(invalidCanvasMode.valid, true);
  assert.equal(invalidCanvasMode.sanitized?.args.canvasMode, 'overview_charts');

  // SQL/XSS payloads rejected even on new tools
  const badMacroXss = validateToolCall({
    name: 'run_morrow_macro',
    args: { triggerPhrase: '<script>alert(1)</script>' },
  });
  assert.equal(badMacroXss.valid, false);
});

test('normalizeAssistantSettings preserves collaborationMode and resolveCollaborativeReviewerChain picks complementary models', () => {
  assert.equal(normalizeAssistantSettings({}).collaborationMode, 'council_review');
  assert.equal(
    normalizeAssistantSettings({ collaborationMode: 'multi_step_agent' }).collaborationMode,
    'multi_step_agent'
  );
  assert.equal(
    normalizeAssistantSettings({ collaborationMode: 'single' }).collaborationMode,
    'single'
  );
  assert.equal(
    normalizeAssistantSettings({ collaborationMode: 'bad_value' as never }).collaborationMode,
    'council_review'
  );

  const reviewFor38 = resolveCollaborativeReviewerChain('gemini-3.8-flash', 'command_orchestration');
  assert.ok(reviewFor38.length >= 2);
  assert.equal(reviewFor38.includes('gemini-3.8-flash'), false);
  assert.equal(reviewFor38[0], 'nvidia/nemotron-3.5-super-vl:free');

  const reviewForNemotron = resolveCollaborativeReviewerChain(
    'nvidia/nemotron-3.5-super-vl:free',
    'heavy_pdf_vision'
  );
  assert.equal(reviewForNemotron.includes('nvidia/nemotron-3.5-super-vl:free'), false);
  assert.equal(reviewForNemotron[0], 'gemini-3.8-flash');
});

test('offline brain and executor handle forecast, macro execution (zero-trust drafts), and workspace canvas summoning', () => {
  const state = makeSeedState();
  const uiContext = makeTestContext(state);
  const initialPersonCount = state.persons.length;

  let openedCanvasMode = '';
  const runtime: AssistantActionRuntime = {
    state,
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
    openCanvasMode: (canvasMode) => {
      openedCanvasMode = canvasMode;
    },
    setModeTier: () => {},
    setAppTheme: () => {},
    setDarkTheme: () => {},
    setAllowCloudNames: () => {},
    saveUserPref: () => {},
    deleteUserPref: () => {},
    applyAutoFixes: () => ({ fixedCount: 0, summaryLines: [] }),
    exportBackupJson: () => {},
    archiveCurrentPeriod: () => {},
    addQuickNote: ({ text }) => ({
      id: 'qn_test',
      text,
      source: 'text',
      createdAt: new Date().toISOString(),
      syncedToPersonNotes: false,
    }),
  };

  // 1. Forecast tool end-to-end
  const forecastOutcome = runOfflineBrain({
    prompt: 'توقعات الشهر القادم',
    state,
    uiContext,
  });
  assert.equal(forecastOutcome.handled, true);
  assert.equal(forecastOutcome.toolCall?.name, 'analyze_period_forecast');
  const forecastExec = resolveToolExecution(forecastOutcome.toolCall!, runtime);
  assert.equal(forecastExec.gracefulLevel, 'A');
  assert.ok(forecastExec.resultCard);
  assert.equal(forecastExec.canvasHandoff?.canvasMode, 'forecast');

  // 2. Macro execution end-to-end (non-mutating, prepares drafts for approval)
  const macroOutcome = runOfflineBrain({
    prompt: 'شغل ماكرو إغلاق الشهر',
    state,
    uiContext,
  });
  assert.equal(macroOutcome.handled, true);
  assert.equal(macroOutcome.toolCall?.name, 'run_morrow_macro');
  const macroExec = resolveToolExecution(macroOutcome.toolCall!, runtime);
  assert.equal(macroExec.gracefulLevel, 'A');
  assert.ok(macroExec.resultCard);
  assert.equal(macroExec.canvasHandoff?.canvasMode, 'macro_studio');
  assert.ok((macroExec.extraDraftTools?.length || 0) >= 1);
  assert.equal(state.persons.length, initialPersonCount);

  // 3. Summon workspace canvas end-to-end
  const summonOutcome = runOfflineBrain({
    prompt: 'افتح محلل النصوص',
    state,
    uiContext,
  });
  assert.equal(summonOutcome.handled, true);
  assert.equal(summonOutcome.toolCall?.name, 'summon_workspace_canvas');
  const summonExec = resolveToolExecution(summonOutcome.toolCall!, runtime);
  assert.equal(summonExec.gracefulLevel, 'A');
  assert.equal(openedCanvasMode, 'text_analysis');
  assert.equal(summonExec.canvasHandoff?.canvasMode, 'text_analysis');
});

test('computeWhatIfSimulation simulates fee, percentage headcount, and kg deltas without mutating state', () => {
  const state = makeSeedState();
  const baseFee = state.calculationSettings.feePerIndividualIqd;
  const targetFee = baseFee + 250;
  const snapshotBefore = JSON.stringify(state);

  const feeSim = computeWhatIfSimulation(state, { feePerIndividualIqd: targetFee });
  assert.ok(feeSim.simulated.revenue > feeSim.current.revenue);
  assert.equal(feeSim.deltas.profit, feeSim.deltas.revenue);
  assert.equal(feeSim.simulatedSettingsPatch?.feePerIndividualIqd, targetFee);
  assert.equal(feeSim.deltas.individuals, 0);

  const pctSim = computeWhatIfSimulation(state, { individualsDeltaPercent: 10 });
  assert.ok(pctSim.simulated.activeIndividuals > pctSim.current.activeIndividuals);
  assert.ok(pctSim.deltas.totalKg > 0);
  assert.equal(pctSim.simulatedSettingsPatch, undefined);

  const kgSim = computeWhatIfSimulation(state, { kgPerIndividual: 11 });
  assert.notEqual(kgSim.deltas.totalKg, 0);
  assert.equal(kgSim.simulatedSettingsPatch?.kgPerIndividual, 11);

  assert.equal(JSON.stringify(state), snapshotBefore);
});

test('offline brain and executor handle What-If simulation, Executive Briefing, and status breakdown while preserving stealth filter', () => {
  const state = makeSeedState();
  const sample = state.persons[0];
  const blockedSample = {
    ...sample,
    blockType: 'full' as const,
    blockedIndividuals: sample.individuals ?? 4,
    status: 'محجوب' as const,
    blockReason: 'مراجعة',
  };
  const testState = {
    ...state,
    persons: [blockedSample, ...state.persons.slice(1)],
  };
  const uiContext = makeTestContext(testState);

  const runtime: AssistantActionRuntime = {
    state: testState,
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
    openCanvasMode: () => {},
    setModeTier: () => {},
    setAppTheme: () => {},
    setDarkTheme: () => {},
    setAllowCloudNames: () => {},
    saveUserPref: () => {},
    deleteUserPref: () => {},
    applyAutoFixes: () => ({ fixedCount: 0, summaryLines: [] }),
    exportBackupJson: () => {},
    archiveCurrentPeriod: () => {},
    addQuickNote: ({ text }) => ({
      id: 'qn_test',
      text,
      source: 'text',
      createdAt: new Date().toISOString(),
      syncedToPersonNotes: false,
    }),
  };

  // 1. Fee simulation: "ماذا لو رسم الفرد 500"
  const whatIfFee = runOfflineBrain({
    prompt: 'ماذا لو رسم الفرد 500',
    state: testState,
    uiContext,
  });
  assert.equal(whatIfFee.handled, true);
  assert.equal(whatIfFee.toolCall?.name, 'simulate_what_if');
  assert.equal(whatIfFee.toolCall?.args.feePerIndividualIqd, 500);
  const whatIfExec = resolveToolExecution(whatIfFee.toolCall!, runtime);
  assert.equal(whatIfExec.gracefulLevel, 'A');
  assert.ok(whatIfExec.resultCard);
  assert.ok(
    whatIfExec.choices?.some((c) =>
      String(c.payload?.prompt || '').includes('خلّي رسم الفرد 500')
    )
  );

  // 2. Headcount percentage simulation: "لو زادوا الأفراد 10%"
  const whatIfPct = runOfflineBrain({
    prompt: 'لو زادوا الأفراد 10%',
    state: testState,
    uiContext,
  });
  assert.equal(whatIfPct.handled, true);
  assert.equal(whatIfPct.toolCall?.name, 'simulate_what_if');
  assert.equal(whatIfPct.toolCall?.args.individualsDeltaPercent, 10);

  // 3. Executive briefing: "أعطني ملخص اليوم"
  const briefing = runOfflineBrain({
    prompt: 'أعطني ملخص اليوم',
    state: testState,
    uiContext,
  });
  assert.equal(briefing.handled, true);
  assert.equal(briefing.toolCall?.name, 'executive_briefing');
  const briefingExec = resolveToolExecution(briefing.toolCall!, runtime);
  assert.equal(briefingExec.gracefulLevel, 'A');
  assert.ok(briefingExec.resultCard);
  assert.ok(briefingExec.canvasHandoff);

  // 4. Analytical status breakdown: "من هم المحجوبين"
  const statusQ = runOfflineBrain({
    prompt: 'من هم المحجوبين',
    state: testState,
    uiContext,
  });
  assert.equal(statusQ.handled, true);
  assert.equal(statusQ.toolCall?.name, 'query_status_breakdown');
  const statusExec = resolveToolExecution(statusQ.toolCall!, runtime);
  assert.equal(statusExec.gracefulLevel, 'A');
  assert.ok(statusExec.replyText.includes('المحجوبة'));
  assert.ok(statusExec.choices?.some((c) => c.actionType === 'select_person'));

  // 5. Stealth filter preserved for imperative command: "اعرض المحجوبين"
  const stealthFilter = runOfflineBrain({
    prompt: 'اعرض المحجوبين',
    state: testState,
    uiContext,
  });
  assert.equal(stealthFilter.handled, true);
  assert.equal(stealthFilter.stealthAutoExecute, true);
  assert.equal(stealthFilter.toolCall?.name, 'filter_sort_table');
  assert.equal(stealthFilter.toolCall?.args.statusFilter, 'blocked');
});

test('normalizeAssistantSettings preserves valid responseStyle and defaults invalid values to balanced', () => {
  assert.equal(normalizeAssistantSettings({}).responseStyle, 'balanced');
  assert.equal(
    normalizeAssistantSettings({ responseStyle: 'financial_auditor' }).responseStyle,
    'financial_auditor'
  );
  assert.equal(
    normalizeAssistantSettings({ responseStyle: 'concise' }).responseStyle,
    'concise'
  );
  assert.equal(
    normalizeAssistantSettings({ responseStyle: 'deep_advisor' }).responseStyle,
    'deep_advisor'
  );
  assert.equal(
    normalizeAssistantSettings({ responseStyle: 'unknown_style' as never }).responseStyle,
    'balanced'
  );
});

test('findKnowledgeEntry resolves morrow_command_center, smart_models_hub, and account_and_device_autosave', () => {
  const morrowEntry = findKnowledgeEntry('شرح مركز morrow وقواعد الذاكرة الدائمة');
  assert.ok(morrowEntry);
  assert.equal(morrowEntry.id, 'morrow_command_center');

  const smartModelsEntry = findKnowledgeEntry('مساحة النماذج الذكية والتدقيق الآلي');
  assert.ok(smartModelsEntry);
  assert.equal(smartModelsEntry.id, 'smart_models_hub');

  const autosaveEntry = findKnowledgeEntry('الحفظ التلقائي على الجهاز وحالة حسابي');
  assert.ok(autosaveEntry);
  assert.equal(autosaveEntry.id, 'account_and_device_autosave');
});

test('buildLiveWorkspaceContext includes extended counts for relations, ready lists, notes, recycle bin, expenses, and UCRS', () => {
  const state = makeSeedState();
  state.workspaceNotes = [
    {
      id: 'note-1',
      title: 'ملاحظة حفظ',
      content: 'اختبار',
      category: 'quick',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  state.ucrsSessions = [
    {
      id: 'ucrs-1',
      title: 'جلسة سحب 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sources: [],
      rows: [],
      summary: {
        totalRows: 0,
        matchedRows: 0,
        unmatchedRows: 0,
        doubtRows: 0,
        totalIndividuals: 0,
      },
    } as never,
  ];
  state.ucrsLearningRules = [
    {
      id: 'rule-1',
      pattern: 'test',
      targetAgencyId: state.agencies[0]?.id || 1,
      createdAt: new Date().toISOString(),
    } as never,
  ];

  const live = buildLiveWorkspaceContext(state, {
    quickNotesCount: 3,
    pendingDraftsCount: 2,
  });

  assert.equal(live.quickNotesCount, 3);
  assert.equal(live.pendingDraftsCount, 2);
  assert.equal(live.relationsCount, state.relations.length);
  assert.equal(live.readyListsCount, state.readyLists.length);
  assert.equal(live.workspaceNotesCount, 1);
  assert.equal(live.recycleBinCount, (state.recycleBin || []).length);
  assert.equal(live.totalExpensesCount, state.expenses.length);
  assert.equal(live.ucrsSessionsCount, 1);
  assert.equal(live.ucrsLearningRulesCount, 1);
});

test('server AI orchestrator detects comprehension failures and orders healthy models first', () => {
  resetServerModelHealth();

  // Weak refusal without tool call triggers comprehension failure switch
  assert.equal(
    detectModelOutputWeakness({
      text: 'عذراً، لم أفهم طلبك بدقة، هل يمكنك التوضيح؟',
      toolCalls: [],
      detectComprehensionFailure: true,
    }),
    'model_comprehension_or_refusal'
  );

  // Valid structured tool call bypasses text weakness check
  assert.equal(
    detectModelOutputWeakness({
      text: 'عذراً',
      toolCalls: [{ name: 'navigate_focus', args: { view: 'dashboard' } }],
      detectComprehensionFailure: true,
    }),
    null
  );

  // Invalid JSON for JSON mode is rejected for instant failover
  assert.equal(
    detectModelOutputWeakness({
      text: 'ليس بصيغة JSON صالحة',
      toolCalls: [],
      responseMimeType: 'application/json',
    }),
    'malformed_json_output'
  );

  assert.equal(
    detectModelOutputWeakness({
      text: '{"ok":true}',
      toolCalls: [],
      responseMimeType: 'application/json',
    }),
    null
  );

  // Server health ordering pushes cooled-down/weak model behind healthy backup
  const baseChain = [
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
  ];
  markServerModelFailure(AI_FREE_MODELS.GEMINI_3_8_FLASH, 'weak_reply', 1000);
  const reordered = applyServerHealthOrdering(baseChain, 1500);
  assert.equal(reordered[0], AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL);
  assert.equal(reordered[reordered.length - 1], AI_FREE_MODELS.GEMINI_3_8_FLASH);

  // Recovering resets cooldown immediately
  markServerModelSuccess(AI_FREE_MODELS.GEMINI_3_8_FLASH, 420, 2000);
  const recovered = applyServerHealthOrdering(baseChain, 2100);
  assert.equal(recovered[0], AI_FREE_MODELS.GEMINI_3_8_FLASH);
  resetServerModelHealth();
});

test('executeWithSmartFallback switches immediately on weak HTTP-200 replies and falls back gracefully if all weak', async () => {
  resetModelHealthRegistry();
  const calls: string[] = [];

  const result = await executeWithSmartFallback<{ text: string }>({
    priorityModels: [
      AI_FREE_MODELS.GEMINI_3_8_FLASH,
      AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    ],
    executor: async (modelId) => {
      calls.push(modelId);
      if (modelId === AI_FREE_MODELS.GEMINI_3_8_FLASH) {
        return {
          value: { text: 'لم أفهم طلبك، أعتذر لا أستطيع المساعدة في ذلك.' },
          usedModelId: modelId,
        };
      }
      return {
        value: { text: 'تم تحليل الوكالات المطلوبة وعرض النتائج جاهزة.' },
        usedModelId: modelId,
      };
    },
    isWeakResult: (v) => detectWeakAssistantPayload({ text: v.text }),
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(result.usedModelId, AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL);
  assert.equal(result.fallbackUsed, true);

  // When every model produces a weak reply, bestWeakOutcome still resolves safely instead of failing hard
  const allWeak = await executeWithSmartFallback<{ text: string }>({
    priorityModels: [
      AI_FREE_MODELS.GEMINI_3_5_FLASH,
      AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    ],
    executor: async (modelId) => ({
      value: { text: 'I cannot help with that request.' },
      usedModelId: modelId,
    }),
    isWeakResult: (v) => detectWeakAssistantPayload({ text: v.text }),
  });
  assert.equal(allWeak.ok, true);
  assert.ok(allWeak.data?.text);
});

test('zeroTrustExtract module imports cleanly in Node without browser dependencies', () => {
  const cell = evaluateZeroTrustCell({
    valueDisplay: 'علي كريم حسن',
    confidence: 0.995,
    fieldLabel: 'الاسم',
  });
  assert.equal(cell.status, 'verified');
});

