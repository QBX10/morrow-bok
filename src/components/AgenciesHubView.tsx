import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Calculator,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileSpreadsheet,
  GripVertical,
  HardHat,
  Layers,
  ListChecks,
  Lock,
  Package,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Unlock,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Agency,
  AgencyExpense,
  AppShapeId,
  AppView,
  CalculationSettings,
  ExpenseCategory,
  GeneralAppPrefs,
  HomeLayoutPrefs,
  HomeMiniWidgetId,
  HomeSectionId,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
  RelationEntry,
  Motion2DIntensity,
  SettingsSectionId,
  Surface2DThemeId,
  SurfaceCardDensity,
  SurfaceToneId,
  ThemePreferences,
} from '../types/agency';
import {
  auditAgencyPersons,
  calculateAllocation,
  computeAgencyMetrics,
  formatIqd,
  formatQuota,
  normalizeArabic,
} from '../utils/agencyLogic';
import { DEFAULT_HOME_LAYOUT_PREFS } from '../data/seedData';
import type { ModeCapabilities } from '../utils/modePermissions';
import { compressImageFileToDataUrl } from '../lib/imageUpload';
import { AnimatePresence, motion } from 'motion/react';
import { SmartDashboardCard } from './ui/SmartDashboardCard';
import { BottomSheet } from './cosmos/BottomSheet';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
import { ShapeSilhouetteIcon } from './ui/ShapeSilhouetteIcon';
import {
  MotionSurfaceCard,
  TabrixPillIndicator,
} from './ui/TabrixMotionPrimitives';
import { DotMatrixPattern, GeometricGoldCube } from './brand/VectorMotifs';
import { RecessedChannelWell } from './motion2d/SurfacePrimitives2D';
import { PortfolioDial2D } from './motion2d/PortfolioDial2D';
import {
  CURATED_ACCENT_SWATCHES,
  CURATED_SECONDARY_SWATCHES,
  SURFACE_2D_THEMES,
  SURFACE_TONE_PRESETS,
  mapSurfaceThemeToAppTheme,
  resolveActiveSurfacePalette,
  resolveSurface2DPrefs,
} from '../utils/surface2dConfig';
import {
  APP_SHAPES,
  resolveAppShapeId,
  resolveAutoThemeTarget,
} from '../utils/themes';
import { BrainCircuit, Download } from 'lucide-react';

interface AgenciesHubViewProps {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  relations?: RelationEntry[];
  activePeriod?: PeriodQuotaMeta;
  monthlyArchives?: MonthlyArchiveRecord[];
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  generalPrefs?: GeneralAppPrefs;
  appShape?: AppShapeId;
  onUpdateThemePrefs?: (patch: Partial<ThemePreferences>) => void;
  onUpdateGeneralPrefs?: (patch: Partial<GeneralAppPrefs>) => void;
  onUpdateActivePeriod?: (patch: Partial<PeriodQuotaMeta>) => void;
  onUpdateCalculationSettings?: (patch: Partial<CalculationSettings>) => void;
  onExportBackupFile?: () => void;
  onAddExpense?: (input: {
    agencyId: number;
    description: string;
    amountIqd: number;
    category: ExpenseCategory;
    occurredAt?: string;
    quotaLabel?: string;
  }) => void;
  onOpenMasterRoster: () => void;
  onOpenAgencyRoster: (agencyId: number) => void;
  onAddAgency: (name: string, icon: string) => void | Promise<void>;
  onUpdateAgencyDetails: (
    agencyId: number,
    patch: Partial<Pick<Agency, 'name' | 'icon' | 'logoDataUrl' | 'isLocked'>>
  ) => void;
  onTransferAgencyRecords?: (
    fromAgencyId: number,
    toAgencyId: number
  ) => void | Promise<void>;
  onDeleteAgency?: (agencyId: number) => void | Promise<void>;
  onNavigateView?: (view: AppView, settingsSection?: SettingsSectionId) => void;
}

const AGENCY_ICON_PRESETS = ['🌾', '🏪', '📦', '🏛️', '🚚', '⚖️', '🧾', '🏢'];

type AgencyFilterTab = 'all' | 'active' | 'needs_audit' | 'locked';
type AgencySortKey = 'default' | 'individuals' | 'profit' | 'households';
type ComparisonMetric = 'individuals' | 'bags' | 'profit' | 'households';

const HOME_SECTION_META: Record<
  HomeSectionId,
  { title: string; subtitle: string }
> = {
  portfolio: {
    title: 'محفظة الوكالات الموحدة',
    subtitle: 'المؤشرات التنفيذية الإجمالية لكل الوكالات',
  },
  agencies: {
    title: 'بطاقات الوكالات الفردية',
    subtitle: 'الوصول المباشر إلى جداول وحصص كل وكالة',
  },
  workspace_tools: {
    title: 'الأقسام والأدوات التشغيلية',
    subtitle: 'السجل الشامل، المصروفات والأجور، السحب الذكي، والقوائم',
  },
  radar_comparison: {
    title: 'رادار الذكاء ومقارنة الأداء',
    subtitle: 'تنبيهات التدقيق الذكي والمقارنة البيانية بين الوكالات',
  },
  mini_widgets: {
    title: 'الأقسام المصغرة الجاهزة',
    subtitle: 'حاسبة فورية، متتبع المصروفات، بحث المستفيدين، والمهام',
  },
};

const MINI_WIDGET_CATALOG: Array<{
  id: HomeMiniWidgetId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'quick_calculator',
    title: 'حاسبة الحصص السريعة',
    subtitle: 'احسب الكيلوغرامات والأكياس والمبلغ لأي عدد أفراد فوراً',
    icon: <Calculator className="h-4 w-4" />,
  },
  {
    id: 'live_expenses',
    title: 'متتبع المصروفات والأجور الفوري',
    subtitle: 'ملخص الأجور والتعبئة والضيافة مع تسجيل مصروف سريع',
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    id: 'quick_lookup',
    title: 'بحث سريع عن مستفيد',
    subtitle: 'ابحث بالاسم أو الرقم الوطني عبر جميع الوكالات وانتقل فوراً',
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: 'ocr_scanner',
    title: 'بطاقة السحب الذكي OCR',
    subtitle: 'تشغيل مباشر لمسح PDF والصور والكاميرا',
    icon: <ScanLine className="h-4 w-4" />,
  },
  {
    id: 'tasks_reminders',
    title: 'مهام وتذكيرات اليوم',
    subtitle: 'تنبيهات التوصيل والعلاقات وملاحظات التدقيق النشطة',
    icon: <Bell className="h-4 w-4" />,
  },
];

