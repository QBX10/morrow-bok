import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Lock,
  Package,
  Pencil,
  Plus,
  Search,
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
  CalculationSettings,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
} from '../types/agency';
import {
  auditAgencyPersons,
  computeAgencyMetrics,
  formatIqd,
  normalizeArabic,
} from '../utils/agencyLogic';
import type { ModeCapabilities } from '../utils/modePermissions';
import { compressImageFileToDataUrl } from '../lib/imageUpload';

interface AgenciesHubViewProps {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  activePeriod?: PeriodQuotaMeta;
  monthlyArchives?: MonthlyArchiveRecord[];
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  onOpenMasterRoster: () => void;
  onOpenAgencyRoster: (agencyId: number) => void;
  onAddAgency: (name: string, icon: string) => void;
  onUpdateAgencyDetails: (
    agencyId: number,
    patch: Partial<Pick<Agency, 'name' | 'icon' | 'logoDataUrl' | 'isLocked'>>
  ) => void;
}

const AGENCY_ICON_PRESETS = ['🌾', '🏪', '📦', '🏛️', '🚚', '⚖️', '🧾', '🏢'];

type AgencyFilterTab = 'all' | 'active' | 'needs_audit' | 'locked';
type AgencySortKey = 'default' | 'individuals' | 'profit' | 'households';
type ComparisonMetric = 'individuals' | 'bags' | 'profit' | 'households';

