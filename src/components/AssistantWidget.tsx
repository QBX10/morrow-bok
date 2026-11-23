import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  FileSpreadsheet,
  Navigation,
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
}

const BRAIN_MODES: Array<{
  id: AssistantBrainMode;
  label: string;
  desc: string;
}> = [
  { id: 'auto', label: 'تلقائي', desc: 'Morrow المحلي أولاً ثم 2.5 Flash ثم 2.5 Pro عند الحاجة' },
  { id: 'local', label: 'Morrow محلي', desc: 'ردود وحسابات وفحص فوري بدون إنترنت' },
  { id: 'gemini_2_5_flash', label: '2.5 Flash', desc: 'Gemini 2.5 Flash للمهام اللغوية السريعة' },
  { id: 'gemini_2_5_pro', label: '2.5 Pro', desc: 'Gemini 2.5 Pro للتحليل العميق والتقارير' },
];

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
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [savedPromptSet, setSavedPromptSet] = useState<Set<string>>(() => new Set());
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, isThinking]);

  // Apply visual spotlight class to matching DOM target when "وريني" is active
  useEffect(() => {
    if (!spotlight?.targetId) return;
    const el = document.querySelector(
      `[data-assistant-target="${spotlight.targetId}"]`
    );
    if (el instanceof HTMLElement) {
      el.classList.add('assistant-spotlight-active');
      return () => {
        el.classList.remove('assistant-spotlight-active');
      };
    }
  }, [spotlight]);

  const activeBrainLabel = useMemo(
    () => BRAIN_MODES.find((b) => b.id === brainMode)?.label || 'تلقائي',
    [brainMode]
  );

  const statusMeta = useMemo(() => {
    if (connectivity === 'online') {
      return {
        label: 'أونلاين',
        bg: 'var(--success-bg)',
        border: 'var(--success)',
        color: 'var(--success)',
        title: `متصل (${assistantSettings?.preferredModelId || 'gemini-2.5-flash'})`,
      };
    }
    if (connectivity === 'quota_exhausted') {
      return {
        label: 'الحصة خلصت',
        bg: 'var(--danger-bg, var(--warning-bg))',
        border: 'var(--danger)',
        color: 'var(--danger)',
        title: 'انتهت حصة السحابة مؤقتاً — يعمل الآن بمحرك Morrow المحلي',
      };
    }
    return {
      label: 'أوفلاين',
      bg: 'var(--warning-bg)',
      border: 'var(--warning)',
      color: 'var(--warning)',
      title: assistantSettings?.onlineDisabled
        ? 'معطّل من الإعدادات — وضع أوفلاين صارم'
        : 'يعمل حالياً بمحرك Morrow المحلي بدون إنترنت',
    };
  }, [connectivity, assistantSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue('');
    onSendMessage(trimmed, { fromFloatingWidget: true });
  };

  return (
    <>
      {/* Guided Spotlight Floating Banner ("وريني") */}
      {spotlight && (
        <aside
          role="status"
          aria-live="polite"
          className="no-print fixed top-[78px] left-1/2 z-50 flex w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 shadow-xl"
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
            className="rounded-lg border px-2 py-1 text-[11px] font-bold shrink-0"
            style={{ borderColor: 'var(--border-color)' }}
          >
            فهمت
          </button>
        </aside>
      )}

      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => onToggleOpen(true)}
          aria-label="فتح المساعد الذكي Morrow"
          title={proactiveTip || 'فتح المساعد الذكي Morrow'}
          className="no-print assistant-glow-btn fixed bottom-3 left-3 z-40 inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[11px] font-bold whitespace-nowrap transition-transform hover:scale-[1.03] sm:bottom-4 sm:left-4 sm:gap-2 sm:px-4 sm:py-3 sm:text-xs"
          style={{
            backgroundColor: 'var(--accent)',
            borderColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          <Bot className="h-4 w-4 shrink-0" />
          <span>المساعد الذكي</span>
          {(pendingDraftsCount > 0 || queuedTasks.length > 0) && (
            <span className="rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] tabular-nums">
              {pendingDraftsCount + queuedTasks.length}
            </span>
          )}
        </button>
      )}

      {/* Non-Blocking Side Drawer Panel */}
      {isOpen && (
        <aside
          aria-label="لوحة المساعد الذكي — Morrow"
          className="no-print fixed top-14 bottom-3 left-3 z-40 flex w-[min(430px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent)',
            color: 'var(--text-primary)',
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.28)',
          }}
        >
          {/* Header: Identity + Online/Offline/Quota Badge + Undo + Settings + Close */}
          <div
            className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-bold whitespace-nowrap">Morrow</h2>
                  <span
                    title={statusMeta.title}
                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: statusMeta.bg,
                      borderColor: statusMeta.border,
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
                  الوضع: {activeBrainLabel}
                  {focusedPersonName ? ` · المحدد: ${focusedPersonName}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onOpenCommandCenter && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenCommandCenter(pendingDraftsCount > 0 ? 'approvals' : 'chat')
                  }
                  aria-label="فتح مركز Morrow الكامل"
                  title="فتح مركز Morrow الكامل (الموافقات والذاكرة والملاحظات)"
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor:
                      pendingDraftsCount > 0 ? 'var(--accent)' : 'var(--border-color)',
                    color: pendingDraftsCount > 0 ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>
                    المركز{pendingDraftsCount > 0 ? ` (${pendingDraftsCount})` : ''}
                  </span>
                </button>
              )}
              {hasUndoableAction && onUndoLastAction && (
                <button
                  type="button"
                  onClick={() => onUndoLastAction()}
                  aria-label="تراجع عن آخر عملية للمساعد"
                  title="تراجع عن آخر عملية نفذها المساعد"
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--warning)',
                    color: 'var(--warning)',
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>تراجع</span>
                </button>
              )}
              {onOpenAssistantSettings && (
                <button
                  type="button"
                  onClick={onOpenAssistantSettings}
                  aria-label="إعدادات المساعد الذكي والحصة"
                  title="إعدادات النموذج والحصة والخصوصية"
                  className="rounded-lg border p-1.5 text-[11px]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPrefs((v) => !v)}
                aria-label="تفضيلات المساعد المحفوظة"
                title="التفضيلات المحفوظة والطلبات المؤجلة"
                className="rounded-lg border p-1.5 text-[11px]"
                style={{
                  backgroundColor: showPrefs ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                  borderColor: showPrefs ? 'var(--accent)' : 'var(--border-color)',
                  color: showPrefs ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onToggleOpen(false)}
                aria-label="إغلاق لوحة المساعد"
                className="rounded-lg border p-1.5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Brain / Model Switcher (All 5 modes preserved) */}
          <div
            className="border-b px-3 py-2"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-flex items-center gap-1 font-bold">
                <Cpu className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                <span>محرك الذكاء:</span>
              </span>
              <span className="truncate">{BRAIN_MODES.find((b) => b.id === brainMode)?.desc}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {BRAIN_MODES.map((m) => {
                const active = brainMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeBrainMode(m.id)}
                    className="rounded-lg border px-2 py-1 text-[11px] font-bold whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--accent)' : 'var(--bg-main)',
                      borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                      color: active ? 'var(--accent-fg)' : 'var(--text-primary)',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Offline Action Bar (All 4 core instant buttons preserved) */}
          <div
            className="grid grid-cols-4 gap-1.5 border-b px-3 py-2"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setInputValue('ابحث ');
                inputRef.current?.focus();
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Search className="h-3 w-3" style={{ color: 'var(--accent)' }} />
              <span>بحث</span>
            </button>
            <button
              type="button"
              onClick={() => onSendMessage('صدر تقرير اكسل', { fromFloatingWidget: true })}
              className="inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <FileSpreadsheet className="h-3 w-3" style={{ color: 'var(--success)' }} />
              <span>تقرير</span>
            </button>
            <button
              type="button"
              onClick={() => onSendMessage('المكررين', { fromFloatingWidget: true })}
              className="inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Users className="h-3 w-3" style={{ color: 'var(--warning)' }} />
              <span>المكررين</span>
            </button>
            <button
              type="button"
              onClick={() => onSendMessage('افحص التطبيق', { fromFloatingWidget: true })}
              className="inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ShieldCheck className="h-3 w-3" style={{ color: 'var(--accent)' }} />
              <span>افحص</span>
            </button>
          </div>

          {/* Quota Alert Strip */}
          {quotaInfo &&
            !assistantSettings?.onlineDisabled &&
            (quotaInfo.quotaExhausted || quotaInfo.nearDailyLimit) && (
              <div
                className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <span className="truncate font-semibold">
                  {quotaInfo.quotaExhausted
                    ? 'خلصت حصة السحابة — التحويل التلقائي للمحلي فعّال'
                    : `تنبيه الحصة: ${quotaInfo.dailyUsed}/${quotaInfo.dailyLimit} طلب اليوم (${quotaInfo.dailyPercent}%)`}
                </span>
                {onOpenAssistantSettings && (
                  <button
                    type="button"
                    onClick={onOpenAssistantSettings}
                    className="shrink-0 font-bold underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    الإعدادات
                  </button>
                )}
              </div>
            )}

          {/* Saved Memory Preferences & Offline Queue Inspector */}
          {showPrefs && (
            <div
              className="max-h-56 space-y-2.5 overflow-y-auto border-b p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="space-y-1.5">
                <div className="font-bold">تفضيلاتك المحفوظة ({preferences.length})</div>
                {preferences.length === 0 ? (
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    لا توجد تفضيلات محفوظة بعد. قل مثلاً: «اخفي عمود الحالة في التقرير».
                  </p>
                ) : (
                  preferences.map((pref) => (
                    <div
                      key={pref.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span className="truncate font-semibold">{pref.label}</span>
                      <button
                        type="button"
                        onClick={() => onDeletePref(pref.id)}
                        aria-label={`حذف تفضيل ${pref.label}`}
                        className="rounded p-1 hover:opacity-75"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {queuedTasks.length > 0 && (
                <div className="space-y-1.5 border-t pt-2" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="font-bold">طلبات محفوظة بانتظار الإنترنت ({queuedTasks.length})</div>
                  {queuedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span className="truncate text-[11px]">{task.prompt}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onRunQueuedTask(task)}
                          className="rounded px-2 py-0.5 text-[10px] font-bold"
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
                          aria-label="حذف الطلب المحفوظ"
                          className="p-0.5"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Proactive Health Notice inside Drawer */}
          {proactiveTip && !tipDismissed && !showPrefs && (
            <div
              className="flex items-center justify-between gap-2 border-b px-3 py-2 text-[11px]"
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
                <span className="truncate">{proactiveTip}</span>
              </button>
              <button
                type="button"
                onClick={() => setTipDismissed(true)}
                aria-label="إخفاء التنبيه"
                className="rounded p-0.5 hover:opacity-75"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Queued Offline Requests Ready Banner when back Online */}
          {connectivity === 'online' && queuedTasks.length > 0 && !showPrefs && (
            <div
              className="flex items-center justify-between gap-2 border-b px-3 py-2 text-[11px]"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
              }}
            >
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: 'var(--accent)' }}>
                <Clock className="h-3.5 w-3.5" />
                <span>عندك {queuedTasks.length} طلب محفوظ جاهز للتنفيذ</span>
              </span>
              <button
                type="button"
                onClick={() => onRunQueuedTask(queuedTasks[0])}
                className="rounded-md px-2.5 py-1 font-bold whitespace-nowrap"
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
          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${
                    isUser ? 'items-start' : 'items-stretch'
                  }`}
                >
                  <div
                    className="rounded-xl border px-3 py-2.5 leading-relaxed whitespace-pre-line"
                    style={{
                      backgroundColor: isUser
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                      borderColor: isUser
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                      maxWidth: isUser ? '88%' : '100%',
                    }}
                  >
                    {!isUser && (msg.engineLabel || msg.engineUsed) && (
                      <div
                        className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold"
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
                        {typeof msg.confidence === 'number' && (
                          <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            ثقة {Math.round(msg.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    )}

                    <div>{msg.text}</div>

                    {/* Inline Undo Button on Executed Assistant Mutation */}
                    {msg.canUndo && !msg.undoUsed && hasUndoableAction && onUndoLastAction && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => onUndoLastAction(msg.id)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold"
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

                    {/* Sandbox Read-Only Confirmation */}
                    {msg.sandboxNotice && (
                      <div
                        className="mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: 'var(--success-bg)',
                          borderColor: 'var(--success)',
                          color: 'var(--success)',
                        }}
                      >
                        {msg.sandboxNotice}
                      </div>
                    )}

                    {/* Spotlight "وريني" Navigation Button */}
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
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-fg)',
                        }}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        <span>{msg.spotlightAction.label}</span>
                      </button>
                    )}

                    {/* Interactive Slot-Filling & Disambiguation Choice Buttons */}
                    {msg.choices && msg.choices.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.choices.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => onChoiceClick(ch)}
                            className="rounded-lg border px-2.5 py-1.5 text-right text-[11px] font-bold transition-colors hover:opacity-90"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor:
                                ch.tone === 'warning'
                                  ? 'var(--warning)'
                                  : 'var(--accent)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <div>{ch.label}</div>
                            {ch.sublabel && (
                              <div className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                                {ch.sublabel}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Diagnostics Health Report Card */}
                    {msg.diagnosticsReport && (
                      <div
                        className="mt-2.5 space-y-2 rounded-lg border p-2.5 text-[11px]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>نسبة سلامة البيانات</span>
                          <span
                            className="tabular-nums"
                            style={{
                              color:
                                msg.diagnosticsReport.healthScore >= 85
                                  ? 'var(--success)'
                                  : 'var(--warning)',
                            }}
                          >
                            {msg.diagnosticsReport.healthScore}%
                          </span>
                        </div>
                        {msg.diagnosticsReport.issues.slice(0, 6).map((issue) => (
                          <div
                            key={issue.id}
                            className="rounded border px-2 py-1"
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
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-bold"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-fg)',
                            }}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            <span>
                              إصلاح التلقائي ({msg.diagnosticsReport.autoFixableCount})
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Before -> After Confirmation Diff Card */}
                    {msg.confirmationDiff && (
                      <div
                        className="mt-2.5 space-y-2 rounded-xl border p-2.5 text-[11px]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--accent)',
                        }}
                      >
                        <div className="font-bold" style={{ color: 'var(--accent)' }}>
                          {msg.confirmationDiff.title}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {msg.confirmationDiff.summary}
                        </div>

                        <div className="space-y-1">
                          {msg.confirmationDiff.changes.map((c, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-1 gap-0.5 rounded-lg border px-2 py-1.5"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <div className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
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
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 font-bold"
                              style={{
                                backgroundColor: 'var(--success)',
                                color: 'var(--success-fg)',
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>موافق</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onResolveDiff(msg.id, false)}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 font-bold"
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

                    {/* Level C Offline Queue Save Button */}
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
                            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold"
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
                className="rounded-xl border px-3 py-2 text-[11px] font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                جاري التفكير والتحقق من الأدوات...
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Screen-Aware Smart Suggestions Strip */}
          {smartSuggestions.length > 0 && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto border-t px-2.5 py-1.5"
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
                  className="shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold whitespace-nowrap transition-colors hover:opacity-90"
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

          {/* Input Composer */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t p-2.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="اكتب طلبك باللهجة العراقية (مثال: ضيف علي وحسن واطبع تقرير)..."
              aria-label="اكتب أمرك للمساعد الذكي"
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              aria-label="إرسال الطلب للمساعد"
              className="inline-flex shrink-0 items-center justify-center rounded-xl p-2.5 disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
};
