import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Command,
  Home,
  Laptop,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useAgencyStore, type ScreenId } from './store/useAgencyStore';
import { useSound } from './audio/useSound';
import { soundManager } from './audio/SoundManager';
import { applyThemeTokensToDocument } from './theme/tokens';
import { TheCoreOrb } from './components/core/TheCoreOrb';
import { ModeShockwaveOverlay } from './components/modes/ModeShockwaveOverlay';
import { HomeWorkspaceView } from './components/home/HomeWorkspaceView';
import {
  OnboardingFlow,
  OtpVerifyScreen,
  ScanAuthScreen,
} from './components/auth/ScanAuthFlows';
import {
  SheetsListView,
  SpatialSheetEditorView,
} from './components/sheets/SpatialSheetsWorkspace';
import {
  AssistantFullScreenView,
  DevicesSyncScreenView,
  ModesScreenView,
  SecurityScreenView,
  SoundNotificationsScreenView,
} from './components/screens/PlatformScreens';
import {
  ScreenStateWrapper,
  UnifiedCommandPalette,
} from './components/shell/UnifiedCommandPalette';

export default function App() {
  const activeScreen = useAgencyStore((s) => s.activeScreen);
  const lang = useAgencyStore((s) => s.lang);
  const coreState = useAgencyStore((s) => s.coreState);
  const activeTheme = useAgencyStore((s) => s.notificationPrefs.activeTheme);
  const activeMode = useAgencyStore((s) => s.notificationPrefs.activeMode);
  const toasts = useAgencyStore((s) => s.toasts);
  const newDeviceBadgeCount = useAgencyStore((s) => s.newDeviceBadgeCount);
  const navigate = useAgencyStore((s) => s.navigate);
  const setLang = useAgencyStore((s) => s.setLang);
  const setCommandPaletteOpen = useAgencyStore((s) => s.setCommandPaletteOpen);
  const setOfflineStatus = useAgencyStore((s) => s.setOfflineStatus);
  const hydrateNotificationPrefs = useAgencyStore((s) => s.hydrateNotificationPrefs);
  const dismissToast = useAgencyStore((s) => s.dismissToast);

  useSound();

  const isAr = lang === 'ar';
  const touchStartY = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    applyThemeTokensToDocument(activeTheme, activeMode, isAr ? 'rtl' : 'ltr');
  }, [activeTheme, activeMode, isAr]);

  useEffect(() => {
    const onOnline = () => {
      setOfflineStatus(false);
      soundManager.play('sync_complete');
    };
    const onOffline = () => {
      setOfflineStatus(true);
      soundManager.play('warning');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser?.uid) {
        hydrateNotificationPrefs(fbUser.uid);
      }
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubAuth();
    };
  }, [hydrateNotificationPrefs, setOfflineStatus]);

  const topNavLinks: Array<{ id: ScreenId; labelAr: string; labelEn: string }> = [
    { id: 'home', labelAr: 'الرئيسية', labelEn: 'Home' },
    { id: 'sheets', labelAr: 'الجداول', labelEn: 'Sheets' },
    { id: 'modes', labelAr: 'الأنماط', labelEn: 'Modes' },
    { id: 'sound_notifications', labelAr: 'الصوت', labelEn: 'Audio' },
    { id: 'security', labelAr: 'الأمان', labelEn: 'Security' },
  ];

  const mobileTabs: Array<{ id: ScreenId; labelAr: string; labelEn: string; icon: typeof Home }> = [
    { id: 'home', labelAr: 'الرئيسية', labelEn: 'Home', icon: Home },
    { id: 'sheets', labelAr: 'الجداول', labelEn: 'Sheets', icon: Table2 },
    { id: 'assistant', labelAr: 'النواة', labelEn: 'Core', icon: Sparkles },
    { id: 'sound_notifications', labelAr: 'الصوت', labelEn: 'Audio', icon: Bell },
    { id: 'devices', labelAr: 'الأجهزة', labelEn: 'Devices', icon: Laptop },
  ];

  const renderScreen = () => {
    switch (activeScreen) {
      case 'onboarding':
        return <OnboardingFlow />;
      case 'signin':
        return <ScanAuthScreen />;
      case 'otp':
        return <OtpVerifyScreen />;
      case 'home':
        return <HomeWorkspaceView />;
      case 'assistant':
        return <AssistantFullScreenView />;
      case 'sheets':
        return <SheetsListView />;
      case 'sheet_editor':
        return <SpatialSheetEditorView />;
      case 'modes':
        return <ModesScreenView />;
      case 'devices':
        return <DevicesSyncScreenView />;
      case 'sound_notifications':
        return <SoundNotificationsScreenView />;
      case 'security':
        return <SecurityScreenView />;
      default:
        return <HomeWorkspaceView />;
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="theme-stage-root flex min-h-dvh flex-col pb-20 md:pb-8"
      onTouchStart={(e) => {
        touchStartY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartY.current !== null && touchStartY.current < 90) {
          const endY = e.changedTouches[0]?.clientY ?? 0;
          if (endY - touchStartY.current > 68) {
            setCommandPaletteOpen(true);
          }
        }
        touchStartY.current = null;
      }}
    >
      {/* Top 3-Zone Header (Height 56px, respects <= 15% mobile sticky cap alongside bottom bar) */}
      <header
        className="sticky top-0 z-30 h-[56px] border-b px-4 sm:px-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--surface-border)',
          backdropFilter: 'blur(var(--surface-blur, 0px))',
          WebkitBackdropFilter: 'blur(var(--surface-blur, 0px))',
        }}
        onPointerDown={() => {
          longPressTimer.current = window.setTimeout(() => {
            setCommandPaletteOpen(true);
          }, 560);
        }}
        onPointerUp={() => {
          if (longPressTimer.current) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onPointerCancel={() => {
          if (longPressTimer.current) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-8">
          {/* Zone 1: Brand + Living Core Orb */}
          <div className="flex items-center gap-2.5 shrink-0">
            <TheCoreOrb
              state={coreState}
              size="sm"
              ariaLabel={isAr ? 'فتح المساعد المركزي' : 'Open Core Assistant'}
              onClick={() => navigate(activeScreen === 'assistant' ? 'home' : 'assistant')}
            />
            <button
              type="button"
              onClick={() => navigate('home')}
              className="theme-display-heading text-base font-extrabold whitespace-nowrap shrink-0"
            >
              MORROW
            </button>
          </div>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden items-center gap-6 md:flex" aria-label={isAr ? 'التنقل الرئيسي' : 'Primary Navigation'}>
            {topNavLinks.map((link) => {
              const active =
                activeScreen === link.id ||
                (link.id === 'sheets' && activeScreen === 'sheet_editor');
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigate(link.id)}
                  className="text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: '6px',
                  }}
                >
                  {isAr ? link.labelAr : link.labelEn}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action Cluster (Command Palette + Language) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="theme-control border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                borderColor: 'var(--surface-border)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {isAr ? 'EN' : 'عربي'}
            </button>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label={isAr ? 'لوحة الأوامر السريعة' : 'Open Command Palette'}
              className="theme-control inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Command className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isAr ? 'الأوامر' : 'Palette'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <ScreenStateWrapper screenId={activeScreen}>
              {renderScreen()}
            </ScreenStateWrapper>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Fixed Bottom Tab Bar (56px height, thumb zone reachable) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid h-[58px] grid-cols-5 border-t md:hidden"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--surface-border)',
          backdropFilter: 'blur(var(--surface-blur, 0px))',
        }}
        aria-label={isAr ? 'التنقل السفلي' : 'Mobile Navigation'}
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            activeScreen === tab.id ||
            (tab.id === 'sheets' && activeScreen === 'sheet_editor');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.id)}
              className="relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <Icon className="h-4 w-4" />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              {tab.id === 'devices' && newDeviceBadgeCount > 0 && (
                <span
                  className="absolute top-1.5 end-3 text-[10px] font-bold tabular-nums"
                  style={{ color: 'var(--warning)' }}
                >
                  {newDeviceBadgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Radial Mode Shockwave Overlay */}
      <ModeShockwaveOverlay />

      {/* Command Palette */}
      <UnifiedCommandPalette />

      {/* Non-intrusive Toast Stack */}
      <div
        className="pointer-events-none fixed bottom-20 end-4 z-50 flex w-full max-w-sm flex-col gap-2 md:bottom-6"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="theme-surface-elevated pointer-events-auto flex items-start justify-between gap-3 p-3.5"
              style={{
                borderColor:
                  toast.tone === 'error'
                    ? 'var(--danger)'
                    : toast.tone === 'warning'
                    ? 'var(--warning)'
                    : toast.tone === 'success'
                    ? 'var(--success)'
                    : 'var(--accent)',
              }}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold">{toast.title}</div>
                {toast.description && (
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {toast.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss"
                className="flex h-8 w-8 shrink-0 items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
