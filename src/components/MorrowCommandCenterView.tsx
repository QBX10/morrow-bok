import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Cpu,
  FileSearch,
  FileText,
  History,
  Link2,
  Loader2,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Radio,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  SquarePen,
  StickyNote,
  Trash2,
  TrendingUp,
  UserCheck,
  Volume2,
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
  AiCollaborationMode,
  AiTaskRoutingMap,
  AssistantApprovalDraft,
  AssistantBrainMode,
  AssistantCanvasHandoff,
  AssistantChatThread,
  AssistantChoiceChip,
  AssistantConnectivityState,
  AssistantMessage,
  AssistantQuickNote,
  AssistantResponseStyle,
  AssistantSmartSuggestion,
  AssistantToolCall,
  AssistantUserPref,
  MorrowCanvasMode,
  MorrowCenterTab,
  MorrowMacroDefinition,
  MorrowMacroExecutionResult,
  MorrowSystemVerificationReport,
} from '../types/assistant.ts';
import {
  AI_FREE_MODELS,
  type ModelHealthRecord,
} from '../lib/aiConfig.ts';
import { DEFAULT_CALCULATION_SETTINGS, normalizeArabic } from '../utils/agencyLogic.ts';
import type { MaskedCloudContext } from '../utils/assistantPrivacy.ts';
import {
  buildPermissionRecoveryGuide,
  requestMicrophonePermission,
  type MediaPermissionGuide,
} from '../utils/mediaPermissions.ts';
import {
  computeProactiveInsightsAndForecasts,
  decideSummonOrNavigate,
  executeMorrowMacro,
  findMatchingMacroByPrompt,
  loadUserMacros,
  saveUserMacros,
} from '../utils/morrowWorkspaceEngine.ts';
import { autoLinkQuickNoteToPerson } from '../utils/quickNotesMatcher.ts';
import { DynamicWorkspaceCanvas } from './morrow/DynamicWorkspaceCanvas';
import { MorrowAppDrawer } from './morrow/MorrowAppDrawer';
import { MorrowCameraSnapModal } from './morrow/MorrowCameraSnapModal';
import { MorrowLiveSessionModal } from './morrow/MorrowLiveSessionModal';
import { MorrowMessageCard } from './morrow/MorrowMessageCard';
import {
  MorrowModelMenuPopover,
  type BrainOptionItem,
} from './morrow/MorrowModelMenuPopover';
import { MorrowLeftDrawer } from './morrow/MorrowLeftDrawer';
import { MorrowSubPageHeader } from './morrow/MorrowSubPageHeader';
import { MorrowHistoryPage } from './morrow/MorrowHistoryPage';
import { MorrowModelsPage } from './morrow/MorrowModelsPage';
import { MorrowAssistantsPage } from './morrow/MorrowAssistantsPage';
import { MorrowVoiceSettingsPage } from './morrow/MorrowVoiceSettingsPage';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
import {
  SPECIALIZED_ASSISTANTS,
  type MorrowWorkspacePage,
  type SpecializedAssistantProfile,
} from './morrow/morrowWorkspaceTypes';

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
  initialCanvasMode?: {
    mode: MorrowCanvasMode;
    agencyId?: number | null;
    nonce: number;
  } | null;
  collaborationMode?: AiCollaborationMode;
  onChangeCollaborationMode?: (mode: AiCollaborationMode) => void;
  responseStyle?: AssistantResponseStyle;
  onChangeResponseStyle?: (style: AssistantResponseStyle) => void;
  chatThreads?: AssistantChatThread[];
  activeThreadId?: string;
  onSwitchThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onHandoffFilesToQuickExtract?: (files: File[]) => void;
  liveCloudContext?: MaskedCloudContext;
  onLiveToolAction?: (toolCall: AssistantToolCall) => string | void;
  onVerifySystemIntegrity?: () => Promise<MorrowSystemVerificationReport>;
  taskRouting?: AiTaskRoutingMap;
  onOpenAiModelsStudio?: () => void;
  onCancelRequest?: () => void;
  onClearMessages?: () => void;
  onRetryLastPrompt?: (prompt?: string) => void;
  modelHealthSnapshots?: Array<
    ModelHealthRecord & { status: 'healthy' | 'cooldown' }
  >;
  canViewFinance?: boolean;
  canUseQuickExtract?: boolean;
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
  modelId?: string;
  modelLabel?: string;
  voiceMode?: 'instruction' | 'quick_note' | 'draft_text';
  linkedPersonName?: string;
  linkedAgencyName?: string;
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
  openTab?: MorrowCenterTab;
  startVoice?: 'instruction' | 'quick_note';
}> = [
  { id: 'sl_brief', cmd: '/ايجاز', label: 'الإيجاز التنفيذي اليومي', desc: 'ملخص الأكياس والأرباح وأعلى الوكالات والمخاطر', prompt: 'أعطني ملخص اليوم' },
  { id: 'sl_whatif', cmd: '/محاكاة', label: 'محاكاة ماذا لو المالية', desc: 'اختبار تغيير الرسم أو زيادة الأفراد بدون تعديل', prompt: 'ماذا لو رسم الفرد 500' },
  { id: 'sl_blocked', cmd: '/محجوبين', label: 'حصر المحجوبين', desc: 'استعراض العائلات المحجوبة والحجب الجزئي', prompt: 'من هم المحجوبين' },
  { id: 'sl_voice', cmd: '/صوت', label: 'التسجيل الصوتي الذكي', desc: 'تسجيل أمر للذكاء أو ملاحظة سريعة بالصوت', startVoice: 'instruction' },
  { id: 'sl_note', cmd: '/ملاحظة', label: 'الملاحظات السريعة والربط', desc: 'تسجيل ملاحظة نصية أو صوتية وربطها بالعائلة', openTab: 'quick_notes' },
  { id: 'sl_compare', cmd: '/مقارنة', label: 'مقارنة الوكالات الشاملة', desc: 'ترتيب الوكالات بالأفراد والأكياس وصافي الربح', prompt: 'قارن بين الوكالات' },
  { id: 'sl_stats', cmd: '/احصائيات', label: 'اللوحة التفاعلية والرسوم', desc: 'الأفراد والأكياس وصافي الأرباح الحية', canvasMode: 'overview_charts' },
  { id: 'sl_edit', cmd: '/جدول', label: 'تعديل الأسماء مباشرة', desc: 'تحديث الأفراد والحظر مع بوابة الموافقة', canvasMode: 'editable_table' },
  { id: 'sl_forecast', cmd: '/توقع', label: 'توقعات الشهر القادم', desc: 'استشراف الاحتياج بناءً على الأرشيف', canvasMode: 'forecast' },
  { id: 'sl_report', cmd: '/تقرير', label: 'تقرير تنفيذي شامل', desc: 'ملخص قيادي موحّد لكل الوكالات', canvasMode: 'executive_report' },
  { id: 'sl_wa', cmd: '/تحليل', label: 'تحليل نص واتساب', desc: 'تحويل رسائل المندوبين لأسماء ومسودات', canvasMode: 'text_analysis' },
  { id: 'sl_diag', cmd: '/فحص', label: 'فحص التطبيق الشامل', desc: 'كشف المكررين والنواقص وسلامة الجداول', prompt: 'افحص التطبيق' },
  { id: 'sl_close', cmd: '/اغلاق', label: 'ماكرو إغلاق الشهر', desc: 'مطابقة وتدقيق وتحضير التقرير والنسخة', prompt: 'إغلاق الشهر' },
  { id: 'sl_verify', cmd: '/تكامل', label: 'فحص ارتباط Morrow', desc: 'اختبار اتصال النماذج السحابية والمحلية ولايف', runVerifier: true },
];

