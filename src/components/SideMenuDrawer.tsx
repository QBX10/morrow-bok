import React, { useMemo, useState } from 'react';
import {
  Calculator,
  FileSearch,
  FileSpreadsheet,
  HeartHandshake,
  Home,
  LayoutGrid,
  ListChecks,
  Lock,
  Settings,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AppView,
  CalculationSettings,
  Person,
  SettingsSectionId,
  ThemePreferences,
} from '../types/agency';
import {
  auditAgencyPersons,
  calculateAllocation,
  formatIqd,
  formatQuota,
} from '../utils/agencyLogic';
import type { ModeCapabilities } from '../utils/modePermissions';
import { APP_THEMES } from '../utils/themes';

interface SideMenuDrawerProps {
  open: boolean;
  activeView: AppView;
  capabilities: ModeCapabilities;
  persons: Person[];
  relationsCount: number;
  calculationSettings: CalculationSettings;
  themePrefs: ThemePreferences;
  onClose: () => void;
  onNavigate: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onSelectAppTheme: (id: ThemePreferences['appTheme']) => void;
}

export const SideMenuDrawer: React.FC<SideMenuDrawerProps> = ({
  open,
  activeView,
  capabilities,
  persons,
  relationsCount,
  calculationSettings,
  themePrefs,
  onClose,
  onNavigate,
  onSelectAppTheme,
}) => {
  const [calcIndividuals, setCalcIndividuals] = useState('6');

  const quickCalcResult = useMemo(() => {
    const n = Number(calcIndividuals);
    if (!Number.isFinite(n) || n < 0) return null;
    return {
      alloc: calculateAllocation(n, calculationSettings),
      quota: formatQuota(n, undefined, calculationSettings),
    };
  }, [calcIndividuals, calculationSettings]);

  const auditCount = useMemo(() => auditAgencyPersons(persons).length, [persons]);

  if (!open) return null;

  const go = (view: AppView, section?: SettingsSectionId) => {
    onNavigate(view, section);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="القائمة الجانبية والأقسام"
      className="fixed inset-0 z-50 flex justify-start bg-black/50"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-sm flex-col overflow-y-auto border-l shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-bold">تابريكس — القائمة والأقسام</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة الجانبية"
            className="rounded-lg p-1.5 hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-main)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          {/* 1. Primary & Advanced Sections */}
          <section className="space-y-2">
            <h3
              className="text-xs font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              الأقسام والتنقل السريع
            </h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => go('hub')}
                className="flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor:
                    activeView === 'hub'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    activeView === 'hub'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    activeView === 'hub'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span>الشاشة الرئيسية (4 بطاقات)</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => go('ready_lists')}
                className="flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor:
                    activeView === 'ready_lists'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    activeView === 'ready_lists'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    activeView === 'ready_lists'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  <span>القوائم الجاهزة</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => go('relationships')}
                className="flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor:
                    activeView === 'relationships'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    activeView === 'relationships'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    activeView === 'relationships'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4" />
                  <span>قسم العلاقات والمتابعة</span>
                </span>
                <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {relationsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => go('master_roster')}
                className="flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor:
                    activeView === 'master_roster'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    activeView === 'master_roster'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    activeView === 'master_roster'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>السجل الشامل</span>
                </span>
                <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {persons.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  capabilities.canViewFinance
                    ? go('finance')
                    : go('settings', 'modes')
                }
                className="flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor:
                    activeView === 'finance'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    activeView === 'finance'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    activeView === 'finance'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                  opacity: capabilities.canViewFinance ? 1 : 0.72,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span>الحسابات والمالية</span>
                </span>
                {!capabilities.canViewFinance && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Lock className="h-3 w-3" />
                    <span>المتوسط+</span>
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  capabilities.canUseQuickExtract
                    ? go('quick_extract')
                    : go('settings', 'modes')
                }
                className="flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor:
                    activeView === 'quick_extract'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    activeView === 'quick_extract'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    activeView === 'quick_extract'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                  opacity: capabilities.canUseQuickExtract ? 1 : 0.72,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <FileSearch className="h-4 w-4" />
                  <span>السحب السريع (PDF والكاميرا)</span>
                </span>
                {!capabilities.canUseQuickExtract && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Lock className="h-3 w-3" />
                    <span>الاحترافي+</span>
                  </span>
                )}
              </button>
            </div>
          </section>

          {/* 2. Dedicated Standalone Settings Entry */}
          <section
            className="space-y-2 border-t pt-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h3
              className="text-xs font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              الإعدادات والتخصيص
            </h3>
            <button
              type="button"
              onClick={() => go('settings', 'appearance')}
              className="flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-xs font-bold transition-colors"
              style={{
                backgroundColor:
                  activeView === 'settings'
                    ? 'var(--accent)'
                    : 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color:
                  activeView === 'settings'
                    ? 'var(--accent-fg)'
                    : 'var(--accent)',
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>إعدادات التطبيق</span>
              </span>
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor:
                    activeView === 'settings'
                      ? 'rgba(255,255,255,0.2)'
                      : 'var(--bg-surface)',
                  color:
                    activeView === 'settings'
                      ? 'var(--accent-fg)'
                      : 'var(--text-muted)',
                }}
              >
                {capabilities.modeTier === 'beginner'
                  ? 'المبتدئ'
                  : capabilities.modeTier === 'intermediate'
                  ? 'المتوسط'
                  : capabilities.modeTier === 'professional'
                  ? 'الاحترافي'
                  : 'الخبير'}
              </span>
            </button>
          </section>

          {/* 3. Instant Theme Quick-Pick Swatches */}
          <section
            className="space-y-2.5 border-t pt-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h3
              className="text-xs font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              تبديل سريع لثيم التطبيق
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {APP_THEMES.map((t) => {
                const active = themePrefs.appTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectAppTheme(t.id)}
                    className="flex flex-col items-start gap-1 rounded-lg border p-2.5 text-right text-[11px] font-semibold"
                    style={{
                      backgroundColor: active
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                      borderColor: active
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {t.swatches.map((hex, i) => (
                        <span
                          key={i}
                          className="inline-block h-3 w-3 rounded-sm border"
                          style={{
                            backgroundColor: hex,
                            borderColor: 'var(--border-color)',
                          }}
                        />
                      ))}
                    </div>
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Quick Additions: Instant Quota Calculator & Audit Indicator */}
          <section
            className="space-y-3 border-t pt-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                <Calculator className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>حاسبة الحصة والأكياس السريعة</span>
              </span>
            </div>

            <div
              className="space-y-2 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="drawer-quick-ind" className="font-medium">
                  عدد الأفراد:
                </label>
                <input
                  id="drawer-quick-ind"
                  type="number"
                  min={0}
                  value={calcIndividuals}
                  onChange={(e) => setCalcIndividuals(e.target.value)}
                  className="w-24 rounded-md border px-2.5 py-1 text-center font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              {quickCalcResult?.alloc && (
                <div
                  className="flex items-center justify-between border-t pt-2 tabular-nums"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>
                    {quickCalcResult.quota}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--success)' }}>
                    {formatIqd(quickCalcResult.alloc.priceIqd)}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => go('master_roster')}
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor:
                  auditCount > 0 ? 'var(--warning)' : 'var(--border-color)',
              }}
            >
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <ShieldAlert
                  className="h-3.5 w-3.5"
                  style={{
                    color:
                      auditCount > 0 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
                <span>مؤشر التدقيق الشامل</span>
              </span>
              <span
                className="font-bold tabular-nums"
                style={{
                  color: auditCount > 0 ? 'var(--warning)' : 'var(--success)',
                }}
              >
                {auditCount} ملاحظة
              </span>
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
};
