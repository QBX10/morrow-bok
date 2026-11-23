import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  Bot,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Cpu,
  Download,
  FolderKanban,
  History,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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
import type { Agency, AppView, Person, SettingsSectionId } from '../types/agency.ts';
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
import { normalizeArabic } from '../utils/agencyLogic.ts';
import { getEngineDisplayMeta } from '../utils/morrowRouter.ts';
import { autoLinkQuickNoteToPerson } from '../utils/quickNotesMatcher.ts';
import { BottomSheet } from './cosmos/BottomSheet';
import { ResultCard } from './cosmos/ResultCard';

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
  // New Cosmos enhancements (optional for full backward compatibility)
  activeAgencyId?: number | null;
  onSelectActiveAgency?: (agencyId: number) => void;
  activePeriodLabel?: string;
  onNavigateView?: (view: AppView, section?: SettingsSectionId) => void;
  onTogglePinMessage?: (msgId: string) => void;
  onExportChatHistory?: () => void;
}

const BRAIN_BUTTONS: Array<{
  id: AssistantBrainMode;
  label: string;
  shortLabel: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'auto',
    label: 'تلقائي (تصعيد ذكي)',
    shortLabel: 'تلقائي ذكي',
    desc: 'يبدأ بـ Morrow المحلي ثم 2.5 Flash ثم 2.5 Pro عند الحاجة.',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    id: 'local',
    label: 'Morrow المحلي',
    shortLabel: 'محلي 100%',
    desc: 'استجابة فورية بدون إنترنت للبحث والحسابات والتشخيص.',
    icon: <Cpu className="h-4 w-4" />,
  },
  {
    id: 'gemini_2_5_flash',
    label: 'Gemini 2.5 Flash',
    shortLabel: '2.5 Flash',
    desc: 'المهام اللغوية السريعة والصياغة اليومية.',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: 'gemini_2_5_pro',
    label: 'Gemini 2.5 Pro',
    shortLabel: '2.5 Pro',
    desc: 'التحليل الاستراتيجي والتقارير العميقة.',
    icon: <Sparkles className="h-4 w-4" />,
  },
];

