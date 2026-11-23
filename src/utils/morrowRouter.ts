import type {
  AssistantBrainMode,
  AssistantEngineSource,
} from '../types/assistant.ts';
import { normalizeIraqiDialect } from './assistantPrivacy.ts';
import { GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL } from './assistantQuota.ts';

export interface BrainDisplayMeta {
  engine: AssistantEngineSource;
  shortLabel: string;
  badgeLabel: string;
  modelId: string;
}

export function getEngineDisplayMeta(
  engine?: AssistantEngineSource
): BrainDisplayMeta {
  if (engine === 'gemini_2_5_pro') {
    return {
      engine: 'gemini_2_5_pro',
      shortLabel: '2.5 Pro',
      badgeLabel: 'Gemini 2.5 Pro · تحليل عميق',
      modelId: GEMINI_PRO_MODEL,
    };
  }
  if (engine === 'gemini_2_5_flash') {
    return {
      engine: 'gemini_2_5_flash',
      shortLabel: '2.5 Flash',
      badgeLabel: 'Gemini 2.5 Flash · لغوي سريع',
      modelId: GEMINI_FLASH_MODEL,
    };
  }
  return {
    engine: 'morrow_local',
    shortLabel: 'Morrow المحلي',
    badgeLabel: 'Morrow (محلي / Offline)',
    modelId: 'morrow-local',
  };
}

/**
 * Classifies whether a user query demands deep strategic/analytical/complex report
 * reasoning (`gemini-2.5-pro`) rather than quick language drafting (`gemini-2.5-flash`).
 */
export function isDeepAnalyticalPrompt(prompt: string): boolean {
  const norm = normalizeIraqiDialect(prompt);
  if (!norm) return false;
  if (norm.length >= 140) return true;
  return /(تحليل عميق|تحليل استراتيجي|تقرير مفصل|تقرير معقد|مقارنه شامله|توصيات استراتيجيه|خطة عمل|استراتيجي|تنبؤ|تقييم اداء الوكالات|لماذا.*تراجع|فسر.*السبب|مراجعة شامله)/.test(
    norm
  );
}

export interface EscalationPlan {
  tryLocalFirst: boolean;
  cloudChain: Array<'gemini-2.5-flash' | 'gemini-2.5-pro'>;
  complexity: 'simple' | 'language' | 'deep';
}

/**
 * Pure 3-Brain Escalation Router:
 * 1. Morrow Local first for instant queries/tables/arithmetic/stealth.
 * 2. Escalate to gemini-2.5-flash for general/linguistic tasks.
 * 3. Escalate to gemini-2.5-pro for deep analysis/complex reports or when Flash fails.
 */
export function planBrainEscalation(params: {
  prompt: string;
  brainMode: AssistantBrainMode;
  localHandled: boolean;
  offlineOnly: boolean;
}): EscalationPlan {
  const { prompt, brainMode, localHandled, offlineOnly } = params;
  const deep = isDeepAnalyticalPrompt(prompt);

  if (offlineOnly || brainMode === 'local') {
    return {
      tryLocalFirst: true,
      cloudChain: [],
      complexity: localHandled ? 'simple' : deep ? 'deep' : 'language',
    };
  }

  if (brainMode === 'gemini_2_5_pro') {
    return {
      tryLocalFirst: false,
      cloudChain: [GEMINI_PRO_MODEL, GEMINI_FLASH_MODEL],
      complexity: 'deep',
    };
  }

  if (brainMode === 'gemini_2_5_flash') {
    return {
      tryLocalFirst: false,
      cloudChain: [GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL],
      complexity: deep ? 'deep' : 'language',
    };
  }

  // Auto mode: Local first -> escalate to Flash or directly to Pro on complex prompts
  if (localHandled) {
    return {
      tryLocalFirst: true,
      cloudChain: [],
      complexity: 'simple',
    };
  }

  return {
    tryLocalFirst: true,
    cloudChain: deep
      ? [GEMINI_PRO_MODEL, GEMINI_FLASH_MODEL]
      : [GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL],
    complexity: deep ? 'deep' : 'language',
  };
}
