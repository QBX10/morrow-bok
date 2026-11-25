import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { authFetch } from '../../../lib/authClient';
import {
  Activity,
  Bot,
  CheckCircle2,
  Cpu,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import {
  AI_MODEL_REGISTRY,
  AI_TASK_PROFILES,
  ALL_MODELS_STRONGEST_TO_WEAKEST,
  MORROW_LOCAL_MODEL_ID,
  resolveOrderedTaskChain,
  type AiProviderId,
  type AiTaskKey,
  type AnyAiModelId,
  type ApprovedCloudModelId,
} from '../../../aiConfig';
import type {
  AssistantConnectivityState,
  AssistantSettingsConfig,
} from '../../../types/assistant';
import {
  DEFAULT_ASSISTANT_SETTINGS,
  normalizeAssistantSettings,
  type QuotaCheckResult,
} from '../../../utils/assistantQuota';
import {
  TABRIX_EASE,
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixOrderedDirection,
  useTabrixReducedMotion,
} from '../../../utils/tabrixMotion';
import {
  TabrixPillIndicator,
  TabrixSubViewTransition,
} from '../../ui/TabrixMotionPrimitives';

interface ServerOrchestrationStatus {
  cloudConfigured: boolean;
  providers: {
    google: boolean;
    groq: boolean;
    openrouter: boolean;
    local: boolean;
  };
  modelsSortedStrongestFirst?: Array<{
    id: string;
    provider: AiProviderId;
    powerRank: number;
    configured: boolean;
  }>;
}

interface LiveProbeState {
  loading: boolean;
  ok?: boolean;
  modelId?: string;
  provider?: AiProviderId;
  latencyMs?: number;
  fallbackUsed?: boolean;
  replySnippet?: string;
  errorSummary?: string;
  attemptsCount?: number;
}

interface AiModelsArchitectureStudioProps {
  assistantSettings: AssistantSettingsConfig;
  assistantConnectivity: AssistantConnectivityState;
  assistantQuotaInfo?: QuotaCheckResult;
  assistantCacheCount: number;
  onUpdateAssistantSettings?: (patch: Partial<AssistantSettingsConfig>) => void;
  onResetAssistantQuota?: () => void;
  onClearAssistantCache?: () => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError?: (msg: string) => void;
}

type StudioTab = 'routing' | 'registry' | 'integration';

const STUDIO_TAB_ORDER: Record<StudioTab, number> = {
  routing: 0,
  registry: 1,
  integration: 2,
};

const TASK_KEYS_ORDER: AiTaskKey[] = [
  'command_orchestration',
  'heavy_pdf_vision',
  'structured_excel_csv',
  'fast_copilot_actions',
  'audio_transcription',
  'live_realtime_session',
];

const APP_ROOT_INTEGRATION_MAP: Array<{
  id: string;
  moduleTitle: string;
  componentName: string;
  endpoint: string;
  taskKey: AiTaskKey;
  roleSummary: string;
}> = [
  {
    id: 'int_assistant_widget',
    moduleTitle: 'المساعد الذكي العائم ولوحة الأوامر السريعة',
    componentName: 'AssistantWidget · useAssistantEngine',
    endpoint: 'POST /api/assistant/chat',
    taskKey: 'command_orchestration',
    roleSummary:
      'تنفيذ الأوامر الإدارية، استدعاء الأدوات، المقارنات، والفحص الذكي من النموذج الأقوى حتى الأضعف.',
  },
  {
    id: 'int_quick_extract',
    moduleTitle: 'مختبر السحب الذكي وقراءة الدفاتر الكونية',
    componentName: 'QuickExtractView · SmartExtractionLab',
    endpoint: 'POST /api/ucrs/analyze · /api/quick-extract',
    taskKey: 'heavy_pdf_vision',
    roleSummary:
      'استخراج الجداول اليدوية والمصوّرة وملفات PDF المعقدة وتطبيق قاعدة الشك 1%.',
  },
  {
    id: 'int_dynamic_canvas',
    moduleTitle: 'محلل ملفات Excel / CSV ومذكرات النص',
    componentName: 'DynamicWorkspaceCanvas',
    endpoint: 'POST /api/morrow/analyze-text',
    taskKey: 'structured_excel_csv',
    roleSummary:
      'تحويل البيانات الجدولية والملاحظات إلى تحديثات أفراد وحجب وإضافات جاهزة للموافقة.',
  },
  {
    id: 'int_live_copilot',
    moduleTitle: 'المساعد الحي لمسودة السحب وترويسة المستند',
    componentName: 'LiveDraftCopilot · MetadataInferenceBanner',
    endpoint: 'POST /api/quick-extract/copilot · /metadata-inference',
    taskKey: 'fast_copilot_actions',
    roleSummary:
      'استنتاج اسم الوكالة والتاريخ والأعمدة وتعديل وتصفية مسودة السحب فورياً.',
  },
  {
    id: 'int_voice_stt',
    moduleTitle: 'التفريغ الصوتي والرسائل الصوتية السريعة',
    componentName: 'MorrowCommandCenterView (Voice)',
    endpoint: 'POST /api/morrow/transcribe',
    taskKey: 'audio_transcription',
    roleSummary:
      'تفريغ التعليمات الصوتية والملاحظات باللهجة العراقية بدقة عالية وسرعة فائقة.',
  },
  {
    id: 'int_live_ws',
    moduleTitle: 'الجلسة الصوتية والمرئية المباشرة بالزمن الحقيقي',
    componentName: 'MorrowLiveSessionModal',
    endpoint: 'WS /api/morrow/live',
    taskKey: 'live_realtime_session',
    roleSummary:
      'تواصل صوتي ومرئي حي ومباشر مع تنفيذ فوري لأدوات البحث والتصفية.',
  },
];

function formatProviderName(provider: AiProviderId): string {
  switch (provider) {
    case 'google':
      return 'Google AI';
    case 'groq':
      return 'Groq API';
    case 'openrouter':
      return 'OpenRouter';
    default:
      return 'محلي 100%';
  }
}

function buildCapabilitiesLine(modelId: AnyAiModelId): string {
  const spec = AI_MODEL_REGISTRY[modelId];
  const caps: string[] = [];
  if (spec.supportsPdf) caps.push('PDF');
  if (spec.supportsVision) caps.push('رؤية بصرية');
  if (spec.supportsStructuredJson) caps.push('JSON منظم');
  if (spec.supportsToolCalling) caps.push('استدعاء أدوات');
  if (spec.supportsAudio) caps.push('صوت');
  if (spec.supportsRealtimeWs) caps.push('بث حي مباشر');
  return caps.length > 0 ? caps.join(' · ') : 'منطق محلي';
}

export const AiModelsArchitectureStudio: React.FC<
  AiModelsArchitectureStudioProps
> = ({
  assistantSettings,
  assistantConnectivity,
  assistantQuotaInfo,
  assistantCacheCount,
  onUpdateAssistantSettings,
  onResetAssistantQuota,
  onClearAssistantCache,
  onNotifySuccess,
  onNotifyError,
}) => {
  const normalizedSettings = useMemo(
    () => normalizeAssistantSettings(assistantSettings),
    [assistantSettings]
  );

  const [activeTab, setActiveTab] = useState<StudioTab>('routing');
  const reducedMotion = useTabrixReducedMotion();
  const tabDirection = useTabrixOrderedDirection(activeTab, STUDIO_TAB_ORDER);
  const [serverStatus, setServerStatus] = useState<ServerOrchestrationStatus | null>(
    null
  );
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [probeMap, setProbeMap] = useState<Record<string, LiveProbeState>>({});
  const [highlightedTaskKey, setHighlightedTaskKey] = useState<AiTaskKey | null>(
    null
  );

  const refreshServerStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/assistant/status');
      if (res.ok) {
        const json = (await res.json()) as ServerOrchestrationStatus;
        setServerStatus(json);
      }
    } catch {
      // keep previous or offline UI
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void refreshServerStatus();
  }, [refreshServerStatus]);

  const isProviderConfigured = useCallback(
    (provider: AiProviderId): boolean | null => {
      if (provider === 'local') return true;
      if (!serverStatus) return null;
      return Boolean(serverStatus.providers[provider]);
    },
    [serverStatus]
  );

  const runLiveProbe = useCallback(
    async (opts: {
      probeKey: string;
      modelId?: string;
      backupModelId?: string;
      taskKey?: AiTaskKey;
    }) => {
      setProbeMap((prev) => ({
        ...prev,
        [opts.probeKey]: { loading: true },
      }));
      try {
        const res = await authFetch('/api/assistant/test-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: opts.modelId,
            backupModelId: opts.backupModelId,
            taskKey: opts.taskKey,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          modelId?: string;
          provider?: AiProviderId;
          latencyMs?: number;
          fallbackUsed?: boolean;
          replySnippet?: string;
          errorSummary?: string;
          attempts?: unknown[];
        };
        setProbeMap((prev) => ({
          ...prev,
          [opts.probeKey]: {
            loading: false,
            ok: Boolean(data.ok),
            modelId: data.modelId,
            provider: data.provider,
            latencyMs: data.latencyMs,
            fallbackUsed: data.fallbackUsed,
            replySnippet: data.replySnippet,
            errorSummary: data.errorSummary,
            attemptsCount: Array.isArray(data.attempts) ? data.attempts.length : 0,
          },
        }));
        if (data.ok) {
          onNotifySuccess(
            `نجح الفحص عبر ${data.modelId} (${data.latencyMs ?? 0} مللي ثانية)`
          );
        } else {
          onNotifyError?.(
            data.errorSummary ||
              'تعذر المسار السحابي — تم تأكيد جاهزية Morrow المحلي كمرجع أخير.'
          );
        }
      } catch (err) {
        setProbeMap((prev) => ({
          ...prev,
          [opts.probeKey]: {
            loading: false,
            ok: false,
            modelId: MORROW_LOCAL_MODEL_ID,
            provider: 'local',
            errorSummary:
              err instanceof Error ? err.message : 'تعذر الاتصال بنقطة الفحص.',
          },
        }));
        onNotifyError?.('تعذر إجراء الفحص الحي حالياً.');
      }
    },
    [onNotifyError, onNotifySuccess]
  );

  const handleTaskRouteChange = useCallback(
    (
      taskKey: AiTaskKey,
      patch: {
        primaryModelId?: ApprovedCloudModelId;
        backupModelId?: ApprovedCloudModelId;
        finalLocalFallback?: boolean;
      }
    ) => {
      const current = normalizedSettings.taskRouting[taskKey];
      const nextPrimary = patch.primaryModelId ?? current.primaryModelId;
      let nextBackup = patch.backupModelId ?? current.backupModelId;
      if (nextBackup === nextPrimary) {
        nextBackup =
          AI_TASK_PROFILES[taskKey].eligibleModels.find((m) => m !== nextPrimary) ||
          nextBackup;
      }

      const nextTaskRouting = {
        ...normalizedSettings.taskRouting,
        [taskKey]: {
          primaryModelId: nextPrimary,
          backupModelId: nextBackup,
          finalLocalFallback:
            patch.finalLocalFallback ?? current.finalLocalFallback,
        },
      };

      const settingsPatch: Partial<AssistantSettingsConfig> = {
        taskRouting: nextTaskRouting,
      };
      if (taskKey === 'command_orchestration') {
        settingsPatch.preferredModelId = nextPrimary;
        settingsPatch.fallbackModelId = nextBackup;
      }

      onUpdateAssistantSettings?.(settingsPatch);
    },
    [normalizedSettings.taskRouting, onUpdateAssistantSettings]
  );

  const handleResetArchitecture = () => {
    onUpdateAssistantSettings?.(structuredClone(DEFAULT_ASSISTANT_SETTINGS));
    onNotifySuccess('تمت استعادة معمارية التوجيه من الأقوى إلى الأضعف + Morrow الأخير.');
  };

  return (
    <section
      data-testid="assistant-settings-section"
      className="capsule-glass-card rounded-2xl border p-5 sm:p-6 space-y-6"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Top Executive Studio Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--border-color)' }}>
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <Bot className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">
              معمارية نماذج الذكاء الاصطناعي والتوجيه التخصصي
            </h2>
          </div>
          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>
              الحالة:{' '}
              <strong
                style={{
                  color:
                    assistantConnectivity === 'online'
                      ? 'var(--success)'
                      : assistantConnectivity === 'quota_exhausted'
                        ? 'var(--danger)'
                        : 'var(--warning)',
                }}
              >
                {assistantConnectivity === 'online'
                  ? 'متصل أونلاين'
                  : assistantConnectivity === 'quota_exhausted'
                    ? 'الحصة مكتملة · يعمل بـ Morrow المحلي'
                    : 'وضع أوفلاين (Morrow المحلي)'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Google AI:{' '}
              {serverStatus
                ? serverStatus.providers.google
                  ? 'مفعّل'
                  : 'غير مهيأ'
                : '...'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Groq Whisper:{' '}
              {serverStatus
                ? serverStatus.providers.groq
                  ? 'مفعّل'
                  : 'غير مهيأ'
                : '...'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              OpenRouter:{' '}
              {serverStatus
                ? serverStatus.providers.openrouter
                  ? 'مفعّل'
                  : 'غير مهيأ'
                : '...'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Morrow المحلي: جاهز دائماً</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void refreshServerStatus()}
            disabled={loadingStatus}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`}
            />
            <span>تحديث الجاهزية</span>
          </button>

          <button
            type="button"
            onClick={handleResetArchitecture}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>استعادة الافتراضي</span>
          </button>
        </div>
      </div>

      {/* Primary Execution Strategy Selector (Strongest-to-Weakest vs Economy) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold">
            استراتيجية تنفيذ الأوامر والمساعد الشخصي
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            التسلسل التنازلي: الأقوى ← الاحتياطي ← التدرج ← النموذج الأخير Morrow
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              onUpdateAssistantSettings?.({ routingStrategy: 'strongest_first' })
            }
            className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3.5 text-right transition-colors"
            style={{
              backgroundColor:
                normalizedSettings.routingStrategy === 'strongest_first'
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
              borderColor:
                normalizedSettings.routingStrategy === 'strongest_first'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
            }}
          >
            <div className="space-y-1">
              <div className="text-xs font-extrabold">
                من الأقوى إلى الأضعف + الاحتياطي + Morrow الأخير (معتمد)
              </div>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                يوجّه كل أمر إلى أقوى نموذج متاح للمهمة، وعند الضغط أو الانقطاع ينتقل للاحتياطي ثم التدرج التنازلي حتى يستقر عند Morrow المحلي كمرجع أخير.
              </p>
            </div>
            <CheckCircle2
              className="h-4 w-4 shrink-0 mt-0.5"
              style={{
                color:
                  normalizedSettings.routingStrategy === 'strongest_first'
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                opacity:
                  normalizedSettings.routingStrategy === 'strongest_first'
                    ? 1
                    : 0.35,
              }}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateAssistantSettings?.({ routingStrategy: 'local_first_economy' })
            }
            className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3.5 text-right transition-colors"
            style={{
              backgroundColor:
                normalizedSettings.routingStrategy === 'local_first_economy'
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
              borderColor:
                normalizedSettings.routingStrategy === 'local_first_economy'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
            }}
          >
            <div className="space-y-1">
              <div className="text-xs font-extrabold">
                الأوفلاين أولاً لتوفير الحصة (الاقتصاد بالطلبات)
              </div>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                يعالج الأوامر البسيطة والتصفية مباشرة عبر Morrow المحلي، ويرفع الطلبات المركبة والتحليلية فقط إلى السحابة.
              </p>
            </div>
            <CheckCircle2
              className="h-4 w-4 shrink-0 mt-0.5"
              style={{
                color:
                  normalizedSettings.routingStrategy === 'local_first_economy'
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                opacity:
                  normalizedSettings.routingStrategy === 'local_first_economy'
                    ? 1
                    : 0.35,
              }}
            />
          </button>
        </div>
      </div>

      {/* Multi-Model Collaboration Mode Selector */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold">
            وضع تعاون النماذج والتدقيق المتعدد (AI Council)
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            تخطيط بالأساسي ← مراجعة وتدقيق بنموذج مكمل مستقل
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(
            [
              {
                id: 'council_review' as const,
                title: 'مجلس النماذج (المخطط + المدقق)',
                desc: 'ينفذ النموذج الأساسي، ثم يدقق نموذج مكمل مستقل الرد ويقترح الخطوة التالية أو لوحة العرض الأنسب.',
              },
              {
                id: 'multi_step_agent' as const,
                title: 'وكيل متعدد المراحل (استدلال عميق)',
                desc: 'تدقيق مكثف دائماً على القرارات المالية وتنسيق الجداول والماكرو لرفع الدقة في كل رد.',
              },
              {
                id: 'single' as const,
                title: 'نموذج منفرد فقط (مقتصد)',
                desc: 'اكتفاء بالنموذج الأساسي وحده دون طبقة مراجعة ثانية لتوفير سرعة وحصة الطلبات.',
              },
            ]
          ).map((opt) => {
            const active = normalizedSettings.collaborationMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateAssistantSettings?.({ collaborationMode: opt.id })
                }
                className="flex items-start justify-between gap-2.5 rounded-xl border px-3.5 py-3 text-right transition-colors"
                style={{
                  backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div className="space-y-1">
                  <div className="text-xs font-extrabold">{opt.title}</div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {opt.desc}
                  </p>
                </div>
                <CheckCircle2
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    opacity: active ? 1 : 0.35,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Architecture Tabs */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border p-1.5"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
        }}
      >
        {(
          [
            ['routing', '01. التوجيه حسب المهمة والاحتياط', Layers],
            ['registry', '02. سجل النماذج من الأقوى للأضعف', Cpu],
            ['integration', '03. الربط الجذري بالتطبيق', Activity],
          ] as const
        ).map(([tabKey, label, Icon]) => {
          const isActive = activeTab === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className="relative inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors"
              style={{
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {isActive && (
                <TabrixPillIndicator
                  layoutId="ai-studio-tab-pill"
                  className="rounded-lg"
                />
              )}
              <Icon
                className="relative z-10 h-3.5 w-3.5 shrink-0"
                style={{ color: isActive ? 'var(--accent)' : undefined }}
              />
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>

      <TabrixSubViewTransition viewKey={activeTab} direction={tabDirection}>
      {/* TAB 1: Specialized Task Routing + Primary + Backup + Final Morrow Local */}
      {activeTab === 'routing' && (
        <div
          className="divide-y rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {TASK_KEYS_ORDER.map((taskKey, index) => {
            const profile = AI_TASK_PROFILES[taskKey];
            const routeCfg = normalizedSettings.taskRouting[taskKey];
            const resolvedChain = resolveOrderedTaskChain(
              taskKey,
              normalizedSettings.taskRouting
            );
            const probeKey = `task:${taskKey}`;
            const probe = probeMap[probeKey];
            const isHighlighted = highlightedTaskKey === taskKey;

            return (
              <div
                key={taskKey}
                className="p-4 sm:p-5 space-y-3 transition-colors"
                style={{
                  borderColor: 'var(--border-color)',
                  backgroundColor: isHighlighted
                    ? 'var(--bg-nav-active)'
                    : 'transparent',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-extrabold">
                      0{index + 1}. {profile.title}
                    </div>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {profile.subtitle}
                    </p>
                    <div
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      الوحدات المرتبطة: {profile.boundModules.join(' · ')}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(probe?.loading)}
                    onClick={() =>
                      void runLiveProbe({
                        probeKey,
                        taskKey,
                        modelId: routeCfg.primaryModelId,
                        backupModelId: routeCfg.backupModelId,
                      })
                    }
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    {probe?.loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    )}
                    <span>{probe?.loading ? 'جاري الاختبار...' : 'اختبار المسار'}</span>
                  </button>
                </div>

                {/* Primary + Backup + Morrow Anchor Controls */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-xs">
                  <div className="space-y-1">
                    <label
                      htmlFor={
                        taskKey === 'command_orchestration'
                          ? 'assistant-model-select'
                          : `primary-${taskKey}`
                      }
                      className="block text-[11px] font-bold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      النموذج الأساسي (الأولوية 1)
                    </label>
                    <select
                      id={
                        taskKey === 'command_orchestration'
                          ? 'assistant-model-select'
                          : `primary-${taskKey}`
                      }
                      value={routeCfg.primaryModelId}
                      onChange={(e) =>
                        handleTaskRouteChange(taskKey, {
                          primaryModelId: e.target.value as ApprovedCloudModelId,
                        })
                      }
                      className="min-h-[40px] w-full rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {profile.eligibleModels.map((modelId) => {
                        const spec = AI_MODEL_REGISTRY[modelId];
                        return (
                          <option key={modelId} value={modelId}>
                            [{spec.powerRank}] {spec.badgeLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`backup-${taskKey}`}
                      className="block text-[11px] font-bold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      النموذج الاحتياطي المباشر (الأولوية 2)
                    </label>
                    <select
                      id={`backup-${taskKey}`}
                      value={routeCfg.backupModelId}
                      onChange={(e) =>
                        handleTaskRouteChange(taskKey, {
                          backupModelId: e.target.value as ApprovedCloudModelId,
                        })
                      }
                      className="min-h-[40px] w-full rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {profile.eligibleModels
                        .filter((m) => m !== routeCfg.primaryModelId)
                        .map((modelId) => {
                          const spec = AI_MODEL_REGISTRY[modelId];
                          return (
                            <option key={modelId} value={modelId}>
                              [{spec.powerRank}] {spec.badgeLabel}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span
                      className="block text-[11px] font-bold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      المرجع الأخير (الأوفلاين الآمن)
                    </span>
                    <label
                      className="flex min-h-[40px] cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span className="truncate">
                        Morrow المحلي (<span dir="ltr" className="font-mono">morrow-local</span>)
                      </span>
                      <input
                        type="checkbox"
                        checked={routeCfg.finalLocalFallback}
                        onChange={(e) =>
                          handleTaskRouteChange(taskKey, {
                            finalLocalFallback: e.target.checked,
                          })
                        }
                      />
                    </label>
                  </div>
                </div>

                {/* Live Computed Cascade Typography (Zero-Pill Unboxed) */}
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] pt-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    سلسلة التصعيد بالترتيب:
                  </span>
                  {resolvedChain.cloudChain.map((mId, idx) => (
                    <React.Fragment key={mId}>
                      <span
                        className={idx === 0 ? 'font-extrabold' : 'font-semibold'}
                        style={{
                          color: idx === 0 ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                      >
                        {AI_MODEL_REGISTRY[mId].shortLabel}
                      </span>
                      <span aria-hidden="true">←</span>
                    </React.Fragment>
                  ))}
                  <span className="font-extrabold">
                    Morrow المحلي (النهائي)
                  </span>
                </div>

                {/* Real Live Probe Output */}
                <AnimatePresence initial={false}>
                  {probe && !probe.loading && (
                    <motion.div
                      key={`probe-${probeKey}`}
                      variants={
                        reducedMotion
                          ? TABRIX_REDUCED_VARIANTS
                          : TABRIX_POPOVER_VARIANTS
                      }
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="rounded-xl border px-3.5 py-2.5 text-xs space-y-1"
                      style={{
                        backgroundColor: probe.ok
                          ? 'var(--success-bg)'
                          : 'var(--warning-bg)',
                        borderColor: probe.ok ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold">
                        <span>
                          {probe.ok
                            ? `استجاب عبر: ${probe.modelId}${probe.fallbackUsed ? ' (تم التبديل للاحتياطي)' : ''}`
                            : 'تعذر المسار السحابي — المرجع المحلي Morrow جاهز كخيار أخير'}
                        </span>
                        {typeof probe.latencyMs === 'number' && (
                          <span className="font-mono tabular-nums text-[11px]">
                            {probe.latencyMs} ms · محاولات {probe.attemptsCount ?? 1}
                          </span>
                        )}
                      </div>
                      {probe.replySnippet && (
                        <p className="text-[11px] leading-relaxed">
                          {probe.replySnippet}
                        </p>
                      )}
                      {probe.errorSummary && !probe.ok && (
                        <p className="text-[11px]" style={{ color: 'var(--danger)' }}>
                          {probe.errorSummary}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: All 8 Models Sorted Strictly Strongest -> Weakest */}
      {activeTab === 'registry' && (
        <div
          className="divide-y rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {ALL_MODELS_STRONGEST_TO_WEAKEST.map((spec, idx) => {
            const configured = isProviderConfigured(spec.provider);
            const probeKey = `model:${spec.id}`;
            const probe = probeMap[probeKey];
            const indexLabel = String(idx + 1).padStart(2, '0');

            return (
              <div
                key={spec.id}
                className="p-4 sm:p-5 space-y-2.5"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <span
                        className="font-mono text-xs font-extrabold tabular-nums"
                        style={{ color: 'var(--accent)' }}
                      >
                        {indexLabel}.
                      </span>
                      <span className="text-sm font-extrabold">
                        {spec.shortLabel}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {spec.id}
                      </span>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {spec.tierLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">مرتبة القوة {spec.powerRank}</span>
                      <span aria-hidden="true">·</span>
                      <span>المزود: {formatProviderName(spec.provider)}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        style={{
                          color:
                            configured === true
                              ? 'var(--success)'
                              : configured === false
                                ? 'var(--danger)'
                                : 'var(--text-muted)',
                        }}
                      >
                        {spec.provider === 'local'
                          ? 'مدمج محلياً 100%'
                          : configured === true
                            ? `مفتاح الخادم (${spec.envKeyName}) جاهز`
                            : configured === false
                              ? `مفتاح الخادم (${spec.envKeyName}) غير مهيأ`
                              : 'جاري التحقق'}
                      </span>
                    </div>

                    <p
                      className="text-xs leading-relaxed pt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {spec.specialty}
                    </p>

                    <div
                      className="text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      القدرات المدعومة: {buildCapabilitiesLine(spec.id)}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(probe?.loading)}
                    onClick={() =>
                      void runLiveProbe({
                        probeKey,
                        modelId: spec.id,
                      })
                    }
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    {probe?.loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    )}
                    <span>{probe?.loading ? 'جاري الفحص...' : 'فحص حي'}</span>
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {probe && !probe.loading && (
                    <motion.div
                      key={`reg-probe-${probeKey}`}
                      variants={
                        reducedMotion
                          ? TABRIX_REDUCED_VARIANTS
                          : TABRIX_POPOVER_VARIANTS
                      }
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="rounded-xl border px-3.5 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                      style={{
                        backgroundColor: probe.ok
                          ? 'var(--success-bg)'
                          : 'var(--warning-bg)',
                        borderColor: probe.ok ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      <span>
                        {probe.replySnippet ||
                          probe.errorSummary ||
                          'انتهى الفحص.'}
                      </span>
                      {typeof probe.latencyMs === 'number' && (
                        <span className="font-mono tabular-nums text-[11px]">
                          {probe.latencyMs} ms
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Root App Integration Map */}
      {activeTab === 'integration' && (
        <div
          className="divide-y rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {APP_ROOT_INTEGRATION_MAP.map((entry, idx) => {
            const chain = resolveOrderedTaskChain(
              entry.taskKey,
              normalizedSettings.taskRouting
            );
            const primarySpec = AI_MODEL_REGISTRY[chain.primaryModelId];
            const backupSpec = AI_MODEL_REGISTRY[chain.backupModelId];
            const indexLabel = String(idx + 1).padStart(2, '0');

            return (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span
                      className="font-mono text-xs font-extrabold tabular-nums"
                      style={{ color: 'var(--accent)' }}
                    >
                      {indexLabel}.
                    </span>
                    <span className="text-sm font-extrabold">
                      {entry.moduleTitle}
                    </span>
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span dir="ltr" className="font-mono">
                      {entry.componentName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span dir="ltr" className="font-mono">
                      {entry.endpoint}
                    </span>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {entry.roleSummary}
                  </p>
                  <div className="text-[11px] pt-0.5 font-bold">
                    المسار النشط:{' '}
                    <span style={{ color: 'var(--accent)' }}>
                      {primarySpec.shortLabel}
                    </span>{' '}
                    ← الاحتياطي: {backupSpec.shortLabel} ← ... ← Morrow المحلي
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHighlightedTaskKey(entry.taskKey);
                    setActiveTab('routing');
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>تعديل التوجيه</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      </TabrixSubViewTransition>

      {/* Always-Reachable Quota, Cache & Strict Offline Section */}
      <div
        className="border-t pt-5 space-y-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold">
            حدود الحصة السحابية، الكاش، وتشغيل الأوفلاين الصارم
          </h3>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            الاستهلاك اليومي: {assistantQuotaInfo?.dailyUsed ?? 0} /{' '}
            {normalizedSettings.dailyRequestLimit} · آخر دقيقة:{' '}
            {assistantQuotaInfo?.minuteUsed ?? 0} /{' '}
            {normalizedSettings.minuteRequestLimit}
          </span>
        </div>

        {/* Daily Progress Strip */}
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--bg-main)' }}
        >
          <motion.div
            className="h-full"
            initial={false}
            animate={{ width: `${assistantQuotaInfo?.dailyPercent ?? 0}%` }}
            transition={{
              duration: reducedMotion ? 0.05 : 0.4,
              ease: TABRIX_EASE,
            }}
            style={{
              backgroundColor:
                (assistantQuotaInfo?.dailyPercent ?? 0) >=
                normalizedSettings.quotaWarningPercent
                  ? 'var(--warning)'
                  : 'var(--success)',
            }}
          />
        </div>

        <label
          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 text-xs font-bold"
          style={{
            backgroundColor: normalizedSettings.onlineDisabled
              ? 'var(--warning-bg)'
              : 'var(--bg-main)',
            borderColor: normalizedSettings.onlineDisabled
              ? 'var(--warning)'
              : 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-2.5">
            {normalizedSettings.onlineDisabled ? (
              <AlertTriangle
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--warning)' }}
              />
            ) : (
              <WifiOff
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--text-muted)' }}
              />
            )}
            <div>
              <div>تعطيل الأونلاين كلياً (الاعتماد الكامل على Morrow المحلي 100%)</div>
              <div
                className="text-[11px] font-normal"
                style={{ color: 'var(--text-muted)' }}
              >
                يمنع أي إرسال للنماذج السحابية ويشغل جميع الأوامر والبحث والحاسبة محلياً فقط.
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={normalizedSettings.onlineDisabled}
            onChange={(e) =>
              onUpdateAssistantSettings?.({
                onlineDisabled: e.target.checked,
              })
            }
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
          <div>
            <label
              htmlFor="assistant-daily-limit"
              className="mb-1 block text-[11px] font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              الحد اليومي للطلبات
            </label>
            <input
              id="assistant-daily-limit"
              type="number"
              min={10}
              max={5000}
              value={normalizedSettings.dailyRequestLimit}
              onChange={(e) =>
                onUpdateAssistantSettings?.({
                  dailyRequestLimit: Math.max(10, Number(e.target.value) || 250),
                })
              }
              className="min-h-[40px] w-full rounded-xl border px-3 py-2 text-xs font-bold tabular-nums"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="assistant-minute-limit"
              className="mb-1 block text-[11px] font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              الحد بالدقيقة الواحدة
            </label>
            <input
              id="assistant-minute-limit"
              type="number"
              min={2}
              max={120}
              value={normalizedSettings.minuteRequestLimit}
              onChange={(e) =>
                onUpdateAssistantSettings?.({
                  minuteRequestLimit: Math.max(2, Number(e.target.value) || 15),
                })
              }
              className="min-h-[40px] w-full rounded-xl border px-3 py-2 text-xs font-bold tabular-nums"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="assistant-warn-pct"
              className="mb-1 block text-[11px] font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              عتبة التنبيه (%)
            </label>
            <input
              id="assistant-warn-pct"
              type="number"
              min={50}
              max={98}
              value={normalizedSettings.quotaWarningPercent}
              onChange={(e) =>
                onUpdateAssistantSettings?.({
                  quotaWarningPercent: Math.max(
                    50,
                    Math.min(98, Number(e.target.value) || 80)
                  ),
                })
              }
              className="min-h-[40px] w-full rounded-xl border px-3 py-2 text-xs font-bold tabular-nums"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <label className="flex cursor-pointer items-center gap-2 font-bold">
            <input
              type="checkbox"
              checked={normalizedSettings.cacheEnabled}
              onChange={(e) =>
                onUpdateAssistantSettings?.({
                  cacheEnabled: e.target.checked,
                })
              }
            />
            <span>حفظ الردود المتكررة محلياً (Cache) لتسريع الأوامر وتقليل الاستهلاك</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {onResetAssistantQuota && (
              <button
                type="button"
                onClick={() => {
                  onResetAssistantQuota();
                  onNotifySuccess('تم تصفير عداد الحصة بنجاح.');
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>تصفير العداد</span>
              </button>
            )}
            {onClearAssistantCache && (
              <button
                type="button"
                onClick={() => {
                  onClearAssistantCache();
                  onNotifySuccess('تم مسح ذاكرة الردود المؤقتة.');
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>مسح الكاش ({assistantCacheCount})</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          مفاتيح Google AI و Groq و OpenRouter تُدار بأمان تام على الخادم عبر متغيرات البيئة دون تخزين أي مفتاح في المتصفح.
        </p>
      </div>
    </section>
  );
};
