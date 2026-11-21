import React from 'react';
import {
  Eye,
  EyeOff,
  Maximize2,
  Menu,
  Minimize2,
  Redo2,
  Sparkles,
  Undo2,
  UserCircle2,
} from 'lucide-react';
import type {
  AuthUser,
  TopBarConfig,
  TopBarFocusMode,
} from '../types/agency';
import type { ModeCapabilities } from '../utils/modePermissions';

interface TopBarProps {
  capabilities: ModeCapabilities;
  authUser: AuthUser | null;
  canUndo: boolean;
  canRedo: boolean;
  topBarConfig: TopBarConfig;
  effectiveMode: TopBarFocusMode;
  isAutoHidden?: boolean;
  activeViewLabel: string;
  onChangeTopBarConfig: (patch: Partial<TopBarConfig>) => void;
  onNavigateHome: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAuth: () => void;
  onOpenDrawer: () => void;
  onRequestReveal?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  capabilities,
  authUser,
  canUndo,
  canRedo,
  topBarConfig,
  effectiveMode,
  isAutoHidden = false,
  activeViewLabel,
  onChangeTopBarConfig,
  onNavigateHome,
  onUndo,
  onRedo,
  onOpenAuth,
  onOpenDrawer,
  onRequestReveal,
}) => {
  const showViewTitle = topBarConfig.showViewTitle !== false;
  const showQuickFocusToggle = topBarConfig.showQuickFocusToggle !== false;
  const showUndoRedo = topBarConfig.showUndoRedo !== false;
  const showAuthButton = topBarConfig.showAuthButton !== false;

  if (effectiveMode === 'hidden') {
    return (
      <div className="no-print fixed top-2 left-3 z-50 flex items-center gap-1.5 transition-opacity">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="فتح القائمة الجانبية والأقسام"
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold shadow-md backdrop-blur-md hover:opacity-90"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <Menu className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <span>القائمة</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isAutoHidden && onRequestReveal) {
              onRequestReveal();
            } else {
              onChangeTopBarConfig({ mode: 'normal' });
            }
          }}
          aria-label="إظهار الشريط العلوي"
          title={
            isAutoHidden
              ? 'مخفي تلقائيًا أثناء التركيز — اضغط لإظهاره'
              : 'استعادة الشريط العلوي'
          }
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold shadow-md transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent)',
            borderColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>{isAutoHidden ? 'تركيز نشط · إظهار' : 'إظهار الشريط'}</span>
        </button>
      </div>
    );
  }

  const isCompact = effectiveMode === 'compact';

  return (
    <header
      className={`no-print z-30 border-b transition-all duration-200 md:sticky md:top-0 ${
        isCompact ? 'px-3 py-1' : 'px-3 py-1.5 sm:px-5'
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        {/* Start Zone: Menu Drawer + Official Brand [تابريكس] + Active Section Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="فتح القائمة الجانبية والأقسام"
            className={`inline-flex items-center gap-1.5 rounded-lg border font-bold whitespace-nowrap transition-colors hover:opacity-85 ${
              isCompact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
            }`}
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Menu className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>القائمة</span>
          </button>

          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-bold tracking-tight whitespace-nowrap shrink-0 transition-opacity hover:opacity-85"
            style={{ color: 'var(--text-primary)' }}
          >
            <span
              className={`inline-flex items-center justify-center rounded-md font-bold ${
                isCompact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs'
              }`}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
              aria-hidden="true"
            >
              ت
            </span>
            <span className={isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}>
              تابريكس
            </span>
          </button>

          {showViewTitle && activeViewLabel && (
            <span
              className="hidden sm:inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              {activeViewLabel}
            </span>
          )}
        </div>

        {/* End Zone: Sleek Auto-Focus / Size Controls + Editor Undo/Redo + Account */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {showQuickFocusToggle && (
            <div
              className="flex items-center gap-0.5 rounded-lg border p-0.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  onChangeTopBarConfig({ autoFocus: !topBarConfig.autoFocus })
                }
                aria-pressed={topBarConfig.autoFocus}
                title={
                  topBarConfig.autoFocus
                    ? 'التركيز التلقائي مفعّل: يختفي أو يصغر الشريط تلقائيًا عند التمرير أو التحرير'
                    : 'تفعيل الإخفاء التلقائي عند التركيز'
                }
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: topBarConfig.autoFocus
                    ? 'var(--bg-nav-active)'
                    : 'transparent',
                  color: topBarConfig.autoFocus
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                }}
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">إخفاء تلقائي</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeTopBarConfig({
                    mode: isCompact ? 'normal' : 'compact',
                  })
                }
                title={isCompact ? 'الحجم المريح' : 'تصغير إضافي'}
                aria-label={isCompact ? 'توسيع الشريط العلوي' : 'تصغير الشريط العلوي'}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ color: 'var(--text-muted)' }}
              >
                {isCompact ? (
                  <Maximize2 className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                ) : (
                  <Minimize2 className="h-3 w-3" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onChangeTopBarConfig({ mode: 'hidden' })}
                title="إخفاء الشريط العلوي"
                aria-label="إخفاء الشريط العلوي"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ color: 'var(--text-muted)' }}
              >
                <EyeOff className="h-3 w-3" />
              </button>
            </div>
          )}

          {showUndoRedo && capabilities.canEditRecords && (
            <div
              className="flex items-center gap-0.5 rounded-lg border p-0.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                title="تراجع عن التعديل (Ctrl+Z)"
                aria-label="تراجع عن التعديل"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap transition-opacity disabled:opacity-35"
                style={{ color: 'var(--text-primary)' }}
              >
                <Undo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                {!isCompact && <span className="hidden md:inline">تراجع</span>}
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedo}
                title="إعادة التعديل (Ctrl+Shift+Z)"
                aria-label="إعادة التعديل"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap transition-opacity disabled:opacity-35"
                style={{ color: 'var(--text-primary)' }}
              >
                <Redo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                {!isCompact && <span className="hidden md:inline">إعادة</span>}
              </button>
            </div>
          )}

          {showAuthButton && (
            <button
              type="button"
              onClick={onOpenAuth}
              className={`inline-flex items-center gap-1.5 rounded-lg font-bold whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 ${
                isCompact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-xs'
              }`}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              {authUser?.avatarUrl ? (
                <img
                  src={authUser.avatarUrl}
                  alt={authUser.displayName}
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-full object-cover border border-white/40"
                />
              ) : (
                <UserCircle2 className="h-3.5 w-3.5" />
              )}
              <span>
                {authUser ? (
                  <span dir="auto">{authUser.displayName}</span>
                ) : (
                  'تسجيل الدخول'
                )}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
