import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  Globe2,
  History,
  Lock,
  Orbit,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Star,
  Wrench,
  Zap,
} from 'lucide-react';
import type {
  CosmosExperienceMode,
  CosmosWorldId,
  WorldChangeLogEntry,
} from '../../types/agency';
import {
  searchCosmosNodes,
  type CosmosNode,
} from '../../utils/cosmosRegistry';
import { SectionLogo } from '../settings/sectionLogos';
import { BottomSheet } from './BottomSheet';

// Per-world Isolated Error Boundary
class WorldErrorBoundary extends Component<
  { worldTitle: string; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { worldTitle: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err?.message || 'خطأ غير متوقع داخل العالم' };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const handleReport = () => {
      try {
        const report = JSON.stringify(
          {
            world: this.props.worldTitle,
            error: this.state.message,
            at: new Date().toISOString(),
          },
          null,
          2
        );
        const blob = new Blob([report], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `morrow-world-report.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    };
    return (
      <div
        className="mx-auto my-8 max-w-lg rounded-[24px] border p-6 text-center space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--danger)',
        }}
      >
        <AlertTriangle className="mx-auto h-10 w-10" style={{ color: 'var(--danger)' }} />
        <h3 className="text-base font-extrabold">
          تعذر تحميل جزء من {this.props.worldTitle} بأمان
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          بقية الأقسام والجداول سليمة ومعزولة تماماً. ({this.state.message})
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="cosmos-touch-target rounded-xl px-4 py-2 text-xs font-extrabold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={handleReport}
            className="cosmos-touch-target rounded-xl border px-4 py-2 text-xs font-extrabold"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            أبلغ (تصدير تقرير تشخيصي)
          </button>
        </div>
      </div>
    );
  }
}

export type WorldSubTab = 'quick' | 'galaxies' | 'favorites' | 'search';

interface WorldShellProps {
  world: CosmosNode;
  rootCosmos: CosmosNode;
  activeTab: WorldSubTab;
  onChangeTab: (tab: WorldSubTab) => void;
  experienceMode: CosmosExperienceMode;
  onChangeExperienceMode: (mode: CosmosExperienceMode) => void;
  healthPercent: number;
  healthNote?: string;
  onFixWorldIssues?: () => void;
  changeLog: WorldChangeLogEntry[];
  onResetWorld?: () => void;
  worldExportJson?: string;
  onOpenWorldSwitcher: () => void;
  onOpenGlobalCommandPalette: () => void;
  onNavigateNode: (node: CosmosNode) => void;
  onBack: () => void;
  presetsSlot?: React.ReactNode;
  liveStageSlot?: React.ReactNode;
  quickSlot?: React.ReactNode;
  favoritesSlot?: React.ReactNode;
  children: React.ReactNode;
}

export const WorldShell: React.FC<WorldShellProps> = ({
  world,
  rootCosmos,
  activeTab,
  onChangeTab,
  experienceMode,
  onChangeExperienceMode,
  healthPercent,
  healthNote,
  onFixWorldIssues,
  changeLog,
  onResetWorld,
  worldExportJson,
  onOpenWorldSwitcher,
  onOpenGlobalCommandPalette,
  onNavigateNode,
  onBack,
  presetsSlot,
  liveStageSlot,
  quickSlot,
  favoritesSlot,
  children,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [scrolledCompact, setScrolledCompact] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGlobal, setSearchGlobal] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolledCompact(window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scopedLog = useMemo(
    () => changeLog.filter((c) => c.worldId === world.worldId).slice(0, 20),
    [changeLog, world.worldId]
  );

  const searchHits = useMemo(
    () =>
      searchCosmosNodes(rootCosmos, searchQuery, {
        scopeWorldId: searchGlobal ? null : (world.worldId as CosmosWorldId),
      }),
    [rootCosmos, searchQuery, searchGlobal, world.worldId]
  );

  const clampedHealth = Math.max(0, Math.min(100, Math.round(healthPercent)));
  const r = 13;
  const c = 2 * Math.PI * r;
  const offset = c - (clampedHealth / 100) * c;

  const handleExportWorld = () => {
    if (!worldExportJson) return;
    const blob = new Blob([worldExportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${world.worldId}-settings.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <WorldErrorBoundary worldTitle={world.title}>
      <div
        ref={containerRef}
        className="cosmos-world-enter cosmos-one-handed-shell relative min-h-[calc(100dvh-64px)] pb-28"
        style={{
          backgroundImage: world.gradient,
        }}
      >
        {/* Single Collapsing Sticky World Header */}
        <header
          className="sticky top-0 z-[var(--z-sticky)] border-b backdrop-blur-md transition-all"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div
            className={`mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:px-6 transition-all ${
              scrolledCompact ? 'py-2' : 'py-3 sm:py-3.5'
            }`}
          >
            {/* Right: Back + World Identity */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onBack}
                aria-label="العودة"
                className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2.5 hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ArrowRight className="h-4 w-4" />
              </button>

              <SectionLogo
                icon={world.icon}
                tone={world.accentTone}
                size={scrolledCompact ? 'sm' : 'md'}
              />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2
                    className={`font-extrabold truncate ${
                      scrolledCompact ? 'text-sm' : 'text-sm sm:text-base'
                    }`}
                  >
                    {world.title}
                  </h2>
                  {(world.protected || world.frozen) && (
                    <Lock
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--warning)' }}
                      aria-label="نطاق محمي"
                    />
                  )}
                </div>
                {!scrolledCompact && (
                  <p
                    className="hidden sm:block text-[11px] truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {world.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Left: Health Ring, Simple/Expert, World Switcher, World Tools */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* World Health Ring */}
              <button
                type="button"
                onClick={onFixWorldIssues || (() => setToolsOpen(true))}
                title={healthNote || `صحة العالم: ${clampedHealth}%`}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <svg className="h-7 w-7 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                  <circle
                    cx="16"
                    cy="16"
                    r={r}
                    fill="none"
                    stroke="var(--border-color)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r={r}
                    fill="none"
                    stroke={
                      clampedHealth >= 90
                        ? 'var(--success)'
                        : clampedHealth >= 70
                        ? 'var(--warning)'
                        : 'var(--danger)'
                    }
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                  />
                </svg>
                <span className="hidden sm:inline tabular-nums">{clampedHealth}%</span>
              </button>

              {/* View Layout Toggle */}
              <button
                type="button"
                onClick={() =>
                  onChangeExperienceMode(
                    experienceMode === 'simple' ? 'expert' : 'simple'
                  )
                }
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 text-xs font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor:
                    experienceMode === 'expert' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor:
                    experienceMode === 'expert' ? 'var(--accent)' : 'var(--border-color)',
                  color: experienceMode === 'expert' ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>{experienceMode === 'expert' ? 'تفصيلي' : 'مبسط'}</span>
              </button>

              {/* Section Switcher */}
              <button
                type="button"
                onClick={onOpenWorldSwitcher}
                aria-label="تبديل القسم"
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Globe2 className="h-4 w-4" style={{ color: world.accentColor }} />
                <span className="hidden md:inline">الأقسام</span>
              </button>

              {/* World Tools Sheet Trigger */}
              <button
                type="button"
                onClick={() => setToolsOpen(true)}
                aria-label="أدوات هذا العالم"
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Wrench className="h-4 w-4" />
                <span className="hidden md:inline">الأدوات</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main World Canvas */}
        <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-6">
          {liveStageSlot}

          {activeTab === 'search' ? (
            <section className="space-y-4">
              <div
                className="cosmos-glass-panel border p-4 space-y-3"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        searchGlobal
                          ? 'وين هذا؟ ابحث في كل التطبيق...'
                          : `ابحث داخل ${world.title}... (أو اكتب سؤالاً طبيعياً)`
                      }
                      className="cosmos-touch-primary w-full rounded-xl border pr-9 pl-3 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setSearchGlobal((v) => !v)}
                    className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-bold"
                    style={
                      searchGlobal
                        ? {
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-fg)',
                            borderColor: 'var(--accent)',
                          }
                        : {
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }
                    }
                  >
                    <Orbit className="h-3.5 w-3.5" />
                    <span>{searchGlobal ? 'نطاق البحث: كل التطبيق' : 'بحث في كل التطبيق'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenGlobalCommandPalette}
                    className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>لوحة الأوامر Ctrl+K</span>
                  </button>
                </div>

                {searchQuery.trim() ? (
                  searchHits.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {searchHits.slice(0, 12).map((hit) => (
                        <button
                          key={hit.node.id}
                          type="button"
                          onClick={() => onNavigateNode(hit.node)}
                          className="flex items-start gap-3 rounded-xl border p-3 text-right hover:border-[var(--accent)]"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <SectionLogo
                            icon={hit.node.icon}
                            tone={hit.node.accentTone}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold truncate">
                              {hit.node.title}
                            </div>
                            <div
                              className="text-[11px] truncate"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {hit.path.map((p) => p.title).join(' ◂ ')}
                            </div>
                            <div
                              className="mt-1 text-[10px] font-bold"
                              style={{ color: 'var(--accent)' }}
                            >
                              {hit.matchedReason}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                      لا توجد نتائج مطابقة داخل هذا النطاق — جرّب تفعيل «بحث في كل التطبيق».
                    </p>
                  )
                ) : (
                  <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                    جرّب مثلاً: «رسم الفرد»، «أبي أغير لون الجدول»، «قفل برقم سري»، «مؤشرات الأداء».
                  </p>
                )}
              </div>
            </section>
          ) : activeTab === 'quick' && quickSlot ? (
            quickSlot
          ) : activeTab === 'favorites' && favoritesSlot ? (
            favoritesSlot
          ) : (
            children
          )}
        </div>

        {/* Dedicated World Bottom Navigation Bar */}
        <div
          className="no-print fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav)] border-t backdrop-blur-lg"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
            borderColor: 'var(--border-color)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1 px-2 py-1.5">
            {(
              [
                { id: 'quick', label: 'سريع', icon: Zap },
                { id: 'galaxies', label: 'الأقسام', icon: Orbit },
                { id: 'favorites', label: 'المفضلة', icon: Star },
                { id: 'search', label: 'بحث', icon: Search },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeTab(tab.id)}
                  className="cosmos-touch-target flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl py-1.5 text-[11px] sm:text-xs font-extrabold transition-colors"
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--bg-nav-active)',
                          color: world.accentColor || 'var(--accent)',
                        }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* World Tools Bottom Sheet (Reset THIS world only, Presets, Change Log, Export) */}
        <BottomSheet
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
          title={`أدوات ${world.title}`}
          subtitle="إدارة معزولة لهذا القسم فقط — لا تؤثر على بقية الأقسام أو الجداول المحمية"
          icon={<Wrench className="h-5 w-5" />}
        >
          <div className="space-y-5">
            {healthNote && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div>
                  <div className="font-extrabold">حالة القسم ({clampedHealth}%)</div>
                  <div style={{ color: 'var(--text-muted)' }}>{healthNote}</div>
                </div>
                {onFixWorldIssues && (
                  <button
                    type="button"
                    onClick={() => {
                      onFixWorldIssues();
                      setToolsOpen(false);
                    }}
                    className="cosmos-touch-target rounded-xl px-3.5 py-2 text-xs font-extrabold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    إصلاح الآن
                  </button>
                )}
              </div>
            )}

            {presetsSlot && <div className="space-y-2">{presetsSlot}</div>}

            <div className="flex flex-wrap items-center gap-2.5">
              {worldExportJson && (
                <button
                  type="button"
                  onClick={handleExportWorld}
                  className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-extrabold hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير إعدادات هذا القسم JSON</span>
                </button>
              )}

              {onResetWorld && (
                <button
                  type="button"
                  onClick={() => {
                    onResetWorld();
                    setToolsOpen(false);
                  }}
                  className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-extrabold hover:border-[var(--warning)]"
                  style={{
                    backgroundColor: 'var(--warning-bg)',
                    borderColor: 'var(--warning)',
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>استعادة افتراضي هذا القسم فقط</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold">
                <History className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>سجل تغييرات هذا القسم ({scopedLog.length})</span>
              </div>
              {scopedLog.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  لم تُسجّل تغييرات في هذا القسم خلال الجلسة الأخيرة.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {scopedLog.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-bold truncate">{item.label}</div>
                        {(item.beforeValue || item.afterValue) && (
                          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {item.beforeValue || '—'} ← {item.afterValue || '—'}
                          </div>
                        )}
                      </div>
                      <span
                        className="text-[10px] tabular-nums shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {item.timestamp.slice(11, 16)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </BottomSheet>
      </div>
    </WorldErrorBoundary>
  );
};
