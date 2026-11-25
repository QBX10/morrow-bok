import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Menu,
  Plus,
  Redo2,
  ScanLine,
  Search,
  Share2,
  Shield,
  Sliders,
  Sparkles,
  Undo2,
  UserCheck,
  UserCircle2,
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
  TopBarFocusMode,
  UcrsSession,
} from '../types/agency';
import { auditAgencyPersons, normalizeArabic } from '../utils/agencyLogic';
import type { HierarchyNode, HierarchyTarget } from '../utils/hierarchyRegistry';
import type { ModeCapabilities } from '../utils/modePermissions';
import { BackgroundMusicControl } from './audio/BackgroundMusicControl';
import { MotionActionButton } from './ui/TabrixMotionPrimitives';
import {
  TABRIX_BUTTON_HOVER,
  TABRIX_BUTTON_TAP,
  TABRIX_EASE,
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../utils/tabrixMotion';

interface TopBarProps {
  capabilities: ModeCapabilities;
  authUser: AuthUser | null;
  canUndo: boolean;
  canRedo: boolean;
  effectiveMode: TopBarFocusMode;
  isAutoHidden: boolean;
  activeView?: AppView;
  activeViewLabel: string;
  activePeriodLabel?: string;
  darkTheme?: boolean;
  activeThemeName?: string;
  showViewTitle?: boolean;
  showUndoRedo?: boolean;
  showAuthButton?: boolean;
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  relations: RelationEntry[];
  ucrsSessions?: UcrsSession[];
  hierarchyTree?: HierarchyNode;
  pendingDraftsCount?: number;
  onNavigateHome: () => void;
  onNavigateView: (view: AppView) => void;
  onOpenSettings?: (section?: SettingsSectionId) => void;
  onToggleDarkTheme?: (dark: boolean) => void;
  onQuickAddPerson?: () => void;
  onOpenColumnCustomizer?: () => void;
  onOpenMorrowStudio: () => void;
  onNavigateHierarchyTarget?: (target: HierarchyTarget, nodeId?: string) => void;
  onSelectPersonFromSearch: (person: Person) => void;
  onSelectAgencyFromSearch: (agencyId: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAuth: () => void;
  onOpenMobileSidebar: () => void;
  onRequestReveal: () => void;
  onOpenCommandPalette: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  capabilities,
  authUser,
  canUndo,
  canRedo,
  effectiveMode,
  isAutoHidden,
  activeView = 'hub',
  activeViewLabel,
  activePeriodLabel,
  darkTheme,
  activeThemeName,
  showViewTitle = true,
  showUndoRedo = true,
  showAuthButton = true,
  agencies,
  persons,
  readyLists,
  relations,
  ucrsSessions = [],
  pendingDraftsCount = 0,
  onNavigateHome,
  onNavigateView,
  onOpenSettings,
  onToggleDarkTheme,
  onQuickAddPerson,
  onOpenColumnCustomizer,
  onOpenMorrowStudio,
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
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const accountWrapRef = useRef<HTMLDivElement>(null);

  const isCompact = effectiveMode === 'compact';
  const isHidden = effectiveMode === 'hidden';

  // Collapse search cleanly when switching workspace views
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setNotifOpen(false);
    setAccountMenuOpen(false);
  }, [activeView]);

  // "/" shortcut to focus top bar search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      onRequestReveal();
      setSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRequestReveal]);

  // Close popovers & on-demand search on outside click / Escape
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
      if (notifWrapRef.current && !notifWrapRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (accountWrapRef.current && !accountWrapRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
        setNotifOpen(false);
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, []);

  const searchResults = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    if (!q) return { agencies: [], persons: [], lists: [], relations: [] };
    const matchedAgencies = agencies
      .filter((a) => normalizeArabic(a.name).includes(q))
      .slice(0, 3);
    const matchedPersons = persons
      .filter(
        (p) =>
          normalizeArabic(p.name).includes(q) ||
          normalizeArabic(p.nationalId).includes(q) ||
          normalizeArabic(p.notes).includes(q)
      )
      .slice(0, 6);
    const matchedLists = readyLists
      .filter((l) => normalizeArabic(l.name).includes(q))
      .slice(0, 3);
    const matchedRelations = relations
      .filter(
        (r) =>
          normalizeArabic(r.personName).includes(q) ||
          normalizeArabic(r.note).includes(q)
      )
      .slice(0, 3);
    return {
      agencies: matchedAgencies,
      persons: matchedPersons,
      lists: matchedLists,
      relations: matchedRelations,
    };
  }, [searchQuery, agencies, persons, readyLists, relations]);

  const hasSearchHits =
    searchResults.agencies.length +
      searchResults.persons.length +
      searchResults.lists.length +
      searchResults.relations.length >
    0;

  // Smart operational alerts (strictly data & agencies — zero settings)
  const notifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      tone: 'accent' | 'warning' | 'success';
      onClick: () => void;
    }> = [];

    if (pendingDraftsCount > 0) {
      list.push({
        id: 'pending-drafts',
        title: `${pendingDraftsCount} مسودة بانتظار الاعتماد`,
        subtitle: 'انقر لمراجعة مسودات المساعد الذكي',
        tone: 'accent',
        onClick: () => {
          setNotifOpen(false);
          onOpenMorrowStudio();
        },
      });
    }

    const audits = auditAgencyPersons(persons);
    if (audits.length > 0) {
      list.push({
        id: 'audit-alerts',
        title: `${audits.length} ملاحظة تدقيق في سجلات الوكالات`,
        subtitle: 'أسماء مكررة أو بيانات ناقصة تحتاج مراجعة',
        tone: 'warning',
        onClick: () => {
          setNotifOpen(false);
          onNavigateView('master_roster');
        },
      });
    }

    const activeUcrs = ucrsSessions.filter(
      (s) => s.status !== 'committed' && s.status !== 'rejected'
    );
    if (activeUcrs.length > 0) {
      list.push({
        id: 'ucrs-active',
        title: `${activeUcrs.length} جلسة سحب ذكي غير مكتملة`,
        subtitle: 'استكمل مطابقة الكشوفات واعتمادها',
        tone: 'accent',
        onClick: () => {
          setNotifOpen(false);
          onNavigateView('quick_extract');
        },
      });
    }

    const lockedCount = agencies.filter((a) => a.isLocked).length;
    if (lockedCount > 0) {
      list.push({
        id: 'locked-agencies',
        title: `${lockedCount} وكالة مقفلة حالياً`,
        subtitle: 'انقر لاستعراض حالة الوكالات في الرئيسية',
        tone: 'warning',
        onClick: () => {
          setNotifOpen(false);
          onNavigateView('hub');
        },
      });
    }

    return list;
  }, [
    pendingDraftsCount,
    persons,
    ucrsSessions,
    agencies,
    onOpenMorrowStudio,
    onNavigateView,
  ]);

  const searchPlaceholder = useMemo(() => {
    switch (activeView) {
      case 'agency_roster':
      case 'master_roster':
        return 'بحث فوري في السجل والوكالات... (/)';
      case 'quick_extract':
        return 'بحث في الوكالات والأسماء قبل المطابقة... (/)';
      case 'ready_lists':
      case 'relationships':
        return 'بحث في القوائم والعلاقات والأسماء... (/)';
      case 'finance':
        return 'بحث في الوكالات والمصروفات... (/)';
      default:
        return 'بحث في الوكالات والأسماء والقوائم... (/)';
    }
  }, [activeView]);

  const adaptiveAction = useMemo(() => {
    if (activeView === 'agency_roster' || activeView === 'master_roster') {
      if (capabilities.canEditRecords && onQuickAddPerson) {
        return {
          label: 'إضافة مستفيد',
          title: 'إضافة مستفيد جديد للسجل الحالي',
          icon: Plus,
          onClick: onQuickAddPerson,
        };
      }
      if (onOpenColumnCustomizer) {
        return {
          label: 'الأعمدة',
          title: 'تخصيص أعمدة الجدول',
          icon: Sliders,
          onClick: onOpenColumnCustomizer,
        };
      }
    }
    if (!onOpenSettings) return null;
    switch (activeView) {
      case 'quick_extract':
        return {
          label: 'إعدادات OCR',
          title: 'فتح إعدادات السحب الذكي والتعرف الضوئي',
          icon: ScanLine,
          onClick: () => onOpenSettings('quick_extract_settings'),
        };
      case 'finance':
        return {
          label: 'الحاسبة',
          title: 'تعديل رسوم وحصة الفرد والربح',
          icon: Calculator,
          onClick: () => onOpenSettings('calculator'),
        };
      case 'ready_lists':
      case 'relationships':
        return {
          label: 'التصدير والمتابعة',
          title: 'إعدادات القوائم والعلاقات والتصدير',
          icon: Share2,
          onClick: () => onOpenSettings('relations_lists'),
        };
      case 'data_archives':
        return {
          label: 'الأمان والنسخ',
          title: 'إدارة الحساب والنسخ الاحتياطي وقفل الخصوصية',
          icon: Shield,
          onClick: () => onNavigateView('account_security'),
        };
      case 'account_security':
        return {
          label: 'الأرشفة الشهرية',
          title: 'الانتقال إلى سجل الأرشيف الشهري',
          icon: Sliders,
          onClick: () => onNavigateView('data_archives'),
        };
      case 'hub':
      case 'google_workspace':
        return {
          label: 'الجداول والخطوط',
          title: 'محركات الجداول الـ 8 والخطوط العربية',
          icon: Sliders,
          onClick: () => onOpenSettings('appearance'),
        };
      default:
        return {
          label: 'الإعدادات',
          title: 'مركز الإعدادات المتقدم',
          icon: Sliders,
          onClick: () => onOpenSettings('appearance'),
        };
    }
  }, [
    activeView,
    capabilities.canEditRecords,
    onQuickAddPerson,
    onOpenColumnCustomizer,
    onOpenSettings,
  ]);

  if (isHidden) {
    return null;
  }

  return (
    <header
      className={`nexus-glass-lite floating-topbar-shell sticky top-0 z-30 border-b transition-transform duration-200 ${
        isAutoHidden ? '-translate-y-full pointer-events-none' : 'translate-y-0'
      }`}
      style={{
        borderColor: 'var(--border-color)',
      }}
    >
      <div
        className={`mx-auto flex w-full flex-nowrap items-center justify-between gap-2 px-3 sm:px-5 ${
          isCompact ? 'h-12' : 'h-14'
        }`}
      >
        {/* Zone 1: Mobile Menu, Back/Forward, Brand & Active View Context */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <MotionActionButton
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="فتح القائمة"
            className="nexus-pill-btn inline-flex h-8 w-8 shrink-0 items-center justify-center border lg:hidden cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Menu className="h-4 w-4" />
          </MotionActionButton>

          {(onGoBack || onGoForward) && (
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <MotionActionButton
                type="button"
                onClick={onGoBack}
                disabled={!canGoBack}
                aria-label="رجوع"
                title="رجوع"
                className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border disabled:opacity-35 cursor-pointer disabled:cursor-default"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </MotionActionButton>
              <MotionActionButton
                type="button"
                onClick={onGoForward}
                disabled={!canGoForward}
                aria-label="تقدم"
                title="تقدم"
                className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border disabled:opacity-35 cursor-pointer disabled:cursor-default"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </MotionActionButton>
            </div>
          )}

          <button
            type="button"
            onClick={onNavigateHome}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-1 py-0.5 text-right transition-opacity hover:opacity-85"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black shadow-sm"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              M
            </span>
            <span className="hidden md:inline text-xs sm:text-sm font-extrabold tracking-tight whitespace-nowrap">
              Morrow
            </span>
          </button>

          <AnimatePresence mode="wait" initial={false}>
            {showViewTitle && (
              <motion.div
                key={`view-ctx-${activeView}`}
                variants={
                  reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
                }
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex min-w-0 items-center gap-1.5"
              >
                <span
                  className="hidden sm:inline text-xs select-none"
                  style={{ color: 'var(--border-color)' }}
                  aria-hidden="true"
                >
                  /
                </span>
                <span
                  className={`truncate text-xs sm:text-sm font-bold ${
                    searchOpen
                      ? 'hidden sm:inline max-w-[110px] md:max-w-[160px]'
                      : 'max-w-[140px] sm:max-w-[220px]'
                  }`}
                  style={{ color: 'var(--text-primary)' }}
                  title={activeViewLabel}
                >
                  {activeViewLabel}
                </span>
                {activePeriodLabel && !searchOpen && (
                  <span
                    className="hidden xl:inline truncate max-w-[150px] text-[11px] font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                    title={activePeriodLabel}
                  >
                    · {activePeriodLabel}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zone 2: Search On-Demand (Expands cleanly only when triggered) */}
        <div
          ref={searchWrapRef}
          className={`relative ${searchOpen ? 'flex-1 max-w-md min-w-[140px]' : 'hidden'}`}
        >
          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.div
                key="topbar-search-input-box"
                variants={
                  reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
                }
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-center gap-2 rounded-xl border px-2.5 h-8 transition-colors focus-within:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                  transformOrigin: 'top center',
                }}
              >
                <Search
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: 'var(--accent)' }}
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label="بحث سريع في التطبيق"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--text-muted)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  aria-label="إغلاق البحث"
                  className="p-0.5 rounded hover:bg-[var(--bg-surface)]"
                >
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {searchOpen && searchQuery.trim() && (
              <motion.div
                key="topbar-search-popover"
                variants={
                  reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
                }
                initial="initial"
                animate="animate"
                exit="exit"
                className="smoked-glass-elevated absolute inset-x-0 top-full z-50 mt-2 max-h-[380px] overflow-y-auto rounded-2xl border p-2.5 shadow-xl"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  transformOrigin: 'top center',
                }}
              >
              {!hasSearchHits ? (
                <div
                  className="py-6 text-center text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  لا توجد نتائج مطابقة في الوكالات أو السجلات.
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {searchResults.agencies.length > 0 && (
                    <div>
                      <div
                        className="px-2 pb-1 text-[10px] font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        الوكالات
                      </div>
                      {searchResults.agencies.map((ag) => (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                            onSelectAgencyFromSearch(ag.id);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-right font-bold transition-colors hover:bg-[var(--bg-nav-active)]"
                        >
                          <span>
                            {ag.icon} {ag.name}
                          </span>
                          <span
                            className="text-[11px]"
                            style={{ color: 'var(--accent)' }}
                          >
                            فتح الوكالة
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.persons.length > 0 && (
                    <div>
                      <div
                        className="px-2 pb-1 text-[10px] font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        المستفيدون
                      </div>
                      {searchResults.persons.map((p) => {
                        const agName =
                          agencies.find((a) => a.id === p.agencyId)?.name || '';
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchQuery('');
                              onSelectPersonFromSearch(p);
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-right transition-colors hover:bg-[var(--bg-nav-active)]"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-bold">{p.name}</div>
                              <div
                                className="text-[11px]"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {agName} ·{' '}
                                <span className="tabular-nums">
                                  {p.individuals ?? 0} فرد
                                </span>
                              </div>
                            </div>
                            <span
                              className="shrink-0 text-[11px] font-bold"
                              style={{ color: 'var(--accent)' }}
                            >
                              عرض
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchResults.lists.length > 0 && (
                    <div>
                      <div
                        className="px-2 pb-1 text-[10px] font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        القوائم الجاهزة
                      </div>
                      {searchResults.lists.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                            onNavigateView('ready_lists');
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-right font-semibold transition-colors hover:bg-[var(--bg-nav-active)]"
                        >
                          <span>{l.name}</span>
                          <span
                            className="text-[11px]"
                            style={{ color: 'var(--accent)' }}
                          >
                            فتح القوائم
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.relations.length > 0 && (
                    <div>
                      <div
                        className="px-2 pb-1 text-[10px] font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        العلاقات والمتابعة
                      </div>
                      {searchResults.relations.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                            onNavigateView('relationships');
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-right font-semibold transition-colors hover:bg-[var(--bg-nav-active)]"
                        >
                          <span>{r.personName}</span>
                          <span
                            className="text-[11px]"
                            style={{ color: 'var(--accent)' }}
                          >
                            العلاقات
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zone 3: Search Trigger + Context-Smart Controls + Morrow CTA + Notifications + Account */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!searchOpen && (
            <MotionActionButton
              type="button"
              onClick={() => {
                setSearchOpen(true);
                setNotifOpen(false);
                setAccountMenuOpen(false);
                setTimeout(() => searchInputRef.current?.focus(), 20);
              }}
              title="بحث سريع (/)"
              aria-label="فتح البحث السريع"
              className="nexus-pill-btn inline-flex h-8 w-8 shrink-0 items-center justify-center border cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Search className="h-3.5 w-3.5" />
            </MotionActionButton>
          )}

          {adaptiveAction && (() => {
            const ActionIcon = adaptiveAction.icon;
            return (
              <motion.button
                key={`ctx-act-${activeView}-${adaptiveAction.label}`}
                type="button"
                onClick={adaptiveAction.onClick}
                title={adaptiveAction.title}
                variants={
                  reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
                }
                initial="initial"
                animate="animate"
                whileHover={reducedMotion ? undefined : TABRIX_BUTTON_HOVER}
                whileTap={reducedMotion ? undefined : TABRIX_BUTTON_TAP}
                transition={TABRIX_TACTILE_SPRING}
                className="nexus-pill-btn hidden md:inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <ActionIcon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                <span>{adaptiveAction.label}</span>
              </motion.button>
            );
          })()}

          {(activeView === 'agency_roster' || activeView === 'master_roster') &&
            showUndoRedo &&
            capabilities.canEditRecords && (
              <div className="hidden xl:flex items-center gap-1">
                <MotionActionButton
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="تراجع"
                  aria-label="تراجع"
                  className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border disabled:opacity-35 cursor-pointer disabled:cursor-default"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </MotionActionButton>
                <MotionActionButton
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="إعادة"
                  aria-label="إعادة"
                  className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border disabled:opacity-35 cursor-pointer disabled:cursor-default"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </MotionActionButton>
              </div>
            )}

          {/* Background Music Smart Control */}
          <BackgroundMusicControl variant="topbar" />

          {/* Operational Alerts Bell */}
          <div ref={notifWrapRef} className="relative">
            <MotionActionButton
              type="button"
              onClick={() => {
                setNotifOpen((p) => !p);
                setAccountMenuOpen(false);
              }}
              aria-label="تنبيهات الوكالات"
              className="nexus-pill-btn relative inline-flex h-8 w-8 items-center justify-center border cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: notifOpen ? 'var(--accent)' : 'var(--border-color)',
              }}
            >
              <Bell className="h-3.5 w-3.5" />
              {notifications.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono-num text-[9px] font-black tabular-nums"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {notifications.length}
                </span>
              )}
            </MotionActionButton>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  key="topbar-notif-popover"
                  variants={
                    reducedMotion
                      ? TABRIX_REDUCED_VARIANTS
                      : TABRIX_POPOVER_VARIANTS
                  }
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="smoked-glass-elevated absolute left-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border p-3 shadow-xl"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    transformOrigin: 'top left',
                  }}
                >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold">تنبيهات العمليات والوكالات</span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {notifications.length} تنبيه
                  </span>
                </div>
                {notifications.length === 0 ? (
                  <div
                    className="flex flex-col items-center gap-1.5 rounded-xl border py-5 text-center text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <CheckCircle2
                      className="h-5 w-5"
                      style={{ color: 'var(--success)' }}
                    />
                    <span>كافة الوكالات والسجلات تعمل بانتظام تام.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={n.onClick}
                        className="flex w-full flex-col rounded-xl border p-2.5 text-right transition-colors hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <span className="text-xs font-extrabold">{n.title}</span>
                        <span
                          className="mt-0.5 text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {n.subtitle}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Account Menu (Includes Quick Command Palette Trigger ⌘K) */}
          {showAuthButton && (
            <div ref={accountWrapRef} className="relative">
              <MotionActionButton
                type="button"
                onClick={() => {
                  setAccountMenuOpen((p) => !p);
                  setNotifOpen(false);
                }}
                className="nexus-pill-btn inline-flex h-8 items-center gap-1 border px-2.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: accountMenuOpen
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                }}
              >
                {authUser ? (
                  <UserCheck
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--success)' }}
                  />
                ) : (
                  <UserCircle2
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                )}
                <span className="hidden xl:inline max-w-[90px] truncate" dir="auto">
                  {authUser ? authUser.displayName : 'الحساب'}
                </span>
                <motion.span
                  animate={{ rotate: accountMenuOpen ? 180 : 0 }}
                  transition={
                    reducedMotion
                      ? { duration: 0.05 }
                      : { duration: 0.2, ease: TABRIX_EASE }
                  }
                  className="inline-flex items-center justify-center opacity-60"
                >
                  <ChevronDown className="h-3 w-3" />
                </motion.span>
              </MotionActionButton>

              <AnimatePresence>
                {accountMenuOpen && (
                  <motion.div
                    key="topbar-account-popover"
                    variants={
                      reducedMotion
                        ? TABRIX_REDUCED_VARIANTS
                        : TABRIX_POPOVER_VARIANTS
                    }
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="smoked-glass-elevated nexus-glass-lite absolute left-0 top-full z-50 mt-2 w-60 rounded-3xl border p-2.5 shadow-xl space-y-1.5 text-xs"
                    style={{
                      borderColor: 'var(--border-color)',
                      transformOrigin: 'top left',
                    }}
                  >
                  <div
                    className="border-b px-3 py-2.5"
                    style={{
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="font-extrabold" dir="auto">
                      {authUser ? authUser.displayName : 'وضع العمل المحلي'}
                    </div>
                    <div
                      className="mt-0.5 text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {authUser
                        ? 'متصل ومزامن سحابياً'
                        : 'الحفظ التلقائي على الجهاز'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onNavigateView('account_security');
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-right font-bold transition-colors hover:bg-[var(--bg-nav-active)]"
                  >
                    <span>مركز الحساب والبيانات والأمان</span>
                    <Shield
                      className="h-3.5 w-3.5"
                      style={{ color: 'var(--accent)' }}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onOpenAuth();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-right font-bold transition-colors hover:bg-[var(--bg-nav-active)]"
                  >
                    <span>{authUser ? 'نافذة تبديل الحساب' : 'تسجيل الدخول السريع'}</span>
                    <Sparkles
                      className="h-3.5 w-3.5"
                      style={{ color: 'var(--accent)' }}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onOpenCommandPalette();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-right font-bold transition-colors hover:bg-[var(--bg-nav-active)]"
                  >
                    <span>لوحة الأوامر السريعة</span>
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ⌘K
                    </span>
                  </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
