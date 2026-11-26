import { useCallback, useEffect, useState } from 'react';
import type { AppToastItem } from '../types/assistant.ts';
import { runWithSignatureLoader } from '../utils/delayedLoader.ts';
import { pauseBackgroundMusicForAlert } from '../utils/backgroundMusicEngine.ts';
import {
  audioManager,
  type AppAudioEventName,
  type NotificationChannelId,
} from '../services/audio/AudioManager.ts';

const TOAST_EVENT_NAME = 'morrow:toast';

export function emitAppToast(input: {
  title: string;
  description?: string;
  tone?: AppToastItem['tone'];
  channel?: NotificationChannelId;
  suppressSound?: boolean;
  sfxEvent?: AppAudioEventName;
}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT_NAME, {
      detail: {
        title: input.title,
        description: input.description,
        tone: input.tone || 'info',
        channel: input.channel,
        suppressSound: input.suppressSound,
        sfxEvent: input.sfxEvent,
      },
    })
  );
}

/**
 * Runs an export or heavy task asynchronously with the signature truck loader
 * so the UI never freezes and the export result is confirmed after completion.
 */
export function runAsyncExportTask(
  startLabel: string,
  successLabel: string,
  task: () => void | Promise<void>
): void {
  const run = async () => {
    try {
      await runWithSignatureLoader(
        {
          label: startLabel,
          subtitle: 'يتم تجهيز وتنسيق الملف بدقة قبل إتمام التصدير...',
        },
        async () => {
          await task();
        }
      );
      emitAppToast({
        title: successLabel,
        tone: 'success',
        channel: 'reminders',
        sfxEvent: 'sync_complete',
      });
    } catch (err) {
      emitAppToast({
        title: 'تعذر إتمام التصدير',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
        channel: 'reminders',
        sfxEvent: 'error',
      });
    }
  };
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      void run();
    }, 16);
  } else {
    void run();
  }
}

export function useToastQueue() {
  const [toasts, setToasts] = useState<AppToastItem[]>([]);

  const pushToast = useCallback(
    (input: {
      title: string;
      description?: string;
      tone?: AppToastItem['tone'];
      channel?: NotificationChannelId;
      suppressSound?: boolean;
      sfxEvent?: AppAudioEventName;
    }) => {
      let allowChime = !input.suppressSound;

      if (input.channel) {
        const decision = audioManager.canDeliverNotification(input.channel);
        if (!decision.allowed) return;
        allowChime = allowChime && decision.playSound;
      } else if (audioManager.isQuietHoursNow()) {
        allowChime = false;
      }

      const id = `toast_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const item: AppToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone || 'info',
        createdAt: Date.now(),
      };

      if (allowChime) {
        const channel = input.channel;
        if (input.sfxEvent) {
          audioManager.playEvent(input.sfxEvent, {
            haptic: true,
            channel,
            bypassPrefGate: channel === 'security',
          });
        } else if (item.tone === 'success') {
          const isSaveOrExport =
            /حفظ|تصدير|نسخ|أرش|ترحيل|مزامن|export|save|backup/i.test(item.title);
          audioManager.playEvent(isSaveOrExport ? 'sync_complete' : 'success', {
            haptic: true,
            channel,
          });
        } else if (item.tone === 'error') {
          pauseBackgroundMusicForAlert(1550);
          audioManager.playEvent('error', {
            haptic: true,
            channel,
            bypassPrefGate: channel === 'security',
          });
        } else if (item.tone === 'warning') {
          pauseBackgroundMusicForAlert(1100);
          audioManager.playEvent('warn', {
            haptic: true,
            channel,
            bypassPrefGate: channel === 'security',
          });
        } else {
          audioManager.playEvent('notify', {
            channel,
            bypassPrefGate: channel === 'security',
          });
        }
      }

      setToasts((prev) => [...prev.slice(-3), item]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        title?: string;
        description?: string;
        tone?: AppToastItem['tone'];
        channel?: NotificationChannelId;
        suppressSound?: boolean;
        sfxEvent?: AppAudioEventName;
      }>).detail;
      if (detail?.title) {
        pushToast({
          title: detail.title,
          description: detail.description,
          tone: detail.tone,
          channel: detail.channel,
          suppressSound: detail.suppressSound,
          sfxEvent: detail.sfxEvent,
        });
      }
    };
    window.addEventListener(TOAST_EVENT_NAME, handler);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handler);
  }, [pushToast]);

  return { toasts, pushToast, dismissToast };
}
