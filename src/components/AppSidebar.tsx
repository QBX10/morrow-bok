import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Calculator,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSearch,
  GitCompareArrows,
  HeartHandshake,
  Home,
  ListChecks,
  Lock,
  Palette,
  Settings,
  ShieldAlert,
  Table2,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Agency,
  AppView,
  CalculationSettings,
  PeriodQuotaMeta,
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

interface AppSidebarProps {
  activeView: AppView;
  selectedAgencyId: number;
  agencies: Agency[];
  persons: Person[];
  activePeriod?: PeriodQuotaMeta;
  relationsCount: number;
  readyListsCount: number;
  archivesCount: number;
  pendingDraftsCount?: number;
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  themePrefs: ThemePreferences;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onNavigate: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onOpenAgencyRoster: (agencyId: number) => void;
  onSelectAppTheme: (id: ThemePreferences['appTheme']) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeView,
  selectedAgencyId,
  agencies,
  persons,
  activePeriod,
  relationsCount,
  readyListsCount,
  archivesCount,
  pendingDraftsCount = 0,
  calculationSettings,
  capabilities,
  themePrefs,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onNavigate,
  onOpenAgencyRoster,
  onSelectAppTheme,
}) => {
  const [agenciesExpanded, setAgenciesExpanded] = useState(true);
  const [quickToolsOpen, setQuickToolsOpen] = useState(false);
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

  const agencyPersonCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of persons) {
      map.set(p.agencyId, (map.get(p.agencyId) || 0) + 1);
    }
    return map;
  }, [persons]);

  const modeLabel =
    capabilities.modeTier === 'beginner'
      ? 'المبتدئ'
      : capabilities.modeTier === 'intermediate'
      ? 'المتوسط'
      : capabilities.modeTier === 'professional'
      ? 'الاحترافي'
      : 'الخبير';

  const navigateAndClose = (view: AppView, section?: SettingsSectionId) => {
    onNavigate(view, section);
    onCloseMobile();
  };

  const openAgencyAndClose = (agencyId: number) => {
    onOpenAgencyRoster(agencyId);
    onCloseMobile();
  };

  const isTableActive =
    activeView === 'master_roster' || activeView === 'agency_roster';

  const renderNavItem = ({
    id,
    label,
    icon,
    active,
    badge,
    locked,
    titleHint,
    onClick,
    compactMode,
  }: {
    id: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    badge?: string | number;
    locked?: boolean;
    titleHint?: string;
    onClick: () => void;
    compactMode: boolean;
  }) => (
    <button
      key={id}
      type="button"
      onClick={onClick}
      title={titleHint || label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`tabrix-btn group flex min-h-[42px] w-full items-center border transition-all ${
        compactMode
          ? 'justify-center px-1.5 py-2'
          : 'justify-between gap-2.5 px-2.5 py-1.5 text-right'
      }`}
      style={{
        backgroundColor: active ? 'var(--bg-nav-active)' : 'transparent',
        borderColor: active
          ? 'color-mix(in srgb, var(--accent) 32%, transparent)'
          : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-primary)',
        opacity: locked ? 0.72 : 1,
      }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
          style={{
            backgroundColor: active
              ? 'var(--accent)'
              : 'color-mix(in srgb, var(--bg-main) 88%, var(--border-color))',
            color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
          }}
        >
          {icon}
        </span>
        {!compactMode && (
          <span className="truncate text-xs font-bold whitespace-nowrap">
            {label}
          </span>
        )}
      </span>

      {!compactMode && (
        <span className="flex items-center gap-1.5 shrink-0">
          {locked && (
            <Lock
              className="h-3.5 w-3.5"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
          )}
          {badge !== undefined && (
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {badge}
            </span>
          )}
        </span>
      )}
    </button>
  );

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;

    return (
      <div className="flex h-full flex-col justify-between">
        {/* Top Scrollable Navigation Stack */}
        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {/* Header Row: Mobile Branding vs Desktop Collapse Control */}
          {isMobileDrawer ? (
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  M
                </span>
                <div>
                  <div dir="ltr" className="text-sm font-extrabold leading-tight">
                    Morrow
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    وضع {modeLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="إغلاق القائمة الجانبية"
                className="tabrix-btn flex h-9 w-9 items-center justify-center border hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              className={`flex items-center ${
                isCollapsed ? 'justify-center' : 'justify-between gap-2 px-1'
              }`}
            >
              {!isCollapsed && (
                <div className="min-w-0">
                  <div
                    className="text-[11px] font-bold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    مساحة العمل
                  </div>
                  <div className="truncate text-xs font-extrabold">
                    {activePeriod?.quotaName || 'الحصة الجارية'}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={
                  isCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'
                }
                title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة للأيقونات فقط'}
                className="tabrix-btn flex h-8 w-8 shrink-0 items-center justify-center border transition-colors hover:opacity-85"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                {isCollapsed ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          {/* Active Quota Period Snapshot Card (Expanded Mode) */}
          {!isCollapsed && (
            <div
              className="tabrix-btn flex items-center justify-between gap-2 border px-3 py-2 text-[11px]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>
                <CalendarDays className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>{activePeriod?.monthName || 'الشهر الحالي'}</span>
              </span>
              <span className="font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {agencies.length} وكالات · {persons.length} سجل
              </span>
            </div>
          )}

          {/* 1. Primary Pillars */}
          <nav aria-label="الأقسام الكبرى" className="space-y-1.5">
            {!isCollapsed && (
              <div
                className="px-2 pb-0.5 text-[11px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                الأقسام الرئيسية
              </div>
            )}

            {renderNavItem({
              id: 'hub',
              label: 'الرئيسية',
              icon: <Home className="h-4 w-4" />,
              active: activeView === 'hub',
              onClick: () => navigateAndClose('hub'),
              compactMode: isCollapsed,
            })}

            <div>
              {renderNavItem({
                id: 'master_roster',
                label: 'الجدول الشامل',
                icon: <Table2 className="h-4 w-4" />,
                active: isTableActive,
                badge: persons.length,
                titleHint: 'السجل الشامل وجداول الوكالات',
                onClick: () => navigateAndClose('master_roster'),
                compactMode: isCollapsed,
              })}

              {!isCollapsed && agencies.length > 0 && (
                <div className="mt-1.5 pr-3">
                  <button
                    type="button"
                    onClick={() => setAgenciesExpanded((v) => !v)}
                    className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-semibold transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span>جداول الوكالات ({agencies.length})</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        agenciesExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {agenciesExpanded && (
                    <div
                      className="mt-1 space-y-1 border-r pr-2.5"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      {agencies.map((ag) => {
                        const isThisAgency =
                          activeView === 'agency_roster' &&
                          selectedAgencyId === ag.id;
                        const count = agencyPersonCounts.get(ag.id) || 0;
                        return (
                          <button
                            key={ag.id}
                            type="button"
                            onClick={() => openAgencyAndClose(ag.id)}
                            className="tabrix-btn flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-right text-[11px] font-semibold transition-colors"
                            style={{
                              backgroundColor: isThisAgency
                                ? 'var(--bg-nav-active)'
                                : 'transparent',
                              color: isThisAgency
                                ? 'var(--accent)'
                                : 'var(--text-muted)',
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span aria-hidden="true" className="text-xs shrink-0">
                                {ag.icon}
                              </span>
                              <span className="truncate">{ag.name}</span>
                            </span>
                            <span className="shrink-0 text-[10px] font-bold tabular-nums opacity-80">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {renderNavItem({
              id: 'quick_extract',
              label: 'السحب الذكي',
              icon: <FileSearch className="h-4 w-4" />,
              active: activeView === 'quick_extract',
              locked: !capabilities.canUseQuickExtract,
              titleHint: capabilities.canUseQuickExtract
                ? 'السحب الذكي (PDF والكاميرا)'
                : 'يتطلب الوضع الاحترافي أو الخبير — اضغط للترقية',
              onClick: () =>
                capabilities.canUseQuickExtract
                  ? navigateAndClose('quick_extract')
                  : navigateAndClose('settings', 'modes'),
              compactMode: isCollapsed,
            })}

            {renderNavItem({
              id: 'morrow_center',
              label: 'مركز Morrow',
              icon: <Bot className="h-4 w-4" />,
              active: activeView === 'morrow_center',
              badge: pendingDraftsCount > 0 ? pendingDraftsCount : undefined,
              titleHint: 'غرفة المساعد الشخصي: المحادثة، الموافقات، الذاكرة، والملاحظات السريعة',
              onClick: () => navigateAndClose('morrow_center'),
              compactMode: isCollapsed,
            })}

            {renderNavItem({
              id: 'data_archives',
              label: 'المطابقة والأرشفة',
              icon: <GitCompareArrows className="h-4 w-4" />,
              active: activeView === 'data_archives',
              badge: archivesCount > 0 ? archivesCount : undefined,
              titleHint: 'الأرشفة الشهرية والمطابقة التاريخية',
              onClick: () => navigateAndClose('data_archives'),
              compactMode: isCollapsed,
            })}
          </nav>

          {/* 2. Operational Tools */}
          <div
            className="space-y-1.5 border-t pt-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {!isCollapsed && (
              <div
                className="px-2 pb-0.5 text-[11px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                أدوات العمل
              </div>
            )}

            {renderNavItem({
              id: 'ready_lists',
              label: 'القوائم الجاهزة',
              icon: <ListChecks className="h-4 w-4" />,
              active: activeView === 'ready_lists',
              badge: readyListsCount > 0 ? readyListsCount : undefined,
              onClick: () => navigateAndClose('ready_lists'),
              compactMode: isCollapsed,
            })}

            {renderNavItem({
              id: 'relationships',
              label: 'العلاقات والمتابعة',
              icon: <HeartHandshake className="h-4 w-4" />,
              active: activeView === 'relationships',
              badge: relationsCount > 0 ? relationsCount : undefined,
              onClick: () => navigateAndClose('relationships'),
              compactMode: isCollapsed,
            })}

            {renderNavItem({
              id: 'finance',
              label: 'الحسابات والمالية',
              icon: <Wallet className="h-4 w-4" />,
              active: activeView === 'finance',
              locked: !capabilities.canViewFinance,
              titleHint: capabilities.canViewFinance
                ? 'الحسابات والمالية والمصاريف'
                : 'يتطلب الوضع المتوسط أو الأعلى — اضغط للترقية',
              onClick: () =>
                capabilities.canViewFinance
                  ? navigateAndClose('finance')
                  : navigateAndClose('settings', 'modes'),
              compactMode: isCollapsed,
            })}

            {renderNavItem({
              id: 'google_workspace',
              label: 'التقويم والمهام',
              icon: <CalendarCheck2 className="h-4 w-4" />,
              active: activeView === 'google_workspace',
              onClick: () => navigateAndClose('google_workspace'),
              compactMode: isCollapsed,
            })}
          </div>

          {/* Expandable Quick Tools & Theme Switcher Panel */}
          {quickToolsOpen && !isCollapsed && (
            <div
              className="tabrix-card tabrix-popover-enter space-y-3 border p-3.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              {/* Quick Quota Calculator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <Calculator
                      className="h-4 w-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span>حاسبة سريعة</span>
                  </span>
                  <input
                    id={`sidebar-calc-${isMobileDrawer ? 'm' : 'd'}`}
                    type="number"
                    min={0}
                    aria-label="عدد الأفراد للحاسبة السريعة"
                    value={calcIndividuals}
                    onChange={(e) => setCalcIndividuals(e.target.value)}
                    className="tabrix-btn w-16 border px-2 py-1 text-center font-bold tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                {quickCalcResult?.alloc && (
                  <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                    <span style={{ color: 'var(--accent)' }}>
                      {quickCalcResult.quota}
                    </span>
                    <span style={{ color: 'var(--success)' }}>
                      {formatIqd(quickCalcResult.alloc.priceIqd)}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Theme Swatches */}
              <div
                className="space-y-2 border-t pt-2.5"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Palette
                    className="h-4 w-4"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>تبديل سريع للثيم</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {APP_THEMES.map((t) => {
                    const active = themePrefs.appTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectAppTheme(t.id)}
                        className="tabrix-btn flex items-center gap-1.5 border px-2 py-1.5 text-right text-[10px] font-semibold"
                        style={{
                          backgroundColor: active
                            ? 'var(--bg-nav-active)'
                            : 'var(--bg-surface)',
                          borderColor: active
                            ? 'var(--accent)'
                            : 'var(--border-color)',
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border"
                          style={{
                            backgroundColor: t.swatches[0],
                            borderColor: 'var(--border-color)',
                          }}
                        />
                        <span className="truncate">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audit Indicator */}
              <button
                type="button"
                onClick={() => navigateAndClose('master_roster')}
                className="tabrix-btn flex w-full items-center justify-between border px-2.5 py-2 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor:
                    auditCount > 0 ? 'var(--warning)' : 'var(--border-color)',
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert
                    className="h-3.5 w-3.5"
                    style={{
                      color:
                        auditCount > 0 ? 'var(--warning)' : 'var(--success)',
                    }}
                  />
                  <span>التدقيق الشامل</span>
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    color: auditCount > 0 ? 'var(--warning)' : 'var(--success)',
                  }}
                >
                  {auditCount} ملاحظة
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Sticky Executive Bottom Footer */}
        <div
          className="space-y-2 border-t p-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) {
                onToggleCollapse();
                setQuickToolsOpen(true);
              } else {
                setQuickToolsOpen((v) => !v);
              }
            }}
            title="أدوات سريعة: الحاسبة وتبديل الثيم"
            aria-label="أدوات سريعة: الحاسبة وتبديل الثيم"
            className={`tabrix-btn flex min-h-[38px] w-full items-center border transition-colors ${
              isCollapsed
                ? 'justify-center px-2 py-2'
                : 'justify-between gap-2 px-3 py-1.5 text-right'
            }`}
            style={{
              backgroundColor: quickToolsOpen
                ? 'var(--bg-main)'
                : 'transparent',
              borderColor: quickToolsOpen
                ? 'var(--border-color)'
                : 'transparent',
              color: 'var(--text-muted)',
            }}
          >
            <span className="flex items-center gap-2.5">
              <Calculator className="h-4 w-4 shrink-0" />
              {!isCollapsed && (
                <span className="text-xs font-semibold whitespace-nowrap">
                  أدوات سريعة والثيم
                </span>
              )}
            </span>
            {!isCollapsed && (
              <Database
                className="h-3.5 w-3.5 opacity-60"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => navigateAndClose('settings')}
            title="الإعدادات الشاملة (ملء الشاشة)"
            aria-label="الإعدادات"
            aria-current={activeView === 'settings' ? 'page' : undefined}
            className={`tabrix-btn flex min-h-[46px] w-full items-center border transition-all hover:border-[var(--accent)] ${
              isCollapsed
                ? 'justify-center px-2 py-2.5'
                : 'justify-between gap-3 px-3 py-2 text-right'
            }`}
            style={{
              backgroundColor:
                activeView === 'settings'
                  ? 'var(--accent)'
                  : 'var(--bg-main)',
              borderColor:
                activeView === 'settings'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              color:
                activeView === 'settings'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <span className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor:
                    activeView === 'settings'
                      ? 'rgba(255,255,255,0.2)'
                      : 'var(--bg-nav-active)',
                  color:
                    activeView === 'settings'
                      ? 'var(--accent-fg)'
                      : 'var(--accent)',
                }}
              >
                <Settings className="h-4 w-4" />
              </span>
              {!isCollapsed && (
                <span className="text-right">
                  <span className="block text-xs font-bold whitespace-nowrap">
                    الإعدادات
                  </span>
                  <span
                    className="block text-[10px] font-medium whitespace-nowrap"
                    style={{
                      color:
                        activeView === 'settings'
                          ? 'var(--accent-fg)'
                          : 'var(--text-muted)',
                    }}
                  >
                    وضع {modeLabel}
                  </span>
                </span>
              )}
            </span>
            {!isCollapsed && (
              <ArrowLeft
                className="h-3.5 w-3.5 shrink-0 opacity-75"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Collapsible Navigation Sidebar */}
      <aside
        aria-label="التنقل الرئيسي"
        data-testid="desktop-sidebar"
        className={`no-print hidden lg:flex shrink-0 flex-col border transition-[width] duration-200 sticky top-[76px] h-[calc(100vh-5.5rem)] lg:ms-4 lg:mt-2 lg:mb-3 rounded-2xl overflow-hidden shadow-sm ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile / Tablet Slide-Over Navigation Drawer */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="القائمة الجانبية"
          className="no-print fixed inset-0 z-50 flex justify-start bg-black/45 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
        >
          <aside
            className="tabrix-popover-enter flex h-full w-[min(300px,85vw)] flex-col border-l shadow-xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
