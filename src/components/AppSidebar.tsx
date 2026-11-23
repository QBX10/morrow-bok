import React, { useMemo, useState } from 'react';
import {
  Archive,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import type {
  Agency,
  AppView,
  CalculationSettings,
  PeriodQuotaMeta,
  Person,
  SettingsSectionId,
} from '../types/agency';
import type { MorrowCenterTab } from '../types/assistant';
import { computeAgencyMetrics } from '../utils/agencyLogic';
import type { ModeCapabilities } from '../utils/modePermissions';

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
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onNavigate: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onNavigateMorrowTab?: (tab: MorrowCenterTab) => void;
  onOpenAgencyRoster: (agencyId: number) => void;
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
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onNavigate,
  onNavigateMorrowTab,
  onOpenAgencyRoster,
}) => {
  const [agenciesExpanded, setAgenciesExpanded] = useState(true);
  const [morrowExpanded, setMorrowExpanded] = useState(false);

  const agencySummaries = useMemo(
    () =>
      agencies.map((ag) => ({
        agency: ag,
        metrics: computeAgencyMetrics(
          persons.filter((p) => p.agencyId === ag.id),
          [],
          calculationSettings
        ),
      })),
    [agencies, persons, calculationSettings]
  );

  const navAndClose = (view: AppView, settingsSec?: SettingsSectionId) => {
    onNavigate(view, settingsSec);
    onCloseMobile();
  };

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const compact = !isMobileDrawer && collapsed;

    const itemClass = (active: boolean) =>
      `group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-colors ${
        compact ? 'justify-center px-0' : ''
      } ${active ? 'shadow-xs' : 'hover:bg-[var(--bg-main)]'}`;

    const itemStyle = (active: boolean): React.CSSProperties => ({
      backgroundColor: active ? 'var(--bg-nav-active)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-primary)',
    });

    return (
      <div className="flex h-full flex-col justify-between">
        {/* Header Brand + Period + Collapse */}
        <div className="space-y-3 p-3">
          <div
            className={`flex items-center justify-between gap-2 pb-2.5 border-b ${
              compact ? 'flex-col' : ''
            }`}
            style={{ borderColor: 'var(--border-color)' }}
          >
            {!compact ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    M
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black leading-tight">
                      Morrow
                    </div>
                    <div
                      className="truncate text-[10px] font-semibold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {activePeriod?.quotaName || 'إدارة الوكالات'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
                title="Morrow"
              >
                M
              </span>
            )}

            {isMobileDrawer ? (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="إغلاق القائمة"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapse}
                title={compact ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
                aria-label={compact ? 'توسيع القائمة' : 'طي القائمة'}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                {compact ? (
                  <ChevronLeft className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Group 1: Agencies & Rosters */}
          <div className="space-y-1">
            {!compact && (
              <div
                className="px-2 pb-1 text-[10px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                الوكالات والسجلات
              </div>
            )}

            <button
              type="button"
              onClick={() => navAndClose('hub')}
              className={itemClass(activeView === 'hub')}
              style={itemStyle(activeView === 'hub')}
              title="الشاشة الرئيسية — الوكالات"
            >
              <Home className="h-4 w-4 shrink-0" />
              {!compact && <span className="truncate whitespace-nowrap">الوكالات (الرئيسية)</span>}
            </button>

            <button
              type="button"
              onClick={() => navAndClose('master_roster')}
              className={itemClass(activeView === 'master_roster')}
              style={itemStyle(activeView === 'master_roster')}
              title="السجل الشامل لجميع الوكالات"
            >
              <Table2 className="h-4 w-4 shrink-0" />
              {!compact && (
                <div className="flex flex-1 items-center justify-between gap-1.5 min-w-0">
                  <span className="truncate whitespace-nowrap">السجل الشامل</span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {persons.length}
                  </span>
                </div>
              )}
            </button>

            {!compact && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setAgenciesExpanded((p) => !p)}
                  className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-bold transition-colors hover:opacity-80"
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
                    {agencySummaries.map(({ agency, metrics }) => {
                      const active =
                        activeView === 'agency_roster' &&
                        selectedAgencyId === agency.id;
                      return (
                        <button
                          key={agency.id}
                          type="button"
                          onClick={() => {
                            onOpenAgencyRoster(agency.id);
                            onCloseMobile();
                          }}
                          className="flex w-full items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--bg-main)]"
                          style={{
                            backgroundColor: active
                              ? 'var(--bg-nav-active)'
                              : 'transparent',
                            color: active
                              ? 'var(--accent)'
                              : 'var(--text-primary)',
                          }}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="shrink-0">{agency.icon}</span>
                            <span className="truncate">{agency.name}</span>
                          </span>
                          <span
                            className="shrink-0 text-[10px] font-bold tabular-nums"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {metrics.activeHouseholds}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group 2: Operations & Tools */}
          <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
            {!compact && (
              <div
                className="px-2 pb-1 text-[10px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                العمليات والأدوات
              </div>
            )}

            {capabilities.canUseQuickExtract && (
              <button
                type="button"
                onClick={() => navAndClose('quick_extract')}
                className={itemClass(activeView === 'quick_extract')}
                style={itemStyle(activeView === 'quick_extract')}
                title="السحب الذكي"
              >
                <ScanLine className="h-4 w-4 shrink-0" />
                {!compact && <span className="truncate whitespace-nowrap">السحب الذكي</span>}
              </button>
            )}

            <button
              type="button"
              onClick={() => navAndClose('ready_lists')}
              className={itemClass(activeView === 'ready_lists')}
              style={itemStyle(activeView === 'ready_lists')}
              title="القوائم الجاهزة"
            >
              <ListChecks className="h-4 w-4 shrink-0" />
              {!compact && (
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="truncate whitespace-nowrap">القوائم الجاهزة</span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {readyListsCount}
                  </span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => navAndClose('relationships')}
              className={itemClass(activeView === 'relationships')}
              style={itemStyle(activeView === 'relationships')}
              title="العلاقات والمتابعة"
            >
              <HeartHandshake className="h-4 w-4 shrink-0" />
              {!compact && (
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="truncate whitespace-nowrap">العلاقات والمتابعة</span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {relationsCount}
                  </span>
                </div>
              )}
            </button>

            {capabilities.canViewFinance && (
              <button
                type="button"
                onClick={() => navAndClose('finance')}
                className={itemClass(activeView === 'finance')}
                style={itemStyle(activeView === 'finance')}
                title="الحسابات والمالية"
              >
                <CircleDollarSign className="h-4 w-4 shrink-0" />
                {!compact && <span className="truncate whitespace-nowrap">الحسابات والمالية</span>}
              </button>
            )}

            <button
              type="button"
              onClick={() => navAndClose('data_archives')}
              className={itemClass(activeView === 'data_archives')}
              style={itemStyle(activeView === 'data_archives')}
              title="الأرشفة الشهرية"
            >
              <Archive className="h-4 w-4 shrink-0" />
              {!compact && (
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="truncate whitespace-nowrap">الأرشفة والمطابقة</span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {archivesCount}
                  </span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => navAndClose('google_workspace')}
              className={itemClass(activeView === 'google_workspace')}
              style={itemStyle(activeView === 'google_workspace')}
              title="التقويم والمهام (Google)"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              {!compact && <span className="truncate whitespace-nowrap">التقويم والمهام</span>}
            </button>
          </div>

          {/* Group 3: Morrow AI Center */}
          <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button
              type="button"
              onClick={() => {
                if (compact || !onNavigateMorrowTab) {
                  navAndClose('morrow_center');
                } else {
                  setMorrowExpanded((p) => !p);
                }
              }}
              className={itemClass(activeView === 'morrow_center')}
              style={itemStyle(activeView === 'morrow_center')}
              title="مركز Morrow الذكي"
            >
              <Bot className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              {!compact && (
                <div className="flex flex-1 items-center justify-between gap-1.5 min-w-0">
                  <span className="truncate whitespace-nowrap">مساعد Morrow</span>
                  <div className="flex items-center gap-1">
                    {pendingDraftsCount > 0 && (
                      <span
                        className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-fg)',
                        }}
                      >
                        {pendingDraftsCount}
                      </span>
                    )}
                    <ChevronDown
                      className={`h-3.5 w-3.5 opacity-60 transition-transform ${
                        morrowExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              )}
            </button>

            {!compact && morrowExpanded && onNavigateMorrowTab && (
              <div className="space-y-0.5 pr-4">
                {(
                  [
                    ['chat', 'الدردشة الذكية والتحليل'],
                    ['approvals', `سلة الموافقات (${pendingDraftsCount})`],
                    ['memory', 'ذاكرة القواعد'],
                    ['quick_notes', 'الملاحظات السريعة'],
                  ] as Array<[MorrowCenterTab, string]>
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      onNavigateMorrowTab(tab);
                      onCloseMobile();
                    }}
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--bg-main)]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Pinned: Single Clean Settings Gateway */}
        <div
          className="border-t p-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
            onClick={() => navAndClose('settings')}
            className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-extrabold transition-colors hover:border-[var(--accent)] ${
              compact ? 'justify-center px-0' : 'justify-between'
            }`}
            style={{
              backgroundColor:
                activeView === 'settings' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
              borderColor:
                activeView === 'settings' ? 'var(--accent)' : 'var(--border-color)',
              color:
                activeView === 'settings' ? 'var(--accent)' : 'var(--text-primary)',
            }}
            title="الإعدادات"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              {!compact && <span className="whitespace-nowrap">الإعدادات</span>}
            </span>
            {!compact && (
              <ChevronLeft
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--text-muted)' }}
              />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 border-l transition-all duration-200 ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          {renderSidebarBody(false)}
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside
            className="relative z-10 h-full w-72 max-w-[85vw] overflow-y-auto border-l shadow-2xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
