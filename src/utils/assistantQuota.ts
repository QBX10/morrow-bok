import {
  AI_FREE_MODELS,
  AI_MODEL_REGISTRY,
  AI_TASK_PROFILES,
  APPROVED_CHAT_ORCHESTRATION_MODELS,
  APPROVED_CLOUD_MODEL_SET,
  DEFAULT_TASK_ROUTING,
  DEPRECATED_OR_REPLACED_MODELS,
  MORROW_LOCAL_MODEL_ID,
  sanitizeAiModelId,
  SIX_FREE_CLOUD_MODELS,
  type AiTaskKey,
  type ApprovedCloudModelId,
} from '../aiConfig.ts';
import type {
  AiTaskRoutingMap,
  AssistantConnectivityState,
  AssistantQuotaStats,
  AssistantSettingsConfig,
} from '../types/assistant.ts';

export const MORROW_LOCAL_MODEL = MORROW_LOCAL_MODEL_ID;
export const GEMINI_HEAVY_MODEL = AI_FREE_MODELS.GEMINI_3_8_FLASH;
export const GEMINI_BALANCED_MODEL = AI_FREE_MODELS.GEMINI_3_5_FLASH;
export const GEMINI_FAST_MODEL = AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE;
export const GROQ_AUDIO_MODEL = AI_FREE_MODELS.GROQ_WHISPER_TURBO;
export const OPENROUTER_NEMOTRON_MODEL = AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL;
export const OPENROUTER_AUTO_MODEL = AI_FREE_MODELS.OPENROUTER_FREE_AUTO;

// Primary and fallback aliases aligned to strongest -> fallback priority
export const PRIMARY_FREE_GEMINI_MODEL = GEMINI_HEAVY_MODEL;
export const SECONDARY_FREE_GEMINI_MODEL = GEMINI_BALANCED_MODEL;
export const FAST_FREE_GEMINI_MODEL = GEMINI_FAST_MODEL;

export const ALLOWED_CLOUD_MODELS = APPROVED_CLOUD_MODEL_SET;

export const BANNED_DEPRECATED_MODELS = DEPRECATED_OR_REPLACED_MODELS;

export const FREE_GEMINI_MODEL_OPTIONS: Array<{
  id: string;
  provider: string;
  priority: number;
  powerRank: number;
  label: string;
  desc: string;
}> = APPROVED_CHAT_ORCHESTRATION_MODELS.map((id) => {
  const spec = AI_MODEL_REGISTRY[id];
  return {
    id: spec.id,
    provider: spec.provider,
    priority: spec.priority,
    powerRank: spec.powerRank,
    label: spec.badgeLabel,
    desc: spec.specialty,
  };
}).sort((a, b) => b.powerRank - a.powerRank);

export const ALL_SIX_FREE_MODEL_OPTIONS = SIX_FREE_CLOUD_MODELS;

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettingsConfig = {
  preferredModelId: GEMINI_HEAVY_MODEL,
  fallbackModelId: OPENROUTER_NEMOTRON_MODEL,
  routingStrategy: 'strongest_first',
  collaborationMode: 'council_review',
  responseStyle: 'balanced',
  taskRouting: structuredClone(DEFAULT_TASK_ROUTING),
  onlineDisabled: false,
  cacheEnabled: true,
  dailyRequestLimit: 250,
  minuteRequestLimit: 15,
  quotaWarningPercent: 80,
};

export function sanitizeAssistantModelId(raw?: string | null): ApprovedCloudModelId {
  return sanitizeAiModelId(raw);
}

