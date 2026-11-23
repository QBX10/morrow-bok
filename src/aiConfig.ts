export type AiProviderId = 'google' | 'groq' | 'openrouter' | 'local';

export type AiPipelineKind =
  | 'audio'
  | 'heavy_extraction'
  | 'data_processing'
  | 'fast_assistant'
  | 'balanced_assistant'
  | 'deep_assistant';

export const MORROW_LOCAL_MODEL_ID = 'morrow-local' as const;

export const AI_FREE_MODELS = {
  // 1. Google AI Studio Models (Free Tier / $0)
  GEMINI_3_8_FLASH: 'gemini-3.8-flash',
  GEMINI_3_5_FLASH: 'gemini-3.5-flash',
  GEMINI_3_5_FLASH_LITE: 'gemini-3.5-flash-lite',
  GEMINI_3_8_LIVE: 'gemini-3.8-live',

  // 2. External Independent Providers (Free Tier / $0)
  GROQ_WHISPER_TURBO: 'whisper-large-v3-turbo',
  OPENROUTER_NEMOTRON_VL: 'nvidia/nemotron-3.5-super-vl:free',
  OPENROUTER_FREE_AUTO: 'openrouter/free',
} as const;

export type ApprovedCloudModelId =
  (typeof AI_FREE_MODELS)[keyof typeof AI_FREE_MODELS];

export type AnyAiModelId = ApprovedCloudModelId | typeof MORROW_LOCAL_MODEL_ID;

export const AI_PROVIDER_ENV_KEYS = {
  google: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
} as const;

export type AiModelTier =
  | 'tier_1_strongest'
  | 'tier_1_realtime'
  | 'tier_2_audio'
  | 'tier_2_backup_reasoning'
  | 'tier_2_balanced'
  | 'tier_3_auto_backup'
  | 'tier_4_fast_lite'
  | 'final_local_anchor';

export type AiTaskKey =
  | 'command_orchestration'
  | 'heavy_pdf_vision'
  | 'structured_excel_csv'
  | 'fast_copilot_actions'
  | 'audio_transcription'
  | 'live_realtime_session';

export interface AiModelSpec {
  id: AnyAiModelId;
  provider: AiProviderId;
  envKeyName: string | null;
  priority: number; // 1 = highest priority (strongest), descending to fallback
  powerRank: number; // 100 = strongest model down to 40 = final local anchor
  tier: AiModelTier;
  tierLabel: string;
  isFree: true;
  supportsVision: boolean;
  supportsPdf: boolean;
  supportsAudio: boolean;
  supportsStructuredJson: boolean;
  supportsToolCalling: boolean;
  supportsRealtimeWs?: boolean;
  shortLabel: string;
  badgeLabel: string;
  specialty: string;
  recommendedTasks: AiTaskKey[];
  endpointUrl?: string;
}

