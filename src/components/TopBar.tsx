import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Clock,
  Eye,
  EyeOff,
  FileSearch,
  FolderKanban,
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
  onToggleDarkTheme: (dark: boolean) => void;
  onChangeTopBarConfig: (patch: Partial<TopBarConfig>) => void;
  onNavigateHome: () => void;
  onNavigateView: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onSelectPersonFromSearch: (person: Person) => void;
  onSelectAgencyFromSearch: (agencyId: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAuth: () => void;
  onOpenMobileSidebar: () => void;
  onRequestReveal?: () => void;
  onOpenCommandPalette?: () => void;
}

type SearchHit =
  | { kind: 'person'; id: string; label: string; sublabel: string; person: Person }
  | { kind: 'agency'; id: string; label: string; sublabel: string; agencyId: number }
  | { kind: 'ready_list'; id: string; label: string; sublabel: string }
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
  onToggleDarkTheme,
  onChangeTopBarConfig,
  onNavigateHome,
  onNavigateView,
  onSelectPersonFromSearch,
  onSelectAgencyFromSearch,
  onUndo,
  onRedo,
  onOpenAuth,
  onOpenMobileSidebar,
  onRequestReveal,
  onOpenCommandPalette,
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
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const notifBoxRef = useRef<HTMLDivElement | null>(null);
  const focusBoxRef = useRef<HTMLDivElement | null>(null);

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

  // Keyboard shortcut '/' focuses unified search (Ctrl+K Command Palette is handled globally in App.tsx)
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
        setFocusMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close popovers on outside pointer down
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setSearchFocused(false);
      }
      if (notifBoxRef.current && !notifBoxRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (focusBoxRef.current && !focusBoxRef.current.contains(target)) {
        setFocusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  // Unified global search hits across views, settings, agencies, ready lists, and persons
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
      { label: 'الرئيسية', sublabel: 'لوحة الوكالات والملخص', view: 'hub' },
      { label: 'الجدول الشامل', sublabel: 'جميع المستفيدين', view: 'master_roster' },
      { label: 'السحب الذكي', sublabel: 'PDF والكاميرا', view: 'quick_extract' },
      { label: 'المطابقة والأرشفة', sublabel: 'السجلات التاريخية', view: 'data_archives' },
      { label: 'القوائم الجاهزة', sublabel: 'قوائم التوزيع المخصصة', view: 'ready_lists' },
      { label: 'العلاقات والمتابعة', sublabel: 'المفضلة والتذكيرات', view: 'relationships' },
      { label: 'الحسابات والمالية', sublabel: 'الإيرادات والمصاريف', view: 'finance' },
      { label: 'الإعدادات — المظهر والثيمات', sublabel: 'تخصيص الألوان والشكل', view: 'settings', settingsSection: 'appearance' },
      { label: 'الإعدادات — الخطوط والتباعد', sublabel: 'حجم وسُمك الخط', view: 'settings', settingsSection: 'fonts' },
      { label: 'الإعدادات — الأوضاع والخبير', sublabel: 'صلاحيات المبتدئ والخبير', view: 'settings', settingsSection: 'modes' },
      { label: 'الإعدادات — الحاسبة والرسوم', sublabel: 'معادلات الطحين والمبالغ', view: 'settings', settingsSection: 'calculator' },
      { label: 'الإعدادات — الأمان والبيانات', sublabel: 'النسخ الاحتياطي وسلة المحذوفات', view: 'settings', settingsSection: 'security_data' },
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
          sublabel: 'فتح جدول الوكالة',
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
      if (hits.length >= 10) break;
    }

    return hits.slice(0, 10);
  }, [searchQuery, agencies, readyLists, persons, agencyMap]);

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
    } else {
      onNavigateView(hit.view, hit.settingsSection);
    }
  };

  // Real actionable notifications from live app state
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

  if (effectiveMode === 'hidden') {
    return (
      <div className="no-print fixed top-3 left-4 z-50 flex items-center gap-2 transition-opacity">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="فتح القائمة الجانبية والأقسام"
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
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
            if (isAutoHidden && onRequestReveal) {
              onRequestReveal();
            } else {
              onChangeTopBarConfig({ mode: 'normal' });
            }
          }}
          aria-label="إظهار الشريط العلوي"
          title={
            isAutoHidden
              ? 'مخفي تلقائياً أثناء التركيز — اضغط لإظهاره'
              : 'استعادة الشريط العلوي'
          }
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent)',
            borderColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          <Eye className="h-4 w-4" />
          <span>{isAutoHidden ? 'تركيز نشط · إظهار' : 'إظهار الشريط'}</span>
        </button>
      </div>
    );
  }

  const isCompact = effectiveMode === 'compact';
  const accountInitial = authUser?.displayName?.trim().charAt(0).toUpperCase() || '';

  return (
    <div className="no-print sticky top-0 z-40 w-full px-2.5 pt-2.5 pb-1.5 sm:px-5 sm:pt-3 pointer-events-none">
      <header
        data-testid="floating-topbar"
        className={`pointer-events-auto mx-auto flex w-full max-w-[1560px] items-center justify-between gap-2 md:grid md:grid-cols-[1fr_minmax(300px,500px)_1fr] md:gap-4 rounded-2xl border transition-all duration-200 ${
          isCompact ? 'h-12 px-2.5 sm:px-4' : 'h-14 px-3 sm:px-5'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 76%, transparent)',
          borderColor: 'color-mix(in srgb, var(--border-color) 80%, transparent)',
          boxShadow: darkTheme
            ? '0 14px 36px -12px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
            : '0 14px 32px -14px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(18px) saturate(165%)',
          WebkitBackdropFilter: 'blur(18px) saturate(165%)',
        }}
      >
        {/* Right Zone (Start in RTL): Mobile Menu + Morrow Brand Mark + Active Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="فتح القائمة الجانبية"
            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border lg:hidden transition-colors hover:opacity-85"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: 'var(--accent)' }} />
          </button>

          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 rounded-xl px-1 py-1 font-bold tracking-tight whitespace-nowrap shrink-0 transition-opacity hover:opacity-85"
            style={{ color: 'var(--text-primary)' }}
          >
            <span
              className={`inline-flex items-center justify-center rounded-xl font-extrabold tracking-tight shadow-sm ${
                isCompact
                  ? 'h-7 w-7 text-xs'
                  : 'h-7 w-7 sm:h-8 sm:w-8 text-xs sm:text-sm'
              }`}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 32%, transparent)',
              }}
              aria-hidden="true"
            >
              M
            </span>
            <span
              dir="ltr"
              className={
                isCompact ? 'text-sm font-extrabold' : 'text-sm sm:text-base font-extrabold'
              }
            >
              Morrow
            </span>
          </button>

          {showViewTitle && activeViewLabel && (
            <div className="hidden xl:flex items-center gap-2 min-w-0">
              <span
                className="h-4 w-px shrink-0"
                style={{ backgroundColor: 'var(--border-color)' }}
                aria-hidden="true"
              />
              <span
                className="text-xs font-semibold whitespace-nowrap truncate max-w-[180px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {activeViewLabel}
              </span>
            </div>
          )}
        </div>

        {/* Center Zone: Prominent Centered Glass Search Bar */}
        <div
          ref={searchBoxRef}
          className="relative flex-1 min-w-0 md:w-full md:max-w-[500px] md:justify-self-center"
        >
          <div
            className={`flex items-center gap-2 rounded-xl border transition-all ${
              isCompact ? 'h-9 px-2 sm:px-2.5' : 'h-10 px-2 sm:px-3'
            }`}
            style={{
              backgroundColor: searchFocused
                ? 'var(--bg-surface)'
                : 'color-mix(in srgb, var(--bg-main) 88%, var(--bg-surface))',
              borderColor: searchFocused
                ? 'var(--accent)'
                : 'color-mix(in srgb, var(--accent) 20%, var(--border-color))',
              boxShadow: searchFocused
                ? '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent), 0 8px 20px -8px color-mix(in srgb, var(--accent) 26%, transparent)'
                : 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
            }}
          >
            <span
              className="inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{
                backgroundColor: searchFocused ? 'var(--accent)' : 'var(--bg-nav-active)',
                color: searchFocused ? 'var(--accent-fg)' : 'var(--accent)',
              }}
              aria-hidden="true"
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>

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
              placeholder="بحث موحد عن مستفيد، وكالة، قائمة، أو إعداد..."
              aria-label="بحث موحد في التطبيق"
              className="min-w-0 w-full bg-transparent text-xs sm:text-[13px] font-medium outline-none"
            />

            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح البحث"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-75 transition-opacity hover:opacity-100"
                style={{ backgroundColor: 'var(--bg-main)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd
                className="hidden sm:inline-flex shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-bold"
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
              className="tabrix-popover-enter absolute inset-x-0 top-full mt-2.5 z-50 max-h-80 overflow-y-auto rounded-2xl border p-2 shadow-2xl"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-surface) 94%, transparent)',
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
                          <span className="truncate text-xs font-bold">
                            {hit.label}
                          </span>
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

        {/* Left Zone (End in RTL): Connectivity + Theme Toggle + Undo/Redo + Focus + Notifications + Account */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
          {/* Connection Status Indicator (Real navigator.onLine telemetry) */}
          <div
            title={
              isOnline
                ? 'متصل بالشبكة — المزامنة والمساعد السحابي متاحان'
                : 'أوفلاين — العمل محلي بالكامل بدون إنترنت'
            }
            aria-label={isOnline ? 'حالة الاتصال: متصل' : 'حالة الاتصال: غير متصل'}
            className="hidden xl:inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
              borderColor: 'var(--border-color)',
              color: isOnline ? 'var(--success)' : 'var(--warning)',
            }}
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            <span>{isOnline ? 'متصل' : 'أوفلاين'}</span>
          </div>

          {/* Quick Day/Night Theme Toggle */}
          <button
            type="button"
            onClick={() => onToggleDarkTheme(!darkTheme)}
            title={darkTheme ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
            aria-label={darkTheme ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:opacity-85"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            {darkTheme ? (
              <Sun className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            ) : (
              <Moon className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {/* Undo / Redo (Preserved cleanly when editable) */}
          {showUndoRedo && capabilities.canEditRecords && (
            <div
              className="hidden md:flex h-9 items-center gap-0.5 rounded-xl border p-0.5"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                borderColor: 'var(--border-color)',
              }}
            >
              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                title="تراجع عن التعديل (Ctrl+Z)"
                aria-label="تراجع عن التعديل"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-opacity disabled:opacity-35"
                style={{ color: 'var(--text-primary)' }}
              >
                <Undo2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedo}
                title="إعادة التعديل (Ctrl+Shift+Z)"
                aria-label="إعادة التعديل"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-opacity disabled:opacity-35"
                style={{ color: 'var(--text-primary)' }}
              >
                <Redo2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              </button>
            </div>
          )}

          {/* Top Bar Focus / Size Controls Popover */}
          {showQuickFocusToggle && (
            <div ref={focusBoxRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setFocusMenuOpen((v) => !v);
                  setNotificationsOpen(false);
                }}
                title="وضع التركيز وحجم الشريط العلوي"
                aria-label="وضع التركيز وحجم الشريط العلوي"
                aria-expanded={focusMenuOpen}
                className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition-all hover:opacity-85"
                style={{
                  backgroundColor: topBarConfig.autoFocus
                    ? 'var(--bg-nav-active)'
                    : 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                  borderColor: topBarConfig.autoFocus
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                  color: topBarConfig.autoFocus
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                }}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>

              {focusMenuOpen && (
                <div
                  className="tabrix-popover-enter absolute left-0 top-full mt-2.5 z-50 w-56 rounded-2xl border p-2.5 space-y-1.5 text-xs shadow-2xl"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--bg-surface) 95%, transparent)',
                    borderColor: 'var(--border-color)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onChangeTopBarConfig({ autoFocus: !topBarConfig.autoFocus })
                    }
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 font-bold transition-colors"
                    style={{
                      backgroundColor: topBarConfig.autoFocus
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                      color: topBarConfig.autoFocus
                        ? 'var(--accent)'
                        : 'var(--text-primary)',
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span>إخفاء تلقائي بالتركيز</span>
                    </span>
                    <span>{topBarConfig.autoFocus ? 'مفعّل' : 'متوقف'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onToggleDarkTheme(!darkTheme);
                      setFocusMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 font-semibold sm:hidden hover:opacity-85"
                    style={{ backgroundColor: 'var(--bg-main)' }}
                  >
                    {darkTheme ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    <span>{darkTheme ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onChangeTopBarConfig({
                        mode: isCompact ? 'normal' : 'compact',
                      });
                      setFocusMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 font-semibold hover:opacity-85"
                    style={{ backgroundColor: 'var(--bg-main)' }}
                  >
                    {isCompact ? (
                      <Maximize2 className="h-4 w-4" />
                    ) : (
                      <Minimize2 className="h-4 w-4" />
                    )}
                    <span>{isCompact ? 'الحجم المريح' : 'تصغير الشريط'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onChangeTopBarConfig({ mode: 'hidden' });
                      setFocusMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 font-semibold hover:opacity-85"
                    style={{ backgroundColor: 'var(--bg-main)' }}
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>إخفاء الشريط مؤقتاً</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Notifications Center */}
          <div ref={notifBoxRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setFocusMenuOpen(false);
              }}
              title="مركز الإشعارات والتنبيهات"
              aria-label={`مركز الإشعارات (${notifications.length})`}
              aria-expanded={notificationsOpen}
              className="relative inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition-all hover:opacity-90"
              style={{
                backgroundColor: notificationsOpen
                  ? 'var(--bg-nav-active)'
                  : notifications.length > 0
                  ? 'color-mix(in srgb, var(--bg-nav-active) 55%, var(--bg-main))'
                  : 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                borderColor: notificationsOpen
                  ? 'var(--accent)'
                  : notifications.length > 0
                  ? 'color-mix(in srgb, var(--accent) 32%, var(--border-color))'
                  : 'var(--border-color)',
                color:
                  notificationsOpen || notifications.length > 0
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
              }}
            >
              <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              {notifications.length > 0 && (
                <span
                  className="absolute -top-1.5 -left-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold tabular-nums shadow-sm"
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
                className="tabrix-popover-enter absolute left-0 top-full mt-2.5 z-50 w-72 sm:w-80 rounded-2xl border p-3 space-y-2.5 text-xs shadow-2xl"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-surface) 95%, transparent)',
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

          {/* Enhanced Account Avatar / Profile Button */}
          {showAuthButton && (
            <button
              type="button"
              onClick={onOpenAuth}
              title={authUser ? `الحساب: ${authUser.displayName}` : 'تسجيل الدخول'}
              aria-label={
                authUser ? `حساب ${authUser.displayName}` : 'تسجيل الدخول'
              }
              className="inline-flex h-8 sm:h-9 items-center gap-2 rounded-xl border px-1.5 sm:px-2.5 text-xs font-bold whitespace-nowrap shrink-0 transition-all hover:opacity-90"
              style={{
                backgroundColor: authUser
                  ? 'color-mix(in srgb, var(--bg-nav-active) 85%, var(--bg-surface))'
                  : 'var(--accent)',
                borderColor: authUser ? 'var(--accent)' : 'var(--accent)',
                color: authUser ? 'var(--text-primary)' : 'var(--accent-fg)',
                boxShadow: authUser
                  ? 'none'
                  : '0 4px 12px color-mix(in srgb, var(--accent) 26%, transparent)',
              }}
            >
              {authUser?.avatarUrl ? (
                <img
                  src={authUser.avatarUrl}
                  alt={authUser.displayName}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded-lg object-cover border"
                  style={{ borderColor: 'var(--accent)' }}
                />
              ) : accountInitial ? (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-extrabold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {accountInitial}
                </span>
              ) : (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                  }}
                >
                  <UserCircle2 className="h-4 w-4" />
                </span>
              )}
              <span className="hidden sm:inline max-w-[110px] truncate">
                {authUser ? (
                  <span dir="auto">{authUser.displayName}</span>
                ) : (
                  'الحساب'
                )}
              </span>
            </button>
          )}
        </div>
      </header>
    </div>
  );
};
