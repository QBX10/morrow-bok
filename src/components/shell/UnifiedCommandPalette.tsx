import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Command, Inbox, RefreshCw, Search, WifiOff, X } from 'lucide-react';
import { useAgencyStore, type ScreenId, type ViewLifecycleState } from '../../store/useAgencyStore';
import { THEME_LIST } from '../../theme/tokens';
import { useSound } from '../../audio/useSound';

const SCREEN_COMMANDS: Array<{ id: ScreenId; labelAr: string; labelEn: string }> = [
  { id: 'home', labelAr: 'الرئيسية', labelEn: 'Home Workspace' },
  { id: 'assistant', labelAr: 'المساعد الكامل (THE CORE)', labelEn: 'Full-Screen AI Assistant' },
  { id: 'sheets', labelAr: 'قائمة الجداول', labelEn: 'Sheets List' },
  { id: 'sheet_editor', labelAr: 'محرر الجداول المكاني', labelEn: 'Spatial Sheet Editor' },
  { id: 'modes', labelAr: 'الأنماط والثيمات', labelEn: 'Modes & Themes' },
  { id: 'sound_notifications', labelAr: 'الصوت والإشعارات', labelEn: 'Sound & Notifications' },
  { id: 'devices', labelAr: 'الأجهزة والمزامنة', labelEn: 'Devices & Sync' },
  { id: 'security', labelAr: 'الأمان والاسترجاع', labelEn: 'Security Hub' },
  { id: 'signin', labelAr: 'تسجيل الدخول بالمسح', labelEn: 'Sign In / Passkey Scan' },
  { id: 'otp', labelAr: 'التحقق 6 خانات OTP', labelEn: 'OTP Verification' },
  { id: 'onboarding', labelAr: 'جولة الترحيب (3 شرائح)', labelEn: 'Onboarding (3 Slides)' },
];