export const AI_MODEL_REGISTRY: Record<AnyAiModelId, AiModelSpec> = {
  [AI_FREE_MODELS.GEMINI_3_8_FLASH]: {
    id: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    provider: 'google',
    envKeyName: AI_PROVIDER_ENV_KEYS.google,
    priority: 1,
    powerRank: 100,
    tier: 'tier_1_strongest',
    tierLabel: 'المستوى 1 · الأقوى للمهام الثقيلة والاستنتاج',
    isFree: true,
    supportsVision: true,
    supportsPdf: true,
    supportsAudio: true,
    supportsStructuredJson: true,
    supportsToolCalling: true,
    shortLabel: '3.8 Flash',
    badgeLabel: 'Gemini 3.8 Flash · المهام الثقيلة والرؤية',
    specialty:
      'تحليل ملفات PDF المعقدة، الجداول المتداخلة، الفهم البصري العميق (Vision)، وقيادة الأوامر المعقدة مع إخراج JSON منظم.',
    recommendedTasks: ['command_orchestration', 'heavy_pdf_vision'],
  },
  [AI_FREE_MODELS.GEMINI_3_8_LIVE]: {
    id: AI_FREE_MODELS.GEMINI_3_8_LIVE,
    provider: 'google',
    envKeyName: AI_PROVIDER_ENV_KEYS.google,
    priority: 1,
    powerRank: 98,
    tier: 'tier_1_realtime',
    tierLabel: 'المستوى 1 · المحادثة الحية المباشرة',
    isFree: true,
    supportsVision: true,
    supportsPdf: false,
    supportsAudio: true,
    supportsStructuredJson: false,
    supportsToolCalling: true,
    supportsRealtimeWs: true,
    shortLabel: '3.8 Live',
    badgeLabel: 'Gemini 3.8 Live · المحادثة الصوتية والمرئية المباشرة',
    specialty:
      'الجلسات الصوتية والمرئية ثنائية الاتجاه في الزمن الحقيقي (Real-Time Live WebSocket) مع تنفيذ الأدوات المباشرة.',
    recommendedTasks: ['live_realtime_session'],
  },
  [AI_FREE_MODELS.GROQ_WHISPER_TURBO]: {
    id: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
    provider: 'groq',
    envKeyName: AI_PROVIDER_ENV_KEYS.groq,
    priority: 1,
    powerRank: 96,
    tier: 'tier_2_audio',
    tierLabel: 'متخصص الصوت فائق السرعة',
    isFree: true,
    supportsVision: false,
    supportsPdf: false,
    supportsAudio: true,
    supportsStructuredJson: false,
    supportsToolCalling: false,
    shortLabel: 'Whisper V3 Turbo',
    badgeLabel: 'Whisper Large V3 Turbo · صوت فائق السرعة',
    specialty:
      'المعالجة الصوتية (Speech-to-Text) فائقة السرعة والدقة لتحويل الأوامر الصوتية والملاحظات إلى نصوص جاهزة.',
    recommendedTasks: ['audio_transcription'],
    endpointUrl: 'https://api.groq.com/openai/v1/audio/transcriptions',
  },
  [AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL]: {
    id: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    provider: 'openrouter',
    envKeyName: AI_PROVIDER_ENV_KEYS.openrouter,
    priority: 2,
    powerRank: 92,
    tier: 'tier_2_backup_reasoning',
    tierLabel: 'المستوى 2 · الاحتياطي المستقل للاستنتاج والمستندات',
    isFree: true,
    supportsVision: true,
    supportsPdf: true,
    supportsAudio: false,
    supportsStructuredJson: true,
    supportsToolCalling: true,
    shortLabel: 'Nemotron 3.5 VL',
    badgeLabel: 'Nemotron 3.5 Super VL · ذكاء المستندات',
    specialty:
      'ذكاء المستندات (Document Intelligence)، الاستنتاج المنطقي العميق، وقراءة الوثائق والجداول المعقدة كبديل واحتياطي مستقل عالي القوة.',
    recommendedTasks: ['heavy_pdf_vision', 'command_orchestration', 'structured_excel_csv'],
    endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  [AI_FREE_MODELS.GEMINI_3_5_FLASH]: {
    id: AI_FREE_MODELS.GEMINI_3_5_FLASH,
    provider: 'google',
    envKeyName: AI_PROVIDER_ENV_KEYS.google,
    priority: 3,
    powerRank: 85,
    tier: 'tier_2_balanced',
    tierLabel: 'المستوى 3 · المتوازن للبيانات والجداول',
    isFree: true,
    supportsVision: true,
    supportsPdf: true,
    supportsAudio: true,
    supportsStructuredJson: true,
    supportsToolCalling: true,
    shortLabel: '3.5 Flash',
    badgeLabel: 'Gemini 3.5 Flash · متوازن ومتعدد الخطوات',
    specialty:
      'معالجة البيانات المنظمة (Excel/CSV)، التحليل العميق، وتنفيذ الأوامر متعددة الخطوات بسرعة ودقة عالية.',
    recommendedTasks: ['structured_excel_csv', 'command_orchestration'],
  },
  [AI_FREE_MODELS.OPENROUTER_FREE_AUTO]: {
    id: AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    provider: 'openrouter',
    envKeyName: AI_PROVIDER_ENV_KEYS.openrouter,
    priority: 4,
    powerRank: 78,
    tier: 'tier_3_auto_backup',
    tierLabel: 'المستوى 4 · الموجه الاحتياطي التلقائي',
    isFree: true,
    supportsVision: true,
    supportsPdf: false,
    supportsAudio: false,
    supportsStructuredJson: true,
    supportsToolCalling: true,
    shortLabel: 'OpenRouter Free',
    badgeLabel: 'OpenRouter Free · الموجه الاحتياطي الذكي',
    specialty:
      'بوابة الاحتياط الذكية التي تختار تلقائياً أقوى نموذج مجاني متاح لحظة الطلب (Gemma / Qwen / Llama) لضمان الاستمرارية 100%.',
    recommendedTasks: ['fast_copilot_actions', 'structured_excel_csv'],
    endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  [AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE]: {
    id: AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    provider: 'google',
    envKeyName: AI_PROVIDER_ENV_KEYS.google,
    priority: 5,
    powerRank: 70,
    tier: 'tier_4_fast_lite',
    tierLabel: 'المستوى 5 · فائق السرعة للأوامر السريعة',
    isFree: true,
    supportsVision: true,
    supportsPdf: false,
    supportsAudio: false,
    supportsStructuredJson: true,
    supportsToolCalling: true,
    shortLabel: '3.5 Flash Lite',
    badgeLabel: 'Gemini 3.5 Flash Lite · استجابة فورية',
    specialty:
      'الردود الفورية، تصنيف الأوامر، المهام السريعة المتكررة، والاستجابة ذات زمن الوصول المنخفض.',
    recommendedTasks: ['fast_copilot_actions'],
  },
  [MORROW_LOCAL_MODEL_ID]: {
    id: MORROW_LOCAL_MODEL_ID,
    provider: 'local',
    envKeyName: null,
    priority: 99,
    powerRank: 40,
    tier: 'final_local_anchor',
    tierLabel: 'النموذج الأخير · المرجع المحلي الصامد',
    isFree: true,
    supportsVision: false,
    supportsPdf: false,
    supportsAudio: false,
    supportsStructuredJson: true,
    supportsToolCalling: true,
    shortLabel: 'Morrow المحلي',
    badgeLabel: 'Morrow (محلي / Offline)',
    specialty:
      'النموذج الأخير وخط الدفاع الدائم بدون إنترنت (100% محلي): ينفذ البحث، الحاسبة، التشخيص، وإكمال العمل فور تعذر جميع المسارات السحابية.',
    recommendedTasks: [
      'command_orchestration',
      'structured_excel_csv',
      'fast_copilot_actions',
    ],
  },
};

export const SIX_FREE_CLOUD_MODELS: AiModelSpec[] = [
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_8_FLASH],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_5_FLASH],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GROQ_WHISPER_TURBO],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL],
  AI_MODEL_REGISTRY[AI_FREE_MODELS.OPENROUTER_FREE_AUTO],
];

