import { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { emitAppToast } from '../hooks/useToastQueue';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
let swInitialized = false;

function notifyInstallListeners() {
  for (const fn of promptListeners) {
    fn();
  }
}

export function isRunningAsStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function isIosSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

export function initPwaServiceWorker(): void {
  if (typeof window === 'undefined' || swInitialized) return;
  swInitialized = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallListeners();
    emitAppToast({
      title: 'تم تثبيت تطبيق Morrow بنجاح',
      description: 'يمكنك الآن فتح التطبيق من الشاشة الرئيسية والعمل أونلاين وأوفلاين.',
      tone: 'success',
    });
  });

  registerSW({
    immediate: true,
    onOfflineReady() {
      emitAppToast({
        title: 'التطبيق جاهز للعمل بدون إنترنت',
        description: 'تم تأمين ملفات التشغيل محلياً — كل التعديلات ستُحفظ وتُزامن تلقائياً عند العودة.',
        tone: 'info',
      });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        if (navigator.onLine) {
          void registration.update().catch(() => {});
        }
      }, 60 * 60 * 1000);
    },
  });
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState<boolean>(() => Boolean(deferredPrompt));
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningAsStandalonePwa());
  const [isIos] = useState<boolean>(() => isIosSafariBrowser());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCanInstall(Boolean(deferredPrompt));
      setIsInstalled(isRunningAsStandalonePwa());
    };
    promptListeners.add(sync);
    sync();
    return () => {
      promptListeners.delete(sync);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      notifyInstallListeners();
      return outcome === 'accepted';
    } catch {
      return false;
    } finally {
      setInstalling(false);
    }
  }, []);

  return {
    canInstall,
    isInstalled,
    isIos,
    installing,
    promptInstall,
  };
}