export function UnifiedCommandPalette() {
  const open = useAgencyStore((s) => s.commandPaletteOpen);
  const setOpen = useAgencyStore((s) => s.setCommandPaletteOpen);
  const lang = useAgencyStore((s) => s.lang);
  const navigate = useAgencyStore((s) => s.navigate);
  const setTheme = useAgencyStore((s) => s.setTheme);
  const setLang = useAgencyStore((s) => s.setLang);
  const { play, toggleFlashlight } = useSound();

  const [query, setQuery] = useState('');
  const isAr = lang === 'ar';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useAgencyStore.getState().commandPaletteOpen);
      } else if (e.key === 'Escape' && useAgencyStore.getState().commandPaletteOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  const filteredScreens = SCREEN_COMMANDS.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.labelAr.toLowerCase().includes(q) || s.labelEn.toLowerCase().includes(q);
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-4 pt-16 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? 'لوحة الأوامر السريعة' : 'Command Palette'}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="theme-surface-elevated w-full max-w-xl overflow-hidden"
          >
            <div
              className="flex items-center gap-2 border-b px-4 py-3"
              style={{ borderColor: 'var(--surface-border)' }}
            >
              <Search className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  play('search_start');
                }}
                placeholder={isAr ? 'ابحث عن شاشة أو ثيم أو أمر...' : 'Jump to screen, theme, or action...'}
                className="min-h-[44px] flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="theme-control flex h-11 w-11 items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
              <div>
                <div className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'الشاشات والمسارات' : 'Screens'}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {filteredScreens.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        navigate(item.id);
                        setOpen(false);
                      }}
                      className="theme-control flex items-center justify-between border px-3 py-2 text-start text-xs font-semibold"
                      style={{ borderColor: 'var(--surface-border)' }}
                    >
                      <span>{isAr ? item.labelAr : item.labelEn}</span>
                      <Command className="h-3.5 w-3.5 opacity-55" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'تبديل فوري' : 'Quick Actions'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {THEME_LIST.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTheme(t.id);
                        setOpen(false);
                      }}
                      className="theme-control border px-3 py-2 text-xs font-semibold"
                      style={{ borderColor: 'var(--surface-border)' }}
                    >
                      {isAr ? t.nameAr : t.nameEn}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLang(isAr ? 'en' : 'ar')}
                    className="theme-control border px-3 py-2 text-xs font-bold"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  >
                    {isAr ? 'Switch to EN' : 'التبديل للعربية'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleFlashlight();
                      setOpen(false);
                    }}
                    className="theme-control border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: 'var(--surface-border)' }}
                  >
                    {isAr ? 'المصباح' : 'Flashlight'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ScreenStateWrapper({
  screenId,
  children,
}: {
  screenId: ScreenId;
  children: ReactNode;
}) {
  const lang = useAgencyStore((s) => s.lang);
  const viewStates = useAgencyStore((s) => s.viewStates);
  const setViewState = useAgencyStore((s) => s.setViewState);
  const isOffline = useAgencyStore((s) => s.isOffline);
  const setOfflineStatus = useAgencyStore((s) => s.setOfflineStatus);
  const { play } = useSound();

  const currentState: ViewLifecycleState =
    viewStates[screenId] ?? (isOffline ? 'offline' : 'ready');
  const isAr = lang === 'ar';

  return (
    <div className="space-y-4">
      {/* Compact State Verification Controls (lets user/QA preview loading/empty/offline/error on every screen) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ready', 'loading', 'empty', 'offline', 'error'] as ViewLifecycleState[]).map((st) => {
            const active = currentState === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => {
                  play('tab_switch');
                  setViewState(screenId, st);
                  if (st === 'offline') setOfflineStatus(true);
                  else if (st === 'ready') setOfflineStatus(false);
                }}
                className="min-h-[36px] border px-2.5 py-1 font-semibold transition-colors"
                style={{
                  borderRadius: 'var(--radius-control)',
                  borderColor: active ? 'var(--accent)' : 'var(--surface-border)',
                  backgroundColor: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                }}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {currentState === 'loading' ? (
        <div className="space-y-4" aria-busy="true">
          <div className="theme-surface h-28 animate-pulse p-6" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="theme-surface h-32 animate-pulse p-6" />
            <div className="theme-surface h-32 animate-pulse p-6" />
          </div>
        </div>
      ) : currentState === 'empty' ? (
        <div className="theme-surface flex flex-col items-center justify-center gap-3 p-10 text-center">
          <Inbox className="h-9 w-9" style={{ color: 'var(--text-muted)' }} />
          <div className="text-base font-bold">
            {isAr ? 'لا توجد عناصر في هذه الشاشة بعد' : 'Nothing here yet'}
          </div>
          <p className="max-w-sm text-xs" style={{ color: 'var(--text-muted)' }}>
            {isAr
              ? 'يمكنك إضافة سجل جديد أو العودة إلى العرض النشط.'
              : 'Add a first record or return to the active view.'}
          </p>
          <button
            type="button"
            onClick={() => {
              play('loading_complete');
              setViewState(screenId, 'ready');
            }}
            className="theme-control px-4 py-2 text-xs font-bold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            {isAr ? 'استعادة المحتوى' : 'Restore Content'}
          </button>
        </div>
      ) : currentState === 'offline' ? (
        <div className="space-y-4">
          <div
            className="theme-surface flex items-center justify-between gap-3 p-4"
            style={{ borderColor: 'var(--warning)' }}
          >
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5" style={{ color: 'var(--warning)' }} />
              <div className="text-xs font-semibold">
                {isAr
                  ? 'وضع عدم الاتصال: البيانات محفوظة محلياً وستُزامن تلقائياً فور الاتصال.'
                  : 'Offline mode: local changes queued and ready to sync automatically.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOfflineStatus(false);
                setViewState(screenId, 'ready');
                play('sync_complete');
              }}
              className="theme-control border px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
            >
              {isAr ? 'إعادة الاتصال' : 'Reconnect'}
            </button>
          </div>
          {children}
        </div>
      ) : currentState === 'error' ? (
        <div
          className="theme-surface flex flex-col items-center justify-center gap-3 p-10 text-center"
          style={{ borderColor: 'var(--danger)' }}
        >
          <AlertCircle className="h-9 w-9" style={{ color: 'var(--danger)' }} />
          <div className="text-base font-bold">
            {isAr ? 'حدث خطأ مؤقت أثناء تحميل هذه الشاشة' : 'Temporary error loading this screen'}
          </div>
          <button
            type="button"
            onClick={() => {
              play('sync_complete');
              setViewState(screenId, 'ready');
            }}
            className="theme-control inline-flex items-center gap-2 px-4 py-2 text-xs font-bold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <RefreshCw className="h-4 w-4" />
            <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