export const ALL_REGISTERED_CLOUD_MODELS: AiModelSpec[] = [
  ...SIX_FREE_CLOUD_MODELS,
  AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_8_LIVE],
];

export const ALL_MODELS_STRONGEST_TO_WEAKEST: AiModelSpec[] = [
  ...Object.values(AI_MODEL_REGISTRY),
].sort((a, b) => b.powerRank - a.powerRank);

export interface AiTaskProfileSpec {
  key: AiTaskKey;
  title: string;
  subtitle: string;
  boundModules: string[];
  defaultPrimaryModelId: ApprovedCloudModelId;
  defaultBackupModelId: ApprovedCloudModelId;
  eligibleModels: ApprovedCloudModelId[];
  pipelineKind: AiPipelineKind;
  requiresPdf?: boolean;
  requiresVision?: boolean;
  requiresAudio?: boolean;
}

export const AI_TASK_PROFILES: Record<AiTaskKey, AiTaskProfileSpec> = {
  command_orchestration: {
    key: 'command_orchestration',
    title: 'الأوامر والمساعد الشخصي (Morrow Chat & Tools)',
    subtitle:
      'قيادة الأوامر التنفيذية، التحليلات، المقارنات، واستدعاء الأدوات بترتيب صارم من الأقوى إلى الأضعف.',
    boundModules: ['AssistantWidget', 'MorrowCommandCenterView', 'CommandPaletteModal'],
    defaultPrimaryModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    defaultBackupModelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    eligibleModels: [
      AI_FREE_MODELS.GEMINI_3_8_FLASH,
      AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      AI_FREE_MODELS.GEMINI_3_5_FLASH,
      AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
      AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    ],
    pipelineKind: 'deep_assistant',
  },
  heavy_pdf_vision: {
    key: 'heavy_pdf_vision',
    title: 'قراءة ملفات PDF والصور والدفاتر المعقدة',
    subtitle:
      'استخراج الجداول اليدوية والمطبوعة وفحص الترويسات بالرؤية البصرية ومبدأ الشك 1%.',
    boundModules: ['QuickExtractView', 'SmartExtractionLab', 'MorrowMultimodal'],
    defaultPrimaryModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    defaultBackupModelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    eligibleModels: [
      AI_FREE_MODELS.GEMINI_3_8_FLASH,
      AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      AI_FREE_MODELS.GEMINI_3_5_FLASH,
    ],
    pipelineKind: 'heavy_extraction',
    requiresVision: true,
  },
  structured_excel_csv: {
    key: 'structured_excel_csv',
    title: 'تحليل Excel / CSV والنصوص المنظمة',
    subtitle:
      'تحويل الجداول والمذكرات النصية وبيانات الوكالات إلى صفوف مهيكلة وإجراءات واضحة.',
    boundModules: ['DynamicWorkspaceCanvas', 'QuickExtractView (Excel/Text)'],
    defaultPrimaryModelId: AI_FREE_MODELS.GEMINI_3_5_FLASH,
    defaultBackupModelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    eligibleModels: [
      AI_FREE_MODELS.GEMINI_3_8_FLASH,
      AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      AI_FREE_MODELS.GEMINI_3_5_FLASH,
      AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
      AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    ],
    pipelineKind: 'data_processing',
  },
  fast_copilot_actions: {
    key: 'fast_copilot_actions',
    title: 'مساعد المسودة وتصنيف الترويسات السريع',
    subtitle:
      'الردود الفورية داخل مسودة السحب، تصفية الأسطر المشكوكة، وتصنيف الأعمدة.',
    boundModules: ['LiveDraftCopilot', 'MetadataInferenceBanner'],
    defaultPrimaryModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    defaultBackupModelId: AI_FREE_MODELS.GEMINI_3_5_FLASH,
    eligibleModels: [
      AI_FREE_MODELS.GEMINI_3_8_FLASH,
      AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      AI_FREE_MODELS.GEMINI_3_5_FLASH,
      AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
      AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    ],
    pipelineKind: 'deep_assistant',
  },
  audio_transcription: {
    key: 'audio_transcription',
    title: 'التفريغ الصوتي والرسائل الصوتية (STT)',
    subtitle:
      'تحويل الأوامر الصوتية والملاحظات باللهجة العراقية والعربية إلى نصوص دقيقة.',
    boundModules: ['MorrowCommandCenterView (Voice/QuickNote)'],
    defaultPrimaryModelId: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
    defaultBackupModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    eligibleModels: [
      AI_FREE_MODELS.GROQ_WHISPER_TURBO,
      AI_FREE_MODELS.GEMINI_3_8_FLASH,
      AI_FREE_MODELS.GEMINI_3_5_FLASH,
    ],
    pipelineKind: 'audio',
    requiresAudio: true,
  },
  live_realtime_session: {
    key: 'live_realtime_session',
    title: 'الجلسة الصوتية والمرئية المباشرة (Live)',
    subtitle:
      'بث صوتي وكاميرا ثنائي الاتجاه في الزمن الحقيقي عبر WebSocket وتنفيذ الأدوات المباشر.',
    boundModules: ['MorrowLiveSessionModal'],
    defaultPrimaryModelId: AI_FREE_MODELS.GEMINI_3_8_LIVE,
    defaultBackupModelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    eligibleModels: [
      AI_FREE_MODELS.GEMINI_3_8_LIVE,
      AI_FREE_MODELS.GEMINI_3_8_FLASH,
      AI_FREE_MODELS.GEMINI_3_5_FLASH,
    ],
    pipelineKind: 'audio',
    requiresAudio: true,
  },
};

