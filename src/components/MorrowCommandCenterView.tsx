import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
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
  FileSearch,
  FileText,
  FolderKanban,
  History,
  Image as ImageIcon,
  LayoutPanelLeft,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  Paperclip,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  UserCheck,
  Volume2,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type {
  Agency,
  AgencyExpense,
  AppDatabaseState,
  AppView,
  CalculationSettings,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
  SettingsSectionId,
} from '../types/agency.ts';
import type {
  AssistantApprovalDraft,
  AssistantBrainMode,
  AssistantChoiceChip,
  AssistantConnectivityState,
  AssistantEngineSource,
  AssistantMessage,
  AssistantQuickNote,
  AssistantSmartSuggestion,
  AssistantToolCall,
  AssistantUserPref,
  MorrowCanvasMode,
  MorrowCenterTab,
  MorrowMacroDefinition,
  MorrowMacroExecutionResult,
  MorrowProactiveInsight,
  MorrowSystemVerificationReport,
} from '../types/assistant.ts';
import { DEFAULT_CALCULATION_SETTINGS, normalizeArabic } from '../utils/agencyLogic.ts';
import type { MaskedCloudContext } from '../utils/assistantPrivacy.ts';
import {
  buildPermissionRecoveryGuide,
  requestMicrophonePermission,
  type MediaPermissionGuide,
} from '../utils/mediaPermissions.ts';
import { getEngineDisplayMeta } from '../utils/morrowRouter.ts';
import {
  computeProactiveInsightsAndForecasts,
  decideSummonOrNavigate,
  executeMorrowMacro,
  findMatchingMacroByPrompt,
  loadUserMacros,
  saveUserMacros,
} from '../utils/morrowWorkspaceEngine.ts';
import { autoLinkQuickNoteToPerson } from '../utils/quickNotesMatcher.ts';
import { ResultCard } from './cosmos/ResultCard';
import { DynamicWorkspaceCanvas } from './morrow/DynamicWorkspaceCanvas';
import { MorrowCameraSnapModal } from './morrow/MorrowCameraSnapModal';
import { MorrowLiveSessionModal } from './morrow/MorrowLiveSessionModal';
import { PermissionGuardModal } from './permissions/PermissionGuardModal';

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
  // Full-Screen Studio & Workspace 2.0 extensions
  onBackToApp?: () => void;
  backLabel?: string;
  activeAgencyId?: number | null;
  onSelectActiveAgency?: (agencyId: number) => void;
  activePeriodLabel?: string;
  onNavigateView?: (view: AppView, section?: SettingsSectionId) => void;
  onTogglePinMessage?: (msgId: string) => void;
  onExportChatHistory?: () => void;
  expenses?: AgencyExpense[];
  monthlyArchives?: MonthlyArchiveRecord[];
  activePeriod?: PeriodQuotaMeta;
  calculationSettings?: CalculationSettings;
  lastBackupAt?: string | null;
  cloudConfigured?: boolean;
  onStageToolDrafts?: (tools: AssistantToolCall[], sourceLabel: string) => number;
  onOpenAgencyRoster?: (agencyId: number) => void;
  initialCanvasMode?: { mode: MorrowCanvasMode; nonce: number } | null;
  onHandoffFilesToQuickExtract?: (files: File[]) => void;
  liveCloudContext?: MaskedCloudContext;
  onLiveToolAction?: (toolCall: AssistantToolCall) => string | void;
  onVerifySystemIntegrity?: () => Promise<MorrowSystemVerificationReport>;
}

interface AttachedDocumentItem {
  id: string;
  file: File;
  name: string;
  mimeType: string;
  previewUrl?: string;
  dataBase64: string;
}

interface MultimodalFeedEntry {
  id: string;
  createdAt: string;
  kind: 'voice_note' | 'file_analysis' | 'live_summary';
  title: string;
  body: string;
  audioUrl?: string;
  durationSec?: number;
  file?: File;
  previewUrl?: string;
  looksLikeRosterTable?: boolean;
  suggestedTools?: AssistantToolCall[];
  errorText?: string;
}

