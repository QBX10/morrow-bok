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
  ShieldCheck,
  Table2,
} from 'lucide-react';
import type { Agency, AppView, SettingsSectionId } from '../../types/agency';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import { NexusDuotoneIcon } from '../ui/NexusDuotoneIcon';

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

  const navigateAndClose = (view: AppView, section?: SettingsSectionId) => {
    onClose();
    onNavigateView?.(view, section);
  };

  const navItemClass =
    'flex w-full items-center justify-between gap-2.5 rounded-2xl border px-3.5 py-2.5 text-right text-xs font-bold transition-colors hover:border-[var(--accent-ai)]';

  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      title="أقسام التطبيق"
      subtitle={activePeriodLabel || 'التنقل السريع بين الوكالات والسجلات والأدوات'}
      icon={
        <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
          <Home className="h-4 w-4" />
        </NexusDuotoneIcon>
      }
      maxWidthClass="max-w-2xl"
      zIndexClass="z-[var(--z-sheet)]"
      ariaLabel="قائمة أقسام التطبيق الرئيسية"
    >
      <div data-testid="morrow-app-drawer" className="space-y-4">
        {/* Return to Previous View */}
        <button
          type="button"
          data-testid="morrow-back-to-app"
          onClick={() => {
            onClose();
            onBackToApp();
          }}
          className="nexus-pill-btn flex w-full items-center justify-center gap-2 border px-4 py-3 text-xs font-extrabold"
          style={{
            backgroundColor: 'var(--accent-ai, #5B4FE9)',
            borderColor: 'var(--accent-ai, #5B4FE9)',
            color: '#FFFFFF',
          }}
        >
          <ArrowRight className="h-4 w-4 shrink-0" />
          <span className="truncate">{backLabel}</span>
        </button>

        {/* Group 1: Agencies & Rosters */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
          <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            الوكالات والسجلات
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigateAndClose('hub')}
              className={navItemClass}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Home className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">الوكالات (الرئيسية)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateAndClose('master_roster')}
              className={navItemClass}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Table2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">السجل الشامل</span>
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {personsCount}
              </span>
            </button>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setAgenciesExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-1 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-80"
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
              <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
                      className="flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-right text-xs font-semibold transition-colors hover:border-[var(--accent-ai)]"
                      style={{
                        backgroundColor: isActive ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                        borderColor: isActive
                          ? 'var(--accent-ai, #5B4FE9)'
                          : 'var(--border-color)',
                        color: isActive ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
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
        </section>

        {/* Group 2: Operations & Modules */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
          <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            العمليات والأدوات
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {canUseQuickExtract && (
              <button
                type="button"
                onClick={() => navigateAndClose('quick_extract')}
                className={navItemClass}
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <ScanLine className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                  <span className="truncate">السحب الذكي</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateAndClose('ready_lists')}
              className={navItemClass}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <ListChecks className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">القوائم الجاهزة</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateAndClose('relationships')}
              className={navItemClass}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <HeartHandshake className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">العلاقات والمتابعة</span>
              </span>
            </button>

            {canViewFinance && (
              <button
                type="button"
                onClick={() => navigateAndClose('finance')}
                className={navItemClass}
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <CircleDollarSign className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                  <span className="truncate">الحسابات والمالية</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateAndClose('data_archives')}
              className={navItemClass}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Archive className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">الأرشفة والمطابقة</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateAndClose('google_workspace')}
              className={navItemClass}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <CalendarDays className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">التقويم والمهام</span>
              </span>
            </button>
          </div>
        </section>

        {/* Account, Data & Security + App Settings */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigateAndClose('account_security')}
            className="nexus-pill-btn flex w-full items-center justify-center gap-2 border px-4 py-3 text-xs font-extrabold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>الحساب والأمان والبيانات</span>
          </button>

          <button
            type="button"
            onClick={() => navigateAndClose('settings')}
            className="nexus-pill-btn flex w-full items-center justify-center gap-2 border px-4 py-3 text-xs font-extrabold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Settings className="h-4 w-4" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
            <span>إعدادات التطبيق</span>
          </button>
        </div>
      </div>
    </FullScreenPushPage>
  );
};