export interface AiTaskRouteConfigItem {
  primaryModelId: ApprovedCloudModelId;
  backupModelId: ApprovedCloudModelId;
  finalLocalFallback: boolean;
}

export type AiTaskRoutingConfigMap = Record<AiTaskKey, AiTaskRouteConfigItem>;

export const DEFAULT_TASK_ROUTING: AiTaskRoutingConfigMap = {
  command_orchestration: {
    primaryModelId: AI_TASK_PROFILES.command_orchestration.defaultPrimaryModelId,
    backupModelId: AI_TASK_PROFILES.command_orchestration.defaultBackupModelId,
    finalLocalFallback: true,
  },
  heavy_pdf_vision: {
    primaryModelId: AI_TASK_PROFILES.heavy_pdf_vision.defaultPrimaryModelId,
    backupModelId: AI_TASK_PROFILES.heavy_pdf_vision.defaultBackupModelId,
    finalLocalFallback: true,
  },
  structured_excel_csv: {
    primaryModelId: AI_TASK_PROFILES.structured_excel_csv.defaultPrimaryModelId,
    backupModelId: AI_TASK_PROFILES.structured_excel_csv.defaultBackupModelId,
    finalLocalFallback: true,
  },
  fast_copilot_actions: {
    primaryModelId: AI_TASK_PROFILES.fast_copilot_actions.defaultPrimaryModelId,
    backupModelId: AI_TASK_PROFILES.fast_copilot_actions.defaultBackupModelId,
    finalLocalFallback: true,
  },
  audio_transcription: {
    primaryModelId: AI_TASK_PROFILES.audio_transcription.defaultPrimaryModelId,
    backupModelId: AI_TASK_PROFILES.audio_transcription.defaultBackupModelId,
    finalLocalFallback: true,
  },
  live_realtime_session: {
    primaryModelId: AI_TASK_PROFILES.live_realtime_session.defaultPrimaryModelId,
    backupModelId: AI_TASK_PROFILES.live_realtime_session.defaultBackupModelId,
    finalLocalFallback: true,
  },
};

