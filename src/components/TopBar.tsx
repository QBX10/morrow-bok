import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  Command,
  Menu,
  Redo2,
  Search,
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
  TopBarFocusMode,
  UcrsSession,
} from '../types/agency';
import { auditAgencyPersons, normalizeArabic } from '../utils/agencyLogic';
import type { HierarchyNode, HierarchyTarget } from '../utils/hierarchyRegistry';
import type { ModeCapabilities } from '../utils/modePermissions';

interface TopBarProps {
  capabilities: ModeCapabilities;
  authUser: AuthUser | null;
  canUndo: boolean;
  canRedo: boolean;
  effectiveMode: TopBarFocusMode;
  isAutoHidden: boolean;
  activeViewLabel: string;
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
  activeViewLabel,
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
      setTimeout(() => {
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }, 20);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRequestReveal]);

  // Close popovers on outside click / Escape
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) {
        setSearchOpen(false);
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

  if (isHidden) {
    return null;
  }

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur-md transition-transform duration-200 ${
        isAutoHidden ? '-translate-y-full pointer-events-none' : 'translate-y-0'
      }`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 px-3 sm:px-5 ${
          isCompact ? 'h-12' : 'h-14'
        }`}
      >
        {/* Zone 1: Mobile Menu, Back/Forward, Brand & Active View Context */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="فتح القائمة"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border lg:hidden transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Menu className="h-4 w-4" />
          </button>

          {(onGoBack || onGoForward) && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={onGoBack}
                disabled={!canGoBack}
                aria-label="رجوع"
                title="رجوع"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:border-[var(--accent)] disabled:opacity-35"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onGoForward}
                disabled={!canGoForward}
                aria-label="تقدم"
                title="تقدم"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:border-[var(--accent)] disabled:opacity-35"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onNavigateHome}
            className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-right transition-opacity hover:opacity-85"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-sm"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              M
            </span>
            <span className="hidden md:inline text-sm font-extrabold tracking-tight whitespace-nowrap">
              Morrow
            </span>
          </button>

          {showViewTitle && (
            <>
              <span
                className="hidden sm:inline text-xs select-none"
                style={{ color: 'var(--border-color)' }}
                aria-hidden="true"
              >
                /
              </span>
              <span
                className="truncate max-w-[160px] sm:max-w-[240px] text-xs sm:text-sm font-bold"
                style={{ color: 'var(--text-primary)' }}
                title={activeViewLabel}
              >
                {activeViewLabel}
              </span>
            </>
          )}
        </div>

        {/* Zone 2: Clean Operational Search */}
        <div
          ref={searchWrapRef}
          className="relative flex-1 max-w-md hidden sm:block"
        >
          <div
            className="flex items-center gap-2 rounded-xl border px-3 h-9 transition-colors focus-within:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: searchOpen ? 'var(--accent)' : 'var(--border-color)',
            }}
          >
            <Search
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="بحث في الوكالات والأسماء والقوائم... (/)"
              className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--text-muted)]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح البحث"
                className="p-0.5 rounded hover:bg-[var(--bg-surface)]"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
              </button>
            ) : (
              <kbd
                className="hidden md:inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                /
              </kbd>
            )}
          </div>

          {searchOpen && searchQuery.trim() && (
            <div
              className="tabrix-popover-enter absolute inset-x-0 top-full z-50 mt-2 max-h-[380px] overflow-y-auto rounded-2xl border p-2.5 shadow-xl"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
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
            </div>
          )}
        </div>

        {/* Zone 3: Quick Actions — Morrow AI Studio, Command Palette, Notifications, Account */}
        <div className="flex shrink-0 items-center gap-1.5">
          {showUndoRedo && capabilities.canEditRecords && (
            <div className="hidden xl:flex items-center gap-1">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title="تراجع"
                aria-label="تراجع"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)] disabled:opacity-35"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title="إعادة"
                aria-label="إعادة"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)] disabled:opacity-35"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Primary Smart AI Studio CTA */}
          <button
            type="button"
            onClick={onOpenMorrowStudio}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <Bot className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">مساعد Morrow</span>
            {pendingDraftsCount > 0 && (
              <span
                className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--accent)',
                }}
              >
                {pendingDraftsCount}
              </span>
            )}
          </button>

          {/* Operational Alerts Bell */}
          <div ref={notifWrapRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((p) => !p);
                setAccountMenuOpen(false);
              }}
              aria-label="تنبيهات الوكالات"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: notifOpen ? 'var(--accent)' : 'var(--border-color)',
              }}
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'var(--warning)' }}
                />
              )}
            </button>

            {notifOpen && (
              <div
                className="tabrix-popover-enter absolute left-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border p-3 shadow-xl"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
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
              </div>
            )}
          </div>

          {/* Command Palette Trigger */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            title="لوحة الأوامر السريعة (Ctrl+K)"
            aria-label="لوحة الأوامر السريعة"
            className="hidden md:inline-flex h-9 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <Command className="h-3.5 w-3.5" />
            <span>K</span>
          </button>

          {/* Account Menu (Strictly Account & Quick Actions — ZERO Settings!) */}
          {showAuthButton && (
            <div ref={accountWrapRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen((p) => !p);
                  setNotifOpen(false);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: accountMenuOpen
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                }}
              >
                {authUser ? (
                  <UserCheck
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--success)' }}
                  />
                ) : (
                  <UserCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                )}
                <span className="hidden lg:inline max-w-[100px] truncate" dir="auto">
                  {authUser ? authUser.displayName : 'الحساب'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>

              {accountMenuOpen && (
                <div
                  className="tabrix-popover-enter absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border p-2.5 shadow-xl space-y-1.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div
                    className="rounded-xl border px-3 py-2"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="font-extrabold" dir="auto">
                      {authUser ? authUser.displayName : 'وضع العمل المحلي'}
                    </div>
                    <div
                      className="text-[11px]"
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
                      onOpenAuth();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-right font-bold transition-colors hover:bg-[var(--bg-nav-active)]"
                  >
                    <span>{authUser ? 'إدارة الحساب والمزامنة' : 'تسجيل الدخول'}</span>
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
