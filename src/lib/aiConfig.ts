import {
  AI_FREE_MODELS,
  AI_MODEL_REGISTRY,
  AI_ROUTING_PIPELINES,
  AI_TASK_PROFILES,
  DEFAULT_TASK_ROUTING,
  MORROW_LOCAL_MODEL_ID,
  getAiModelSpec,
  resolveOrderedTaskChain,
  sanitizeAiModelId,
  type AiModelSpec,
  type AiPipelineKind,
  type AiProviderId,
  type AiTaskKey,
  type AiTaskRouteConfigItem,
  type AnyAiModelId,
  type ApprovedCloudModelId,
} from '../aiConfig.ts';
import type {
  AiRoutingStrategy,
  AssistantBrainMode,
} from '../types/assistant.ts';
import { normalizeIraqiDialect } from '../utils/assistantPrivacy.ts';

export {
  AI_FREE_MODELS,
  AI_MODEL_REGISTRY,
  AI_ROUTING_PIPELINES,
  AI_TASK_PROFILES,
  DEFAULT_TASK_ROUTING,
  MORROW_LOCAL_MODEL_ID,
  getAiModelSpec,
  resolveOrderedTaskChain,
  sanitizeAiModelId,
};
export type {
  AiModelSpec,
  AiPipelineKind,
  AiProviderId,
  AiTaskKey,
  AiTaskRouteConfigItem,
  AnyAiModelId,
  ApprovedCloudModelId,
};

/**
 * The 6 Core Specialized AI Models Requested for Morrow:
 * 1. Gemini 3.8 Flash      (Google)      — Complex Reasoning, Vision, Heavy PDF & Structured JSON
 * 2. Gemini 3.8 Live       (Google)      — Real-Time Voice/Camera WebSocket Live Sessions
 * 3. Gemini 3.5 Flash      (Google)      — Balanced Data Processing (Excel/CSV) & Agentic Workflows
 * 4. Gemini 3.5 Flash Lite (Google)      — Ultra-Fast Low-Latency Daily Actions & Classification
 * 5. Groq Whisper          (Groq)        — High-Speed Arabic/Iraqi Speech-to-Text Transcription
 * 6. NVIDIA Nemotron       (OpenRouter)  — Independent Document Intelligence & Deep Reasoning Backup
 */
export const CORE_SIX_SPECIALIZED_MODELS: readonly AiModelSpec[] = [
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_8_FLASH],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_8_LIVE],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_5_FLASH],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GROQ_WHISPER_TURBO],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL],
] as const;

export const SAFETY_FALLBACK_MODELS: readonly AiModelSpec[] = [
  AI_MODEL_REGISTRY[AI_FREE_MODELS.OPENROUTER_FREE_AUTO],
  AI_MODEL_REGISTRY[MORROW_LOCAL_MODEL_ID],
] as const;

export interface AiProviderRuntimeConfig {
  id: AiProviderId;
  displayName: string;
  envKeyName: string | null;
  defaultTimeoutMs: number;
  maxRetries: number;
  supportsDirectBrowserWs?: boolean;
}

export const AI_PROVIDER_CONFIGS: Record<AiProviderId, AiProviderRuntimeConfig> = {
  google: {
    id: 'google',
    displayName: 'Google AI Studio',
    envKeyName: 'GEMINI_API_KEY',
    defaultTimeoutMs: 14_000,
    maxRetries: 1,
    supportsDirectBrowserWs: true,
  },
  groq: {
    id: 'groq',
    displayName: 'Groq Cloud (STT)',
    envKeyName: 'GROQ_API_KEY',
    defaultTimeoutMs: 12_000,
    maxRetries: 1,
  },
  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter Free Network',
    envKeyName: 'OPENROUTER_API_KEY',
    defaultTimeoutMs: 16_000,
    maxRetries: 1,
  },
  local: {
    id: 'local',
    displayName: 'Morrow Local Engine',
    envKeyName: null,
    defaultTimeoutMs: 150,
    maxRetries: 0,
  },
};

export type AiSpecialtyKey = AiTaskKey;

export type AiModalityKind =
  | 'chat'
  | 'audio'
  | 'live_session'
  | 'pdf_vision'
  | 'spreadsheet';