/**
 * Priority-ordered smart routing pipelines (Strongest/Best -> Fallback).
 */
export const AI_ROUTING_PIPELINES: Record<AiPipelineKind, ApprovedCloudModelId[]> = {
  // 1. Audio Pipeline: Groq Whisper first -> Gemini multimodal audio fallback
  audio: [
    AI_FREE_MODELS.GROQ_WHISPER_TURBO,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
  ],
  // 2. Heavy PDF / Vision / Complex Extraction
  heavy_extraction: [
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
  ],
  // 3. Excel / CSV / Structured Data Processing
  data_processing: [
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
  ],
  // 4. Fast Assistant Actions / Quick Daily Commands
  fast_assistant: [
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
  ],
  // 5. Balanced Assistant & Multi-step Agentic Workflows
  balanced_assistant: [
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
  ],
  // 6. Deep Strategic / Analytical Reasoning (Strongest first -> weakest)
  deep_assistant: [
    AI_FREE_MODELS.GEMINI_3_8_FLASH,
    AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    AI_FREE_MODELS.GEMINI_3_5_FLASH,
    AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
  ],
};

export const APPROVED_CHAT_ORCHESTRATION_MODELS: ApprovedCloudModelId[] = [
  AI_FREE_MODELS.GEMINI_3_8_FLASH,
  AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
  AI_FREE_MODELS.GEMINI_3_5_FLASH,
  AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
  AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
];

export const APPROVED_CLOUD_MODEL_SET = new Set<string>(
  Object.values(AI_FREE_MODELS)
);

export const DEPRECATED_OR_REPLACED_MODELS = new Set<string>([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
  'gemini-3.5-transcribe',
]);

export function getAiModelSpec(modelId?: string | null): AiModelSpec {
  const clean = String(modelId || '').trim();
  if (clean && clean in AI_MODEL_REGISTRY) {
    return AI_MODEL_REGISTRY[clean as AnyAiModelId];
  }
  return AI_MODEL_REGISTRY[AI_FREE_MODELS.GEMINI_3_8_FLASH];
}

export function sanitizeAiModelId(raw?: string | null): ApprovedCloudModelId {
  const clean = String(raw || '').trim();
  if (!clean || DEPRECATED_OR_REPLACED_MODELS.has(clean.toLowerCase())) {
    return AI_FREE_MODELS.GEMINI_3_8_FLASH;
  }
  if (APPROVED_CLOUD_MODEL_SET.has(clean)) {
    return clean as ApprovedCloudModelId;
  }
  const lower = clean.toLowerCase();
  const matched = Object.values(AI_FREE_MODELS).find(
    (m) => m.toLowerCase() === lower
  );
  return matched || AI_FREE_MODELS.GEMINI_3_8_FLASH;
}

/**
 * Resolves the exact execution cascade for any task:
 * 1. Primary specialized model
 * 2. Dedicated backup model
 * 3. Remaining eligible cloud models sorted strictly Strongest -> Weakest (by powerRank)
 * 4. Final resilient anchor: morrow-local
 */
