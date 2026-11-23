import {
  AI_FREE_MODELS,
  AI_MODEL_REGISTRY,
  AI_ROUTING_PIPELINES,
  MORROW_LOCAL_MODEL_ID,
  resolveOrderedTaskChain,
  type AiPipelineKind,
  type AiTaskKey,
  type AiTaskRouteConfigItem,
  type ApprovedCloudModelId,
} from '../aiConfig.ts';
import type {
  AiRoutingStrategy,
  AssistantBrainMode,
  AssistantEngineSource,
} from '../types/assistant.ts';
import { normalizeIraqiDialect } from './assistantPrivacy.ts';

export interface BrainDisplayMeta {
  engine: AssistantEngineSource;
  shortLabel: string;
  badgeLabel: string;
  modelId: string;
  provider: 'local' | 'google' | 'groq' | 'openrouter';
}

export function mapModelIdToEngineSource(
  modelId?: string | null
): AssistantEngineSource {
  switch (modelId) {
    case AI_FREE_MODELS.GEMINI_3_8_FLASH:
      return 'gemini_3_8_flash';
    case AI_FREE_MODELS.GEMINI_3_8_LIVE:
      return 'gemini_3_8_live';
    case AI_FREE_MODELS.GEMINI_3_5_FLASH:
      return 'gemini_3_5_flash';
    case AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE:
      return 'gemini_3_5_flash_lite';
    case AI_FREE_MODELS.GROQ_WHISPER_TURBO:
      return 'whisper_large_v3_turbo';
    case AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL:
      return 'nemotron_free';
    case AI_FREE_MODELS.OPENROUTER_FREE_AUTO:
      return 'openrouter_free';
    default:
      return 'morrow_local';
  }
}

export function getEngineDisplayMeta(
  engine?: AssistantEngineSource,
  explicitModelId?: string | null
): BrainDisplayMeta {
  if (explicitModelId && explicitModelId in AI_MODEL_REGISTRY) {
    const spec = AI_MODEL_REGISTRY[explicitModelId as keyof typeof AI_MODEL_REGISTRY];
    return {
      engine:
        spec.id === MORROW_LOCAL_MODEL_ID
          ? 'morrow_local'
          : mapModelIdToEngineSource(spec.id),
      shortLabel: spec.shortLabel,
      badgeLabel: spec.badgeLabel,
      modelId: spec.id,
      provider: spec.provider,
    };
  }

  switch (engine) {
    case 'gemini_3_8_flash': {
      const spec = AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_8_FLASH];
      return {
        engine: 'gemini_3_8_flash',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'google',
      };
    }
    case 'gemini_3_8_live': {
      const spec = AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_8_LIVE];
      return {
        engine: 'gemini_3_8_live',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'google',
      };
    }
    case 'gemini_3_5_flash': {
      const spec = AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_5_FLASH];
      return {
        engine: 'gemini_3_5_flash',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'google',
      };
    }
    case 'gemini_3_5_flash_lite': {
      const spec = AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE];
      return {
        engine: 'gemini_3_5_flash_lite',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'google',
      };
    }
    case 'whisper_large_v3_turbo': {
      const spec = AI_MODEL_REGISTRY[AI_FREE_MODELS.GROQ_WHISPER_TURBO];
      return {
        engine: 'whisper_large_v3_turbo',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'groq',
      };
    }
    case 'nemotron_free': {
      const spec = AI_MODEL_REGISTRY[AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL];
      return {
        engine: 'nemotron_free',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'openrouter',
      };
    }
    case 'openrouter_free': {
      const spec = AI_MODEL_REGISTRY[AI_FREE_MODELS.OPENROUTER_FREE_AUTO];
      return {
        engine: 'openrouter_free',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'openrouter',
      };
    }
    default: {
      const spec = AI_MODEL_REGISTRY[MORROW_LOCAL_MODEL_ID];
      return {
        engine: 'morrow_local',
        shortLabel: spec.shortLabel,
        badgeLabel: spec.badgeLabel,
        modelId: spec.id,
        provider: 'local',
      };
    }
  }
}

