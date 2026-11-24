import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  FileSpreadsheet,
  GitMerge,
  Mic,
  MicOff,
  MoreHorizontal,
  Navigation,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CORE_SIX_SPECIALIZED_MODELS,
  type ApprovedCloudModelId,
  type ModelHealthRecord,
} from '../lib/aiConfig';
import type {
  AiCollaborationMode,
  AssistantBrainMode,
  AssistantCanvasHandoff,
  AssistantChoiceChip,
  AssistantConnectivityState,
  AssistantMessage,
  AssistantQueuedTask,
  AssistantSettingsConfig,
  AssistantSmartSuggestion,
  AssistantSpotlightState,
  AssistantUserPref,
  MorrowCenterTab,
} from '../types/assistant';
import type { QuotaCheckResult } from '../utils/assistantQuota';
import {
  buildPermissionRecoveryGuide,
  requestMicrophonePermission,
  type MediaPermissionGuide,
} from '../utils/mediaPermissions';
import { BottomSheet } from './cosmos/BottomSheet';
import { MorrowMessageCard } from './morrow/MorrowMessageCard';
import { PermissionGuardModal } from './permissions/PermissionGuardModal';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_SPRING,
  useTabrixReducedMotion,
} from '../utils/tabrixMotion';

interface AssistantWidgetProps {
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  brainMode: AssistantBrainMode;
  onChangeBrainMode: (mode: AssistantBrainMode) => void;
  connectivity: AssistantConnectivityState;
  isThinking: boolean;
  messages: AssistantMessage[];
  proactiveTip: string | null;
  preferences: AssistantUserPref[];
  onDeletePref: (id: string) => void;
  queuedTasks: AssistantQueuedTask[];
  onSaveToQueue: (prompt: string, reason: string) => void;
  onRunQueuedTask: (task: AssistantQueuedTask) => void;
  onRemoveQueuedTask: (id: string) => void;
  spotlight: AssistantSpotlightState | null;
  onDismissSpotlight: () => void;
  onTriggerSpotlight: (opts: {
    view: AssistantMessage['spotlightAction'] extends infer T
      ? T extends { view: infer V }
        ? V
        : never
      : never;
    settingsSection?: NonNullable<AssistantMessage['spotlightAction']>['settingsSection'];
    targetId: string;
    title: string;
    description: string;
  }) => void;
  onSendMessage: (prompt: string, options?: { fromFloatingWidget?: boolean }) => void;
  onChoiceClick: (choice: AssistantChoiceChip) => void;
  onResolveDiff: (messageId: string, approved: boolean) => void;
  focusedPersonName?: string;
  smartSuggestions?: AssistantSmartSuggestion[];
  assistantSettings?: AssistantSettingsConfig;
  quotaInfo?: QuotaCheckResult;
  hasUndoableAction?: boolean;
  onUndoLastAction?: (messageId?: string) => void;
  onOpenAssistantSettings?: () => void;
  pendingDraftsCount?: number;
  onOpenCommandCenter?: (tab?: MorrowCenterTab) => void;
  onTriggerCanvasHandoff?: (handoff: AssistantCanvasHandoff) => void;
  collaborationMode?: AiCollaborationMode;
  onChangeCollaborationMode?: (mode: AiCollaborationMode) => void;
  onQuickCameraExtract?: () => void;
  onQuickBackupJson?: () => void;
  onTogglePinMessage?: (messageId: string) => void;
  onExportChatHistory?: () => void;
  onCancelRequest?: () => void;
  onClearMessages?: () => void;
  onRetryLastPrompt?: (prompt?: string) => void;
  modelHealthSnapshots?: Array<
    ModelHealthRecord & { status: 'healthy' | 'cooldown' }
  >;
  hideLauncher?: boolean;
}

