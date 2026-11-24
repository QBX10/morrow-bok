import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppView, SettingsSectionId } from '../types/agency.ts';
import type {
  AssistantApprovalDraft,
  AssistantBeforeAfterDiff,
  AssistantBrainMode,
  AssistantCanvasHandoff,
  AssistantChatThread,
  AssistantChoiceChip,
  AssistantCollaborationStep,
  AssistantConnectivityState,
  AssistantConversationMemory,
  AssistantEngineSource,
  AssistantMessage,
  AssistantQueuedTask,
  AssistantQuickNote,
  AssistantQuotaStats,
  AssistantSettingsConfig,
  AssistantSlotSession,
  AssistantSmartSuggestion,
  AssistantSpotlightState,
  AssistantToolCall,
  AssistantUserPref,
  MorrowCanvasMode,
  MorrowCenterTab,
  MorrowSystemCheckItem,
  MorrowSystemVerificationReport,
} from '../types/assistant.ts';
import {
  buildAssistantCacheKey,
  getCachedAssistantResponse,
  setCachedAssistantResponse,
  type AssistantCacheEntry,
} from '../utils/assistantCache.ts';
import {
  getProactiveHealthNotice,
  runAppDiagnostics,
} from '../utils/assistantDiagnostics.ts';
import {
  executeApprovedToolMutation,
  resolveToolExecution,
  type AssistantActionRuntime,
} from '../utils/assistantExecutor.ts';
import {
  continueSlotSession,
  getScreenAwareSuggestions,
  runOfflineBrain,
  type OfflineBrainOutcome,
} from '../utils/assistantOfflineBrain.ts';
import {
  buildCloudContextPayload,
  enforceSafeArabicTerminology,
  normalizeIraqiDialect,
} from '../utils/assistantPrivacy.ts';
import {
  AI_FREE_MODELS,
  classifyPromptSpecialtyAndPriority,
  executeWithSmartFallback,
  getAllModelHealthSnapshots,
  markModelFailure,
  markModelSuccess,
  type ApprovedCloudModelId,
} from '../lib/aiConfig.ts';
import {
  createInitialQuotaStats,
  DEFAULT_ASSISTANT_SETTINGS,
  deriveAssistantConnectivity,
  evaluateOnlineQuota,
  GEMINI_HEAVY_MODEL,
  markQuotaExhausted,
  normalizeAssistantSettings,
  OPENROUTER_NEMOTRON_MODEL,
  recordOnlineRequest,
  sanitizeAssistantModelId,
} from '../utils/assistantQuota.ts';
import { buildBeforeAfterDiff, validateToolCall } from '../utils/assistantTools.ts';
import {
  getEngineDisplayMeta,
  mapModelIdToEngineSource,
} from '../utils/morrowRouter.ts';
import { autoLinkQuickNoteToPerson } from '../utils/quickNotesMatcher.ts';
import { emitAppToast } from './useToastQueue.ts';

const PREFS_STORAGE_KEY = 'tabrex_assistant_prefs_v1';
const QUEUE_STORAGE_KEY = 'tabrex_assistant_queue_v1';
const LAST_BACKUP_STORAGE_KEY = 'tabrex_last_backup_at';
const SETTINGS_STORAGE_KEY = 'morrow_assistant_settings_v1';
const QUOTA_STORAGE_KEY = 'morrow_assistant_quota_v1';
const DRAFTS_STORAGE_KEY = 'morrow_assistant_drafts_v1';
const QUICK_NOTES_STORAGE_KEY = 'morrow_quick_notes_v1';
const THREADS_STORAGE_KEY = 'morrow_assistant_threads_v1';

function readStoredArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function readStoredObject<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