const SLASH_COMMAND_OPTIONS: Array<{
  id: string;
  cmd: string;
  label: string;
  desc: string;
  canvasMode?: MorrowCanvasMode;
  prompt?: string;
  runVerifier?: boolean;
}> = [
  { id: 'sl_stats', cmd: '/احصائيات', label: 'اللوحة التفاعلية والرسوم', desc: 'الأفراد والأكياس وصافي الأرباح الحية', canvasMode: 'overview_charts' },
  { id: 'sl_edit', cmd: '/جدول', label: 'تعديل الأسماء مباشرة', desc: 'تحديث الأفراد والحظر مع بوابة الموافقة', canvasMode: 'editable_table' },
  { id: 'sl_forecast', cmd: '/توقع', label: 'توقعات الشهر القادم', desc: 'استشراف الاحتياج بناءً على الأرشيف', canvasMode: 'forecast' },
  { id: 'sl_report', cmd: '/تقرير', label: 'تقرير تنفيذي شامل', desc: 'ملخص قيادي موحّد لكل الوكالات', canvasMode: 'executive_report' },
  { id: 'sl_wa', cmd: '/تحليل', label: 'تحليل نص واتساب', desc: 'تحويل رسائل المندوبين لأسماء ومسودات', canvasMode: 'text_analysis' },
  { id: 'sl_diag', cmd: '/فحص', label: 'فحص التطبيق الشامل', desc: 'كشف المكررين والنواقص وسلامة الجداول', prompt: 'افحص التطبيق' },
  { id: 'sl_close', cmd: '/اغلاق', label: 'ماكرو إغلاق الشهر', desc: 'مطابقة وتدقيق وتحضير التقرير والنسخة', prompt: 'إغلاق الشهر' },
  { id: 'sl_verify', cmd: '/تكامل', label: 'فحص ارتباط Morrow', desc: 'اختبار اتصال النماذج السحابية والمحلية ولايف', runVerifier: true },
];

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
  { id: 'cmd_close_month', label: 'إغلاق الشهر', desc: 'تشغيل ماكرو إغلاق الشهر والمطابقة والتدقيق' },
  { id: 'cmd_stats', label: 'احصائيات جميع الوكالات', desc: 'الأفراد والأكياس وصافي الأرباح بصرياً' },
  { id: 'cmd_diag', label: 'افحص التطبيق', desc: 'تحليل شامل للأخطاء والمكررين والنسخ الاحتياطي' },
  { id: 'cmd_fee_250', label: 'خلّي رسم الفرد 250', desc: 'تحديث رسم الفرد التلقائي مع مقارنة قبل ← بعد' },
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

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || '');
      const idx = str.indexOf(',');
      resolve(idx >= 0 ? str.slice(idx + 1) : str);
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف المرفق.'));
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || '');
      const idx = str.indexOf(',');
      resolve(idx >= 0 ? str.slice(idx + 1) : str);
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الصوت المسجل.'));
    reader.readAsDataURL(blob);
  });
}

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
  onBackToApp,
  backLabel = 'العودة للتطبيق',
  activeAgencyId,
  onSelectActiveAgency,
  activePeriodLabel,
  onNavigateView,
  onTogglePinMessage,
  onExportChatHistory,
  expenses = [],
  monthlyArchives = [],
  activePeriod,
  calculationSettings = DEFAULT_CALCULATION_SETTINGS,
  lastBackupAt,
  cloudConfigured,
  onStageToolDrafts,
  onOpenAgencyRoster,
  initialCanvasMode,
  onHandoffFilesToQuickExtract,
  liveCloudContext,
  onLiveToolAction,
  onVerifySystemIntegrity,
}) => {
  // Side Drawer for secondary features (Memory, Approvals, Notes, Canvas 2.0, Brain, Commands)
  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
  const [canvasOverlayActive, setCanvasOverlayActive] = useState(false);
  const [canvasMode, setCanvasMode] = useState<MorrowCanvasMode>(
    initialCanvasMode?.mode || 'overview_charts'
  );
  const [macros, setMacros] = useState<MorrowMacroDefinition[]>(() => loadUserMacros());
  const [lastMacroResult, setLastMacroResult] = useState<MorrowMacroExecutionResult | null>(null);
  const [summonNotice, setSummonNotice] = useState<string | null>(null);

  // Core Triad States: (1) Chat + Voice Messages, (2) Live Modal, (3) Files + Camera
  const [chatInput, setChatInput] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedDocumentItem | null>(null);
  const [analyzingAttachment, setAnalyzingAttachment] = useState(false);
  const [multimodalFeed, setMultimodalFeed] = useState<MultimodalFeedEntry[]>([]);

  // Real System Integrity Verifier State
  const [verificationReport, setVerificationReport] =
    useState<MorrowSystemVerificationReport | null>(null);
  const [verifyingSystem, setVerifyingSystem] = useState(false);

  // Voice Message Recording + Speech Recognition
  const [isRecordingVoiceMsg, setIsRecordingVoiceMsg] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const liveSpeechTranscriptRef = useRef<string>('');

  // Quick Notes / Memory local inputs
  const [customMemoryInput, setCustomMemoryInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteSource, setNoteSource] = useState<'text' | 'voice'>('text');
  const [syncOnSave, setSyncOnSave] = useState(true);
  const [manualOverridePersonId, setManualOverridePersonId] = useState<number | null | undefined>(
    undefined
  );
  const [isNoteRecording, setIsNoteRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micPermissionGuide, setMicPermissionGuide] = useState<MediaPermissionGuide | null>(null);
  const [checkingMicPermission, setCheckingMicPermission] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!initialCanvasMode) return;
    setCanvasMode(initialCanvasMode.mode);
    setCanvasOverlayActive(true);
  }, [initialCanvasMode]);

  useEffect(() => {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [chatInput]);

  useEffect(() => {
    if (activeTab !== 'chat' || canvasOverlayActive) return;
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, multimodalFeed.length, isThinking, activeTab, canvasOverlayActive]);

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (attachedFile?.previewUrl) {
        URL.revokeObjectURL(attachedFile.previewUrl);
      }
    };
  }, [attachedFile]);

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

  const proactiveBundle = useMemo(() => {
    const syntheticState = {
      agencies,
      persons,
      expenses,
      calculationSettings,
      readyLists: [],
      readyListItems: [],
      relations: [],
      monthlyArchives,
    } as unknown as AppDatabaseState;
    return computeProactiveInsightsAndForecasts({
      state: syntheticState,
      monthlyArchives,
      activePeriod,
      lastBackupAt,
    });
  }, [agencies, persons, expenses, calculationSettings, monthlyArchives, activePeriod, lastBackupAt]);

  const sideFeatureBadgeCount = pendingDrafts.length;

  const filteredSlashCommands = useMemo(() => {
    if (!chatInput.startsWith('/')) return [];
    const q = normalizeArabic(chatInput.slice(1).trim());
    if (!q) return SLASH_COMMAND_OPTIONS;
    return SLASH_COMMAND_OPTIONS.filter(
      (item) =>
        normalizeArabic(item.cmd).includes(q) ||
        normalizeArabic(item.label).includes(q) ||
        normalizeArabic(item.desc).includes(q)
    );
  }, [chatInput]);

  const handleRunSystemVerifier = async () => {
    if (!onVerifySystemIntegrity || verifyingSystem) return;
    setVerifyingSystem(true);
    try {
      const report = await onVerifySystemIntegrity();
      setVerificationReport(report);
    } finally {
      setVerifyingSystem(false);
    }
  };

  const stopAllReadAloud = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  const handleSpeakMessage = async (msgId: string, rawText: string) => {
    if (speakingMsgId === msgId) {
      stopAllReadAloud();
      return;
    }
    stopAllReadAloud();
    const cleanText = rawText.trim().slice(0, 900);
    if (!cleanText) return;
    setSpeakingMsgId(msgId);

    try {
      const res = await fetch('/api/ucrs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });
      if (res.ok) {
        const json = (await res.json()) as { audioBase64?: string; mimeType?: string };
        if (json.audioBase64) {
          const audio = new Audio(
            `data:${json.mimeType || 'audio/wav'};base64,${json.audioBase64}`
          );
          ttsAudioRef.current = audio;
          audio.onended = () => setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
          audio.onerror = () => setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
          await audio.play();
          return;
        }
      }
    } catch {
      // Fall back cleanly to browser Arabic speech synthesis
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = 'ar-IQ';
        utter.rate = 0.98;
        utter.onend = () => setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
        utter.onerror = () => setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
        window.speechSynthesis.speak(utter);
        return;
      } catch {
        // ignore
      }
    }
    setSpeakingMsgId(null);
  };

  const handleSaveMacros = (next: MorrowMacroDefinition[]) => {
    setMacros(next);
    saveUserMacros(next);
  };

  const handleExecuteMacro = (macro: MorrowMacroDefinition) => {
    const syntheticState = {
      agencies,
      persons,
      expenses,
      calculationSettings,
      readyLists: [],
      readyListItems: [],
      relations: [],
      monthlyArchives,
    } as unknown as AppDatabaseState;
    const res = executeMorrowMacro({
      macro,
      state: syntheticState,
      monthlyArchives,
      activePeriod,
      lastBackupAt,
    });
    setLastMacroResult(res);
    setCanvasMode('macro_studio');
    setCanvasOverlayActive(true);
    setSideDrawerOpen(false);
    setSummonNotice(`تم تشغيل ماكرو «${macro.name}» وعرض النتائج في اللوحة التفاعلية.`);
  };

  const handleProactiveInsightAction = (insight: MorrowProactiveInsight) => {
    setSideDrawerOpen(false);
    if (insight.resolutionMode === 'summon_canvas') {
      if (insight.targetCanvasMode) {
        setCanvasMode(insight.targetCanvasMode);
        setCanvasOverlayActive(true);
        onChangeTab('chat');
        setSummonNotice(`تم جلب «${insight.title}» داخل مساحة العمل التفاعلية.`);
      }
      if (insight.promptToRun) {
        onSendMessage(insight.promptToRun);
      }
      return;
    }

    if (insight.targetView && insight.targetId) {
      onTriggerSpotlight({
        view: insight.targetView,
        targetId: insight.targetId,
        title: insight.title,
        description: insight.detail,
      });
    } else if (insight.targetView && onNavigateView) {
      onNavigateView(insight.targetView);
    }
  };

  // --- Voice Message Recording (Chat Audio Message + Speech/Gemini Transcribe) ---
  const stopVoiceMessageRecording = async (shouldSend: boolean) => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    const durationSec = recordingSeconds;
    setIsRecordingVoiceMsg(false);
    setRecordingSeconds(0);

    if (!recorder || recorder.state === 'inactive') {
      voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceStreamRef.current = null;
    mediaRecorderRef.current = null;

    if (!shouldSend) {
      recordedChunksRef.current = [];
      liveSpeechTranscriptRef.current = '';
      return;
    }

    const mime = recorder.mimeType || 'audio/webm';
    const audioBlob = new Blob(recordedChunksRef.current, { type: mime });
    recordedChunksRef.current = [];
    const fallbackTranscript = liveSpeechTranscriptRef.current.trim();
    liveSpeechTranscriptRef.current = '';

    if (audioBlob.size < 400 && !fallbackTranscript) {
      setVoiceError('التسجيل قصير جداً أو لم يتم التقاط صوت واضح.');
      return;
    }

    const audioUrl = audioBlob.size > 0 ? URL.createObjectURL(audioBlob) : undefined;
    let finalTranscript = fallbackTranscript;

    setTranscribingVoice(true);
    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const res = await fetch('/api/morrow/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType: mime }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        transcript?: string;
        error?: string;
      };
      if (res.ok && json.ok && json.transcript) {
        finalTranscript = json.transcript.trim();
      } else if (!finalTranscript && json.error) {
        setVoiceError(json.error);
      }
    } catch {
      if (!finalTranscript) {
        setVoiceError('تعذر تفريغ التسجيل الصوتي عبر الخادم حالياً.');
      }
    } finally {
      setTranscribingVoice(false);
    }

    setMultimodalFeed((prev) => [
      ...prev.slice(-15),
      {
        id: `voice_${Date.now()}`,
        createdAt: new Date().toISOString(),
        kind: 'voice_note',
        title: 'رسالة صوتية مسجلة',
        body:
          finalTranscript ||
          'تم حفظ الرسالة الصوتية في المحادثة.',
        audioUrl,
        durationSec,
      },
    ]);

    if (finalTranscript) {
      submitChatPrompt(finalTranscript);
    }
  };

  const startVoiceMessageRecording = async () => {
    setVoiceError(null);
    if (isRecordingVoiceMsg) {
      await stopVoiceMessageRecording(true);
      return;
    }

    setCheckingMicPermission(true);
    const perm = await requestMicrophonePermission();
    setCheckingMicPermission(false);
    if (!perm.ok) {
      const guide = perm.guide || buildPermissionRecoveryGuide('microphone');
      setVoiceError(guide.reason);
      setMicPermissionGuide(guide);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      recordedChunksRef.current = [];
      liveSpeechTranscriptRef.current = '';

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };
      recorder.start();

      // Optional live Web Speech capture alongside audio recording as instant local fallback
      const w = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const SpeechCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SpeechCtor) {
        try {
          const rec = new SpeechCtor();
          rec.lang = 'ar-IQ';
          rec.interimResults = true;
          rec.continuous = true;
          rec.onresult = (ev) => {
            const parts: string[] = [];
            for (let i = 0; i < ev.results.length; i++) {
              parts.push(ev.results[i][0]?.transcript || '');
            }
            const txt = parts.join(' ').trim();
            if (txt) liveSpeechTranscriptRef.current = txt;
          };
          rec.onerror = () => {};
          rec.onend = () => {};
          recognitionRef.current = rec;
          rec.start();
        } catch {
          // Audio recording still continues seamlessly
        }
      }

      setRecordingSeconds(0);
      setIsRecordingVoiceMsg(true);
      voiceTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setVoiceError('تعذر بدء تسجيل الرسالة الصوتية.');
      setMicPermissionGuide(buildPermissionRecoveryGuide('microphone'));
    }
  };

  // Voice dictation for Quick Notes secondary tab
  const toggleNoteVoiceDictation = async () => {
    setVoiceError(null);
    if (isNoteRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsNoteRecording(false);
      return;
    }

    setCheckingMicPermission(true);
    const perm = await requestMicrophonePermission();
    setCheckingMicPermission(false);
    if (!perm.ok) {
      const guide = perm.guide || buildPermissionRecoveryGuide('microphone');
      setVoiceError(guide.reason);
      setMicPermissionGuide(guide);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      const msg = 'الإملاء الصوتي غير مدعوم في هذا المتصفح، يمكنك الكتابة نصياً.';
      setVoiceError(msg);
      setMicPermissionGuide(buildPermissionRecoveryGuide('microphone', msg));
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
        setIsNoteRecording(false);
      };
      rec.onend = () => {
        setIsNoteRecording(false);
      };
      recognitionRef.current = rec;
      setIsNoteRecording(true);
      rec.start();
    } catch {
      setIsNoteRecording(false);
      setVoiceError('تعذر بدء التسجيل الصوتي.');
    }
  };

  // --- File Upload & Camera Attachment Handling ---
  const handleQueueFile = async (file: File) => {
    if (attachedFile?.previewUrl) {
      URL.revokeObjectURL(attachedFile.previewUrl);
    }
    try {
      const dataBase64 = await readFileAsBase64(file);
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined;
      setAttachedFile({
        id: `att_${Date.now()}`,
        file,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        previewUrl,
        dataBase64,
      });
    } catch {
      setVoiceError('تعذر تجهيز الملف المرفق للقراءة.');
    }
  };

  const analyzeAttachedDocument = async (customQuestion?: string) => {
    if (!attachedFile || analyzingAttachment) return;
    const target = attachedFile;
    setAnalyzingAttachment(true);
    setAttachedFile(null);

    try {
      const res = await fetch('/api/morrow/multimodal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: target.name,
          mimeType: target.mimeType,
          dataBase64: target.dataBase64,
          prompt: customQuestion || '',
          agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
          liveWorkspace: liveCloudContext?.liveWorkspace,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        looksLikeRosterTable?: boolean;
        suggestedTools?: AssistantToolCall[];
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setMultimodalFeed((prev) => [
          ...prev.slice(-15),
          {
            id: `file_${Date.now()}`,
            createdAt: new Date().toISOString(),
            kind: 'file_analysis',
            title: target.name,
            body: '',
            file: target.file,
            previewUrl: target.previewUrl,
            looksLikeRosterTable: true,
            errorText:
              json.error ||
              'تعذر تحليل الملف سحابياً — يمكنك فتحه مباشرة في السحب الذكي المحلي.',
          },
        ]);
        return;
      }

      setMultimodalFeed((prev) => [
        ...prev.slice(-15),
        {
          id: `file_${Date.now()}`,
          createdAt: new Date().toISOString(),
          kind: 'file_analysis',
          title: target.name,
          body: json.reply || 'تمت قراءة الملف بنجاح.',
          file: target.file,
          previewUrl: target.previewUrl,
          looksLikeRosterTable: Boolean(json.looksLikeRosterTable),
          suggestedTools: Array.isArray(json.suggestedTools) ? json.suggestedTools : [],
        },
      ]);
    } catch {
      setMultimodalFeed((prev) => [
        ...prev.slice(-15),
        {
          id: `file_${Date.now()}`,
          createdAt: new Date().toISOString(),
          kind: 'file_analysis',
          title: target.name,
          body: '',
          file: target.file,
          previewUrl: target.previewUrl,
          looksLikeRosterTable: true,
          errorText: 'تعذر الوصول للخادم لتحليل الملف حالياً — يمكنك تمريره مباشرة للسحب الذكي.',
        },
      ]);
    } finally {
      setAnalyzingAttachment(false);
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

  const submitChatPrompt = (overridePrompt?: string) => {
    const clean = (overridePrompt ?? chatInput).trim();

    if (attachedFile && !overridePrompt) {
      if (chatInput.trim()) setChatInput('');
      void analyzeAttachedDocument(clean);
      return;
    }

    if (!clean || isThinking) return;

    const decision = decideSummonOrNavigate(clean, agencies, macros);
    if (decision.mode === 'summon_canvas') {
      const matchedMacro = findMatchingMacroByPrompt(clean, macros);
      if (matchedMacro) {
        handleExecuteMacro(matchedMacro);
      } else if (decision.canvasMode) {
        setCanvasMode(decision.canvasMode);
        setCanvasOverlayActive(true);
        setSummonNotice(`${decision.title} — ${decision.reason}`);
      }
    } else if (decision.mode === 'navigate_spotlight' && decision.targetView && decision.targetDomId) {
      setSummonNotice(decision.title);
      onTriggerSpotlight({
        view: decision.targetView,
        settingsSection: decision.settingsSection,
        targetId: decision.targetDomId,
        title: decision.title,
        description: decision.reason,
      });
    }

    onSendMessage(clean);
    if (!overridePrompt) setChatInput('');
  };

  const handleExitStudio = () => {
    if (onBackToApp) {
      onBackToApp();
    } else {
      onNavigateView?.('hub');
    }
  };

  const sideSections: Array<{
    id: MorrowCenterTab;
    label: string;
    desc: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'chat',
      label: 'المحادثة والملفات ولايف',
      desc: 'الواجهة الرئيسية الهادئة',
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: 'approvals',
      label: 'المهام والمراجعة',
      desc: 'مسودات التعديل التي تنتظر موافقتك',
      count: pendingDrafts.length,
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
    {
      id: 'memory',
      label: 'الذاكرة والقواعد الدائمة',
      desc: 'تفضيلات التقارير وتنفيذ الأوامر تلقائياً',
      count: preferences.length,
      icon: <BookmarkCheck className="h-4 w-4" />,
    },
    {
      id: 'quick_notes',
      label: 'الملاحظات الصوتية والسريعة',
      desc: 'مذكرات مرتبطة بالعوائل تلقائياً',
      count: quickNotes.length,
      icon: <StickyNote className="h-4 w-4" />,
    },
  ];

  const isMainConversationView = activeTab === 'chat' && !canvasOverlayActive;

  return (
    <div
      data-testid="morrow-command-center"
      className="capsule-fullscreen-shell morrow-studio-shell relative flex min-h-[100dvh] flex-col [overflow-x:clip]"
    >
      {/* MINIMALIST FULL-SCREEN HEADER */}
      <header
        className="no-print sticky top-0 z-30 border-b backdrop-blur-xl"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
          borderColor: 'color-mix(in srgb, var(--border-color) 80%, transparent)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-6">
          {/* Start (RTL Right): Back Button + Morrow Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleExitStudio}
              data-testid="morrow-back-to-app"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <ArrowRight className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <span>{backLabel}</span>
            </button>

            <span
              className="hidden sm:block h-5 w-px shrink-0"
              style={{ backgroundColor: 'var(--border-color)' }}
              aria-hidden="true"
            />

            <div className="flex items-center gap-2 min-w-0">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-extrabold leading-tight">
                  مساعد Morrow
                </h1>
                <div
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span
                    className="inline-flex items-center gap-1 font-semibold"
                    style={{
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
                  <span aria-hidden="true">·</span>
                  <span className="hidden sm:inline truncate">{activeBrain.shortLabel}</span>
                  {liveCloudContext?.liveWorkspace && (
                    <>
                      <span aria-hidden="true" className="hidden md:inline">·</span>
                      <span className="hidden md:inline truncate tabular-nums">
                        {liveCloudContext.liveWorkspace.agenciesBreakdown.length} وكالات ·{' '}
                        {liveCloudContext.liveWorkspace.totalActiveIndividuals.toLocaleString('ar-IQ')} أفراد
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* End (RTL Left): Return to Main Chat (when viewing sub-section) + Side Extensions Drawer Button */}
          <div className="flex items-center gap-2 shrink-0">
            {!isMainConversationView && (
              <button
                type="button"
                onClick={() => {
                  setCanvasOverlayActive(false);
                  onChangeTab('chat');
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold whitespace-nowrap hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>المحادثة الرئيسية</span>
              </button>
            )}

            <button
              type="button"
              data-testid="morrow-side-drawer-toggle"
              onClick={() => setSideDrawerOpen(true)}
              aria-label="فتح القائمة الجانبية لميزات وإضافات المساعد"
              className="inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-xs font-extrabold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor:
                  sideFeatureBadgeCount > 0 ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor:
                  sideFeatureBadgeCount > 0 ? 'var(--accent)' : 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <SlidersHorizontal className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <span>الميزات والأقسام</span>
              {sideFeatureBadgeCount > 0 && (
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-black tabular-nums"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {sideFeatureBadgeCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          PRIMARY SCREEN (DEFAULT): ONLY Chat + Voice + Live + Files/Camera
         ==================================================================== */}
      {isMainConversationView && (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-5 min-h-0">
          {summonNotice && (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border-color))',
                color: 'var(--accent)',
              }}
            >
              <span className="truncate">{summonNotice}</span>
              <button
                type="button"
                onClick={() => setSummonNotice(null)}
                aria-label="إغلاق الإشعار"
                className="p-0.5 hover:opacity-75"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Conversation Scroll Stream */}
          <div className="flex-1 space-y-4 overflow-y-auto pb-4">
            {/* Serene Welcome Hero showing ONLY the 3 Core Pillars when thread is fresh */}
            {filteredMessages.length <= 2 && multimodalFeed.length === 0 && !historySearch && (
              <section
                aria-label="قدرات مساعد Morrow الأساسية"
                className="morrow-studio-surface rounded-[26px] border p-5 sm:p-7 space-y-5"
              >
                <div className="space-y-1.5 text-center sm:text-right">
                  <h2 className="text-lg sm:text-xl font-extrabold" style={{ textWrap: 'balance' }}>
                    أهلاً بك في مساحة Morrow المتكاملة
                  </h2>
                  <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                    تفاعل بالمحادثة والأوامر أو الرسائل الصوتية، ابدأ محادثة صوتية مباشرة لايف، أو ارفع وصوّر ملفاتك — جميع النماذج مرتبطة لحظياً بحصتك الحالية.
                  </p>
                  {liveCloudContext?.liveWorkspace && (
                    <div
                      className="pt-1 text-[11px] font-semibold tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {liveCloudContext.liveWorkspace.periodName} ·{' '}
                      {liveCloudContext.liveWorkspace.agenciesBreakdown.length} وكالات ·{' '}
                      {liveCloudContext.liveWorkspace.totalActiveIndividuals.toLocaleString('ar-IQ')} أفراد نشطين ·{' '}
                      {liveCloudContext.liveWorkspace.totalFullBags.toLocaleString('ar-IQ')} كيس · صافي{' '}
                      {liveCloudContext.liveWorkspace.totalProfitIqd.toLocaleString('ar-IQ')} د.ع
                    </div>
                  )}
                </div>

                {/* 3 Core Entry Tiles */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      void startVoiceMessageRecording();
                    }}
                    className="flex flex-col items-start gap-2 rounded-2xl border p-4 text-right transition-colors hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Mic className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                    <div className="text-xs font-extrabold">محادثة أو رسالة صوتية</div>
                    <div className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      اكتب أمرك أو سجّل رسالة صوتية تُفرّغ وتُنفذ مباشرة
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="morrow-start-live-btn"
                    onClick={() => setLiveModalOpen(true)}
                    className="flex flex-col items-start gap-2 rounded-2xl border p-4 text-right transition-colors hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Radio className="h-5 w-5" style={{ color: '#10b981' }} />
                    <div className="text-xs font-extrabold">المحادثة لايف (مباشر)</div>
                    <div className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      حوار صوتي تفاعلي لحظي مع خيار تشغيل الكاميرا
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="morrow-upload-trigger-card"
                    onClick={() => filePickerRef.current?.click()}
                    className="flex flex-col items-start gap-2 rounded-2xl border p-4 text-right transition-colors hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Paperclip className="h-5 w-5" style={{ color: '#0ea5e9' }} />
                    <div className="text-xs font-extrabold">رفع أو تصوير الملفات</div>
                    <div className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      PDF أو صورة دفتر لقراءتها أو إرسالها للسحب الذكي
                    </div>
                  </button>
                </div>

                {/* Light quick prompt strip */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {smartSuggestions.slice(0, 4).map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => submitChatPrompt(sug.prompt)}
                      className="rounded-xl border px-3 py-1.5 text-[11px] font-bold hover:border-[var(--accent)]"
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
              </section>
            )}

            {/* Text & Tool Messages */}
            {filteredMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const meta = getEngineDisplayMeta(msg.engineUsed);
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${isUser ? 'items-start' : 'items-stretch'}`}
                >
                  <div
                    className="rounded-[22px] border px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line"
                    style={{
                      backgroundColor: isUser
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-surface)',
                      borderColor: isUser
                        ? 'color-mix(in srgb, var(--accent) 42%, var(--border-color))'
                        : 'var(--border-color)',
                      maxWidth: isUser ? '86%' : '100%',
                    }}
                  >
                    {!isUser && (
                      <div
                        className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
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
                            onClick={() => void handleSpeakMessage(msg.id, msg.text)}
                            title={speakingMsgId === msg.id ? 'إيقاف القراءة الصوتية' : 'استماع للرد'}
                            className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold hover:border-[var(--accent)]"
                            style={{
                              backgroundColor:
                                speakingMsgId === msg.id ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                              borderColor:
                                speakingMsgId === msg.id ? 'var(--accent)' : 'var(--border-color)',
                              color: speakingMsgId === msg.id ? 'var(--accent)' : 'var(--text-primary)',
                            }}
                          >
                            <Volume2 className="h-3 w-3" />
                            <span>{speakingMsgId === msg.id ? 'إيقاف' : 'استماع'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onSendMessage(
                                `أعد صياغة هذه النتيجة بأسلوب مختصر ورسمي:\n${msg.text.slice(0, 180)}`
                              )
                            }
                            title="أعد الصياغة"
                            className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold hover:border-[var(--accent)]"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>صياغة</span>
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
                              backgroundColor: 'var(--bg-main)',
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
                              backgroundColor: 'var(--bg-main)',
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
                                backgroundColor: 'var(--bg-main)',
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
            })}

            {/* Multimodal Voice Notes, File Analyses & Live Transcripts */}
            {multimodalFeed.map((item) => (
              <div
                key={item.id}
                className="morrow-studio-surface rounded-[22px] border p-4 space-y-2.5 text-xs sm:text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-extrabold">
                    {item.kind === 'voice_note' ? (
                      <Volume2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    ) : item.kind === 'live_summary' ? (
                      <Radio className="h-4 w-4" style={{ color: '#10b981' }} />
                    ) : (
                      <FileText className="h-4 w-4" style={{ color: '#0ea5e9' }} />
                    )}
                    <span>{item.title}</span>
                  </div>
                  {item.durationSec !== undefined && (
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {String(Math.floor(item.durationSec / 60)).padStart(2, '0')}:
                      {String(item.durationSec % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>

                {item.audioUrl && (
                  <audio controls src={item.audioUrl} className="w-full h-9" />
                )}

                {item.previewUrl && (
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="max-h-56 rounded-xl border object-contain"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                )}

                {item.body && (
                  <div className="leading-relaxed whitespace-pre-line">{item.body}</div>
                )}

                {item.errorText && (
                  <div
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--warning-bg)',
                      borderColor: 'var(--warning)',
                    }}
                  >
                    {item.errorText}
                  </div>
                )}

                {(item.file || (item.suggestedTools && item.suggestedTools.length > 0)) && (
                  <div className="pt-1 flex flex-wrap gap-2">
                    {item.suggestedTools && item.suggestedTools.length > 0 && onStageToolDrafts && (
                      <button
                        type="button"
                        onClick={() => {
                          const staged = onStageToolDrafts(
                            item.suggestedTools!,
                            `تحليل مرفق: ${item.title}`
                          );
                          if (staged > 0) onChangeTab('approvals');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-extrabold hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-nav-active)',
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                        }}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        <span>
                          تجهيز {item.suggestedTools.length} مسودة للموافقة
                        </span>
                      </button>
                    )}

                    {item.file && onHandoffFilesToQuickExtract && (
                      <button
                        type="button"
                        onClick={() => onHandoffFilesToQuickExtract([item.file!])}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-fg)',
                        }}
                      >
                        <FileSearch className="h-3.5 w-3.5" />
                        <span>فتح في السحب الذكي مع التحقق البصري</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {(isThinking || analyzingAttachment || transcribingVoice) && (
              <div
                className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)' }} />
                <span>
                  {analyzingAttachment
                    ? 'جاري قراءة وتحليل الملف المرفق...'
                    : transcribingVoice
                      ? 'جاري تفريغ الرسالة الصوتية ومعالجتها...'
                      : 'جاري معالجة طلبك في Morrow...'}
                </span>
              </div>
            )}

            <div ref={chatScrollRef} />
          </div>

          {/* Voice / File Error Feedback if any */}
          {voiceError && (
            <div
              className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)',
              }}
            >
              <span>{voiceError}</span>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                aria-label="إغلاق التنبيه الصوتي"
                className="p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* UNIFIED CORE COMPOSER BAR: Text + Voice Msg | Live | File Upload & Camera */}
          <div
            className="morrow-studio-surface sticky bottom-2 z-20 rounded-[24px] border p-2.5 sm:p-3 shadow-xl space-y-2.5"
            style={{
              borderColor: 'color-mix(in srgb, var(--accent) 26%, var(--border-color))',
            }}
          >
            {/* Pending Attached Document / Photo Preview */}
            {attachedFile && (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {attachedFile.previewUrl ? (
                    <img
                      src={attachedFile.previewUrl}
                      alt={attachedFile.name}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 rounded-xl border object-cover shrink-0"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                  ) : (
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <FileText className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-extrabold">{attachedFile.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      اكتب سؤالك عن الملف أو افتحه بالسحب الذكي مباشرة
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {onHandoffFilesToQuickExtract && (
                    <button
                      type="button"
                      onClick={() => {
                        const fileToSend = attachedFile.file;
                        setAttachedFile(null);
                        onHandoffFilesToQuickExtract([fileToSend]);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold hover:border-[var(--accent)]"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <FileSearch className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                      <span>السحب الذكي</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void analyzeAttachedDocument(chatInput.trim())}
                    className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-[11px] font-extrabold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>قراءة وتحليل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    aria-label="إزالة المرفق"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Active Voice Message Recording Strip */}
            {isRecordingVoiceMsg && (
              <div
                className="flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-xs font-extrabold"
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 animate-pulse" />
                  <span>جاري تسجيل رسالة صوتية...</span>
                  <span className="font-mono tabular-nums">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                    {String(recordingSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void stopVoiceMessageRecording(false)}
                    className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => void stopVoiceMessageRecording(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-extrabold"
                    style={{
                      backgroundColor: 'var(--danger)',
                      color: '#ffffff',
                    }}
                  >
                    <Square className="h-3 w-3" />
                    <span>إيقاف وإرسال</span>
                  </button>
                </div>
              </div>
            )}

            <input
              ref={filePickerRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void handleQueueFile(f);
              }}
            />

            {/* Slash Command Quick Launcher (when typing /) */}
            {filteredSlashCommands.length > 0 && (
              <div
                className="rounded-2xl border p-2 space-y-1 max-h-52 overflow-y-auto"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                }}
              >
                <div className="px-2 py-1 text-[10px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  أوامر Morrow الفورية (اختر للتنفيذ):
                </div>
                {filteredSlashCommands.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      setChatInput('');
                      if (sc.runVerifier) {
                        setSideDrawerOpen(true);
                        void handleRunSystemVerifier();
                        return;
                      }
                      if (sc.canvasMode) {
                        setCanvasMode(sc.canvasMode);
                        setCanvasOverlayActive(true);
                        return;
                      }
                      if (sc.prompt) {
                        submitChatPrompt(sc.prompt);
                      }
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-right text-xs hover:bg-[var(--bg-nav-active)]"
                  >
                    <div className="min-w-0">
                      <span className="font-extrabold">{sc.label}</span>
                      <span className="mr-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {sc.desc}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-bold shrink-0" style={{ color: 'var(--accent)' }}>
                      {sc.cmd}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Main Input Row */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitChatPrompt();
              }}
              className="flex items-end gap-2"
            >
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
                placeholder={
                  attachedFile
                    ? 'اكتب سؤالك حول الملف المرفق أو اضغط إرسال...'
                    : 'اكتب محادثة أو أمراً لـ Morrow (أو ابدأ بـ / للأوامر السريعة)...'
                }
                className="min-w-0 flex-1 resize-none rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <button
                type="submit"
                disabled={(!chatInput.trim() && !attachedFile) || isThinking || analyzingAttachment}
                aria-label="إرسال"
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl px-4 text-xs font-extrabold whitespace-nowrap shrink-0 disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">إرسال</span>
              </button>
            </form>

            {/* Clean Action Trio Bar: Voice Message + Live Talk + Upload/Camera */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={checkingMicPermission || transcribingVoice}
                  onClick={() => void startVoiceMessageRecording()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: isRecordingVoiceMsg ? 'var(--danger)' : 'var(--bg-main)',
                    borderColor: isRecordingVoiceMsg ? 'var(--danger)' : 'var(--border-color)',
                    color: isRecordingVoiceMsg ? '#ffffff' : 'var(--text-primary)',
                  }}
                >
                  {isRecordingVoiceMsg ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />}
                  <span>{isRecordingVoiceMsg ? 'إيقاف التسجيل' : 'رسالة صوتية'}</span>
                </button>

                <button
                  type="button"
                  data-testid="morrow-live-bar-btn"
                  onClick={() => setLiveModalOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'color-mix(in srgb, #10b981 12%, var(--bg-main))',
                    borderColor: 'color-mix(in srgb, #10b981 42%, var(--border-color))',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Radio className="h-3.5 w-3.5" style={{ color: '#10b981' }} />
                  <span>المحادثة لايف</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => filePickerRef.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <ImageIcon className="h-3.5 w-3.5" style={{ color: '#0ea5e9' }} />
                  <span>رفع ملف</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCameraModalOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Camera className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>تصوير</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ====================================================================
          SECONDARY EXTENSION VIEW: WORKSPACE 2.0 DYNAMIC CANVAS (Opened via Side Button)
         ==================================================================== */}
      {activeTab === 'chat' && canvasOverlayActive && (
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6 sm:px-6">
          <DynamicWorkspaceCanvas
            canvasMode={canvasMode}
            onChangeCanvasMode={setCanvasMode}
            agencies={agencies}
            persons={persons}
            expenses={expenses}
            calculationSettings={calculationSettings}
            monthlyArchives={monthlyArchives}
            activePeriod={activePeriod}
            selectedAgencyId={activeAgencyId}
            lastBackupAt={lastBackupAt}
            forecast={proactiveBundle.forecast}
            macros={macros}
            onSaveMacros={handleSaveMacros}
            lastMacroResult={lastMacroResult}
            onRunMacro={handleExecuteMacro}
            onStageToolDrafts={(tools, sourceLabel) => {
              if (onStageToolDrafts) {
                onStageToolDrafts(tools, sourceLabel);
                setCanvasOverlayActive(false);
                onChangeTab('approvals');
              }
            }}
            onOpenAgencyRoster={(agId) => {
              if (onOpenAgencyRoster) {
                onOpenAgencyRoster(agId);
              } else {
                onSelectActiveAgency?.(agId);
                onNavigateView?.('agency_roster');
              }
            }}
            onSendPrompt={(prompt) => {
              setCanvasOverlayActive(false);
              submitChatPrompt(prompt);
            }}
            cloudConfigured={cloudConfigured}
          />
        </main>
      )}

      {/* TAB 2: المهام والمراجعة (Approvals Draft Queue) */}
      {activeTab === 'approvals' && (
        <main
          aria-label="طابور المهام والمراجعة"
          data-testid="morrow-approvals-panel"
          className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8"
        >
          <div className="morrow-studio-surface rounded-[24px] border p-5 sm:p-6 space-y-4">
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
                onClick={() => {
                  onChangeTab('chat');
                  onSendMessage('صلح مشاكل الفحص تلقائياً');
                }}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
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
                className="rounded-2xl border px-4 py-10 text-center text-xs space-y-2"
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
            <div className="morrow-studio-surface rounded-[24px] border p-5 sm:p-6 space-y-3">
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
        </main>
      )}

      {/* TAB 3: الذاكرة (Persistent Behavioral Memory Rules) */}
      {activeTab === 'memory' && (
        <main
          aria-label="قواعد الذاكرة الدائمة"
          data-testid="morrow-memory-panel"
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          <div className="morrow-studio-surface rounded-[24px] border p-5 sm:p-6 space-y-5">
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
                  className="rounded-2xl border px-4 py-8 text-center text-xs"
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
          </div>
        </main>
      )}

      {/* TAB 4: الملاحظات السريعة (Text + Voice Dictation + Auto Beneficiary Linking) */}
      {activeTab === 'quick_notes' && (
        <main
          aria-label="الملاحظات السريعة والإملاء الصوتي"
          data-testid="morrow-quick-notes-panel"
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          <div className="morrow-studio-surface rounded-[24px] border p-5 sm:p-6 space-y-5">
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
                onClick={() => void toggleNoteVoiceDictation()}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: isNoteRecording ? 'var(--danger)' : 'var(--bg-main)',
                  borderColor: isNoteRecording ? 'var(--danger)' : 'var(--border-color)',
                  color: isNoteRecording ? '#ffffff' : 'var(--text-primary)',
                }}
              >
                {isNoteRecording ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    <span>إيقاف الإملاء</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>{speechSupported ? 'إملاء صوتي عربي' : 'إدخال صوتي'}</span>
                  </>
                )}
              </button>
            </div>

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
                  if (!isNoteRecording) setNoteSource('text');
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
                  <span>مزامنة النص مباشرة إلى حقل ملاحظات المستفيد بالجدول</span>
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
                  <span>حفظ الملاحظة والربط</span>
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              <div className="text-xs font-bold">سجل الملاحظات السريعة ({quickNotes.length})</div>
              {quickNotes.length === 0 ? (
                <div
                  className="rounded-2xl border px-4 py-8 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  لا توجد ملاحظات مسجلة بعد. ابدأ بكتابة أو إملاء أول ملاحظة.
                </div>
              ) : (
                quickNotes.map((note) => {
                  const linkedPerson = note.linkedPersonId
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold leading-relaxed">{note.text}</div>
                        <button
                          type="button"
                          onClick={() => onDeleteQuickNote(note.id)}
                          aria-label="حذف الملاحظة"
                          className="rounded-lg p-1.5 opacity-70 hover:opacity-100"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span style={{ color: 'var(--text-muted)' }}>
                            {note.source === 'voice' ? 'صوتية' : 'نصية'} ·{' '}
                            {new Date(note.createdAt).toLocaleDateString('ar-IQ')}
                          </span>
                          {note.linkedPersonName && (
                            <span className="font-bold" style={{ color: 'var(--accent)' }}>
                              {note.linkedPersonName}
                              {note.linkedAgencyName ? ` (${note.linkedAgencyName})` : ''}
                            </span>
                          )}
                          {note.syncedToPersonNotes && (
                            <span className="font-bold" style={{ color: 'var(--success)' }}>
                              مُزامنة بسجل العائلة
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            aria-label="تغيير ربط المستفيد"
                            value={note.linkedPersonId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              onUpdateQuickNoteLink(note.id, val ? Number(val) : null);
                            }}
                            className="rounded-xl border px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <option value="">غير مرتبطة</option>
                            {persons.slice(0, 80).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>

                          {note.linkedPersonId && !note.syncedToPersonNotes && (
                            <button
                              type="button"
                              onClick={() => onSyncQuickNoteToPerson(note.id)}
                              className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent)',
                              }}
                            >
                              <Link2 className="h-3 w-3" />
                              <span>مزامنة لسجل العائلة</span>
                            </button>
                          )}

                          {linkedPerson && (
                            <button
                              type="button"
                              onClick={() => onJumpToPerson(linkedPerson)}
                              className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <UserCheck className="h-3 w-3" />
                              <span>فتح بالجدول</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </main>
      )}

      {/* ====================================================================
          SLIDE-OVER SIDE DRAWER FOR ALL SECONDARY FEATURES, MEMORY, NOTES, CANVAS 2.0
         ==================================================================== */}
      {sideDrawerOpen && (
        <div
          className="fixed inset-0 z-[var(--z-sheet)] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="الأقسام والميزات الجانبية لمساعد Morrow"
        >
          <div
            onClick={() => setSideDrawerOpen(false)}
            className="fixed inset-0"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(4px)',
            }}
          />

          <aside
            data-testid="morrow-side-drawer"
            className="relative z-10 flex h-full w-full max-w-md flex-col border-r shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Drawer Header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div>
                <h2 className="text-sm font-extrabold">ميزات وأقسام مساعد Morrow</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  الذاكرة، التعديلات، الملاحظات، واللوحة التفاعلية 2.0
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSideDrawerOpen(false)}
                aria-label="إغلاق القائمة الجانبية"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
              {/* Section 1: Main Sub-views & Extensions */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  الأقسام والتقسيمات
                </div>
                <div className="space-y-1.5">
                  {sideSections.map((sec) => {
                    const active = activeTab === sec.id && !canvasOverlayActive;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        data-testid={`morrow-tab-${sec.id}`}
                        onClick={() => {
                          setCanvasOverlayActive(false);
                          onChangeTab(sec.id);
                          setSideDrawerOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-right transition-colors hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                          borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {sec.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="font-extrabold">{sec.label}</div>
                            <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {sec.desc}
                            </div>
                          </div>
                        </div>
                        {sec.count !== undefined && sec.count > 0 && (
                          <span
                            className="rounded-lg px-2 py-0.5 text-[11px] font-black tabular-nums"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-fg)',
                            }}
                          >
                            {sec.count}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Workspace 2.0 Dynamic Canvas */}
                  <button
                    type="button"
                    data-testid="morrow-open-canvas-btn"
                    onClick={() => {
                      onChangeTab('chat');
                      setCanvasOverlayActive(true);
                      setSideDrawerOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-right transition-colors hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: canvasOverlayActive ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor: canvasOverlayActive ? 'var(--accent)' : 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <LayoutPanelLeft className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <div>
                        <div className="font-extrabold">اللوحة التفاعلية 2.0 والأدوات</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          رسوم بيانية، محرر مباشر، تقارير، توقعات، ماكرو
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 2: Intelligence Brain Engine */}
              <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  اختيار دماغ Morrow
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {BRAIN_BUTTONS.map((btn) => {
                    const selected = brainMode === btn.id;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => onChangeBrainMode(btn.id)}
                        className="flex items-center gap-1.5 rounded-xl border p-2.5 text-right font-bold"
                        style={{
                          backgroundColor: selected ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                          borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
                          color: selected ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                      >
                        {btn.icon}
                        <span className="truncate">{btn.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Conversation Tools & Search */}
              <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  البحث وإدارة المحادثة
                </div>
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="تصفية سجل المحادثة..."
                    className="w-full min-w-0 bg-transparent text-xs outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowPinnedOnly((v) => !v)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-bold"
                    style={{
                      backgroundColor: showPinnedOnly ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor: showPinnedOnly ? 'var(--accent)' : 'var(--border-color)',
                    }}
                  >
                    <Pin className="h-3.5 w-3.5" />
                    <span>المثبتة فقط</span>
                  </button>

                  {onExportChatHistory && (
                    <button
                      type="button"
                      onClick={onExportChatHistory}
                      className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-bold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                      <span>تصدير المحادثة</span>
                    </button>
                  )}

                  {hasUndoableAction && (
                    <button
                      type="button"
                      onClick={() => {
                        onUndoLastAction();
                        setSideDrawerOpen(false);
                      }}
                      className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-bold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--warning)',
                        color: 'var(--warning)',
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>تراجع عن آخر إجراء للمساعد</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Section 4: Active Agency Context */}
              <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  <span>الوكالة النشطة</span>
                  {activePeriodLabel && <span>{activePeriodLabel}</span>}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {agencies.map((ag) => {
                    const selected = ag.id === activeAgencyId;
                    return (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => onSelectActiveAgency?.(ag.id)}
                        className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-right font-bold"
                        style={{
                          backgroundColor: selected ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                          borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
                        }}
                      >
                        <FolderKanban className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                        <span className="truncate">{ag.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 5: Proactive Alerts & Command Library */}
              {proactiveBundle.insights.length > 0 && (
                <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                    تنبيهات وتوقعات استباقية
                  </div>
                  <div className="space-y-1.5">
                    {proactiveBundle.insights.slice(0, 3).map((insight) => (
                      <button
                        key={insight.id}
                        type="button"
                        onClick={() => handleProactiveInsightAction(insight)}
                        className="w-full rounded-xl border p-2.5 text-right hover:border-[var(--accent)]"
                        style={{
                          backgroundColor:
                            insight.severity === 'high' ? 'var(--warning-bg)' : 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <div className="font-extrabold">{insight.title}</div>
                        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {insight.detail}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 5.5: Interactive System Integrity & Model Binding Verifier */}
              {onVerifySystemIntegrity && (
                <div className="space-y-2.5 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                      فحص التكامل والربط الجذري بالتطبيق
                    </div>
                    <button
                      type="button"
                      data-testid="morrow-verify-binding-btn"
                      disabled={verifyingSystem}
                      onClick={() => void handleRunSystemVerifier()}
                      className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold hover:border-[var(--accent)] disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }}
                    >
                      {verifyingSystem ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      <span>{verifyingSystem ? 'جاري الفحص...' : 'تشغيل الفحص'}</span>
                    </button>
                  </div>

                  {verificationReport && (
                    <div
                      data-testid="morrow-verification-report"
                      className="rounded-2xl border p-3 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: verificationReport.allPassed ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      <div className="flex items-center justify-between text-[11px] font-extrabold">
                        <span style={{ color: verificationReport.allPassed ? 'var(--success)' : 'var(--warning)' }}>
                          {verificationReport.allPassed
                            ? 'جميع المسارات والنماذج مربوطة بنجاح'
                            : 'توجد ملاحظات على أحد المسارات'}
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {verificationReport.boundAgenciesCount} وكالات · {verificationReport.boundPersonsCount} سجل
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {verificationReport.checks.map((chk) => (
                          <div
                            key={chk.id}
                            className="rounded-xl border px-2.5 py-1.5"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 font-bold text-[11px]">
                              <span>{chk.label}</span>
                              <span
                                style={{
                                  color:
                                    chk.status === 'ok'
                                      ? 'var(--success)'
                                      : chk.status === 'warning'
                                        ? 'var(--warning)'
                                        : 'var(--danger)',
                                }}
                              >
                                {chk.status === 'ok' ? 'متصل' : chk.status === 'warning' ? 'احتياط' : 'خطأ'}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {chk.detail}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  مكتبة الأوامر السريعة
                </div>
                <div className="space-y-1.5">
                  {COMMAND_LIBRARY_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSideDrawerOpen(false);
                        setCanvasOverlayActive(false);
                        onChangeTab('chat');
                        submitChatPrompt(item.label);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-right hover:border-[var(--accent)]"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-bold">{item.label}</div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {item.desc}
                        </div>
                      </div>
                      <Send className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Live Voice + Video Session Modal */}
      <MorrowLiveSessionModal
        open={liveModalOpen}
        onClose={() => setLiveModalOpen(false)}
        liveContext={liveCloudContext}
        onLiveToolAction={onLiveToolAction}
        onSessionTranscriptSaved={(summaryText) => {
          setMultimodalFeed((prev) => [
            ...prev.slice(-15),
            {
              id: `live_${Date.now()}`,
              createdAt: new Date().toISOString(),
              kind: 'live_summary',
              title: 'ملخص المحادثة المباشرة لايف',
              body: summaryText,
            },
          ]);
        }}
      />

      {/* Camera Photo Capture Modal */}
      <MorrowCameraSnapModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCaptureFile={(file) => {
          void handleQueueFile(file);
        }}
      />

      <PermissionGuardModal
        open={Boolean(micPermissionGuide)}
        guide={micPermissionGuide}
        checking={checkingMicPermission}
        onClose={() => setMicPermissionGuide(null)}
        onRetryPermission={() => {
          setMicPermissionGuide(null);
        }}
      />
    </div>
  );
};