export const AgenciesHubView: React.FC<AgenciesHubViewProps> = ({
  agencies,
  persons,
  expenses,
  activePeriod,
  monthlyArchives = [],
  calculationSettings,
  capabilities,
  onOpenMasterRoster,
  onOpenAgencyRoster,
  onAddAgency,
  onUpdateAgencyDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<AgencyFilterTab>('all');
  const [sortBy, setSortBy] = useState<AgencySortKey>('default');
  const [comparisonMetric, setComparisonMetric] =
    useState<ComparisonMetric>('individuals');

  // Add Agency Drawer State
  const [addOpen, setAddOpen] = useState(false);
  const [newAgencyName, setNewAgencyName] = useState('');
  const [newAgencyIcon, setNewAgencyIcon] = useState('🏢');

  // Edit Agency Inline State
  const [editingAgencyId, setEditingAgencyId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('🌾');
  const logoFileInputRef = useRef<HTMLInputElement>(null);

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

  // Per-agency full analytics & smart audit scan
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
  }, [agencies, persons, expenses, calculationSettings, masterMetrics.activeIndividuals]);

  // Smart Agency Radar Signals (100% live from real records)
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

  // Period-over-period delta if previous monthly archive exists
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

  // Filtered & sorted agency cards
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

  // Comparison bar chart values
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

  const handleCreateAgency = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAgencyName.trim();
    if (!clean) return;
    const nextId = agencies.reduce((m, a) => Math.max(m, a.id), 0) + 1;
    onAddAgency(clean, newAgencyIcon || '🏢');
    setNewAgencyName('');
    setNewAgencyIcon('🏢');
    setAddOpen(false);
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

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:pb-10">
      {/* 1. Executive Agencies Command Header */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">
              الوكالات والتوزيع
            </h1>
            {activePeriod && (
              <span
                className="rounded-lg border px-2.5 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor:
                    'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
                  color: 'var(--accent)',
                }}
              >
                {activePeriod.quotaName} · {activePeriod.monthName}{' '}
                {activePeriod.year}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            مركز قيادة الوكالات — متابعة الحصص، تدقيق السجلات، والأداء المالي لحظة بلحظة.
            {previousArchiveDelta && (
              <span className="mr-2 font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                ({previousArchiveDelta.diff >= 0 ? '+' : ''}
                {previousArchiveDelta.diff} فرد مقارنة بأرشيف {previousArchiveDelta.archiveLabel})
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMasterRoster}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Table2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>السجل الشامل للوكالات</span>
          </button>

          {capabilities.canManageAgencies && (
            <button
              type="button"
              onClick={() => setAddOpen((prev) => !prev)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              {addOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{addOpen ? 'إلغاء' : 'إضافة وكالة'}</span>
            </button>
          )}
        </div>
      </section>

      {/* Optional Add New Agency Drawer */}
      {addOpen && capabilities.canManageAgencies && (
        <form
          onSubmit={handleCreateAgency}
          className="tabrix-view-enter rounded-2xl border p-5 space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Building2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>إنشاء وكالة توزيع جديدة</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
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
                className="min-h-[44px] w-full rounded-xl border px-3.5 text-sm font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-bold">الرمز التعريفي</span>
              <div className="flex flex-wrap gap-1.5">
                {AGENCY_ICON_PRESETS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setNewAgencyIcon(ic)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition-colors"
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

            <button
              type="submit"
              className="min-h-[44px] rounded-xl px-5 py-2 text-xs font-extrabold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              اعتماد وفتح الوكالة
            </button>
          </div>
        </form>
      )}

      {/* 2. Portfolio Master Strip (السجل الشامل — KPI Executive Bar) */}
      <section
        aria-label="الملخص العام للوكالات"
        className="rounded-2xl border p-5 sm:p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-extrabold">
              محفظة الوكالات الموحدة ({agencies.length} وكالة)
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenMasterRoster}
            className="inline-flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            <span>استعراض كافة السجلات</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div
            className="rounded-xl border p-3.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-semibold">العائلات النشطة</span>
              <Users className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1.5 text-2xl font-black tabular-nums">
              {masterMetrics.activeHouseholds.toLocaleString('en-US')}
            </div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              من أصل {masterMetrics.registeredHouseholds.toLocaleString('en-US')} سجل مسجل
            </div>
          </div>

          <div
            className="rounded-xl border p-3.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-semibold">الأفراد المشمولون</span>
              <Activity className="h-3.5 w-3.5" />
            </div>
            <div
              className="mt-1.5 text-2xl font-black tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {masterMetrics.activeIndividuals.toLocaleString('en-US')}
            </div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {masterBlockBreakdown.fullyBlockedCount} محجوب كلياً · {masterBlockBreakdown.partialBlockedCount} جزئياً
            </div>
          </div>

          <div
            className="rounded-xl border p-3.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-semibold">حصة الطحين التقديرية</span>
              <Package className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1.5 text-2xl font-black tabular-nums">
              {masterMetrics.fullBags.toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold">كيس</span>
              {masterMetrics.remainderKg > 0 && (
                <span className="text-sm font-extrabold mr-1.5">
                  + {masterMetrics.remainderKg} كغم
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              الوزن الصافي: {masterMetrics.totalKg.toLocaleString('en-US')} كغم
            </div>
          </div>

          <div
            className="rounded-xl border p-3.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-semibold">صافي الربح التقديري</span>
              <Wallet className="h-3.5 w-3.5" />
            </div>
            <div
              className="mt-1.5 text-2xl font-black tabular-nums"
              style={{
                color:
                  masterMetrics.profit >= 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {formatIqd(masterMetrics.profit)}
            </div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              الإيراد {formatIqd(masterMetrics.revenue)} · المصاريف{' '}
              {formatIqd(masterMetrics.totalExpenses)}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Smart Agency Intelligence + Visual Comparison */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Agency Smart Audit & Alerts Radar */}
        <div
          className="lg:col-span-5 rounded-2xl border p-5 flex flex-col justify-between space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
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
                className="flex items-center gap-3 rounded-xl border p-4 text-xs"
                style={{
                  backgroundColor: 'var(--success-bg)',
                  borderColor: 'color-mix(in srgb, var(--success) 35%, var(--border-color))',
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
                      className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-right transition-colors hover:border-[var(--accent)]"
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
              {calculationSettings.kgPerIndividual} كغم · {calculationSettings.feePerIndividualIqd} د.ع
            </span>
          </div>
        </div>

        {/* Right: Interactive Portfolio Comparison Chart */}
        <div
          className="lg:col-span-7 rounded-2xl border p-5 space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-extrabold">مقارنة أداء الوكالات</h2>
            </div>

            <div
              className="inline-flex rounded-xl border p-1 text-[11px] font-bold"
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
                  className="rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors"
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
            {comparisonBars.map((bar) => (
              <button
                key={bar.agency.id}
                type="button"
                onClick={() => onOpenAgencyRoster(bar.agency.id)}
                className="group block w-full text-right"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-bold group-hover:text-[var(--accent)] transition-colors">
                    <span>{bar.agency.icon}</span>
                    <span>{bar.agency.name}</span>
                  </span>
                  <span className="font-extrabold tabular-nums">
                    {bar.formatted}
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--bg-main)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${bar.widthPct}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Filter/Search Strip + Unified Luxury Agency Cards Grid */}
      <section className="space-y-4">
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
            <div
              className="flex items-center gap-2 rounded-xl border px-3 h-10 flex-1 max-w-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الوكالة..."
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ['all', `الكل (${agencyRows.length})`],
                  ['active', `نشطة (${agencyRows.filter((r) => !r.agency.isLocked).length})`],
                  [
                    'needs_audit',
                    `تحتاج انتباه (${agencyRows.filter((r) => r.hasIssues).length})`,
                  ],
                  ['locked', `مقفلة (${agencyRows.filter((r) => r.agency.isLocked).length})`],
                ] as Array<[AgencyFilterTab, string]>
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setFilterTab(tabId)}
                  className="min-h-[36px] rounded-xl border px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor:
                      filterTab === tabId ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor:
                      filterTab === tabId ? 'var(--accent)' : 'var(--border-color)',
                    color: filterTab === tabId ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as AgencySortKey)}
            aria-label="ترتيب الوكالات"
            className="min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold"
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

        {filteredAgencies.length === 0 ? (
          <div
            className="rounded-2xl border p-10 text-center text-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
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
                <article
                  key={agency.id}
                  className="flex flex-col justify-between rounded-2xl border p-5 transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: isEditing ? 'var(--accent)' : 'var(--border-color)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  {isEditing ? (
                    <div className="space-y-4">
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
                          className="flex-1 min-h-[40px] rounded-xl text-xs font-extrabold"
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
                          className="min-h-[40px] rounded-xl border px-4 text-xs font-bold"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
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
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateAgencyDetails(agency.id, {
                                  isLocked: !agency.isLocked,
                                })
                              }
                              title={agency.isLocked ? 'فتح الوكالة' : 'قفل الوكالة'}
                              aria-label={agency.isLocked ? 'فتح الوكالة' : 'قفل الوكالة'}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:border-[var(--accent)]"
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
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:border-[var(--accent)]"
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
                        <div
                          className="rounded-xl border p-2.5"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div
                            className="text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            العائلات النشطة
                          </div>
                          <div className="mt-0.5 text-base font-black tabular-nums">
                            {metrics.activeHouseholds.toLocaleString('en-US')}
                          </div>
                        </div>

                        <div
                          className="rounded-xl border p-2.5"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div
                            className="text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            الأفراد
                          </div>
                          <div
                            className="mt-0.5 text-base font-black tabular-nums"
                            style={{ color: 'var(--accent)' }}
                          >
                            {metrics.activeIndividuals.toLocaleString('en-US')}
                          </div>
                        </div>

                        <div
                          className="rounded-xl border p-2.5"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div
                            className="text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            الأكياس المطلوبة
                          </div>
                          <div className="mt-0.5 text-sm font-black tabular-nums">
                            {metrics.fullBags.toLocaleString('en-US')} كيس
                            {metrics.remainderKg > 0 && ` + ${metrics.remainderKg}ك`}
                          </div>
                        </div>

                        <div
                          className="rounded-xl border p-2.5"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div
                            className="text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            صافي الربح
                          </div>
                          <div
                            className="mt-0.5 text-sm font-black tabular-nums"
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

                      {/* Share & Audit Footer */}
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
                              {metrics.registeredHouseholds} سجل
                            </span>
                          </div>
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full"
                            style={{ backgroundColor: 'var(--bg-main)' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(4, sharePct)}%`,
                                backgroundColor: 'var(--accent)',
                              }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenAgencyRoster(agency.id)}
                          className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] hover:border-[var(--accent)]"
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
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
