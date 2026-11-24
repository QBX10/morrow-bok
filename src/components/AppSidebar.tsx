import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  DatabaseZap,
  FolderKanban,
  HeartHandshake,
  Home,
  ListChecks,
  LogOut,
  ScanLine,
  Settings,
  ShieldCheck,
  Table2,
  UserCircle2,
  X,
} from 'lucide-react';
import type {
  Agency,
  AppView,
  AuthUser,
  CalculationSettings,
  PeriodQuotaMeta,
  Person,
  SettingsSectionId,
} from '../types/agency';
import type { MorrowCenterTab } from '../types/assistant';
import type { CompressionStats } from '../services/compression/compressionEngine';
import {
  formatBytesCompact,
  formatCompressionBadgeText,
} from '../services/compression/compressionEngine';
import { computeAgencyMetrics } from '../utils/agencyLogic';
import type { ModeCapabilities } from '../utils/modePermissions';
import { GeometricRavenCrest } from './brand/VectorMotifs';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { TABRIX_SPRING, useTabrixReducedMotion } from '../utils/tabrixMotion';

interface AppSidebarProps {
  activeView: AppView;
  selectedAgencyId: number;
  agencies: Agency[];
  persons: Person[];
  authUser?: AuthUser | null;
  activePeriod?: PeriodQuotaMeta;
  relationsCount: number;
  readyListsCount: number;
  archivesCount: number;
  pendingDraftsCount?: number;
  compressionStats?: CompressionStats | null;
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onNavigate: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onNavigateMorrowTab?: (tab: MorrowCenterTab) => void;
  onOpenAgencyRoster: (agencyId: number) => void;
  onLogout?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeView,
  selectedAgencyId,
  agencies,
  persons,
  authUser = null,
  activePeriod,
  relationsCount,
  readyListsCount,
  archivesCount,
  pendingDraftsCount = 0,
  compressionStats = null,
  calculationSettings,
  capabilities,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onNavigate,
  onNavigateMorrowTab,
  onOpenAgencyRoster,
  onLogout,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [agenciesExpanded, setAgenciesExpanded] = useState(true);
  const [morrowExpanded, setMorrowExpanded] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);

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
    const compact = !isMobileDrawer && collapsed && !hoverExpanded;

    const itemClass = (active: boolean) =>
      `group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer ${
        compact ? 'justify-center px-0' : ''
      } ${
        active
          ? 'text-[var(--accent-bright)]'
          : 'border border-transparent hover:bg-white/[0.04]'
      }`;

    const itemStyle = (active: boolean): React.CSSProperties => ({
      backgroundColor: 'transparent',
      color: active ? 'var(--accent-bright)' : 'var(--text-primary)',
    });

    const renderActivePill = (active: boolean) =>
      active ? (
        <motion.span
          layoutId={
            isMobileDrawer
              ? 'tabrix-sidebar-mobile-pill'
              : 'tabrix-sidebar-desktop-pill'
          }
          transition={reducedMotion ? { duration: 0.05 } : TABRIX_SPRING}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl border border-[var(--accent)]/45 bg-[var(--bg-nav-active)] shadow-[0_6px_18px_var(--marine-caustic-1),inset_0_1px_0_rgba(255,255,255,0.16)]"
        />
      ) : null;

    return (
      <div className="flex h-full flex-col justify-between">
        {/* Header Brand + Period + Collapse */}
        <div className="space-y-3 p-3.5">
          <div
            className={`flex items-center justify-between gap-2 pb-3 border-b ${
              compact ? 'flex-col' : ''
            }`}
            style={{ borderColor: 'var(--border-color)' }}
          >
            {!compact ? (
              <div className="min-w-0 flex items-center gap-2.5">
                <GeometricRavenCrest size={36} className="shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-display-ar text-sm font-extrabold tracking-wide text-[var(--accent-bright)] leading-tight">
                    Morrow
                  </div>
                  <div className="truncate text-[10px] font-semibold text-[var(--text-muted)]">
                    {activePeriod?.quotaName || 'الهوية البحرية المطلقة'}
                  </div>
                </div>
              </div>
            ) : (
              <GeometricRavenCrest size={34} />
            )}

            {isMobileDrawer ? (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="إغلاق القائمة"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-color)] bg-black/35 text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapse}
                title={collapsed ? 'تثبيت التوسيع (260px)' : 'طي القائمة الجانبية (68px)'}
                aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
                className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-[var(--border-color)] bg-black/35 text-[var(--text-muted)] hover:text-[var(--accent-bright)] hover:border-[var(--accent)] transition-colors cursor-pointer"
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
              <div className="px-2 pb-1 text-[10px] font-bold tracking-wide text-[#9898AA]">
                الوكالات والسجلات
              </div>
            )}

            <button
              type="button"
              onClick={() => navAndClose('hub')}
              className={itemClass(activeView === 'hub')}
              style={itemStyle(activeView === 'hub')}
              title="الوكالات (الرئيسية)"
            >
              {renderActivePill(activeView === 'hub')}
              <Home className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {!compact && (
                <span className="relative z-10 truncate whitespace-nowrap">الوكالات (الرئيسية)</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navAndClose('master_roster')}
              className={itemClass(activeView === 'master_roster')}
              style={itemStyle(activeView === 'master_roster')}
              title="السجل الشامل لجميع الوكالات"
            >
              {renderActivePill(activeView === 'master_roster')}
              <Table2 className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {!compact && (
                <div className="relative z-10 flex flex-1 items-center justify-between gap-1.5 min-w-0">
                  <span className="truncate whitespace-nowrap">السجل الشامل</span>
                  <span className="font-mono-num text-[11px] font-bold text-[var(--accent-bright)]/85">
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
                  className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--accent-bright)] cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FolderKanban className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span className="whitespace-nowrap">جداول الوكالات ({agencies.length})</span>
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      agenciesExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {agenciesExpanded && (
                    <motion.div
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: reducedMotion ? 0.05 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 space-y-0.5 pr-2">
                        {agencies.length === 0 ? (
                          <div className="px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">
                            لا توجد وكالات بعد
                          </div>
                        ) : (
                          agencySummaries.map(({ agency, metrics }) => {
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
                                className="relative flex w-full items-center justify-between gap-1.5 overflow-hidden rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 hover:bg-white/[0.04] cursor-pointer"
                                style={{
                                  color: active ? 'var(--accent-bright)' : 'var(--text-primary)',
                                }}
                              >
                                {renderActivePill(active)}
                                <span className="relative z-10 flex items-center gap-1.5 min-w-0">
                                  <span className="shrink-0">{agency.icon}</span>
                                  <span className="truncate">{agency.name}</span>
                                </span>
                                <span className="relative z-10 shrink-0 font-mono-num text-[10px] font-bold text-[var(--text-muted)]">
                                  {metrics.activeHouseholds}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Group 2: Operations & Tools */}
          <div
            className="space-y-1 pt-2.5 border-t"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {!compact && (
              <div className="px-2 pb-1 text-[10px] font-bold tracking-wide text-[#9898AA]">
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
                {renderActivePill(activeView === 'quick_extract')}
                <ScanLine className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
                {!compact && (
                  <span className="relative z-10 truncate whitespace-nowrap">السحب الذكي</span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => navAndClose('ready_lists')}
              className={itemClass(activeView === 'ready_lists')}
              style={itemStyle(activeView === 'ready_lists')}
              title="القوائم الجاهزة"
            >
              {renderActivePill(activeView === 'ready_lists')}
              <ListChecks className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {!compact && (
                <div className="relative z-10 flex flex-1 items-center justify-between min-w-0">
                  <span className="truncate whitespace-nowrap">القوائم الجاهزة</span>
                  <span className="font-mono-num text-[11px] font-bold text-[var(--text-muted)]">
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
              {renderActivePill(activeView === 'relationships')}
              <HeartHandshake className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {!compact && (
                <div className="relative z-10 flex flex-1 items-center justify-between min-w-0">
                  <span className="truncate whitespace-nowrap">العلاقات والمتابعة</span>
                  <span className="font-mono-num text-[11px] font-bold text-[var(--text-muted)]">
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
                {renderActivePill(activeView === 'finance')}
                <CircleDollarSign className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
                {!compact && (
                  <span className="relative z-10 truncate whitespace-nowrap">الحسابات والمالية</span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => navAndClose('data_archives')}
              className={itemClass(activeView === 'data_archives')}
              style={itemStyle(activeView === 'data_archives')}
              title="الأرشفة الشهرية"
            >
              {renderActivePill(activeView === 'data_archives')}
              <Archive className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {!compact && (
                <div className="relative z-10 flex flex-1 items-center justify-between min-w-0">
                  <span className="truncate whitespace-nowrap">الأرشفة والمطابقة</span>
                  <span className="font-mono-num text-[11px] font-bold text-[var(--text-muted)]">
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
              {renderActivePill(activeView === 'google_workspace')}
              <CalendarDays className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {!compact && (
                <span className="relative z-10 truncate whitespace-nowrap">التقويم والمهام</span>
              )}
            </button>
          </div>

          {/* Group 3: Morrow AI Center */}
          <div
            className="space-y-1 pt-2.5 border-t"
            style={{ borderColor: 'var(--border-color)' }}
          >
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
              {renderActivePill(activeView === 'morrow_center')}
              <Bot className="relative z-10 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {!compact && (
                <div className="relative z-10 flex flex-1 items-center justify-between gap-1.5 min-w-0">
                  <span className="truncate whitespace-nowrap">مساعد Morrow</span>
                  <div className="flex items-center gap-1">
                    {pendingDraftsCount > 0 && (
                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono-num text-[10px] font-black bg-[var(--accent)] text-[var(--accent-fg)]">
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

            <AnimatePresence initial={false}>
              {!compact && morrowExpanded && onNavigateMorrowTab && (
                <motion.div
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: reducedMotion ? 0.05 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-0.5 pr-4 pt-0.5">
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
                        className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--accent-bright)] cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Pinned: Smart Compression Badge + User Profile + Settings */}
        <div
          className="border-t p-3 space-y-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {/* Live Smart Compression Indicator */}
          <div
            title={
              compressionStats
                ? `الحجم الأصلي: ${formatBytesCompact(compressionStats.rawBytes)} ← بعد الضغط: ${formatBytesCompact(compressionStats.compressedBytes)}`
                : 'محرك الضغط التلقائي قبل الحفظ نشط'
            }
            className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-nav-active)] px-2.5 py-2 flex items-center gap-2 ${
              compact ? 'justify-center px-1' : 'justify-between'
            }`}
          >
            <DatabaseZap className="h-4 w-4 shrink-0 text-[var(--accent-bright)]" />
            {!compact && (
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono-num text-[10px] font-bold text-[var(--accent-bright)] whitespace-nowrap">
                  {formatCompressionBadgeText(compressionStats)}
                </div>
                {compressionStats && compressionStats.rawBytes > 0 && (
                  <div className="truncate font-mono-num text-[9px] text-[var(--text-muted)]">
                    {formatBytesCompact(compressionStats.compressedBytes)} من{' '}
                    {formatBytesCompact(compressionStats.rawBytes)}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navAndClose('account_security')}
            className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition-all hover:border-[var(--accent)] cursor-pointer ${
              compact ? 'justify-center px-0' : 'justify-between'
            }`}
            style={{
              backgroundColor:
                activeView === 'account_security'
                  ? 'var(--bg-nav-active)'
                  : 'color-mix(in srgb, var(--bg-main) 65%, transparent)',
              borderColor:
                activeView === 'account_security'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              color:
                activeView === 'account_security'
                  ? 'var(--accent-bright)'
                  : 'var(--text-primary)',
            }}
            title="الحساب والبيانات والأمان"
          >
            <span className="flex min-w-0 items-center gap-2">
              {authUser?.avatarUrl ? (
                <img
                  src={authUser.avatarUrl}
                  alt={authUser.displayName}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 shrink-0 rounded-lg border border-[var(--accent)] object-cover"
                />
              ) : authUser ? (
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <UserCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              )}
              {!compact && (
                <span className="min-w-0 text-right">
                  <span className="block truncate whitespace-nowrap leading-tight">
                    {authUser ? authUser.displayName : 'الحساب والأمان'}
                  </span>
                  <span
                    className="block truncate text-[10px] font-medium text-[var(--text-muted)]"
                    dir="auto"
                  >
                    {authUser?.email || authUser?.username || 'مساحة معزولة'}
                  </span>
                </span>
              )}
            </span>
            {!compact && (
              <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
            )}
          </button>

          <div className={`flex items-center gap-1.5 ${compact ? 'flex-col' : ''}`}>
            <button
              type="button"
              onClick={() => navAndClose('settings')}
              className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition-colors hover:border-[var(--accent)] cursor-pointer ${
                compact ? 'w-full justify-center px-0' : 'justify-between'
              }`}
              style={{
                backgroundColor:
                  activeView === 'settings'
                    ? 'var(--bg-nav-active)'
                    : 'color-mix(in srgb, var(--bg-main) 65%, transparent)',
                borderColor:
                  activeView === 'settings'
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                color:
                  activeView === 'settings'
                    ? 'var(--accent-bright)'
                    : 'var(--text-primary)',
              }}
              title="الإعدادات"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                {!compact && <span className="whitespace-nowrap">الإعدادات</span>}
              </span>
              {!compact && (
                <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              )}
            </button>

            {onLogout && authUser && (
              <button
                type="button"
                onClick={onLogout}
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-400/50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const expandedDesktop = !collapsed || hoverExpanded;

  return (
    <>
      {/* Desktop Sticky Curved Smoked-Glass Sidebar */}
      <aside
        onMouseEnter={() => {
          if (collapsed) setHoverExpanded(true);
        }}
        onMouseLeave={() => {
          if (collapsed) setHoverExpanded(false);
        }}
        className={`hidden lg:block shrink-0 curved-glass-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expandedDesktop ? 'w-[260px]' : 'w-[68px]'
        }`}
      >
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden">
          {renderSidebarBody(false)}
        </div>
      </aside>

      {/* Full-Screen Push Navigation Menu on Mobile */}
      <FullScreenPushPage
        open={mobileOpen}
        onBack={onCloseMobile}
        title="قائمة التطبيق — Morrow"
        subtitle={activePeriod?.quotaName || 'إدارة الوكالات والسجلات'}
        maxWidthClass="max-w-lg"
      >
        <div className="smoked-glass-elevated rounded-2xl overflow-hidden">
          {renderSidebarBody(true)}
        </div>
      </FullScreenPushPage>
    </>
  );
};
