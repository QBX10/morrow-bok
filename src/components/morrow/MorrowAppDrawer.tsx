import React, { useState } from 'react';
import {
  Archive,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  FolderKanban,
  HeartHandshake,
  Home,
  ListChecks,
  ScanLine,
  Settings,
  Table2,
  X,
} from 'lucide-react';
import type { Agency, AppView, SettingsSectionId } from '../../types/agency';

interface MorrowAppDrawerProps {
  open: boolean;
  onClose: () => void;
  agencies: Agency[];
  personsCount: number;
  activeAgencyId?: number | null;
  activePeriodLabel?: string;
  backLabel: string;
  canViewFinance?: boolean;
  canUseQuickExtract?: boolean;
  onBackToApp: () => void;
  onNavigateView?: (view: AppView, section?: SettingsSectionId) => void;
  onOpenAgencyRoster?: (agencyId: number) => void;
}

export const MorrowAppDrawer: React.FC<MorrowAppDrawerProps> = ({
  open,
  onClose,
  agencies,
  personsCount,
  activeAgencyId,
  activePeriodLabel,
  backLabel,
  canViewFinance = true,
  canUseQuickExtract = true,
  onBackToApp,
  onNavigateView,
  onOpenAgencyRoster,
}) => {
  const [agenciesExpanded, setAgenciesExpanded] = useState(true);

  if (!open) return null;

  const navigateAndClose = (view: AppView, section?: SettingsSectionId) => {
    onClose();
    onNavigateView?.(view, section);
  };

  const navItemClass =
    'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-right text-xs font-bold transition-colors hover:bg-[var(--bg-main)]';

  return (
    <div
      className="fixed inset-0 z-[var(--z-sheet)] flex justify-start"
      role="dialog"
      aria-modal="true"
      aria-label="قائمة أقسام التطبيق الرئيسية"
    >
      <div
        onClick={onClose}
        className="fixed inset-0"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.42)',
          backdropFilter: 'blur(4px)',
        }}
      />

      <aside
        data-testid="morrow-app-drawer"
        className="relative z-10 flex h-full w-[300px] max-w-[85vw] flex-col border-l shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 border-b px-4 py-3.5"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="min-w-0">
            <div className="text-sm font-black tracking-tight">أقسام التطبيق</div>
            {activePeriodLabel && (
              <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {activePeriodLabel}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق قائمة التطبيق"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Return to Previous View */}
        <div className="border-b p-3" style={{ borderColor: 'var(--border-color)' }}>
          <button
            type="button"
            data-testid="morrow-back-to-app"
            onClick={() => {
              onClose();
              onBackToApp();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-extrabold transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border-color))',
              color: 'var(--accent)',
            }}
          >
            <ArrowRight className="h-4 w-4 shrink-0" />
            <span className="truncate">{backLabel}</span>
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Group 1: Agencies & Rosters */}
          <div className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              الوكالات والسجلات
            </div>

            <button
              type="button"
              onClick={() => navigateAndClose('hub')}
              className={navItemClass}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Home className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">الوكالات (الرئيسية)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateAndClose('master_roster')}
              className={navItemClass}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Table2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">السجل الشامل</span>
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {personsCount}
              </span>
            </button>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setAgenciesExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5" />
                  <span>جداول الوكالات ({agencies.length})</span>
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    agenciesExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {agenciesExpanded && (
                <div className="mt-1 space-y-0.5 pr-2">
                  {agencies.map((ag) => {
                    const isActive = ag.id === activeAgencyId;
                    return (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAgencyRoster?.(ag.id);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-right text-[11px] font-semibold transition-colors hover:bg-[var(--bg-main)]"
                        style={{
                          backgroundColor: isActive ? 'var(--bg-nav-active)' : 'transparent',
                          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{ag.icon}</span>
                          <span className="truncate">{ag.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Group 2: Operations & Modules */}
          <div className="space-y-1 border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="px-2 pb-1 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              العمليات والأدوات
            </div>

            {canUseQuickExtract && (
              <button
                type="button"
                onClick={() => navigateAndClose('quick_extract')}
                className={navItemClass}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <ScanLine className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="truncate">السحب الذكي</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateAndClose('ready_lists')}
              className={navItemClass}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <ListChecks className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">القوائم الجاهزة</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateAndClose('relationships')}
              className={navItemClass}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <HeartHandshake className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">العلاقات والمتابعة</span>
              </span>
            </button>

            {canViewFinance && (
              <button
                type="button"
                onClick={() => navigateAndClose('finance')}
                className={navItemClass}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <CircleDollarSign className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="truncate">الحسابات والمالية</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateAndClose('data_archives')}
              className={navItemClass}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Archive className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">الأرشفة والمطابقة</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateAndClose('google_workspace')}
              className={navItemClass}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <CalendarDays className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">التقويم والمهام</span>
              </span>
            </button>
          </div>
        </div>

        {/* Footer: App Settings */}
        <div className="border-t p-3" style={{ borderColor: 'var(--border-color)' }}>
          <button
            type="button"
            onClick={() => navigateAndClose('settings')}
            className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-extrabold transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <span>إعدادات التطبيق</span>
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
};
