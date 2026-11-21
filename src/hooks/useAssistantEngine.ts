import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppView, SettingsSectionId } from '../types/agency.ts';
import type {
  AssistantBrainMode,
  AssistantChoiceChip,
  AssistantConnectivityState,
  AssistantMessage,
  AssistantQueuedTask,
  AssistantSlotSession,
  AssistantSpotlightState,
  AssistantToolCall,
  AssistantUiContext,
  AssistantUserPref,
} from '../types/assistant.ts';
import { getProactiveHealthNotice } from '../utils/assistantDiagnostics.ts';
import {
  executeApprovedToolMutation,
  resolveToolExecution,
  type AssistantActionRuntime,
} from '../utils/assistantExecutor.ts';
import {
  continueSlotSession,
  runOfflineBrain,
} from '../utils/assistantOfflineBrain.ts';
import {
  buildCloudContextPayload,
  enforceSafeArabicTerminology,
} from '../utils/assistantPrivacy.ts';
import { buildBeforeAfterDiff, validateToolCall } from '../utils/assistantTools.ts';

const PREFS_STORAGE_KEY = 'tabrex_assistant_prefs_v1';
const QUEUE_STORAGE_KEY = 'tabrex_assistant_queue_v1';
const LAST_BACKUP_STORAGE_KEY = 'tabrex_last_backup_at';

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