export function useAssistantEngine(params: {
  runtime: Omit<
    AssistantActionRuntime,
    'saveUserPref' | 'deleteUserPref' | 'triggerSpotlight' | 'exportBackupJson'
  >;
  onExportBackupFile: (silentAuto?: boolean) => void;
  canUndoApp?: boolean;
  onUndoAppAction?: () => void;
}) {
  const { runtime, onExportBackupFile, canUndoApp = false, onUndoAppAction } = params;

  const [isOpen, setIsOpen] = useState(false);
  const [brainMode, setBrainMode] = useState<AssistantBrainMode>('auto');
  const [activeCommandCenterTab, setActiveCommandCenterTab] =
    useState<MorrowCenterTab>('chat');
  const [requestedCanvasHandoff, setRequestedCanvasHandoff] = useState<{
    mode: MorrowCanvasMode;
    agencyId?: number | null;
    nonce: number;
  } | null>(null);
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cloudConfigured, setCloudConfigured] = useState<boolean>(true);
  const [isThinking, setIsThinking] = useState(false);
  const [slotSession, setSlotSession] = useState<AssistantSlotSession | null>(null);
  const [spotlight, setSpotlight] = useState<AssistantSpotlightState | null>(null);
  const [conversationMemory, setConversationMemory] =
    useState<AssistantConversationMemory>({});
  const [pendingCompoundQueue, setPendingCompoundQueue] = useState<string[]>([]);
  const [responseCache, setResponseCache] = useState<AssistantCacheEntry[]>([]);
  const [healthTick, setHealthTick] = useState(0);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const lastUserPromptRef = useRef<string>('');

  const [assistantSettings, setAssistantSettingsState] = useState<AssistantSettingsConfig>(
    () => {
      const loaded = readStoredObject(SETTINGS_STORAGE_KEY, DEFAULT_ASSISTANT_SETTINGS);
      return normalizeAssistantSettings(loaded);
    }
  );
  const [quotaStats, setQuotaStats] = useState<AssistantQuotaStats>(() =>
    readStoredObject(QUOTA_STORAGE_KEY, createInitialQuotaStats())
  );

  const [preferences, setPreferences] = useState<AssistantUserPref[]>(() =>
    readStoredArray<AssistantUserPref>(PREFS_STORAGE_KEY)
  );
  const [queuedTasks, setQueuedTasks] = useState<AssistantQueuedTask[]>(() =>
    readStoredArray<AssistantQueuedTask>(QUEUE_STORAGE_KEY)
  );
  const [approvalDrafts, setApprovalDrafts] = useState<AssistantApprovalDraft[]>(() =>
    readStoredArray<AssistantApprovalDraft>(DRAFTS_STORAGE_KEY)
  );
  const [quickNotes, setQuickNotes] = useState<AssistantQuickNote[]>(() =>
    readStoredArray<AssistantQuickNote>(QUICK_NOTES_STORAGE_KEY)
  );
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const proactiveTip = useMemo(
    () => getProactiveHealthNotice(runtime.state, lastBackupAt),
    [runtime.state.persons.length, runtime.state.monthlyArchives?.length, lastBackupAt]
  );

  const createWelcomeMessage = useCallback((): AssistantMessage => {
    const localMeta = getEngineDisplayMeta('morrow_local');
    return {
      id: `welcome_msg_${Date.now().toString(36)}`,
      role: 'assistant',
      createdAt: new Date().toISOString(),
      engineUsed: 'morrow_local',
      engineLabel: localMeta.badgeLabel,
      modelId: localMeta.modelId,
      text: 'أهلاً بك في مساعد Morrow الذكي. يتم توجيه كل مهمة تلقائياً وفق تخصص النماذج الستة وأولويتها (3.8 Flash للمهام الثقيلة والرؤية · 3.8 Live للمباشر · 3.5 Flash للبيانات · 3.5 Lite للاستجابة الفورية · Groq Whisper للصوت · Nemotron للاستنتاج المستقل) مع التحويل الذكي التلقائي وبقاء Morrow المحلي كمرجع صامد.',
      choices: [
        {
          id: 'welcome_check_health',
          label: 'فحص سلامة الجداول',
          actionType: 'send_prompt',
          payload: { prompt: 'افحص التطبيق' },
        },
        {
          id: 'welcome_open_center',
          label: 'فتح مركز Morrow',
          actionType: 'open_command_center_tab',
          payload: { tab: 'approvals' },
        },
      ],
    };
  }, []);

  const [chatThreads, setChatThreads] = useState<AssistantChatThread[]>(() =>
    readStoredArray<AssistantChatThread>(THREADS_STORAGE_KEY).slice(0, 15)
  );
  const [activeThreadId, setActiveThreadId] = useState<string>(
    () => `thread_${Date.now().toString(36)}`
  );

  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    createWelcomeMessage(),
  ]);

  // Persist thread archive snapshot whenever substantive conversation updates occur
  useEffect(() => {
    try {
      localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(chatThreads.slice(0, 15)));
    } catch {
      // ignore quota error
    }
  }, [chatThreads]);

  useEffect(() => {
    const firstUserMsg = messages.find((m) => m.role === 'user');
    if (!firstUserMsg || messages.length <= 1) return;

    const cleanTitle = firstUserMsg.text.replace(/\s+/g, ' ').trim().slice(0, 48);
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && !m.id.startsWith('welcome_msg_'));
    const previewText = (lastAssistant?.text || firstUserMsg.text)
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);

    setChatThreads((prev) => {
      const nextThread: AssistantChatThread = {
        id: activeThreadId,
        title: cleanTitle || 'محادثة Morrow',
        previewText,
        updatedAt: new Date().toISOString(),
        brainMode,
        messages: messages.slice(-30),
      };
      const others = prev.filter((t) => t.id !== activeThreadId);
      return [nextThread, ...others].slice(0, 15);
    });
  }, [messages, activeThreadId, brainMode]);

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // ignore quota error
    }
  }, [preferences]);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queuedTasks));
    } catch {
      // ignore quota error
    }
  }, [queuedTasks]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(approvalDrafts.slice(0, 40)));
    } catch {
      // ignore quota error
    }
  }, [approvalDrafts]);

  useEffect(() => {
    try {
      localStorage.setItem(QUICK_NOTES_STORAGE_KEY, JSON.stringify(quickNotes.slice(0, 80)));
    } catch {
      // ignore quota error
    }
  }, [quickNotes]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(assistantSettings));
    } catch {
      // ignore
    }
  }, [assistantSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(quotaStats));
    } catch {
      // ignore
    }
  }, [quotaStats]);

  useEffect(() => {
    const checkStatus = async () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setBrowserOnline(online);
      if (!online) return;
      try {
        const res = await fetch('/api/assistant/status');
        if (!res.ok) {
          setCloudConfigured(false);
          return;
        }
        const data = (await res.json()) as { cloudConfigured?: boolean };
        setCloudConfigured(Boolean(data.cloudConfigured));
      } catch {
        setCloudConfigured(false);
      }
    };
    void checkStatus();

    const onOnline = () => void checkStatus();
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const quotaInfo = useMemo(
    () => evaluateOnlineQuota(quotaStats, assistantSettings),
    [quotaStats, assistantSettings]
  );

  const connectivity: AssistantConnectivityState = useMemo(
    () =>
      deriveAssistantConnectivity({
        browserOnline,
        cloudConfigured,
        settings: assistantSettings,
        stats: quotaStats,
      }),
    [browserOnline, cloudConfigured, assistantSettings, quotaStats]
  );

  const pendingDraftsCount = useMemo(
    () => approvalDrafts.filter((d) => d.status === 'pending').length,
    [approvalDrafts]
  );

  const updateAssistantSettings = useCallback(
    (patch: Partial<AssistantSettingsConfig>) => {
      setAssistantSettingsState((prev) =>
        normalizeAssistantSettings({
          ...prev,
          ...patch,
          taskRouting: patch.taskRouting
            ? { ...prev.taskRouting, ...patch.taskRouting }
            : prev.taskRouting,
        })
      );
    },
    []
  );

  const resetQuotaStats = useCallback(() => {
    setQuotaStats(createInitialQuotaStats());
  }, []);

  const clearResponseCache = useCallback(() => {
    setResponseCache([]);
  }, []);

  const spotlightTimerRef = useRef<number | null>(null);
  const triggerSpotlight = useCallback(
    (opts: {
      view: AppView;
      settingsSection?: SettingsSectionId;
      targetId: string;
      title: string;
      description: string;
    }) => {
      runtime.navigate(opts.view, opts.settingsSection);
      setSpotlight({
        targetId: opts.targetId,
        title: opts.title,
        description: opts.description,
        activatedAt: Date.now(),
      });

      if (spotlightTimerRef.current) {
        window.clearTimeout(spotlightTimerRef.current);
      }
      window.setTimeout(() => {
        const el = document.querySelector(
          `[data-assistant-target="${opts.targetId}"]`
        );
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);

      spotlightTimerRef.current = window.setTimeout(() => {
        setSpotlight(null);
      }, 6500);
    },
    [runtime]
  );

  const exportBackupJson = useCallback(
    (silentAuto = false) => {
      onExportBackupFile(silentAuto);
      const nowIso = new Date().toISOString();
      setLastBackupAt(nowIso);
      try {
        localStorage.setItem(LAST_BACKUP_STORAGE_KEY, nowIso);
      } catch {
        // ignore
      }
    },
    [onExportBackupFile]
  );

  const saveUserPref = useCallback(
    (key: string, label: string, value: string | boolean | number) => {
      setPreferences((prev) => {
        const idx = prev.findIndex((p) => p.key === key);
        const item: AssistantUserPref = {
          id: idx !== -1 ? prev[idx].id : `pref_${Date.now().toString(36)}`,
          key,
          label: enforceSafeArabicTerminology(label.trim()),
          value,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        if (idx !== -1) {
          return prev.map((p, i) => (i === idx ? item : p));
        }
        return [item, ...prev];
      });
    },
    []
  );

  const saveCustomMemoryPref = useCallback(
    (rawLabel: string, explicitKey?: string) => {
      const label = enforceSafeArabicTerminology(rawLabel.trim());
      if (!label) return;
      const norm = normalizeIraqiDialect(label);
      const inferredKey =
        explicitKey ||
        (/(مبلغ|سعر|دينار|فلوس)/.test(norm)
          ? 'hide_amount_in_reports'
          : /(حاله|حظر)/.test(norm)
          ? 'hide_status_in_reports'
          : /(ملاحظات)/.test(norm)
          ? 'hide_notes_in_reports'
          : `custom_pref_${Date.now().toString(36)}`);
      saveUserPref(inferredKey, label, 'true');
      emitAppToast({
        title: 'حُفظت قاعدة في الذاكرة',
        description: label,
        tone: 'success',
      });
    },
    [saveUserPref]
  );

  const deleteUserPref = useCallback((prefId: string) => {
    setPreferences((prev) => prev.filter((p) => p.id !== prefId));
  }, []);

  const openCommandCenter = useCallback(
    (tab: MorrowCenterTab = 'chat', canvasMode?: MorrowCanvasMode) => {
      if (canvasMode) {
        setActiveCommandCenterTab('chat');
        setRequestedCanvasHandoff({
          mode: canvasMode,
          nonce: Date.now(),
        });
      } else {
        setActiveCommandCenterTab(tab);
      }
      runtime.navigate('morrow_center');
      setIsOpen(false);
    },
    [runtime]
  );

  const openCanvasMode = useCallback(
    (canvasMode: MorrowCanvasMode, agencyId?: number | null) => {
      if (typeof agencyId === 'number' && agencyId > 0) {
        runtime.selectAgency(agencyId);
      }
      setActiveCommandCenterTab('chat');
      setRequestedCanvasHandoff({
        mode: canvasMode,
        agencyId: agencyId ?? null,
        nonce: Date.now(),
      });
      runtime.navigate('morrow_center');
      setIsOpen(false);
    },
    [runtime]
  );

  const addQuickNote = useCallback(
    (input: {
      text: string;
      source?: 'text' | 'voice';
      overridePersonId?: number | null;
      syncToPerson?: boolean;
    }) => {
      const clean = enforceSafeArabicTerminology(input.text.trim());
      if (!clean) return null;

      const agencyMap = new Map(runtime.state.agencies.map((a) => [a.id, a.name]));
      let linkedPerson =
        input.overridePersonId !== undefined && input.overridePersonId !== null
          ? runtime.state.persons.find((p) => p.id === input.overridePersonId) || null
          : null;
      let matchConfidence = linkedPerson ? 1 : 0;

      if (!linkedPerson && input.overridePersonId !== null) {
        const auto = autoLinkQuickNoteToPerson(
          clean,
          runtime.state.persons,
          runtime.state.agencies
        );
        linkedPerson = auto.person;
        matchConfidence = auto.confidence;
      }

      const note: AssistantQuickNote = {
        id: `qn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        text: clean,
        source: input.source || 'text',
        createdAt: new Date().toISOString(),
        linkedPersonId: linkedPerson?.id ?? null,
        linkedPersonName: linkedPerson?.name,
        linkedAgencyId: linkedPerson?.agencyId ?? null,
        linkedAgencyName: linkedPerson ? agencyMap.get(linkedPerson.agencyId) : undefined,
        matchConfidence,
        syncedToPersonNotes: Boolean(input.syncToPerson && linkedPerson),
      };

      setQuickNotes((prev) => [note, ...prev].slice(0, 80));

      if (input.syncToPerson && linkedPerson) {
        const existingNotes = linkedPerson.notes?.trim();
        const combinedNotes = existingNotes ? `${existingNotes} | ${clean}` : clean;
        runtime.mutations.updatePersonConfirmed(linkedPerson.id, {
          notes: combinedNotes,
        });
        emitAppToast({
          title: `تم ربط الملاحظة بـ «${linkedPerson.name}»`,
          description: 'حُفظت الملاحظة السريعة ومُزومنت مع سجل العائلة.',
          tone: 'success',
        });
      } else {
        emitAppToast({
          title: linkedPerson
            ? `ملاحظة مرتبطة تلقائياً بـ «${linkedPerson.name}»`
            : 'تم حفظ الملاحظة السريعة',
          tone: 'info',
        });
      }
      return note;
    },
    [runtime.state.agencies, runtime.state.persons, runtime.mutations]
  );

  const fullRuntime: AssistantActionRuntime = useMemo(
    () => ({
      ...runtime,
      uiContext: {
        ...runtime.uiContext,
        preferences,
        lastBackupAt,
      },
      saveUserPref,
      deleteUserPref,
      triggerSpotlight,
      exportBackupJson,
      addQuickNote,
      openCanvasMode,
    }),
    [
      runtime,
      preferences,
      lastBackupAt,
      saveUserPref,
      deleteUserPref,
      triggerSpotlight,
      exportBackupJson,
      addQuickNote,
      openCanvasMode,
    ]
  );

  const liveCloudPayload = useMemo(
    () =>
      buildCloudContextPayload(
        fullRuntime.uiContext,
        messages,
        Boolean(fullRuntime.state.securityPrefs?.allowCloudBeneficiaryNames),
        fullRuntime.state,
        {
          quickNotesCount: quickNotes.length,
          pendingDraftsCount,
        }
      ),
    [
      fullRuntime.uiContext,
      fullRuntime.state,
      messages,
      quickNotes.length,
      pendingDraftsCount,
    ]
  );

  const smartSuggestions = useMemo(
    () =>
      getScreenAwareSuggestions(
        fullRuntime.uiContext.activeView,
        fullRuntime.uiContext.focusedPersonName,
        conversationMemory
      ),
    [
      fullRuntime.uiContext.activeView,
      fullRuntime.uiContext.focusedPersonName,
      conversationMemory,
    ]
  );

  const appendMessage = useCallback(
    (msg: Omit<AssistantMessage, 'id' | 'createdAt'>) => {
      const meta = getEngineDisplayMeta(msg.engineUsed);
      const entry: AssistantMessage = {
        ...msg,
        engineUsed: msg.engineUsed || 'morrow_local',
        engineLabel: msg.engineLabel || meta.badgeLabel,
        modelId: msg.modelId || meta.modelId,
        text: enforceSafeArabicTerminology(msg.text),
        id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.slice(-40), entry]);
      return entry;
    },
    []
  );

  const registerDraftFromDiff = useCallback(
    (
      diff: AssistantBeforeAfterDiff,
      sourceEngine: AssistantEngineSource,
      promptOrigin?: string
    ): string => {
      const draftId = `draft_${diff.id}`;
      const meta = getEngineDisplayMeta(sourceEngine);
      const newDraft: AssistantApprovalDraft = {
        id: draftId,
        createdAt: new Date().toISOString(),
        sourceEngine,
        sourceLabel: meta.shortLabel,
        promptOrigin,
        diff,
        status: 'pending',
      };
      setApprovalDrafts((prev) => [newDraft, ...prev.filter((d) => d.id !== draftId)].slice(0, 40));
      return draftId;
    },
    []
  );

  const stageToolDrafts = useCallback(
    (tools: AssistantToolCall[], sourceLabel: string) => {
      let stagedCount = 0;
      let backupTriggered = false;

      for (const rawTool of tools) {
        const validated = validateToolCall(rawTool);
        if (!validated.valid || !validated.sanitized) continue;
        const tc = validated.sanitized;

        if (tc.name === 'backup_restore' && tc.args.action === 'backup_json') {
          exportBackupJson(false);
          backupTriggered = true;
          continue;
        }

        const diff = buildBeforeAfterDiff(
          fullRuntime.state,
          tc,
          fullRuntime.uiContext.focusedPersonId
        );
        if (diff) {
          const draftId = registerDraftFromDiff(diff, 'morrow_local', sourceLabel);
          stagedCount += 1;
          appendMessage({
            role: 'assistant',
            text: `${sourceLabel}: جهّزت مسودة «${diff.title}» للمراجعة والموافقة:`,
            engineUsed: 'morrow_local',
            gracefulLevel: 'A',
            confirmationDiff: diff,
            pendingDraftId: draftId,
          });
        }
      }

      if (stagedCount > 0) {
        emitAppToast({
          title: `تم تجهيز ${stagedCount} مسودة في طابور الموافقة`,
          description: 'لن تتغير البيانات الفعلية إلا بعد موافقتك.',
          tone: 'info',
        });
      } else if (backupTriggered) {
        emitAppToast({
          title: 'تم تنزيل النسخة الاحتياطية بنجاح',
          tone: 'success',
        });
      }
      return stagedCount;
    },
    [fullRuntime.state, fullRuntime.uiContext.focusedPersonId, exportBackupJson, registerDraftFromDiff, appendMessage]
  );

  const savePromptToQueue = useCallback((prompt: string, reason: string) => {
    const clean = enforceSafeArabicTerminology(prompt.trim());
    if (!clean) return;
    setQueuedTasks((prev) => [
      {
        id: `q_${Date.now().toString(36)}`,
        prompt: clean,
        createdAt: new Date().toISOString(),
        reason,
      },
      ...prev.filter((t) => t.prompt !== clean),
    ]);
  }, []);

  const removeQueuedTask = useCallback((id: string) => {
    setQueuedTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applyMemoryPatch = useCallback(
    (patch?: Partial<AssistantConversationMemory>) => {
      if (!patch) return;
      setConversationMemory((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const undoLastAssistantAction = useCallback(
    (sourceMessageId?: string) => {
      if (!canUndoApp || !onUndoAppAction) {
        appendMessage({
          role: 'assistant',
          text: 'لا يوجد تعديل سابق متاح للتراجع عنه حالياً.',
          engineUsed: 'morrow_local',
          gracefulLevel: 'B',
        });
        return;
      }

      onUndoAppAction();
      setMessages((prev) =>
        prev.map((m) =>
          (sourceMessageId ? m.id === sourceMessageId : m.canUndo)
            ? { ...m, canUndo: false, undoUsed: true }
            : m
        )
      );
      appendMessage({
        role: 'assistant',
        text: 'تم التراجع عن آخر تعديل واسترجاع البيانات السابقة بنجاح.',
        engineUsed: 'morrow_local',
        gracefulLevel: 'A',
      });
      emitAppToast({
        title: 'تم التراجع عن آخر إجراء',
        tone: 'info',
      });
    },
    [canUndoApp, onUndoAppAction, appendMessage]
  );

  const hasUndoableAssistantMessage = useMemo(
    () => canUndoApp && messages.some((m) => m.canUndo && !m.undoUsed),
    [canUndoApp, messages]
  );

  const updateQuickNoteLink = useCallback(
    (noteId: string, personId: number | null) => {
      const agencyMap = new Map(runtime.state.agencies.map((a) => [a.id, a.name]));
      const person =
        personId !== null
          ? runtime.state.persons.find((p) => p.id === personId) || null
          : null;
      setQuickNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                linkedPersonId: person?.id ?? null,
                linkedPersonName: person?.name,
                linkedAgencyId: person?.agencyId ?? null,
                linkedAgencyName: person ? agencyMap.get(person.agencyId) : undefined,
                matchConfidence: person ? 1 : 0,
              }
            : n
        )
      );
    },
    [runtime.state.agencies, runtime.state.persons]
  );

  const syncQuickNoteToPerson = useCallback(
    (noteId: string) => {
      const note = quickNotes.find((n) => n.id === noteId);
      if (!note || !note.linkedPersonId) return;
      const person = runtime.state.persons.find((p) => p.id === note.linkedPersonId);
      if (!person) return;
      const existing = person.notes?.trim();
      const nextNotes = existing ? `${existing} | ${note.text}` : note.text;
      runtime.mutations.updatePersonConfirmed(person.id, { notes: nextNotes });
      setQuickNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, syncedToPersonNotes: true } : n))
      );
      emitAppToast({
        title: `تم تثبيت الملاحظة على سجل «${person.name}»`,
        tone: 'success',
      });
    },
    [quickNotes, runtime.state.persons, runtime.mutations]
  );

  const deleteQuickNote = useCallback((noteId: string) => {
    setQuickNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const presentOfflineOutcome = useCallback(
    (
      outcome: OfflineBrainOutcome,
      prompt: string,
      overrideNote?: string,
      options?: { fromFloatingWidget?: boolean }
    ) => {
      applyMemoryPatch(outcome.memoryPatch);

      if (outcome.wantsUndo) {
        undoLastAssistantAction();
        return;
      }

      if (outcome.nextSlotSession !== undefined) {
        setSlotSession(outcome.nextSlotSession);
      }

      // Compound multi-step handling
      if (outcome.compoundSteps && outcome.compoundSteps.length > 1) {
        const completedSummaries: string[] = [];
        const interactivePrompts: OfflineBrainOutcome[] = [];

        for (const step of outcome.compoundSteps) {
          if (step.wantsUndo) {
            undoLastAssistantAction();
            completedSummaries.push('• تراجع عن آخر خطوة');
            continue;
          }
          if (step.toolCall && !step.confirmationDiff && !step.nextSlotSession) {
            const resolved = resolveToolExecution(
              step.toolCall,
              fullRuntime,
              step.replyText
            );
            completedSummaries.push(`• ${resolved.replyText}`);
          } else if (step.confirmationDiff || step.nextSlotSession || step.choices) {
            interactivePrompts.push(step);
          } else if (step.handled) {
            completedSummaries.push(`• ${step.replyText}`);
          }
        }

        if (completedSummaries.length > 0) {
          appendMessage({
            role: 'assistant',
            text: `${
              overrideNote ? `${overrideNote}\n\n` : ''
            }نُفّذت الخطوات الفورية من أمرك المركّب:\n${completedSummaries.join('\n')}`,
            engineUsed: 'morrow_local',
            confidence: outcome.confidence,
            gracefulLevel: 'A',
          });
        }

        if (interactivePrompts.length > 0) {
          const [firstInteractive, ...restInteractive] = interactivePrompts;
          if (restInteractive.length > 0) {
            const deferredPrompts = restInteractive
              .map((r) => r.nextSlotSession?.originalPrompt || r.toolCall?.args?.name)
              .filter((x): x is string => typeof x === 'string' && x.length > 0)
              .map((n) => (n.startsWith('ضيف') ? n : `ضيف ${n}`));
            setPendingCompoundQueue((prev) => [...deferredPrompts, ...prev]);
          }

          if (firstInteractive.nextSlotSession !== undefined) {
            setSlotSession(firstInteractive.nextSlotSession);
          }
          const draftId = firstInteractive.confirmationDiff
            ? registerDraftFromDiff(
                firstInteractive.confirmationDiff,
                'morrow_local',
                prompt
              )
            : undefined;
          appendMessage({
            role: 'assistant',
            text: firstInteractive.replyText,
            engineUsed: 'morrow_local',
            confidence: firstInteractive.confidence,
            gracefulLevel: firstInteractive.gracefulLevel,
            choices: [
              ...(firstInteractive.choices || []),
              ...(draftId
                ? [
                    {
                      id: `open_drafts_${draftId}`,
                      label: 'مراجعة في طابور الموافقات',
                      actionType: 'open_command_center_tab' as const,
                      payload: { tab: 'approvals' },
                    },
                  ]
                : []),
            ],
            confirmationDiff: firstInteractive.confirmationDiff ?? undefined,
            pendingDraftId: draftId,
          });
        }
        return;
      }

      if (outcome.handled) {
        if (outcome.toolCall && !outcome.confirmationDiff) {
          const resolved = resolveToolExecution(
            outcome.toolCall,
            fullRuntime,
            outcome.replyText
          );
          const effectiveDiff = resolved.confirmationDiff || outcome.confirmationDiff;
          const draftId = effectiveDiff
            ? registerDraftFromDiff(effectiveDiff, 'morrow_local', prompt)
            : undefined;
          const stealth = Boolean(outcome.stealthAutoExecute || resolved.stealthExecuted);
          const autoClose = Boolean(outcome.autoCloseChat || resolved.autoCloseChat);

          const finalText = overrideNote
            ? `${overrideNote}\n\n${resolved.replyText}`
            : resolved.replyText;

          const localTrace: AssistantCollaborationStep[] = [
            {
              id: `loc_nlu_${Date.now()}`,
              role: 'analyzer',
              roleLabel: 'محلل اللهجة والنية',
              modelId: 'morrow-local',
              modelLabel: 'Morrow المحلي',
              provider: 'local',
              status: 'done',
              latencyMs: 2,
              summary: 'فك اللهجة العراقية واستخراج الكيانات والأداة المناسبة',
            },
            {
              id: `loc_exec_${Date.now()}`,
              role: 'executor',
              roleLabel: 'محرك السجلات والأدوات',
              modelId: 'morrow-local',
              modelLabel: outcome.toolCall.name,
              provider: 'local',
              status: 'done',
              latencyMs: 4,
              summary: resolved.resultCard?.title || resolved.diagnosticsReport ? 'تشغيل التحليل اللحظي على بيانات الوكالات' : 'تنفيذ الأداة الآمنة على السياق الحالي',
            },
            ...(effectiveDiff || (resolved.extraDraftTools?.length ?? 0) > 0
              ? [
                  {
                    id: `loc_zt_${Date.now()}`,
                    role: 'verifier' as const,
                    roleLabel: 'حارس الصفّر-ثقة',
                    modelId: 'morrow-local',
                    modelLabel: 'بوابة قبل ← بعد',
                    provider: 'local' as const,
                    status: 'done' as const,
                    latencyMs: 1,
                    summary: 'عزل التعديلات كمسودات بانتظار موافقتك الصريحة',
                  },
                ]
              : []),
          ];

          appendMessage({
            role: 'assistant',
            text: finalText,
            engineUsed: 'morrow_local',
            confidence: outcome.confidence,
            stealthExecuted: stealth,
            gracefulLevel: resolved.gracefulLevel,
            collaborationTrace: localTrace,
            canvasHandoff: resolved.canvasHandoff || outcome.canvasHandoff,
            suggestedFollowUps:
              resolved.suggestedFollowUps || outcome.suggestedFollowUps,
            choices: [
              ...(resolved.choices || outcome.choices || []),
              ...(draftId
                ? [
                    {
                      id: `open_drafts_${draftId}`,
                      label: 'عرض في الموافقات',
                      actionType: 'open_command_center_tab' as const,
                      payload: { tab: 'approvals' },
                    },
                  ]
                : []),
            ],
            confirmationDiff: effectiveDiff ?? undefined,
            pendingDraftId: draftId,
            spotlightAction: resolved.spotlightAction || outcome.spotlightAction,
            sandboxNotice: resolved.sandboxNotice,
            diagnosticsReport:
              resolved.diagnosticsReport || outcome.diagnosticsReport,
            resultCard: resolved.resultCard,
          });

          if (resolved.extraDraftTools && resolved.extraDraftTools.length > 0) {
            stageToolDrafts(resolved.extraDraftTools, 'أمر الماكرو التلقائي');
          }

          if (stealth) {
            emitAppToast({
              title: 'تنفيذ فوري — Morrow',
              description: resolved.replyText,
              tone: 'success',
            });
            if (options?.fromFloatingWidget && autoClose) {
              setIsOpen(false);
            }
          }
          return;
        }

        const draftId = outcome.confirmationDiff
          ? registerDraftFromDiff(outcome.confirmationDiff, 'morrow_local', prompt)
          : undefined;
        const stealth = Boolean(outcome.stealthAutoExecute);

        appendMessage({
          role: 'assistant',
          text: overrideNote
            ? `${overrideNote}\n\n${outcome.replyText}`
            : outcome.replyText,
          engineUsed: 'morrow_local',
          confidence: outcome.confidence,
          stealthExecuted: stealth,
          gracefulLevel: outcome.gracefulLevel,
          choices: [
            ...(outcome.choices || []),
            ...(draftId
              ? [
                  {
                    id: `open_drafts_${draftId}`,
                    label: 'عرض في الموافقات',
                    actionType: 'open_command_center_tab' as const,
                    payload: { tab: 'approvals' },
                  },
                ]
              : []),
          ],
          confirmationDiff: outcome.confirmationDiff ?? undefined,
          pendingDraftId: draftId,
          spotlightAction: outcome.spotlightAction,
          diagnosticsReport: outcome.diagnosticsReport,
        });

        if (stealth) {
          emitAppToast({
            title: 'تنفيذ فوري — Morrow',
            description: outcome.replyText,
            tone: 'success',
          });
          if (options?.fromFloatingWidget && outcome.autoCloseChat) {
            setIsOpen(false);
          }
        }
        return;
      }

      // Level C graceful degradation when offline or quota exhausted
      appendMessage({
        role: 'assistant',
        text: `${overrideNote ? `${overrideNote}\n` : ''}${outcome.replyText}\nالسبب: ${
          assistantSettings.onlineDisabled
            ? 'تم تعطيل الاتصال بالسحابة من الإعدادات (أوفلاين صارم).'
            : connectivity === 'quota_exhausted'
            ? 'خلصت حصة السحابة مؤقتاً.'
            : 'المحرك السحابي غير متاح حالياً — يعمل Morrow المحلي الآن.'
        } تقدر تحفظ الطلب وتنفذه لاحقاً أو تستخدم الأوامر المحلية.`,
        engineUsed: 'morrow_local',
        confidence: outcome.confidence,
        gracefulLevel: 'C',
        queuePrompt: { prompt, saved: false },
      });
    },
    [
      applyMemoryPatch,
      undoLastAssistantAction,
      fullRuntime,
      appendMessage,
      registerDraftFromDiff,
      stageToolDrafts,
      assistantSettings.onlineDisabled,
      connectivity,
    ]
  );

  const runLocalAndRespond = useCallback(
    (prompt: string, overrideNote?: string, options?: { fromFloatingWidget?: boolean }) => {
      const outcome = runOfflineBrain({
        prompt,
        state: fullRuntime.state,
        uiContext: fullRuntime.uiContext,
        slotSession,
        memory: conversationMemory,
      });
      presentOfflineOutcome(outcome, prompt, overrideNote, options);
    },
    [fullRuntime, slotSession, conversationMemory, presentOfflineOutcome]
  );

  const cancelActiveRequest = useCallback(() => {
    if (activeRequestControllerRef.current) {
      activeRequestControllerRef.current.abort();
      activeRequestControllerRef.current = null;
    }
    setIsThinking(false);
    appendMessage({
      role: 'assistant',
      text: 'تم إيقاف الطلب الحالي. يمكنك تعديل رسالتك أو إرسال أمر جديد متى شئت.',
      engineUsed: 'morrow_local',
      gracefulLevel: 'B',
    });
  }, [appendMessage]);

  const clearMessages = useCallback(() => {
    if (activeRequestControllerRef.current) {
      activeRequestControllerRef.current.abort();
      activeRequestControllerRef.current = null;
    }
    setIsThinking(false);
    setSlotSession(null);
    setPendingCompoundQueue([]);
    lastUserPromptRef.current = '';
    setActiveThreadId(`thread_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`);
    setMessages([createWelcomeMessage()]);
  }, [createWelcomeMessage]);

  const switchChatThread = useCallback(
    (threadId: string) => {
      const found = chatThreads.find((t) => t.id === threadId);
      if (!found) return;
      if (activeRequestControllerRef.current) {
        activeRequestControllerRef.current.abort();
        activeRequestControllerRef.current = null;
      }
      setIsThinking(false);
      setSlotSession(null);
      setPendingCompoundQueue([]);
      setActiveThreadId(found.id);
      setBrainMode(found.brainMode);
      setMessages(
        found.messages.length > 0 ? found.messages : [createWelcomeMessage()]
      );
    },
    [chatThreads, createWelcomeMessage]
  );

  const deleteChatThread = useCallback(
    (threadId: string) => {
      setChatThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(`thread_${Date.now().toString(36)}`);
        setMessages([createWelcomeMessage()]);
      }
    },
    [activeThreadId, createWelcomeMessage]
  );

  const modelHealthSnapshots = useMemo(
    () => getAllModelHealthSnapshots(),
    [healthTick, connectivity]
  );

  const sendMessage = useCallback(
    async (rawPrompt: string, options?: { fromFloatingWidget?: boolean; bypassCache?: boolean }) => {
      const cleanPrompt = enforceSafeArabicTerminology(rawPrompt.trim());
      if (!cleanPrompt || isThinking) return;

      lastUserPromptRef.current = cleanPrompt;
      appendMessage({ role: 'user', text: cleanPrompt });

      const offlineNow =
        assistantSettings.onlineDisabled ||
        brainMode === 'local' ||
        !browserOnline ||
        !cloudConfigured;

      const localProbe = runOfflineBrain({
        prompt: cleanPrompt,
        state: fullRuntime.state,
        uiContext: fullRuntime.uiContext,
        slotSession: null,
        memory: conversationMemory,
      });

      // Active slot-filling stays instant & deterministic locally,
      // unless the user clearly cancelled or issued a concrete new command/filter/theme toggle.
      if (slotSession) {
        const wantsCancel = /^(الغاء|إلغاء|الغ|كافي|توقف|خلاص|cancel|stop)$/i.test(
          cleanPrompt
        );
        const isDistinctNewCommand =
          localProbe.handled &&
          Boolean(
            localProbe.wantsUndo ||
              (localProbe.toolCall &&
                localProbe.toolCall.name !== 'add_person') ||
              (localProbe.compoundSteps && localProbe.compoundSteps.length > 1)
          );
        if (wantsCancel) {
          setSlotSession(null);
          appendMessage({
            role: 'assistant',
            text: 'تم إلغاء الخطوة السابقة. كيف أقدر أساعدك الآن؟',
            engineUsed: 'morrow_local',
            confidence: 0.95,
          });
          return;
        }
        if (isDistinctNewCommand) {
          setSlotSession(null);
        } else {
          runLocalAndRespond(cleanPrompt, undefined, options);
          return;
        }
      }

      const specialtyDecision = classifyPromptSpecialtyAndPriority({
        prompt: cleanPrompt,
        modality: 'chat',
        brainMode,
        routingStrategy: assistantSettings.routingStrategy,
        localHandled: localProbe.handled,
        taskRouting: assistantSettings.taskRouting,
      });

      if (offlineNow) {
        presentOfflineOutcome(
          localProbe,
          cleanPrompt,
          assistantSettings.onlineDisabled &&
            brainMode !== 'local' &&
            brainMode !== 'auto'
            ? 'ملاحظة: الاتصال السحابي معطّل من الإعدادات — شغّال بمحرك Morrow المحلي.'
            : undefined,
          options
        );
        return;
      }

      // Economy mode OR deterministic instant UI stealth actions run immediately locally without cloud latency
      if (
        (brainMode === 'auto' && specialtyDecision.bypassCloudSuggested) ||
        (brainMode === 'auto' &&
          localProbe.handled &&
          localProbe.stealthAutoExecute &&
          localProbe.confidence >= 0.92)
      ) {
        presentOfflineOutcome(localProbe, cleanPrompt, undefined, options);
        return;
      }

      const fallbackChain: ApprovedCloudModelId[] =
        specialtyDecision.healthyPriorityOrder.length > 0
          ? specialtyDecision.healthyPriorityOrder
          : [
              sanitizeAssistantModelId(assistantSettings.preferredModelId || GEMINI_HEAVY_MODEL),
              sanitizeAssistantModelId(assistantSettings.fallbackModelId || OPENROUTER_NEMOTRON_MODEL),
            ];
      const activeModel = fallbackChain[0];

      const cacheKey = buildAssistantCacheKey({
        prompt: cleanPrompt,
        brainMode,
        modelId: activeModel,
        chainSignature: `${assistantSettings.routingStrategy}:${assistantSettings.responseStyle || 'balanced'}:${specialtyDecision.specialty}:${fallbackChain.join('>')}`,
        activeView: fullRuntime.uiContext.activeView,
        selectedAgencyId: fullRuntime.uiContext.selectedAgencyId,
      });

      if (assistantSettings.cacheEnabled && !options?.bypassCache) {
        const cached = getCachedAssistantResponse(responseCache, cacheKey);
        if (cached) {
          if (cached.toolCalls && cached.toolCalls.length > 0) {
            const validCachedTools = cached.toolCalls
              .map((t) => validateToolCall(t))
              .filter((v): v is { valid: true; sanitized: AssistantToolCall } => Boolean(v.valid && v.sanitized))
              .map((v) => v.sanitized);

            if (validCachedTools.length > 0) {
              const primaryTool = validCachedTools[0];
              const resolved = resolveToolExecution(
                primaryTool,
                fullRuntime,
                cached.text
              );
              const draftId = resolved.confirmationDiff
                ? registerDraftFromDiff(resolved.confirmationDiff, cached.engineUsed, cleanPrompt)
                : undefined;

              const extraNotes: string[] = [];
              for (const extraTool of validCachedTools.slice(1)) {
                const extraResolved = resolveToolExecution(extraTool, fullRuntime);
                if (extraResolved.confirmationDiff) {
                  registerDraftFromDiff(extraResolved.confirmationDiff, cached.engineUsed, cleanPrompt);
                  extraNotes.push(`• مسودة إضافية: ${extraResolved.confirmationDiff.title}`);
                } else if (extraResolved.replyText) {
                  extraNotes.push(`• ${extraResolved.replyText}`);
                }
              }

              appendMessage({
                role: 'assistant',
                text:
                  extraNotes.length > 0
                    ? `${resolved.replyText}\n\nإجراءات إضافية مرتبطة:\n${extraNotes.join('\n')}`
                    : resolved.replyText,
                engineUsed: cached.engineUsed,
                engineLabel: `${cached.engineLabel} · ذاكرة سريعة`,
                modelId: cached.modelId,
                specialtyTitle: specialtyDecision.specialtyTitle,
                fromCache: true,
                stealthExecuted: resolved.stealthExecuted,
                gracefulLevel: resolved.gracefulLevel,
                choices: resolved.choices,
                confirmationDiff: resolved.confirmationDiff ?? undefined,
                pendingDraftId: draftId,
                spotlightAction: resolved.spotlightAction,
                sandboxNotice: resolved.sandboxNotice,
                diagnosticsReport: resolved.diagnosticsReport,
                resultCard: resolved.resultCard,
              });
              if (resolved.stealthExecuted && options?.fromFloatingWidget && resolved.autoCloseChat) {
                emitAppToast({ title: 'تنفيذ فوري — Morrow', description: resolved.replyText, tone: 'success' });
                setIsOpen(false);
              }
              return;
            }
          }
          appendMessage({
            role: 'assistant',
            text: cached.text,
            engineUsed: cached.engineUsed,
            engineLabel: `${cached.engineLabel} · ذاكرة سريعة`,
            modelId: cached.modelId,
            specialtyTitle: specialtyDecision.specialtyTitle,
            fromCache: true,
            gracefulLevel: 'A',
          });
          return;
        }
      }

      const quotaCheck = evaluateOnlineQuota(quotaStats, assistantSettings);
      if (!quotaCheck.allowed) {
        presentOfflineOutcome(localProbe, cleanPrompt, quotaCheck.reason, options);
        return;
      }

      const requestController = new AbortController();
      activeRequestControllerRef.current = requestController;
      setIsThinking(true);
      setQuotaStats((prev) => recordOnlineRequest(prev, activeModel));
      const requestStartedAt = Date.now();

      try {
        const { cloudContext, cloudHistory } = liveCloudPayload;

        type ChatApiPayload = {
          ok?: boolean;
          fallbackToOffline?: boolean;
          quotaExhausted?: boolean;
          fallbackUsed?: boolean;
          reason?: string;
          error?: string;
          engineUsed?: AssistantEngineSource;
          engineLabel?: string;
          modelId?: string;
          latencyMs?: number;
          collaborationMode?: string;
          collaborationTrace?: AssistantCollaborationStep[];
          suggestedFollowUps?: AssistantSmartSuggestion[];
          recommendedCanvasMode?: MorrowCanvasMode;
          attempts?: Array<{
            modelId?: string;
            status?: string;
            latencyMs?: number;
            detail?: string;
          }>;
          text?: string;
          toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
        };

        let notifiedFallback = false;

        const fallbackResult = await executeWithSmartFallback<ChatApiPayload>({
          priorityModels: fallbackChain,
          externalSignal: requestController.signal,
          perModelTimeoutMs: specialtyDecision.recommendedTimeoutMs,
          onFallbackSwitch: ({ toModelId }) => {
            if (!notifiedFallback) {
              notifiedFallback = true;
              const nextSpec = getEngineDisplayMeta(mapModelIdToEngineSource(toModelId), toModelId);
              emitAppToast({
                title: `تحويل تلقائي ذكي إلى ${nextSpec.shortLabel}`,
                description:
                  'واجه النموذج الأول ضغطاً مؤقتاً — تم التوجيه تلقائياً للنموذج البديل.',
                tone: 'info',
              });
            }
          },
          executor: async (candidateModelId, signal, attemptIndex) => {
            const remainingChain = fallbackChain.slice(attemptIndex);
            const res = await fetch('/api/assistant/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal,
              body: JSON.stringify({
                prompt: cleanPrompt,
                brainMode,
                routingStrategy: assistantSettings.routingStrategy,
                collaborationMode: assistantSettings.collaborationMode,
                responseStyle: assistantSettings.responseStyle || 'balanced',
                taskKey: specialtyDecision.specialty,
                taskRouting: assistantSettings.taskRouting,
                pipeline: specialtyDecision.pipeline,
                preferredModel: candidateModelId,
                fallbackModel: remainingChain[1] || OPENROUTER_NEMOTRON_MODEL,
                preferredChain: remainingChain,
                cloudContext,
                cloudHistory,
              }),
            });

            const parsedData = (await res.json().catch(() => ({}))) as ChatApiPayload;

            // Mirror server attempt health telemetry into client circuit-breaker registry
            if (Array.isArray(parsedData.attempts)) {
              for (const att of parsedData.attempts) {
                const attId = att.modelId as ApprovedCloudModelId | undefined;
                if (!attId) continue;
                if (att.status === 'ok') {
                  markModelSuccess(attId, att.latencyMs ?? 800);
                } else if (att.status === 'rate_limited_429') {
                  markModelFailure(attId, new Error(att.detail || '429 rate limit'), 429);
                } else if (att.status === 'timeout_503') {
                  markModelFailure(attId, new Error(att.detail || '503 service unavailable'), 503);
                }
              }
            }

            if (
              res.status === 429 ||
              res.status === 502 ||
              res.status === 503 ||
              res.status === 504
            ) {
              const statusErr = new Error(
                parsedData?.error || parsedData?.reason || `HTTP ${res.status}`
              ) as Error & { status?: number };
              statusErr.status = res.status;
              throw statusErr;
            }

            if (!res.ok) {
              throw new Error(parsedData?.error || `HTTP ${res.status}`);
            }

            return {
              value: parsedData,
              usedModelId: (parsedData.modelId && parsedData.modelId !== 'morrow-local'
                ? parsedData.modelId
                : candidateModelId) as ApprovedCloudModelId,
            };
          },
        });

        setHealthTick((t) => t + 1);

        if (fallbackResult.abortedByUser) {
          return;
        }

        const data = fallbackResult.data || {};
        if (!fallbackResult.ok || !data.ok || data.fallbackToOffline) {
          if (data.quotaExhausted || fallbackResult.quotaOrRateLimited) {
            setQuotaStats((prev) => markQuotaExhausted(prev, 90_000));
          }
          if (!notifiedFallback) {
            emitAppToast({
              title: 'متابعة تلقائية بمحرك Morrow المحلي',
              description:
                data.reason ||
                'النماذج السحابية غير متاحة أو مزدحمة حالياً — تم إكمال عملك محلياً بهدوء ودون توقف.',
              tone: 'info',
            });
          }
          presentOfflineOutcome(localProbe, cleanPrompt, data.reason, options);
          return;
        }

        const resolvedModelId = data.modelId || fallbackResult.usedModelId || activeModel;
        const resolvedEngine: AssistantEngineSource =
          data.engineUsed || mapModelIdToEngineSource(resolvedModelId);
        const engineMeta = getEngineDisplayMeta(resolvedEngine, resolvedModelId);
        const elapsedMs = data.latencyMs ?? (Date.now() - requestStartedAt);

        if ((data.fallbackUsed || fallbackResult.fallbackUsed) && !notifiedFallback) {
          emitAppToast({
            title: `تم التحويل التلقائي إلى ${engineMeta.shortLabel}`,
            description: `نُفّذ الطلب بسلاسة عبر (${resolvedModelId}) بعد تعذر أو ازدحام النموذج الأول.`,
            tone: 'info',
          });
        }

        const validatedTools = Array.isArray(data.toolCalls)
          ? data.toolCalls
              .map((raw) => validateToolCall(raw))
              .filter((v): v is { valid: true; sanitized: AssistantToolCall } =>
                Boolean(v.valid && v.sanitized)
              )
              .map((v) => v.sanitized)
          : [];

        if (validatedTools.length > 0) {
          const primaryTool = validatedTools[0];
          const resolved = resolveToolExecution(primaryTool, fullRuntime, data.text);
          if (resolved.nextSlotSession !== undefined) {
            setSlotSession(resolved.nextSlotSession);
          }
          if (assistantSettings.cacheEnabled) {
            setResponseCache((prev) =>
              setCachedAssistantResponse(prev, {
                key: cacheKey,
                text: data.text || resolved.replyText,
                engineUsed: resolvedEngine,
                engineLabel: data.engineLabel || engineMeta.badgeLabel,
                modelId: data.modelId || engineMeta.modelId,
                toolCalls: validatedTools,
              })
            );
          }
          const draftId = resolved.confirmationDiff
            ? registerDraftFromDiff(resolved.confirmationDiff, resolvedEngine, cleanPrompt)
            : undefined;

          const extraNotes: string[] = [];
          for (const extraTool of validatedTools.slice(1)) {
            const extraResolved = resolveToolExecution(extraTool, fullRuntime);
            if (extraResolved.confirmationDiff) {
              registerDraftFromDiff(extraResolved.confirmationDiff, resolvedEngine, cleanPrompt);
              extraNotes.push(`• مسودة إضافية: ${extraResolved.confirmationDiff.title}`);
            } else if (extraResolved.replyText) {
              extraNotes.push(`• ${extraResolved.replyText}`);
            }
          }

          const recommendedHandoff: AssistantCanvasHandoff | undefined =
            resolved.canvasHandoff ||
            (data.recommendedCanvasMode
              ? {
                  canvasMode: data.recommendedCanvasMode,
                  label: 'عرض النتيجة في اللوحة التفاعلية',
                }
              : undefined);

          appendMessage({
            role: 'assistant',
            text:
              extraNotes.length > 0
                ? `${resolved.replyText}\n\nإجراءات إضافية مرتبطة:\n${extraNotes.join('\n')}`
                : resolved.replyText,
            engineUsed: resolvedEngine,
            engineLabel: data.engineLabel || engineMeta.badgeLabel,
            modelId: data.modelId || engineMeta.modelId,
            specialtyTitle: specialtyDecision.specialtyTitle,
            latencyMs: elapsedMs,
            stealthExecuted: resolved.stealthExecuted,
            gracefulLevel: resolved.gracefulLevel,
            collaborationTrace: data.collaborationTrace,
            canvasHandoff: recommendedHandoff,
            suggestedFollowUps:
              data.suggestedFollowUps && data.suggestedFollowUps.length > 0
                ? data.suggestedFollowUps
                : resolved.suggestedFollowUps,
            choices: [
              ...(resolved.choices || []),
              ...(draftId
                ? [
                    {
                      id: `open_drafts_${draftId}`,
                      label: 'عرض في الموافقات',
                      actionType: 'open_command_center_tab' as const,
                      payload: { tab: 'approvals' },
                    },
                  ]
                : []),
            ],
            confirmationDiff: resolved.confirmationDiff ?? undefined,
            pendingDraftId: draftId,
            spotlightAction: resolved.spotlightAction,
            sandboxNotice: resolved.sandboxNotice,
            diagnosticsReport: resolved.diagnosticsReport,
            resultCard: resolved.resultCard,
          });
          if (resolved.extraDraftTools && resolved.extraDraftTools.length > 0) {
            stageToolDrafts(resolved.extraDraftTools, engineMeta.shortLabel);
          }
          if (resolved.stealthExecuted) {
            emitAppToast({
              title: `تنفيذ صامت (${engineMeta.shortLabel})`,
              description: resolved.replyText,
              tone: 'success',
            });
            if (options?.fromFloatingWidget && resolved.autoCloseChat) {
              setIsOpen(false);
            }
          }
          return;
        }

        if (
          validatedTools.length === 0 &&
          localProbe.handled &&
          localProbe.stealthAutoExecute &&
          localProbe.toolCall
        ) {
          const stealthResolved = resolveToolExecution(
            localProbe.toolCall,
            fullRuntime,
            data.text
          );
          if (stealthResolved.stealthExecuted) {
            emitAppToast({
              title: `تنفيذ صامت عبر ${engineMeta.shortLabel}`,
              description: stealthResolved.replyText,
              tone: 'success',
            });
          }
        }

        const replyText =
          data.text ||
          'وصلتني الفكرة، تقدر توضح لي أكثر حتى أساعدك بدقة؟';

        if (assistantSettings.cacheEnabled) {
          setResponseCache((prev) =>
            setCachedAssistantResponse(prev, {
              key: cacheKey,
              text: replyText,
              engineUsed: resolvedEngine,
              engineLabel: data.engineLabel || engineMeta.badgeLabel,
              modelId: data.modelId || engineMeta.modelId,
            })
          );
        }

        appendMessage({
          role: 'assistant',
          text: replyText,
          engineUsed: resolvedEngine,
          engineLabel: data.engineLabel || engineMeta.badgeLabel,
          modelId: data.modelId || engineMeta.modelId,
          specialtyTitle: specialtyDecision.specialtyTitle,
          latencyMs: elapsedMs,
          gracefulLevel: 'A',
          collaborationTrace: data.collaborationTrace,
          suggestedFollowUps: data.suggestedFollowUps,
          canvasHandoff: data.recommendedCanvasMode
            ? {
                canvasMode: data.recommendedCanvasMode,
                label: 'متابعة التحليل في اللوحة التفاعلية',
              }
            : undefined,
          choices: [
            {
              id: `center_link_${Date.now()}`,
              label: 'فتح مركز Morrow',
              actionType: 'open_command_center_tab',
              payload: { tab: 'chat' },
            },
          ],
        });
      } catch (err) {
        if (requestController.signal.aborted) {
          return;
        }
        emitAppToast({
          title: 'استمرارية ذكية دون مقاطعة',
          description:
            err instanceof Error && err.message
              ? `تعذر السحابة مؤقتاً — تم التحويل تلقائياً لمحرك Morrow المحلي.`
              : 'تعذر الوصول للسحابة مؤقتاً — تم تحويل الطلب تلقائياً إلى محرك Morrow المحلي.',
          tone: 'info',
        });
        presentOfflineOutcome(
          localProbe,
          cleanPrompt,
          'تعذر الاتصال بالسحابة حالياً — حولت الطلب لمحرك Morrow المحلي تلقائياً.',
          options
        );
      } finally {
        if (activeRequestControllerRef.current === requestController) {
          activeRequestControllerRef.current = null;
        }
        setIsThinking(false);
      }
    },
    [
      isThinking,
      slotSession,
      assistantSettings,
      brainMode,
      browserOnline,
      cloudConfigured,
      fullRuntime,
      conversationMemory,
      responseCache,
      quotaStats,
      liveCloudPayload,
      appendMessage,
      runLocalAndRespond,
      presentOfflineOutcome,
      registerDraftFromDiff,
      stageToolDrafts,
    ]
  );

  const retryLastPrompt = useCallback(
    (explicitPrompt?: string) => {
      const target = (explicitPrompt || lastUserPromptRef.current).trim();
      if (!target || isThinking) return;
      void sendMessage(target, { bypassCache: true });
    },
    [isThinking, sendMessage]
  );

  const handleLiveVoiceToolAction = useCallback(
    (rawTool: AssistantToolCall): string => {
      const checked = validateToolCall(rawTool);
      if (!checked.valid || !checked.sanitized) {
        return checked.error || 'أمر غير مكتمل من الجلسة المباشرة.';
      }
      const tc = checked.sanitized;
      const resolved = resolveToolExecution(tc, fullRuntime);
      if (resolved.confirmationDiff) {
        const draftId = registerDraftFromDiff(
          resolved.confirmationDiff,
          'gemini_3_8_live',
          'أمر صوتي مباشر (Live)'
        );
        appendMessage({
          role: 'assistant',
          text: `من المحادثة المباشرة لايف — جهّزت مسودة «${resolved.confirmationDiff.title}» للمراجعة:`,
          engineUsed: 'gemini_3_8_live',
          engineLabel: 'Gemini 3.8 Live · أمر مباشر',
          modelId: AI_FREE_MODELS.GEMINI_3_8_LIVE,
          gracefulLevel: 'A',
          confirmationDiff: resolved.confirmationDiff,
          pendingDraftId: draftId,
        });
        emitAppToast({
          title: 'مسودة جديدة من المحادثة لايف',
          description: resolved.confirmationDiff.title,
          tone: 'info',
        });
        return `تم تجهيز مسودة «${resolved.confirmationDiff.title}» للموافقة الآمنة.`;
      }

      if (resolved.replyText) {
        appendMessage({
          role: 'assistant',
          text: resolved.replyText,
          engineUsed: 'gemini_3_8_live',
          engineLabel: 'Gemini 3.8 Live · تنفيذ مباشر',
          modelId: AI_FREE_MODELS.GEMINI_3_8_LIVE,
          gracefulLevel: resolved.gracefulLevel,
          spotlightAction: resolved.spotlightAction,
          resultCard: resolved.resultCard,
          canvasHandoff: resolved.canvasHandoff,
          suggestedFollowUps: resolved.suggestedFollowUps,
        });
      }
      if (resolved.extraDraftTools && resolved.extraDraftTools.length > 0) {
        stageToolDrafts(resolved.extraDraftTools, 'جلسة لايف المباشرة');
      }
      return resolved.replyText || 'تم تنفيذ الطلب في التطبيق.';
    },
    [fullRuntime, registerDraftFromDiff, stageToolDrafts, appendMessage]
  );

  const verifyMorrowSystemIntegrity = useCallback(async (): Promise<MorrowSystemVerificationReport> => {
    const checks: MorrowSystemCheckItem[] = [];
    const lw = liveCloudPayload.cloudContext.liveWorkspace;

    // 1. Root workspace state & live metrics parity
    const agencyParity =
      Boolean(lw) &&
      lw!.agenciesBreakdown.length === fullRuntime.state.agencies.length &&
      lw!.totalRegisteredHouseholds === fullRuntime.state.persons.length;

    checks.push({
      id: 'workspace_binding',
      label: 'الربط الجذري ببيانات الوكالات والأفراد',
      status: agencyParity ? 'ok' : 'warning',
      detail: lw
        ? `مربوط لحظياً مع ${lw.agenciesBreakdown.length} وكالات · ${lw.totalActiveIndividuals.toLocaleString('ar-IQ')} فرد نشط · ${lw.totalFullBags.toLocaleString('ar-IQ')} كيس (${lw.periodName})`
        : 'تعذر قراءة ملخص الحصة الحالية.',
    });

    // 2. Local brain + Diagnostics engine probe
    const localProbe = runOfflineBrain({
      prompt: 'احصائيات',
      state: fullRuntime.state,
      uiContext: fullRuntime.uiContext,
      slotSession: null,
      memory: conversationMemory,
    });
    const diag = runAppDiagnostics(fullRuntime.state, lastBackupAt);

    checks.push({
      id: 'morrow_local_probe',
      label: 'محرك Morrow المحلي والتشخيص الفوري',
      status: localProbe.handled ? 'ok' : 'warning',
      detail: `استجابة محلية فورية (${Math.round(localProbe.confidence * 100)}%) · درجة سلامة الجداول ${diag.healthScore}% (${diag.totalIssues} ملاحظة)`,
    });

    // 3. Zero-trust tool validation gate
    const badCheck = validateToolCall({ name: 'archive_person', args: {} });
    const goodCheck = validateToolCall({ name: 'get_stats_profit', args: {} });
    checks.push({
      id: 'zero_trust_tools',
      label: 'بوابة الأمان والصفّر-ثقة للأدوات',
      status: !badCheck.valid && goodCheck.valid ? 'ok' : 'error',
      detail:
        !badCheck.valid && goodCheck.valid
          ? 'تمنع التنفيذ العشوائي وتُمرّر أي تعديل عبر مسودة «قبل ← بعد».'
          : 'فحص التحقق من الأدوات يحتاج مراجعة.',
    });

    // 4. Privacy context & masking check
    const privacyMode = liveCloudPayload.cloudContext.privacyMode;
    checks.push({
      id: 'privacy_masking',
      label: 'حماية الخصوصية وسياق النماذج السحابية',
      status: 'ok',
      detail:
        privacyMode === 'names_allowed_by_user'
          ? `مفعل: السحابة ترى المؤشرات + دليل الأسماء المصرح به (${liveCloudPayload.cloudContext.beneficiaryDirectory?.length ?? 0})`
          : 'مفعل: السحابة ترى الإحصائيات والوكالات كاملة مع حجب أسماء المستفيدين تلقائياً',
    });

    // 5. Server status & all cloud models binding check
    try {
      const res = await fetch('/api/assistant/status');
      if (res.ok) {
        const statusJson = (await res.json()) as {
          cloudConfigured?: boolean;
          providers?: { google?: boolean; groq?: boolean; openrouter?: boolean };
          models?: Array<{ id: string; provider: string; configured: boolean }>;
          defaultModel?: string;
          fallbackModel?: string;
          liveModel?: string;
          multimodalModel?: string;
        };
        setCloudConfigured(Boolean(statusJson.cloudConfigured));
        const allModels = statusJson.models || [];
        const activeModels = allModels
          .filter((m) => m.configured)
          .map((m) => m.id);
        const totalCount = allModels.length || 7;
        const missingProviders: string[] = [];
        if (!statusJson.providers?.google) missingProviders.push('GEMINI_API_KEY');
        if (!statusJson.providers?.groq) missingProviders.push('GROQ_API_KEY');
        if (!statusJson.providers?.openrouter) missingProviders.push('OPENROUTER_API_KEY');

        checks.push({
          id: 'cloud_and_live_status',
          label: 'النماذج السحابية + المباشر لايف + الصوتي + Morrow المحلي',
          status: statusJson.cloudConfigured && missingProviders.length === 0 ? 'ok' : 'warning',
          detail: statusJson.cloudConfigured
            ? activeModels.length === totalCount
              ? `متصل بالكامل (${activeModels.length}/${totalCount} نماذج مجانية): ${activeModels.join(' · ')}`
              : `متصل جزئياً (${activeModels.length}/${totalCount}): ${activeModels.join(' · ')}${missingProviders.length > 0 ? ` — مفاتيح ناقصة: ${missingProviders.join(', ')}` : ''}`
            : `مفاتيح السحابة غير مهيأة (${missingProviders.join(', ')}) — يعتمد التطبيق بكفاءة على Morrow المحلي.`,
        });
      } else {
        checks.push({
          id: 'cloud_and_live_status',
          label: 'النماذج السحابية الستة + الصوتي + Morrow المحلي',
          status: 'warning',
          detail: 'تعذر الوصول لحالة الخادم السحابي حالياً (HTTP ' + res.status + ').',
        });
      }
    } catch {
      checks.push({
        id: 'cloud_and_live_status',
        label: 'النماذج السحابية الستة + الصوتي + Morrow المحلي',
        status: 'warning',
        detail: 'وضع العمل بدون اتصال — محرك Morrow المحلي يعمل بالكامل.',
      });
    }

    const activeMeta =
      brainMode === 'local'
        ? 'Morrow المحلي'
        : brainMode === 'gemini_3_8_flash'
          ? 'Gemini 3.8 Flash'
          : brainMode === 'gemini_3_5_flash'
            ? 'Gemini 3.5 Flash'
            : brainMode === 'gemini_3_5_flash_lite'
              ? 'Gemini 3.5 Flash Lite'
              : brainMode === 'nemotron_free'
                ? 'Nemotron 3.5 Super VL'
                : brainMode === 'openrouter_free'
                  ? 'OpenRouter Free'
                  : 'التصعيد التلقائي المتكامل (6+1)';

    return {
      checkedAt: new Date().toISOString(),
      allPassed: checks.every((c) => c.status !== 'error'),
      activeModelLabel: activeMeta,
      boundAgenciesCount: fullRuntime.state.agencies.length,
      boundPersonsCount: fullRuntime.state.persons.length,
      checks,
    };
  }, [liveCloudPayload, fullRuntime.state, fullRuntime.uiContext, conversationMemory, lastBackupAt, brainMode]);

  const flushNextCompoundStepIfAny = useCallback(() => {
    setPendingCompoundQueue((prev) => {
      if (prev.length === 0) return prev;
      const [nextStep, ...rest] = prev;
      window.setTimeout(() => {
        const outcome = runOfflineBrain({
          prompt: nextStep,
          state: fullRuntime.state,
          uiContext: fullRuntime.uiContext,
          slotSession: null,
          memory: conversationMemory,
        });
        presentOfflineOutcome(outcome, nextStep);
      }, 60);
      return rest;
    });
  }, [fullRuntime, conversationMemory, presentOfflineOutcome]);

  const approveOrRejectDraft = useCallback(
    (draftId: string, approved: boolean) => {
      const targetDraft = approvalDrafts.find((d) => d.id === draftId);
      if (!targetDraft || targetDraft.status !== 'pending') return;

      let resultText = 'تم رفض المسودة ولم يتغير أي سجل.';
      if (approved) {
        resultText = executeApprovedToolMutation(
          targetDraft.diff.toolCall,
          fullRuntime
        );
        if (targetDraft.diff.toolCall.args?.personId) {
          applyMemoryPatch({
            lastPersonId: Number(targetDraft.diff.toolCall.args.personId),
          });
        }
        emitAppToast({
          title: 'تمت الموافقة والتنفيذ',
          description: resultText,
          tone: 'success',
        });
      } else {
        emitAppToast({
          title: 'تم إلغاء المسودة',
          description: 'بقيت الجداول كما هي بدون تعديل.',
          tone: 'info',
        });
      }

      setApprovalDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId
            ? {
                ...d,
                status: approved ? 'approved' : 'rejected',
                resolvedAt: new Date().toISOString(),
                resultText,
                diff: {
                  ...d.diff,
                  status: approved ? 'approved' : 'cancelled',
                },
              }
            : d
        )
      );

      setMessages((prev) =>
        prev.map((m) => {
          const matchesDraft =
            m.pendingDraftId === draftId || m.confirmationDiff?.id === targetDraft.diff.id;
          if (!matchesDraft || !m.confirmationDiff) return m;
          return {
            ...m,
            confirmationDiff: {
              ...m.confirmationDiff,
              status: approved ? 'approved' : 'cancelled',
            },
          };
        })
      );

      appendMessage({
        role: 'assistant',
        text: resultText,
        engineUsed: 'morrow_local',
        canUndo: approved,
        gracefulLevel: 'A',
      });
      flushNextCompoundStepIfAny();
    },
    [approvalDrafts, fullRuntime, applyMemoryPatch, appendMessage, flushNextCompoundStepIfAny]
  );

  const handleChoiceClick = useCallback(
    (choice: AssistantChoiceChip) => {
      if (choice.actionType === 'send_prompt') {
        const promptText = String(choice.payload.prompt || '').trim();
        if (promptText) void sendMessage(promptText);
        return;
      }

      if (choice.actionType === 'open_command_center_tab') {
        const tab = (choice.payload.tab as MorrowCenterTab) || 'approvals';
        openCommandCenter(tab);
        return;
      }

      if (choice.actionType === 'approve_draft') {
        const draftId = String(choice.payload.draftId || '');
        if (draftId) approveOrRejectDraft(draftId, true);
        return;
      }

      if (choice.actionType === 'undo_action') {
        undoLastAssistantAction();
        return;
      }

      if (choice.actionType === 'slot_answer' && slotSession) {
        const answerLabel = choice.label;
        appendMessage({ role: 'user', text: answerLabel });
        const outcome = continueSlotSession(
          slotSession,
          choice.payload.agencyId !== undefined
            ? String(choice.payload.agencyId)
            : choice.payload.individuals !== undefined
            ? String(choice.payload.individuals)
            : answerLabel,
          fullRuntime.state,
          fullRuntime.uiContext
        );
        applyMemoryPatch(outcome.memoryPatch);
        setSlotSession(outcome.nextSlotSession ?? null);
        const draftId = outcome.confirmationDiff
          ? registerDraftFromDiff(outcome.confirmationDiff, 'morrow_local', slotSession.originalPrompt)
          : undefined;
        appendMessage({
          role: 'assistant',
          text: outcome.replyText,
          engineUsed: 'morrow_local',
          confidence: outcome.confidence,
          gracefulLevel: outcome.gracefulLevel,
          choices: outcome.choices,
          confirmationDiff: outcome.confirmationDiff ?? undefined,
          pendingDraftId: draftId,
        });
        return;
      }

      if (choice.actionType === 'select_person') {
        const personId = Number(choice.payload.personId);
        const person = fullRuntime.state.persons.find((p) => p.id === personId);
        if (!person) return;

        applyMemoryPatch({
          lastPersonId: person.id,
          lastPersonName: person.name,
          lastAgencyId: person.agencyId,
        });

        const followUp = String(choice.payload.followUpAction || 'focus_person');
        if (followUp === 'focus_person') {
          fullRuntime.selectAgency(person.agencyId);
          fullRuntime.navigate('agency_roster');
          fullRuntime.focusPerson(person.id);
          fullRuntime.issueTableCommand({
            agencyId: person.agencyId,
            focusPersonId: person.id,
          });
          appendMessage({
            role: 'assistant',
            text: `فتحت جدول الوكالة وحددت سطر «${person.name}».`,
            engineUsed: 'morrow_local',
            gracefulLevel: 'A',
          });
          return;
        }

        const tc: AssistantToolCall =
          followUp === 'archive_person'
            ? { name: 'archive_person', args: { personId: person.id } }
            : followUp === 'block_person'
            ? {
                name: 'update_person',
                args: { personId: person.id, blockType: 'full' },
              }
            : {
                name: 'update_person',
                args: {
                  personId: person.id,
                  ...(choice.payload.patchArgs &&
                  typeof choice.payload.patchArgs === 'object'
                    ? (choice.payload.patchArgs as Record<string, unknown>)
                    : {}),
                  ...(choice.payload.extractedNumber !== undefined &&
                  choice.payload.extractedNumber !== null
                    ? { individuals: Number(choice.payload.extractedNumber) }
                    : {}),
                },
              };
        const diff = buildBeforeAfterDiff(fullRuntime.state, tc, person.id);
        const draftId = diff
          ? registerDraftFromDiff(diff, 'morrow_local', `تعديل ${person.name}`)
          : undefined;
        appendMessage({
          role: 'assistant',
          text: diff
            ? 'جهّزت مسودة التعديل لـ «' + person.name + '» للموافقة والتنفيذ:'
            : `اخترت «${person.name}». ما التعديل الذي تريده عليه؟`,
          engineUsed: 'morrow_local',
          gracefulLevel: diff ? 'A' : 'B',
          confirmationDiff: diff ?? undefined,
          pendingDraftId: draftId,
        });
        if (!diff) {
          fullRuntime.focusPerson(person.id);
        }
        return;
      }

      if (choice.actionType === 'navigate_spotlight') {
        triggerSpotlight({
          view: (choice.payload.view as AppView) || 'hub',
          settingsSection: choice.payload.settingsSection as
            | SettingsSectionId
            | undefined,
          targetId: String(choice.payload.targetId || ''),
          title: choice.label,
          description: choice.sublabel || 'العنصر المطلوب',
        });
        return;
      }

      if (choice.actionType === 'run_tool') {
        const rawTool = choice.payload.toolCall as {
          name?: unknown;
          args?: unknown;
        };
        const validated = validateToolCall(rawTool);
        if (validated.valid && validated.sanitized) {
          const resolved = resolveToolExecution(validated.sanitized, fullRuntime);
          if (resolved.nextSlotSession !== undefined) {
            setSlotSession(resolved.nextSlotSession);
          }
          const draftId = resolved.confirmationDiff
            ? registerDraftFromDiff(resolved.confirmationDiff, 'morrow_local', choice.label)
            : undefined;
          appendMessage({
            role: 'assistant',
            text: resolved.replyText,
            engineUsed: 'morrow_local',
            stealthExecuted: resolved.stealthExecuted,
            gracefulLevel: resolved.gracefulLevel,
            choices: resolved.choices,
            confirmationDiff: resolved.confirmationDiff ?? undefined,
            pendingDraftId: draftId,
            spotlightAction: resolved.spotlightAction,
            sandboxNotice: resolved.sandboxNotice,
            diagnosticsReport: resolved.diagnosticsReport,
          });
        }
        return;
      }

      if (choice.actionType === 'queue_offline') {
        const promptText = String(choice.payload.prompt || '').trim();
        if (promptText) {
          savePromptToQueue(promptText, 'محفوظ للتنفيذ عند توفر الإنترنت');
          appendMessage({
            role: 'assistant',
            text: `تم حفظ الطلب «${promptText}» وسأذكّرك به فور عودة الإنترنت.`,
            engineUsed: 'morrow_local',
            gracefulLevel: 'C',
          });
        }
      }
    },
    [
      slotSession,
      fullRuntime,
      sendMessage,
      openCommandCenter,
      approveOrRejectDraft,
      undoLastAssistantAction,
      appendMessage,
      applyMemoryPatch,
      registerDraftFromDiff,
      triggerSpotlight,
      savePromptToQueue,
    ]
  );

  const resolveConfirmationDiff = useCallback(
    (messageId: string, approved: boolean) => {
      const targetMsg = messages.find((m) => m.id === messageId);
      const targetDiff = targetMsg?.confirmationDiff || null;
      if (!targetDiff || targetDiff.status !== 'pending') return;

      const linkedDraftId =
        targetMsg?.pendingDraftId || `draft_${targetDiff.id}`;
      const existingDraft = approvalDrafts.find((d) => d.id === linkedDraftId);
      if (existingDraft) {
        approveOrRejectDraft(linkedDraftId, approved);
        return;
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.confirmationDiff) return m;
          return {
            ...m,
            confirmationDiff: {
              ...m.confirmationDiff,
              status: approved ? 'approved' : 'cancelled',
            },
          };
        })
      );

      if (!approved) {
        appendMessage({
          role: 'assistant',
          text: 'تم إلغاء التعديل ولم يتغير أي سجل.',
          engineUsed: 'morrow_local',
          gracefulLevel: 'A',
        });
        flushNextCompoundStepIfAny();
        return;
      }

      const resultText = executeApprovedToolMutation(
        targetDiff.toolCall,
        fullRuntime
      );
      if (targetDiff.toolCall.args?.personId) {
        applyMemoryPatch({
          lastPersonId: Number(targetDiff.toolCall.args.personId),
        });
      }
      emitAppToast({
        title: 'تمت الموافقة والتنفيذ',
        description: resultText,
        tone: 'success',
      });
      appendMessage({
        role: 'assistant',
        text: resultText,
        engineUsed: 'morrow_local',
        canUndo: true,
        gracefulLevel: 'A',
      });
      flushNextCompoundStepIfAny();
    },
    [
      messages,
      approvalDrafts,
      approveOrRejectDraft,
      fullRuntime,
      appendMessage,
      applyMemoryPatch,
      flushNextCompoundStepIfAny,
    ]
  );

  const runQueuedTask = useCallback(
    async (task: AssistantQueuedTask) => {
      removeQueuedTask(task.id);
      await sendMessage(task.prompt);
    },
    [removeQueuedTask, sendMessage]
  );

  const togglePinMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isPinned: !m.isPinned } : m))
    );
  }, []);

  const exportChatHistoryJson = useCallback(() => {
    try {
      const payload = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          messagesCount: messages.length,
          messages,
        },
        null,
        2
      );
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `morrow-chat-history-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      emitAppToast({
        title: 'تم تصدير سجل محادثة Morrow',
        tone: 'success',
      });
    } catch {
      emitAppToast({
        title: 'تعذر تصدير السجل حالياً',
        tone: 'error',
      });
    }
  }, [messages]);

  return {
    isOpen,
    setIsOpen,
    brainMode,
    setBrainMode,
    activeCommandCenterTab,
    setActiveCommandCenterTab,
    requestedCanvasHandoff,
    openCommandCenter,
    openCanvasMode,
    connectivity,
    cloudConfigured,
    isThinking,
    messages,
    togglePinMessage,
    exportChatHistoryJson,
    proactiveTip,
    preferences,
    saveCustomMemoryPref,
    deleteUserPref,
    queuedTasks,
    savePromptToQueue,
    removeQueuedTask,
    runQueuedTask,
    approvalDrafts,
    pendingDraftsCount,
    approveDraft: (draftId: string) => approveOrRejectDraft(draftId, true),
    rejectDraft: (draftId: string) => approveOrRejectDraft(draftId, false),
    quickNotes,
    addQuickNote,
    updateQuickNoteLink,
    syncQuickNoteToPerson,
    deleteQuickNote,
    spotlight,
    dismissSpotlight: () => setSpotlight(null),
    triggerSpotlight,
    sendMessage,
    handleChoiceClick,
    resolveConfirmationDiff,
    assistantSettings,
    updateAssistantSettings,
    quotaStats,
    quotaInfo,
    resetQuotaStats,
    cacheCount: responseCache.length,
    clearResponseCache,
    smartSuggestions,
    conversationMemory,
    hasUndoableAssistantMessage,
    undoLastAssistantAction,
    stageToolDrafts,
    lastBackupAt,
    liveCloudContext: liveCloudPayload.cloudContext,
    handleLiveVoiceToolAction,
    verifyMorrowSystemIntegrity,
    cancelActiveRequest,
    clearMessages,
    chatThreads,
    activeThreadId,
    switchChatThread,
    deleteChatThread,
    retryLastPrompt,
    modelHealthSnapshots,
  };
}