const BRAIN_BUTTONS: BrainOptionItem[] = [
  {
    id: 'auto',
    label: 'تلقائي ذكي (6+1)',
    shortLabel: 'تلقائي ذكي',
    desc: 'يبدأ بـ Morrow المحلي ثم يوجه تلقائياً للأقوى عبر النماذج الستة المجانية.',
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
    id: 'gemini_3_8_flash',
    label: 'Gemini 3.8 Flash',
    shortLabel: '3.8 Flash',
    modelId: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    desc: 'الأقوى للمهام الثقيلة، PDF المعقد، الفهم البصري والاستنتاج.',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'gemini_3_5_flash',
    label: 'Gemini 3.5 Flash',
    shortLabel: '3.5 Flash',
    modelId: AI_FREE_MODELS.GEMINI_3_5_FLASH,
    desc: 'متوازن للبيانات المنظمة (Excel/CSV) والأوامر متعددة الخطوات.',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: 'gemini_3_5_flash_lite',
    label: 'Gemini 3.5 Flash Lite',
    shortLabel: '3.5 Lite',
    modelId: AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    desc: 'استجابة فورية للأوامر السريعة والردود اليومية.',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: 'nemotron_free',
    label: 'Nemotron 3.5 VL',
    shortLabel: 'Nemotron',
    modelId: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    desc: 'ذكاء المستندات والاستنتاج المستقل عبر OpenRouter المجاني.',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'openrouter_free',
    label: 'OpenRouter Free',
    shortLabel: 'OR Auto',
    modelId: AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    desc: 'بوابة الاحتياط التلقائي لأقوى نموذج مجاني متاح لحظياً.',
    icon: <Bot className="h-4 w-4" />,
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

const COLLABORATION_MODE_OPTIONS: Array<{
  id: AiCollaborationMode;
  label: string;
  shortLabel: string;
  desc: string;
}> = [
  {
    id: 'council_review',
    label: 'مجلس النماذج (تدقيق متبادل)',
    shortLabel: 'مجلس النماذج',
    desc: 'تنفيذ عبر النموذج الأقوى ثم تدقيق مستقل بنموذج مكمل لضمان الدقة.',
  },
  {
    id: 'multi_step_agent',
    label: 'تحليل متعمق متعدد المراحل',
    shortLabel: 'تحليل متعمق',
    desc: 'تخطيط + استدعاء الأدوات + صياغة استنتاجات وتوصيات مركبة.',
  },
  {
    id: 'single',
    label: 'نموذج واحد مباشر',
    shortLabel: 'نموذج واحد',
    desc: 'إجابة سريعة من نموذج واحد بأقل زمن استجابة.',
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
  collaborationMode = 'council_review',
  onChangeCollaborationMode,
  responseStyle = 'balanced',
  onChangeResponseStyle,
  chatThreads = [],
  activeThreadId,
  onSwitchThread,
  onDeleteThread,
  onHandoffFilesToQuickExtract,
  liveCloudContext,
  onLiveToolAction,
  onVerifySystemIntegrity,
  taskRouting,
  onOpenAiModelsStudio,
  onCancelRequest,
  onClearMessages,
  onRetryLastPrompt,
  modelHealthSnapshots = [],
  canViewFinance = true,
  canUseQuickExtract = true,
}) => {
  // Dual Hamburger Drawers + Clickable Center Morrow Model Selector + Standalone Page State
  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState<MorrowWorkspacePage>(() =>
    activeTab === 'chat' ? 'chat' : activeTab
  );
  const [activeAssistantId, setActiveAssistantId] = useState<string>(() => {
    try {
      return localStorage.getItem('morrow_active_assistant_v1') || 'general_morrow';
    } catch {
      return 'general_morrow';
    }
  });
  const [canvasMode, setCanvasMode] = useState<MorrowCanvasMode>(
    initialCanvasMode?.mode || 'overview_charts'
  );
  const [macros, setMacros] = useState<MorrowMacroDefinition[]>(() => loadUserMacros());
  const [lastMacroResult, setLastMacroResult] = useState<MorrowMacroExecutionResult | null>(null);
  const [summonNotice, setSummonNotice] = useState<string | null>(null);

  // Core Triad States: (1) Chat + Voice Messages, (2) Live Page, (3) Files + Camera Page
  const [chatInput, setChatInput] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const [attachedFile, setAttachedFile] = useState<AttachedDocumentItem | null>(null);
  const [analyzingAttachment, setAnalyzingAttachment] = useState(false);
  const [multimodalFeed, setMultimodalFeed] = useState<MultimodalFeedEntry[]>([]);

  // Real System Integrity Verifier State
  const [verificationReport, setVerificationReport] =
    useState<MorrowSystemVerificationReport | null>(null);
  const [verifyingSystem, setVerifyingSystem] = useState(false);

  // Voice Message Recording + Speech Recognition + Dual-mode (Instruction / Quick Note / Draft Text)
  const [voiceTargetMode, setVoiceTargetMode] = useState<'instruction' | 'quick_note' | 'draft_text'>('instruction');
  const voiceTargetModeRef = useRef<'instruction' | 'quick_note' | 'draft_text'>('instruction');
  const [isRecordingVoiceMsg, setIsRecordingVoiceMsg] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [liveInterimText, setLiveInterimText] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>(() => Array(10).fill(18));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const liveSpeechTranscriptRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);

  // Quick Notes / Memory local inputs
  const [customMemoryInput, setCustomMemoryInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteSource, setNoteSource] = useState<'text' | 'voice'>('text');
  const [syncOnSave, setSyncOnSave] = useState(true);
  const [manualOverridePersonId, setManualOverridePersonId] = useState<number | null | undefined>(
    undefined
  );
  const [isNoteRecording, setIsNoteRecording] = useState(false);
  const [transcribingNoteVoice, setTranscribingNoteVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micPermissionGuide, setMicPermissionGuide] = useState<MediaPermissionGuide | null>(null);
  const [checkingMicPermission, setCheckingMicPermission] = useState(false);
  const pendingMicRetryTargetRef = useRef<'chat' | 'note' | null>(null);

  const noteMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const noteRecordedChunksRef = useRef<Blob[]>([]);
  const noteStreamRef = useRef<MediaStream | null>(null);
  const noteLiveTranscriptRef = useRef<string>('');

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const audioPickerRef = useRef<HTMLInputElement | null>(null);
  const plusMenuContainerRef = useRef<HTMLDivElement | null>(null);

  const openWorkspacePage = (
    page: MorrowWorkspacePage,
    nextCanvasMode?: MorrowCanvasMode
  ) => {
    setPlusMenuOpen(false);
    if (nextCanvasMode) {
      setCanvasMode(nextCanvasMode);
    }
    if (page === 'approvals' || page === 'memory' || page === 'quick_notes') {
      onChangeTab(page);
    } else {
      onChangeTab('chat');
    }
    setActivePage(page);
  };

  const handleSelectAssistantProfile = (
    profile: SpecializedAssistantProfile,
    initialPrompt?: string
  ) => {
    setActiveAssistantId(profile.id);
    try {
      localStorage.setItem('morrow_active_assistant_v1', profile.id);
    } catch {
      // ignore
    }
    onChangeBrainMode(profile.recommendedBrain);
    onChangeResponseStyle?.(profile.recommendedStyle);
    onChangeCollaborationMode?.(profile.recommendedCollaboration);
    setSummonNotice(`تم تفعيل «${profile.name}» وضبط النموذج وأسلوب التحليل تلقائياً.`);
    openWorkspacePage('chat');
    if (initialPrompt) {
      onSendMessage(initialPrompt);
    }
  };

  const updateVoiceTargetMode = (mode: 'instruction' | 'quick_note' | 'draft_text') => {
    voiceTargetModeRef.current = mode;
    setVoiceTargetMode(mode);
  };

  const cleanupVoiceAnalyser = () => {
    if (analyserRafRef.current !== null) {
      window.cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setAudioLevels(Array(10).fill(18));
  };

  useEffect(() => {
    if (activeTab === 'approvals' || activeTab === 'memory' || activeTab === 'quick_notes') {
      setActivePage(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!initialCanvasMode) return;
    if (typeof initialCanvasMode.agencyId === 'number') {
      onSelectActiveAgency?.(initialCanvasMode.agencyId);
    }
    onChangeTab('chat');
    setCanvasMode(initialCanvasMode.mode);
    setActivePage('canvas');
  }, [initialCanvasMode]);

  useEffect(() => {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [chatInput]);

  useEffect(() => {
    if (activePage !== 'chat') return;
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, multimodalFeed.length, isThinking, activePage]);

  useEffect(() => {
    if (!plusMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        plusMenuContainerRef.current &&
        !plusMenuContainerRef.current.contains(e.target as Node)
      ) {
        setPlusMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [plusMenuOpen]);

  useEffect(() => {
    if (!sideDrawerOpen && !appDrawerOpen && !plusMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSideDrawerOpen(false);
        setAppDrawerOpen(false);
        setPlusMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sideDrawerOpen, appDrawerOpen, plusMenuOpen]);

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
      cleanupVoiceAnalyser();
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (noteStreamRef.current) {
        noteStreamRef.current.getTracks().forEach((t) => t.stop());
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

  const activeAssistant = useMemo(
    () =>
      SPECIALIZED_ASSISTANTS.find((a) => a.id === activeAssistantId) ||
      SPECIALIZED_ASSISTANTS[0],
    [activeAssistantId]
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

  useEffect(() => {
    setSlashIndex(0);
  }, [filteredSlashCommands.length]);

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
    openWorkspacePage('canvas', 'macro_studio');
    setSideDrawerOpen(false);
    setSummonNotice(`تم تشغيل ماكرو «${macro.name}» وعرض النتائج في اللوحة التفاعلية.`);
  };

  // --- Voice Message Recording (Chat Instructions / Quick Notes / Draft Text + Live Waveform) ---
  const stopVoiceMessageRecording = async (shouldSend: boolean) => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    cleanupVoiceAnalyser();

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
    const activeTargetMode = voiceTargetModeRef.current;
    setIsRecordingVoiceMsg(false);
    setRecordingSeconds(0);
    setLiveInterimText('');

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
    let voiceModelId: string | undefined;
    let voiceModelLabel: string | undefined;

    setTranscribingVoice(true);
    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const res = await fetch('/api/morrow/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: mime,
          targetMode: activeTargetMode,
          agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
          taskRouting,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        transcript?: string;
        modelId?: string;
        modelLabel?: string;
        error?: string;
      };
      if (res.ok && json.ok && json.transcript) {
        finalTranscript = json.transcript.trim();
        voiceModelId = json.modelId;
        voiceModelLabel = json.modelLabel;
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

    if (activeTargetMode === 'quick_note') {
      if (finalTranscript) {
        const matched = autoLinkQuickNoteToPerson(finalTranscript, persons, agencies);
        onAddQuickNote({
          text: finalTranscript,
          source: 'voice',
          syncToPerson: true,
        });
        const linkedAgencyName = matched.person
          ? agencies.find((a) => a.id === matched.person?.agencyId)?.name
          : undefined;
        setSummonNotice(
          matched.person
            ? `تم حفظ الملاحظة الصوتية وربطها تلقائياً بالعائلة «${matched.person.name}».`
            : 'تم حفظ الملاحظة الصوتية في سجل الملاحظات السريعة.'
        );
        setMultimodalFeed((prev) => [
          ...prev.slice(-15),
          {
            id: `voice_note_${Date.now()}`,
            createdAt: new Date().toISOString(),
            kind: 'voice_note',
            title: 'ملاحظة سريعة بالتسجيل الصوتي',
            body: finalTranscript,
            modelId: voiceModelId,
            modelLabel: voiceModelLabel,
            voiceMode: 'quick_note',
            linkedPersonName: matched.person?.name,
            linkedAgencyName,
            audioUrl,
            durationSec,
          },
        ]);
      } else {
        setMultimodalFeed((prev) => [
          ...prev.slice(-15),
          {
            id: `voice_${Date.now()}`,
            createdAt: new Date().toISOString(),
            kind: 'voice_note',
            title: 'تسجيل صوتي محفوظ',
            body: 'لم يتوفر نص مفرّغ — يمكنك الاستماع للتسجيل.',
            voiceMode: 'quick_note',
            audioUrl,
            durationSec,
          },
        ]);
      }
      return;
    }

    if (activeTargetMode === 'draft_text') {
      if (finalTranscript) {
        setChatInput((prev) => (prev.trim() ? `${prev.trim()} ${finalTranscript}` : finalTranscript));
        setSummonNotice(
          voiceModelId
            ? `تم تفريغ التسجيل الصوتي (${voiceModelId}) في مربع الكتابة للمراجعة قبل الإرسال.`
            : 'تم تفريغ التسجيل الصوتي في مربع الكتابة للمراجعة والتعديل قبل الإرسال.'
        );
        window.setTimeout(() => chatTextareaRef.current?.focus(), 60);
      }
      return;
    }

    setMultimodalFeed((prev) => [
      ...prev.slice(-15),
      {
        id: `voice_${Date.now()}`,
        createdAt: new Date().toISOString(),
        kind: 'voice_note',
        title: 'تعليمة صوتية لـ Morrow',
        body: finalTranscript || 'تم حفظ التسجيل الصوتي في المحادثة.',
        modelId: voiceModelId,
        modelLabel: voiceModelLabel,
        voiceMode: 'instruction',
        audioUrl,
        durationSec,
      },
    ]);

    if (finalTranscript) {
      submitChatPrompt(finalTranscript);
    }
  };

  const startVoiceMessageRecording = async (
    overrideMode?: 'instruction' | 'quick_note' | 'draft_text'
  ) => {
    setVoiceError(null);
    if (overrideMode) {
      updateVoiceTargetMode(overrideMode);
    }
    if (isRecordingVoiceMsg) {
      await stopVoiceMessageRecording(true);
      return;
    }

    pendingMicRetryTargetRef.current = 'chat';
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
      setLiveInterimText('');

      // Live audio frequency bars visualization
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!audioContextRef.current) return;
            analyser.getByteFrequencyData(data);
            const bars = Array.from({ length: 10 }, (_, idx) => {
              const raw = data[idx % data.length] || 0;
              return Math.max(16, Math.min(100, Math.round((raw / 255) * 100)));
            });
            setAudioLevels(bars);
            analyserRafRef.current = window.requestAnimationFrame(tick);
          };
          analyserRafRef.current = window.requestAnimationFrame(tick);
        }
      } catch {
        // Audio meter is visual only; recording continues smoothly without it
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };
      recorder.start();

      // Optional live Web Speech capture alongside audio recording for real-time preview & offline fallback
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
            if (txt) {
              liveSpeechTranscriptRef.current = txt;
              setLiveInterimText(txt);
            }
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
      cleanupVoiceAnalyser();
      setVoiceError('تعذر بدء التسجيل الصوتي.');
      setMicPermissionGuide(buildPermissionRecoveryGuide('microphone'));
    }
  };

  // Voice recording & transcription for Quick Notes secondary tab (MediaRecorder + Gemini Transcribe + Speech API fallback)
  const toggleNoteVoiceDictation = async () => {
    setVoiceError(null);

    if (isNoteRecording) {
      setIsNoteRecording(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      const recorder = noteMediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          try {
            recorder.stop();
          } catch {
            resolve();
          }
        });
      }
      noteStreamRef.current?.getTracks().forEach((t) => t.stop());
      noteStreamRef.current = null;
      noteMediaRecorderRef.current = null;

      const mime = recorder?.mimeType || 'audio/webm';
      const audioBlob = new Blob(noteRecordedChunksRef.current, { type: mime });
      noteRecordedChunksRef.current = [];
      let transcript = noteLiveTranscriptRef.current.trim();
      noteLiveTranscriptRef.current = '';

      if (audioBlob.size >= 400) {
        setTranscribingNoteVoice(true);
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          const res = await fetch('/api/morrow/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: mime,
              targetMode: 'quick_note',
              agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
              taskRouting,
            }),
          });
          const json = (await res.json()) as {
            ok?: boolean;
            transcript?: string;
            error?: string;
          };
          if (res.ok && json.ok && json.transcript) {
            transcript = json.transcript.trim();
          } else if (!transcript && json.error) {
            setVoiceError(json.error);
          }
        } catch {
          if (!transcript) {
            setVoiceError('تعذر تفريغ التسجيل الصوتي عبر الخادم.');
          }
        } finally {
          setTranscribingNoteVoice(false);
        }
      }

      if (transcript) {
        setNoteInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
        setNoteSource('voice');
      }
      return;
    }

    pendingMicRetryTargetRef.current = 'note';
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
      noteStreamRef.current = stream;
      noteRecordedChunksRef.current = [];
      noteLiveTranscriptRef.current = '';

      const recorder = new MediaRecorder(stream);
      noteMediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          noteRecordedChunksRef.current.push(ev.data);
        }
      };
      recorder.start();

      const w = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (Ctor) {
        try {
          const rec = new Ctor();
          rec.lang = 'ar-IQ';
          rec.interimResults = true;
          rec.continuous = true;
          rec.onresult = (ev) => {
            const transcriptParts: string[] = [];
            for (let i = 0; i < ev.results.length; i++) {
              transcriptParts.push(ev.results[i][0]?.transcript || '');
            }
            const combined = transcriptParts.join(' ').trim();
            if (combined) {
              noteLiveTranscriptRef.current = combined;
              setNoteInput(combined);
              setNoteSource('voice');
            }
          };
          rec.onerror = () => {};
          rec.onend = () => {};
          recognitionRef.current = rec;
          rec.start();
        } catch {
          // MediaRecorder handles transcription seamlessly on stop
        }
      }

      setIsNoteRecording(true);
    } catch {
      setIsNoteRecording(false);
      setVoiceError('تعذر بدء التسجيل الصوتي للملاحظات.');
      setMicPermissionGuide(buildPermissionRecoveryGuide('microphone'));
    }
  };

  // --- File, Audio & Camera Attachment Handling ---
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
      if (activePage !== 'chat') {
        openWorkspacePage('chat');
      }
    } catch {
      setVoiceError('تعذر تجهيز الملف المرفق للقراءة.');
    }
  };

  const analyzeAttachedDocument = async (customQuestion?: string) => {
    if (!attachedFile || analyzingAttachment) return;
    const target = attachedFile;
    setAnalyzingAttachment(true);
    setAttachedFile(null);

    const isAudio =
      target.mimeType.startsWith('audio/') ||
      /\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(target.name);
    const isPlainText =
      target.mimeType.startsWith('text/') ||
      target.mimeType === 'application/json' ||
      /\.(txt|csv|json|md)$/i.test(target.name);

    try {
      if (isAudio) {
        const audioUrl = URL.createObjectURL(target.file);
        const res = await fetch('/api/morrow/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: target.dataBase64,
            mimeType: target.mimeType.startsWith('audio/')
              ? target.mimeType
              : 'audio/mpeg',
            targetMode: 'instruction',
            agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
            taskRouting,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          transcript?: string;
          modelId?: string;
          modelLabel?: string;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.transcript) {
          setMultimodalFeed((prev) => [
            ...prev.slice(-15),
            {
              id: `audio_${Date.now()}`,
              createdAt: new Date().toISOString(),
              kind: 'voice_note',
              title: target.name,
              body: '',
              audioUrl,
              errorText:
                json.error || 'تعذر تفريغ الملف الصوتي سحابياً — يمكنك الاستماع إليه هنا.',
            },
          ]);
          return;
        }
        const transcript = json.transcript.trim();
        setMultimodalFeed((prev) => [
          ...prev.slice(-15),
          {
            id: `audio_${Date.now()}`,
            createdAt: new Date().toISOString(),
            kind: 'voice_note',
            title: `تفريغ ملف صوتي: ${target.name}`,
            body: transcript,
            modelId: json.modelId,
            modelLabel: json.modelLabel,
            voiceMode: 'instruction',
            audioUrl,
          },
        ]);
        if (customQuestion) {
          onSendMessage(`${customQuestion}\n\nالنص المفرّغ من الملف الصوتي:\n${transcript}`);
        }
        return;
      }

      if (isPlainText) {
        const rawText = (await target.file.text()).slice(0, 6000).trim();
        const promptBody = customQuestion
          ? `${customQuestion}\n\nمحتوى الملف (${target.name}):\n${rawText}`
          : `حلل محتوى الملف التالي (${target.name}) ولخّص أهم النقاط:\n${rawText}`;
        onSendMessage(promptBody);
        return;
      }

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
          taskRouting,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        modelId?: string;
        modelLabel?: string;
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
          modelId: json.modelId,
          modelLabel: json.modelLabel,
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
        openWorkspacePage('canvas', decision.canvasMode);
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

  const isMainConversationView = activePage === 'chat';

  const hasConversationContent =
    !(
      filteredMessages.length <= 1 &&
      (!filteredMessages[0] || filteredMessages[0].id.startsWith('welcome_msg_')) &&
      multimodalFeed.length === 0 &&
      !historySearch &&
      !showPinnedOnly
    );

  return (
    <div
      dir="rtl"
      data-testid="morrow-command-center"
      onDragOver={(e) => {
        if (!isMainConversationView) return;
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          if (!isDraggingFile) setIsDraggingFile(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDraggingFile(false);
        }
      }}
      onDrop={(e) => {
        if (!isMainConversationView) return;
        e.preventDefault();
        setIsDraggingFile(false);
        const dropped = e.dataTransfer?.files?.[0];
        if (dropped) {
          void handleQueueFile(dropped);
        }
      }}
      className="capsule-fullscreen-shell morrow-obsidian-shell relative flex min-h-[100dvh] flex-col [overflow-x:clip]"
    >
      {/* Hidden File & Audio Pickers */}
      <input
        ref={filePickerRef}
        type="file"
        accept="image/*,application/pdf,.txt,.csv,.json,.md"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleQueueFile(f);
        }}
      />
      <input
        ref={audioPickerRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleQueueFile(f);
        }}
      />

      {/* Drag-and-Drop Overlay for Instant PDF / Image / Audio Inspection */}
      {isDraggingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          style={{
            backgroundColor: 'rgba(2, 3, 8, 0.72)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            className="rounded-3xl border-2 border-dashed px-8 py-6 text-center shadow-2xl"
            style={{
              backgroundColor: 'rgba(13, 15, 22, 0.95)',
              borderColor: 'var(--accent)',
              color: 'var(--text-primary)',
            }}
          >
            <Paperclip className="mx-auto mb-2 h-7 w-7" style={{ color: 'var(--accent)' }} />
            <div className="text-sm font-black">أفلت الملف هنا لتحليله فوراً</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              يدعم كشوفات PDF، الصور، الملفات الصوتية، والنصوص
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          DUAL HAMBURGER TOP NAVIGATION BAR (RTL)
          Right (RTL Start): App Main Menu (☰)
          Center: Active Model / Assistant Pill (Morrow ▾)
          Left (RTL End): New Chat + Morrow AI & Models Menu (☰)
         ==================================================================== */}
      <header
        className="no-print nexus-glass-lite sticky top-0 z-30 border-b"
        style={{
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="mx-auto grid h-12 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5">
          {/* Right Side (RTL Start): App Main Hamburger Menu */}
          <div className="flex items-center justify-start min-w-0">
            <button
              type="button"
              data-testid="morrow-app-drawer-toggle"
              onClick={() => setAppDrawerOpen(true)}
              aria-label="قائمة أقسام التطبيق الرئيسية"
              title="قائمة التطبيق"
              className="nexus-pill-btn inline-flex h-8 items-center justify-center gap-1.5 border px-2.5 sm:px-3 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Menu className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">التطبيق</span>
            </button>
          </div>

          {/* Center: Active Model / Assistant Selector Pill */}
          <div className="flex items-center justify-center min-w-0">
            <button
              type="button"
              data-testid="morrow-brand-switcher"
              onClick={() => setModelMenuOpen((v) => !v)}
              aria-expanded={modelMenuOpen}
              aria-haspopup="dialog"
              aria-label="تبديل النموذج أو نمط Morrow"
              className="topbar-context-enter nexus-pill-btn inline-flex h-8 items-center gap-1.5 border px-3.5 text-xs font-bold min-w-0"
              style={{
                backgroundColor: modelMenuOpen
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-surface)',
                borderColor: modelMenuOpen
                  ? 'var(--accent-ai, #5B4FE9)'
                  : 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
              <span className="text-xs sm:text-sm font-black tracking-tight leading-none whitespace-nowrap">
                Morrow
              </span>
              <span
                className="hidden sm:inline truncate max-w-[120px] text-[11px] font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                · {activeBrain.shortLabel}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                  modelMenuOpen ? 'rotate-180' : ''
                }`}
                style={{ color: 'var(--text-muted)' }}
              />
            </button>
          </div>

          {/* Left Side (RTL End): New Chat + Morrow AI & Models Hamburger Menu */}
          <div className="flex items-center justify-end gap-1.5 min-w-0">
            {isMainConversationView && onClearMessages && messages.length > 1 && (
              <button
                type="button"
                onClick={onClearMessages}
                aria-label="بدء محادثة جديدة"
                title="محادثة جديدة"
                className="nexus-pill-btn inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <SquarePen className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="hidden md:inline">جديد</span>
              </button>
            )}

            <button
              type="button"
              data-testid="morrow-side-drawer-toggle"
              onClick={() => setSideDrawerOpen(true)}
              aria-label="قائمة أدوات ونماذج Morrow"
              title="قائمة Morrow والنماذج"
              className="nexus-pill-btn inline-flex h-8 items-center justify-center gap-1.5 border px-2.5 sm:px-3 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor:
                  sideFeatureBadgeCount > 0 ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                borderColor:
                  sideFeatureBadgeCount > 0 ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
                color: sideFeatureBadgeCount > 0 ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
              }}
            >
              <span className="hidden md:inline">ذكاء Morrow</span>
              {sideFeatureBadgeCount > 0 && (
                <span
                  className="text-[11px] font-black tabular-nums"
                  style={{ color: 'var(--accent-ai, #5B4FE9)' }}
                >
                  {sideFeatureBadgeCount}
                </span>
              )}
              <Menu className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          PAGE 1 (DEFAULT): CENTERED CHAT WORKSPACE + FLOATING PILL BAR
         ==================================================================== */}
      {isMainConversationView && (
        <main className="mx-auto flex h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col px-3 pt-3 pb-4 sm:px-6 sm:pt-4 sm:pb-6 min-h-0">
          {summonNotice && (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold shrink-0"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'rgba(129, 140, 248, 0.42)',
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

          {/* Scrollable Conversation Area / Centered Minimal Empty State */}
          <div className="flex-1 min-h-0 overflow-y-auto pb-4 flex flex-col">
            {!hasConversationContent ? (
              <section
                aria-label="شاشة بداية Morrow"
                className="my-auto mx-auto flex w-full max-w-xl flex-col items-center justify-center py-6 text-center space-y-6"
              >
                {/* Centered Glowing 3D Electric Indigo AI Orb */}
                <div
                  className="nexus-orb-3d relative flex h-24 w-24 items-center justify-center"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 48 48"
                    className="h-10 w-10 drop-shadow-[0_2px_10px_rgba(255,255,255,0.35)]"
                    fill="none"
                  >
                    <path
                      d="M24 6C25.9 15.8 32.2 22.1 42 24C32.2 25.9 25.9 32.2 24 42C22.1 32.2 15.8 25.9 6 24C15.8 22.1 22.1 15.8 24 6Z"
                      stroke="#FFFFFF"
                      strokeWidth="2.1"
                      strokeLinejoin="round"
                      fill="rgba(255, 255, 255, 0.22)"
                    />
                    <circle cx="24" cy="24" r="3.4" fill="#FFFFFF" />
                  </svg>
                </div>

                <div className="space-y-2.5">
                  <h1
                    className="text-3xl sm:text-4xl font-black tracking-tight"
                    style={{ textWrap: 'balance', color: 'var(--text-primary)' }}
                  >
                    من أين نبدأ؟
                  </h1>
                  <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                    {activeAssistant.name} ·{' '}
                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {activeAgency?.name || 'جميع الوكالات'}
                    </span>
                    {activePeriodLabel ? ` · ${activePeriodLabel}` : ''}
                  </p>
                </div>

                {/* Minimal Quick-Action Chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => submitChatPrompt('أعطني ملخص اليوم')}
                    className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                    <span>ملخص اليوم</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => submitChatPrompt('ماذا لو رسم الفرد 500')}
                    className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                    <span>محاكاة مالية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => submitChatPrompt('قارن بين الوكالات')}
                    className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                    <span>مقارنة الوكالات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => submitChatPrompt('افحص التطبيق')}
                    className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                    <span>فحص السجلات</span>
                  </button>
                </div>

                {/* Subtle Dynamic Suggestion Chips if present */}
                {smartSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {smartSuggestions.slice(0, 2).map((sug) => (
                      <button
                        key={sug.id}
                        type="button"
                        onClick={() => submitChatPrompt(sug.prompt)}
                        className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors hover:text-slate-100"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <MorrowMessageCard
                    key={msg.id}
                    message={msg}
                    copied={copiedMsgId === msg.id}
                    speaking={speakingMsgId === msg.id}
                    hasUndoableAction={hasUndoableAction}
                    onCopy={handleCopyMessage}
                    onTogglePin={onTogglePinMessage}
                    onRetry={onRetryLastPrompt ? () => onRetryLastPrompt() : undefined}
                    onSpeak={(id, text) => void handleSpeakMessage(id, text)}
                    onSaveQuickNote={(txt) => {
                      onAddQuickNote({
                        text: txt,
                        source: 'text',
                        syncToPerson: true,
                      });
                      setSummonNotice(
                        'تم حفظ الرد في الملاحظات السريعة وربطه تلقائياً إذا تضمن اسماً.'
                      );
                    }}
                    onChoiceClick={onChoiceClick}
                    onResolveDiff={onResolveDiff}
                    onTriggerSpotlight={onTriggerSpotlight}
                    onTriggerCanvasHandoff={(handoff: AssistantCanvasHandoff) => {
                      if (typeof handoff.agencyId === 'number') {
                        onSelectActiveAgency?.(handoff.agencyId);
                      }
                      openWorkspacePage('canvas', handoff.canvasMode);
                    }}
                    onUndoLastAction={onUndoLastAction}
                    onSendPrompt={(prompt) => submitChatPrompt(prompt)}
                  />
                ))}

                {multimodalFeed.map((item) => (
                  <div
                    key={item.id}
                    className="nexus-squircle p-4 space-y-2.5 text-xs sm:text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-extrabold">
                        {item.kind === 'voice_note' ? (
                          <Volume2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                        ) : item.kind === 'live_summary' ? (
                          <Radio className="h-4 w-4" style={{ color: '#34d399' }} />
                        ) : (
                          <FileText className="h-4 w-4" style={{ color: '#38bdf8' }} />
                        )}
                        <span>{item.title}</span>
                      </div>
                      <div
                        className="flex items-center gap-2 font-mono text-[11px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {item.modelId && (
                          <span
                            dir="ltr"
                            style={{ color: 'var(--accent)' }}
                            title={item.modelLabel || item.modelId}
                          >
                            {item.modelId}
                          </span>
                        )}
                        {item.durationSec !== undefined && (
                          <span>
                            {item.modelId ? '· ' : ''}
                            {String(Math.floor(item.durationSec / 60)).padStart(2, '0')}:
                            {String(item.durationSec % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
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

                    {item.linkedPersonName && (
                      <div
                        className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold"
                        style={{
                          backgroundColor: 'var(--bg-nav-active)',
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                        }}
                      >
                        <Link2 className="h-3 w-3" />
                        <span>
                          مربوطة تلقائياً بالعائلة: {item.linkedPersonName}
                          {item.linkedAgencyName ? ` (${item.linkedAgencyName})` : ''}
                        </span>
                      </div>
                    )}

                    {item.kind === 'voice_note' && item.body && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {item.voiceMode === 'quick_note' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openWorkspacePage('quick_notes')}
                              className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold hover:border-[var(--accent)]"
                              style={{
                                backgroundColor: 'rgba(19, 20, 26, 0.85)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <StickyNote className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                              <span>فتح في الملاحظات السريعة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => submitChatPrompt(item.body)}
                              className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold hover:border-[var(--accent)]"
                              style={{
                                backgroundColor: 'rgba(19, 20, 26, 0.85)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <Sparkles className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                              <span>تنفيذ كتعليمة للذكاء</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onAddQuickNote({
                                text: item.body,
                                source: 'voice',
                                syncToPerson: true,
                              });
                              setSummonNotice('تم حفظ نص التسجيل الصوتي كملاحظة سريعة.');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold hover:border-[var(--accent)]"
                            style={{
                              backgroundColor: 'rgba(19, 20, 26, 0.85)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <StickyNote className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                            <span>حفظ أيضاً كملاحظة سريعة</span>
                          </button>
                        )}
                      </div>
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
                              if (staged > 0) openWorkspacePage('approvals');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-extrabold hover:border-[var(--accent)]"
                            style={{
                              backgroundColor: 'var(--bg-nav-active)',
                              borderColor: 'var(--accent)',
                              color: 'var(--accent)',
                            }}
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            <span>تجهيز {item.suggestedTools.length} مسودة للموافقة</span>
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
                    className="flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold"
                    style={{
                      backgroundColor: 'rgba(13, 15, 22, 0.9)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)' }} />
                      <span>
                        {analyzingAttachment
                          ? 'جاري قراءة وتحليل الملف المرفق...'
                          : transcribingVoice
                            ? 'جاري تفريغ الرسالة الصوتية ومعالجتها...'
                            : 'جاري اختيار النموذج الأنسب ومعالجة طلبك...'}
                      </span>
                    </div>
                    {isThinking && onCancelRequest && (
                      <button
                        type="button"
                        onClick={onCancelRequest}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: 'rgba(19, 20, 26, 0.85)',
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

                <div ref={chatScrollRef} />
              </div>
            )}
          </div>

          {/* Inline Microphone Permission Recovery Card (Zero Stacked Modal) */}
          {micPermissionGuide && (
            <div
              className="mb-2.5 rounded-2xl border p-3.5 text-xs space-y-2 shrink-0"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderColor: 'rgba(251, 191, 36, 0.4)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-extrabold" style={{ color: 'var(--warning)' }}>
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{micPermissionGuide.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    pendingMicRetryTargetRef.current = null;
                    setMicPermissionGuide(null);
                  }}
                  aria-label="إغلاق تنبيه إذن الميكروفون"
                  className="p-0.5 hover:opacity-75"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>{micPermissionGuide.reason}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = pendingMicRetryTargetRef.current;
                    setMicPermissionGuide(null);
                    if (target === 'note') void toggleNoteVoiceDictation();
                    else void startVoiceMessageRecording();
                  }}
                  className="rounded-xl px-3 py-1.5 text-[11px] font-extrabold whitespace-nowrap"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  إعادة طلب الإذن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pendingMicRetryTargetRef.current = null;
                    setMicPermissionGuide(null);
                    window.setTimeout(() => chatTextareaRef.current?.focus(), 60);
                  }}
                  className="rounded-xl border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  الكتابة النصية الآن
                </button>
              </div>
            </div>
          )}

          {/* Voice / File Error Feedback if any */}
          {voiceError && !micPermissionGuide && (
            <div
              className="mb-2.5 flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold shrink-0"
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

          {/* ================================================================
              FLOATING DARK GLASSMORPHIC PILL INPUT BAR (#13141A)
              Right (+ Attachment) | Center (Auto-Expanding Input) | Left (Mic + Live Waveform)
             ================================================================ */}
          <div className="relative mt-auto shrink-0" ref={plusMenuContainerRef}>
            {/* Full-Screen Push Attachment & Quick Tool Menu */}
            <FullScreenPushPage
              open={plusMenuOpen}
              onBack={() => setPlusMenuOpen(false)}
              title="إرفاق ملف أو تشغيل أداة ذكية"
              subtitle="اختر ملفاً أو صورة أو صوتاً أو افتح أداة التحليل مباشرة"
              icon={
                <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                  <Plus className="h-4 w-4" />
                </NexusDuotoneIcon>
              }
              maxWidthClass="max-w-xl"
              zIndexClass="z-[var(--z-sheet)]"
              ariaLabel="قائمة الإرفاق والأدوات السريعة"
            >
              <div className="nexus-squircle p-4 sm:p-5 space-y-2.5">
                <button
                  type="button"
                  data-testid="morrow-upload-trigger-card"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    filePickerRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-right text-xs font-bold transition-colors hover:border-[var(--accent-ai)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                    <Paperclip className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">ملف أو صورة (PDF / نصوص)</div>
                    <div className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                      قراءة الكشوفات، الجداول، والمستندات
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    audioPickerRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-right text-xs font-bold transition-colors hover:border-[var(--accent-ai)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                    <Volume2 className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">ملف صوتي للتفريغ والتحليل</div>
                    <div className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                      MP3, WAV, M4A عبر محرك Whisper
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    openWorkspacePage('camera');
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-right text-xs font-bold transition-colors hover:border-[var(--accent-ai)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                    <Camera className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">التقاط مباشر بالكاميرا</div>
                    <div className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                      تصوير كشف أو ورقة وتحليلها فوراً
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    openWorkspacePage('canvas');
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-right text-xs font-bold transition-colors hover:border-[var(--accent-ai)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                    <BarChart3 className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">فتح اللوحة التفاعلية 2.0</div>
                    <div className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                      رسوم الأرباح، الجداول، والتوقعات
                    </div>
                  </div>
                </button>
              </div>
            </FullScreenPushPage>

            {/* Slash Command Quick Launcher (above pill when typing /) */}
            {filteredSlashCommands.length > 0 && (
              <div
                className="mb-2.5 rounded-2xl border p-2 space-y-1 max-h-52 overflow-y-auto shadow-2xl"
                style={{
                  backgroundColor: '#13141a',
                  borderColor: 'rgba(129, 140, 248, 0.35)',
                }}
              >
                <div className="px-2 py-1 text-[10px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  أوامر Morrow الفورية (أسهم للتنقل · Enter للتنفيذ):
                </div>
                {filteredSlashCommands.map((sc, idx) => {
                  const highlighted = idx === slashIndex;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onMouseEnter={() => setSlashIndex(idx)}
                      onClick={() => {
                        setChatInput('');
                        if (sc.startVoice) {
                          void startVoiceMessageRecording(sc.startVoice);
                          return;
                        }
                        if (sc.openTab) {
                          openWorkspacePage(sc.openTab);
                          return;
                        }
                        if (sc.runVerifier) {
                          openWorkspacePage('diagnostics');
                          void handleRunSystemVerifier();
                          return;
                        }
                        if (sc.canvasMode) {
                          openWorkspacePage('canvas', sc.canvasMode);
                          return;
                        }
                        if (sc.prompt) {
                          submitChatPrompt(sc.prompt);
                        }
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-right text-xs transition-colors"
                      style={{
                        backgroundColor: highlighted ? 'var(--bg-nav-active)' : 'transparent',
                      }}
                    >
                      <div className="min-w-0">
                        <span className="font-extrabold">{sc.label}</span>
                        <span className="mr-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {sc.desc}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold shrink-0" style={{ color: 'var(--accent)' }}>
                        {sc.cmd}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="morrow-composer-pill rounded-[28px] border px-2.5 py-2 sm:px-3 sm:py-2.5 space-y-2">
              {/* Pending Attached Document / Photo / Audio Preview */}
              {attachedFile && (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2 text-xs"
                  style={{
                    backgroundColor: 'rgba(5, 5, 8, 0.72)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attachedFile.previewUrl ? (
                      <img
                        src={attachedFile.previewUrl}
                        alt={attachedFile.name}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 rounded-xl border object-cover shrink-0"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                        style={{
                          backgroundColor: 'rgba(19, 20, 26, 0.9)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <FileText className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">{attachedFile.name}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        اكتب سؤالك عن الملف أو اضغط تحليل مباشرة
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
                          backgroundColor: 'rgba(19, 20, 26, 0.9)',
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
                        backgroundColor: 'rgba(19, 20, 26, 0.9)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Active Voice Recording Studio Strip (Live Waveform + Destination Switcher) */}
              {isRecordingVoiceMsg && (
                <div
                  data-testid="morrow-voice-recording-strip"
                  className="rounded-2xl border p-3 text-xs space-y-2"
                  style={{
                    backgroundColor: 'var(--danger-bg)',
                    borderColor: 'var(--danger)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 font-extrabold" style={{ color: 'var(--danger)' }}>
                      <Mic className="h-4 w-4 shrink-0" />
                      <span>جاري التسجيل الصوتي...</span>
                      <span className="font-mono tabular-nums">
                        {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                        {String(recordingSeconds % 60).padStart(2, '0')}
                      </span>

                      <span className="inline-flex h-4 items-end gap-0.5 px-1" aria-hidden="true">
                        {audioLevels.map((lvl, idx) => (
                          <span
                            key={idx}
                            className="w-1 rounded-full transition-all duration-75"
                            style={{
                              height: `${Math.max(20, lvl)}%`,
                              backgroundColor: 'var(--danger)',
                            }}
                          />
                        ))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void stopVoiceMessageRecording(false)}
                        className="rounded-lg border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: 'rgba(19, 20, 26, 0.9)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => void stopVoiceMessageRecording(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-extrabold whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--danger)',
                          color: '#ffffff',
                        }}
                      >
                        <Square className="h-3 w-3" />
                        <span>
                          {voiceTargetMode === 'quick_note'
                            ? 'إيقاف وحفظ الملاحظة'
                            : voiceTargetMode === 'draft_text'
                              ? 'إيقاف وإدراج النص'
                              : 'إيقاف وتنفيذ'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                      الوجهة عند الإيقاف:
                    </span>
                    {(
                      [
                        { id: 'instruction', label: 'تعليمات للذكاء' },
                        { id: 'quick_note', label: 'ملاحظة سريعة' },
                        { id: 'draft_text', label: 'تحرير في المربع' },
                      ] as const
                    ).map((opt) => {
                      const active = voiceTargetMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateVoiceTargetMode(opt.id)}
                          className="rounded-lg border px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap"
                          style={{
                            backgroundColor: active ? 'var(--accent)' : 'rgba(19, 20, 26, 0.85)',
                            borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                            color: active ? 'var(--accent-fg)' : 'var(--text-primary)',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {liveInterimText && (
                    <div
                      className="rounded-xl border px-3 py-1.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: 'rgba(19, 20, 26, 0.9)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {liveInterimText}
                    </div>
                  )}
                </div>
              )}

              {/* Main Pill Row: Right (+) | Center (Input) | Left (Mic + Live Waveform) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitChatPrompt();
                }}
                className="flex items-end gap-1.5 sm:gap-2"
              >
                {/* Right inside pill (RTL Start): + Attachment Trigger */}
                <button
                  type="button"
                  data-testid="morrow-plus-attach-btn"
                  onClick={() => setPlusMenuOpen((v) => !v)}
                  aria-expanded={plusMenuOpen}
                  aria-label="إرفاق ملف أو صورة أو صوت"
                  title="إرفاق ملف، صورة، أو صوت"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: plusMenuOpen
                      ? 'var(--bg-nav-active)'
                      : 'rgba(255, 255, 255, 0.04)',
                    borderColor: plusMenuOpen
                      ? 'var(--accent)'
                      : 'rgba(148, 163, 184, 0.14)',
                    color: plusMenuOpen ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  <Plus
                    className={`h-5 w-5 transition-transform ${plusMenuOpen ? 'rotate-45' : ''}`}
                  />
                </button>

                {/* Center: Auto-Expanding Textarea */}
                <textarea
                  ref={chatTextareaRef}
                  rows={1}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (filteredSlashCommands.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSlashIndex((i) => (i + 1) % filteredSlashCommands.length);
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSlashIndex(
                          (i) => (i - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
                        );
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setChatInput('');
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const sc = filteredSlashCommands[slashIndex] || filteredSlashCommands[0];
                        setChatInput('');
                        if (sc.startVoice) void startVoiceMessageRecording(sc.startVoice);
                        else if (sc.openTab) openWorkspacePage(sc.openTab);
                        else if (sc.runVerifier) {
                          openWorkspacePage('diagnostics');
                          void handleRunSystemVerifier();
                        } else if (sc.canvasMode) openWorkspacePage('canvas', sc.canvasMode);
                        else if (sc.prompt) submitChatPrompt(sc.prompt);
                        return;
                      }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitChatPrompt();
                    }
                  }}
                  placeholder={
                    attachedFile
                      ? 'اكتب سؤالك حول الملف المرفق أو اضغط إرسال...'
                      : 'يمكنك كتابة سؤالك هنا...'
                  }
                  className="min-h-[40px] w-full min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-xs sm:text-sm leading-relaxed outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />

                {/* Left inside pill (RTL End): Quick Mic + Send/Stop + Glowing Live Waveform */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid="morrow-voice-record-btn"
                    disabled={checkingMicPermission || transcribingVoice}
                    onClick={() => void startVoiceMessageRecording()}
                    title="تسجيل ملاحظة صوتية"
                    aria-label="تسجيل ملاحظة صوتية"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    style={{
                      backgroundColor: isRecordingVoiceMsg ? 'var(--danger)' : 'transparent',
                      color: isRecordingVoiceMsg ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    {checkingMicPermission || transcribingVoice ? (
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)' }} />
                    ) : isRecordingVoiceMsg ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>

                  {isThinking && onCancelRequest ? (
                    <button
                      type="button"
                      onClick={onCancelRequest}
                      aria-label="إيقاف"
                      className="nexus-pill-btn inline-flex h-10 w-10 items-center justify-center border shrink-0"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.14)',
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                      }}
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  ) : (chatInput.trim() || attachedFile) ? (
                    <button
                      type="submit"
                      disabled={isThinking || analyzingAttachment}
                      aria-label="إرسال"
                      className="nexus-pill-btn inline-flex h-10 w-10 items-center justify-center shrink-0 hover:opacity-95 disabled:opacity-45"
                      style={{
                        backgroundColor: 'var(--accent-ai, #5B4FE9)',
                        color: '#FFFFFF',
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  ) : null}

                  {/* Circular Glowing Electric Indigo Live Audio Waveform Button */}
                  <button
                    type="button"
                    data-testid="morrow-start-live-btn"
                    onClick={() => openWorkspacePage('live')}
                    title="محادثة صوتية مباشرة لايف"
                    aria-label="بدء المحادثة الصوتية المباشرة لايف"
                    className="nexus-pill-btn inline-flex h-10 w-10 items-center justify-center shrink-0 transition-transform hover:scale-[1.04]"
                    style={{
                      background:
                        'linear-gradient(135deg, #5B4FE9 0%, #818CF8 100%)',
                      color: '#FFFFFF',
                      boxShadow:
                        '0 0 22px rgba(91, 79, 233, 0.58), 0 0 8px rgba(129, 140, 248, 0.35)',
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      aria-hidden="true"
                    >
                      <rect x="4" y="9" width="2.2" height="6" rx="1.1" fill="currentColor" />
                      <rect x="8.2" y="5" width="2.2" height="14" rx="1.1" fill="currentColor" />
                      <rect x="12.4" y="7" width="2.2" height="10" rx="1.1" fill="currentColor" />
                      <rect x="16.6" y="4" width="2.2" height="16" rx="1.1" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      )}

      {/* ====================================================================
          STANDALONE FULL-PAGE SUB-VIEWS (Zero Nested Modals / Popups)
         ==================================================================== */}
      {activePage === 'history' && (
        <MorrowHistoryPage
          chatThreads={chatThreads}
          activeThreadId={activeThreadId}
          messages={messages}
          historySearch={historySearch}
          onChangeHistorySearch={setHistorySearch}
          showPinnedOnly={showPinnedOnly}
          onTogglePinnedOnly={() => setShowPinnedOnly((v) => !v)}
          onSwitchThread={onSwitchThread}
          onDeleteThread={onDeleteThread}
          onNewChat={onClearMessages}
          onExportChatHistory={onExportChatHistory}
          onOpenChat={() => openWorkspacePage('chat')}
        />
      )}

      {activePage === 'models' && (
        <MorrowModelsPage
          brainMode={brainMode}
          onChangeBrainMode={onChangeBrainMode}
          brainOptions={BRAIN_BUTTONS}
          collaborationMode={collaborationMode}
          onChangeCollaborationMode={onChangeCollaborationMode}
          collaborationOptions={COLLABORATION_MODE_OPTIONS}
          responseStyle={responseStyle}
          onChangeResponseStyle={onChangeResponseStyle}
          connectivity={connectivity}
          modelHealthSnapshots={modelHealthSnapshots}
          onOpenAppAiStudio={
            onOpenAiModelsStudio
              ? onOpenAiModelsStudio
              : onNavigateView
                ? () => onNavigateView('settings', 'ai_assistant')
                : undefined
          }
          onBackToChat={() => openWorkspacePage('chat')}
        />
      )}

      {activePage === 'assistants' && (
        <MorrowAssistantsPage
          activeAssistantId={activeAssistantId}
          onActivateAssistant={handleSelectAssistantProfile}
          onBackToChat={() => openWorkspacePage('chat')}
        />
      )}

      {activePage === 'canvas' && (
        <main
          aria-label="اللوحة التفاعلية والأدوات الذكية"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          <MorrowSubPageHeader
            title="اللوحة التفاعلية والأدوات 2.0"
            subtitle="رسوم بيانية حية، تحرير جدول مباشر، تقارير تنفيذية، وتوقعات الماكرو"
            onBack={() => openWorkspacePage('chat')}
          />
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
                openWorkspacePage('approvals');
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
              openWorkspacePage('chat');
              submitChatPrompt(prompt);
            }}
            cloudConfigured={cloudConfigured}
            taskRouting={taskRouting}
          />
        </main>
      )}

      {activePage === 'approvals' && (
        <main
          aria-label="طابور المهام والمراجعة"
          data-testid="morrow-approvals-panel"
          className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8"
        >
          <MorrowSubPageHeader
            title="طابور المهام والمراجعة"
            subtitle="مراجعة واعتماد مسودات التعديل قبل تطبيقها على الجداول والمصاريف"
            onBack={() => openWorkspacePage('chat')}
            rightSlot={
              <button
                type="button"
                onClick={() => {
                  openWorkspacePage('chat');
                  onSendMessage('صلح مشاكل الفحص تلقائياً');
                }}
                className="nexus-pill-btn inline-flex h-9 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span>فحص وتوليد مسودة إصلاح</span>
              </button>
            }
          />

          <div className="nexus-squircle p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base font-extrabold">
                مسودات بانتظار موافقتك ({pendingDrafts.length})
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                لا يعدّل المساعد أي سجل أو مصروف أو معادلة حاسبة بشكل مباشر — كل عملية تصل هنا للمراجعة أولاً وتُنفذ فقط بعد موافقتك.
              </p>
            </div>

            {pendingDrafts.length === 0 ? (
              <div
                className="rounded-2xl border px-4 py-10 text-center text-xs space-y-2"
                style={{
                  backgroundColor: 'rgba(19, 20, 26, 0.7)',
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
                      backgroundColor: 'rgba(19, 20, 26, 0.88)',
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
                            backgroundColor: 'rgba(13, 15, 22, 0.9)',
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
                          backgroundColor: 'rgba(13, 15, 22, 0.9)',
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
            <div className="nexus-squircle p-5 sm:p-6 space-y-3">
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
                      backgroundColor: 'rgba(19, 20, 26, 0.72)',
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

      {activePage === 'memory' && (
        <main
          aria-label="قواعد الذاكرة الدائمة"
          data-testid="morrow-memory-panel"
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          <MorrowSubPageHeader
            title="الذاكرة والقواعد الدائمة"
            subtitle="القواعد المحفوظة هنا تُطبّق تلقائياً على جميع صادرات PDF وExcel دون الحاجة لتكرار التعليمات"
            onBack={() => openWorkspacePage('chat')}
          />

          <div className="nexus-squircle p-5 sm:p-6 space-y-5">
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
                      backgroundColor: enabled
                        ? 'var(--bg-nav-active)'
                        : 'rgba(19, 20, 26, 0.72)',
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
                        backgroundColor: enabled ? 'var(--accent)' : 'rgba(13, 15, 22, 0.9)',
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
                backgroundColor: 'rgba(19, 20, 26, 0.75)',
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
                  backgroundColor: 'rgba(13, 15, 22, 0.9)',
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
                    backgroundColor: 'rgba(19, 20, 26, 0.72)',
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
                      backgroundColor: 'rgba(19, 20, 26, 0.72)',
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
                        backgroundColor: 'rgba(13, 15, 22, 0.9)',
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

      {activePage === 'quick_notes' && (
        <main
          aria-label="الملاحظات السريعة والإملاء الصوتي"
          data-testid="morrow-quick-notes-panel"
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          <MorrowSubPageHeader
            title="الملاحظات السريعة والتفريغ الصوتي"
            subtitle="اكتب أو أمْلِ ملاحظتك بالصوت وسيكتشف Morrow العائلة المطابقة تلقائياً ويربطها بسجلها"
            onBack={() => openWorkspacePage('chat')}
            rightSlot={
              <button
                type="button"
                data-testid="morrow-note-voice-btn"
                disabled={checkingMicPermission || transcribingNoteVoice}
                onClick={() => void toggleNoteVoiceDictation()}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-extrabold whitespace-nowrap"
                style={{
                  backgroundColor: isNoteRecording ? 'var(--danger)' : 'rgba(19, 20, 26, 0.88)',
                  borderColor: isNoteRecording ? 'var(--danger)' : 'var(--accent)',
                  color: isNoteRecording ? '#ffffff' : 'var(--text-primary)',
                }}
              >
                {transcribingNoteVoice || checkingMicPermission ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)' }} />
                    <span>جاري التفريغ الصوتي...</span>
                  </>
                ) : isNoteRecording ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    <span>إيقاف التسجيل الصوتي</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>{speechSupported ? 'إملاء صوتي' : 'تسجيل صوتي ذكي'}</span>
                  </>
                )}
              </button>
            }
          />

          <div className="nexus-squircle p-5 sm:p-6 space-y-5">
            {micPermissionGuide && (
              <div
                className="rounded-2xl border p-3.5 text-xs space-y-2"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  borderColor: 'rgba(251, 191, 36, 0.4)',
                }}
              >
                <div className="font-extrabold" style={{ color: 'var(--warning)' }}>
                  {micPermissionGuide.title}
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>{micPermissionGuide.reason}</p>
              </div>
            )}

            <form
              onSubmit={handleSaveNote}
              className="rounded-2xl border p-4 space-y-3"
              style={{
                backgroundColor: 'rgba(19, 20, 26, 0.72)',
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
                  backgroundColor: 'rgba(13, 15, 22, 0.9)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                style={{
                  backgroundColor: 'rgba(13, 15, 22, 0.9)',
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
                    backgroundColor: 'rgba(19, 20, 26, 0.9)',
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
                    backgroundColor: 'rgba(19, 20, 26, 0.72)',
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
                        backgroundColor: 'rgba(19, 20, 26, 0.72)',
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
                              backgroundColor: 'rgba(13, 15, 22, 0.9)',
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
                                backgroundColor: 'rgba(13, 15, 22, 0.9)',
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
                                backgroundColor: 'rgba(13, 15, 22, 0.9)',
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

      {activePage === 'diagnostics' && (
        <main
          aria-label="فحص التكامل والربط بالتطبيق"
          data-testid="morrow-diagnostics-page"
          className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          <MorrowSubPageHeader
            title="فحص التكامل والربط الجذري بالتطبيق"
            subtitle="التحقق من ارتباط النماذج السحابية، محرك Morrow المحلي، السحب الذكي، وقواعد البيانات"
            onBack={() => openWorkspacePage('chat')}
            rightSlot={
              onVerifySystemIntegrity ? (
                <button
                  type="button"
                  data-testid="morrow-verify-binding-btn"
                  disabled={verifyingSystem}
                  onClick={() => void handleRunSystemVerifier()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold whitespace-nowrap disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {verifyingSystem ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>{verifyingSystem ? 'جاري الفحص...' : 'تشغيل الفحص الآن'}</span>
                </button>
              ) : undefined
            }
          />

          {verificationReport ? (
            <div
              data-testid="morrow-verification-report"
              className="nexus-squircle p-5 space-y-4"
              style={{
                borderColor: verificationReport.allPassed
                  ? 'var(--success)'
                  : 'var(--warning)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                <span
                  style={{
                    color: verificationReport.allPassed ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {verificationReport.allPassed
                    ? 'جميع المسارات والنماذج مربوطة بنجاح'
                    : 'توجد ملاحظات على أحد المسارات'}
                </span>
                <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {verificationReport.boundAgenciesCount} وكالات ·{' '}
                  {verificationReport.boundPersonsCount} سجل
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {verificationReport.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="rounded-2xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
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
                        {chk.status === 'ok'
                          ? 'متصل'
                          : chk.status === 'warning'
                            ? 'احتياط'
                            : 'خطأ'}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {chk.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="nexus-squircle px-5 py-12 text-center space-y-3">
              <ShieldCheck className="mx-auto h-8 w-8" style={{ color: 'var(--accent)' }} />
              <div className="text-sm font-extrabold">جاهز لفحص ارتباط النظام بالكامل</div>
              <p className="mx-auto max-w-md text-xs" style={{ color: 'var(--text-muted)' }}>
                اضغط على «تشغيل الفحص الآن» لاختبار حالة السحابة، واجهة البث الحي، النماذج الستة، والبيانات الحية المرتبطة بالوكالات.
              </p>
            </div>
          )}
        </main>
      )}

      {activePage === 'voice_settings' && (
        <MorrowVoiceSettingsPage
          voiceTargetMode={voiceTargetMode}
          onChangeVoiceTargetMode={updateVoiceTargetMode}
          speechSupported={speechSupported}
          onStartLiveCall={() => openWorkspacePage('live')}
          onStartVoiceNote={() => {
            openWorkspacePage('chat');
            void startVoiceMessageRecording();
          }}
          onBackToChat={() => openWorkspacePage('chat')}
        />
      )}

      {activePage === 'live' && (
        <MorrowLiveSessionModal
          open={true}
          layout="page"
          onClose={() => openWorkspacePage('chat')}
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
      )}

      {activePage === 'camera' && (
        <MorrowCameraSnapModal
          open={true}
          layout="page"
          onClose={() => openWorkspacePage('chat')}
          onCaptureFile={(file) => {
            void handleQueueFile(file);
          }}
        />
      )}

      {/* ====================================================================
          LEFT DRAWER: MORROW AI, HISTORY, MODELS, ASSISTANTS, TOOLS & VOICE
         ==================================================================== */}
      <MorrowLeftDrawer
        open={sideDrawerOpen}
        onClose={() => setSideDrawerOpen(false)}
        activePage={activePage}
        activeCanvasMode={canvasMode}
        onOpenPage={(page, nextCanvasMode) => openWorkspacePage(page, nextCanvasMode)}
        chatThreads={chatThreads}
        activeThreadId={activeThreadId}
        onSwitchThread={onSwitchThread}
        onNewChat={onClearMessages}
        brainMode={brainMode}
        activeBrainLabel={activeBrain.shortLabel}
        activeAssistantId={activeAssistantId}
        onSelectAssistant={(assistantId) => {
          const profile = SPECIALIZED_ASSISTANTS.find((a) => a.id === assistantId);
          if (profile) handleSelectAssistantProfile(profile);
        }}
        pendingDraftsCount={pendingDrafts.length}
        memoryRulesCount={preferences.length}
        quickNotesCount={quickNotes.length}
        onTriggerFilePicker={() => {
          openWorkspacePage('chat');
          filePickerRef.current?.click();
        }}
      />

      {/* RIGHT DRAWER: MAIN APPLICATION NAVIGATION */}
      <MorrowAppDrawer
        open={appDrawerOpen}
        onClose={() => setAppDrawerOpen(false)}
        agencies={agencies}
        personsCount={persons.length}
        activeAgencyId={activeAgencyId}
        activePeriodLabel={activePeriodLabel}
        backLabel={backLabel}
        canViewFinance={canViewFinance}
        canUseQuickExtract={canUseQuickExtract}
        onBackToApp={handleExitStudio}
        onNavigateView={onNavigateView}
        onOpenAgencyRoster={(agId) => {
          if (onOpenAgencyRoster) {
            onOpenAgencyRoster(agId);
          } else {
            onSelectActiveAgency?.(agId);
            onNavigateView?.('agency_roster');
          }
        }}
      />

      {/* CENTER POPOVER: MODEL, AI COUNCIL, REASONING LENS & AGENCY CONTEXT */}
      <MorrowModelMenuPopover
        open={modelMenuOpen}
        onClose={() => setModelMenuOpen(false)}
        brainMode={brainMode}
        onChangeBrainMode={onChangeBrainMode}
        brainOptions={BRAIN_BUTTONS}
        collaborationMode={collaborationMode}
        onChangeCollaborationMode={onChangeCollaborationMode}
        collaborationOptions={COLLABORATION_MODE_OPTIONS}
        responseStyle={responseStyle}
        onChangeResponseStyle={onChangeResponseStyle}
        connectivity={connectivity}
        modelHealthSnapshots={modelHealthSnapshots}
        agencies={agencies}
        activeAgencyId={activeAgencyId}
        onSelectActiveAgency={onSelectActiveAgency}
        onOpenCanvas={() => openWorkspacePage('canvas')}
        onOpenModelsStudio={() => openWorkspacePage('models')}
      />
    </div>
  );
};