export function useAssistantEngine(params: {
  runtime: Omit<
    AssistantActionRuntime,
    'saveUserPref' | 'deleteUserPref' | 'triggerSpotlight' | 'exportBackupJson'
  >;
  onExportBackupFile: (silentAuto?: boolean) => void;
}) {
  const { runtime, onExportBackupFile } = params;

  const [isOpen, setIsOpen] = useState(false);
  const [brainMode, setBrainMode] = useState<AssistantBrainMode>('auto');
  const [connectivity, setConnectivity] = useState<AssistantConnectivityState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );
  const [cloudConfigured, setCloudConfigured] = useState<boolean>(true);
  const [isThinking, setIsThinking] = useState(false);
  const [slotSession, setSlotSession] = useState<AssistantSlotSession | null>(null);
  const [spotlight, setSpotlight] = useState<AssistantSpotlightState | null>(null);

  const [preferences, setPreferences] = useState<AssistantUserPref[]>(() =>
    readStoredArray<AssistantUserPref>(PREFS_STORAGE_KEY)
  );
  const [queuedTasks, setQueuedTasks] = useState<AssistantQueuedTask[]>(() =>
    readStoredArray<AssistantQueuedTask>(QUEUE_STORAGE_KEY)
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
    // Compute proactively once at initial state / major count changes
    [runtime.state.persons.length, runtime.state.monthlyArchives?.length, lastBackupAt]
  );

  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    {
      id: 'welcome_msg',
      role: 'assistant',
      createdAt: new Date().toISOString(),
      engineUsed: 'local',
      engineLabel: 'المساعد الذكي — تابريكس',
      text: 'أهلاً بك! أنا مساعد تابريكس المدمج. أقدر أبحث، أضيف، أعدل، أصدّر تقارير معزولة، أو أفحص سلامة التطبيق باللهجة العراقية أو السحابة.',
    },
  ]);

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
    const checkStatus = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnectivity('offline');
        return;
      }
      try {
        const res = await fetch('/api/assistant/status');
        if (!res.ok) {
          setConnectivity('offline');
          return;
        }
        const data = (await res.json()) as { cloudConfigured?: boolean };
        setCloudConfigured(Boolean(data.cloudConfigured));
        setConnectivity(data.cloudConfigured ? 'online' : 'offline');
      } catch {
        setConnectivity('offline');
      }
    };
    void checkStatus();

    const onOnline = () => void checkStatus();
    const onOffline = () => setConnectivity('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
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
          label,
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

  const deleteUserPref = useCallback((prefId: string) => {
    setPreferences((prev) => prev.filter((p) => p.id !== prefId));
  }, []);

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

  const appendMessage = useCallback((msg: Omit<AssistantMessage, 'id' | 'createdAt'>) => {
    const entry: AssistantMessage = {
      ...msg,
      text: enforceSafeArabicTerminology(msg.text),
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev.slice(-40), entry]);
    return entry;
  }, []);

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

  const runLocalAndRespond = useCallback(
    (prompt: string, overrideNote?: string) => {
      const outcome = runOfflineBrain({
        prompt,
        state: fullRuntime.state,
        uiContext: fullRuntime.uiContext,
        slotSession,
      });

      if (outcome.nextSlotSession !== undefined) {
        setSlotSession(outcome.nextSlotSession);
      }

      if (outcome.handled) {
        if (outcome.toolCall && !outcome.confirmationDiff) {
          const resolved = resolveToolExecution(
            outcome.toolCall,
            fullRuntime,
            outcome.replyText
          );
          appendMessage({
            role: 'assistant',
            text: overrideNote
              ? `${overrideNote}\n\n${resolved.replyText}`
              : resolved.replyText,
            engineUsed: 'local',
            engineLabel: 'المحرك المحلي (أوفلاين)',
            gracefulLevel: resolved.gracefulLevel,
            choices: resolved.choices || outcome.choices,
            confirmationDiff: resolved.confirmationDiff || outcome.confirmationDiff,
            spotlightAction: resolved.spotlightAction || outcome.spotlightAction,
            sandboxNotice: resolved.sandboxNotice,
            diagnosticsReport:
              resolved.diagnosticsReport || outcome.diagnosticsReport,
          });
          return;
        }

        appendMessage({
          role: 'assistant',
          text: overrideNote
            ? `${overrideNote}\n\n${outcome.replyText}`
            : outcome.replyText,
          engineUsed: 'local',
          engineLabel: 'المحرك المحلي (أوفلاين)',
          gracefulLevel: outcome.gracefulLevel,
          choices: outcome.choices,
          confirmationDiff: outcome.confirmationDiff,
          spotlightAction: outcome.spotlightAction,
          diagnosticsReport: outcome.diagnosticsReport,
        });
        return;
      }

      // Level C graceful degradation when offline & prompt needs cloud reasoning
      appendMessage({
        role: 'assistant',
        text: `${
          overrideNote ? `${overrideNote}\n` : ''
        }${outcome.replyText}\nالسبب: المحرك السحابي غير متاح حالياً (وضع أوفلاين). يمكنك حفظ الطلب وتنفيذه فور عودة الإنترنت، أو استخدام الأوامر السريعة.`,
        engineUsed: 'local',
        engineLabel: 'المحرك المحلي (أوفلاين)',
        gracefulLevel: 'C',
        queuePrompt: { prompt, saved: false },
      });
    },
    [fullRuntime, slotSession, appendMessage]
  );

  const sendMessage = useCallback(
    async (rawPrompt: string) => {
      const cleanPrompt = enforceSafeArabicTerminology(rawPrompt.trim());
      if (!cleanPrompt || isThinking) return;

      appendMessage({ role: 'user', text: cleanPrompt });

      // Active slot-filling stays instant & deterministic locally
      if (slotSession) {
        runLocalAndRespond(cleanPrompt);
        return;
      }

      const offlineNow =
        brainMode === 'local' ||
        connectivity === 'offline' ||
        !cloudConfigured ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (offlineNow) {
        runLocalAndRespond(cleanPrompt);
        return;
      }

      // In 'auto' mode, run fast offline engine first for direct/deterministic commands
      if (brainMode === 'auto') {
        const localProbe = runOfflineBrain({
          prompt: cleanPrompt,
          state: fullRuntime.state,
          uiContext: fullRuntime.uiContext,
          slotSession: null,
        });
        if (localProbe.handled) {
          runLocalAndRespond(cleanPrompt);
          return;
        }
      }

      // Cloud Gemini (Hydrogen / Lite / Collaborative)
      setIsThinking(true);
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
        const timer = window.setTimeout(() => controller.abort(), 9500);
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: cleanPrompt,
            brainMode,
            cloudContext,
            cloudHistory,
          }),
        });
        window.clearTimeout(timer);

        const data = (await res.json()) as {
          ok?: boolean;
          fallbackToOffline?: boolean;
          reason?: string;
          engineUsed?: 'gemini_hydrogen' | 'gemini_lite' | 'collaborative';
          engineLabel?: string;
          text?: string;
          toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
        };

        if (!res.ok || !data.ok || data.fallbackToOffline) {
          setConnectivity('offline');
          runLocalAndRespond(cleanPrompt, data.reason);
          return;
        }

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
            appendMessage({
              role: 'assistant',
              text: resolved.replyText,
              engineUsed: data.engineUsed || 'gemini_hydrogen',
              engineLabel: data.engineLabel || 'Gemini السحابي',
              gracefulLevel: resolved.gracefulLevel,
              choices: resolved.choices,
              confirmationDiff: resolved.confirmationDiff,
              spotlightAction: resolved.spotlightAction,
              sandboxNotice: resolved.sandboxNotice,
              diagnosticsReport: resolved.diagnosticsReport,
            });
            return;
          }
        }

        appendMessage({
          role: 'assistant',
          text:
            data.text ||
            'وصلتني الفكرة، لكن تقدر تحدد لي الإجراء المطلوب بدقة أكثر؟',
          engineUsed: data.engineUsed || 'gemini_hydrogen',
          engineLabel: data.engineLabel || 'Gemini السحابي',
          gracefulLevel: 'A',
        });
      } catch {
        setConnectivity('offline');
        runLocalAndRespond(
          cleanPrompt,
          'تعذر الاتصال بالسحابة حالياً — حولت الطلب للمحرك المحلي تلقائياً.'
        );
      } finally {
        setIsThinking(false);
      }
    },
    [
      isThinking,
      slotSession,
      brainMode,
      connectivity,
      cloudConfigured,
      fullRuntime,
      messages,
      appendMessage,
      runLocalAndRespond,
    ]
  );

  const handleChoiceClick = useCallback(
    (choice: AssistantChoiceChip) => {
      if (choice.actionType === 'slot_answer' && slotSession) {
        const answerLabel = choice.label;
        appendMessage({ role: 'user', text: answerLabel });
        const mergedSlot: AssistantSlotSession = {
          ...slotSession,
          collectedArgs: {
            ...slotSession.collectedArgs,
            ...(choice.payload.agencyId !== undefined
              ? { agencyId: choice.payload.agencyId }
              : {}),
            ...(choice.payload.individuals !== undefined
              ? { individuals: choice.payload.individuals }
              : {}),
          },
        };
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
        // If agencyId was passed directly, ensure we use mergedSlot cleanly
        void mergedSlot;
        setSlotSession(outcome.nextSlotSession ?? null);
        appendMessage({
          role: 'assistant',
          text: outcome.replyText,
          engineUsed: 'local',
          engineLabel: 'تحديد تفاعلي',
          gracefulLevel: outcome.gracefulLevel,
          choices: outcome.choices,
          confirmationDiff: outcome.confirmationDiff,
        });
        return;
      }

      if (choice.actionType === 'select_person') {
        const personId = Number(choice.payload.personId);
        const person = fullRuntime.state.persons.find((p) => p.id === personId);
        if (!person) return;
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
            engineUsed: 'local',
            engineLabel: 'انتقال مباشر',
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
        const diff = buildBeforeAfterDiff(
          fullRuntime.state,
          tc,
          person.id
        );
        appendMessage({
          role: 'assistant',
          text: diff
            ? 'راجع التغيير لـ «' + person.name + '» واضغط موافق للتنفيذ:'
            : `اخترت «${person.name}». ما التعديل الذي تريده عليه؟`,
          engineUsed: 'local',
          engineLabel: 'توضيح الاختيار',
          gracefulLevel: diff ? 'A' : 'B',
          confirmationDiff: diff,
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
      }
    },
    [slotSession, fullRuntime, appendMessage, triggerSpotlight]
  );

  const resolveConfirmationDiff = useCallback(
    (messageId: string, approved: boolean) => {
      const targetMsg = messages.find((m) => m.id === messageId);
      const targetDiff = targetMsg?.confirmationDiff || null;
      if (!targetDiff || targetDiff.status !== 'pending') return;

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
          engineUsed: 'local',
          engineLabel: 'أمان التنفيذ',
          gracefulLevel: 'A',
        });
        return;
      }

      const resultText = executeApprovedToolMutation(
        targetDiff.toolCall,
        fullRuntime
      );
      appendMessage({
        role: 'assistant',
        text: resultText,
        engineUsed: 'local',
        engineLabel: 'تم التنفيذ بأمان',
        gracefulLevel: 'A',
      });
    },
    [messages, fullRuntime, appendMessage]
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
    connectivity,
    cloudConfigured,
    isThinking,
    messages,
    proactiveTip,
    preferences,
    deleteUserPref,
    queuedTasks,
    savePromptToQueue,
    removeQueuedTask,
    runQueuedTask,
    spotlight,
    dismissSpotlight: () => setSpotlight(null),
    triggerSpotlight,
    sendMessage,
    handleChoiceClick,
    resolveConfirmationDiff,
  };
}