/**
 * Classifies whether a user query demands deep strategic/analytical/complex reasoning
 * (`gemini-3.8-flash` -> `nvidia/nemotron-3.5-super-vl:free` -> `gemini-3.5-flash`).
 */
export function isDeepAnalyticalPrompt(prompt: string): boolean {
  const norm = normalizeIraqiDialect(prompt);
  if (!norm) return false;
  if (norm.length >= 140) return true;
  return /(تحليل عميق|تحليل استراتيجي|تقرير مفصل|تقرير معقد|مقارنه شامله|توصيات استراتيجيه|خطة عمل|استراتيجي|تنبؤ|تقييم اداء الوكالات|لماذا.*تراجع|فسر.*السبب|مراجعة شامله|pdf|جدول معقد|استخراج)/.test(
    norm
  );
}

/**
 * Classifies whether a query is structured Excel/CSV/data processing.
 */
export function isStructuredDataPrompt(prompt: string): boolean {
  const norm = normalizeIraqiDialect(prompt);
  if (!norm) return false;
  return /(excel|اكسل|csv|جدول بيانات|شيت|مصفوفة|بيانات منظمة|ترحيل|تحويل.*جدول)/.test(
    norm
  );
}

/**
 * Classifies whether a query is a fast short command suitable for flash-lite when explicitly in economy mode.
 */
export function isFastAssistantActionPrompt(prompt: string): boolean {
  const norm = normalizeIraqiDialect(prompt);
  if (!norm) return true;
  return norm.length <= 55 && !isDeepAnalyticalPrompt(prompt) && !isStructuredDataPrompt(prompt);
}

export interface EscalationPlan {
  tryLocalFirst: boolean;
  pipeline: AiPipelineKind;
  taskKey: AiTaskKey;
  cloudChain: ApprovedCloudModelId[];
  finalAnchorModel: typeof MORROW_LOCAL_MODEL_ID;
  complexity: 'simple' | 'fast' | 'balanced' | 'deep';
}

/**
 * Chief AI Architect Router — Strongest-to-Weakest Command Execution + Dedicated Backup + Final Morrow Anchor:
 * Default (`routingStrategy: 'strongest_first'`):
 *   1. Commands & assistant prompts flow strictly Strongest Cloud -> Dedicated Backup -> Descending Free Models -> Final `morrow-local`.
 *   2. `structured_excel_csv` / `heavy_pdf_vision` use their specialized task chain.
 * Optional (`routingStrategy: 'local_first_economy'`):
 *   1. Morrow Local handles deterministic commands immediately; escalates remaining prompts to the cloud pipeline.
 */
