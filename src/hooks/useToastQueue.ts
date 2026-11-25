import { useCallback, useEffect, useState } from 'react';
import type { AppToastItem } from '../types/assistant.ts';
import { runWithSignatureLoader } from '../utils/delayedLoader.ts';
import { pauseBackgroundMusicForAlert } from '../utils/backgroundMusicEngine.ts';
import { playTactileFeedback } from '../utils/tactileFeedback.ts';

const TOAST_EVENT_NAME = 'morrow:toast';

export function emitAppToast(input: {
  title: string;
  description?: string;
  tone?: AppToastItem['tone'];
}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT_NAME, {
      detail: {
        title: input.title,
        description: input.description,
        tone: input.tone || 'info',
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
      emitAppToast({ title: successLabel, tone: 'success' });
    } catch (err) {
      emitAppToast({
        title: 'تعذر إتمام التصدير',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
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
    }) => {
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
      if (item.tone === 'success') {
        const isSaveOrExport =
          /حفظ|تصدير|نسخ|أرش|ترحيل|مزامن|export|save|backup/i.test(item.title);
        playTactileFeedback(isSaveOrExport ? 'save_complete' : 'success', {
          haptic: true,
        });
      } else if (item.tone === 'error') {
        pauseBackgroundMusicForAlert(1550);
        playTactileFeedback('error', { haptic: true });
      } else if (item.tone === 'warning') {
        pauseBackgroundMusicForAlert(1100);
        playTactileFeedback('warn', { haptic: true });
      } else {
        playTactileFeedback('notify');
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
      }>).detail;
      if (detail?.title) {
        pushToast({
          title: detail.title,
          description: detail.description,
          tone: detail.tone,
        });
      }
    };
    window.addEventListener(TOAST_EVENT_NAME, handler);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handler);
  }, [pushToast]);

  return { toasts, pushToast, dismissToast };
}