export function resolveOrderedTaskChain(
  taskKey: AiTaskKey,
  taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>> | null,
  overrides?: {
    primaryModelId?: string | null;
    backupModelId?: string | null;
    strictStrongestOrder?: boolean;
  }
): {
  cloudChain: ApprovedCloudModelId[];
  finalAnchorModel: typeof MORROW_LOCAL_MODEL_ID;
  primaryModelId: ApprovedCloudModelId;
  backupModelId: ApprovedCloudModelId;
  finalLocalFallback: boolean;
} {
  const profile = AI_TASK_PROFILES[taskKey];
  const saved = taskRouting?.[taskKey];
  const fallbackDefault = DEFAULT_TASK_ROUTING[taskKey];

  const candidatePrimary = sanitizeAiModelId(
    overrides?.primaryModelId || saved?.primaryModelId || fallbackDefault.primaryModelId
  );
  const primaryModelId = profile.eligibleModels.includes(candidatePrimary)
    ? candidatePrimary
    : fallbackDefault.primaryModelId;

  const candidateBackup = sanitizeAiModelId(
    overrides?.backupModelId || saved?.backupModelId || fallbackDefault.backupModelId
  );
  const backupModelId =
    profile.eligibleModels.includes(candidateBackup) &&
    candidateBackup !== primaryModelId
      ? candidateBackup
      : profile.eligibleModels.find((m) => m !== primaryModelId) ||
        fallbackDefault.backupModelId;

  const remainingStrongestToWeakest = [...profile.eligibleModels]
    .filter((id) => id !== primaryModelId && id !== backupModelId)
    .sort((a, b) => getAiModelSpec(b).powerRank - getAiModelSpec(a).powerRank);

  let orderedCloud: ApprovedCloudModelId[];
  if (overrides?.strictStrongestOrder) {
    orderedCloud = [...profile.eligibleModels].sort(
      (a, b) => getAiModelSpec(b).powerRank - getAiModelSpec(a).powerRank
    );
  } else {
    orderedCloud = Array.from(
      new Set<ApprovedCloudModelId>([
        primaryModelId,
        backupModelId,
        ...remainingStrongestToWeakest,
      ])
    );
  }

  return {
    cloudChain: orderedCloud,
    finalAnchorModel: MORROW_LOCAL_MODEL_ID,
    primaryModelId,
    backupModelId,
    finalLocalFallback: saved?.finalLocalFallback ?? true,
  };
}

/**
 * Converts a 2D spreadsheet/table matrix into structured CSV + Markdown preview text
 * suitable for the data_processing pipeline (Gemini 3.5 Flash / Nemotron / OpenRouter).
 */
export function formatMatrixAsCsvMarkdown(
  matrix: unknown[][],
  maxRows: number = 250
): string {
  const nonEmpty = (Array.isArray(matrix) ? matrix : [])
    .filter(
      (row) =>
        Array.isArray(row) &&
        row.some((cell) => String(cell ?? '').trim() !== '')
    )
    .slice(0, maxRows);

  if (nonEmpty.length === 0) return '';

  const escapeCsv = (val: unknown): string => {
    const s = String(val ?? '').replace(/\r?\n/g, ' ').trim();
    if (s.includes(',') || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvLines = nonEmpty.map((row) => row.map(escapeCsv).join(','));
  const header = nonEmpty[0].map((c) => String(c ?? '').replace(/\|/g, '/').trim() || '—');
  const mdSeparator = header.map(() => '---');
  const mdBody = nonEmpty.slice(1, Math.min(nonEmpty.length, 45)).map((row) =>
    header.map((_, idx) => String(row[idx] ?? '').replace(/\|/g, '/').trim()).join(' | ')
  );

  const mdTable = [
    `| ${header.join(' | ')} |`,
    `| ${mdSeparator.join(' | ')} |`,
    ...mdBody.map((line) => `| ${line} |`),
  ].join('\n');

  return `### Markdown Table Preview\n${mdTable}\n\n### Full CSV Data\n${csvLines.join('\n')}`;
}

/**
 * Server-only helper to inspect API keys from process.env safely.
 * Returns empty strings if invoked in a browser environment.
 */
export function getServerProviderApiKeys(): {
  geminiApiKey: string;
  groqApiKey: string;
  openRouterApiKey: string;
} {
  if (typeof process === 'undefined' || !process.env) {
    return { geminiApiKey: '', groqApiKey: '', openRouterApiKey: '' };
  }
  const clean = (v: string | undefined, placeholder: string): string => {
    const t = String(v || '').trim();
    return !t || t === placeholder ? '' : t;
  };
  return {
    geminiApiKey: clean(process.env.GEMINI_API_KEY, 'MY_GEMINI_API_KEY'),
    groqApiKey: clean(process.env.GROQ_API_KEY, 'MY_GROQ_API_KEY'),
    openRouterApiKey: clean(process.env.OPENROUTER_API_KEY, 'MY_OPENROUTER_API_KEY'),
  };
}
