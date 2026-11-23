import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MoreHorizontal,
  Navigation,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type {
  AssistantBrainMode,
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
import { getEngineDisplayMeta } from '../utils/morrowRouter';
import {
  buildPermissionRecoveryGuide,
  requestMicrophonePermission,
  type MediaPermissionGuide,
} from '../utils/mediaPermissions';
import { BottomSheet } from './cosmos/BottomSheet';
import { ResultCard } from './cosmos/ResultCard';
import { PermissionGuardModal } from './permissions/PermissionGuardModal';

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
  onQuickCameraExtract?: () => void;
  onQuickBackupJson?: () => void;
  onTogglePinMessage?: (messageId: string) => void;
  onExportChatHistory?: () => void;
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
    label: 'تلقائي ذكي',
    shortLabel: 'تلقائي',
    desc: 'يبدأ بـ Morrow المحلي، ويصعّد إلى Gemini 2.5 Flash أو 2.5 Pro عند الحاجة.',
  },
  {
    id: 'local',
    label: 'Morrow المحلي',
    shortLabel: 'محلي',
    desc: 'ردود وحسابات وفحص فوري بدون إنترنت 100%.',
  },
  {
    id: 'gemini_2_5_flash',
    label: 'Gemini 2.5 Flash',
    shortLabel: '2.5 Flash',
    desc: 'نموذج سريع للصياغة والأسئلة اللغوية اليومية.',
  },
  {
    id: 'gemini_2_5_pro',
    label: 'Gemini 2.5 Pro',
    shortLabel: '2.5 Pro',
    desc: 'نموذج التحليل العميق والتقارير الاستراتيجية.',
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
    subtitle: 'إرشاد مرئي spotlight إلى كبسولة الحاسبة',
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
  onQuickCameraExtract,
  onQuickBackupJson,
  onTogglePinMessage,
  onExportChatHistory,
  hideLauncher = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [brainSheetOpen, setBrainSheetOpen] = useState(false);
  const [librarySheetOpen, setLibrarySheetOpen] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micPermissionGuide, setMicPermissionGuide] = useState<MediaPermissionGuide | null>(null);
  const [checkingMicPermission, setCheckingMicPermission] = useState(false);
  const [savedPromptSet, setSavedPromptSet] = useState<Set<string>>(() => new Set());

  // Draggable Floating Launcher position offset (x, y from bottom-left anchor)
  const [fabOffset, setFabOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragInfoRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });

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
        title: `متصل (${assistantSettings?.preferredModelId || 'gemini-2.5-flash'})`,
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
      {spotlight && (
        <aside
          role="status"
          aria-live="polite"
          className="no-print fixed top-[78px] left-1/2 z-[var(--z-toast)] flex w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 shadow-xl"
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
            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold shrink-0"
            style={{ borderColor: 'var(--border-color)' }}
          >
            فهمت
          </button>
        </aside>
      )}

      {/* Draggable Floating Launcher Pill (Primary tap -> Dedicated Full-Screen Studio; quick icon -> compact drawer) */}
      {!isOpen && !hideLauncher && (
        <div
          className="no-print fixed bottom-4 left-4 z-[var(--z-floating-assistant)] flex items-center gap-1"
          style={{
            transform: `translate3d(${fabOffset.x}px, ${fabOffset.y}px, 0)`,
          }}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              dragInfoRef.current = {
                active: true,
                moved: false,
                startX: e.clientX,
                startY: e.clientY,
                origX: fabOffset.x,
                origY: fabOffset.y,
              };
            }}
            onPointerMove={(e) => {
              if (!dragInfoRef.current.active) return;
              const dx = e.clientX - dragInfoRef.current.startX;
              const dy = e.clientY - dragInfoRef.current.startY;
              if (Math.hypot(dx, dy) > 6) {
                dragInfoRef.current.moved = true;
                const maxX = Math.max(0, window.innerWidth - 180);
                const maxY = Math.max(0, window.innerHeight - 140);
                setFabOffset({
                  x: Math.max(0, Math.min(maxX, dragInfoRef.current.origX + dx)),
                  y: Math.max(-maxY, Math.min(40, dragInfoRef.current.origY + dy)),
                });
              }
            }}
            onPointerUp={() => {
              const wasDrag = dragInfoRef.current.moved;
              dragInfoRef.current.active = false;
              if (!wasDrag) {
                if (onOpenCommandCenter) {
                  onOpenCommandCenter('chat');
                } else {
                  onToggleOpen(true);
                }
              }
            }}
            aria-label="دخول إلى المساعد الشخصي Morrow بملء الشاشة"
            title={proactiveTip || 'اسحب للتحريك أو اضغط للدخول إلى صفحة المساعد بملء الشاشة'}
            className="assistant-glow-btn inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-extrabold whitespace-nowrap shadow-xl cursor-grab active:cursor-grabbing touch-none transition-shadow hover:shadow-2xl"
            style={{
              backgroundColor: 'var(--accent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: statusMeta.color }}
              />
            </span>
            <Bot className="h-4 w-4 shrink-0" />
            <span>Morrow</span>
            {(pendingDraftsCount > 0 || queuedTasks.length > 0) && (
              <span className="rounded-lg bg-black/25 px-1.5 py-0.5 text-[10px] tabular-nums">
                {pendingDraftsCount + queuedTasks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onToggleOpen(true)}
            aria-label="محادثة سريعة فوق الصفحة"
            title="فتح نافذة محادثة سريعة دون مغادرة الصفحة"
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border shadow-lg transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Non-Blocking Drawer or Fullscreen Studio Panel */}
      {isOpen && (
        <aside
          aria-label="لوحة المساعد الذكي — Morrow"
          className={`no-print fixed z-[var(--z-sheet)] flex flex-col overflow-hidden border shadow-2xl transition-all duration-200 ${
            isFullscreen
              ? 'inset-2 sm:inset-4 rounded-[26px]'
              : 'top-14 bottom-4 left-3 md:left-4 w-[min(450px,calc(100vw-1.5rem))] rounded-[24px]'
          }`}
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 95%, transparent)',
            borderColor: 'color-mix(in srgb, var(--accent) 42%, var(--border-color))',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 22px 54px rgba(0, 0, 0, 0.30)',
          }}
        >
          {/* Slim Header */}
          <div
            className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs sm:text-sm font-extrabold whitespace-nowrap">Morrow</h2>
                  <span
                    title={statusMeta.title}
                    className="inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      borderColor: 'var(--border-color)',
                      color: statusMeta.color,
                    }}
                  >
                    {connectivity === 'online' ? (
                      <Wifi className="h-2.5 w-2.5" />
                    ) : (
                      <WifiOff className="h-2.5 w-2.5" />
                    )}
                    <span>{statusMeta.label}</span>
                  </span>
                </div>
                <div className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {activeBrain.shortLabel}
                  {focusedPersonName ? ` · ${focusedPersonName}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {hasUndoableAction && onUndoLastAction && (
                <button
                  type="button"
                  onClick={() => onUndoLastAction()}
                  aria-label="تراجع عن آخر عملية للمساعد"
                  title="تراجع"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border px-2 text-[11px] font-bold"
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
                  onClick={() =>
                    onOpenCommandCenter(pendingDraftsCount > 0 ? 'approvals' : 'chat')
                  }
                  aria-label="فتح مركز Morrow الكامل"
                  title="المركز الكامل"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border px-2 text-[11px] font-bold"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor:
                      pendingDraftsCount > 0 ? 'var(--accent)' : 'var(--border-color)',
                    color: pendingDraftsCount > 0 ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {pendingDraftsCount > 0 && (
                    <span className="tabular-nums">{pendingDraftsCount}</span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setToolsSheetOpen(true)}
                aria-label="أدوات وتفضيلات المساعد"
                title="التفضيلات والإعدادات وسجل المحادثة"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                aria-label={isFullscreen ? 'تصغير النافذة' : 'ملء الشاشة'}
                title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onToggleOpen(false)}
                aria-label="إغلاق لوحة المساعد"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Single Horizontal Quick Commands Strip + '+' Command Library */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto border-b px-3 py-2"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setInputValue('ابحث ');
                textareaRef.current?.focus();
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Search className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>بحث</span>
            </button>
            <button
              type="button"
              onClick={() => onSendMessage('صدر تقرير اكسل', { fromFloatingWidget: true })}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold whitespace-nowrap"
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
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold whitespace-nowrap"
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
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>افحص</span>
            </button>
            <button
              type="button"
              onClick={() => setLibrarySheetOpen(true)}
              aria-label="مكتبة الأوامر السريعة"
              title="المزيد من الأوامر الجاهزة"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Thin Dismissible Alert Banner */}
          {thinAlertText && (
            <div
              className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--border-color)',
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
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Queued Offline Ready Strip */}
          {connectivity === 'online' && queuedTasks.length > 0 && (
            <div
              className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
              }}
            >
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: 'var(--accent)' }}>
                <Clock className="h-3.5 w-3.5" />
                <span>{queuedTasks.length} طلب محفوظ جاهز للتنفيذ</span>
              </span>
              <button
                type="button"
                onClick={() => onRunQueuedTask(queuedTasks[0])}
                className="rounded-lg px-2.5 py-1 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                نفّذ الآن
              </button>
            </div>
          )}

          {/* Chat Messages Feed */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs sm:text-[13px]">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${isUser ? 'items-start' : 'items-stretch'}`}
                >
                  <div
                    className="rounded-[20px] border px-3.5 py-3 leading-relaxed whitespace-pre-line shadow-sm"
                    style={{
                      backgroundColor: isUser ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor: isUser ? 'var(--accent)' : 'var(--border-color)',
                      maxWidth: isUser ? '88%' : '100%',
                    }}
                  >
                    {!isUser && (msg.engineLabel || msg.engineUsed) && (
                      <div
                        className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold"
                        style={{ color: 'var(--accent)' }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {msg.engineUsed === 'gemini_2_5_pro' ? (
                            <Sparkles className="h-3 w-3 shrink-0" />
                          ) : msg.engineUsed === 'gemini_2_5_flash' ? (
                            <Zap className="h-3 w-3 shrink-0" />
                          ) : (
                            <Cpu className="h-3 w-3 shrink-0" />
                          )}
                          <span>
                            {msg.engineLabel || getEngineDisplayMeta(msg.engineUsed).badgeLabel}
                          </span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            title="نسخ الرد"
                            aria-label="نسخ الرد"
                            className="rounded-lg p-1 hover:opacity-75"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="h-3 w-3" style={{ color: 'var(--success)' }} />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          {onTogglePinMessage && (
                            <button
                              type="button"
                              onClick={() => onTogglePinMessage(msg.id)}
                              title={msg.isPinned ? 'إلغاء تثبيت الرسالة' : 'تثبيت الرسالة'}
                              aria-label="تثبيت الرسالة"
                              className="rounded-lg p-1 hover:opacity-75"
                              style={{
                                color: msg.isPinned ? 'var(--accent)' : 'var(--text-muted)',
                              }}
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div>{msg.text}</div>

                    {/* Visual Result Card */}
                    {msg.resultCard && (
                      <div className="mt-2.5">
                        <ResultCard
                          title={msg.resultCard.title}
                          summary={msg.resultCard.summary}
                          scorePercent={msg.resultCard.scorePercent}
                          scoreLabel={msg.resultCard.scoreLabel}
                          tone={msg.resultCard.tone}
                          bars={msg.resultCard.bars}
                          details={msg.resultCard.details}
                        />
                      </div>
                    )}

                    {/* Inline Undo */}
                    {msg.canUndo && !msg.undoUsed && hasUndoableAction && onUndoLastAction && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => onUndoLastAction(msg.id)}
                          className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-[11px] font-bold"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--warning)',
                            color: 'var(--warning)',
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>تراجع عن هذه العملية</span>
                        </button>
                      </div>
                    )}
                    {msg.undoUsed && (
                      <div
                        className="mt-1.5 text-[10px] font-semibold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        تم التراجع عن هذا التعديل.
                      </div>
                    )}

                    {/* Sandbox Read-Only Notice */}
                    {msg.sandboxNotice && (
                      <div
                        className="mt-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: 'var(--success-bg)',
                          borderColor: 'var(--success)',
                          color: 'var(--success)',
                        }}
                      >
                        {msg.sandboxNotice}
                      </div>
                    )}

                    {/* Spotlight "وريني" */}
                    {msg.spotlightAction && (
                      <button
                        type="button"
                        onClick={() =>
                          onTriggerSpotlight({
                            view: msg.spotlightAction!.view,
                            settingsSection: msg.spotlightAction!.settingsSection,
                            targetId: msg.spotlightAction!.targetId,
                            title: msg.spotlightAction!.label,
                            description: 'شاهد الموضع المحدد باللون المميز داخل الشاشة',
                          })
                        }
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-fg)',
                        }}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        <span>{msg.spotlightAction.label}</span>
                      </button>
                    )}

                    {/* Choices */}
                    {msg.choices && msg.choices.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.choices.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => onChoiceClick(ch)}
                            className="rounded-xl border px-2.5 py-1.5 text-right text-[11px] font-bold transition-colors hover:opacity-90"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor:
                                ch.tone === 'warning' ? 'var(--warning)' : 'var(--accent)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <div>{ch.label}</div>
                            {ch.sublabel && (
                              <div
                                className="text-[10px] font-normal"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {ch.sublabel}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Compact Diagnostics Details */}
                    {msg.diagnosticsReport && msg.diagnosticsReport.issues.length > 0 && (
                      <div
                        className="mt-2.5 space-y-1.5 rounded-xl border p-2.5 text-[11px]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        {msg.diagnosticsReport.issues.slice(0, 4).map((issue) => (
                          <div
                            key={issue.id}
                            className="rounded-lg border px-2 py-1"
                            style={{
                              borderColor:
                                issue.severity === 'high'
                                  ? 'var(--danger)'
                                  : 'var(--border-color)',
                            }}
                          >
                            <div className="font-bold">{issue.title}</div>
                            <div style={{ color: 'var(--text-muted)' }}>{issue.detail}</div>
                          </div>
                        ))}
                        {msg.diagnosticsReport.autoFixableCount > 0 && (
                          <button
                            type="button"
                            onClick={() => onSendMessage('صلح مشاكل الفحص تلقائياً')}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-bold"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-fg)',
                            }}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            <span>
                              إصلاح تلقائي ({msg.diagnosticsReport.autoFixableCount})
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Before <- After Confirmation Diff Card */}
                    {msg.confirmationDiff && (
                      <div
                        className="mt-2.5 space-y-2 rounded-2xl border p-3 text-[11px]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--accent)',
                        }}
                      >
                        <div className="font-extrabold" style={{ color: 'var(--accent)' }}>
                          {msg.confirmationDiff.title}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {msg.confirmationDiff.summary}
                        </div>

                        <div className="space-y-1">
                          {msg.confirmationDiff.changes.map((c, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-1 gap-0.5 rounded-xl border px-2.5 py-1.5"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <div
                                className="text-[10px] font-bold"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {c.fieldLabel}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                                <span className="line-through opacity-75">{c.beforeValue}</span>
                                <span style={{ color: 'var(--accent)' }}>←</span>
                                <span style={{ color: 'var(--success)' }}>{c.afterValue}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {msg.confirmationDiff.status === 'pending' ? (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => onResolveDiff(msg.id, true)}
                              className="cosmos-touch-target inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 font-bold"
                              style={{
                                backgroundColor: 'var(--success)',
                                color: 'var(--success-fg)',
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>موافق وتنفيذ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onResolveDiff(msg.id, false)}
                              className="cosmos-touch-target inline-flex flex-1 items-center justify-center gap-1 rounded-xl border px-3 py-2 font-bold"
                              style={{
                                borderColor: 'var(--danger)',
                                color: 'var(--danger)',
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>إلغاء</span>
                            </button>
                          </div>
                        ) : (
                          <div
                            className="inline-flex items-center gap-1 font-bold"
                            style={{
                              color:
                                msg.confirmationDiff.status === 'approved'
                                  ? 'var(--success)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              {msg.confirmationDiff.status === 'approved'
                                ? 'تمت الموافقة والتنفيذ'
                                : 'ملغى'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Offline Queue CTA */}
                    {msg.queuePrompt && (
                      <div className="mt-2">
                        {savedPromptSet.has(msg.id) ? (
                          <div
                            className="inline-flex items-center gap-1 font-bold"
                            style={{ color: 'var(--success)' }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>تم حفظ الطلب وسيظهر لك فور عودة الإنترنت</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onSaveToQueue(msg.queuePrompt!.prompt, 'بانتظار السحابة');
                              setSavedPromptSet((prev) => new Set(prev).add(msg.id));
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--accent)',
                              color: 'var(--accent)',
                            }}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span>احفظ الطلب وأنفذه لما يرجع النت</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div
                className="rounded-2xl border px-3.5 py-2.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                جاري المعالجة عبر سلسلة Morrow...
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Screen-Aware Contextual Suggestions */}
          {smartSuggestions.length > 0 && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto border-t px-3 py-1.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
              aria-label="اقتراحات ذكية حسب الشاشة المفتوحة"
            >
              {smartSuggestions.map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  onClick={() => onSendMessage(sug.prompt, { fromFloatingWidget: true })}
                  className="shrink-0 rounded-xl border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {sug.label}
                </button>
              ))}
            </div>
          )}

          {/* Auto-growing Composer Bar with Brain Picker + Voice + Camera/Backup shortcuts */}
          <div
            className="border-t p-2.5 space-y-2"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => setBrainSheetOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Cpu className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                <span>الدماغ: {activeBrain.shortLabel}</span>
              </button>

              <div className="flex items-center gap-1">
                {onQuickCameraExtract && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleOpen(false);
                      onQuickCameraExtract();
                    }}
                    title="السحب الذكي بالكاميرا أو PDF"
                    aria-label="فتح السحب الذكي"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Camera className="h-3.5 w-3.5" style={{ color: '#0ea5e9' }} />
                  </button>
                )}
                {onQuickBackupJson && (
                  <button
                    type="button"
                    onClick={onQuickBackupJson}
                    title="تنزيل نسخة احتياطية JSON"
                    aria-label="نسخة احتياطية سريعة"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Download className="h-3.5 w-3.5" style={{ color: '#10b981' }} />
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
                className="cosmos-touch-target inline-flex shrink-0 items-center justify-center rounded-xl border px-2.5"
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
                className="min-w-0 flex-1 resize-none rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <button
                type="submit"
                disabled={!inputValue.trim() || isThinking}
                aria-label="إرسال الطلب للمساعد"
                className="cosmos-touch-target inline-flex shrink-0 items-center justify-center rounded-xl px-3 disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </aside>
      )}

      {/* Brain Picker BottomSheet */}
      <BottomSheet
        open={brainSheetOpen}
        onClose={() => setBrainSheetOpen(false)}
        title="اختر محرك الذكاء — Morrow"
        subtitle="التصعيد التلقائي يبدأ محلياً مجاناً ثم يصعّد للسحابة عند الحاجة فقط"
        icon={<Cpu className="h-5 w-5" />}
      >
        <div className="space-y-2.5">
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