export interface SpecialtyPriorityDecision {
  specialty: AiSpecialtyKey;
  specialtyTitle: string;
  pipeline: AiPipelineKind;
  priorityOrder: ApprovedCloudModelId[];
  healthyPriorityOrder: ApprovedCloudModelId[];
  primaryModelId: ApprovedCloudModelId;
  backupModelId: ApprovedCloudModelId;
  recommendedTimeoutMs: number;
  complexity: 'fast' | 'balanced' | 'deep';
  reason: string;
  bypassCloudSuggested: boolean;
}

/**
 * In-memory circuit-breaker & latency state per cloud model.
 * Prevents repeatedly stalling user requests on temporarily overloaded models (429 / 503).
 */
export interface ModelHealthRecord {
  modelId: ApprovedCloudModelId;
  consecutiveFailures: number;
  lastErrorKind: '429_rate_limit' | '503_unavailable' | 'timeout' | 'error' | null;
  lastErrorMessage?: string;
  cooldownUntilMs: number;
  lastSuccessAtMs: number | null;
  avgLatencyMs: number | null;
  totalSuccesses: number;
}

const modelHealthMap = new Map<ApprovedCloudModelId, ModelHealthRecord>();

function getOrCreateHealthRecord(modelId: ApprovedCloudModelId): ModelHealthRecord {
  const existing = modelHealthMap.get(modelId);
  if (existing) return existing;
  const fresh: ModelHealthRecord = {
    modelId,
    consecutiveFailures: 0,
    lastErrorKind: null,
    cooldownUntilMs: 0,
    lastSuccessAtMs: null,
    avgLatencyMs: null,
    totalSuccesses: 0,
  };
  modelHealthMap.set(modelId, fresh);
  return fresh;
}

export function classifyAiFailure(err: unknown, statusCode?: number): {
  kind: '429_rate_limit' | '503_unavailable' | 'timeout' | 'error';
  retryable: boolean;
  abortedByUser: boolean;
  cooldownMs: number;
  message: string;
} {
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
    const reason = String((err as { message?: string }).message || 'aborted').toLowerCase();
    const isTimeout = reason.includes('timeout');
    return {
      kind: isTimeout ? 'timeout' : 'error',
      retryable: isTimeout,
      abortedByUser: !isTimeout,
      cooldownMs: isTimeout ? 35_000 : 0,
      message: isTimeout ? 'انتهت مهلة انتظار النموذج السحابي.' : 'تم إيقاف الطلب من قِبل المستخدم.',
    };
  }

  const msg =
    err instanceof Error ? err.message : String(err || 'Unknown AI error');
  const lower = msg.toLowerCase();
  const code =
    statusCode ??
    (typeof (err as { status?: unknown })?.status === 'number'
      ? Number((err as { status: number }).status)
      : 0);

  if (
    code === 429 ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('too many requests')
  ) {
    return {
      kind: '429_rate_limit',
      retryable: true,
      abortedByUser: false,
      cooldownMs: 60_000,
      message: msg,
    };
  }

  if (
    code === 503 ||
    code === 502 ||
    code === 504 ||
    code === 500 ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return {
      kind: '503_unavailable',
      retryable: true,
      abortedByUser: false,
      cooldownMs: 45_000,
      message: msg,
    };
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      kind: 'timeout',
      retryable: true,
      abortedByUser: false,
      cooldownMs: 35_000,
      message: msg,
    };
  }

  return {
    kind: 'error',
    retryable: false,
    abortedByUser: false,
    cooldownMs: 0,
    message: msg,
  };
}

export function markModelFailure(
  modelId: ApprovedCloudModelId,
  err: unknown,
  statusCode?: number,
  nowMs: number = Date.now()
): ModelHealthRecord {
  const rec = getOrCreateHealthRecord(modelId);
  const classified = classifyAiFailure(err, statusCode);
  rec.consecutiveFailures += 1;
  rec.lastErrorKind = classified.kind;
  rec.lastErrorMessage = classified.message;
  if (classified.retryable) {
    const backoffFactor = Math.min(3, rec.consecutiveFailures);
    rec.cooldownUntilMs = nowMs + classified.cooldownMs * backoffFactor;
  }
  return { ...rec };
}

