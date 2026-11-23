import React, { useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  History,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  UserCheck,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type { Agency, Person } from '../types/agency.ts';
import type {
  AssistantApprovalDraft,
  AssistantBrainMode,
  AssistantChoiceChip,
  AssistantConnectivityState,
  AssistantEngineSource,
  AssistantMessage,
  AssistantQuickNote,
  AssistantSmartSuggestion,
  AssistantUserPref,
  MorrowCenterTab,
} from '../types/assistant.ts';
import { getEngineDisplayMeta } from '../utils/morrowRouter.ts';
import { autoLinkQuickNoteToPerson } from '../utils/quickNotesMatcher.ts';

interface MorrowCommandCenterViewProps {
  activeTab: MorrowCenterTab;
  onChangeTab: (tab: MorrowCenterTab) => void;
  brainMode: AssistantBrainMode;
  onChangeBrainMode: (mode: AssistantBrainMode) => void;
  connectivity: AssistantConnectivityState;
  isThinking: boolean;
  messages: AssistantMessage[];
  smartSuggestions: AssistantSmartSuggestion[];
  hasUndoableAction: boolean;
  onUndoLastAction: (msgId?: string) => void;
  onSendMessage: (prompt: string) => void;
  onChoiceClick: (choice: AssistantChoiceChip) => void;
  onResolveDiff: (messageId: string, approved: boolean) => void;
  onTriggerSpotlight: (opts: {
    view: NonNullable<AssistantMessage['spotlightAction']>['view'];
    settingsSection?: NonNullable<AssistantMessage['spotlightAction']>['settingsSection'];
    targetId: string;
    title: string;
    description: string;
  }) => void;
  // Approvals Tab
  approvalDrafts: AssistantApprovalDraft[];
  onApproveDraft: (draftId: string) => void;
  onRejectDraft: (draftId: string) => void;
  // Memory Tab
  preferences: AssistantUserPref[];
  onSaveMemoryRule: (label: string, explicitKey?: string) => void;
  onDeleteMemoryRule: (prefId: string) => void;
  // Quick Notes Tab
  agencies: Agency[];
  persons: Person[];
  quickNotes: AssistantQuickNote[];
  onAddQuickNote: (input: {
    text: string;
    source: 'text' | 'voice';
    overridePersonId?: number | null;
    syncToPerson?: boolean;
  }) => void;
  onUpdateQuickNoteLink: (noteId: string, personId: number | null) => void;
  onSyncQuickNoteToPerson: (noteId: string) => void;
  onDeleteQuickNote: (noteId: string) => void;
  onJumpToPerson: (person: Person) => void;
}

const BRAIN_BUTTONS: Array<{
  id: AssistantBrainMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'auto',
    label: 'تلقائي (تصعيد ذكي)',
    desc: 'يبدأ بـ Morrow المحلي ثم 2.5 Flash ثم 2.5 Pro',
    icon: <Bot className="h-3.5 w-3.5" />,
  },
  {
    id: 'local',
    label: 'Morrow المحلي',
    desc: 'استجابة فورية بدون إنترنت للبحث والحسابات',
    icon: <Cpu className="h-3.5 w-3.5" />,
  },
  {
    id: 'gemini_2_5_flash',
    label: 'Gemini 2.5 Flash',
    desc: 'المهام اللغوية السريعة والصياغة اليومية',
    icon: <Zap className="h-3.5 w-3.5" />,
  },
  {
    id: 'gemini_2_5_pro',
    label: 'Gemini 2.5 Pro',
    desc: 'التحليل الاستراتيجي والتقارير العميقة',
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
];

const MEMORY_PRESETS: Array<{ key: string; label: string; desc: string }> = [
  {
    key: 'hide_amount_in_reports',
    label: 'دائماً أخفي المبلغ في التقارير',
    desc: 'يزيل عمود المبلغ وإجماليات الأسعار تلقائياً من PDF وExcel.',
  },
  {
    key: 'hide_status_in_reports',
    label: 'دائماً أخفي عمود الحالة في التقارير',
    desc: 'يصدر الكشوفات الرسمية بدون عمود الحالة.',
  },
  {
    key: 'hide_notes_in_reports',
    label: 'دائماً أخفي الملاحظات في التقارير',
    desc: 'يخفي الملاحظات الداخلية عن تقارير الطباعة والتصدير.',
  },
];

function EngineAttributionIcon({ engine }: { engine?: AssistantEngineSource }) {
  if (engine === 'gemini_2_5_pro') {
    return <Sparkles className="h-3.5 w-3.5 shrink-0" />;
  }
  if (engine === 'gemini_2_5_flash') {
    return <Zap className="h-3.5 w-3.5 shrink-0" />;
  }
  return <Cpu className="h-3.5 w-3.5 shrink-0" />;
}

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

export const MorrowCommandCenterView: React.FC<MorrowCommandCenterViewProps> = ({
  activeTab,
  onChangeTab,
  brainMode,
  onChangeBrainMode,
  connectivity,
  isThinking,
  messages,
  smartSuggestions,
  hasUndoableAction,
  onUndoLastAction,
  onSendMessage,
  onChoiceClick,
  onResolveDiff,
  onTriggerSpotlight,
  approvalDrafts,
  onApproveDraft,
  onRejectDraft,
  preferences,
  onSaveMemoryRule,
  onDeleteMemoryRule,
  agencies,
  persons,
  quickNotes,
  onAddQuickNote,
  onUpdateQuickNoteLink,
  onSyncQuickNoteToPerson,
  onDeleteQuickNote,
  onJumpToPerson,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [customMemoryInput, setCustomMemoryInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteSource, setNoteSource] = useState<'text' | 'voice'>('text');
  const [syncOnSave, setSyncOnSave] = useState(true);
  const [manualOverridePersonId, setManualOverridePersonId] = useState<number | null | undefined>(
    undefined
  );
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const pendingDrafts = useMemo(
    () => approvalDrafts.filter((d) => d.status === 'pending'),
    [approvalDrafts]
  );
  const resolvedDrafts = useMemo(
    () => approvalDrafts.filter((d) => d.status !== 'pending'),
    [approvalDrafts]
  );

  // Live auto-link preview as user types or dictates note
  const liveMatch = useMemo(
    () => autoLinkQuickNoteToPerson(noteInput, persons, agencies),
    [noteInput, persons, agencies]
  );

  const effectivePreviewPerson = useMemo(() => {
    if (manualOverridePersonId === null) return null;
    if (typeof manualOverridePersonId === 'number') {
      return persons.find((p) => p.id === manualOverridePersonId) || null;
    }
    return liveMatch.person;
  }, [manualOverridePersonId, liveMatch.person, persons]);

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  const toggleVoiceDictation = () => {
    setVoiceError(null);
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError('الإملاء الصوتي غير مدعوم في هذا المتصفح، يمكنك كتابة الملاحظة مباشرة.');
      return;
    }

    try {
      const rec = new Ctor();
      rec.lang = 'ar-IQ';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (ev) => {
        const transcriptParts: string[] = [];
        for (let i = 0; i < ev.results.length; i++) {
          transcriptParts.push(ev.results[i][0]?.transcript || '');
        }
        const combined = transcriptParts.join(' ').trim();
        if (combined) {
          setNoteInput(combined);
          setNoteSource('voice');
        }
      };
      rec.onerror = () => {
        setIsRecording(false);
        setVoiceError('تعذر التقاط الصوت. تأكد من صلاحية الميكروفون أو اكتب الملاحظة نصياً.');
      };
      rec.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = rec;
      setIsRecording(true);
      rec.start();
    } catch {
      setIsRecording(false);
      setVoiceError('تعذر بدء التسجيل الصوتي.');
    }
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    onAddQuickNote({
      text: noteInput,
      source: noteSource,
      overridePersonId:
        manualOverridePersonId !== undefined ? manualOverridePersonId : undefined,
      syncToPerson: syncOnSave,
    });
    setNoteInput('');
    setNoteSource('text');
    setManualOverridePersonId(undefined);
  };

  const tabs: Array<{
    id: MorrowCenterTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'chat',
      label: 'المحادثة',
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: 'approvals',
      label: 'المهام والمراجعة',
      count: pendingDrafts.length,
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
    {
      id: 'memory',
      label: 'الذاكرة',
      count: preferences.length,
      icon: <BookmarkCheck className="h-4 w-4" />,
    },
    {
      id: 'quick_notes',
      label: 'الملاحظات السريعة',
      count: quickNotes.length,
      icon: <StickyNote className="h-4 w-4" />,
    },
  ];

  return (
    <main
      data-testid="morrow-command-center"
      className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 pb-24 sm:p-6 sm:pb-20"
    >
      {/* Header & Single-Level Segmented Tab Bar */}
      <header
        className="rounded-2xl border p-4 sm:p-5 space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--border-color)',
                color: 'var(--accent)',
              }}
            >
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold sm:text-xl">مركز Morrow</h1>
              <div
                className="mt-0.5 flex flex-wrap items-center gap-2 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>الدماغ الثلاثي الحصري: Morrow المحلي · Gemini 2.5 Flash · Gemini 2.5 Pro</span>
                <span aria-hidden="true">/</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  {connectivity === 'online' ? (
                    <Wifi className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" style={{ color: 'var(--warning)' }} />
                  )}
                  <span>
                    {connectivity === 'online'
                      ? 'متصل بالسحابة'
                      : connectivity === 'quota_exhausted'
                      ? 'الحصة مؤقتة — يعمل محلياً'
                      : 'وضع محلي (Offline)'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasUndoableAction && (
              <button
                type="button"
                onClick={() => onUndoLastAction()}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--warning)',
                  color: 'var(--warning)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>تراجع عن آخر تعديل</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Workspace Tabs */}
        <nav
          aria-label="تبويبات مركز Morrow"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border p-1.5"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`morrow-tab-${tab.id}`}
                onClick={() => onChangeTab(tab.id)}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  border: isActive
                    ? '1px solid var(--border-color)'
                    : '1px solid transparent',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className="tabular-nums text-[11px]"
                    style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    ({tab.count})
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* TAB 1: المحادثة (Chat) */}
      {activeTab === 'chat' && (
        <section
          aria-label="محادثة Morrow الذكية"
          className="rounded-2xl border overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            minHeight: '62vh',
          }}
        >
          {/* 3-Brain Switcher Strip */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {BRAIN_BUTTONS.map((btn) => {
                const active = brainMode === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    title={btn.desc}
                    onClick={() => onChangeBrainMode(btn.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--accent)' : 'var(--bg-surface)',
                      borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                      color: active ? 'var(--accent-fg)' : 'var(--text-primary)',
                    }}
                  >
                    {btn.icon}
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {BRAIN_BUTTONS.find((b) => b.id === brainMode)?.desc}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5 text-sm">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const meta = getEngineDisplayMeta(msg.engineUsed);
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${
                    isUser ? 'items-start' : 'items-stretch'
                  }`}
                >
                  <div
                    className="rounded-xl border px-4 py-3 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line"
                    style={{
                      backgroundColor: isUser
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                      borderColor: isUser ? 'var(--accent)' : 'var(--border-color)',
                      maxWidth: isUser ? '82%' : '100%',
                    }}
                  >
                    {!isUser && (
                      <div
                        className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span
                          className="inline-flex items-center gap-1.5 font-bold"
                          style={{ color: 'var(--accent)' }}
                        >
                          <EngineAttributionIcon engine={msg.engineUsed} />
                          <span>{msg.engineLabel || meta.badgeLabel}</span>
                        </span>
                        <span className="tabular-nums">
                          {msg.modelId || meta.modelId}
                          {typeof msg.confidence === 'number'
                            ? ` · ثقة ${Math.round(msg.confidence * 100)}%`
                            : ''}
                          {msg.fromCache ? ' · ذاكرة سريعة' : ''}
                        </span>
                      </div>
                    )}

                    <div>{msg.text}</div>

                    {msg.sandboxNotice && (
                      <div
                        className="mt-2 border-t pt-2 text-[11px] font-semibold"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--success)',
                        }}
                      >
                        {msg.sandboxNotice}
                      </div>
                    )}

                    {msg.spotlightAction && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            onTriggerSpotlight({
                              view: msg.spotlightAction!.view,
                              settingsSection: msg.spotlightAction!.settingsSection,
                              targetId: msg.spotlightAction!.targetId,
                              title: msg.spotlightAction!.label,
                              description: 'انتقال ذكي إلى العنصر المحدد',
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-fg)',
                          }}
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          <span>{msg.spotlightAction.label}</span>
                        </button>
                      </div>
                    )}

                    {msg.choices && msg.choices.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.choices.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => onChoiceClick(ch)}
                            className="rounded-lg border px-3 py-1.5 text-right text-xs font-bold whitespace-nowrap transition-colors hover:opacity-90"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor:
                                ch.tone === 'warning'
                                  ? 'var(--warning)'
                                  : 'var(--accent)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.diagnosticsReport && (
                      <div
                        className="mt-3 space-y-2 border-t pt-3 text-xs"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>تقرير الفحص والتدقيق</span>
                          <span className="tabular-nums">
                            {msg.diagnosticsReport.healthScore}% · {msg.diagnosticsReport.totalIssues} ملاحظة
                          </span>
                        </div>
                        {msg.diagnosticsReport.issues.slice(0, 6).map((issue) => (
                          <div
                            key={issue.id}
                            className="rounded-lg border px-3 py-2"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor:
                                issue.severity === 'high'
                                  ? 'var(--danger)'
                                  : 'var(--border-color)',
                            }}
                          >
                            <div className="font-bold">{issue.title}</div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              {issue.detail}
                            </div>
                          </div>
                        ))}
                        {msg.diagnosticsReport.autoFixableCount > 0 && (
                          <button
                            type="button"
                            onClick={() => onSendMessage('صلح مشاكل الفحص تلقائياً')}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-fg)',
                            }}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            <span>
                              تجهيز مسودة إصلاح ({msg.diagnosticsReport.autoFixableCount})
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {msg.confirmationDiff && (
                      <div
                        className="mt-3 space-y-2 border-t pt-3 text-xs"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <div className="font-bold" style={{ color: 'var(--accent)' }}>
                          {msg.confirmationDiff.title}
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {msg.confirmationDiff.changes.map((c, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border px-3 py-2"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {c.fieldLabel}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-bold">
                                <span className="line-through opacity-75">
                                  {c.beforeValue}
                                </span>
                                <span style={{ color: 'var(--accent)' }}>←</span>
                                <span style={{ color: 'var(--success)' }}>
                                  {c.afterValue}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {msg.confirmationDiff.status === 'pending' ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => onResolveDiff(msg.id, true)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap"
                              style={{
                                backgroundColor: 'var(--success)',
                                color: 'var(--success-fg)',
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>موافقة وتنفيذ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onResolveDiff(msg.id, false)}
                              className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-bold whitespace-nowrap"
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
                          <div className="text-xs font-bold" style={{ color: 'var(--success)' }}>
                            {msg.confirmationDiff.status === 'approved'
                              ? 'تمت الموافقة والتنفيذ'
                              : 'ملغى'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isThinking && (
              <div
                className="rounded-xl border px-4 py-3 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                جاري المعالجة عبر سلسلة التصعيد الذكي...
              </div>
            )}
            <div ref={chatScrollRef} />
          </div>

          {/* Contextual Suggestions + Composer */}
          {smartSuggestions.length > 0 && (
            <div
              className="flex items-center gap-2 overflow-x-auto border-t px-4 py-2"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {smartSuggestions.map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  onClick={() => onSendMessage(sug.prompt)}
                  className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              onSendMessage(chatInput.trim());
              setChatInput('');
            }}
            className="flex items-center gap-2.5 border-t p-3.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="اكتب أمرك أو سؤالك التحليلي (مثال: الرقم غريب، اعرض المحجوبين، حلل أداء الوكالات)..."
              className="min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isThinking}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-45"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Send className="h-4 w-4" />
              <span>إرسال</span>
            </button>
          </form>
        </section>
      )}

      {/* TAB 2: المهام والمراجعة (Approvals Draft Queue) */}
      {activeTab === 'approvals' && (
        <section
          aria-label="طابور المهام والمراجعة"
          data-testid="morrow-approvals-panel"
          className="space-y-5"
        >
          <div
            className="rounded-2xl border p-4 sm:p-5 space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold">
                  مسودات بانتظار موافقتك ({pendingDrafts.length})
                </h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  لا يعدّل المساعد أي سجل أو مصروف بشكل مباشر — كل عملية تصل هنا للمراجعة أولاً وتُنفذ فقط بعد الضغط على «موافقة وتنفيذ».
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSendMessage('صلح مشاكل الفحص تلقائياً')}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>فحص وتوليد مسودة إصلاح</span>
              </button>
            </div>

            {pendingDrafts.length === 0 ? (
              <div
                className="rounded-xl border px-4 py-8 text-center text-xs space-y-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <ClipboardCheck className="mx-auto h-7 w-7 opacity-60" />
                <div className="font-bold">لا توجد مسودات معلقة حالياً</div>
                <div>
                  عند طلب إضافة أو تعديل أو أرشفة من المحادثة أو Ctrl + K، ستظهر المسودة هنا جاهزة للتدقيق والتنفيذ.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDrafts.map((draft) => (
                  <article
                    key={draft.id}
                    className="rounded-xl border p-4 space-y-3"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--accent)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold">{draft.diff.title}</h3>
                        <div
                          className="mt-0.5 text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          المصدر: {draft.sourceLabel}
                          {draft.promptOrigin ? ` · الطلب: «${draft.promptOrigin}»` : ''}
                        </div>
                      </div>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {new Date(draft.createdAt).toLocaleTimeString('ar-IQ', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {draft.diff.changes.map((c, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border px-3 py-2 text-xs"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {c.fieldLabel}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-bold">
                            <span className="line-through opacity-75">
                              {c.beforeValue}
                            </span>
                            <span style={{ color: 'var(--accent)' }}>←</span>
                            <span style={{ color: 'var(--success)' }}>
                              {c.afterValue}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        data-testid={`approve-draft-${draft.id}`}
                        onClick={() => onApproveDraft(draft.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--success)',
                          color: 'var(--success-fg)',
                        }}
                      >
                        <Check className="h-4 w-4" />
                        <span>موافقة وتنفيذ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectDraft(draft.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--danger)',
                          color: 'var(--danger)',
                        }}
                      >
                        <X className="h-4 w-4" />
                        <span>إلغاء المسودة</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {resolvedDrafts.length > 0 && (
            <div
              className="rounded-2xl border p-4 sm:p-5 space-y-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <History className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                <span>سجل المسودات المنفذة / الملغاة ({resolvedDrafts.length})</span>
              </div>
              <div className="space-y-2">
                {resolvedDrafts.slice(0, 8).map((draft) => (
                  <div
                    key={draft.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold">{draft.diff.title}</div>
                      {draft.resultText && (
                        <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {draft.resultText}
                        </div>
                      )}
                    </div>
                    <span
                      className="font-bold whitespace-nowrap"
                      style={{
                        color:
                          draft.status === 'approved'
                            ? 'var(--success)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {draft.status === 'approved' ? 'مُنفّذ' : 'ملغى'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: الذاكرة (Persistent Behavioral Memory Rules) */}
      {activeTab === 'memory' && (
        <section
          aria-label="قواعد الذاكرة الدائمة"
          data-testid="morrow-memory-panel"
          className="rounded-2xl border p-4 sm:p-5 space-y-5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div>
            <h2 className="text-base font-extrabold">الذاكرة والقواعد الدائمة</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              القواعد المحفوظة هنا تُطبّق تلقائياً على جميع صادرات PDF وExcel عبر التطبيق دون الحاجة لتكرار التعليمات.
            </p>
          </div>

          {/* Preset Quick Rules */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {MEMORY_PRESETS.map((preset) => {
              const enabled = preferences.some(
                (p) => p.key === preset.key && String(p.value) !== 'false'
              );
              return (
                <div
                  key={preset.key}
                  className="flex flex-col justify-between gap-3 rounded-xl border p-3.5 text-xs"
                  style={{
                    backgroundColor: enabled ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: enabled ? 'var(--accent)' : 'var(--border-color)',
                  }}
                >
                  <div>
                    <div className="font-bold">{preset.label}</div>
                    <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {preset.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const existing = preferences.find((p) => p.key === preset.key);
                      if (existing) {
                        onDeleteMemoryRule(existing.id);
                      } else {
                        onSaveMemoryRule(preset.label, preset.key);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: enabled ? 'var(--accent)' : 'var(--bg-surface)',
                      borderColor: enabled ? 'var(--accent)' : 'var(--border-color)',
                      color: enabled ? 'var(--accent-fg)' : 'var(--text-primary)',
                    }}
                  >
                    {enabled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>مفعّلة الآن (اضغط للإلغاء)</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>تفعيل القاعدة</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom Memory Rule Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customMemoryInput.trim()) return;
              onSaveMemoryRule(customMemoryInput.trim());
              setCustomMemoryInput('');
            }}
            className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <input
              type="text"
              value={customMemoryInput}
              onChange={(e) => setCustomMemoryInput(e.target.value)}
              placeholder="أضف قاعدة ذاكرة مخصصة (مثال: دائماً أخفي المبلغ في التقارير)..."
              className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="submit"
              disabled={!customMemoryInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-45"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>حفظ في الذاكرة</span>
            </button>
          </form>

          {/* Active Preferences List */}
          <div className="space-y-2">
            <div className="text-xs font-bold">
              القواعد النشطة ({preferences.length})
            </div>
            {preferences.length === 0 ? (
              <div
                className="rounded-xl border px-4 py-6 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                لا توجد قواعد محفوظة حالياً. فعّل إحدى القواعد الجاهزة أو أضف قاعدة مخصصة أعلاه.
              </div>
            ) : (
              preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate font-bold">{pref.label}</div>
                    <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      المفتاح: {pref.key} · مضافة بتاريخ {pref.createdAt}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMemoryRule(pref.id)}
                    aria-label={`حذف قاعدة ${pref.label}`}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--danger)',
                      color: 'var(--danger)',
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* TAB 4: الملاحظات السريعة (Text + Voice Dictation + Auto Beneficiary Linking) */}
      {activeTab === 'quick_notes' && (
        <section
          aria-label="الملاحظات السريعة والإملاء الصوتي"
          data-testid="morrow-quick-notes-panel"
          className="rounded-2xl border p-4 sm:p-5 space-y-5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold">
                الملاحظات السريعة والربط التلقائي بالعائلة
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                اكتب أو أمْلِ ملاحظتك بالصوت وسيكتشف Morrow العائلة المطابقة تلقائياً ويربط الملاحظة بسجلها.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleVoiceDictation}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: isRecording ? 'var(--danger)' : 'var(--bg-main)',
                borderColor: isRecording ? 'var(--danger)' : 'var(--border-color)',
                color: isRecording ? '#ffffff' : 'var(--text-primary)',
              }}
            >
              {isRecording ? (
                <>
                  <MicOff className="h-4 w-4" />
                  <span>إيقاف التسجيل الصوتي</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>
                    {speechSupported ? 'إملاء صوتي عربي' : 'إدخال صوتي (فحص الدعم)'}
                  </span>
                </>
              )}
            </button>
          </div>

          {voiceError && (
            <div
              className="rounded-xl border px-3.5 py-2 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)',
              }}
            >
              {voiceError}
            </div>
          )}

          <form
            onSubmit={handleSaveNote}
            className="rounded-xl border p-4 space-y-3"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <textarea
              rows={3}
              value={noteInput}
              onChange={(e) => {
                setNoteInput(e.target.value);
                if (!isRecording) setNoteSource('text');
              }}
              placeholder="مثال: مراجعة عائلة حيدر كاظم بخصوص استلام الكيس الثاني يوم الخميس..."
              className="w-full rounded-xl border p-3 text-xs sm:text-sm"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />

            {/* Live Fuzzy Match Preview Bar */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: effectivePreviewPerson
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                {effectivePreviewPerson ? (
                  <span className="truncate font-bold">
                    ربط تلقائي بالعائلة: «{effectivePreviewPerson.name}» (
                    {agencies.find((a) => a.id === effectivePreviewPerson.agencyId)?.name ||
                      'وكالة'}
                    )
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>
                    اكتب اسم المستفيد داخل الملاحظة أو اختره يدوياً للربط التلقائي:
                  </span>
                )}
              </div>

              <select
                aria-label="تخصيص المستفيد المرتبط بالملاحظة"
                value={
                  manualOverridePersonId === null
                    ? ''
                    : effectivePreviewPerson?.id ?? ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setManualOverridePersonId(val ? Number(val) : null);
                }}
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="">بدون ربط بعائلة</option>
                {persons.slice(0, 80).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={syncOnSave}
                  onChange={(e) => setSyncOnSave(e.target.checked)}
                />
                <span>تثبيت الملاحظة في خانة ملاحظات العائلة تلقائياً عند الحفظ</span>
              </label>

              <button
                type="submit"
                disabled={!noteInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Plus className="h-4 w-4" />
                <span>حفظ الملاحظة السريعة</span>
              </button>
            </div>
          </form>

          {/* Saved Quick Notes Feed */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold">
              الملاحظات المحفوظة ({quickNotes.length})
            </div>
            {quickNotes.length === 0 ? (
              <div
                className="rounded-xl border px-4 py-6 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                لا توجد ملاحظات سريعة بعد. جرّب كتابة اسم مستفيد مع ملاحظة وسيتم الربط آلياً.
              </div>
            ) : (
              quickNotes.map((note) => {
                const matchedPerson = note.linkedPersonId
                  ? persons.find((p) => p.id === note.linkedPersonId)
                  : undefined;
                return (
                  <article
                    key={note.id}
                    className="rounded-xl border p-3.5 text-xs space-y-2"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="font-semibold leading-relaxed">
                        {note.text}
                      </div>
                      <span
                        className="text-[11px] tabular-nums shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {note.source === 'voice' ? 'إملاء صوتي · ' : 'نص · '}
                        {new Date(note.createdAt).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {matchedPerson ? (
                          <button
                            type="button"
                            onClick={() => onJumpToPerson(matchedPerson)}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-bold whitespace-nowrap"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--accent)',
                              color: 'var(--accent)',
                            }}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>
                              مرتبطة بـ: {matchedPerson.name}
                              {note.linkedAgencyName ? ` (${note.linkedAgencyName})` : ''}
                            </span>
                          </button>
                        ) : (
                          <select
                            aria-label="ربط الملاحظة بمستفيد"
                            value=""
                            onChange={(e) =>
                              onUpdateQuickNoteLink(
                                note.id,
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="rounded-lg border px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <option value="">ربط بمستفيد يدوياً...</option>
                            {persons.slice(0, 80).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}

                        {matchedPerson && !note.syncedToPersonNotes && (
                          <button
                            type="button"
                            onClick={() => onSyncQuickNoteToPerson(note.id)}
                            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold whitespace-nowrap"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--success)',
                              color: 'var(--success)',
                            }}
                          >
                            <Check className="h-3 w-3" />
                            <span>تثبيت في سجل العائلة</span>
                          </button>
                        )}

                        {note.syncedToPersonNotes && (
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: 'var(--success)' }}
                          >
                            مُزامنة مع سجل العائلة
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteQuickNote(note.id)}
                        aria-label="حذف الملاحظة السريعة"
                        className="rounded-lg border p-1.5"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--danger)',
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}
    </main>
  );
};
