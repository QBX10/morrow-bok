import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  CalendarDays,
  Check,
  Clock,
  Compass,
  Edit3,
  FileSearch,
  GitCompareArrows,
  Globe2,
  ImagePlus,
  LayoutGrid,
  ListChecks,
  Lock,
  Orbit,
  Plus,
  ShieldAlert,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { compressImageFileToDataUrl } from '../lib/imageUpload';
import { DEFAULT_WORKSPACE_COSMOS } from '../data/seedData';
import type {
  Agency,
  AgencyExpense,
  AppView,
  CalculationSettings,
  PeriodQuotaMeta,
  Person,
  SettingsSectionId,
  WorkspaceCosmosState,
} from '../types/agency';
import {
  auditAgencyPersons,
  calculateAllocation,
  computeAgencyMetrics,
  formatIqd,
  formatNumberCompact,
  formatQuota,
} from '../utils/agencyLogic';
import {
  buildCosmosRegistry,
  COSMOS_TAG_LABELS,
  getCosmosNodeById,
  getSmartCosmosSuggestions,
  loadCosmosUsageMap,
  searchCosmosNodes,
  type CosmosNode,
  type CosmosTagId,
} from '../utils/cosmosRegistry';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
  HierarchyTarget,
} from '../utils/hierarchyRegistry';
import type { ModeCapabilities } from '../utils/modePermissions';
import { GalaxyCard } from './cosmos/GalaxyCard';
import { OrbitalMapView } from './cosmos/OrbitalMapView';
import { SectionLogo } from './settings/sectionLogos';

interface AgenciesHubViewProps {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  activePeriod?: PeriodQuotaMeta;
  readyListsCount: number;
  relationsCount: number;
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  hierarchyTree?: HierarchyNode;
  hierarchyBadgeContext?: HierarchyBadgeContext;
  onNavigateHierarchyTarget?: (target: HierarchyTarget, nodeId: string) => void;
  onOpenMasterRoster: () => void;
  onOpenAgencyRoster: (agencyId: number) => void;
  onNavigateView: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onAddAgency: (name: string, icon: string) => void;
  onUpdateAgencyDetails?: (
    agencyId: number,
    patch: Partial<Pick<Agency, 'name' | 'icon' | 'logoDataUrl' | 'isLocked'>>
  ) => void;
  rootCosmos?: CosmosNode;
  workspaceCosmos?: WorkspaceCosmosState;
  onSelectCosmosNode?: (node: CosmosNode) => void;
  onTogglePinnedNode?: (nodeId: string) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
  onCompleteOnboarding?: () => void;
  onOpenWorldSwitcher?: () => void;
}