export function normalizeAssistantSettings(
  raw?: Partial<AssistantSettingsConfig> | null
): AssistantSettingsConfig {
  const base = raw && typeof raw === 'object' ? raw : {};
  const preferred = sanitizeAiModelId(base.preferredModelId);
  const rawFallback = sanitizeAiModelId(base.fallbackModelId || OPENROUTER_NEMOTRON_MODEL);
  const fallback =
    rawFallback === preferred
      ? preferred === OPENROUTER_NEMOTRON_MODEL
        ? AI_FREE_MODELS.GEMINI_3_5_FLASH
        : OPENROUTER_NEMOTRON_MODEL
      : rawFallback;

  const taskKeys = Object.keys(DEFAULT_TASK_ROUTING) as AiTaskKey[];
  const normalizedRouting = {} as AiTaskRoutingMap;
  for (const key of taskKeys) {
    const profile = AI_TASK_PROFILES[key];
    const def = DEFAULT_TASK_ROUTING[key];
    const saved = base.taskRouting?.[key];
    const candPrimary = sanitizeAiModelId(saved?.primaryModelId || def.primaryModelId);
    const primaryModelId = profile.eligibleModels.includes(candPrimary)
      ? candPrimary
      : def.primaryModelId;
    const candBackup = sanitizeAiModelId(saved?.backupModelId || def.backupModelId);
    const backupModelId =
      profile.eligibleModels.includes(candBackup) && candBackup !== primaryModelId
        ? candBackup
        : profile.eligibleModels.find((m) => m !== primaryModelId) || def.backupModelId;
    normalizedRouting[key] = {
      primaryModelId,
      backupModelId,
      finalLocalFallback: saved?.finalLocalFallback ?? true,
    };
  }

  return {
    preferredModelId: preferred,
    fallbackModelId: fallback,
    routingStrategy:
      base.routingStrategy === 'local_first_economy'
        ? 'local_first_economy'
        : 'strongest_first',
    collaborationMode:
      base.collaborationMode === 'single' || base.collaborationMode === 'multi_step_agent'
        ? base.collaborationMode
        : 'council_review',
    responseStyle:
      base.responseStyle === 'concise' ||
      base.responseStyle === 'financial_auditor' ||
      base.responseStyle === 'deep_advisor'
        ? base.responseStyle
        : 'balanced',
    taskRouting: normalizedRouting,
    onlineDisabled: Boolean(base.onlineDisabled),
    cacheEnabled: base.cacheEnabled ?? true,
    dailyRequestLimit: Math.max(
      10,
      Math.min(5000, Number(base.dailyRequestLimit) || 250)
    ),
    minuteRequestLimit: Math.max(
      2,
      Math.min(120, Number(base.minuteRequestLimit) || 15)
    ),
    quotaWarningPercent: Math.max(
      50,
      Math.min(98, Number(base.quotaWarningPercent) || 80)
    ),
  };
}

