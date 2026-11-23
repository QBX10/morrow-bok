import type {
  AssistantConnectivityState,
  AssistantQuotaStats,
  AssistantSettingsConfig,
} from '../types/assistant.ts';

export const MORROW_LOCAL_MODEL = 'morrow-local';
export const GEMINI_FLASH_MODEL = 'gemini-2.5-flash';
export const GEMINI_PRO_MODEL = 'gemini-2.5-pro';

// Strictly restricted aliases used across server & settings
export const PRIMARY_FREE_GEMINI_MODEL = GEMINI_FLASH_MODEL;
export const SECONDARY_FREE_GEMINI_MODEL = GEMINI_PRO_MODEL;

export const ALLOWED_CLOUD_MODELS = new Set([
  GEMINI_FLASH_MODEL,
  GEMINI_PRO_MODEL,
]);

export const BANNED_DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
]);

export const FREE_GEMINI_MODEL_OPTIONS: Array<{
  id: string;
  label: string;
  desc: string;
}> = [
  {
    id: GEMINI_FLASH_MODEL,
    label: 'Gemini 2.5 Flash (المهام اللغوية السريعة والفهم العام)',
    desc: 'استجابة سريعة لصياغة النصوص والتلخيص والأسئلة العامة عند الاتصال.',
  },
  {
    id: GEMINI_PRO_MODEL,
    label: 'Gemini 2.5 Pro (التحليل العميق والتقارير المعقدة)',
    desc: 'للتحليلات الاستراتيجية والتقارير المفصلة ويُصعّد إليه تلقائياً عند تعقد المهمة.',
  },
];

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettingsConfig = {
  preferredModelId: GEMINI_FLASH_MODEL,
  fallbackModelId: GEMINI_PRO_MODEL,
  onlineDisabled: false,
  cacheEnabled: true,
  dailyRequestLimit: 250,
  minuteRequestLimit: 15,
  quotaWarningPercent: 80,
};

export function sanitizeAssistantModelId(raw?: string | null): string {
  const clean = String(raw || '').trim().toLowerCase();
  if (!clean || BANNED_DEPRECATED_MODELS.has(clean)) {
    return GEMINI_FLASH_MODEL;
  }
  if (clean === GEMINI_PRO_MODEL) return GEMINI_PRO_MODEL;
  if (clean === GEMINI_FLASH_MODEL) return GEMINI_FLASH_MODEL;
  return GEMINI_FLASH_MODEL;
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
    lastModelUsed: stats.lastModelUsed,
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