function sanitizeSectionOrder(raw?: HomeSectionId[]): HomeSectionId[] {
  const allIds = DEFAULT_HOME_LAYOUT_PREFS.sectionOrder;
  const base = Array.isArray(raw) ? raw.filter((id) => allIds.includes(id)) : [];
  const merged = [...base];
  for (const id of allIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

export const AgenciesHubView: React.FC<AgenciesHubViewProps> = ({
  agencies,
  persons,
  expenses,
  relations = [],
  activePeriod,
  monthlyArchives = [],
  calculationSettings,
  capabilities,
  generalPrefs,
  appShape,
  onUpdateThemePrefs,
  onUpdateGeneralPrefs,
  onUpdateActivePeriod,
  onUpdateCalculationSettings,
  onExportBackupFile,
  onAddExpense,
  onOpenMasterRoster,
  onOpenAgencyRoster,
  onAddAgency,
  onUpdateAgencyDetails,
  onTransferAgencyRecords,
  onDeleteAgency,
  onNavigateView,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<AgencyFilterTab>('all');
  const [sortBy, setSortBy] = useState<AgencySortKey>('default');
  const [comparisonMetric, setComparisonMetric] =
    useState<ComparisonMetric>('individuals');

  // Workspace Studio / Home Control Hub State
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [hubTab, setHubTab] = useState<'agencies' | 'layout' | 'appearance' | 'smart'>('agencies');
  const [localLayoutPrefs, setLocalLayoutPrefs] = useState<HomeLayoutPrefs>(
    DEFAULT_HOME_LAYOUT_PREFS
  );
  const [dragSectionId, setDragSectionId] = useState<HomeSectionId | null>(null);
  const [agencyDraftNames, setAgencyDraftNames] = useState<Record<number, string>>({});
  const [hubNewAgencyName, setHubNewAgencyName] = useState('');
  const [hubNewAgencyIcon, setHubNewAgencyIcon] = useState('🌾');
  const [quotaDraftName, setQuotaDraftName] = useState(activePeriod?.quotaName || 'الوجبة الحالية');
  const [kgPerIndDraft, setKgPerIndDraft] = useState(String(calculationSettings.kgPerIndividual));
  const [feePerIndDraft, setFeePerIndDraft] = useState(String(calculationSettings.feePerIndividualIqd));
  const [hubNotice, setHubNotice] = useState('');

  // Mini-Widgets Local Interactive State
  const [miniCalcIndividuals, setMiniCalcIndividuals] = useState('5');
  const [miniCalcCopied, setMiniCalcCopied] = useState(false);
  const [miniLookupQuery, setMiniLookupQuery] = useState('');
  const [miniExpAgencyId, setMiniExpAgencyId] = useState<number>(agencies[0]?.id ?? 1);
  const [quickExpTitle, setQuickExpTitle] = useState('');
  const [quickExpAmount, setQuickExpAmount] = useState('');
  const [quickExpCategory, setQuickExpCategory] =
    useState<ExpenseCategory>('worker_wages');

  // Add Agency Drawer State
  const [addOpen, setAddOpen] = useState(false);
  const [newAgencyName, setNewAgencyName] = useState('');
  const [newAgencyIcon, setNewAgencyIcon] = useState('🏢');

  // Edit Agency Inline State
  const [editingAgencyId, setEditingAgencyId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('🌾');
  const [transferTargetMap, setTransferTargetMap] = useState<Record<number, number>>({});
  const [confirmDeleteAgencyId, setConfirmDeleteAgencyId] = useState<number | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const surfacePrefs = useMemo(
    () => resolveSurface2DPrefs(generalPrefs?.surface2dPrefs),
    [generalPrefs?.surface2dPrefs]
  );

  const activeSurfacePalette = useMemo(
    () => resolveActiveSurfacePalette(surfacePrefs),
    [surfacePrefs]
  );

  const updateSurfacePrefs = (patch: Partial<typeof surfacePrefs>) => {
    const next = { ...surfacePrefs, ...patch };
    onUpdateGeneralPrefs?.({ surface2dPrefs: next });
  };

  const layoutPrefs: HomeLayoutPrefs = useMemo(() => {
    const src = generalPrefs?.homeLayoutPrefs || localLayoutPrefs;
    return {
      sectionOrder: sanitizeSectionOrder(src.sectionOrder),
      hiddenSections: Array.isArray(src.hiddenSections) ? src.hiddenSections : [],
      activeMiniWidgets: Array.isArray(src.activeMiniWidgets)
        ? src.activeMiniWidgets
        : [],
    };
  }, [generalPrefs?.homeLayoutPrefs, localLayoutPrefs]);

  const commitLayoutPrefs = (next: HomeLayoutPrefs) => {
    setLocalLayoutPrefs(next);
    if (onUpdateGeneralPrefs) {
      onUpdateGeneralPrefs({ homeLayoutPrefs: next });
    }
  };

  const moveSectionOrder = (sectionId: HomeSectionId, direction: 'up' | 'down') => {
    const order = [...layoutPrefs.sectionOrder];
    const idx = order.indexOf(sectionId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= order.length) return;
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    commitLayoutPrefs({ ...layoutPrefs, sectionOrder: order });
  };

  const reorderSectionDrag = (fromId: HomeSectionId, toId: HomeSectionId) => {
    if (fromId === toId) return;
    const order = [...layoutPrefs.sectionOrder];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);
    commitLayoutPrefs({ ...layoutPrefs, sectionOrder: order });
  };

  const toggleSectionVisibility = (sectionId: HomeSectionId) => {
    const hidden = new Set(layoutPrefs.hiddenSections);
    if (hidden.has(sectionId)) {
      hidden.delete(sectionId);
    } else {
      hidden.add(sectionId);
    }
    commitLayoutPrefs({ ...layoutPrefs, hiddenSections: Array.from(hidden) });
  };

  const toggleMiniWidget = (widgetId: HomeMiniWidgetId) => {
    const active = new Set(layoutPrefs.activeMiniWidgets);
    if (active.has(widgetId)) {
      active.delete(widgetId);
    } else {
      active.add(widgetId);
    }
    const nextHidden = new Set(layoutPrefs.hiddenSections);
    if (active.size > 0) {
      nextHidden.delete('mini_widgets');
    }
    commitLayoutPrefs({
      ...layoutPrefs,
      activeMiniWidgets: Array.from(active),
      hiddenSections: Array.from(nextHidden),
    });
  };

  const resetHomeLayout = () => {
    commitLayoutPrefs({
      sectionOrder: [...DEFAULT_HOME_LAYOUT_PREFS.sectionOrder],
      hiddenSections: [],
      activeMiniWidgets: [],
    });
  };

  const masterMetrics = useMemo(
    () => computeAgencyMetrics(persons, expenses, calculationSettings),
    [persons, expenses, calculationSettings]
  );

  const masterBlockBreakdown = useMemo(() => {
    let fullyBlockedCount = 0;
    let partialBlockedCount = 0;
    for (const p of persons) {
      if (p.status === 'مؤرشف' || p.blockType === 'archived') continue;
      if (p.status === 'محجوب' || p.blockType === 'full') {
        fullyBlockedCount += 1;
      } else if (p.blockType === 'partial' && (p.blockedIndividuals ?? 0) > 0) {
        partialBlockedCount += 1;
      }
    }
    return { fullyBlockedCount, partialBlockedCount };
  }, [persons]);

  const agencyRows = useMemo(() => {
    return agencies.map((ag) => {
      const agPersons = persons.filter((p) => p.agencyId === ag.id);
      const agExpenses = expenses.filter((e) => e.agencyId === ag.id);
      const metrics = computeAgencyMetrics(
        agPersons,
        agExpenses,
        calculationSettings
      );
      const audits = auditAgencyPersons(agPersons);
      const missingIdCount = agPersons.filter(
        (p) => !p.nationalId || !p.nationalId.trim()
      ).length;
      const sharePct =
        masterMetrics.activeIndividuals > 0
          ? Math.round(
              (metrics.activeIndividuals / masterMetrics.activeIndividuals) * 100
            )
          : 0;
      const fullyBlocked = agPersons.filter(
        (p) => p.status === 'محجوب' || p.blockType === 'full'
      ).length;
      const partialBlocked = agPersons.filter(
        (p) => p.blockType === 'partial' && (p.blockedIndividuals ?? 0) > 0
      ).length;
      const totalBlockedRecords = fullyBlocked + partialBlocked;
      const blockRatioPct =
        metrics.registeredHouseholds > 0
          ? Math.round((totalBlockedRecords / metrics.registeredHouseholds) * 100)
          : 0;

      return {
        agency: ag,
        metrics,
        audits,
        missingIdCount,
        sharePct,
        totalBlockedRecords,
        blockRatioPct,
        hasIssues: audits.length > 0 || missingIdCount > 0 || metrics.profit < 0,
      };
    });
  }, [
    agencies,
    persons,
    expenses,
    calculationSettings,
    masterMetrics.activeIndividuals,
  ]);

  const smartAgencySignals = useMemo(() => {
    const signals: Array<{
      id: string;
      agencyId: number;
      agencyName: string;
      agencyIcon: string;
      severity: 'warning' | 'danger' | 'info';
      title: string;
      detail: string;
    }> = [];

    for (const row of agencyRows) {
      if (row.audits.length > 0) {
        signals.push({
          id: `audit-${row.agency.id}`,
          agencyId: row.agency.id,
          agencyName: row.agency.name,
          agencyIcon: row.agency.icon,
          severity: 'warning',
          title: `${row.audits.length} ملاحظة تدقيق في ${row.agency.name}`,
          detail: 'أسماء متكررة أو قيود بحاجة لمراجعة عدد الأفراد.',
        });
      }
      if (row.missingIdCount > 0) {
        signals.push({
          id: `nid-${row.agency.id}`,
          agencyId: row.agency.id,
          agencyName: row.agency.name,
          agencyIcon: row.agency.icon,
          severity: 'info',
          title: `${row.missingIdCount} بطاقة بدون رقم وطني في ${row.agency.name}`,
          detail: 'استكمال الأرقام الوطنية يرفع دقة المطابقة والتقارير.',
        });
      }
      if (row.metrics.profit < 0) {
        signals.push({
          id: `margin-${row.agency.id}`,
          agencyId: row.agency.id,
          agencyName: row.agency.name,
          agencyIcon: row.agency.icon,
          severity: 'danger',
          title: `عجز صافي في ${row.agency.name}`,
          detail: `المصروفات تفوق الإيراد التقديري بمقدار ${formatIqd(
            Math.abs(row.metrics.profit)
          )}.`,
        });
      }
      if (row.blockRatioPct >= 30 && row.metrics.registeredHouseholds > 0) {
        signals.push({
          id: `block-${row.agency.id}`,
          agencyId: row.agency.id,
          agencyName: row.agency.name,
          agencyIcon: row.agency.icon,
          severity: 'warning',
          title: `نسبة حظر مرتفعة (${row.blockRatioPct}%) في ${row.agency.name}`,
          detail: `${row.totalBlockedRecords} سجل محجوب أو مقلص من أصل ${row.metrics.registeredHouseholds}.`,
        });
      }
    }

    return signals.slice(0, 5);
  }, [agencyRows]);

  const previousArchiveDelta = useMemo(() => {
    const latest = monthlyArchives[0];
    if (!latest?.summary) return null;
    const prevInd = latest.summary.totalIndividuals;
    const diff = masterMetrics.activeIndividuals - prevInd;
    return {
      archiveLabel: latest.label,
      diff,
    };
  }, [monthlyArchives, masterMetrics.activeIndividuals]);

  const filteredAgencies = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    const list = agencyRows.filter((row) => {
      if (q && !normalizeArabic(row.agency.name).includes(q)) return false;
      if (filterTab === 'active' && row.agency.isLocked) return false;
      if (filterTab === 'locked' && !row.agency.isLocked) return false;
      if (filterTab === 'needs_audit' && !row.hasIssues) return false;
      return true;
    });

    if (sortBy === 'individuals') {
      return [...list].sort(
        (a, b) => b.metrics.activeIndividuals - a.metrics.activeIndividuals
      );
    }
    if (sortBy === 'profit') {
      return [...list].sort((a, b) => b.metrics.profit - a.metrics.profit);
    }
    if (sortBy === 'households') {
      return [...list].sort(
        (a, b) => b.metrics.activeHouseholds - a.metrics.activeHouseholds
      );
    }
    return list;
  }, [agencyRows, searchQuery, filterTab, sortBy]);

  const comparisonBars = useMemo(() => {
    const mapped = agencyRows.map((row) => {
      const value =
        comparisonMetric === 'individuals'
          ? row.metrics.activeIndividuals
          : comparisonMetric === 'bags'
          ? row.metrics.fullBags
          : comparisonMetric === 'profit'
          ? Math.max(0, row.metrics.profit)
          : row.metrics.activeHouseholds;
      const formatted =
        comparisonMetric === 'individuals'
          ? `${row.metrics.activeIndividuals.toLocaleString('en-US')} فرد`
          : comparisonMetric === 'bags'
          ? `${row.metrics.fullBags.toLocaleString('en-US')} كيس`
          : comparisonMetric === 'profit'
          ? formatIqd(row.metrics.profit)
          : `${row.metrics.activeHouseholds.toLocaleString('en-US')} عائلة`;
      return {
        agency: row.agency,
        value,
        formatted,
      };
    });

    const maxVal = Math.max(1, ...mapped.map((m) => m.value));
    return mapped
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        ...item,
        widthPct: Math.max(6, Math.round((item.value / maxVal) * 100)),
      }));
  }, [agencyRows, comparisonMetric]);

  const miniCalcPreview = useMemo(() => {
    const n = Math.max(0, Math.min(99999, Number(miniCalcIndividuals) || 0));
    return {
      n,
      alloc: calculateAllocation(n, calculationSettings),
      quota: formatQuota(n, undefined, calculationSettings),
    };
  }, [miniCalcIndividuals, calculationSettings]);

  const miniLookupMatches = useMemo(() => {
    const q = normalizeArabic(miniLookupQuery);
    if (!q) return [];
    const agencyNameMap = new Map(agencies.map((a) => [a.id, a.name]));
    return persons
      .filter(
        (p) =>
          normalizeArabic(p.name).includes(q) ||
          (p.nationalId && p.nationalId.includes(miniLookupQuery.trim()))
      )
      .slice(0, 5)
      .map((p) => ({
        person: p,
        agencyName: agencyNameMap.get(p.agencyId) || 'وكالة',
      }));
  }, [miniLookupQuery, persons, agencies]);

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAgencyName.trim();
    if (!clean) return;
    const nextId = agencies.reduce((m, a) => Math.max(m, a.id), 0) + 1;
    setAddOpen(false);
    await onAddAgency(clean, newAgencyIcon || '🏢');
    setNewAgencyName('');
    setNewAgencyIcon('🏢');
    onOpenAgencyRoster(nextId);
  };

  const handleLogoUpload = async (
    agencyId: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const uploadedUrl = await compressImageFileToDataUrl(file);
      onUpdateAgencyDetails(agencyId, { icon: uploadedUrl });
      setEditIcon(uploadedUrl);
    } catch {
      // Fallback safely ignored
    }
  };

  const isUrlOrDataUri = (val: string) =>
    val.startsWith('http') || val.startsWith('data:') || val.startsWith('/');

  const renderAgencyAvatar = (icon: string, size: 'md' | 'lg' = 'md') => {
    const dim = size === 'lg' ? 'h-12 w-12 text-2xl' : 'h-10 w-10 text-xl';
    if (isUrlOrDataUri(icon)) {
      return (
        <img
          src={icon}
          alt="شعار الوكالة"
          className={`${dim} rounded-xl border object-cover shrink-0`}
          style={{ borderColor: 'var(--border-color)' }}
        />
      );
    }
    return (
      <span
        className={`${dim} flex shrink-0 items-center justify-center rounded-xl border`}
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
        }}
      >
        {icon || '🌾'}
      </span>
    );
  };

  const renderPortfolioSection = () => (
    <section
      key="portfolio"
      aria-label="الملخص العام للوكالات"
      className="nexus-squircle p-5 sm:p-6"
    >
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-2 pb-3 border-b"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2.5">
          <NexusDuotoneIcon sizeClass="h-9 w-9">
            <Building2 className="h-4 w-4" />
          </NexusDuotoneIcon>
          <h2 className="text-sm sm:text-base font-black">
            محفظة الوكالات الموحدة ({agencies.length} وكالة)
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenMasterRoster}
          className="nexus-pill-btn inline-flex items-center gap-1.5 border px-3.5 py-1.5 text-xs font-extrabold"
          style={{
            backgroundColor: 'var(--bg-nav-active)',
            borderColor: 'color-mix(in srgb, var(--accent) 36%, var(--border-color))',
            color: 'var(--accent)',
          }}
        >
          <span>استعراض كافة السجلات</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MotionSurfaceCard className="p-4">
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-semibold">العائلات النشطة</span>
            <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums">
            {masterMetrics.activeHouseholds.toLocaleString('en-US')}
          </div>
          <div
            className="mt-1 text-[11px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            من أصل {masterMetrics.registeredHouseholds.toLocaleString('en-US')} سجل مسجل
          </div>
        </MotionSurfaceCard>

        <MotionSurfaceCard className="p-4">
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-semibold">الأفراد المشمولون</span>
            <Activity className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div
            className="mt-2 text-2xl font-black tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {masterMetrics.activeIndividuals.toLocaleString('en-US')}
          </div>
          <div
            className="mt-1 text-[11px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {masterBlockBreakdown.fullyBlockedCount} محجوب كلياً ·{' '}
            {masterBlockBreakdown.partialBlockedCount} جزئياً
          </div>
        </MotionSurfaceCard>

        <MotionSurfaceCard className="p-4">
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-semibold">حصة الطحين التقديرية</span>
            <Package className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums">
            {masterMetrics.fullBags.toLocaleString('en-US')}{' '}
            <span className="text-xs font-bold">كيس</span>
            {masterMetrics.remainderKg > 0 && (
              <span className="text-sm font-extrabold mr-1.5">
                + {masterMetrics.remainderKg} كغم
              </span>
            )}
          </div>
          <div
            className="mt-1 text-[11px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            الوزن الصافي: {masterMetrics.totalKg.toLocaleString('en-US')} كغم
          </div>
        </MotionSurfaceCard>

        <MotionSurfaceCard className="p-4">
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-semibold">صافي الربح التقديري</span>
            <Wallet className="h-4 w-4" style={{ color: 'var(--success)' }} />
          </div>
          <div
            className="mt-2 text-2xl font-black tabular-nums"
            style={{
              color:
                masterMetrics.profit >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {formatIqd(masterMetrics.profit)}
          </div>
          <div
            className="mt-1 text-[11px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            الإيراد {formatIqd(masterMetrics.revenue)} · المصاريف{' '}
            {formatIqd(masterMetrics.totalExpenses)}
          </div>
        </MotionSurfaceCard>
      </div>

      <RecessedChannelWell className="mt-4 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <span className="font-bold text-[var(--text-muted)]">
          معادلة الوجبة النشطة:{' '}
          <strong className="font-mono-num text-[var(--text-primary)]">
            {calculationSettings.kgPerIndividual} كغم/فرد · {calculationSettings.feePerIndividualIqd} د.ع/فرد
          </strong>
        </span>
        {onNavigateView && (
          <button
            type="button"
            data-testid="portfolio-smart-models-link"
            onClick={() => onNavigateView('smart_models')}
            className="inline-flex items-center gap-1.5 font-extrabold text-[var(--accent-bright)] hover:underline cursor-pointer"
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>تحليل المحفظة في النماذج الذكية</span>
          </button>
        )}
      </RecessedChannelWell>
    </section>
  );

  const renderAgenciesSection = () => (
    <section key="agencies" className="space-y-4">
      <div className="nexus-squircle flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
          <div
            className="flex items-center gap-2 rounded-full border px-3.5 h-10 flex-1 max-w-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <Search
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الوكالة..."
              className="w-full bg-transparent text-xs outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', `الكل (${agencyRows.length})`],
                [
                  'active',
                  `نشطة (${agencyRows.filter((r) => !r.agency.isLocked).length})`,
                ],
                [
                  'needs_audit',
                  `تحتاج انتباه (${agencyRows.filter((r) => r.hasIssues).length})`,
                ],
                [
                  'locked',
                  `مقفلة (${agencyRows.filter((r) => r.agency.isLocked).length})`,
                ],
              ] as Array<[AgencyFilterTab, string]>
            ).map(([tabId, label]) => {
              const isSelected = filterTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setFilterTab(tabId)}
                  className="nexus-pill-btn relative min-h-[36px] border px-3.5 py-1 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: isSelected ? 'transparent' : 'var(--bg-main)',
                    borderColor: isSelected ? 'transparent' : 'var(--border-color)',
                    color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {isSelected && (
                    <TabrixPillIndicator
                      layoutId="agencies-filter-pill"
                      className="rounded-full"
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as AgencySortKey)}
            aria-label="ترتيب الوكالات"
            className="min-h-[38px] rounded-full border px-3.5 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <option value="default">الترتيب الافتراضي</option>
            <option value="individuals">الأكثر أفراداً</option>
            <option value="profit">الأعلى صافي ربح</option>
            <option value="households">الأكثر عوائل</option>
          </select>
        </div>
      </div>

      {/* Hidden image uploader for agency avatar */}
      <input
        ref={logoFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (editingAgencyId !== null) {
            void handleLogoUpload(editingAgencyId, e);
          }
        }}
      />

      {agencies.length === 0 ? (
        <div className="chamfered-glass-card smoked-glass-elevated p-6 sm:p-7 text-center space-y-4 relative overflow-hidden">
          <div className="pointer-events-none absolute top-0 left-0 w-36 h-36 opacity-20">
            <DotMatrixPattern />
          </div>
          <div className="relative z-10 mx-auto w-16 h-16 flex items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)]">
            <GeometricGoldCube size={52} />
          </div>
          <div className="relative z-10 space-y-2 max-w-md mx-auto">
            <h3 className="font-display-ar text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              محفظة الوكالات جاهزة للانطلاق
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-muted)]">
              افتح «إدارة الواجهة الرئيسية» لإعداد وإطلاق وكالتك من مكان واحد.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="empty-open-hub-customizer-btn"
              onClick={() => {
                setHubNotice('');
                setHubTab('agencies');
                setCustomizerOpen(true);
              }}
              className="obsidian-gold-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>فتح إدارة الواجهة الرئيسية</span>
            </button>
          </div>
        </div>
      ) : filteredAgencies.length === 0 ? (
        <div
          className="nexus-squircle p-10 text-center text-xs"
          style={{
            color: 'var(--text-muted)',
          }}
        >
          لا توجد وكالات مطابقة لخيار البحث أو التصفية الحالي.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredAgencies.map((row) => {
            const { agency, metrics, audits, missingIdCount, sharePct } = row;
            const isEditing = editingAgencyId === agency.id;
            const issuesTotal = audits.length + missingIdCount;

            return (
              <MotionSurfaceCard
                as="article"
                key={agency.id}
                disabled={isEditing}
                className="flex flex-col justify-between p-5 sm:p-6"
                style={{
                  borderColor: isEditing ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isEditing ? (
                    <motion.div
                      key="editing"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-4"
                    >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">
                        تعديل بيانات الوكالة
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingAgencyId(null)}
                        className="rounded-lg p-1 hover:bg-[var(--bg-main)]"
                        aria-label="إغلاق التعديل"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold">
                        اسم الوكالة
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="min-h-[40px] w-full rounded-xl border px-3 text-xs font-bold"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
                        <span>الشعار أو الرمز</span>
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1 font-bold"
                          style={{ color: 'var(--accent)' }}
                        >
                          <Upload className="h-3 w-3" />
                          <span>رفع صورة</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {AGENCY_ICON_PRESETS.map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setEditIcon(ic)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border text-base"
                            style={{
                              backgroundColor:
                                editIcon === ic
                                  ? 'var(--bg-nav-active)'
                                  : 'var(--bg-main)',
                              borderColor:
                                editIcon === ic
                                  ? 'var(--accent)'
                                  : 'var(--border-color)',
                            }}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (editName.trim()) {
                            onUpdateAgencyDetails(agency.id, {
                              name: editName.trim(),
                              icon: editIcon,
                            });
                          }
                          setEditingAgencyId(null);
                        }}
                        className="nexus-pill-btn flex-1 min-h-[40px] text-xs font-extrabold"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-fg)',
                        }}
                      >
                        حفظ التغييرات
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAgencyId(null)}
                        className="nexus-pill-btn min-h-[40px] border px-4 text-xs font-bold"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="flex flex-1 flex-col justify-between"
                  >
                    {/* Card Header */}
                    <div
                      className="flex items-start justify-between gap-2 pb-4 border-b"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {renderAgencyAvatar(agency.icon, 'lg')}
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold">
                            {agency.name}
                          </h3>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                            <span
                              className="inline-flex items-center gap-1 font-bold"
                              style={{
                                color: agency.isLocked
                                  ? 'var(--warning)'
                                  : 'var(--success)',
                              }}
                            >
                              {agency.isLocked ? (
                                <Lock className="h-3 w-3" />
                              ) : (
                                <Unlock className="h-3 w-3" />
                              )}
                              <span>{agency.isLocked ? 'مقفلة' : 'نشطة'}</span>
                            </span>
                            <span style={{ color: 'var(--border-color)' }}>•</span>
                            <span
                              className="tabular-nums font-semibold"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {sharePct}% من الإجمالي
                            </span>
                          </div>
                        </div>
                      </div>

                      {capabilities.canManageAgencies && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAgencyDetails(agency.id, {
                                isLocked: !agency.isLocked,
                              })
                            }
                            title={agency.isLocked ? 'فتح الوكالة' : 'قفل الوكالة'}
                            aria-label={agency.isLocked ? 'فتح الوكالة' : 'قفل الوكالة'}
                            className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                              color: agency.isLocked
                                ? 'var(--warning)'
                                : 'var(--text-muted)',
                            }}
                          >
                            {agency.isLocked ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAgencyId(agency.id);
                              setEditName(agency.name);
                              setEditIcon(agency.icon);
                            }}
                            title="تعديل الوكالة"
                            aria-label="تعديل الوكالة"
                            className="nexus-pill-btn inline-flex h-8 w-8 items-center justify-center border"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Metrics 2x2 */}
                    <div className="grid grid-cols-2 gap-2.5 py-4">
                      <div className="metric-well p-3">
                        <div
                          className="text-[11px] font-medium"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          العائلات النشطة
                        </div>
                        <div className="mt-1 text-base font-black tabular-nums">
                          {metrics.activeHouseholds.toLocaleString('en-US')}
                        </div>
                      </div>

                      <div className="metric-well p-3">
                        <div
                          className="text-[11px] font-medium"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          الأفراد
                        </div>
                        <div
                          className="mt-1 text-base font-black tabular-nums"
                          style={{ color: 'var(--accent)' }}
                        >
                          {metrics.activeIndividuals.toLocaleString('en-US')}
                        </div>
                      </div>

                      <div className="metric-well p-3">
                        <div
                          className="text-[11px] font-medium"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          الأكياس المطلوبة
                        </div>
                        <div className="mt-1 text-sm font-black tabular-nums">
                          {metrics.fullBags.toLocaleString('en-US')} كيس
                          {metrics.remainderKg > 0 && ` + ${metrics.remainderKg}ك`}
                        </div>
                      </div>

                      <div className="metric-well p-3">
                        <div
                          className="text-[11px] font-medium"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          صافي الربح
                        </div>
                        <div
                          className="mt-1 text-sm font-black tabular-nums"
                          style={{
                            color:
                              metrics.profit >= 0
                                ? 'var(--success)'
                                : 'var(--danger)',
                          }}
                        >
                          {formatIqd(metrics.profit)}
                        </div>
                      </div>
                    </div>

                    {/* Share & Audit Footer with Glowing Amber Gold Progress Bar */}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                issuesTotal > 0 ? 'var(--warning)' : 'var(--success)',
                            }}
                          >
                            {issuesTotal > 0
                              ? `${issuesTotal} ملاحظة تحتاج مراجعة`
                              : 'سجل مطابق ومنظم'}
                          </span>
                          <span
                            className="font-bold tabular-nums"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {metrics.registeredHouseholds} سجل · {sharePct}%
                          </span>
                        </div>
                        <div className="nexus-progress-track h-2 w-full">
                          <div
                            className="nexus-progress-glow h-full"
                            style={{
                              width: `${Math.max(4, sharePct)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenAgencyRoster(agency.id)}
                        className="nexus-pill-btn inline-flex min-h-[42px] w-full items-center justify-center gap-2 border px-4 py-2 text-xs font-extrabold whitespace-nowrap hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Table2 className="h-4 w-4" />
                        <span>عرض جدول الوكالة</span>
                      </button>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </MotionSurfaceCard>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderWorkspaceToolsSection = () => {
    if (!onNavigateView) return null;
    return (
      <section
        key="workspace_tools"
        className="space-y-3"
        aria-label="بوابات مساحة العمل الذكية"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold">
            الأقسام التشغيلية وبوابات مساحة العمل
          </h2>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            مرتبة حسب الأولوية اليومية — انتقال فوري إلى كل شاشة مستقلة
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SmartDashboardCard
            testId="dashboard-card-master-roster"
            title="السجل الشامل للوكالات"
            subtitle="جدول موحد لجميع المستفيدين مع تدقيق ذكي وتصدير احترافي."
            metaText={`${masterMetrics.registeredHouseholds.toLocaleString('en-US')} سجل · ${agencies.length} وكالة`}
            icon={<Table2 className="h-5 w-5" />}
            actionLabel="فتح السجل الشامل"
            onOpen={onOpenMasterRoster}
            subIcons={[
              {
                id: 'portal-master',
                label: 'السجل',
                hint: 'فتح الجدول الشامل لجميع الوكالات',
                icon: <Table2 className="h-4 w-4" />,
                onClick: onOpenMasterRoster,
              },
              {
                id: 'portal-audit',
                label: 'التدقيق',
                hint: 'مراجعة التكرار والأرقام الناقصة داخل الجدول',
                icon: <Activity className="h-4 w-4" />,
                onClick: onOpenMasterRoster,
              },
              {
                id: 'portal-cols',
                label: 'الأعمدة',
                hint: 'تخصيص الأعمدة والترتيب المتقدم',
                icon: <FileSpreadsheet className="h-4 w-4" />,
                onClick: () => onNavigateView('settings', 'modes'),
              },
              {
                id: 'portal-archives',
                label: 'الأرشيف',
                hint: 'استعراض الأرشيفات الشهرية المحفوظة',
                icon: <Archive className="h-4 w-4" />,
                onClick: () => onNavigateView('data_archives'),
              },
            ]}
          />

          {capabilities.canViewFinance && (
            <SmartDashboardCard
              testId="dashboard-card-finance"
              title="المصروفات وأجور العمال"
              subtitle="أجور العمال، التعبئة (علاليك وكواني)، الضيافة، والمصروفات الخاصة."
              metaText={`صافي الربح: ${formatIqd(masterMetrics.profit)}`}
              icon={<HardHat className="h-5 w-5" />}
              accentTone={masterMetrics.profit >= 0 ? 'emerald' : 'crimson'}
              actionLabel="فتح المالية والأجور"
              onOpen={() => onNavigateView('finance')}
              subIcons={[
                {
                  id: 'portal-wages',
                  label: 'الأجور',
                  hint: 'تسجيل وإدارة أجور العمال اليومية ولكل حصة',
                  icon: <HardHat className="h-4 w-4" />,
                  onClick: () => onNavigateView('finance'),
                },
                {
                  id: 'portal-fin',
                  label: 'الأرباح',
                  hint: 'تحليل الإيرادات والمصروفات وصافي الربح',
                  icon: <Wallet className="h-4 w-4" />,
                  onClick: () => onNavigateView('finance'),
                },
                {
                  id: 'portal-calc',
                  label: 'الحاسبة',
                  hint: 'إعدادات أوزان الأفراد ورسم 250 د.ع',
                  icon: <Calculator className="h-4 w-4" />,
                  onClick: () => onNavigateView('settings', 'calculator'),
                },
                {
                  id: 'portal-gcal',
                  label: 'التقويم',
                  hint: 'مواعيد التوزيع ومهام Google Workspace',
                  icon: <Calendar className="h-4 w-4" />,
                  onClick: () => onNavigateView('google_workspace'),
                },
              ]}
            />
          )}

          {capabilities.canUseQuickExtract && (
            <SmartDashboardCard
              testId="dashboard-card-quick-extract"
              title="السحب الذكي"
              subtitle="تفريغ الكشوفات من PDF والصور والكاميرا بدقة عالية."
              metaText="PDF · صور · كاميرا"
              icon={<ScanLine className="h-5 w-5" />}
              actionLabel="فتح السحب الذكي"
              onOpen={() => onNavigateView('quick_extract')}
              subIcons={[
                {
                  id: 'portal-ocr',
                  label: 'PDF',
                  hint: 'سحب الجداول من ملفات PDF والمستندات',
                  icon: <ScanLine className="h-4 w-4" />,
                  onClick: () => onNavigateView('quick_extract'),
                },
                {
                  id: 'portal-cam',
                  label: 'الكاميرا',
                  hint: 'التقاط دفاتر التوزيع مباشرة وتحليلها',
                  icon: <Camera className="h-4 w-4" />,
                  onClick: () => onNavigateView('quick_extract'),
                },
                {
                  id: 'portal-ocr-set',
                  label: 'المطابقة',
                  hint: 'قواعد التدقيق والعتبة الآمنة للسحب الذكي',
                  icon: <Sparkles className="h-4 w-4" />,
                  onClick: () => onNavigateView('settings', 'quick_extract_settings'),
                },
                {
                  id: 'portal-morrow',
                  label: 'Morrow',
                  hint: 'تشغيل مركز قيادة الذكاء الاصطناعي Morrow',
                  icon: <Bot className="h-4 w-4" />,
                  onClick: () => onNavigateView('morrow_center'),
                },
              ]}
            />
          )}

          <SmartDashboardCard
            testId="dashboard-card-lists-settings"
            title="القوائم والعلاقات والإعدادات"
            subtitle="القوائم الجاهزة، متابعة التوصيل، الأرشفة الشهرية، والسبج والذهب."
            metaText={`${monthlyArchives.length} أرشيف · ${relations.length} متابعة`}
            icon={<ListChecks className="h-5 w-5" />}
            actionLabel="فتح القوائم الجاهزة"
            onOpen={() => onNavigateView('ready_lists')}
            subIcons={[
              {
                id: 'portal-lists',
                label: 'القوائم',
                hint: 'إدارة القوائم الجاهزة للتوصيل والتصدير',
                icon: <ListChecks className="h-4 w-4" />,
                onClick: () => onNavigateView('ready_lists'),
              },
              {
                id: 'portal-rel',
                label: 'العلاقات',
                hint: 'متابعة التوصيل والديون والتذكيرات',
                icon: <Share2 className="h-4 w-4" />,
                onClick: () => onNavigateView('relationships'),
              },
              {
                id: 'portal-theme',
                label: 'الجداول والخطوط',
                hint: 'الألوان، تصاميم الجداول والخطوط العربية',
                icon: <Palette className="h-4 w-4" />,
                onClick: () => onNavigateView('settings', 'appearance'),
              },
              {
                id: 'portal-sec',
                label: 'الأمان',
                hint: 'قفل الخصوصية، النسخ الاحتياطي، والصلاحيات',
                icon: <Shield className="h-4 w-4" />,
                onClick: () => onNavigateView('settings', 'security_data'),
              },
            ]}
          />
        </div>
      </section>
    );
  };

  const renderRadarComparisonSection = () => (
    <section
      key="radar_comparison"
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      {/* Left: Agency Smart Audit & Alerts Radar */}
      <div className="nexus-squircle lg:col-span-5 p-5 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NexusDuotoneIcon sizeClass="h-8 w-8">
                <Sparkles className="h-4 w-4" />
              </NexusDuotoneIcon>
              <h2 className="text-sm font-extrabold">رادار ذكاء الوكالات</h2>
            </div>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{
                color:
                  smartAgencySignals.length > 0 ? 'var(--warning)' : 'var(--success)',
              }}
            >
              {smartAgencySignals.length > 0
                ? `${smartAgencySignals.length} تنبيه ذكي`
                : 'سليم 100%'}
            </span>
          </div>

          {smartAgencySignals.length === 0 ? (
            <div
              className="flex items-center gap-3 rounded-2xl border p-4 text-xs"
              style={{
                backgroundColor: 'var(--success-bg)',
                borderColor:
                  'color-mix(in srgb, var(--success) 35%, var(--border-color))',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <div className="font-extrabold">كافة سجلات الوكالات متوازنة وسليمة</div>
                <div className="mt-0.5 opacity-90">
                  لا توجد أسماء مكررة أو أرقام وطنية مفقودة أو عجز مالي في الوكالات.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {smartAgencySignals.map((sig) => {
                const accent =
                  sig.severity === 'danger'
                    ? 'var(--danger)'
                    : sig.severity === 'warning'
                    ? 'var(--warning)'
                    : 'var(--accent)';
                return (
                  <button
                    key={sig.id}
                    type="button"
                    onClick={() => onOpenAgencyRoster(sig.agencyId)}
                    className="nexus-squircle-interactive flex w-full items-start justify-between gap-3 rounded-2xl border p-3 text-right"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: accent }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold">
                          {sig.title}
                        </div>
                        <div
                          className="mt-0.5 text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {sig.detail}
                        </div>
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[11px] font-bold whitespace-nowrap"
                      style={{ color: 'var(--accent)' }}
                    >
                      فحص
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t pt-3 text-[11px]"
          style={{
            borderColor: 'var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <span>يتم فحص التطابق والأرصدة تلقائياً من السجلات الحية</span>
          <span className="font-bold tabular-nums">
            {calculationSettings.kgPerIndividual} كغم ·{' '}
            {calculationSettings.feePerIndividualIqd} د.ع
          </span>
        </div>
      </div>

      {/* Right: Interactive Portfolio Comparison Chart */}
      <div className="nexus-squircle lg:col-span-7 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NexusDuotoneIcon sizeClass="h-8 w-8">
              <BarChart3 className="h-4 w-4" />
            </NexusDuotoneIcon>
            <h2 className="text-sm font-extrabold">مقارنة أداء الوكالات</h2>
          </div>

          <div
            className="inline-flex rounded-full border p-1 text-[11px] font-bold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            {(
              [
                ['individuals', 'الأفراد'],
                ['bags', 'الأكياس'],
                ['profit', 'صافي الربح'],
                ['households', 'العوائل'],
              ] as Array<[ComparisonMetric, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setComparisonMetric(key)}
                className="nexus-pill-btn px-3 py-1 whitespace-nowrap"
                style={{
                  backgroundColor:
                    comparisonMetric === key ? 'var(--bg-surface)' : 'transparent',
                  color:
                    comparisonMetric === key ? 'var(--accent)' : 'var(--text-muted)',
                  boxShadow:
                    comparisonMetric === key ? 'var(--card-shadow)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {comparisonBars.length === 0 ? (
            <div
              className="rounded-xl border border-dashed px-4 py-6 text-center text-xs font-semibold"
              style={{
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              لا توجد وكالات للمقارنة بعد — افتح إدارة الواجهة الرئيسية لإضافة وكالة وعرض مؤشرات الأداء.
            </div>
          ) : (
            comparisonBars.map((bar) => (
              <button
                key={bar.agency.id}
                type="button"
                onClick={() => onOpenAgencyRoster(bar.agency.id)}
                className="group block w-full text-right"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-bold group-hover:text-[var(--accent)] transition-colors">
                    <span>{bar.agency.icon}</span>
                    <span>{bar.agency.name}</span>
                  </span>
                  <span className="font-extrabold tabular-nums">{bar.formatted}</span>
                </div>
                <div className="nexus-progress-track h-2.5 w-full">
                  <div
                    className="nexus-progress-glow h-full"
                    style={{
                      width: `${bar.widthPct}%`,
                    }}
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );

  const renderMiniWidgetsSection = () => {
    if (layoutPrefs.activeMiniWidgets.length === 0) return null;
    return (
      <section
        key="mini_widgets"
        aria-label="الأقسام المصغرة الجاهزة"
        className="space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-extrabold">
              الأقسام المصغرة التفاعلية ({layoutPrefs.activeMiniWidgets.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="text-xs font-bold hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            إدارة الأقسام المصغرة
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {layoutPrefs.activeMiniWidgets.includes('quick_calculator') && (
            <div className="nexus-squircle p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                  <Calculator className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>حاسبة الحصص السريعة</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleMiniWidget('quick_calculator')}
                  aria-label="إغلاق حاسبة الحصص السريعة"
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  aria-label="عدد الأفراد في الحاسبة السريعة"
                  value={miniCalcIndividuals}
                  onChange={(e) => {
                    setMiniCalcIndividuals(e.target.value);
                    setMiniCalcCopied(false);
                  }}
                  className="h-9 w-20 rounded-xl border px-2.5 text-sm font-black tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <div className="flex-1 min-w-0 text-xs">
                  <div className="font-black tabular-nums truncate" style={{ color: 'var(--accent)' }}>
                    {miniCalcPreview.quota}
                  </div>
                  <div className="tabular-nums font-bold" style={{ color: 'var(--success)' }}>
                    {miniCalcPreview.alloc
                      ? formatIqd(miniCalcPreview.alloc.priceIqd)
                      : '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const summary = `${miniCalcIndividuals || 0} أفراد: ${miniCalcPreview.quota} — ${
                      miniCalcPreview.alloc ? formatIqd(miniCalcPreview.alloc.priceIqd) : '—'
                    }`;
                    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                      void navigator.clipboard.writeText(summary);
                    }
                    setMiniCalcCopied(true);
                    setTimeout(() => setMiniCalcCopied(false), 1800);
                  }}
                  aria-label="نسخ نتيجة حاسبة الحصص"
                  className="h-9 px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: miniCalcCopied ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: miniCalcCopied ? 'var(--accent)' : 'var(--border-color)',
                    color: miniCalcCopied ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {miniCalcCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{miniCalcCopied ? 'نُسخ' : 'نسخ'}</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['4', '6', '8', '10'] as const).map((preset) => {
                  const activePreset = miniCalcIndividuals === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setMiniCalcIndividuals(preset);
                        setMiniCalcCopied(false);
                      }}
                      className="px-2.5 py-1 rounded-lg border text-[10px] font-black tabular-nums cursor-pointer transition"
                      style={{
                        backgroundColor: activePreset ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                        borderColor: activePreset ? 'var(--accent)' : 'var(--border-color)',
                        color: activePreset ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {preset} أفراد
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {layoutPrefs.activeMiniWidgets.includes('live_expenses') && (
            <div className="nexus-squircle p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                  <Wallet className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>متتبع المصروفات والأجور الفوري</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleMiniWidget('live_expenses')}
                  aria-label="إغلاق متتبع المصروفات"
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] tabular-nums">
                <div
                  className="rounded-xl border p-2"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>أجور العمال</div>
                  <div className="font-black" style={{ color: 'var(--warning)' }}>
                    {formatIqd(masterMetrics.workerWages)}
                  </div>
                </div>
                <div
                  className="rounded-xl border p-2"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>إجمالي الصرفيات</div>
                  <div className="font-black" style={{ color: 'var(--danger)' }}>
                    {formatIqd(masterMetrics.generalExpenses)}
                  </div>
                </div>
              </div>

              {onAddExpense && capabilities.canManageFinance && agencies[0] && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {agencies.length > 1 && (
                      <select
                        aria-label="اختيار الوكالة للمصروف الفوري"
                        value={
                          agencies.some((a) => a.id === miniExpAgencyId)
                            ? miniExpAgencyId
                            : agencies[0].id
                        }
                        onChange={(e) => setMiniExpAgencyId(Number(e.target.value))}
                        className="h-8 max-w-[115px] rounded-lg border px-1.5 text-[11px] font-bold truncate"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        {agencies.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      aria-label="تصنيف المصروف الفوري"
                      value={quickExpCategory}
                      onChange={(e) =>
                        setQuickExpCategory(e.target.value as ExpenseCategory)
                      }
                      className="h-8 rounded-lg border px-1.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <option value="worker_wages">أجور</option>
                      <option value="packaging">تعبئة</option>
                      <option value="hospitality">ضيافة</option>
                      <option value="custom">خاص</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={quickExpAmount}
                      onChange={(e) => setQuickExpAmount(e.target.value)}
                      placeholder="المبلغ"
                      className="h-8 min-w-0 flex-1 rounded-lg border px-2 text-[11px] tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={quickExpTitle}
                      onChange={(e) => setQuickExpTitle(e.target.value)}
                      placeholder="البيان..."
                      className="h-8 min-w-0 flex-1 rounded-lg border px-2 text-[11px]"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const amt = Number(quickExpAmount);
                        if (!quickExpTitle.trim() || !Number.isFinite(amt) || amt <= 0)
                          return;
                        const targetAgencyId = agencies.some((a) => a.id === miniExpAgencyId)
                          ? miniExpAgencyId
                          : agencies[0].id;
                        onAddExpense({
                          agencyId: targetAgencyId,
                          description: quickExpTitle.trim(),
                          amountIqd: amt,
                          category: quickExpCategory,
                        });
                        setQuickExpTitle('');
                        setQuickExpAmount('');
                      }}
                      className="nexus-pill-btn min-h-[34px] h-8 px-3.5 text-[11px] font-extrabold cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {layoutPrefs.activeMiniWidgets.includes('quick_lookup') && (
            <div className="nexus-squircle p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                  <Search className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>بحث سريع عن مستفيد</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleMiniWidget('quick_lookup')}
                  aria-label="إغلاق البحث السريع"
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="search"
                value={miniLookupQuery}
                onChange={(e) => setMiniLookupQuery(e.target.value)}
                placeholder="اكتب اسم المستفيد أو الرقم الوطني..."
                className="h-9 w-full rounded-xl border px-3 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
              {miniLookupMatches.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {miniLookupMatches.map(({ person, agencyName }) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onOpenAgencyRoster(person.agencyId)}
                      className="flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] hover:border-[var(--accent)]"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span className="font-bold truncate">{person.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {agencyName} · {person.individuals ?? 0} فرد
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {layoutPrefs.activeMiniWidgets.includes('ocr_scanner') && (
            <div className="nexus-squircle p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                  <ScanLine className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>بطاقة السحب الذكي OCR</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleMiniWidget('ocr_scanner')}
                  aria-label="إغلاق بطاقة السحب الذكي"
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                ارفع ملفات PDF أو صور الدفاتر لاستخراج المستفيدين ومطابقتهم تلقائياً.
              </p>
              {onNavigateView && (
                <button
                  type="button"
                  onClick={() => onNavigateView('quick_extract')}
                  className="nexus-pill-btn min-h-[38px] text-xs font-extrabold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  تشغيل السحب الذكي الآن
                </button>
              )}
            </div>
          )}

          {layoutPrefs.activeMiniWidgets.includes('tasks_reminders') && (
            <div className="nexus-squircle p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                  <Calendar className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>مهام وتذكيرات اليوم ({relations.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleMiniWidget('tasks_reminders')}
                  aria-label="إغلاق مهام اليوم"
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {relations.length === 0 ? (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  لا توجد تذكيرات مجدولة حالياً.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {relations.slice(0, 3).map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onNavigateView?.('relationships')}
                      className="flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] text-right hover:border-[var(--accent)]"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span className="font-bold truncate">{rel.personName}</span>
                      <span
                        className="truncate max-w-[140px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {rel.note}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  const sectionRenderers: Record<HomeSectionId, () => React.ReactNode> = {
    portfolio: renderPortfolioSection,
    agencies: renderAgenciesSection,
    workspace_tools: renderWorkspaceToolsSection,
    radar_comparison: renderRadarComparisonSection,
    mini_widgets: renderMiniWidgetsSection,
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 pb-24 sm:px-6 lg:pb-10">
      {/* 1. Pure 2D Architectural Hero Header Card */}
      <section className="chamfered-glass-card smoked-glass-elevated relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute top-0 left-0 w-44 h-44 opacity-20">
          <DotMatrixPattern />
        </div>
        {/* 1px Architectural Corner Reticles */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t border-r rounded-tr-md opacity-45"
          style={{ borderColor: 'var(--accent-bright, #86FFDE)' }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b border-l rounded-bl-md opacity-45"
          style={{ borderColor: 'var(--accent-bright, #86FFDE)' }}
        />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="geo-icon-socket h-12 w-12 shrink-0">
              <Building2 className="h-6 w-6 text-[var(--accent-bright)]" />
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              {activePeriod && (
                <p className="editorial-eyebrow font-mono-num truncate">
                  <span className="text-[var(--accent-bright)]">{activePeriod.quotaName}</span>
                  {' · '}
                  <span className="tabular-nums">
                    {activePeriod.monthName} {activePeriod.year}
                  </span>
                  {' · '}
                  <span className="tabular-nums">{agencies.length} وكالة</span>
                </p>
              )}
              <h1 className="geo-display-title text-xl sm:text-[26px]">
                الوكالات والتوزيع
              </h1>
              <div aria-hidden="true" className="laser-divider max-w-md opacity-75" />
              <p className="geo-subtitle text-xs sm:text-sm">
                مركز قيادة الوكالات — متابعة الحصص، تدقيق السجلات، والأداء المالي لحظة بلحظة.
                {previousArchiveDelta && (
                  <span className="mr-2 font-mono-num font-bold text-[var(--accent-bright)] tabular-nums">
                    ({previousArchiveDelta.diff >= 0 ? '+' : ''}
                    {previousArchiveDelta.diff} فرد مقارنة بأرشيف{' '}
                    {previousArchiveDelta.archiveLabel})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* 2D Geometric Telemetry Dial + Symmetric 2-Column Hero Action Controls */}
          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
            <div className="hidden md:flex shrink-0">
              <PortfolioDial2D
                surfacePrefs={surfacePrefs}
                agencyCount={agencies.length}
                activeIndividuals={masterMetrics.activeIndividuals}
                issueCount={smartAgencySignals.length}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[420px]">
              <button
                type="button"
                data-testid="hero-master-roster-btn"
                onClick={onOpenMasterRoster}
                className="h-[52px] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-pill)] hover:bg-[var(--bg-nav-active)] hover:border-[var(--accent)] active:scale-[0.97] px-3 sm:px-4 text-xs sm:text-[13px] font-extrabold text-[var(--text-primary)] inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="w-8 h-8 rounded-xl bg-[var(--bg-nav-active)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
                  <Table2 className="h-4 w-4 text-[var(--accent-bright)]" />
                </span>
                <span className="truncate">السجل الشامل للوكالات</span>
              </button>

              <button
                type="button"
                data-testid="home-customizer-btn"
                onClick={() => {
                  setHubNotice('');
                  setQuotaDraftName(activePeriod?.quotaName || 'الوجبة الحالية');
                  setKgPerIndDraft(String(calculationSettings.kgPerIndividual));
                  setFeePerIndDraft(String(calculationSettings.feePerIndividualIqd));
                  setCustomizerOpen(true);
                }}
                className="obsidian-gold-cta h-[52px] w-full rounded-2xl px-3 sm:px-4 text-xs sm:text-[13px] font-black inline-flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
              >
                <span className="w-8 h-8 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <span className="truncate">إدارة الواجهة الرئيسية</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Create New Agency — Full-Screen Push Page */}
      {capabilities.canManageAgencies && (
        <FullScreenPushPage
          open={addOpen}
          onBack={() => setAddOpen(false)}
          title="إنشاء وكالة توزيع جديدة"
          subtitle="أضف وكالة جديدة وحدد رمزها التعريفي لفتح جدولها فوراً"
          icon={<Building2 className="h-4 w-4" />}
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={handleCreateAgency}
            className="nexus-squircle p-5 sm:p-6 space-y-5"
          >
            <div>
              <label
                htmlFor="new-agency-name"
                className="mb-1.5 block text-xs font-bold"
              >
                اسم الوكالة الرسمي
              </label>
              <input
                id="new-agency-name"
                type="text"
                required
                value={newAgencyName}
                onChange={(e) => setNewAgencyName(e.target.value)}
                placeholder="مثال: وكالة السلام التموينية..."
                className="min-h-[44px] w-full rounded-2xl border px-3.5 text-sm font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold">الرمز التعريفي</span>
              <div className="flex flex-wrap gap-2">
                {AGENCY_ICON_PRESETS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setNewAgencyIcon(ic)}
                    className="nexus-pill-btn flex h-11 w-11 items-center justify-center border text-lg"
                    style={{
                      backgroundColor:
                        newAgencyIcon === ic ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor:
                        newAgencyIcon === ic ? 'var(--accent)' : 'var(--border-color)',
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="nexus-pill-btn border px-4 py-2 text-xs font-bold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="nexus-pill-btn min-h-[44px] px-6 py-2 text-xs font-extrabold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                اعتماد وفتح الوكالة
              </button>
            </div>
          </form>
        </FullScreenPushPage>
      )}

      {/* Dynamic Ordered & Toggleable Home Sections */}
      {layoutPrefs.sectionOrder
        .filter((id) => !layoutPrefs.hiddenSections.includes(id))
        .map((id) => sectionRenderers[id]?.())}

      {/* Workspace Studio — 6-Module Home Interface Control Hub ("إدارة الواجهة الرئيسية") */}
      <BottomSheet
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        title="إدارة الواجهة الرئيسية"
        subtitle="تعديل أسماء الوكالات والحصص، إضافة وكالة، ترتيب الواجهة، وتخصيص المظهر الهندسي"
        icon={<SlidersHorizontal className="h-5 w-5" />}
      >
        <div className="space-y-5" data-testid="home-control-hub">
          {/* 4 Structured Navigation Tabs inside the Control Hub */}
          <div
            role="tablist"
            aria-label="أقسام إدارة الواجهة الرئيسية"
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl recessed-well border border-[var(--border-color)]"
          >
            {(
              [
                ['agencies', 'الوكالات والحصص'],
                ['layout', 'ترتيب الواجهة'],
                ['appearance', 'الألوان والأشكال'],
                ['smart', 'إضافات ذكية'],
              ] as const
            ).map(([tId, tLabel]) => {
              const active = hubTab === tId;
              return (
                <button
                  key={tId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`hub-tab-${tId}`}
                  onClick={() => setHubTab(tId)}
                  className="py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                    boxShadow: active ? '0 6px 16px -6px var(--spatial-glow)' : 'none',
                  }}
                >
                  {tLabel}
                </button>
              );
            })}
          </div>

          {hubNotice && (
            <div
              role="status"
              className="rounded-xl border px-3.5 py-2 text-xs font-bold flex items-center gap-2"
              style={{
                backgroundColor: 'var(--success-bg)',
                borderColor: 'color-mix(in srgb, var(--success) 45%, transparent)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{hubNotice}</span>
            </div>
          )}

          {/* TAB 1: First-Agency Studio ("إنشاء وكالتك الأولى") + Rename Inline + Quota/Batch */}
          {hubTab === 'agencies' && (
            <div className="space-y-5">
              {/* Highlighted Studio Section: Complete "إنشاء وكالتك الأولى" Showcase & Creation inside إدارة الواجهة الرئيسية */}
              {capabilities.canManageAgencies && (
                <div
                  data-testid="hub-first-agency-section"
                  className="morrow-showcase-frame p-4 sm:p-5 space-y-4 relative overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] flex items-center justify-center shrink-0">
                        <GeometricGoldCube size={40} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h3 className="font-display-ar text-sm sm:text-base font-black text-[var(--text-primary)]">
                            إنشاء وكالتك الأولى
                          </h3>
                          <span className="editorial-eyebrow font-mono-num text-[var(--accent-bright)]">
                            · {agencies.length === 0 ? 'نقطة الانطلاق' : `${agencies.length} وكالة حالياً`}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                          أطلق وكالتك الجديدة واختر أيقونتها هنا داخل إدارة الواجهة الرئيسية لفتح سجلها وحساباتها فوراً.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="hub-open-full-agency-builder-btn"
                      onClick={() => {
                        setCustomizerOpen(false);
                        setAddOpen(true);
                      }}
                      className="nexus-pill-btn inline-flex items-center gap-1.5 border border-[var(--border-color)] bg-[var(--surface-pill)] hover:border-[var(--accent)] px-3 py-1.5 text-[11px] font-bold text-[var(--accent-bright)] cursor-pointer"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <span>فتح المنشئ المتقدم</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="text"
                      data-testid="hub-add-agency-input"
                      aria-label="اسم الوكالة الجديدة"
                      value={hubNewAgencyName}
                      onChange={(e) => setHubNewAgencyName(e.target.value)}
                      placeholder="اكتب اسم وكالتك الأولى أو وكالة جديدة (مثال: وكالة النور التموينية)..."
                      className="flex-1 min-w-[200px] h-10 rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] px-3.5 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex items-center gap-1">
                      {['🌾', '🏪', '📦', '🏢'].map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setHubNewAgencyIcon(ic)}
                          aria-label={`اختيار رمز ${ic}`}
                          className={`w-9 h-9 rounded-xl border text-base cursor-pointer transition ${
                            hubNewAgencyIcon === ic
                              ? 'border-[var(--accent)] bg-[var(--bg-nav-active)] scale-105'
                              : 'border-[var(--border-color)] bg-[var(--surface-well)] hover:border-[var(--accent)]'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      data-testid="hub-add-agency-submit"
                      onClick={async () => {
                        const clean = hubNewAgencyName.trim();
                        if (!clean) return;
                        setHubNewAgencyName('');
                        await onAddAgency(clean, hubNewAgencyIcon);
                        setHubNotice(`تم إنشاء وإضافة «${clean}» بنجاح إلى محفظة الوكالات.`);
                      }}
                      className="obsidian-gold-cta h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{agencies.length === 0 ? 'إنشاء وكالتك الأولى' : 'إنشاء وإضافة الوكالة'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Module 1: Rename Agencies Inline + Transfer & Delete Lifecycle */}
              {agencies.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-black text-[var(--text-primary)]">
                    إدارة الوكالات (تعديل الاسم، القفل، النقل، والحذف الآمن)
                  </h3>
                  <div className="space-y-2">
                    {agencies.map((ag) => {
                      const draftVal = agencyDraftNames[ag.id] ?? ag.name;
                      const changed = draftVal.trim() !== '' && draftVal.trim() !== ag.name;
                      const otherAgencies = agencies.filter((other) => other.id !== ag.id);
                      const targetTransferId =
                        transferTargetMap[ag.id] ?? otherAgencies[0]?.id ?? 0;
                      const agencyPersonsCount = persons.filter(
                        (p) => p.agencyId === ag.id
                      ).length;
                      const isConfirmingDelete = confirmDeleteAgencyId === ag.id;

                      return (
                        <div
                          key={ag.id}
                          className="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] p-2.5"
                        >
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <span className="w-9 h-9 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-color)] flex items-center justify-center text-lg shrink-0">
                              {isUrlOrDataUri(ag.icon) ? '🏢' : ag.icon || '🌾'}
                            </span>
                            <input
                              type="text"
                              data-testid={`hub-rename-agency-${ag.id}`}
                              aria-label={`تعديل اسم ${ag.name}`}
                              value={draftVal}
                              onChange={(e) =>
                                setAgencyDraftNames((prev) => ({
                                  ...prev,
                                  [ag.id]: e.target.value,
                                }))
                              }
                              className="flex-1 min-w-[160px] h-9 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            />
                            <button
                              type="button"
                              data-testid={`hub-save-agency-${ag.id}`}
                              disabled={!changed}
                              onClick={() => {
                                if (!changed) return;
                                onUpdateAgencyDetails(ag.id, { name: draftVal.trim() });
                                setHubNotice(`تم تحديث اسم الوكالة إلى «${draftVal.trim()}»`);
                              }}
                              className="h-9 px-3.5 rounded-xl text-xs font-extrabold transition cursor-pointer disabled:opacity-40"
                              style={{
                                backgroundColor: 'var(--accent)',
                                color: 'var(--accent-fg)',
                              }}
                            >
                              حفظ الاسم
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateAgencyDetails(ag.id, { isLocked: !ag.isLocked });
                                setHubNotice(
                                  ag.isLocked
                                    ? `تم فتح وكالة «${ag.name}»`
                                    : `تم قفل وكالة «${ag.name}»`
                                );
                              }}
                              className="h-9 px-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              {ag.isLocked ? 'فتح' : 'قفل'}
                            </button>
                            {capabilities.canManageAgencies && onDeleteAgency && (
                              <button
                                type="button"
                                data-testid={`hub-delete-agency-trigger-${ag.id}`}
                                onClick={() =>
                                  setConfirmDeleteAgencyId(
                                    isConfirmingDelete ? null : ag.id
                                  )
                                }
                                className="h-9 px-2.5 rounded-xl border text-[11px] font-bold cursor-pointer"
                                style={{
                                  borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--border-color))',
                                  color: 'var(--danger)',
                                  backgroundColor: 'var(--bg-surface)',
                                }}
                              >
                                حذف
                              </button>
                            )}
                          </div>

                          {capabilities.canManageAgencies &&
                            onTransferAgencyRecords &&
                            otherAgencies.length > 0 && (
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] pt-2 text-[11px]">
                                <span style={{ color: 'var(--text-muted)' }}>
                                  نقل كافة سجلات هذه الوكالة ({agencyPersonsCount} سجل) إلى:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={targetTransferId}
                                    onChange={(e) =>
                                      setTransferTargetMap((prev) => ({
                                        ...prev,
                                        [ag.id]: Number(e.target.value),
                                      }))
                                    }
                                    className="h-8 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 text-[11px] font-bold"
                                  >
                                    {otherAgencies.map((other) => (
                                      <option key={other.id} value={other.id}>
                                        {other.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    data-testid={`hub-transfer-agency-${ag.id}`}
                                    disabled={!targetTransferId}
                                    onClick={async () => {
                                      if (!targetTransferId) return;
                                      const destName =
                                        otherAgencies.find((o) => o.id === targetTransferId)?.name ||
                                        'الوكالة المستهدفة';
                                      await onTransferAgencyRecords(ag.id, targetTransferId);
                                      setHubNotice(
                                        `تم نقل سجلات «${ag.name}» إلى «${destName}» بنجاح.`
                                      );
                                    }}
                                    className="h-8 rounded-lg border px-2.5 text-[11px] font-bold cursor-pointer"
                                    style={{
                                      borderColor: 'var(--accent)',
                                      color: 'var(--accent)',
                                      backgroundColor: 'var(--bg-nav-active)',
                                    }}
                                  >
                                    نقل السجلات
                                  </button>
                                </div>
                              </div>
                            )}

                          {isConfirmingDelete && onDeleteAgency && (
                            <div
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-[11px]"
                              style={{
                                borderColor: 'color-mix(in srgb, var(--danger) 50%, transparent)',
                                backgroundColor: 'color-mix(in srgb, var(--danger) 8%, var(--bg-surface))',
                              }}
                            >
                              <span className="font-bold" style={{ color: 'var(--danger)' }}>
                                سيتم نقل جميع سجلات «{ag.name}» إلى سلة المهملات القابلة للاستعادة قبل حذفها.
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteAgencyId(null)}
                                  className="h-7 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 font-bold cursor-pointer"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="button"
                                  data-testid={`hub-confirm-delete-agency-${ag.id}`}
                                  onClick={async () => {
                                    setConfirmDeleteAgencyId(null);
                                    await onDeleteAgency(ag.id);
                                    setHubNotice(
                                      `تم حذف وكالة «${ag.name}» وحفظ بياناتها في سلة الأمان.`
                                    );
                                  }}
                                  className="h-7 rounded-lg px-2.5 font-extrabold text-white cursor-pointer"
                                  style={{ backgroundColor: 'var(--danger)' }}
                                >
                                  تأكيد الحذف
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Module 2: Edit Active Batch / Ration Quota */}
              <div className="space-y-2.5 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] p-3.5">
                <h3 className="text-xs font-black text-[var(--text-primary)]">
                  تعديل الوجبة والحصص والرسوم
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      اسم الوجبة الحالية
                    </label>
                    <input
                      type="text"
                      value={quotaDraftName}
                      onChange={(e) => setQuotaDraftName(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-xs font-bold text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      حصة الفرد (كغم)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      dir="ltr"
                      value={kgPerIndDraft}
                      onChange={(e) => setKgPerIndDraft(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-xs font-mono-num font-bold text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      رسم الفرد (د.ع)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      dir="ltr"
                      value={feePerIndDraft}
                      onChange={(e) => setFeePerIndDraft(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-xs font-mono-num font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    data-testid="hub-save-quota-btn"
                    onClick={() => {
                      if (quotaDraftName.trim() && onUpdateActivePeriod) {
                        onUpdateActivePeriod({ quotaName: quotaDraftName.trim() });
                      }
                      if (onUpdateCalculationSettings) {
                        onUpdateCalculationSettings({
                          kgPerIndividual: Math.max(1, Number(kgPerIndDraft) || 9),
                          feePerIndividualIqd: Math.max(0, Number(feePerIndDraft) || 250),
                        });
                      }
                      setHubNotice('تم حفظ إعدادات الوجبة والحصة والرسوم بنجاح.');
                    }}
                    className="h-9 px-4 rounded-xl text-xs font-extrabold cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    حفظ الوجبة والحصة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Reorder & Toggle Sections */}
          {hubTab === 'layout' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black">
                  ترتيب وإظهار أقسام الرئيسية (اسحب أو استخدم الأسهم)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    resetHomeLayout();
                    setHubNotice('تمت استعادة الترتيب الافتراضي للأقسام.');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>استعادة الترتيب الافتراضي</span>
                </button>
              </div>

              <div className="space-y-2">
                {layoutPrefs.sectionOrder.map((secId, idx) => {
                  const isHidden = layoutPrefs.hiddenSections.includes(secId);
                  const meta = HOME_SECTION_META[secId];
                  return (
                    <div
                      key={secId}
                      draggable
                      onDragStart={() => setDragSectionId(secId)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragSectionId) {
                          reorderSectionDrag(dragSectionId, secId);
                          setDragSectionId(null);
                        }
                      }}
                      className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
                      style={{
                        backgroundColor: isHidden
                          ? 'var(--bg-main)'
                          : 'var(--bg-surface)',
                        borderColor:
                          dragSectionId === secId
                            ? 'var(--accent)'
                            : 'var(--border-color)',
                        opacity: isHidden ? 0.65 : 1,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GripVertical
                          className="h-4 w-4 shrink-0 cursor-grab"
                          style={{ color: 'var(--text-muted)' }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold truncate">
                            {meta.title}
                          </div>
                          <div
                            className="text-[11px] truncate"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {meta.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSectionOrder(secId, 'up')}
                          aria-label={`تحريك ${meta.title} للأعلى`}
                          data-testid={`hub-move-up-${secId}`}
                          className="rounded-lg border p-1.5 disabled:opacity-30 cursor-pointer"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === layoutPrefs.sectionOrder.length - 1}
                          onClick={() => moveSectionOrder(secId, 'down')}
                          aria-label={`تحريك ${meta.title} للأسفل`}
                          data-testid={`hub-move-down-${secId}`}
                          className="rounded-lg border p-1.5 disabled:opacity-30 cursor-pointer"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSectionVisibility(secId)}
                          data-testid={`hub-toggle-vis-${secId}`}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold cursor-pointer"
                          style={{
                            backgroundColor: isHidden
                              ? 'var(--bg-main)'
                              : 'var(--bg-nav-active)',
                            borderColor: isHidden
                              ? 'var(--border-color)'
                              : 'var(--accent)',
                            color: isHidden ? 'var(--text-muted)' : 'var(--accent)',
                          }}
                        >
                          {isHidden ? (
                            <>
                              <EyeOff className="h-3 w-3" />
                              <span>مخفي</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" />
                              <span>ظاهر</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: 7 Themes (incl. السبح والذهب + التلقائي) + 5 App Shapes + Live Custom Color Studio */}
          {hubTab === 'appearance' && (
            <div className="space-y-5">
              {/* App Shapes Studio (5 distinct structural shapes) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black flex items-center gap-1.5">
                    <Layers className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>الأشكال الهندسية للتطبيق (5 أشكال مختلفة كلياً)</span>
                  </h3>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--accent-bright)' }}>
                    {APP_SHAPES.find((s) => s.id === resolveAppShapeId(appShape))?.name}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {APP_SHAPES.map((shape) => {
                    const active = resolveAppShapeId(appShape) === shape.id;
                    return (
                      <button
                        key={shape.id}
                        type="button"
                        data-testid={`app-shape-${shape.id}`}
                        onClick={() => {
                          onUpdateThemePrefs?.({ appShape: shape.id });
                          setHubNotice(`تم تفعيل الشكل الهندسي: ${shape.name}`);
                        }}
                        aria-pressed={active}
                        className="rounded-2xl border p-3 text-right transition-all cursor-pointer flex flex-col justify-between gap-2"
                        style={{
                          borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                          backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--surface-well)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <ShapeSilhouetteIcon shapeId={shape.id} active={active} />
                          {active && (
                            <span className="text-[10px] font-black" style={{ color: 'var(--accent-bright)' }}>
                              مفعّل
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-black text-[var(--text-primary)] truncate">
                            {shape.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-snug">
                            {shape.tagline}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-black">
                  الثيمات والمظهر العام (السبح والذهب الافتراضي + 6 ثيمات متكاملة)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(Object.keys(SURFACE_2D_THEMES) as Surface2DThemeId[]).map((tId) => {
                    const def = SURFACE_2D_THEMES[tId];
                    const active = surfacePrefs.themeId === tId && !surfacePrefs.customColors;
                    const resolvedAutoLabel =
                      tId === 'auto_adaptive'
                        ? resolveAutoThemeTarget().name
                        : null;
                    return (
                      <button
                        key={tId}
                        type="button"
                        data-testid={`hub-theme-${tId}`}
                        onClick={() => {
                          updateSurfacePrefs({ themeId: tId, customColors: undefined });
                          onUpdateThemePrefs?.({ appTheme: mapSurfaceThemeToAppTheme(tId) });
                          setHubNotice(`تم تفعيل ثيم: ${def.nameAr}`);
                        }}
                        className="rounded-2xl border p-3.5 text-right transition-all cursor-pointer"
                        style={{
                          borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                          backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--surface-well)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            {def.swatches.map((hex) => (
                              <span
                                key={hex}
                                className="w-4 h-4 rounded-full border border-[var(--border-color)]"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                          {active && (
                            <span
                              className="text-[10px] font-black"
                              style={{ color: 'var(--accent-bright)' }}
                            >
                              مفعّل
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-black text-[var(--text-primary)]">
                          {def.nameAr}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                          {resolvedAutoLabel ? `الوضع النشط الآن: ${resolvedAutoLabel}` : def.subtitleAr}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Custom Color Studio */}
              <div className="space-y-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-[var(--text-primary)] flex items-center gap-1.5">
                      <Palette className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <span>تخصيص الألوان يدوياً</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      عدّل اللون الأساسي، الإضاءة الثانوية، وخلفية التطبيق بشكل فوري متزامن مع جميع العناصر الهندسية
                    </p>
                  </div>
                  {surfacePrefs.customColors && (
                    <button
                      type="button"
                      data-testid="reset-custom-colors-btn"
                      onClick={() => {
                        updateSurfacePrefs({ customColors: undefined });
                        setHubNotice('تمت استعادة ألوان الثيم الأصلية.');
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-subtle)] hover:bg-[var(--bg-nav-active)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-primary)] cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>استعادة ألوان الثيم</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Primary Accent Color Picker + Swatches */}
                  <div className="space-y-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">اللون الأساسي</span>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <span
                          dir="ltr"
                          className="font-mono-num text-[11px] font-bold text-[var(--accent-bright)]"
                        >
                          {activeSurfacePalette.accent}
                        </span>
                        <input
                          type="color"
                          data-testid="custom-accent-color-picker"
                          aria-label="اختيار اللون الأساسي"
                          value={activeSurfacePalette.accent}
                          onChange={(e) =>
                            updateSurfacePrefs({
                              customColors: {
                                ...surfacePrefs.customColors,
                                accent: e.target.value.toUpperCase(),
                              },
                            })
                          }
                          className="h-7 w-9 cursor-pointer rounded-lg border border-[var(--border-color)] bg-transparent p-0.5"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {CURATED_ACCENT_SWATCHES.map((hex) => {
                        const sel = activeSurfacePalette.accent === hex;
                        return (
                          <button
                            key={hex}
                            type="button"
                            data-testid={`accent-swatch-${hex}`}
                            aria-label={`اختيار اللون الأساسي ${hex}`}
                            onClick={() =>
                              updateSurfacePrefs({
                                customColors: {
                                  ...surfacePrefs.customColors,
                                  accent: hex,
                                },
                              })
                            }
                            className="w-6 h-6 rounded-full border transition-transform hover:scale-110 cursor-pointer"
                            style={{
                              backgroundColor: hex,
                              borderColor: sel ? 'var(--text-primary)' : 'var(--border-color)',
                              transform: sel ? 'scale(1.12)' : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Secondary Glow Color Picker + Swatches */}
                  <div className="space-y-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">لون الإضاءة الثانوي</span>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <span
                          dir="ltr"
                          className="font-mono-num text-[11px] font-bold text-[var(--text-primary)]"
                        >
                          {activeSurfacePalette.secondary}
                        </span>
                        <input
                          type="color"
                          data-testid="custom-secondary-color-picker"
                          aria-label="اختيار لون الإضاءة الثانوي"
                          value={activeSurfacePalette.secondary}
                          onChange={(e) =>
                            updateSurfacePrefs({
                              customColors: {
                                ...surfacePrefs.customColors,
                                secondary: e.target.value.toUpperCase(),
                              },
                            })
                          }
                          className="h-7 w-9 cursor-pointer rounded-lg border border-[var(--border-color)] bg-transparent p-0.5"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {CURATED_SECONDARY_SWATCHES.map((hex) => {
                        const sel = activeSurfacePalette.secondary === hex;
                        return (
                          <button
                            key={hex}
                            type="button"
                            data-testid={`secondary-swatch-${hex}`}
                            aria-label={`اختيار اللون الثانوي ${hex}`}
                            onClick={() =>
                              updateSurfacePrefs({
                                customColors: {
                                  ...surfacePrefs.customColors,
                                  secondary: hex,
                                },
                              })
                            }
                            className="w-6 h-6 rounded-full border transition-transform hover:scale-110 cursor-pointer"
                            style={{
                              backgroundColor: hex,
                              borderColor: sel ? 'var(--text-primary)' : 'var(--border-color)',
                              transform: sel ? 'scale(1.12)' : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Surface Tone Presets */}
                <div className="space-y-2">
                  <div className="text-xs font-extrabold">درجة الخلفية والزجاج</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      Object.entries(SURFACE_TONE_PRESETS) as Array<
                        [SurfaceToneId, (typeof SURFACE_TONE_PRESETS)[SurfaceToneId]]
                      >
                    ).map(([toneId, preset]) => {
                      const activeTone = surfacePrefs.customColors?.surfaceTone === toneId;
                      return (
                        <button
                          key={toneId}
                          type="button"
                          data-testid={`surface-tone-${toneId}`}
                          onClick={() =>
                            updateSurfacePrefs({
                              customColors: {
                                ...surfacePrefs.customColors,
                                surfaceTone: toneId,
                              },
                            })
                          }
                          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold cursor-pointer transition-all"
                          style={{
                            borderColor: activeTone ? 'var(--accent)' : 'var(--border-color)',
                            backgroundColor: activeTone ? 'var(--bg-nav-active)' : preset.bgSurface,
                            color: activeTone ? 'var(--accent-bright)' : preset.textPrimary,
                          }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-[var(--border-color)] shrink-0"
                            style={{ backgroundColor: preset.bgMain }}
                          />
                          <span className="truncate">{preset.labelAr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] p-3.5">
                  <div className="text-xs font-black">حيوية الحركة والتفاعل (2D)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['off', 'إيقاف'],
                        ['subtle', 'خفيف'],
                        ['dynamic', 'ديناميكي'],
                      ] as Array<[Motion2DIntensity, string]>
                    ).map(([mode, label]) => {
                      const activeMotion = surfacePrefs.motionIntensity === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => updateSurfacePrefs({ motionIntensity: mode })}
                          className="py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all"
                          style={{
                            borderColor: activeMotion ? 'var(--accent)' : 'var(--border-color)',
                            backgroundColor: activeMotion ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                            color: activeMotion ? 'var(--accent-bright)' : 'var(--text-muted)',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] p-3.5">
                  <div className="text-xs font-black">كثافة البطاقات</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['compact', 'مضغوط'],
                        ['balanced', 'متوازن'],
                        ['spacious', 'رحب'],
                      ] as Array<[SurfaceCardDensity, string]>
                    ).map(([density, label]) => {
                      const activeDensity = surfacePrefs.cardDensity === density;
                      return (
                        <button
                          key={density}
                          type="button"
                          onClick={() => updateSurfacePrefs({ cardDensity: density })}
                          className="py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all"
                          style={{
                            borderColor: activeDensity ? 'var(--accent)' : 'var(--border-color)',
                            backgroundColor: activeDensity ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                            color: activeDensity ? 'var(--accent-bright)' : 'var(--text-muted)',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Smart Utilities & Mini Widgets */}
          {hubTab === 'smart' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-xs font-black">
                  إضافات ذكية وإجراءات فورية
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {onNavigateView && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomizerOpen(false);
                        onNavigateView('smart_models');
                      }}
                      className="rounded-xl border border-[var(--accent)]/45 bg-[var(--bg-nav-active)] p-3 text-right hover:brightness-110 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-xs font-black text-[var(--accent-bright)]">
                        <BrainCircuit className="h-4 w-4" />
                        <span>فتح النماذج الذكية</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        تدقيق شامل وتنبؤ ذكي بالبيانات
                      </p>
                    </button>
                  )}
                  {onExportBackupFile && (
                    <button
                      type="button"
                      onClick={() => {
                        onExportBackupFile();
                        setHubNotice('تم تصدير النسخة الاحتياطية المنظمة.');
                      }}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] p-3 text-right hover:border-[var(--accent)] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-xs font-black text-[var(--text-primary)]">
                        <Download className="h-4 w-4 text-[var(--accent)]" />
                        <span>تصدير نسخة احتياطية</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        تنزيل ملف البيانات الاحتياطي
                      </p>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      resetHomeLayout();
                      updateSurfacePrefs({
                        themeId: 'obsidian_gold',
                        motionIntensity: 'subtle',
                        cardDensity: 'balanced',
                        customColors: undefined,
                      });
                      onUpdateThemePrefs?.({ appTheme: 'obsidian-gold', appShape: 'geometric-glass' });
                      setHubNotice('تمت استعادة التخطيط وثيم السبح والذهب والشكل الافتراضي.');
                    }}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] p-3 text-right hover:border-[var(--accent)] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-black text-[var(--text-primary)]">
                      <RotateCcw className="h-4 w-4 text-[var(--accent)]" />
                      <span>إعادة ضبط الواجهة</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      تصفير التخصيصات والعودة للأصل
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-black">
                  أقسام مصغرة جاهزة للإضافة في الرئيسية
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MINI_WIDGET_CATALOG.map((w) => {
                    const active = layoutPrefs.activeMiniWidgets.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleMiniWidget(w.id)}
                        className="living-control flex items-start gap-2.5 rounded-xl border p-3 text-right cursor-pointer"
                        style={{
                          backgroundColor: active
                            ? 'var(--bg-nav-active)'
                            : 'var(--bg-main)',
                          borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                        }}
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                            color: active ? 'var(--accent)' : 'var(--text-muted)',
                          }}
                        >
                          {w.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold truncate">
                              {w.title}
                            </span>
                            <span
                              className="text-[10px] font-black"
                              style={{
                                color: active ? 'var(--accent)' : 'var(--text-muted)',
                              }}
                            >
                              {active ? 'مفعّل ✓' : '+ إضافة'}
                            </span>
                          </div>
                          <div
                            className="mt-0.5 text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {w.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </main>
  );
};