export function getTodayKey(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function createInitialQuotaStats(nowMs: number = Date.now()): AssistantQuotaStats {
  return {
    dateKey: getTodayKey(nowMs),
    dailyCount: 0,
    minuteTimestamps: [],
    quotaExhaustedUntil: null,
  };
}

export function normalizeQuotaStatsForNow(
  stats: AssistantQuotaStats,
  nowMs: number = Date.now()
): AssistantQuotaStats {
  const today = getTodayKey(nowMs);
  const oneMinuteAgo = nowMs - 60_000;
  const recentMinute = (stats.minuteTimestamps || []).filter((ts) => ts > oneMinuteAgo);
  const isNewDay = stats.dateKey !== today;

  return {
    dateKey: today,
    dailyCount: isNewDay ? 0 : Math.max(0, stats.dailyCount || 0),
    minuteTimestamps: recentMinute,
    lastModelUsed: stats.lastModelUsed
      ? sanitizeAssistantModelId(stats.lastModelUsed)
      : undefined,
    quotaExhaustedUntil:
      stats.quotaExhaustedUntil && stats.quotaExhaustedUntil > nowMs
        ? stats.quotaExhaustedUntil
        : null,
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  quotaExhausted: boolean;
  nearDailyLimit: boolean;
  nearMinuteLimit: boolean;
  dailyUsed: number;
  dailyLimit: number;
  minuteUsed: number;
  minuteLimit: number;
  dailyPercent: number;
}

export function evaluateOnlineQuota(
  rawStats: AssistantQuotaStats,
  settings: AssistantSettingsConfig,
  nowMs: number = Date.now()
): QuotaCheckResult {
  const stats = normalizeQuotaStatsForNow(rawStats, nowMs);
  const dailyLimit = Math.max(10, Math.min(5000, settings.dailyRequestLimit || 250));
  const minuteLimit = Math.max(2, Math.min(120, settings.minuteRequestLimit || 15));
  const warnPct = Math.max(50, Math.min(98, settings.quotaWarningPercent || 80));

  const dailyPercent = Math.min(100, Math.round((stats.dailyCount / dailyLimit) * 100));
  const minuteUsed = stats.minuteTimestamps.length;

  if (stats.quotaExhaustedUntil && stats.quotaExhaustedUntil > nowMs) {
    const secsLeft = Math.max(1, Math.ceil((stats.quotaExhaustedUntil - nowMs) / 1000));
    return {
      allowed: false,
      quotaExhausted: true,
      nearDailyLimit: true,
      nearMinuteLimit: false,
      dailyUsed: stats.dailyCount,
      dailyLimit,
      minuteUsed,
      minuteLimit,
      dailyPercent,
      reason: `حصة السحابة وصلت للحد المؤقت — يعمل Morrow المحلي الآن (يعاد الفحص خلال ${secsLeft} ثانية).`,
    };
  }

  if (stats.dailyCount >= dailyLimit) {
    return {
      allowed: false,
      quotaExhausted: true,
      nearDailyLimit: true,
      nearMinuteLimit: false,
      dailyUsed: stats.dailyCount,
      dailyLimit,
      minuteUsed,
      minuteLimit,
      dailyPercent: 100,
      reason: `وصلت للحد اليومي (${dailyLimit} طلب) — تم التحويل لمحرك Morrow المحلي.`,
    };
  }

  if (minuteUsed >= minuteLimit) {
    return {
      allowed: false,
      quotaExhausted: true,
      nearDailyLimit: dailyPercent >= warnPct,
      nearMinuteLimit: true,
      dailyUsed: stats.dailyCount,
      dailyLimit,
      minuteUsed,
      minuteLimit,
      dailyPercent,
      reason: `تم بلوغ حد الدقيقة (${minuteLimit} طلب/دقيقة) — شغّال حالياً بـ Morrow المحلي.`,
    };
  }

  return {
    allowed: true,
    quotaExhausted: false,
    nearDailyLimit: dailyPercent >= warnPct,
    nearMinuteLimit: minuteUsed >= Math.max(1, minuteLimit - 2),
    dailyUsed: stats.dailyCount,
    dailyLimit,
    minuteUsed,
    minuteLimit,
    dailyPercent,
  };
}

export function recordOnlineRequest(
  rawStats: AssistantQuotaStats,
  modelId: string,
  nowMs: number = Date.now()
): AssistantQuotaStats {
  const stats = normalizeQuotaStatsForNow(rawStats, nowMs);
  return {
    ...stats,
    dailyCount: stats.dailyCount + 1,
    minuteTimestamps: [...stats.minuteTimestamps, nowMs].slice(-60),
    lastModelUsed: sanitizeAssistantModelId(modelId),
  };
}

export function markQuotaExhausted(
  rawStats: AssistantQuotaStats,
  cooldownMs: number = 90_000,
  nowMs: number = Date.now()
): AssistantQuotaStats {
  const stats = normalizeQuotaStatsForNow(rawStats, nowMs);
  return {
    ...stats,
    quotaExhaustedUntil: nowMs + Math.max(15_000, cooldownMs),
  };
}

export function deriveAssistantConnectivity(params: {
  browserOnline: boolean;
  cloudConfigured: boolean;
  settings: AssistantSettingsConfig;
  stats: AssistantQuotaStats;
  nowMs?: number;
}): AssistantConnectivityState {
  if (params.settings.onlineDisabled || !params.browserOnline || !params.cloudConfigured) {
    return 'offline';
  }
  const quota = evaluateOnlineQuota(
    params.stats,
    params.settings,
    params.nowMs ?? Date.now()
  );
  if (quota.quotaExhausted) {
    return 'quota_exhausted';
  }
  return 'online';
}
