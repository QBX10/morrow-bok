import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Command,
  Compass,
  Eye,
  EyeOff,
  FileSearch,
  FolderKanban,
  Globe2,
  LogIn,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  Redo2,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Undo2,
  UserCircle2,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  Agency,
  AppView,
  AuthUser,
  Person,
  ReadyList,
  RelationEntry,
  SettingsSectionId,
  TopBarConfig,
  TopBarFocusMode,
  UcrsSession,
} from '../types/agency';
import { auditAgencyPersons, normalizeArabic } from '../utils/agencyLogic';
import type { HierarchyNode, HierarchyTarget } from '../utils/hierarchyRegistry';
import { searchHierarchyNodes } from '../utils/hierarchyRegistry';
import type { ModeCapabilities } from '../utils/modePermissions';

interface TopBarProps {
  capabilities: ModeCapabilities;
  authUser: AuthUser | null;
  darkTheme: boolean;
  canUndo: boolean;
  canRedo: boolean;
  topBarConfig: TopBarConfig;
  effectiveMode: TopBarFocusMode;
  isAutoHidden?: boolean;
  activeViewLabel: string;
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  relations: RelationEntry[];
  ucrsSessions: UcrsSession[];
  hierarchyTree?: HierarchyNode;
  pendingDraftsCount?: number;
  onToggleDarkTheme: (dark: boolean) => void;
  onChangeTopBarConfig: (patch: Partial<TopBarConfig>) => void;
  onNavigateHome: () => void;
  onNavigateView: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onOpenMorrowStudio?: () => void;
  onNavigateHierarchyTarget?: (target: HierarchyTarget, nodeId: string) => void;
  onSelectPersonFromSearch: (person: Person) => void;
  onSelectAgencyFromSearch: (agencyId: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAuth: () => void;
  onOpenMobileSidebar: () => void;
  onRequestReveal?: () => void;
  onOpenCommandPalette?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  cosmosTrail?: Array<{ id: string; title: string }>;
  onOpenWorldSwitcher?: () => void;
  onSelectCosmosTrailNode?: (nodeId: string) => void;
}

type SearchHit =
  | { kind: 'person'; id: string; label: string; sublabel: string; person: Person }
  | { kind: 'agency'; id: string; label: string; sublabel: string; agencyId: number }
  | { kind: 'ready_list'; id: string; label: string; sublabel: string }
  | {
      kind: 'hierarchy';
      id: string;
      label: string;
      sublabel: string;
      target: HierarchyTarget;
      nodeId: string;
    }
  | {
      kind: 'view';
      id: string;
      label: string;
      sublabel: string;
      view: AppView;
      settingsSection?: SettingsSectionId;
    };

export const TopBar: React.FC<TopBarProps> = ({
  capabilities,
  authUser,
  darkTheme,
  canUndo,
  canRedo,
  topBarConfig,
  effectiveMode,
  isAutoHidden = false,
  activeViewLabel,
  agencies,
  persons,
  readyLists,
  relations,
  ucrsSessions,
  hierarchyTree,
  pendingDraftsCount = 0,
  onToggleDarkTheme,
  onChangeTopBarConfig,
  onNavigateHome,
  onNavigateView,
  onOpenMorrowStudio,
  onNavigateHierarchyTarget,
  onSelectPersonFromSearch,
  onSelectAgencyFromSearch,
  onUndo,
  onRedo,
  onOpenAuth,
  onOpenMobileSidebar,
  onRequestReveal,
  onOpenCommandPalette,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  cosmosTrail,
  onOpenWorldSwitcher,
  onSelectCosmosTrailNode,
}) => {
  const showViewTitle = topBarConfig.showViewTitle !== false;
  const showQuickFocusToggle = topBarConfig.showQuickFocusToggle !== false;
  const showUndoRedo = topBarConfig.showUndoRedo !== false;
  const showAuthButton = topBarConfig.showAuthButton !== false;

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeHitIdx, setActiveHitIdx] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const notifBoxRef = useRef<HTMLDivElement | null>(null);
  const accountBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (!isTyping && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setNotificationsOpen(false);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setSearchFocused(false);
      }
      if (notifBoxRef.current && !notifBoxRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (accountBoxRef.current && !accountBoxRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  const searchHits = useMemo<SearchHit[]>(() => {
    const q = normalizeArabic(searchQuery.trim());
    if (!q) return [];
    const hits: SearchHit[] = [];

    const quickViews: Array<{
      label: string;
      sublabel: string;
      view: AppView;
      settingsSection?: SettingsSectionId;
    }> = [
      { label: 'المركز', sublabel: 'لوحة الوكالات والملخص', view: 'hub' },
      { label: 'الجدول الشامل', sublabel: 'جميع المستفيدين', view: 'master_roster' },
      { label: 'مساعد Morrow AI', sublabel: 'المحادثة والذاكرة والمسودات', view: 'morrow_center' },
      { label: 'السحب الذكي', sublabel: 'PDF والكاميرا', view: 'quick_extract' },
      { label: 'المطابقة والأرشفة', sublabel: 'السجلات التاريخية', view: 'data_archives' },
      { label: 'القوائم الجاهزة', sublabel: 'قوائم التوزيع المخصصة', view: 'ready_lists' },
      { label: 'العلاقات والمتابعة', sublabel: 'المفضلة والتذكيرات', view: 'relationships' },
      { label: 'الحسابات والمالية', sublabel: 'الإيرادات والمصاريف', view: 'finance' },
      { label: 'الإعدادات — المظهر والثيمات', sublabel: 'تخصيص الألوان والشكل', view: 'settings', settingsSection: 'appearance' },
      { label: 'الإعدادات — الخطوط والكثافة', sublabel: 'حجم وسُمك الخط وكثافة الواجهة', view: 'settings', settingsSection: 'fonts' },
      { label: 'الإعدادات — الصلاحيات والتحكم', sublabel: 'الوضع الموحد والقدرات التفصيلية', view: 'settings', settingsSection: 'modes' },
      { label: 'الإعدادات — الحاسبة والرسوم', sublabel: 'معادلات الطحين والمبالغ', view: 'settings', settingsSection: 'calculator' },
      { label: 'الإعدادات — الذكاء والمساعد AI', sublabel: 'نموذج Morrow والخصوصية', view: 'settings', settingsSection: 'ai_assistant' },
      { label: 'الإعدادات — الأمان والبيانات', sublabel: 'النسخ الاحتياطي وسلة المحذوفات', view: 'settings', settingsSection: 'security_data' },
      { label: 'الإعدادات — خريطة النظام', sublabel: 'العوالم الـ14 والخريطة المدارية والأرشيف', view: 'settings', settingsSection: 'system_map' },
    ];

    for (const v of quickViews) {
      if (
        normalizeArabic(v.label).includes(q) ||
        normalizeArabic(v.sublabel).includes(q)
      ) {
        hits.push({
          kind: 'view',
          id: `v-${v.view}-${v.settingsSection || 'root'}`,
          ...v,
        });
      }
    }

    for (const ag of agencies) {
      if (normalizeArabic(ag.name).includes(q)) {
        hits.push({
          kind: 'agency',
          id: `ag-${ag.id}`,
          label: ag.name,
          sublabel: 'فتح مساحة عمل الوكالة',
          agencyId: ag.id,
        });
      }
    }

    for (const rl of readyLists) {
      if (normalizeArabic(rl.name).includes(q)) {
        hits.push({
          kind: 'ready_list',
          id: `rl-${rl.id}`,
          label: rl.name,
          sublabel: `قائمة جاهزة · ${rl.listDate}`,
        });
      }
    }

    if (hierarchyTree) {
      const hHits = searchHierarchyNodes(hierarchyTree, searchQuery);
      for (const h of hHits.slice(0, 5)) {
        hits.push({
          kind: 'hierarchy',
          id: `h-${h.node.id}`,
          label: h.node.title,
          sublabel: h.path.map((n) => n.title).join(' ◂ '),
          target: h.node.target,
          nodeId: h.node.id,
        });
      }
    }

    for (const p of persons) {
      if (
        normalizeArabic(p.name).includes(q) ||
        p.nationalId.includes(searchQuery.trim()) ||
        normalizeArabic(p.notes).includes(q)
      ) {
        hits.push({
          kind: 'person',
          id: `p-${p.id}`,
          label: p.name,
          sublabel: `${agencyMap.get(p.agencyId) || ''} · ${p.individuals ?? 0} أفراد`,
          person: p,
        });
      }
      if (hits.length >= 12) break;
    }

    return hits.slice(0, 12);
  }, [searchQuery, agencies, readyLists, persons, agencyMap, hierarchyTree]);

  useEffect(() => {
    setActiveHitIdx(0);
  }, [searchQuery]);

  const executeHit = (hit: SearchHit) => {
    setSearchFocused(false);
    setSearchQuery('');
    if (hit.kind === 'person') {
      onSelectPersonFromSearch(hit.person);
    } else if (hit.kind === 'agency') {
      onSelectAgencyFromSearch(hit.agencyId);
    } else if (hit.kind === 'ready_list') {
      onNavigateView('ready_lists');
    } else if (hit.kind === 'hierarchy' && onNavigateHierarchyTarget) {
      onNavigateHierarchyTarget(hit.target, hit.nodeId);
    } else if (hit.kind === 'view') {
      onNavigateView(hit.view, hit.settingsSection);
    }
  };

  const notifications = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      severity: 'warning' | 'info';
      onClick: () => void;
    }> = [];

    const auditIssues = auditAgencyPersons(persons);
    if (auditIssues.length > 0) {
      items.push({
        id: 'notif-audit',
        title: `${auditIssues.length} ملاحظة تدقيق في السجلات`,
        detail: auditIssues[0].message,
        severity: 'warning',
        onClick: () => onNavigateView('master_roster'),
      });
    }

    const reminders = relations.filter(
      (r) => r.category === 'reminder' || r.category === 'edit_later'
    );
    if (reminders.length > 0) {
      items.push({
        id: 'notif-relations',
        title: `${reminders.length} عنصر متابعة وتذكير`,
        detail: reminders[0].personName,
        severity: 'info',
        onClick: () => onNavigateView('relationships'),
      });
    }

    const pendingExtract = ucrsSessions.filter(
      (s) => s.status === 'in_progress' || s.status === 'needs_completion'
    );
    if (pendingExtract.length > 0 && capabilities.canUseQuickExtract) {
      items.push({
        id: 'notif-ucrs',
        title: `${pendingExtract.length} جلسة سحب ذكي قيد الاستكمال`,
        detail: pendingExtract[0].title,
        severity: 'warning',
        onClick: () => onNavigateView('quick_extract'),
      });
    }

    return items;
  }, [persons, relations, ucrsSessions, capabilities.canUseQuickExtract, onNavigateView]);

  if (effectiveMode === 'hidden' && !isAutoHidden) {
    return (
      <div className="no-print fixed top-3 left-4 z-50 flex items-center gap-2 transition-opacity">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="فتح القائمة الجانبية والأقسام"
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 84%, transparent)',
            borderColor: 'color-mix(in srgb, var(--border-color) 80%, transparent)',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          <Menu className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>القائمة</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onRequestReveal) {
              onRequestReveal();
            } else {
              onChangeTopBarConfig({ mode: 'normal' });
            }
          }}
          aria-label="إظهار الشريط العلوي"
          title="استعادة الشريط العلوي"
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent)',
            borderColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          <Eye className="h-4 w-4" />
          <span>إظهار الشريط</span>
        </button>
      </div>
    );
  }

  const isCompact = effectiveMode === 'compact';
  const accountInitial = authUser?.displayName?.trim().charAt(0).toUpperCase() || '';

  return (
    <div
      className="no-print sticky top-0 z-40 w-full px-2.5 pt-2 pb-1 sm:px-5 sm:pt-2.5 pointer-events-none"
      style={{
        transform: isAutoHidden ? 'translate3d(0, calc(-100% - 14px), 0)' : 'translate3d(0, 0, 0)',
        opacity: isAutoHidden ? 0 : 1,
        transition:
          'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease',
      }}
    >
      <header
        data-testid="floating-topbar"
        aria-hidden={isAutoHidden ? true : undefined}
        className={`mx-auto flex w-full max-w-[1560px] items-center justify-between gap-2 md:grid md:grid-cols-[1fr_minmax(250px,450px)_1fr] md:gap-4 rounded-2xl border transition-all duration-200 ${
          isAutoHidden ? 'pointer-events-none' : 'pointer-events-auto'
        } ${
          isCompact ? 'h-[46px] px-2.5 sm:px-3.5' : 'h-[54px] px-3 sm:px-4'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 84%, transparent)',
          borderColor: 'color-mix(in srgb, var(--border-color) 85%, transparent)',
          boxShadow: darkTheme
            ? '0 10px 30px -14px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 8px 24px -14px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(18px) saturate(155%)',
          WebkitBackdropFilter: 'blur(18px) saturate(155%)',
        }}
      >
        {/* Right Zone (Start in RTL): Mobile Menu + Morrow + History Arrows + Active View */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="فتح القائمة الجانبية"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border lg:hidden transition-colors hover:opacity-85"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Menu className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </button>

          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 rounded-xl px-1 py-0.5 font-bold tracking-tight whitespace-nowrap shrink-0 transition-opacity hover:opacity-85"
            style={{ color: 'var(--text-primary)' }}
          >
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold shadow-xs"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
              aria-hidden="true"
            >
              M
            </span>
            <span dir="ltr" className="text-sm font-extrabold">
              Morrow
            </span>
          </button>

          {(onGoBack || onGoForward) && (
            <div className="hidden xl:flex items-center gap-0.5">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={onGoBack}
                aria-label="رجوع"
                title="رجوع"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-main)] disabled:opacity-25"
                style={{ color: 'var(--text-muted)' }}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={!canGoForward}
                onClick={onGoForward}
                aria-label="تقدم"
                title="تقدم"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-main)] disabled:opacity-25"
                style={{ color: 'var(--text-muted)' }}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {showViewTitle && activeViewLabel && (
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span
                className="h-3.5 w-px shrink-0"
                style={{ backgroundColor: 'var(--border-color)' }}
                aria-hidden="true"
              />
              <span
                className="text-xs font-bold whitespace-nowrap truncate max-w-[175px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {activeViewLabel}
              </span>
            </div>
          )}
        </div>

        {/* Center Zone: Clean Unified Search */}
        <div
          ref={searchBoxRef}
          className="relative flex-1 min-w-0 md:w-full md:max-w-[460px] md:justify-self-center"
        >
          <div
            className={`flex items-center gap-2 rounded-xl border transition-all ${
              isCompact ? 'h-8 px-2' : 'h-9 px-2.5'
            }`}
            style={{
              backgroundColor: searchFocused
                ? 'var(--bg-surface)'
                : 'color-mix(in srgb, var(--bg-main) 88%, var(--bg-surface))',
              borderColor: searchFocused
                ? 'var(--accent)'
                : 'color-mix(in srgb, var(--accent) 18%, var(--border-color))',
              boxShadow: searchFocused
                ? '0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent)'
                : 'none',
            }}
          >
            <Search
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: searchFocused ? 'var(--accent)' : 'var(--text-muted)' }}
            />

            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
              }}
              onKeyDown={(e) => {
                if (!searchHits.length) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveHitIdx((i) => (i + 1) % searchHits.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveHitIdx((i) => (i - 1 + searchHits.length) % searchHits.length);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const chosen = searchHits[activeHitIdx] || searchHits[0];
                  if (chosen) executeHit(chosen);
                }
              }}
              placeholder="ابحث عن مستفيد، وكالة، أو إعداد..."
              aria-label="بحث موحد في التطبيق"
              className="min-w-0 w-full bg-transparent text-xs font-medium outline-none"
            />

            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح البحث"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-75 hover:opacity-100"
                style={{ backgroundColor: 'var(--bg-main)' }}
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd
                className="hidden sm:inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-mono font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                /
              </kbd>
            )}
          </div>

          {searchFocused && searchQuery.trim() && (
            <div
              role="listbox"
              aria-label="نتائج البحث الموحد"
              className="tabrix-popover-enter absolute inset-x-0 top-full mt-2 z-50 max-h-80 overflow-y-auto rounded-2xl border p-2 shadow-2xl"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-surface) 95%, transparent)',
                borderColor: 'var(--border-color)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              {searchHits.length === 0 ? (
                <div
                  className="px-3 py-5 text-center text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  لا توجد نتائج مطابقة لعبارة «{searchQuery.trim()}»
                </div>
              ) : (
                <div className="space-y-1">
                  <div
                    className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span>نتائج البحث السريع</span>
                    <span className="tabular-nums">{searchHits.length} نتيجة</span>
                  </div>
                  {searchHits.map((hit, idx) => {
                    const isHighlighted = idx === activeHitIdx;
                    return (
                      <button
                        key={hit.id}
                        type="button"
                        onMouseEnter={() => setActiveHitIdx(idx)}
                        onClick={() => executeHit(hit)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right transition-colors"
                        style={{
                          backgroundColor: isHighlighted
                            ? 'var(--bg-nav-active)'
                            : 'transparent',
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {hit.kind === 'person' ? (
                            <Users
                              className="h-4 w-4 shrink-0"
                              style={{ color: 'var(--accent)' }}
                            />
                          ) : hit.kind === 'agency' ? (
                            <FolderKanban
                              className="h-4 w-4 shrink-0"
                              style={{ color: 'var(--accent)' }}
                            />
                          ) : hit.kind === 'view' && hit.settingsSection ? (
                            <Settings
                              className="h-4 w-4 shrink-0"
                              style={{ color: 'var(--accent)' }}
                            />
                          ) : (
                            <FileSearch
                              className="h-4 w-4 shrink-0"
                              style={{ color: 'var(--text-muted)' }}
                            />
                          )}
                          <span className="truncate text-xs font-bold">{hit.label}</span>
                        </span>
                        <span
                          className="shrink-0 text-[11px] tabular-nums"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {hit.sublabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Left Zone (End in RTL): Primary Morrow Studio CTA + Notification Bell + Account Avatar Menu */}
        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => (onOpenMorrowStudio ? onOpenMorrowStudio() : onNavigateView('morrow_center'))}
            aria-label="دخول إلى مساعد Morrow الشخصي بملء الشاشة"
            title="فتح صفحة المساعد الشخصي بملء الشاشة"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">مساعد Morrow</span>
            {pendingDraftsCount > 0 && (
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-md px-1 text-[10px] font-black tabular-nums"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.22)',
                  color: 'var(--accent-fg)',
                }}
              >
                {pendingDraftsCount}
              </span>
            )}
          </button>

          {/* Notifications Bell */}
          <div ref={notifBoxRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setAccountMenuOpen(false);
              }}
              title="مركز الإشعارات والتنبيهات"
              aria-label={`مركز الإشعارات (${notifications.length})`}
              aria-expanded={notificationsOpen}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: notificationsOpen
                  ? 'var(--bg-nav-active)'
                  : 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                borderColor: notificationsOpen
                  ? 'var(--accent)'
                  : 'var(--border-color)',
                color:
                  notificationsOpen || notifications.length > 0
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
              }}
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span
                  className="absolute -top-1 -left-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold tabular-nums"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    boxShadow: '0 0 0 2px var(--bg-surface)',
                  }}
                >
                  {notifications.length}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                className="tabrix-popover-enter absolute left-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-2xl border p-3 space-y-2.5 text-xs shadow-2xl"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-surface) 96%, transparent)',
                  borderColor: 'var(--border-color)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2 font-bold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>مركز الإشعارات</span>
                  </span>
                  <span
                    className="tabular-nums text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {notifications.length} تنبيه
                  </span>
                </div>

                {notifications.length === 0 ? (
                  <div
                    className="py-4 text-center text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    جميع السجلات والجلسات منتظمة حالياً.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          n.onClick();
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-right transition-colors hover:opacity-90"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor:
                            n.severity === 'warning'
                              ? 'var(--warning)'
                              : 'var(--border-color)',
                        }}
                      >
                        {n.severity === 'warning' ? (
                          <AlertTriangle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: 'var(--warning)' }}
                          />
                        ) : (
                          <Clock
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: 'var(--accent)' }}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold">{n.title}</div>
                          <div
                            className="mt-0.5 truncate text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {n.detail}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Avatar Button -> Expands Workspace Quick Tools Menu (Undo/Redo, Theme, Command Palette, Worlds, Focus) */}
          {showAuthButton && (
            <div ref={accountBoxRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen((v) => !v);
                  setNotificationsOpen(false);
                }}
                title={
                  authUser
                    ? `الحساب وأدوات مساحة العمل (${authUser.displayName})`
                    : 'الحساب وأدوات مساحة العمل'
                }
                aria-label="قائمة الحساب والأدوات السريعة"
                aria-expanded={accountMenuOpen}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border px-1.5 sm:px-2 text-xs font-bold transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: accountMenuOpen
                    ? 'var(--bg-nav-active)'
                    : 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                  borderColor: accountMenuOpen ? 'var(--accent)' : 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {authUser?.avatarUrl ? (
                  <img
                    src={authUser.avatarUrl}
                    alt={authUser.displayName}
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-md object-cover border"
                    style={{ borderColor: 'var(--accent)' }}
                  />
                ) : accountInitial ? (
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    {accountInitial}
                  </span>
                ) : (
                  <UserCircle2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                )}
                <span className="hidden lg:inline max-w-[90px] truncate text-[11px]">
                  {authUser ? authUser.displayName : 'الحساب'}
                </span>
              </button>

              {accountMenuOpen && (
                <div
                  className="tabrix-popover-enter absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border p-3 space-y-2.5 text-xs shadow-2xl"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--bg-surface) 96%, transparent)',
                    borderColor: 'var(--border-color)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                  }}
                >
                  {/* Profile + Connectivity */}
                  <div
                    className="flex items-center justify-between border-b pb-2.5"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenAuth();
                      }}
                      className="flex items-center gap-2 text-right hover:opacity-80"
                    >
                      <LogIn className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <div>
                        <div className="font-extrabold">
                          {authUser ? authUser.displayName : 'تسجيل الدخول / المزامنة'}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {authUser ? 'إدارة الحساب والمزامنة السحابية' : 'العمل محلياً أو عبر السحابة'}
                        </div>
                      </div>
                    </button>
                    <span
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: isOnline ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      <span>{isOnline ? 'متصل' : 'أوفلاين'}</span>
                    </span>
                  </div>

                  {/* Quick Theme + Undo/Redo */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleDarkTheme(!darkTheme)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold hover:border-[var(--accent)]"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {darkTheme ? (
                        <Sun className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                      ) : (
                        <Moon className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                      )}
                      <span>{darkTheme ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                    </button>

                    {onOpenCommandPalette && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onOpenCommandPalette();
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <Command className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                        <span>الأوامر ⌘K</span>
                      </button>
                    )}
                  </div>

                  {showUndoRedo && capabilities.canEditRecords && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={!canUndo}
                        onClick={onUndo}
                        className="flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold disabled:opacity-35 hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <Undo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                        <span>تراجع</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canRedo}
                        onClick={onRedo}
                        className="flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold disabled:opacity-35 hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <Redo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                        <span>إعادة</span>
                      </button>
                    </div>
                  )}

                  {/* Back / Forward + Where am I / World Switcher */}
                  {(onGoBack || onGoForward || onOpenWorldSwitcher) && (
                    <div className="flex items-center gap-1.5">
                      {(onGoBack || onGoForward) && (
                        <>
                          <button
                            type="button"
                            disabled={!canGoBack}
                            onClick={onGoBack}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border disabled:opacity-35"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                            title="رجوع"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!canGoForward}
                            onClick={onGoForward}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border disabled:opacity-35"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                            title="تقدم"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {onOpenWorldSwitcher && (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            onOpenWorldSwitcher();
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold hover:border-[var(--accent)]"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <Globe2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                          <span>مبدّل العوالم</span>
                        </button>
                      )}
                    </div>
                  )}

                  {cosmosTrail && cosmosTrail.length > 0 && (
                    <div
                      className="rounded-xl border p-2 space-y-1"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                        <Compass className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                        <span>أين أنا؟ ({cosmosTrail.length})</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {cosmosTrail.map((step, i) => (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => {
                              setAccountMenuOpen(false);
                              onSelectCosmosTrailNode?.(step.id);
                            }}
                            className="rounded-lg border px-2 py-0.5 text-[10px] font-bold hover:border-[var(--accent)]"
                            style={{
                              backgroundColor:
                                i === cosmosTrail.length - 1
                                  ? 'var(--bg-nav-active)'
                                  : 'var(--bg-surface)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            {step.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TopBar Focus & Density Options */}
                  {showQuickFocusToggle && (
                    <div
                      className="border-t pt-2 space-y-1"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div
                        className="flex items-center gap-1.5 px-1 text-[10px] font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <SlidersHorizontal className="h-3 w-3" />
                        <span>التحكم بالشريط العلوي</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeTopBarConfig({ autoFocus: !topBarConfig.autoFocus })
                        }
                        className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 font-bold"
                        style={{
                          backgroundColor: topBarConfig.autoFocus
                            ? 'var(--bg-nav-active)'
                            : 'var(--bg-main)',
                          color: topBarConfig.autoFocus ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>إخفاء تلقائي مع التمرير</span>
                        </span>
                        <span>{topBarConfig.autoFocus ? 'مفعّل' : 'متوقف'}</span>
                      </button>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onChangeTopBarConfig({
                              mode: isCompact ? 'normal' : 'compact',
                            });
                            setAccountMenuOpen(false);
                          }}
                          className="flex items-center justify-center gap-1 rounded-xl border px-2 py-1.5 font-semibold"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          {isCompact ? (
                            <Maximize2 className="h-3.5 w-3.5" />
                          ) : (
                            <Minimize2 className="h-3.5 w-3.5" />
                          )}
                          <span>{isCompact ? 'حجم قياسي' : 'حجم مدمج'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onChangeTopBarConfig({ mode: 'hidden' });
                            setAccountMenuOpen(false);
                          }}
                          className="flex items-center justify-center gap-1 rounded-xl border px-2 py-1.5 font-semibold"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>إخفاء مؤقت</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </div>
  );
};