export function planBrainEscalation(params: {
  prompt: string;
  brainMode: AssistantBrainMode;
  localHandled: boolean;
  offlineOnly: boolean;
  routingStrategy?: AiRoutingStrategy;
  taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>> | null;
}): EscalationPlan {
  const {
    prompt,
    brainMode,
    localHandled,
    offlineOnly,
    routingStrategy = 'strongest_first',
    taskRouting,
  } = params;
  const deep = isDeepAnalyticalPrompt(prompt);
  const dataTask = isStructuredDataPrompt(prompt);
  const fastTask = isFastAssistantActionPrompt(prompt);

  if (offlineOnly || brainMode === 'local') {
    return {
      tryLocalFirst: true,
      pipeline: 'fast_assistant',
      taskKey: 'command_orchestration',
      cloudChain: [],
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: localHandled ? 'simple' : deep ? 'deep' : 'fast',
    };
  }

  if (brainMode === 'gemini_3_8_flash') {
    const resolved = resolveOrderedTaskChain('command_orchestration', taskRouting, {
      primaryModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    });
    return {
      tryLocalFirst: false,
      pipeline: 'deep_assistant',
      taskKey: 'command_orchestration',
      cloudChain: resolved.cloudChain,
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: 'deep',
    };
  }

  if (brainMode === 'nemotron_free') {
    const resolved = resolveOrderedTaskChain('command_orchestration', taskRouting, {
      primaryModelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      backupModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    });
    return {
      tryLocalFirst: false,
      pipeline: 'heavy_extraction',
      taskKey: 'command_orchestration',
      cloudChain: resolved.cloudChain,
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: 'deep',
    };
  }

  if (brainMode === 'gemini_3_5_flash') {
    const resolved = resolveOrderedTaskChain('structured_excel_csv', taskRouting, {
      primaryModelId: AI_FREE_MODELS.GEMINI_3_5_FLASH,
    });
    return {
      tryLocalFirst: false,
      pipeline: 'data_processing',
      taskKey: 'structured_excel_csv',
      cloudChain: resolved.cloudChain,
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: 'balanced',
    };
  }

  if (brainMode === 'gemini_3_5_flash_lite') {
    const resolved = resolveOrderedTaskChain('fast_copilot_actions', taskRouting, {
      primaryModelId: AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
      backupModelId: AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    });
    return {
      tryLocalFirst: false,
      pipeline: 'fast_assistant',
      taskKey: 'fast_copilot_actions',
      cloudChain: resolved.cloudChain,
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: 'fast',
    };
  }

  if (brainMode === 'openrouter_free') {
    const resolved = resolveOrderedTaskChain('command_orchestration', taskRouting, {
      primaryModelId: AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
      backupModelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    });
    return {
      tryLocalFirst: false,
      pipeline: 'fast_assistant',
      taskKey: 'command_orchestration',
      cloudChain: resolved.cloudChain,
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: 'balanced',
    };
  }

  // Economy Mode (explicitly chosen by user): Morrow Local executes first when handled locally
  if (routingStrategy === 'local_first_economy') {
    if (localHandled) {
      return {
        tryLocalFirst: true,
        pipeline: 'fast_assistant',
        taskKey: 'command_orchestration',
        cloudChain: [],
        finalAnchorModel: MORROW_LOCAL_MODEL_ID,
        complexity: 'simple',
      };
    }
    if (deep) {
      return {
        tryLocalFirst: true,
        pipeline: 'deep_assistant',
        taskKey: 'command_orchestration',
        cloudChain: [...AI_ROUTING_PIPELINES.deep_assistant],
        finalAnchorModel: MORROW_LOCAL_MODEL_ID,
        complexity: 'deep',
      };
    }
    if (dataTask) {
      return {
        tryLocalFirst: true,
        pipeline: 'data_processing',
        taskKey: 'structured_excel_csv',
        cloudChain: [...AI_ROUTING_PIPELINES.data_processing],
        finalAnchorModel: MORROW_LOCAL_MODEL_ID,
        complexity: 'balanced',
      };
    }
    if (fastTask) {
      return {
        tryLocalFirst: true,
        pipeline: 'fast_assistant',
        taskKey: 'fast_copilot_actions',
        cloudChain: [...AI_ROUTING_PIPELINES.fast_assistant],
        finalAnchorModel: MORROW_LOCAL_MODEL_ID,
        complexity: 'fast',
      };
    }
    return {
      tryLocalFirst: true,
      pipeline: 'balanced_assistant',
      taskKey: 'command_orchestration',
      cloudChain: [...AI_ROUTING_PIPELINES.balanced_assistant],
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: 'balanced',
    };
  }

  // Default Mode ('strongest_first'):
  // Execute strictly Strongest -> Dedicated Backup -> Descending Power Rank -> Final Morrow Local Anchor
  if (dataTask) {
    const resolved = resolveOrderedTaskChain('structured_excel_csv', taskRouting);
    return {
      tryLocalFirst: false,
      pipeline: 'data_processing',
      taskKey: 'structured_excel_csv',
      cloudChain: resolved.cloudChain,
      finalAnchorModel: MORROW_LOCAL_MODEL_ID,
      complexity: 'balanced',
    };
  }

  const commandResolved = resolveOrderedTaskChain('command_orchestration', taskRouting);
  return {
    tryLocalFirst: false,
    pipeline: 'deep_assistant',
    taskKey: 'command_orchestration',
    cloudChain: commandResolved.cloudChain,
    finalAnchorModel: MORROW_LOCAL_MODEL_ID,
    complexity: deep ? 'deep' : fastTask ? 'fast' : 'balanced',
  };
}