const BRAIN_MODES: Array<{
  id: AssistantBrainMode;
  label: string;
  shortLabel: string;
  desc: string;
}> = [
  {
    id: 'auto',
    label: 'تلقائي ذكي (6+1)',
    shortLabel: 'تلقائي',
    desc: 'يبدأ بـ Morrow المحلي ثم يوجّه للأقوى حسب نوع المهمة عبر النماذج الستة المجانية.',
  },
  {
    id: 'local',
    label: 'Morrow المحلي',
    shortLabel: 'محلي',
    desc: 'ردود وحسابات وفحص فوري بدون إنترنت 100%.',
  },
  {
    id: 'gemini_3_8_flash',
    label: 'Gemini 3.8 Flash',
    shortLabel: '3.8 Flash',
    desc: 'الأقوى للمهام الثقيلة، PDF المعقد، الفهم البصري والاستنتاج.',
  },
  {
    id: 'gemini_3_5_flash',
    label: 'Gemini 3.5 Flash',
    shortLabel: '3.5 Flash',
    desc: 'متوازن للبيانات المنظمة (Excel/CSV) والأوامر متعددة الخطوات.',
  },
  {
    id: 'gemini_3_5_flash_lite',
    label: 'Gemini 3.5 Flash Lite',
    shortLabel: '3.5 Lite',
    desc: 'فائق السرعة للأوامر السريعة والردود اليومية.',
  },
  {
    id: 'nemotron_free',
    label: 'Nemotron 3.5 VL',
    shortLabel: 'Nemotron',
    desc: 'ذكاء المستندات والاستنتاج المستقل عبر OpenRouter المجاني.',
  },
  {
    id: 'openrouter_free',
    label: 'OpenRouter Free',
    shortLabel: 'OR Auto',
    desc: 'بوابة الاحتياط التلقائي لأقوى نموذج مجاني متاح لحظياً.',
  },
];