const COMMAND_LIBRARY_ITEMS = [
  { id: 'cmd_fee_250', label: 'خلّي رسم الفرد 250', desc: 'تحديث رسم الفرد التلقائي مع مقارنة قبل ← بعد' },
  { id: 'cmd_stats', label: 'احصائيات جميع الوكالات', desc: 'الأفراد والأكياس وصافي الأرباح بصرياً' },
  { id: 'cmd_diag', label: 'افحص التطبيق', desc: 'تحليل شامل للأخطاء والمكررين والنسخ الاحتياطي' },
  { id: 'cmd_dups', label: 'المكررين', desc: 'كشف السجلات المتطابقة أو المتشابهة' },
  { id: 'cmd_blocked', label: 'اعرض المحجوبين', desc: 'فلترة صامتة للجدول على المحجوبين فقط' },
  { id: 'cmd_excel', label: 'صدر تقرير اكسل', desc: 'تصدير معزول للقراءة فقط بصيغة RTL' },
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
  activeAgencyId,
  onSelectActiveAgency,
  activePeriodLabel,
  onNavigateView,
  onTogglePinMessage,
  onExportChatHistory,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [brainSheetOpen, setBrainSheetOpen] = useState(false);
  const [librarySheetOpen, setLibrarySheetOpen] = useState(false);
  const [contextSheetOpen, setContextSheetOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const [customMemoryInput, setCustomMemoryInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteSource, setNoteSource] = useState<'text' | 'voice'>('text');
  const [syncOnSave, setSyncOnSave] = useState(true);
  const [manualOverridePersonId, setManualOverridePersonId] = useState<number | null | undefined>(
    undefined
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isChatRecording, setIsChatRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [chatInput]);

  const activeBrain = useMemo(
    () => BRAIN_BUTTONS.find((b) => b.id === brainMode) || BRAIN_BUTTONS[0],
    [brainMode]
  );

  const activeAgency = useMemo(
    () => agencies.find((a) => a.id === activeAgencyId) || agencies[0],
    [agencies, activeAgencyId]
  );

  const filteredMessages = useMemo(() => {
    const q = normalizeArabic(historySearch.trim());
    return messages.filter((m) => {
      if (showPinnedOnly && !m.isPinned) return false;
      if (!q) return true;
      return normalizeArabic(m.text).includes(q);
    });
  }, [messages, historySearch, showPinnedOnly]);

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

  const toggleVoiceDictation = (target: 'note' | 'chat') => {
    setVoiceError(null);
    if ((isRecording || isChatRecording) && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setIsChatRecording(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError('الإملاء الصوتي غير مدعوم في هذا المتصفح، يمكنك الكتابة نصياً.');
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
          if (target === 'chat') {
            setChatInput(combined);
          } else {
            setNoteInput(combined);
            setNoteSource('voice');
          }
        }
      };
      rec.onerror = () => {
        setIsRecording(false);
        setIsChatRecording(false);
        setVoiceError('تعذر التقاط الصوت. تأكد من صلاحية الميكروفون أو اكتب نصياً.');
      };
      rec.onend = () => {
        setIsRecording(false);
        setIsChatRecording(false);
      };
      recognitionRef.current = rec;
      if (target === 'chat') setIsChatRecording(true);
      else setIsRecording(true);
      rec.start();
    } catch {
      setIsRecording(false);
      setIsChatRecording(false);
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

  const handleCopyMessage = (msgId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {});
      setCopiedMsgId(msgId);
      window.setTimeout(() => setCopiedMsgId(null), 1800);
    }
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

  const submitChatPrompt = () => {
    if (!chatInput.trim() || isThinking) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  return (
    <main
      data-testid="morrow-command-center"
      className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-3.5 pb-28 sm:p-6 sm:pb-24"
    >
      {/* Slim Glass Header + Editable Context Chips */}
      <header className="cosmos-glass-panel border p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
                color: 'var(--accent)',
              }}
            >
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold sm:text-xl">مركز Morrow الذكي</h1>
                <span
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: connectivity === 'online' ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {connectivity === 'online' ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  <span>
                    {connectivity === 'online'
                      ? 'متصل'
                      : connectivity === 'quota_exhausted'
                      ? 'حصة مؤقتة'
                      : 'محلي'}
                  </span>
                </span>
              </div>
              <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {activeBrain.label} — مسودات الموافقة وسجل العمليات والملاحظات الصوتية
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Editable Context Chips */}
            <button
              type="button"
              onClick={() => setContextSheetOpen(true)}
              className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <FolderKanban className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>{activeAgency?.name || 'الوكالة'}</span>
            </button>

            {activePeriodLabel && (
              <button
                type="button"
                onClick={() => onNavigateView?.('data_archives')}
                className="cosmos-touch-target hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>{activePeriodLabel}</span>
              </button>
            )}

            {hasUndoableAction && (
              <button
                type="button"
                onClick={() => onUndoLastAction()}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--warning)',
                  color: 'var(--warning)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>تراجع</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Segmented Workspace Tabs */}
        <nav
          aria-label="تبويبات مركز Morrow"
          className="flex flex-wrap items-center gap-1.5 rounded-2xl border p-1.5"
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
                className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-all"
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

      {/* Thin Dismissible Alert Strip for Pending Drafts */}
      {!bannerDismissed && pendingDrafts.length > 0 && activeTab !== 'approvals' && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-xs"
          style={{
            backgroundColor: 'var(--warning-bg)',
            borderColor: 'var(--warning)',
          }}
        >
          <button
            type="button"
            onClick={() => onChangeTab('approvals')}
            className="flex items-center gap-2 font-bold text-right hover:underline"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} />
            <span>لديك {pendingDrafts.length} مسودة تعديل تنتظر موافقتك — اضغط للمراجعة</span>
          </button>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="إخفاء التنبيه"
            className="rounded-lg p-1 hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: المحادثة (Chat) */}
      {activeTab === 'chat' && (
        <section
          aria-label="محادثة Morrow الذكية"
          className="cosmos-glass-panel border overflow-hidden flex flex-col"
          style={{ minHeight: '62vh' }}
        >
          {/* Searchable History & Quick Export Bar */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex flex-1 items-center gap-2 min-w-[200px]">
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="بحث في سجل المحادثات..."
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowPinnedOnly((v) => !v)}
                className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold"
                style={{
                  backgroundColor: showPinnedOnly ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                  borderColor: showPinnedOnly ? 'var(--accent)' : 'var(--border-color)',
                  color: showPinnedOnly ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Pin className="h-3 w-3" />
                <span>المثبتة</span>
              </button>

              {onExportChatHistory && (
                <button
                  type="button"
                  onClick={onExportChatHistory}
                  className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Download className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                  <span>تصدير السجل</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5 text-sm">
            {filteredMessages.length === 0 ? (
              <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                لا توجد رسائل مطابقة للفلتر الحالي.
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isUser = msg.role === 'user';
                const meta = getEngineDisplayMeta(msg.engineUsed);
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1.5 ${isUser ? 'items-start' : 'items-stretch'}`}
                  >
                    <div
                      className="rounded-[20px] border px-4 py-3 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line shadow-sm"
                      style={{
                        backgroundColor: isUser ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                        borderColor: isUser ? 'var(--accent)' : 'var(--border-color)',
                        maxWidth: isUser ? '84%' : '100%',
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

                          <div className="flex items-center gap-1.5">
                            <span className="tabular-nums text-[10px]">
                              {msg.modelId || meta.modelId}
                              {typeof msg.confidence === 'number'
                                ? ` · ثقة ${Math.round(msg.confidence * 100)}%`
                                : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.text)}
                              title="نسخ الرد"
                              className="rounded-lg p-1 hover:opacity-75"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            {onTogglePinMessage && (
                              <button
                                type="button"
                                onClick={() => onTogglePinMessage(msg.id)}
                                title={msg.isPinned ? 'إلغاء التثبيت' : 'تثبيت الرسالة'}
                                className="rounded-lg p-1 hover:opacity-75"
                                style={{
                                  color: msg.isPinned ? 'var(--accent)' : 'var(--text-muted)',
                                }}
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onSendMessage(`أعد صياغة هذه النتيجة بأسلوب مختصر ورسمي:\n${msg.text.slice(0, 180)}`)
                              }
                              title="أعد الصياغة"
                              className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold hover:border-[var(--accent)]"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>أعد الصياغة</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div>{msg.text}</div>

                      {msg.resultCard && (
                        <div className="mt-3">
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
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap"
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
                              className="rounded-xl border px-3 py-1.5 text-right text-xs font-bold whitespace-nowrap transition-colors hover:opacity-90"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor:
                                  ch.tone === 'warning' ? 'var(--warning)' : 'var(--accent)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {ch.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {msg.diagnosticsReport && msg.diagnosticsReport.issues.length > 0 && (
                        <div
                          className="mt-3 space-y-2 border-t pt-3 text-xs"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          {msg.diagnosticsReport.issues.slice(0, 6).map((issue) => (
                            <div
                              key={issue.id}
                              className="rounded-xl border px-3 py-2"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
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
                              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold"
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
                          <div className="font-extrabold" style={{ color: 'var(--accent)' }}>
                            {msg.confirmationDiff.title}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {msg.confirmationDiff.changes.map((c, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl border px-3 py-2"
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  borderColor: 'var(--border-color)',
                                }}
                              >
                                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                  {c.fieldLabel}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-bold">
                                  <span className="line-through opacity-75">{c.beforeValue}</span>
                                  <span style={{ color: 'var(--accent)' }}>←</span>
                                  <span style={{ color: 'var(--success)' }}>{c.afterValue}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {msg.confirmationDiff.status === 'pending' ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => onResolveDiff(msg.id, true)}
                                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap"
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
                                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold whitespace-nowrap"
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
              })
            )}

            {isThinking && (
              <div
                className="rounded-2xl border px-4 py-3 text-xs font-semibold"
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

          {/* Single Horizontal Quick Commands Strip + '+' Command Library */}
          <div
            className="flex items-center gap-2 overflow-x-auto border-t px-4 py-2"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setLibrarySheetOpen(true)}
              title="مكتبة الأوامر السريعة"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-extrabold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
            {smartSuggestions.map((sug) => (
              <button
                key={sug.id}
                type="button"
                onClick={() => onSendMessage(sug.prompt)}
                className="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap hover:border-[var(--accent)]"
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

          {/* Composer with Brain Picker Pill + Iraqi Voice + Quick Extract Shortcut */}
          <div
            className="border-t p-3.5 space-y-2"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setBrainSheetOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {activeBrain.icon}
                <span>الدماغ: {activeBrain.shortLabel}</span>
              </button>

              {onNavigateView && (
                <button
                  type="button"
                  onClick={() => onNavigateView('quick_extract')}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 font-bold hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Camera className="h-3.5 w-3.5" style={{ color: '#0ea5e9' }} />
                  <span>فتح السحب الذكي (كاميرا / PDF)</span>
                </button>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitChatPrompt();
              }}
              className="flex items-end gap-2"
            >
              <button
                type="button"
                onClick={() => toggleVoiceDictation('chat')}
                title="إملاء صوتي باللهجة العراقية"
                aria-label="إملاء صوتي"
                className="cosmos-touch-target inline-flex shrink-0 items-center justify-center rounded-xl border px-3"
                style={{
                  backgroundColor: isChatRecording ? 'var(--danger)' : 'var(--bg-surface)',
                  borderColor: isChatRecording ? 'var(--danger)' : 'var(--border-color)',
                  color: isChatRecording ? '#fff' : 'var(--text-primary)',
                }}
              >
                {isChatRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <textarea
                ref={chatTextareaRef}
                rows={1}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitChatPrompt();
                  }
                }}
                placeholder="اكتب أمرك باللهجة العراقية (مثال: خلّي رسم الفرد 250، الرقم غريب، اعرض المحجوبين)..."
                className="min-w-0 flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <button
                type="submit"
                disabled={!chatInput.trim() || isThinking}
                className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold whitespace-nowrap shrink-0 disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Send className="h-4 w-4" />
                <span>إرسال</span>
              </button>
            </form>
          </div>
        </section>
      )}

      {/* TAB 2: المهام والمراجعة (Approvals Draft Queue) */}
      {activeTab === 'approvals' && (
        <section
          aria-label="طابور المهام والمراجعة"
          data-testid="morrow-approvals-panel"
          className="space-y-5"
        >
          <div className="cosmos-glass-panel border p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold">
                  مسودات بانتظار موافقتك ({pendingDrafts.length})
                </h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  لا يعدّل المساعد أي سجل أو مصروف أو معادلة حاسبة بشكل مباشر — كل عملية تصل هنا للمراجعة أولاً وتُنفذ فقط بعد موافقتك.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSendMessage('صلح مشاكل الفحص تلقائياً')}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap"
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
                className="rounded-2xl border px-4 py-8 text-center text-xs space-y-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <ClipboardCheck className="mx-auto h-7 w-7 opacity-60" />
                <div className="font-bold">لا توجد مسودات معلقة حالياً</div>
                <div>
                  عند طلب إضافة أو تعديل أو تغيير رسم الفرد، ستظهر المسودة هنا جاهزة للتدقيق والتنفيذ.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDrafts.map((draft) => (
                  <article
                    key={draft.id}
                    className="rounded-2xl border p-4 space-y-3"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--accent)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold">{draft.diff.title}</h3>
                        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
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
                          className="rounded-xl border px-3 py-2 text-xs"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {c.fieldLabel}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-bold">
                            <span className="line-through opacity-75">{c.beforeValue}</span>
                            <span style={{ color: 'var(--accent)' }}>←</span>
                            <span style={{ color: 'var(--success)' }}>{c.afterValue}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        data-testid={`approve-draft-${draft.id}`}
                        onClick={() => onApproveDraft(draft.id)}
                        className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--success)',
                          color: 'var(--success-fg)',
                        }}
                      >
                        <Check className="h-4 w-4" />
                        <span>موافق وتنفيذ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectDraft(draft.id)}
                        className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold whitespace-nowrap"
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
            <div className="cosmos-glass-panel border p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold">
                <History className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                <span>سجل المسودات المنفذة / الملغاة ({resolvedDrafts.length})</span>
              </div>
              <div className="space-y-2">
                {resolvedDrafts.slice(0, 8).map((draft) => (
                  <div
                    key={draft.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
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
                        color: draft.status === 'approved' ? 'var(--success)' : 'var(--text-muted)',
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
          className="cosmos-glass-panel border p-4 sm:p-5 space-y-5"
        >
          <div>
            <h2 className="text-base font-extrabold">الذاكرة والقواعد الدائمة</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              القواعد المحفوظة هنا تُطبّق تلقائياً على جميع صادرات PDF وExcel عبر التطبيق دون الحاجة لتكرار التعليمات.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {MEMORY_PRESETS.map((preset) => {
              const enabled = preferences.some(
                (p) => p.key === preset.key && String(p.value) !== 'false'
              );
              return (
                <div
                  key={preset.key}
                  className="flex flex-col justify-between gap-3 rounded-2xl border p-4 text-xs"
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
                    className="cosmos-touch-target inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-bold whitespace-nowrap"
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customMemoryInput.trim()) return;
              onSaveMemoryRule(customMemoryInput.trim());
              setCustomMemoryInput('');
            }}
            className="flex flex-wrap items-center gap-2 rounded-2xl border p-3"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <input
              type="text"
              value={customMemoryInput}
              onChange={(e) => setCustomMemoryInput(e.target.value)}
              placeholder="أضف قاعدة جديدة في الذاكرة (مثال: دائماً أخفي الملاحظات في التقرير)..."
              className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-xs sm:text-sm"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="submit"
              disabled={!customMemoryInput.trim()}
              className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-45"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Plus className="h-4 w-4" />
              <span>حفظ بالذاكرة</span>
            </button>
          </form>

          <div className="space-y-2">
            <div className="text-xs font-bold">القواعد النشطة ({preferences.length})</div>
            {preferences.length === 0 ? (
              <div
                className="rounded-2xl border px-4 py-6 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                لم تقم بتفعيل أي قاعدة ذاكرة دائمة حتى الآن.
              </div>
            ) : (
              preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div>
                    <div className="font-bold">{pref.label}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      أُضيفت بتاريخ {pref.createdAt}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMemoryRule(pref.id)}
                    aria-label={`حذف قاعدة ${pref.label}`}
                    className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 font-bold"
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
          className="cosmos-glass-panel border p-4 sm:p-5 space-y-5"
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
              onClick={() => toggleVoiceDictation('note')}
              className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
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
                  <span>{speechSupported ? 'إملاء صوتي عربي' : 'إدخال صوتي'}</span>
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
            className="rounded-2xl border p-4 space-y-3"
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

            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: effectivePreviewPerson ? 'var(--accent)' : 'var(--border-color)',
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
                  manualOverridePersonId === null ? '' : effectivePreviewPerson?.id ?? ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setManualOverridePersonId(val ? Number(val) : null);
                }}
                className="rounded-xl border px-2.5 py-1.5 text-xs font-semibold"
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
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-45"
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

          <div className="space-y-2.5">
            <div className="text-xs font-bold">الملاحظات المحفوظة ({quickNotes.length})</div>
            {quickNotes.length === 0 ? (
              <div
                className="rounded-2xl border px-4 py-6 text-center text-xs"
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
                    className="rounded-2xl border p-3.5 text-xs space-y-2"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="font-semibold leading-relaxed">{note.text}</div>
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
                            className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 font-bold whitespace-nowrap"
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
                            className="rounded-xl border px-2 py-1 text-[11px]"
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
                            className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 font-bold whitespace-nowrap"
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
                          <span className="text-[11px] font-bold" style={{ color: 'var(--success)' }}>
                            مُزامنة مع سجل العائلة
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteQuickNote(note.id)}
                        aria-label="حذف الملاحظة السريعة"
                        className="rounded-xl border p-1.5"
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

      {/* Brain Picker BottomSheet */}
      <BottomSheet
        open={brainSheetOpen}
        onClose={() => setBrainSheetOpen(false)}
        title="اختيار دماغ المعالجة"
        subtitle="بدّل بين المعالجة المحلية الصامتة ونماذج Gemini السحابية"
        icon={<Cpu className="h-5 w-5" />}
      >
        <div className="space-y-2.5">
          {BRAIN_BUTTONS.map((btn) => {
            const active = brainMode === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => {
                  onChangeBrainMode(btn.id);
                  setBrainSheetOpen(false);
                }}
                className="flex w-full items-start justify-between gap-3 rounded-2xl border p-4 text-right transition-all"
                style={{
                  backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-extrabold">
                    {btn.icon}
                    <span>{btn.label}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {btn.desc}
                  </p>
                </div>
                {active && (
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Command Library BottomSheet */}
      <BottomSheet
        open={librarySheetOpen}
        onClose={() => setLibrarySheetOpen(false)}
        title="مكتبة أوامر Morrow الكاملة"
        subtitle="اضغط على أي أمر لإرساله إلى غرفة المحادثة مباشرة"
        icon={<Sparkles className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {COMMAND_LIBRARY_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setLibrarySheetOpen(false);
                onSendMessage(item.label);
              }}
              className="rounded-2xl border p-3.5 text-right transition-all hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="text-xs font-extrabold">{item.label}</div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {item.desc}
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Active Agency Context Picker BottomSheet */}
      <BottomSheet
        open={contextSheetOpen}
        onClose={() => setContextSheetOpen(false)}
        title="تغيير سياق الوكالة النشطة للمساعد"
        subtitle="الوكالة التي يركّز عليها المساعد عند تنفيذ الفلترة والإضافة"
        icon={<FolderKanban className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {agencies.map((ag) => {
            const active = activeAgency?.id === ag.id;
            return (
              <button
                key={ag.id}
                type="button"
                onClick={() => {
                  onSelectActiveAgency?.(ag.id);
                  setContextSheetOpen(false);
                }}
                className="flex items-center justify-between gap-2 rounded-2xl border p-3.5 text-right transition-all"
                style={{
                  backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <span className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                  <span>{ag.icon}</span>
                  <span>{ag.name}</span>
                </span>
                {active && (
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </main>
  );
};