export function markModelSuccess(
  modelId: ApprovedCloudModelId,
  latencyMs: number,
  nowMs: number = Date.now()
): ModelHealthRecord {
  const rec = getOrCreateHealthRecord(modelId);
  rec.consecutiveFailures = 0;
  rec.lastErrorKind = null;
  rec.lastErrorMessage = undefined;
  rec.cooldownUntilMs = 0;
  rec.lastSuccessAtMs = nowMs;
  rec.totalSuccesses += 1;
  rec.avgLatencyMs =
    rec.avgLatencyMs === null
      ? Math.round(latencyMs)
      : Math.round(rec.avgLatencyMs * 0.65 + latencyMs * 0.35);
  return { ...rec };
}

export function getModelHealthSnapshot(
  modelId: ApprovedCloudModelId,
  nowMs: number = Date.now()
): ModelHealthRecord & { status: 'healthy' | 'cooldown' } {
  const rec = getOrCreateHealthRecord(modelId);
  const inCooldown = rec.cooldownUntilMs > nowMs;
  return {
    ...rec,
    status: inCooldown ? 'cooldown' : 'healthy',
  };
}

export function getAllModelHealthSnapshots(
  nowMs: number = Date.now()
): Array<ModelHealthRecord & { status: 'healthy' | 'cooldown'; spec: AiModelSpec }> {
  return CORE_SIX_SPECIALIZED_MODELS.map((spec) => {
    const id = spec.id as ApprovedCloudModelId;
    return {
      ...getModelHealthSnapshot(id, nowMs),
      spec,
    };
  });
}

export function resetModelHealthRegistry(): void {
  modelHealthMap.clear();
}

/**
 * Re-orders a model chain so currently healthy models run before models in temporary cooldown,
 * while preserving the exact specialty ranking among healthy models.
 */
export function applyHealthPriorityOrdering(
  models: ApprovedCloudModelId[],
  nowMs: number = Date.now()
): ApprovedCloudModelId[] {
  const unique = Array.from(new Set(models));
  const healthy: ApprovedCloudModelId[] = [];
  const cooling: ApprovedCloudModelId[] = [];
  for (const id of unique) {
    const snap = getModelHealthSnapshot(id, nowMs);
    if (snap.status === 'cooldown') {
      cooling.push(id);
    } else {
      healthy.push(id);
    }
  }
  return healthy.length > 0 ? [...healthy, ...cooling] : unique;
}

const SPECIALTY_MODEL_MAP: Record<AiSpecialtyKey, ApprovedCloudModelId[]> = {
  command_orchestration: [
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
  ],
  heavy_pdf_vision: [
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
  ],
  structured_excel_csv: [
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
  ],
  fast_copilot_actions: [
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
  ],
  audio_transcription: [
    AI_FREE_MODELS.GROQ_WHISPER_TURBO,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
  ],
  live_realtime_session: [
    AI_FREE_MODELS.GEMINI_3_8_LIVE,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
  ],
};

function isFastLowLatencyQuery(norm: string): boolean {
  if (!norm || norm.length > 52) return false;
  const heavyPattern =
    /(تحليل|استراتيجي|مقارن|تقرير|احصائي|تنبؤ|توقع|فحص|تشخيص|pdf|ملف|صوره|اكسل|excel|csv|جدول|دفعه|ارشف|تعديل|اضافه|نقل|حظر|ملاحظه|مصروف|ميزانيه|ربح|مكرر)/;
  if (heavyPattern.test(norm)) return false;
  return /^(مرحبا|هلا|اهلا|السلام|صباح|مساء|شلونك|كيف حالك|شكرا|يسلمو|تمام|اوك|نعم|لا|من انت|شنو تكدر|ساعدني|مساعده)/.test(
    norm
  );
}

/**
 * Classifies prompt + modality into the exact AI specialty and assigns model priorities
 * dynamically based on each model's strengths and live circuit-breaker health.
 */