export const AgenciesHubView: React.FC<AgenciesHubViewProps> = ({
  agencies,
  persons,
  expenses,
  activePeriod,
  readyListsCount,
  relationsCount,
  calculationSettings,
  capabilities,
  hierarchyTree,
  hierarchyBadgeContext,
  onNavigateHierarchyTarget,
  onOpenMasterRoster,
  onOpenAgencyRoster,
  onNavigateView,
  onAddAgency,
  onUpdateAgencyDetails,
  rootCosmos,
  workspaceCosmos,
  onSelectCosmosNode,
  onTogglePinnedNode,
  onDismissSuggestion,
  onCompleteOnboarding,
  onOpenWorldSwitcher,
}) => {
  const [newAgencyName, setNewAgencyName] = useState('');
  const [showAddAgency, setShowAddAgency] = useState(false);
  const [editingAgencyId, setEditingAgencyId] = useState<number | null>(null);
  const [editAgencyName, setEditAgencyName] = useState('');
  const [editAgencyIcon, setEditAgencyIcon] = useState('');
  const [editAgencyLogo, setEditAgencyLogo] = useState<string | undefined>(
    undefined
  );
  const [logoError, setLogoError] = useState('');
  const [bentoCalcCount, setBentoCalcCount] = useState('5');
  const [selectedTag, setSelectedTag] = useState<CosmosTagId | null>(null);
  const [showOrbitalInHub, setShowOrbitalInHub] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedCosmosRoot = useMemo(
    () => rootCosmos || buildCosmosRegistry(agencies),
    [rootCosmos, agencies]
  );

  const effectiveCosmos: WorkspaceCosmosState = useMemo(
    () => workspaceCosmos || DEFAULT_WORKSPACE_COSMOS,
    [workspaceCosmos]
  );

  const allMetrics = useMemo(
    () => computeAgencyMetrics(persons, expenses, calculationSettings),
    [persons, expenses, calculationSettings]
  );

  const auditIssues = useMemo(() => auditAgencyPersons(persons), [persons]);

  const visibleWorlds = useMemo(() => {
    const base = resolvedCosmosRoot.children.filter(
      (w) => !effectiveCosmos.hiddenWorldIds.includes(w.worldId)
    );
    if (!selectedTag) return base;
    const hitIds = new Set(
      searchCosmosNodes(resolvedCosmosRoot, '', { tagFilter: selectedTag })
        .filter((h) => h.node.nodeType === 'world')
        .map((h) => h.node.id)
    );
    return base.filter((w) => hitIds.has(w.id) || w.tags.includes(selectedTag));
  }, [resolvedCosmosRoot, effectiveCosmos.hiddenWorldIds, selectedTag]);

  const pinnedNodes = useMemo(
    () =>
      effectiveCosmos.pinnedNodeIds
        .map((id) => getCosmosNodeById(resolvedCosmosRoot, id))
        .filter((n): n is CosmosNode => Boolean(n)),
    [effectiveCosmos.pinnedNodeIds, resolvedCosmosRoot]
  );

  const recentNodes = useMemo(
    () =>
      effectiveCosmos.recentNodeIds
        .filter((id) => !effectiveCosmos.pinnedNodeIds.includes(id))
        .slice(0, 4)
        .map((id) => getCosmosNodeById(resolvedCosmosRoot, id))
        .filter((n): n is CosmosNode => Boolean(n)),
    [effectiveCosmos.recentNodeIds, effectiveCosmos.pinnedNodeIds, resolvedCosmosRoot]
  );

  const smartSuggestions = useMemo(() => {
    if (!effectiveCosmos.featureFlags.smartUsageSuggestions) return [];
    return getSmartCosmosSuggestions({
      root: resolvedCosmosRoot,
      usageMap: loadCosmosUsageMap(),
      pinnedNodeIds: effectiveCosmos.pinnedNodeIds,
      dismissedIds: effectiveCosmos.dismissedSuggestionIds,
      auditIssuesCount: auditIssues.length,
      feePerIndividualIqd: calculationSettings.feePerIndividualIqd,
    });
  }, [
    effectiveCosmos.featureFlags.smartUsageSuggestions,
    effectiveCosmos.pinnedNodeIds,
    effectiveCosmos.dismissedSuggestionIds,
    resolvedCosmosRoot,
    auditIssues.length,
    calculationSettings.feePerIndividualIqd,
  ]);

  const handleOpenCosmosNode = (node: CosmosNode) => {
    if (onSelectCosmosNode) {
      onSelectCosmosNode(node);
    } else if (onNavigateHierarchyTarget) {
      onNavigateHierarchyTarget(node.target, node.id);
    }
  };

  const agencyBreakdown = useMemo(() => {
    const totalInd = Math.max(1, allMetrics.activeIndividuals);
    return agencies.map((ag) => {
      const m = computeAgencyMetrics(
        persons.filter((p) => p.agencyId === ag.id),
        expenses.filter((e) => e.agencyId === ag.id),
        calculationSettings
      );
      return {
        agency: ag,
        metrics: m,
        sharePct: Math.round((m.activeIndividuals / totalInd) * 100),
      };
    });
  }, [agencies, persons, expenses, calculationSettings, allMetrics.activeIndividuals]);

  const liveBentoCalc = useMemo(() => {
    const n = Number(bentoCalcCount);
    if (!Number.isFinite(n) || n < 0) return null;
    return {
      alloc: calculateAllocation(n, calculationSettings),
      quota: formatQuota(n, undefined, calculationSettings),
    };
  }, [bentoCalcCount, calculationSettings]);

  const primaryThreeAgencies = useMemo(() => agencies.slice(0, 3), [agencies]);
  const extraAgencies = useMemo(() => agencies.slice(3), [agencies]);

  const handleAgencyLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setLogoError('');
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxDim: 200,
        maxChars: 140000,
        quality: 0.8,
      });
      setEditAgencyLogo(dataUrl);
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : 'تعذر معالجة شعار الوكالة.'
      );
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 space-y-6 sm:space-y-8 p-4 pb-24 sm:p-8 sm:pb-20">
      {/* Executive Hub Top Bar */}
      <header
        data-testid="hub-top-header"
        className="tabrix-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 sm:p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <span
            className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'color-mix(in srgb, var(--accent) 26%, var(--border-color))',
              color: 'var(--accent)',
            }}
            aria-hidden="true"
          >
            <LayoutGrid className="h-6 w-6" />
          </span>

          <div className="space-y-1.5 min-w-0">
            <h1 className="text-xl font-extrabold sm:text-2xl">
              <span dir="ltr">Morrow</span> — لوحة الوكالات الرئيسية
            </h1>
            <div
              className="flex flex-wrap items-center gap-2 text-xs sm:text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>اختر «جميع الوكالات» أو إحدى الوكالات لعرض جدولها التفصيلي</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                {capabilities.isReadOnlyPdfView
                  ? 'وضع المبتدئ (عرض وقراءة فقط)'
                  : capabilities.label}
              </span>
              {activePeriod && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {activePeriod.quotaName} ({activePeriod.monthName})
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateView('settings', 'modes')}
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <Sliders className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>تبديل الوضع</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateView('data_archives')}
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <GitCompareArrows className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>المطابقة والأرشفة</span>
          </button>

          {onOpenWorldSwitcher && (
            <button
              type="button"
              onClick={onOpenWorldSwitcher}
              className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-extrabold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Globe2 className="h-4 w-4" />
              <span>مبدّل العوالم ({resolvedCosmosRoot.children.length})</span>
            </button>
          )}

          {capabilities.canManageAgencies && (
            <button
              type="button"
              onClick={() => setShowAddAgency((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Plus className="h-4 w-4" />
              <span>إضافة وكالة جديدة</span>
            </button>
          )}
        </div>
      </header>

      {/* First-Time Onboarding Tour Card */}
      {!effectiveCosmos.accessibility.onboardingCompleted && onCompleteOnboarding && (
        <section
          aria-label="جولة تعريفية سريعة بنظام الأكوان"
          className="cosmos-glass-panel border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
          style={{
            borderColor: 'var(--accent)',
            backgroundImage:
              'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.06))',
          }}
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Compass className="h-6 w-6 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-extrabold">
                مرحباً بك في نظام الأكوان والعوالم الجديد — Morrow
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                كل الإعدادات والميزات أصبحت معزولة في 14 عالماً واضحاً (مركز ◂ عالم ◂ مجرة ◂ كبسولة)، مع بقاء الجداول الشاملة والوكالات والثيمات محمية 100% بلا أي حذف.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCompleteOnboarding}
            className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold shrink-0"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <Check className="h-4 w-4" />
            <span>فهمت، لنبدأ</span>
          </button>
        </section>
      )}

      {/* Quick Favorites, Recently Opened & Dismissible Smart Suggestions */}
      {(pinnedNodes.length > 0 || recentNodes.length > 0 || smartSuggestions.length > 0) && (
        <section aria-label="المفضلة وآخر ما فتحته والاقتراحات الذكية" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {pinnedNodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span>المفضلة:</span>
                </span>
                {pinnedNodes.slice(0, 6).map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleOpenCosmosNode(node)}
                    className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors hover:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                  >
                    <SectionLogo icon={node.icon} tone={node.accentTone} size="xs" />
                    <span>{node.title}</span>
                  </button>
                ))}
              </div>
            )}

            {recentNodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>آخر ما فتحته:</span>
                </span>
                {recentNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleOpenCosmosNode(node)}
                    className="cosmos-touch-target inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold hover:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
                  >
                    <span>{node.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {smartSuggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {smartSuggestions.slice(0, 2).map((sug) => {
                const targetNode = getCosmosNodeById(resolvedCosmosRoot, sug.targetNodeId);
                return (
                  <div
                    key={sug.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs"
                    style={{
                      backgroundColor:
                        sug.tone === 'warning' ? 'var(--warning-bg)' : 'var(--bg-surface)',
                      borderColor:
                        sug.tone === 'warning' ? 'var(--warning)' : 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <Sparkles
                        className="h-4 w-4 shrink-0 mt-0.5"
                        style={{
                          color: sug.tone === 'warning' ? 'var(--warning)' : 'var(--accent)',
                        }}
                      />
                      <div className="min-w-0">
                        <div className="font-extrabold">{sug.title}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{sug.subtitle}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {targetNode && (
                        <button
                          type="button"
                          onClick={() => handleOpenCosmosNode(targetNode)}
                          className="rounded-xl px-3 py-1.5 font-extrabold"
                          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                        >
                          {sug.ctaLabel}
                        </button>
                      )}
                      {onDismissSuggestion && (
                        <button
                          type="button"
                          onClick={() => onDismissSuggestion(sug.id)}
                          aria-label="إخفاء الاقتراح"
                          className="rounded-lg p-1.5 opacity-70 hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Inline Add Agency Form */}
      {showAddAgency && capabilities.canManageAgencies && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newAgencyName.trim()) return;
            onAddAgency(newAgencyName, '🏢');
            setNewAgencyName('');
            setShowAddAgency(false);
          }}
          className="tabrix-card tabrix-popover-enter flex flex-wrap items-center gap-3 border p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <input
            type="text"
            required
            value={newAgencyName}
            onChange={(e) => setNewAgencyName(e.target.value)}
            placeholder="اسم الوكالة الجديدة..."
            className="tabrix-btn min-w-[220px] flex-1 border px-3.5 py-2.5 text-sm"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          />
          <button
            type="submit"
            className="tabrix-btn px-5 py-2.5 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            حفظ الوكالة
          </button>
          <button
            type="button"
            onClick={() => setShowAddAgency(false)}
            className="tabrix-btn border px-4 py-2.5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            إلغاء
          </button>
        </form>
      )}

      {/* Inline Edit Agency Details Form */}
      {editingAgencyId !== null &&
        capabilities.canManageAgencies &&
        onUpdateAgencyDetails && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editAgencyName.trim()) return;
              onUpdateAgencyDetails(editingAgencyId, {
                name: editAgencyName.trim(),
                icon: editAgencyIcon.trim() || '🏢',
                logoDataUrl: editAgencyLogo || '',
              });
              setEditingAgencyId(null);
              setLogoError('');
            }}
            className="tabrix-card tabrix-popover-enter space-y-3 border p-6"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
            }}
          >
            <div className="flex flex-wrap items-center gap-3">
              {editAgencyLogo ? (
                <img
                  src={editAgencyLogo}
                  alt="شعار الوكالة"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-lg border object-cover"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              ) : null}

              <input
                type="text"
                value={editAgencyIcon}
                onChange={(e) => setEditAgencyIcon(e.target.value)}
                aria-label="أيقونة الوكالة"
                className="tabrix-btn w-14 border px-2 py-2.5 text-center text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <input
                type="text"
                required
                value={editAgencyName}
                onChange={(e) => setEditAgencyName(e.target.value)}
                aria-label="تعديل اسم الوكالة"
                className="tabrix-btn min-w-[200px] flex-1 border px-3.5 py-2.5 text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="tabrix-btn inline-flex items-center gap-1.5 border px-3.5 py-2.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ImagePlus className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>رفع شعار</span>
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleAgencyLogoUpload}
                className="hidden"
              />

              {editAgencyLogo && (
                <button
                  type="button"
                  onClick={() => setEditAgencyLogo(undefined)}
                  aria-label="حذف شعار الوكالة"
                  className="tabrix-btn inline-flex items-center gap-1 border px-3 py-2.5 text-xs font-semibold"
                  style={{
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="submit"
                className="tabrix-btn inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Check className="h-4 w-4" />
                <span>حفظ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingAgencyId(null);
                  setLogoError('');
                }}
                className="tabrix-btn inline-flex items-center gap-1.5 border px-3.5 py-2.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <X className="h-4 w-4" />
                <span>إلغاء</span>
              </button>
            </div>
            {logoError && (
              <div className="text-xs font-bold" style={{ color: 'var(--danger)' }}>
                {logoError}
              </div>
            )}
          </form>
        )}

      {/* Active Bento Grid Row 1: Executive Summary (8 Cols) + Live Operational Pulse (4 Cols) */}
      <section
        aria-label="ملخص الوكالات والعمليات"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch"
      >
        <div
          className="tabrix-card lg:col-span-8 flex flex-col justify-between border p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent)',
          }}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    البطاقة الرئيسية · السجل الشامل
                  </div>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold"
                    style={{ color: 'var(--warning)' }}
                  >
                    <Lock className="h-3 w-3" />
                    <span>نطاق محمي (Frozen Zone)</span>
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold">جميع الوكالات</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenMasterRoster}
                  className="tabrix-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <span>فتح الجدول الشامل بملء الشاشة</span>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  العائلات النشطة
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {allMetrics.activeHouseholds}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  إجمالي الأفراد
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {allMetrics.activeIndividuals}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  الأكياس المطلوبة
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {allMetrics.fullBags}
                  {allMetrics.remainderKg > 0 && (
                    <span
                      className="mr-1.5 text-xs font-semibold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      + {formatNumberCompact(allMetrics.remainderKg)} كغم
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  الإيرادات التقديرية
                </div>
                <div
                  className="mt-1 text-lg font-bold tabular-nums"
                  style={{ color: 'var(--success)' }}
                >
                  {formatIqd(allMetrics.revenue)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Operational Pulse */}
        <div
          className="tabrix-card lg:col-span-4 flex flex-col justify-between border p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <CalendarDays
                  className="h-5 w-5"
                  style={{ color: 'var(--accent)' }}
                />
                <span>حالة التشغيل والفترة</span>
              </div>
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {activePeriod?.fullDate || 'الحصة الجارية'}
              </span>
            </div>

            <div
              className="space-y-2 border-t pt-4 text-xs"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <button
                type="button"
                onClick={onOpenMasterRoster}
                className="tabrix-btn flex w-full items-center justify-between px-3 py-2 text-right transition-colors hover:opacity-85"
                style={{ backgroundColor: 'var(--bg-main)' }}
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <ShieldAlert
                    className="h-4 w-4"
                    style={{
                      color:
                        auditIssues.length > 0
                          ? 'var(--warning)'
                          : 'var(--success)',
                    }}
                  />
                  <span>تدقيق السجلات</span>
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{
                    color:
                      auditIssues.length > 0
                        ? 'var(--warning)'
                        : 'var(--success)',
                  }}
                >
                  {auditIssues.length} ملاحظة
                </span>
              </button>

              <div
                className="flex items-center justify-between px-3 py-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>القوائم الجاهزة · علاقات المتابعة</span>
                <span className="font-bold tabular-nums">
                  {readyListsCount} · {relationsCount}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigateView('ready_lists')}
              className="tabrix-btn inline-flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ListChecks className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <span>القوائم الجاهزة</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateView('relationships')}
              className="tabrix-btn inline-flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <CalendarDays className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <span>العلاقات</span>
            </button>

            {capabilities.canUseQuickExtract && (
              <button
                type="button"
                onClick={() => onNavigateView('quick_extract')}
                className="tabrix-btn inline-flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <FileSearch className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>السحب الذكي</span>
              </button>
            )}

            {capabilities.canViewFinance && (
              <button
                type="button"
                onClick={() => onNavigateView('finance')}
                className="tabrix-btn inline-flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Wallet className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>المالية</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Active Bento Grid Row 2: Agency Distribution Bars (7 Cols) + Interactive Live Quota Calculator (5 Cols) */}
      <section
        aria-label="التوزيع النسبي والحاسبة السريعة"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch"
      >
        {/* Agency Share Distribution Bento */}
        <div
          className="tabrix-card lg:col-span-7 flex flex-col justify-between border p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold">توزيع الحصص والأفراد بين الوكالات</h2>
            </div>
            <span
              className="text-xs tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              الإجمالي {allMetrics.activeIndividuals} فرد
            </span>
          </div>

          <div className="mt-5 space-y-3.5">
            {agencyBreakdown.map(({ agency, metrics, sharePct }) => (
              <button
                key={agency.id}
                type="button"
                onClick={() => onOpenAgencyRoster(agency.id)}
                className="group block w-full text-right"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="truncate group-hover:underline">
                    {agency.name}
                  </span>
                  <span
                    className="shrink-0 tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {metrics.activeIndividuals} فرد · {metrics.fullBags} كيس ({sharePct}%)
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--bg-main)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(4, sharePct)}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Live Bento Calculator */}
        <div
          className="tabrix-card lg:col-span-5 flex flex-col justify-between border p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Calculator className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                <span>حاسبة الحصة والرسوم الفورية</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateView('settings', 'calculator')}
                className="text-xs font-bold hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                تعديل المعادلة
              </button>
            </div>

            <div
              className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <label htmlFor="bento-quick-ind" className="text-xs font-bold">
                عدد الأفراد:
              </label>
              <input
                id="bento-quick-ind"
                type="number"
                min={0}
                value={bentoCalcCount}
                onChange={(e) => setBentoCalcCount(e.target.value)}
                className="tabrix-btn w-24 border px-3 py-1.5 text-center text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            {liveBentoCalc?.alloc && (
              <div className="grid grid-cols-2 gap-4 pt-1 text-xs tabular-nums">
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>الكمية المستحقة</div>
                  <div
                    className="mt-1 text-base font-bold"
                    style={{ color: 'var(--accent)' }}
                  >
                    {liveBentoCalc.quota}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>المبلغ المستحق</div>
                  <div
                    className="mt-1 text-base font-bold"
                    style={{ color: 'var(--success)' }}
                  >
                    {formatIqd(liveBentoCalc.alloc.priceIqd)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigateView('data_archives')}
              className="tabrix-btn inline-flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <GitCompareArrows
                className="h-4 w-4"
                style={{ color: 'var(--accent)' }}
              />
              <span>المطابقة والأرشفة</span>
            </button>
          </div>
        </div>
      </section>

      {/* Bento Grid Section 3: Agency Cards Grid Layout */}
      <section
        aria-label="البطاقات الأربع للوكالات"
        data-testid="hub-four-cards"
        data-assistant-target="hub-agencies-grid"
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">بطاقات الوكالات المعتمدة</h2>
          <span
            className="text-xs tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {agencies.length} وكالة مسجلة
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 items-stretch">
          {primaryThreeAgencies.map((agency, idx) => {
            const m = computeAgencyMetrics(
              persons.filter((p) => p.agencyId === agency.id),
              expenses.filter((e) => e.agencyId === agency.id),
              calculationSettings
            );
            const cardOrderLabels = [
              'الوكالة الأولى',
              'الوكالة الثانية',
              'الوكالة الثالثة',
            ];
            return (
              <article
                key={agency.id}
                className="tabrix-card flex h-full flex-col justify-between border p-6 transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div>
                  <div
                    className="flex items-center justify-between text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span>{cardOrderLabels[idx] || `وكالة ${idx + 1}`}</span>
                    <div className="flex items-center gap-2">
                      {capabilities.canManageAgencies && onUpdateAgencyDetails && (
                        <button
                          type="button"
                          aria-label={`تعديل ${agency.name}`}
                          onClick={() => {
                            setEditingAgencyId(agency.id);
                            setEditAgencyName(agency.name);
                            setEditAgencyIcon(agency.icon);
                            setEditAgencyLogo(agency.logoDataUrl || undefined);
                            setLogoError('');
                          }}
                          className="tabrix-btn border p-1.5 hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {agency.logoDataUrl ? (
                        <img
                          src={agency.logoDataUrl}
                          alt={agency.name}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-xl border object-cover"
                          style={{ borderColor: 'var(--border-color)' }}
                        />
                      ) : (
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-xl border text-base"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                          aria-hidden="true"
                        >
                          {agency.icon}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-3 truncate text-lg font-bold">
                    {agency.name}
                  </h3>

                  <div
                    className="mt-4 grid grid-cols-2 gap-3 text-xs tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <div>
                      <div>العائلات</div>
                      <div
                        className="mt-0.5 text-base font-bold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {m.activeHouseholds}
                      </div>
                    </div>
                    <div>
                      <div>الأفراد</div>
                      <div
                        className="mt-0.5 text-base font-bold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {m.activeIndividuals}
                      </div>
                    </div>
                    <div>
                      <div>الأكياس</div>
                      <div
                        className="mt-0.5 text-sm font-bold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {m.fullBags} كيس
                        {m.remainderKg > 0
                          ? ` + ${formatNumberCompact(m.remainderKg)} كغم`
                          : ''}
                      </div>
                    </div>
                    <div>
                      <div>صافي الربح</div>
                      <div
                        className="mt-0.5 text-sm font-bold"
                        style={{ color: 'var(--success)' }}
                      >
                        {formatIqd(m.profit)}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenAgencyRoster(agency.id)}
                  className="tabrix-btn mt-6 flex w-full items-center justify-between border px-4 py-2.5 text-xs font-bold transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--accent)',
                  }}
                >
                  <span>عرض جدول الوكالة</span>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {/* Extra agencies added in Expert mode */}
      {extraAgencies.length > 0 && !capabilities.isReadOnlyPdfView && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
            وكالات إضافية ({extraAgencies.length})
          </h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {extraAgencies.map((agency) => {
              const m = computeAgencyMetrics(
                persons.filter((p) => p.agencyId === agency.id),
                expenses.filter((e) => e.agencyId === agency.id),
                calculationSettings
              );
              return (
                <button
                  key={agency.id}
                  type="button"
                  onClick={() => onOpenAgencyRoster(agency.id)}
                  className="tabrix-card flex items-center justify-between border p-6 text-right transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {agency.logoDataUrl ? (
                      <img
                        src={agency.logoDataUrl}
                        alt={agency.name}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 shrink-0 rounded-lg border object-cover"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <span className="text-lg shrink-0" aria-hidden="true">
                        {agency.icon}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-bold">{agency.name}</div>
                      <div
                        className="mt-1 text-xs tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        الأفراد: {m.activeIndividuals} · الأكياس: {m.fullBags}
                      </div>
                    </div>
                  </div>
                  <ArrowLeft
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--accent)' }}
                  />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Cosmos Major Worlds Matrix + Tag Filter + Orbital Toggle */}
      <section aria-label="أكوان وعوالم Morrow الرئيسية" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold">
              العوالم الكبرى — استوديوهات النظام ({visibleWorlds.length})
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              كل عالم معزول ومستقل بخريطته وأدواته، مع بحث يصل لأي أداة مباشرة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {effectiveCosmos.featureFlags.orbitalMapView && (
              <button
                type="button"
                onClick={() => setShowOrbitalInHub((v) => !v)}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold"
                style={
                  showOrbitalInHub
                    ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' }
                    : { backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }
                }
              >
                <Orbit className="h-4 w-4" />
                <span>{showOrbitalInHub ? 'عرض بطاقات العوالم' : 'الخريطة المدارية الحية'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Cross-World Tags Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            className="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold"
            style={
              selectedTag === null
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' }
                : { backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }
            }
          >
            الكل ({resolvedCosmosRoot.children.length - effectiveCosmos.hiddenWorldIds.length})
          </button>
          {(Object.keys(COSMOS_TAG_LABELS) as CosmosTagId[]).map((tagId) => (
            <button
              key={tagId}
              type="button"
              onClick={() => setSelectedTag((prev) => (prev === tagId ? null : tagId))}
              className="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold"
              style={
                selectedTag === tagId
                  ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' }
                  : { backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }
              }
            >
              {COSMOS_TAG_LABELS[tagId]}
            </button>
          ))}
        </div>

        {showOrbitalInHub ? (
          <OrbitalMapView
            root={resolvedCosmosRoot}
            hiddenWorldIds={effectiveCosmos.hiddenWorldIds}
            enableOrbitalMode
            onSelectNode={handleOpenCosmosNode}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleWorlds.map((world) => (
              <GalaxyCard
                key={world.id}
                node={world}
                badgeContext={hierarchyBadgeContext}
                isPinned={effectiveCosmos.pinnedNodeIds.includes(world.id)}
                onOpen={handleOpenCosmosNode}
                onTogglePin={onTogglePinnedNode}
              />
            ))}
          </div>
        )}
      </section>

      {/* Level 1 Hierarchical Pyramid Hub: Nested Level 2 & Level 3 Workspaces */}
      {hierarchyTree && hierarchyBadgeContext && onNavigateHierarchyTarget && (
        <section
          aria-label="المعمارية الهرمية المتداخلة — الوصول العميق للأدوات"
          data-testid="hub-hierarchy-matrix"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">
                الخريطة الهرمية المتداخلة — أدوات واستوديوهات Morrow
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                انقر على أي قسم رئيسي (المستوى 2) أو أداة فرعية متداخلة (المستوى 3) للانتقال الفوري
              </p>
            </div>
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              {hierarchyTree.children.length} أقسام رئيسية
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 items-stretch">
            {hierarchyTree.children.map((node) => {
              const badge = node.getBadge?.(hierarchyBadgeContext);
              return (
                <article
                  key={node.id}
                  className="tabrix-card flex flex-col justify-between border p-5 transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigateHierarchyTarget(node.target, node.id)}
                        className="text-right font-bold text-sm hover:underline"
                      >
                        {node.title}
                      </button>
                      {badge && (
                        <span
                          className="shrink-0 text-[11px] font-bold tabular-nums"
                          style={{
                            color:
                              badge.tone === 'warning'
                                ? 'var(--warning)'
                                : badge.tone === 'success'
                                ? 'var(--success)'
                                : badge.tone === 'accent'
                                ? 'var(--accent)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {node.subtitle}
                    </p>

                    {node.children.length > 0 && (
                      <div
                        className="mt-4 flex flex-wrap gap-1.5 border-t pt-3"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        {node.children.slice(0, 5).map((child) => {
                          const childBadge = child.getBadge?.(hierarchyBadgeContext);
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() =>
                                onNavigateHierarchyTarget(child.target, child.id)
                              }
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              <span>{child.title}</span>
                              {childBadge && (
                                <span
                                  className="tabular-nums opacity-75"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  · {childBadge.text}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateHierarchyTarget(node.target, node.id)}
                    className="mt-4 flex w-full items-center justify-between border-t pt-3 text-xs font-bold transition-opacity hover:opacity-80"
                    style={{
                      borderColor: 'var(--border-color)',
                      color: 'var(--accent)',
                    }}
                  >
                    <span>فتح {node.title}</span>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
};
