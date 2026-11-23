import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppView, SettingsSectionId } from '../types/agency.ts';
import type {
  AssistantApprovalDraft,
  AssistantBeforeAfterDiff,
  AssistantBrainMode,
  AssistantChoiceChip,
  AssistantConnectivityState,
  AssistantConversationMemory,
  AssistantEngineSource,
  AssistantMessage,
  AssistantQueuedTask,
  AssistantQuickNote,
  AssistantQuotaStats,
  AssistantSettingsConfig,
  AssistantSlotSession,
  AssistantSpotlightState,
  AssistantToolCall,
  AssistantUserPref,
  MorrowCenterTab,
} from '../types/assistant.ts';
import {
  buildAssistantCacheKey,
  getCachedAssistantResponse,
  setCachedAssistantResponse,
  type AssistantCacheEntry,
} from '../utils/assistantCache.ts';
import { getProactiveHealthNotice } from '../utils/assistantDiagnostics.ts';
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
  createInitialQuotaStats,
  DEFAULT_ASSISTANT_SETTINGS,
  deriveAssistantConnectivity,
  evaluateOnlineQuota,
  GEMINI_FLASH_MODEL,
  GEMINI_PRO_MODEL,
  markQuotaExhausted,
  recordOnlineRequest,
  sanitizeAssistantModelId,
} from '../utils/assistantQuota.ts';
import { buildBeforeAfterDiff, validateToolCall } from '../utils/assistantTools.ts';
import { getEngineDisplayMeta, planBrainEscalation } from '../utils/morrowRouter.ts';
import { autoLinkQuickNoteToPerson } from '../utils/quickNotesMatcher.ts';
import { emitAppToast } from './useToastQueue.ts';