export function classifyPromptSpecialtyAndPriority(params: {
  prompt: string;
  modality?: AiModalityKind;
  brainMode: AssistantBrainMode;
  routingStrategy?: AiRoutingStrategy;
  localHandled?: boolean;
  taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>> | null;
  nowMs?: number;
}): SpecialtyPriorityDecision {
  const {
    prompt,
    modality = 'chat',
    brainMode,
    routingStrategy = 'strongest_first',
    localHandled = false,
    taskRouting,
    nowMs = Date.now(),
  } = params;

  const norm = normalizeIraqiDialect(prompt || '');

  // Explicit brain modes pin the user's chosen specialized model first, keeping smart fallbacks behind it
  if (brainMode === 'gemini_3_8_flash') {
    const base = resolveOrderedTaskChain('command_orchestration', taskRouting, {
      primaryModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    }).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'command_orchestration',
      specialtyTitle: 'استنتاج عميق ورؤية شاملة (مثبت على 3.8 Flash)',
      pipeline: 'deep_assistant',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      recommendedTimeoutMs: 14_000,
      complexity: 'deep',
      reason: 'مُثبت يدوياً على النموذج الأقوى Gemini 3.8 Flash مع احتياطي Nemotron.',
      bypassCloudSuggested: false,
    };
  }

  if (brainMode === 'nemotron_free') {
    const base = resolveOrderedTaskChain('heavy_pdf_vision', taskRouting, {
      primaryModelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      backupModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    }).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'heavy_pdf_vision',
      specialtyTitle: 'ذكاء المستندات المستقل (Nemotron 3.5 Super VL)',
      pipeline: 'heavy_extraction',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.GEMINI_3_8_FLASH,
      recommendedTimeoutMs: 16_000,
      complexity: 'deep',
      reason: 'موجّه للنموذج المستقل Nemotron 3.5 VL عبر OpenRouter مع احتياطي Gemini 3.8.',
      bypassCloudSuggested: false,
    };
  }

  if (brainMode === 'gemini_3_5_flash') {
    const base = resolveOrderedTaskChain('structured_excel_csv', taskRouting, {
      primaryModelId: AI_FREE_MODELS.GEMINI_3_5_FLASH,
    }).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'structured_excel_csv',
      specialtyTitle: 'البيانات المهيكلة وسير العمل المتعدد (3.5 Flash)',
      pipeline: 'data_processing',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      recommendedTimeoutMs: 12_000,
      complexity: 'balanced',
      reason: 'موجّه لنموذج Gemini 3.5 Flash المتوازن للجداول والمنطق.',
      bypassCloudSuggested: false,
    };
  }

  if (brainMode === 'gemini_3_5_flash_lite') {
    const base = resolveOrderedTaskChain('fast_copilot_actions', taskRouting, {
      primaryModelId: AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
      backupModelId: AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    }).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'fast_copilot_actions',
      specialtyTitle: 'استجابة فورية منخفضة الكمون (3.5 Flash Lite)',
      pipeline: 'fast_assistant',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
      recommendedTimeoutMs: 9_000,
      complexity: 'fast',
      reason: 'موجّه للنموذج الخفيف فائق السرعة 3.5 Flash Lite.',
      bypassCloudSuggested: false,
    };
  }

  if (brainMode === 'openrouter_free') {
    const base = resolveOrderedTaskChain('command_orchestration', taskRouting, {
      primaryModelId: AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
      backupModelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    }).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'command_orchestration',
      specialtyTitle: 'الموجه الاحتياطي الذكي (OpenRouter Free)',
      pipeline: 'fast_assistant',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      recommendedTimeoutMs: 15_000,
      complexity: 'balanced',
      reason: 'توجيه تلقائي عبر بوابة OpenRouter Free.',
      bypassCloudSuggested: false,
    };
  }

  // Modality-driven automatic routing
  if (modality === 'live_session') {
    const base = resolveOrderedTaskChain('live_realtime_session', taskRouting).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'live_realtime_session',
      specialtyTitle: 'محادثة حية مباشرة بالصوت والكاميرا (3.8 Live)',
      pipeline: 'audio',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.GEMINI_3_8_FLASH,
      recommendedTimeoutMs: 15_000,
      complexity: 'deep',
      reason: 'جلسة تفاعلية ثنائية الاتجاه — الأولوية لـ Gemini 3.8 Live.',
      bypassCloudSuggested: false,
    };
  }

  if (modality === 'audio') {
    const base = resolveOrderedTaskChain('audio_transcription', taskRouting).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'audio_transcription',
      specialtyTitle: 'تفريغ صوتي فائق السرعة (Groq Whisper)',
      pipeline: 'audio',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.GEMINI_3_8_FLASH,
      recommendedTimeoutMs: 12_000,
      complexity: 'fast',
      reason: 'أولوية قصوى لـ Whisper V3 Turbo عبر Groq ثم Gemini الصوتي.',
      bypassCloudSuggested: false,
    };
  }

  if (
    modality === 'pdf_vision' ||
    /(pdf|صورة|وثيقة|دفتر|مسح ضوئي|ocr|رؤية|كشف مصور)/.test(norm)
  ) {
    const base = resolveOrderedTaskChain('heavy_pdf_vision', taskRouting).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'heavy_pdf_vision',
      specialtyTitle: 'رؤية بصرية وتحليل مستندات PDF معقدة',
      pipeline: 'heavy_extraction',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      recommendedTimeoutMs: 16_000,
      complexity: 'deep',
      reason: 'مهمة مستندات/رؤية — Gemini 3.8 Flash أولاً يليه Nemotron 3.5 VL.',
      bypassCloudSuggested: false,
    };
  }

  if (
    modality === 'spreadsheet' ||
    (/(excel|اكسل|csv|جدول بيانات|شيت|مصفوفه)/.test(norm) &&
      !/(استراتيجي|توصيات|تشخيص)/.test(norm))
  ) {
    const base = resolveOrderedTaskChain('structured_excel_csv', taskRouting).cloudChain;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'structured_excel_csv',
      specialtyTitle: 'تحليل جداول منظمة وبيانات Excel/CSV (3.5 Flash)',
      pipeline: 'data_processing',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      recommendedTimeoutMs: 13_000,
      complexity: 'balanced',
      reason: 'بيانات مهيكلة — أولوية لـ Gemini 3.5 Flash وNemotron.',
      bypassCloudSuggested: false,
    };
  }

  if (isFastLowLatencyQuery(norm)) {
    const base = SPECIALTY_MODEL_MAP.fast_copilot_actions;
    const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
    return {
      specialty: 'fast_copilot_actions',
      specialtyTitle: 'تحية أو أمر سريع منخفض الكمون (3.5 Flash Lite)',
      pipeline: 'fast_assistant',
      priorityOrder: base,
      healthyPriorityOrder: healthyOrder,
      primaryModelId: healthyOrder[0],
      backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
      recommendedTimeoutMs: 8_500,
      complexity: 'fast',
      reason: 'استفسار فوري قصير — أولوية لسرعة 3.5 Flash Lite.',
      bypassCloudSuggested: routingStrategy === 'local_first_economy' && localHandled,
    };
  }

  const base = resolveOrderedTaskChain('command_orchestration', taskRouting).cloudChain;
  const healthyOrder = applyHealthPriorityOrdering(base, nowMs);
  return {
    specialty: 'command_orchestration',
    specialtyTitle: 'قيادة الأوامر والاستنتاج الشامل (من الأقوى إلى الأضعف)',
    pipeline: 'deep_assistant',
    priorityOrder: base,
    healthyPriorityOrder: healthyOrder,
    primaryModelId: healthyOrder[0],
    backupModelId: healthyOrder[1] || AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    recommendedTimeoutMs: 14_000,
    complexity: norm.length >= 110 ? 'deep' : 'balanced',
    reason: 'أمر تنفيذي أو تحليلي — الترتيب من الأقوى Gemini 3.8 Flash مع احتياطي Nemotron.',
    bypassCloudSuggested: routingStrategy === 'local_first_economy' && localHandled,
  };
}