const COMMAND_LIBRARY: Array<{
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  category: string;
}> = [
  {
    id: 'lib_stats',
    title: 'إحصائيات وصافي الأرباح',
    subtitle: 'احصائيات شاملة مع رسم بياني وتفاصيل الأكياس',
    prompt: 'احصائيات جميع الوكالات',
    category: 'مالية وبيانات',
  },
  {
    id: 'lib_calc_250',
    title: 'ضبط رسم الفرد إلى 250 د.ع',
    subtitle: 'يعرض بطاقة قبل ← بعد للتأكيد الفوري',
    prompt: 'خلّي رسم الفرد 250',
    category: 'الحاسبة',
  },
  {
    id: 'lib_diag',
    title: 'فحص صحة البيانات والتكرارات',
    subtitle: 'يكشف الأسماء المكررة والأرقام غير المنطقية',
    prompt: 'افحص التطبيق',
    category: 'سلامة وجودة',
  },
  {
    id: 'lib_dups',
    title: 'فحص المكررين فقط',
    subtitle: 'يعرض قائمة التكرارات في جميع الوكالات',
    prompt: 'المكررين',
    category: 'سلامة وجودة',
  },
  {
    id: 'lib_blocked',
    title: 'اعرض المحجوبين فقط',
    subtitle: 'تصفية صامتة للجدول على المحجوبين',
    prompt: 'اعرض المحجوبين',
    category: 'فلترة الجدول',
  },
  {
    id: 'lib_excel',
    title: 'تصدير كشف Excel معزول',
    subtitle: 'يعمل في الخلفية ضمن Sandbox للقراءة فقط',
    prompt: 'صدر تقرير اكسل',
    category: 'تصدير',
  },
  {
    id: 'lib_pdf',
    title: 'طباعة تقرير PDF رسمي',
    subtitle: 'يطبّق قواعد الذاكرة التلقائية على الأعمدة',
    prompt: 'اطبع تقرير pdf',
    category: 'تصدير',
  },
  {
    id: 'lib_guide_calc',
    title: 'وين إعدادات الحاسبة؟',
    subtitle: 'إرشاد مرئي spotlight إلى قسم الحاسبة',
    prompt: 'وريني الحاسبة',
    category: 'إرشاد',
  },
];

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({
  isOpen,
  onToggleOpen,
  brainMode,
  onChangeBrainMode,
  connectivity,
  isThinking,
  messages,
  proactiveTip,
  preferences,
  onDeletePref,
  queuedTasks,
  onSaveToQueue,
  onRunQueuedTask,
  onRemoveQueuedTask,
  spotlight,
  onDismissSpotlight,
  onTriggerSpotlight,
  onSendMessage,
  onChoiceClick,
  onResolveDiff,
  focusedPersonName,
  smartSuggestions = [],
  assistantSettings,
  quotaInfo,
  hasUndoableAction = false,
  onUndoLastAction,
  onOpenAssistantSettings,
  pendingDraftsCount = 0,
  onOpenCommandCenter,
  onTriggerCanvasHandoff,
  collaborationMode = 'council_review',
  onChangeCollaborationMode,
  onQuickCameraExtract,
  onQuickBackupJson,
  onTogglePinMessage,
  onExportChatHistory,
  onCancelRequest,
  onClearMessages,
  onRetryLastPrompt,
  modelHealthSnapshots = [],
  hideLauncher: _hideLauncher = false,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [inputValue, setInputValue] = useState('');
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [brainSheetOpen, setBrainSheetOpen] = useState(false);
  const [librarySheetOpen, setLibrarySheetOpen] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micPermissionGuide, setMicPermissionGuide] = useState<MediaPermissionGuide | null>(null);
  const [checkingMicPermission, setCheckingMicPermission] = useState(false);
  const [savedPromptSet, setSavedPromptSet] = useState<Set<string>>(() => new Set());

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, isThinking]);

  useEffect(() => {
    if (!spotlight?.targetId) return;
    const el = document.querySelector(`[data-assistant-target="${spotlight.targetId}"]`);
    if (el instanceof HTMLElement) {
      el.classList.add('assistant-spotlight-active');
      return () => el.classList.remove('assistant-spotlight-active');
    }
  }, [spotlight]);

  // Auto-grow textarea cleanly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
  }, [inputValue]);

  const activeBrain = useMemo(
    () => BRAIN_MODES.find((b) => b.id === brainMode) || BRAIN_MODES[0],
    [brainMode]
  );

  const statusMeta = useMemo(() => {
    if (connectivity === 'online') {
      return {
        label: 'أونلاين',
        color: 'var(--success)',
        title: `متصل (${assistantSettings?.preferredModelId || 'gemini-3.8-flash'})`,
      };
    }
    if (connectivity === 'quota_exhausted') {
      return {
        label: 'حصة مؤقتة',
        color: 'var(--danger)',
        title: 'انتهت الحصة السحابية — التحويل التلقائي لمحرك Morrow المحلي فعّال',
      };
    }
    return {
      label: 'أوفلاين',
      color: 'var(--warning)',
      title: assistantSettings?.onlineDisabled
        ? 'وضع أوفلاين صارم من الإعدادات'
        : 'يعمل بمحرك Morrow المحلي بدون إنترنت',
    };
  }, [connectivity, assistantSettings]);

  const handleCopyMessage = (msgId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {});
      setCopiedMsgId(msgId);
      window.setTimeout(() => setCopiedMsgId(null), 1800);
    }
  };

  const toggleVoiceInput = async () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    setCheckingMicPermission(true);
    const perm = await requestMicrophonePermission();
    setCheckingMicPermission(false);
    if (!perm.ok) {
      setMicPermissionGuide(
        perm.guide || buildPermissionRecoveryGuide('microphone')
      );
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setMicPermissionGuide(
        buildPermissionRecoveryGuide(
          'microphone',
          'الإملاء الصوتي غير مدعوم في هذا المتصفح، يمكنك كتابة الأمر نصياً.'
        )
      );
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = 'ar-IQ';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i++) {
          parts.push(ev.results[i][0]?.transcript || '');
        }
        const text = parts.join(' ').trim();
        if (text) setInputValue(text);
      };
      rec.onerror = () => {
        setIsRecording(false);
        setMicPermissionGuide(buildPermissionRecoveryGuide('microphone'));
      };
      rec.onend = () => setIsRecording(false);
      recognitionRef.current = rec;
      setIsRecording(true);
      rec.start();
    } catch {
      setIsRecording(false);
      setMicPermissionGuide(buildPermissionRecoveryGuide('microphone'));
    }
  };

  const submitCurrentPrompt = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isThinking) return;
    setInputValue('');
    onSendMessage(trimmed, { fromFloatingWidget: true });
  };

  const thinAlertText = useMemo(() => {
    if (
      quotaInfo &&
      !assistantSettings?.onlineDisabled &&
      (quotaInfo.quotaExhausted || quotaInfo.nearDailyLimit)
    ) {
      return quotaInfo.quotaExhausted
        ? 'خلصت حصة السحابة — التحويل للمحلي فعّال تلقائياً'
        : `تنبيه الحصة: ${quotaInfo.dailyUsed}/${quotaInfo.dailyLimit} طلب (${quotaInfo.dailyPercent}%)`;
    }
    if (proactiveTip && !tipDismissed) {
      return proactiveTip;
    }
    return null;
  }, [quotaInfo, assistantSettings?.onlineDisabled, proactiveTip, tipDismissed]);

  return (
    <>
      {/* Guided Spotlight Floating Banner ("وريني") */}
      <AnimatePresence>
        {spotlight && (
          <motion.aside
            key={`spotlight-${spotlight.targetId}`}
            role="status"
            aria-live="polite"
            variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            className="smoked-glass-elevated no-print fixed top-[78px] left-1/2 z-[var(--z-toast)] flex w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
              color: 'var(--text-primary)',
              boxShadow: '0 0 0 2px var(--accent), 0 10px 28px rgba(0,0,0,0.24)',
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Navigation className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="min-w-0">
                <div className="truncate text-xs font-bold" style={{ color: 'var(--accent)' }}>
                  {spotlight.title}
                </div>
                <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {spotlight.description}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissSpotlight}
              aria-label="إغلاق مؤشر الإرشاد"
              className="nexus-pill-btn rounded-lg border px-2.5 py-1 text-[11px] font-bold shrink-0"
              style={{ borderColor: 'var(--border-color)' }}
            >
              فهمت
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Full-Screen Push Panel — Morrow Assistant */}
      <FullScreenPushPage
        open={isOpen}
        onBack={() => onToggleOpen(false)}
        title="Morrow"
        subtitle={`${activeBrain.shortLabel}${focusedPersonName ? ` · ${focusedPersonName}` : ''} · ${statusMeta.label}`}
        icon={
          <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
            <Bot className="h-4 w-4" />
          </NexusDuotoneIcon>
        }
        maxWidthClass="max-w-3xl"
        zIndexClass="z-[var(--z-sheet)]"
        ariaLabel="لوحة المساعد الذكي — Morrow"
        headerActions={
          <div className="flex items-center gap-1.5">
            <span
              title={statusMeta.title}
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap ml-1"
              style={{ color: statusMeta.color }}
            >
              {connectivity === 'online' ? (
                <Wifi className="h-3 w-3 shrink-0" />
              ) : (
                <WifiOff className="h-3 w-3 shrink-0" />
              )}
              <span>{statusMeta.label}</span>
            </span>

            {hasUndoableAction && onUndoLastAction && (
              <button
                type="button"
                onClick={() => onUndoLastAction()}
                aria-label="تراجع عن آخر عملية للمساعد"
                title="تراجع"
                className="nexus-pill-btn inline-flex h-9 items-center gap-1 border px-3 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--warning)',
                  color: 'var(--warning)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">تراجع</span>
              </button>
            )}

            {onOpenCommandCenter && (
              <button
                type="button"
                onClick={() => {
                  onToggleOpen(false);
                  onOpenCommandCenter(pendingDraftsCount > 0 ? 'approvals' : 'chat');
                }}
                aria-label="فتح مركز Morrow الكامل"
                title="المركز الكامل"
                className="nexus-pill-btn inline-flex h-9 items-center gap-1 border px-3 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor:
                    pendingDraftsCount > 0 ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
                  color: pendingDraftsCount > 0 ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">المركز</span>
                {pendingDraftsCount > 0 && (
                  <span className="tabular-nums">{pendingDraftsCount}</span>
                )}
              </button>
            )}

            {onClearMessages && messages.length > 1 && (
              <button
                type="button"
                onClick={onClearMessages}
                aria-label="محادثة جديدة"
                title="محادثة جديدة"
                className="nexus-pill-btn inline-flex h-9 w-9 items-center justify-center border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setToolsSheetOpen(true)}
              aria-label="أدوات وتفضيلات المساعد"
              title="التفضيلات والإعدادات وسجل المحادثة"
              className="nexus-pill-btn inline-flex h-9 w-9 items-center justify-center border"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        }
        footer={
          <div className="space-y-2.5">
            {smartSuggestions.length > 0 && (
              <div
                className="flex items-center gap-1.5 overflow-x-auto pb-1"
                aria-label="اقتراحات ذكية حسب الشاشة المفتوحة"
              >
                {smartSuggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => onSendMessage(sug.prompt, { fromFloatingWidget: true })}
                    className="nexus-pill-btn shrink-0 border px-3 py-1 text-[10px] font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {sug.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => setBrainSheetOpen(true)}
                className="nexus-pill-btn inline-flex items-center gap-1.5 border px-3 py-1.5 font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Cpu className="h-3 w-3" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span>الدماغ: {activeBrain.shortLabel}</span>
              </button>

              <div className="flex items-center gap-1.5">
                {onQuickCameraExtract && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleOpen(false);
                      onQuickCameraExtract();
                    }}
                    title="السحب الذكي بالكاميرا أو PDF"
                    aria-label="فتح السحب الذكي"
                    className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Camera className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                  </button>
                )}
                {onQuickBackupJson && (
                  <button
                    type="button"
                    onClick={onQuickBackupJson}
                    title="تنزيل نسخة احتياطية JSON"
                    aria-label="نسخة احتياطية سريعة"
                    className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Download className="h-3.5 w-3.5" style={{ color: '#10B981' }} />
                  </button>
                )}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitCurrentPrompt();
              }}
              className="flex items-end gap-2"
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                title="إملاء صوتي عربي (ar-IQ)"
                aria-label="إملاء صوتي"
                className="nexus-pill-btn inline-flex h-11 w-11 shrink-0 items-center justify-center border"
                style={{
                  backgroundColor: isRecording ? 'var(--danger)' : 'var(--bg-surface)',
                  borderColor: isRecording ? 'var(--danger)' : 'var(--border-color)',
                  color: isRecording ? '#fff' : 'var(--text-muted)',
                }}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitCurrentPrompt();
                  }
                }}
                placeholder="اكتب باللهجة العراقية (مثال: خلّي رسم الفرد 250)..."
                aria-label="اكتب أمرك للمساعد الذكي"
                className="min-w-0 flex-1 resize-none rounded-2xl border px-3.5 py-2.5 text-xs outline-none focus:border-[var(--accent-ai)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              />

              {isThinking && onCancelRequest ? (
                <button
                  type="button"
                  onClick={onCancelRequest}
                  aria-label="إيقاف المعالجة"
                  className="nexus-pill-btn inline-flex h-11 w-11 shrink-0 items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isThinking}
                  aria-label="إرسال الطلب للمساعد"
                  className="nexus-pill-btn inline-flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--accent-ai, #5B4FE9)',
                    color: '#FFFFFF',
                  }}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </form>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Quick Commands Pill Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setInputValue('ابحث ');
                textareaRef.current?.focus();
              }}
              className="nexus-pill-btn inline-flex h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Search className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
              <span>بحث</span>
            </button>
            <button
              type="button"
              onClick={() => onSendMessage('صدر تقرير اكسل', { fromFloatingWidget: true })}
              className="nexus-pill-btn inline-flex h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
              <span>تقرير</span>
            </button>
            <button
              type="button"
              onClick={() => onSendMessage('المكررين', { fromFloatingWidget: true })}
              className="nexus-pill-btn inline-flex h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Users className="h-3.5 w-3.5" style={{ color: 'var(--warning)' }} />
              <span>المكررين</span>
            </button>
            <button
              type="button"
              onClick={() => onSendMessage('افحص التطبيق', { fromFloatingWidget: true })}
              className="nexus-pill-btn inline-flex h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
              <span>افحص</span>
            </button>
            <button
              type="button"
              onClick={() => setLibrarySheetOpen(true)}
              aria-label="مكتبة الأوامر السريعة"
              title="المزيد من الأوامر الجاهزة"
              className="nexus-pill-btn inline-flex h-9 w-9 shrink-0 items-center justify-center border text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent-ai, #5B4FE9)',
                color: 'var(--accent-ai, #5B4FE9)',
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <AnimatePresence>
            {thinAlertText && (
              <motion.div
                key="assistant-thin-alert"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: reducedMotion ? 0.05 : 0.2 }}
                className="nexus-squircle flex items-center justify-between gap-2 px-4 py-2.5 text-xs"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  borderColor: 'var(--warning)',
                  color: 'var(--text-primary)',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSendMessage('افحص التطبيق')}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-right font-semibold hover:underline"
                >
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--warning)' }}
                  />
                  <span className="truncate">{thinAlertText}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipDismissed(true)}
                  aria-label="إخفاء التنبيه"
                  className="rounded p-1 hover:opacity-75"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {connectivity === 'online' && queuedTasks.length > 0 && (
              <motion.div
                key="assistant-queued-banner"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: reducedMotion ? 0.05 : 0.2 }}
                className="nexus-squircle flex items-center justify-between gap-2 px-4 py-2.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'var(--accent-ai, #5B4FE9)',
                }}
              >
                <span
                  className="inline-flex items-center gap-1 font-bold"
                  style={{ color: 'var(--accent-ai, #5B4FE9)' }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{queuedTasks.length} طلب محفوظ جاهز للتنفيذ</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRunQueuedTask(queuedTasks[0])}
                  className="nexus-pill-btn px-3 py-1 font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--accent-ai, #5B4FE9)',
                    color: '#FFFFFF',
                  }}
                >
                  نفّذ الآن
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Messages Feed */}
          <div className="space-y-3 text-xs sm:text-[13px]">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
                  transition={reducedMotion ? { duration: 0.05 } : TABRIX_SPRING}
                >
                  <MorrowMessageCard
                    message={msg}
                    compact
                    copied={copiedMsgId === msg.id}
                    savedToQueue={savedPromptSet.has(msg.id)}
                    hasUndoableAction={hasUndoableAction}
                    onCopy={handleCopyMessage}
                    onTogglePin={onTogglePinMessage}
                    onRetry={onRetryLastPrompt ? () => onRetryLastPrompt() : undefined}
                    onChoiceClick={onChoiceClick}
                    onResolveDiff={onResolveDiff}
                    onTriggerSpotlight={onTriggerSpotlight}
                    onTriggerCanvasHandoff={onTriggerCanvasHandoff}
                    onUndoLastAction={onUndoLastAction}
                    onSendPrompt={(promptText) =>
                      onSendMessage(promptText, { fromFloatingWidget: true })
                    }
                    onSavePromptToQueue={(msgId, promptText) => {
                      onSaveToQueue(promptText, 'بانتظار السحابة');
                      setSavedPromptSet((prev) => new Set(prev).add(msgId));
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {isThinking && (
              <div
                className="nexus-squircle flex items-center justify-between gap-2 px-4 py-3 text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>جاري اختيار النموذج الأنسب ومعالجة الطلب...</span>
                {onCancelRequest && (
                  <button
                    type="button"
                    onClick={onCancelRequest}
                    className="nexus-pill-btn inline-flex items-center gap-1 border px-3 py-1 text-[11px] font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--danger)',
                      color: 'var(--danger)',
                    }}
                  >
                    <Square className="h-3 w-3" />
                    <span>إيقاف</span>
                  </button>
                )}
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>
        </div>
      </FullScreenPushPage>

      {/* Brain Picker BottomSheet */}
      <BottomSheet
        open={brainSheetOpen}
        onClose={() => setBrainSheetOpen(false)}
        title="محركات الذكاء وتوجيه الأولويات — Morrow"
        subtitle="اختيار التوجيه التلقائي حسب التخصص أو تثبيت نموذج محدد مع التحويل الذكي"
        icon={<Cpu className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {onChangeCollaborationMode && (
            <div className="space-y-2 border-b pb-3" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                <GitMerge className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>تعاون النماذج والتدقيق المتبادل</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {(
                  [
                    ['council_review', 'مجلس النماذج'],
                    ['multi_step_agent', 'تحليل متعمق'],
                    ['single', 'نموذج واحد'],
                  ] as const
                ).map(([modeId, modeLabel]) => {
                  const active = collaborationMode === modeId;
                  return (
                    <button
                      key={modeId}
                      type="button"
                      onClick={() => onChangeCollaborationMode(modeId)}
                      className="rounded-xl border px-2 py-2 font-bold transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                        borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                        color: active ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      {modeLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {BRAIN_MODES.map((m) => {
              const active = brainMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChangeBrainMode(m.id);
                    setBrainSheetOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl border p-3.5 text-right transition-all"
                  style={{
                    backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                  }}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold">{m.label}</div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {m.desc}
                    </div>
                  </div>
                  {active && (
                    <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
            <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
              خريطة النماذج الستة المعتمدة وحالة الجاهزية
            </div>
            <div className="divide-y rounded-2xl border text-xs" style={{ borderColor: 'var(--border-color)' }}>
              {CORE_SIX_SPECIALIZED_MODELS.map((spec) => {
                const snap = modelHealthSnapshots.find(
                  (h) => h.modelId === (spec.id as ApprovedCloudModelId)
                );
                const cooling = snap?.status === 'cooldown';
                return (
                  <div key={spec.id} className="flex items-start justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-bold">{spec.shortLabel}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {spec.specialty}
                      </div>
                    </div>
                    <div className="shrink-0 text-left font-mono text-[10px] tabular-nums">
                      <span
                        className="font-bold"
                        style={{ color: cooling ? 'var(--warning)' : 'var(--success)' }}
                      >
                        {cooling ? 'تبريد مؤقت' : 'جاهز'}
                      </span>
                      {snap?.avgLatencyMs ? (
                        <div style={{ color: 'var(--text-muted)' }}>
                          {(snap.avgLatencyMs / 1000).toFixed(1)}s
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Full Command Library BottomSheet */}
      <BottomSheet
        open={librarySheetOpen}
        onClose={() => setLibrarySheetOpen(false)}
        title="مكتبة أوامر Morrow الجاهزة"
        subtitle="انقر على أي أمر لتنفيذه مباشرة أو معاينته في بطاقة قبل ← بعد"
        icon={<Sparkles className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {COMMAND_LIBRARY.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setLibrarySheetOpen(false);
                onSendMessage(item.prompt, { fromFloatingWidget: true });
              }}
              className="rounded-2xl border p-3.5 text-right transition-all hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold">{item.title}</span>
                <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
                  {item.category}
                </span>
              </div>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {item.subtitle}
              </p>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Assistant Tools & Memory BottomSheet */}
      <BottomSheet
        open={toolsSheetOpen}
        onClose={() => setToolsSheetOpen(false)}
        title="أدوات المساعد والذاكرة الدائمة"
        subtitle="التفضيلات المحفوظة، الطلبات المؤجلة، وتصدير المحادثة"
        icon={<BookmarkCheck className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {onOpenAssistantSettings && (
              <button
                type="button"
                onClick={() => {
                  setToolsSheetOpen(false);
                  onOpenAssistantSettings();
                }}
                className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold"
                style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
              >
                <Settings2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>إعدادات الحصة والخصوصية</span>
              </button>
            )}
            {onExportChatHistory && (
              <button
                type="button"
                onClick={onExportChatHistory}
                className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold"
                style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
              >
                <Download className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>تصدير سجل المحادثة JSON</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-extrabold flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>قواعد الذاكرة المحفوظة ({preferences.length})</span>
            </h4>
            {preferences.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                لا توجد قواعد محفوظة بعد. قل مثلاً: «اخفي عمود الحالة في التقرير».
              </p>
            ) : (
              preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <span className="font-semibold">{pref.label}</span>
                  <button
                    type="button"
                    onClick={() => onDeletePref(pref.id)}
                    aria-label={`حذف ${pref.label}`}
                    className="rounded-lg p-1.5"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {queuedTasks.length > 0 && (
            <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
              <h4 className="text-xs font-extrabold">الطلبات المؤجلة ({queuedTasks.length})</h4>
              {queuedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <span className="truncate">{task.prompt}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setToolsSheetOpen(false);
                        onRunQueuedTask(task);
                      }}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      تنفيذ
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveQueuedTask(task.id)}
                      className="p-1"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      <PermissionGuardModal
        open={Boolean(micPermissionGuide)}
        guide={micPermissionGuide}
        checking={checkingMicPermission}
        onClose={() => setMicPermissionGuide(null)}
        onRetryPermission={() => {
          setMicPermissionGuide(null);
          void toggleVoiceInput();
        }}
        onUseFallback={() => textareaRef.current?.focus()}
        fallbackLabel="الكتابة نصياً"
      />
    </>
  );
};