const PREFS_STORAGE_KEY = 'tabrex_assistant_prefs_v1';
const QUEUE_STORAGE_KEY = 'tabrex_assistant_queue_v1';
const LAST_BACKUP_STORAGE_KEY = 'tabrex_last_backup_at';
const SETTINGS_STORAGE_KEY = 'morrow_assistant_settings_v1';
const QUOTA_STORAGE_KEY = 'morrow_assistant_quota_v1';
const DRAFTS_STORAGE_KEY = 'morrow_assistant_drafts_v1';
const QUICK_NOTES_STORAGE_KEY = 'morrow_quick_notes_v1';

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

  const [assistantSettings, setAssistantSettingsState] = useState<AssistantSettingsConfig>(
    () => {
      const loaded = readStoredObject(SETTINGS_STORAGE_KEY, DEFAULT_ASSISTANT_SETTINGS);
      return {
        ...loaded,
        preferredModelId: sanitizeAssistantModelId(loaded.preferredModelId),
        fallbackModelId:
          sanitizeAssistantModelId(loaded.fallbackModelId) === GEMINI_FLASH_MODEL
            ? GEMINI_PRO_MODEL
            : sanitizeAssistantModelId(loaded.fallbackModelId),
      };
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

  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    const localMeta = getEngineDisplayMeta('morrow_local');
    return [
      {
        id: 'welcome_msg',
        role: 'assistant',
        createdAt: new Date().toISOString(),
        engineUsed: 'morrow_local',
        engineLabel: localMeta.badgeLabel,
        modelId: localMeta.modelId,
        text: 'أهلاً بك في مساعد Morrow الثلاثي الذكاء. أبدأ محلياً بالردود والحسابات والتنفيذ الصامت فوراً، وأصعّد إلى Gemini 2.5 Flash أو 2.5 Pro عند المهام اللغوية والتحليل العميق — وكل تعديل للبيانات يمر بمسودة موافقة آمنة.',
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
      },
    ];
  });

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
      setAssistantSettingsState((prev) => ({
        ...prev,
        ...patch,
        preferredModelId:
          patch.preferredModelId !== undefined
            ? sanitizeAssistantModelId(patch.preferredModelId)
            : prev.preferredModelId,
        fallbackModelId:
          patch.fallbackModelId !== undefined
            ? sanitizeAssistantModelId(patch.fallbackModelId)
            : prev.fallbackModelId,
      }));
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
    (tab: MorrowCenterTab = 'chat') => {
      setActiveCommandCenterTab(tab);
      runtime.navigate('morrow_center');
      setIsOpen(false);
    },
    [runtime]
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
    }),
    [
      runtime,
      preferences,
      lastBackupAt,
      saveUserPref,
      deleteUserPref,
      triggerSpotlight,
      exportBackupJson,
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

          appendMessage({
            role: 'assistant',
            text: finalText,
            engineUsed: 'morrow_local',
            confidence: outcome.confidence,
            stealthExecuted: stealth,
            gracefulLevel: resolved.gracefulLevel,
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
          });

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

  const sendMessage = useCallback(
    async (rawPrompt: string, options?: { fromFloatingWidget?: boolean }) => {
      const cleanPrompt = enforceSafeArabicTerminology(rawPrompt.trim());
      if (!cleanPrompt || isThinking) return;

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

      const escalation = planBrainEscalation({
        prompt: cleanPrompt,
        brainMode,
        localHandled: localProbe.handled,
        offlineOnly: offlineNow,
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

      if (brainMode === 'auto' && localProbe.handled) {
        presentOfflineOutcome(localProbe, cleanPrompt, undefined, options);
        return;
      }

      const activeModel =
        escalation.cloudChain[0] ||
        (brainMode === 'gemini_2_5_pro'
          ? GEMINI_PRO_MODEL
          : sanitizeAssistantModelId(assistantSettings.preferredModelId));
      const fallbackModel = escalation.cloudChain[1] || GEMINI_PRO_MODEL;

      const cacheKey = buildAssistantCacheKey({
        prompt: cleanPrompt,
        brainMode,
        modelId: activeModel,
        activeView: fullRuntime.uiContext.activeView,
        selectedAgencyId: fullRuntime.uiContext.selectedAgencyId,
      });

      if (assistantSettings.cacheEnabled) {
        const cached = getCachedAssistantResponse(responseCache, cacheKey);
        if (cached) {
          if (cached.toolCalls?.[0]) {
            const validated = validateToolCall(cached.toolCalls[0]);
            if (validated.valid && validated.sanitized) {
              const resolved = resolveToolExecution(
                validated.sanitized,
                fullRuntime,
                cached.text
              );
              const draftId = resolved.confirmationDiff
                ? registerDraftFromDiff(resolved.confirmationDiff, cached.engineUsed, cleanPrompt)
                : undefined;
              appendMessage({
                role: 'assistant',
                text: resolved.replyText,
                engineUsed: cached.engineUsed,
                engineLabel: `${cached.engineLabel} · ذاكرة سريعة`,
                modelId: cached.modelId,
                fromCache: true,
                stealthExecuted: resolved.stealthExecuted,
                gracefulLevel: resolved.gracefulLevel,
                choices: resolved.choices,
                confirmationDiff: resolved.confirmationDiff ?? undefined,
                pendingDraftId: draftId,
                spotlightAction: resolved.spotlightAction,
                sandboxNotice: resolved.sandboxNotice,
                diagnosticsReport: resolved.diagnosticsReport,
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

      setIsThinking(true);
      setQuotaStats((prev) => recordOnlineRequest(prev, activeModel));
      try {
        const allowCloudNames = Boolean(
          fullRuntime.state.securityPrefs?.allowCloudBeneficiaryNames
        );
        const { cloudContext, cloudHistory } = buildCloudContextPayload(
          fullRuntime.uiContext,
          messages,
          allowCloudNames
        );

        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 11500);
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: cleanPrompt,
            brainMode:
              brainMode === 'auto' && escalation.complexity === 'deep'
                ? 'gemini_2_5_pro'
                : brainMode,
            preferredModel: activeModel,
            fallbackModel,
            cloudContext,
            cloudHistory,
          }),
        });
        window.clearTimeout(timer);

        const data = (await res.json()) as {
          ok?: boolean;
          fallbackToOffline?: boolean;
          quotaExhausted?: boolean;
          reason?: string;
          engineUsed?: AssistantEngineSource;
          engineLabel?: string;
          modelId?: string;
          text?: string;
          toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
        };

        if (!res.ok || !data.ok || data.fallbackToOffline) {
          if (data.quotaExhausted) {
            setQuotaStats((prev) => markQuotaExhausted(prev, 90_000));
          }
          presentOfflineOutcome(localProbe, cleanPrompt, data.reason, options);
          return;
        }

        const resolvedEngine: AssistantEngineSource =
          data.engineUsed === 'gemini_2_5_pro' || data.engineUsed === 'gemini_2_5_flash'
            ? data.engineUsed
            : activeModel === GEMINI_PRO_MODEL
            ? 'gemini_2_5_pro'
            : 'gemini_2_5_flash';
        const engineMeta = getEngineDisplayMeta(resolvedEngine);

        const firstToolRaw = Array.isArray(data.toolCalls) ? data.toolCalls[0] : null;
        if (firstToolRaw) {
          const validated = validateToolCall(firstToolRaw);
          if (validated.valid && validated.sanitized) {
            const resolved = resolveToolExecution(
              validated.sanitized,
              fullRuntime,
              data.text
            );
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
                  toolCalls: [validated.sanitized!],
                })
              );
            }
            const draftId = resolved.confirmationDiff
              ? registerDraftFromDiff(resolved.confirmationDiff, resolvedEngine, cleanPrompt)
              : undefined;
            appendMessage({
              role: 'assistant',
              text: resolved.replyText,
              engineUsed: resolvedEngine,
              engineLabel: data.engineLabel || engineMeta.badgeLabel,
              modelId: data.modelId || engineMeta.modelId,
              stealthExecuted: resolved.stealthExecuted,
              gracefulLevel: resolved.gracefulLevel,
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
            });
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
          gracefulLevel: 'A',
          choices: [
            {
              id: `center_link_${Date.now()}`,
              label: 'فتح مركز Morrow',
              actionType: 'open_command_center_tab',
              payload: { tab: 'chat' },
            },
          ],
        });
      } catch {
        presentOfflineOutcome(
          localProbe,
          cleanPrompt,
          'تعذر الاتصال بالسحابة حالياً — حولت الطلب لمحرك Morrow المحلي تلقائياً.',
          options
        );
      } finally {
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
      messages,
      appendMessage,
      runLocalAndRespond,
      presentOfflineOutcome,
      registerDraftFromDiff,
    ]
  );

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

  return {
    isOpen,
    setIsOpen,
    brainMode,
    setBrainMode,
    activeCommandCenterTab,
    setActiveCommandCenterTab,
    openCommandCenter,
    connectivity,
    cloudConfigured,
    isThinking,
    messages,
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
  };
}