export interface SmartFallbackAttemptTrace {
  modelId: ApprovedCloudModelId;
  provider: AiProviderId;
  ok: boolean;
  latencyMs: number;
  errorKind?: '429_rate_limit' | '503_unavailable' | 'timeout' | 'error';
  errorMessage?: string;
}

export interface SmartFallbackExecutionResult<T> {
  ok: boolean;
  data?: T;
  usedModelId?: ApprovedCloudModelId;
  fallbackUsed: boolean;
  abortedByUser: boolean;
  quotaOrRateLimited: boolean;
  attempts: SmartFallbackAttemptTrace[];
  totalLatencyMs: number;
  errorSummary?: string;
}

/**
 * Executes a model-parameterized async task across an ordered priority list with Smart Fallback:
 * - Honors external cancellation signals immediately (never falls back if user cancelled).
 * - Automatically retries transient 429 / 503 / timeout failures on the next backup model.
 * - Updates circuit-breaker health metrics so healthy models stay prioritized.
 */
export async function executeWithSmartFallback<T>(options: {
  priorityModels: ApprovedCloudModelId[];
  executor: (
    modelId: ApprovedCloudModelId,
    signal: AbortSignal,
    attemptIndex: number
  ) => Promise<{ value: T; usedModelId?: ApprovedCloudModelId }>;
  externalSignal?: AbortSignal;
  perModelTimeoutMs?: number;
  onFallbackSwitch?: (info: {
    fromModelId: ApprovedCloudModelId;
    toModelId: ApprovedCloudModelId;
    errorKind: '429_rate_limit' | '503_unavailable' | 'timeout' | 'error';
    reason: string;
  }) => void;
}): Promise<SmartFallbackExecutionResult<T>> {
  const startedAt = Date.now();
  const candidates =
    options.priorityModels.length > 0
      ? applyHealthPriorityOrdering(options.priorityModels)
      : [AI_FREE_MODELS.GEMINI_3_8_FLASH, AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL];

  const attempts: SmartFallbackAttemptTrace[] = [];
  let quotaOrRateLimited = false;
  let lastErrorMessage = '';

  for (let i = 0; i < candidates.length; i++) {
    if (options.externalSignal?.aborted) {
      return {
        ok: false,
        fallbackUsed: i > 0,
        abortedByUser: true,
        quotaOrRateLimited,
        attempts,
        totalLatencyMs: Date.now() - startedAt,
        errorSummary: 'تم إيقاف الطلب من قِبل المستخدم.',
      };
    }

    const modelId = candidates[i];
    const spec = getAiModelSpec(modelId);
    const timeoutMs =
      options.perModelTimeoutMs ?? AI_PROVIDER_CONFIGS[spec.provider].defaultTimeoutMs;
    const attemptController = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => attemptController.abort(new DOMException('aborted', 'AbortError'));
    options.externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      attemptController.abort(new DOMException('timeout', 'AbortError'));
    }, timeoutMs);

    const attemptStart = Date.now();
    try {
      const outcome = await options.executor(modelId, attemptController.signal, i);
      globalThis.clearTimeout(timer);
      options.externalSignal?.removeEventListener('abort', onExternalAbort);

      const latencyMs = Date.now() - attemptStart;
      const reportedModelId = (outcome.usedModelId || modelId) as ApprovedCloudModelId;
      markModelSuccess(reportedModelId, latencyMs);
      if (reportedModelId !== modelId) {
        markModelFailure(modelId, new Error('503 fallback used on server'), 503);
      }

      attempts.push({
        modelId: reportedModelId,
        provider: getAiModelSpec(reportedModelId).provider,
        ok: true,
        latencyMs,
      });

      return {
        ok: true,
        data: outcome.value,
        usedModelId: reportedModelId,
        fallbackUsed: i > 0 || reportedModelId !== candidates[0],
        abortedByUser: false,
        quotaOrRateLimited,
        attempts,
        totalLatencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      globalThis.clearTimeout(timer);
      options.externalSignal?.removeEventListener('abort', onExternalAbort);

      const latencyMs = Date.now() - attemptStart;
      if (options.externalSignal?.aborted && !timedOut) {
        return {
          ok: false,
          fallbackUsed: i > 0,
          abortedByUser: true,
          quotaOrRateLimited,
          attempts,
          totalLatencyMs: Date.now() - startedAt,
          errorSummary: 'تم إيقاف الطلب من قِبل المستخدم.',
        };
      }

      const effectiveErr = timedOut ? new Error(`503 Request timeout after ${timeoutMs}ms`) : err;
      const classified = classifyAiFailure(effectiveErr);
      if (classified.kind === '429_rate_limit') {
        quotaOrRateLimited = true;
      }
      if (classified.retryable) {
        markModelFailure(modelId, effectiveErr);
      }
      lastErrorMessage = classified.message;

      attempts.push({
        modelId,
        provider: spec.provider,
        ok: false,
        latencyMs,
        errorKind: classified.kind,
        errorMessage: classified.message,
      });

      const nextModel = candidates[i + 1];
      if (!nextModel || !classified.retryable) {
        break;
      }

      options.onFallbackSwitch?.({
        fromModelId: modelId,
        toModelId: nextModel,
        errorKind: classified.kind,
        reason: classified.message,
      });
    }
  }

  return {
    ok: false,
    fallbackUsed: attempts.length > 1,
    abortedByUser: false,
    quotaOrRateLimited,
    attempts,
    totalLatencyMs: Date.now() - startedAt,
    errorSummary: lastErrorMessage || 'تعذر تنفيذ الطلب على النماذج السحابية المتاحة.',
  };
}
