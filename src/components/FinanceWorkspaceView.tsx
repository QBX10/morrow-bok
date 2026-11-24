import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Coffee,
  Download,
  Filter,
  HardHat,
  PackageOpen,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Agency,
  AgencyExpense,
  CalculationSettings,
  ExpenseCategory,
  GeneralAppPrefs,
  PeriodQuotaMeta,
  Person,
  RecurringExpenseTemplate,
  WageBasis,
} from '../types/agency';
import {
  computeAgencyMetrics,
  formatIqd,
  formatNumberCompact,
  getExpenseCategoryLabel,
} from '../utils/agencyLogic';
import { DEFAULT_CUSTOM_EXPENSE_CATEGORIES } from '../data/seedData';
import { runAsyncExportTask } from '../hooks/useToastQueue';
import { exportFinancialReportToExcel } from '../utils/excelExport';
import type { ModeCapabilities } from '../utils/modePermissions';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';

interface FinanceWorkspaceViewProps {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  activePeriod?: PeriodQuotaMeta;
  generalPrefs?: GeneralAppPrefs;
  onUpdateGeneralPrefs?: (patch: Partial<GeneralAppPrefs>) => void;
  onAddExpense: (input: {
    agencyId: number;
    description: string;
    amountIqd: number;
    category: ExpenseCategory;
    occurredAt?: string;
    customCategoryLabel?: string;
    workerNames?: string;
    workerCount?: number;
    wageBasis?: WageBasis;
    quantity?: number;
    unitCostIqd?: number;
    quotaLabel?: string;
    notes?: string;
  }) => void;
  onRequestDeleteExpense: (expense: AgencyExpense) => void;
}

type CategoryFilter = 'all' | ExpenseCategory;

const WAGE_BASIS_LABELS: Record<WageBasis, string> = {
  daily: 'يومي',
  per_quota: 'لكل حصة',
  per_worker: 'لكل عامل',
  fixed: 'مبلغ مقطوع',
};

const PACKAGING_PRESETS = [
  { label: 'علاليك (أكياس نايلون)', unitCost: 2500 },
  { label: 'كواني (أكياس طحين/خيش)', unitCost: 1500 },
  { label: 'حبال وربط', unitCost: 2000 },
  { label: 'ملصقات وقرطاسية', unitCost: 1000 },
];

const HOSPITALITY_PRESETS = [
  { label: 'أكل / غداء عمال', unitCost: 10000 },
  { label: 'شاي ومياه باردة', unitCost: 5000 },
  { label: 'ضيافة مراجعين', unitCost: 5000 },
];

export const FinanceWorkspaceView: React.FC<FinanceWorkspaceViewProps> = ({
  agencies,
  persons,
  expenses,
  calculationSettings,
  capabilities,
  activePeriod,
  generalPrefs,
  onUpdateGeneralPrefs,
  onAddExpense,
  onRequestDeleteExpense,
}) => {
  const [selectedAgencyId, setSelectedAgencyId] = useState<number>(
    agencies[0]?.id ?? 1
  );
  const [category, setCategory] = useState<ExpenseCategory>('worker_wages');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Worker Wages Rich Fields
  const [wageBasis, setWageBasis] = useState<WageBasis>('daily');
  const [workerNames, setWorkerNames] = useState('');
  const [workerCount, setWorkerCount] = useState('');
  const [wagePerWorker, setWagePerWorker] = useState('');

  // Packaging & Hospitality Multiplier Fields
  const [quantity, setQuantity] = useState('');
  const [unitCostIqd, setUnitCostIqd] = useState('');

  // Custom Category & Period/Notes
  const customCategories = useMemo(
    () =>
      generalPrefs?.customExpenseCategories &&
      generalPrefs.customExpenseCategories.length > 0
        ? generalPrefs.customExpenseCategories
        : DEFAULT_CUSTOM_EXPENSE_CATEGORIES,
    [generalPrefs?.customExpenseCategories]
  );
  const [customCategoryLabel, setCustomCategoryLabel] = useState(
    customCategories[0] || 'نقل وتوصيل'
  );
  const [newCustomCatInput, setNewCustomCatInput] = useState('');
  const [linkToActiveQuota, setLinkToActiveQuota] = useState(true);
  const [notes, setNotes] = useState('');

  // Ledger Filtering
  const [ledgerFilter, setLedgerFilter] = useState<CategoryFilter>('all');

  const recurringTemplates = generalPrefs?.recurringExpenseTemplates || [];

  const selectedAgency =
    agencies.find((a) => a.id === selectedAgencyId) || agencies[0];

  const scopedPersons = useMemo(
    () => persons.filter((p) => p.agencyId === selectedAgency?.id),
    [persons, selectedAgency]
  );

  const scopedExpenses = useMemo(
    () => expenses.filter((e) => e.agencyId === selectedAgency?.id),
    [expenses, selectedAgency]
  );

  const filteredExpenses = useMemo(() => {
    if (ledgerFilter === 'all') return scopedExpenses;
    if (ledgerFilter === 'custom') {
      return scopedExpenses.filter(
        (e) => e.category === 'custom' || e.category === 'general'
      );
    }
    return scopedExpenses.filter((e) => e.category === ledgerFilter);
  }, [scopedExpenses, ledgerFilter]);

  const metrics = useMemo(
    () =>
      computeAgencyMetrics(
        scopedPersons,
        scopedExpenses,
        calculationSettings
      ),
    [scopedPersons, scopedExpenses, calculationSettings]
  );

  const activeQuotaLabel = activePeriod
    ? `${activePeriod.quotaName} — ${activePeriod.monthName} ${activePeriod.year}`
    : '';

  const autoCalcWorkersTotal = (cntStr: string, rateStr: string) => {
    const c = Number(cntStr);
    const r = Number(rateStr);
    if (Number.isFinite(c) && c > 0 && Number.isFinite(r) && r > 0) {
      setAmount(String(Math.round(c * r)));
    }
  };

  const autoCalcQtyTotal = (qtyStr: string, unitStr: string) => {
    const q = Number(qtyStr);
    const u = Number(unitStr);
    if (Number.isFinite(q) && q > 0 && Number.isFinite(u) && u > 0) {
      setAmount(String(Math.round(q * u)));
    }
  };

  const resetFormFields = () => {
    setDescription('');
    setAmount('');
    setWorkerNames('');
    setWorkerCount('');
    setWagePerWorker('');
    setQuantity('');
    setUnitCostIqd('');
    setNotes('');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!selectedAgency || !description.trim() || !Number.isFinite(num) || num <= 0)
      return;

    const wCount = Number(workerCount);
    const qtyNum = Number(quantity);
    const unitNum = Number(unitCostIqd);

    onAddExpense({
      agencyId: selectedAgency.id,
      description: description.trim(),
      amountIqd: num,
      category,
      occurredAt,
      ...(category === 'custom'
        ? { customCategoryLabel: customCategoryLabel.trim() || 'مصروفات خاصة' }
        : {}),
      ...(category === 'worker_wages'
        ? {
            workerNames: workerNames.trim() || undefined,
            workerCount: Number.isFinite(wCount) && wCount > 0 ? wCount : undefined,
            wageBasis,
          }
        : {}),
      ...(category === 'packaging' || category === 'hospitality' || category === 'custom'
        ? {
            quantity: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : undefined,
            unitCostIqd: Number.isFinite(unitNum) && unitNum > 0 ? unitNum : undefined,
          }
        : {}),
      ...(linkToActiveQuota && activeQuotaLabel
        ? { quotaLabel: activeQuotaLabel }
        : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    resetFormFields();
  };

  const handleSaveAsTemplate = () => {
    if (!onUpdateGeneralPrefs) return;
    const num = Number(amount);
    if (!description.trim() || !Number.isFinite(num) || num <= 0) return;

    const wCount = Number(workerCount);
    const qtyNum = Number(quantity);
    const unitNum = Number(unitCostIqd);

    const tpl: RecurringExpenseTemplate = {
      id: `tpl_${Date.now().toString(36)}`,
      title: description.trim(),
      category,
      amountIqd: Math.round(num),
      agencyId: selectedAgency?.id,
      ...(category === 'custom'
        ? { customCategoryLabel: customCategoryLabel.trim() || 'مصروفات خاصة' }
        : {}),
      ...(category === 'worker_wages'
        ? {
            workerNames: workerNames.trim() || undefined,
            workerCount: Number.isFinite(wCount) && wCount > 0 ? wCount : undefined,
            wageBasis,
          }
        : {}),
      ...(Number.isFinite(qtyNum) && qtyNum > 0 ? { quantity: qtyNum } : {}),
      ...(Number.isFinite(unitNum) && unitNum > 0 ? { unitCostIqd: unitNum } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    onUpdateGeneralPrefs({
      recurringExpenseTemplates: [tpl, ...recurringTemplates].slice(0, 12),
    });
  };

  const handleApplyTemplate = (tpl: RecurringExpenseTemplate) => {
    if (!selectedAgency) return;
    onAddExpense({
      agencyId: selectedAgency.id,
      description: tpl.title,
      amountIqd: tpl.amountIqd,
      category: tpl.category,
      occurredAt: new Date().toISOString().slice(0, 10),
      customCategoryLabel: tpl.customCategoryLabel,
      workerNames: tpl.workerNames,
      workerCount: tpl.workerCount,
      wageBasis: tpl.wageBasis,
      quantity: tpl.quantity,
      unitCostIqd: tpl.unitCostIqd,
      quotaLabel: linkToActiveQuota && activeQuotaLabel ? activeQuotaLabel : undefined,
      notes: tpl.notes,
    });
  };

  const handleDeleteTemplate = (tplId: string) => {
    if (!onUpdateGeneralPrefs) return;
    onUpdateGeneralPrefs({
      recurringExpenseTemplates: recurringTemplates.filter((t) => t.id !== tplId),
    });
  };

  const handleAddCustomCategory = () => {
    const clean = newCustomCatInput.trim();
    if (!clean) return;
    setCustomCategoryLabel(clean);
    if (onUpdateGeneralPrefs && !customCategories.includes(clean)) {
      onUpdateGeneralPrefs({
        customExpenseCategories: [...customCategories, clean],
      });
    }
    setNewCustomCatInput('');
  };

  const handleRemoveCustomCategory = (catLabel: string) => {
    if (!onUpdateGeneralPrefs) return;
    const next = customCategories.filter((c) => c !== catLabel);
    onUpdateGeneralPrefs({ customExpenseCategories: next });
    if (customCategoryLabel === catLabel) {
      setCustomCategoryLabel(next[0] || 'مصروفات خاصة');
    }
  };

  // Financial distribution bar percentages
  const barBase = Math.max(1, metrics.revenue, metrics.totalExpenses);
  const wagesPct = Math.round((metrics.workerWages / barBase) * 100);
  const packagingPct = Math.round((metrics.packagingExpenses / barBase) * 100);
  const hospitalityPct = Math.round((metrics.hospitalityExpenses / barBase) * 100);
  const otherExpPct = Math.round(
    ((metrics.generalExpenses -
      metrics.packagingExpenses -
      metrics.hospitalityExpenses) /
      barBase) *
      100
  );
  const profitMarginPct =
    metrics.revenue > 0
      ? Math.round((metrics.profit / metrics.revenue) * 100)
      : 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 pb-24 sm:p-6 sm:pb-20">
      {/* Top Living Finance Header */}
      <div className="nexus-squircle flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3.5 min-w-0">
          <NexusDuotoneIcon sizeClass="hidden sm:flex h-11 w-11">
            <Wallet className="h-5 w-5" />
          </NexusDuotoneIcon>
          <div className="min-w-0">
            <h1 className="text-lg font-black sm:text-xl">
              الحسابات والمالية والتشغيل
            </h1>
            <p
              className="mt-1 text-xs sm:text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              إدارة الإيرادات، أجور العمال، مستلزمات التعبئة، الضيافة، والمصروفات الخاصة مع حساب صافي الربح لحظياً
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={selectedAgency?.id}
            onChange={(e) => setSelectedAgencyId(Number(e.target.value))}
            aria-label="اختيار الوكالة في المالية"
            className="living-control min-h-[40px] rounded-xl border px-3 py-2 text-xs font-extrabold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>

          {capabilities.canUseExcelTools && selectedAgency && (
            <button
              type="button"
              onClick={() =>
                runAsyncExportTask(
                  `جاري تجهيز التقرير المالي (${selectedAgency.name})...`,
                  `تم تصدير التقرير المالي «${selectedAgency.name}» بنجاح`,
                  () => {
                    exportFinancialReportToExcel({
                      agencyName: selectedAgency.name,
                      persons: scopedPersons,
                      expenses: scopedExpenses,
                      settings: calculationSettings,
                    });
                  }
                )
              }
              className="nexus-pill-btn inline-flex min-h-[40px] items-center gap-1.5 border px-4 py-2 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>تصدير التقرير المالي</span>
            </button>
          )}
        </div>
      </div>

      {/* 6 Required Financial KPIs + Live Breakdown Bar */}
      <section
        aria-label="ملخص الحسابات للوكالة"
        data-assistant-target="finance-kpi-grid"
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="nexus-squircle p-4 sm:p-5">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              عدد الأكياس
            </div>
            <div className="mt-1.5 text-xl font-black tabular-nums">
              {metrics.fullBags} كيس
              {metrics.remainderKg > 0
                ? ` + ${formatNumberCompact(metrics.remainderKg)} كغم`
                : ''}
            </div>
          </div>

          <div className="nexus-squircle p-4 sm:p-5">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              عدد الأفراد المشمولين
            </div>
            <div className="mt-1.5 text-xl font-black tabular-nums">
              {metrics.activeIndividuals} فرد
            </div>
          </div>

          <div className="nexus-squircle p-4 sm:p-5">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              الإيرادات التقديرية
            </div>
            <div
              className="mt-1.5 text-xl font-black tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {formatIqd(metrics.revenue)}
            </div>
          </div>

          <div className="nexus-squircle p-4 sm:p-5">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              أجور العمال
            </div>
            <div
              className="mt-1.5 text-xl font-black tabular-nums"
              style={{ color: 'var(--warning)' }}
            >
              {formatIqd(metrics.workerWages)}
            </div>
          </div>

          <div className="nexus-squircle p-4 sm:p-5">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              الصرفيات التشغيلية (تعبئة · ضيافة · خاصة)
            </div>
            <div
              className="mt-1.5 text-xl font-black tabular-nums"
              style={{ color: 'var(--danger)' }}
            >
              {formatIqd(metrics.generalExpenses)}
            </div>
          </div>

          <div
            className="nexus-squircle p-4 sm:p-5"
            style={{
              borderColor:
                metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              <span>صافي الأرباح (الإيرادات − الأجور − الصرفيات)</span>
              <span
                className="font-extrabold tabular-nums"
                style={{
                  color: metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {profitMarginPct}%
              </span>
            </div>
            <div
              className="mt-1.5 text-xl font-black tabular-nums"
              style={{
                color: metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {formatIqd(metrics.profit)}
            </div>
          </div>
        </div>

        {/* Live Expense Category Breakdown Progress Bar */}
        <div className="nexus-squircle p-4 sm:p-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-extrabold">توزيع المصروفات مقابل الإيراد</span>
            <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
              <span style={{ color: 'var(--warning)' }}>
                ● أجور العمال: {formatIqd(metrics.workerWages)}
              </span>
              <span style={{ color: 'var(--accent)' }}>
                ● التعبئة: {formatIqd(metrics.packagingExpenses)}
              </span>
              <span style={{ color: 'var(--success)' }}>
                ● الضيافة: {formatIqd(metrics.hospitalityExpenses)}
              </span>
              <span style={{ color: 'var(--danger)' }}>
                ● خاصة وعامة:{' '}
                {formatIqd(
                  metrics.generalExpenses -
                    metrics.packagingExpenses -
                    metrics.hospitalityExpenses
                )}
              </span>
            </div>
          </div>

          <div className="nexus-progress-track flex h-3 w-full">
            {wagesPct > 0 && (
              <div
                className="nexus-progress-glow h-full"
                style={{ width: `${wagesPct}%`, backgroundColor: 'var(--warning)' }}
                title={`أجور العمال: ${formatIqd(metrics.workerWages)}`}
              />
            )}
            {packagingPct > 0 && (
              <div
                className="nexus-progress-glow h-full"
                style={{ width: `${packagingPct}%`, backgroundColor: 'var(--accent)' }}
                title={`مستلزمات التعبئة: ${formatIqd(metrics.packagingExpenses)}`}
              />
            )}
            {hospitalityPct > 0 && (
              <div
                className="nexus-progress-glow h-full"
                style={{ width: `${hospitalityPct}%`, backgroundColor: 'var(--success)' }}
                title={`ضيافة وطعام: ${formatIqd(metrics.hospitalityExpenses)}`}
              />
            )}
            {otherExpPct > 0 && (
              <div
                className="nexus-progress-glow h-full"
                style={{ width: `${otherExpPct}%`, backgroundColor: 'var(--danger)' }}
                title="مصروفات خاصة وعامة"
              />
            )}
          </div>
        </div>
      </section>

      {/* Smart Operational Expenses & Worker Wages Engine */}
      {capabilities.canManageFinance && (
        <section className="nexus-squircle p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>محرك المصروفات التشغيلية وأجور العمال ({selectedAgency?.name})</span>
              </h2>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                اختر الفئة لتفعيل الحقول الذكية والتعبئة السريعة، أو أعد استخدام قالب متكرر بضغطة واحدة.
              </p>
            </div>

            {activeQuotaLabel && (
              <label
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold cursor-pointer"
                style={{
                  backgroundColor: linkToActiveQuota
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                  borderColor: linkToActiveQuota
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                }}
              >
                <input
                  type="checkbox"
                  checked={linkToActiveQuota}
                  onChange={(e) => setLinkToActiveQuota(e.target.checked)}
                />
                <span>ربط بالحصة: {activeQuotaLabel}</span>
              </label>
            )}
          </div>

          {/* 4 Smart Category Tabs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                {
                  id: 'worker_wages',
                  label: 'أجور العمال',
                  sub: 'يومي · حصة · عامل',
                  icon: <HardHat className="h-4 w-4" />,
                },
                {
                  id: 'packaging',
                  label: 'مستلزمات التعبئة',
                  sub: 'علاليك · كواني · ربط',
                  icon: <PackageOpen className="h-4 w-4" />,
                },
                {
                  id: 'hospitality',
                  label: 'ضيافة وطعام',
                  sub: 'أكل · شاي · مياه',
                  icon: <Coffee className="h-4 w-4" />,
                },
                {
                  id: 'custom',
                  label: 'مصروفات خاصة ومخصصة',
                  sub: 'تصنيفات مرنة وقوالب',
                  icon: <Tag className="h-4 w-4" />,
                },
              ] as const
            ).map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className="living-control flex items-center gap-2.5 rounded-xl border p-3 text-right"
                  style={{
                    backgroundColor: active
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: active
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {tab.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-extrabold">
                      {tab.label}
                    </span>
                    <span
                      className="block truncate text-[10px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {tab.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* One-Tap Presets Strip per Category */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {category === 'worker_wages' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setWageBasis('daily');
                    setDescription('أجر يومي — عمال التوزيع');
                    setWorkerCount('2');
                    const rate = calculationSettings.defaultWorkerWageIqd || 15000;
                    setWagePerWorker(String(rate));
                    setAmount(String(rate * 2));
                  }}
                  className="living-control rounded-lg border px-2.5 py-1.5 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  + عمال توزيع يومي
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWageBasis('per_quota');
                    setDescription('أجور تحميل وتنزيل الحصة');
                    const rate = calculationSettings.defaultWorkerWageIqd || 25000;
                    setAmount(String(rate));
                  }}
                  className="living-control rounded-lg border px-2.5 py-1.5 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  + تحميل وتنزيل شاحنة
                </button>
              </>
            )}

            {category === 'packaging' &&
              PACKAGING_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDescription(preset.label);
                    setQuantity('1');
                    setUnitCostIqd(String(preset.unitCost));
                    setAmount(String(preset.unitCost));
                  }}
                  className="living-control rounded-lg border px-2.5 py-1.5 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  + {preset.label} ({formatIqd(preset.unitCost)})
                </button>
              ))}

            {category === 'hospitality' &&
              HOSPITALITY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDescription(preset.label);
                    setQuantity('1');
                    setUnitCostIqd(String(preset.unitCost));
                    setAmount(String(preset.unitCost));
                  }}
                  className="living-control rounded-lg border px-2.5 py-1.5 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  + {preset.label} ({formatIqd(preset.unitCost)})
                </button>
              ))}

            {category === 'custom' && (
              <div className="flex flex-wrap items-center gap-1.5 w-full">
                {customCategories.map((catLabel) => (
                  <span
                    key={catLabel}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                    style={{
                      backgroundColor:
                        customCategoryLabel === catLabel
                          ? 'var(--bg-nav-active)'
                          : 'var(--bg-main)',
                      borderColor:
                        customCategoryLabel === catLabel
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCustomCategoryLabel(catLabel)}
                      className="text-[11px] font-bold"
                    >
                      {catLabel}
                    </button>
                    {onUpdateGeneralPrefs && customCategories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomCategory(catLabel)}
                        aria-label={`حذف تصنيف ${catLabel}`}
                        className="opacity-60 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}

                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newCustomCatInput}
                    onChange={(e) => setNewCustomCatInput(e.target.value)}
                    placeholder="تصنيف جديد..."
                    className="h-7 w-28 rounded-lg border px-2 text-[11px]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="h-7 rounded-lg border px-2 text-[11px] font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    + إضافة تصنيف
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Inputs */}
          <form onSubmit={handleAdd} className="space-y-3">
            {/* Category-Specific Smart Fields */}
            {category === 'worker_wages' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <select
                  value={wageBasis}
                  onChange={(e) => setWageBasis(e.target.value as WageBasis)}
                  aria-label="نوع الأجر"
                  className="min-h-[40px] rounded-xl border px-3 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="daily">احتساب: يومي</option>
                  <option value="per_quota">احتساب: لكل حصة</option>
                  <option value="per_worker">احتساب: لكل عامل</option>
                  <option value="fixed">احتساب: مقطوع</option>
                </select>

                <input
                  type="text"
                  value={workerNames}
                  onChange={(e) => setWorkerNames(e.target.value)}
                  placeholder="أسماء العمال (اختياري)"
                  className="min-h-[40px] rounded-xl border px-3 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />

                <input
                  type="number"
                  min={1}
                  value={workerCount}
                  onChange={(e) => {
                    setWorkerCount(e.target.value);
                    autoCalcWorkersTotal(e.target.value, wagePerWorker);
                  }}
                  placeholder="عدد العمال"
                  className="min-h-[40px] rounded-xl border px-3 text-xs tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />

                <input
                  type="number"
                  min={0}
                  value={wagePerWorker}
                  onChange={(e) => {
                    setWagePerWorker(e.target.value);
                    autoCalcWorkersTotal(workerCount, e.target.value);
                  }}
                  placeholder="أجر العامل الواحد (د.ع)"
                  className="min-h-[40px] rounded-xl border px-3 text-xs tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
            )}

            {(category === 'packaging' || category === 'hospitality') && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    autoCalcQtyTotal(e.target.value, unitCostIqd);
                  }}
                  placeholder="الكمية / العدد (مثال: 5 ربطات أو 4 وجبات)"
                  className="min-h-[40px] rounded-xl border px-3 text-xs tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <input
                  type="number"
                  min={0}
                  value={unitCostIqd}
                  onChange={(e) => {
                    setUnitCostIqd(e.target.value);
                    autoCalcQtyTotal(quantity, e.target.value);
                  }}
                  placeholder="سعر الوحدة الواحدة (د.ع)"
                  className="min-h-[40px] rounded-xl border px-3 text-xs tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
            )}

            {/* Core Description, Date, Notes, Amount & Submit */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  category === 'worker_wages'
                    ? 'البيان (مثال: أجور تحميل وتنزيل)'
                    : category === 'packaging'
                    ? 'البيان (مثال: شراء علاليك وكواني)'
                    : category === 'hospitality'
                    ? 'البيان (مثال: غداء وشاي للعمال)'
                    : 'البيان التفصيلي للمصروف الخاص...'
                }
                className="min-h-[42px] rounded-xl border px-3 text-xs sm:col-span-4"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                aria-label="تاريخ الصرف"
                className="min-h-[42px] rounded-xl border px-3 text-xs tabular-nums sm:col-span-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظة إضافية (اختياري)"
                className="min-h-[42px] rounded-xl border px-3 text-xs sm:col-span-3"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <div className="flex gap-2 sm:col-span-3">
                <input
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="المبلغ (د.ع)"
                  className="min-h-[42px] w-full rounded-xl border px-3 text-xs font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <button
                  type="submit"
                  className="nexus-pill-btn inline-flex min-h-[42px] shrink-0 items-center gap-1 px-4 text-xs font-extrabold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>تسجيل</span>
                </button>
              </div>
            </div>

            {onUpdateGeneralPrefs && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  disabled={!description.trim() || Number(amount) <= 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold disabled:opacity-45"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <BookmarkPlus className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>حفظ كقالب متكرر لإعادة التسجيل السريع</span>
                </button>
              </div>
            )}
          </form>

          {/* Saved Recurring Expense Templates */}
          {recurringTemplates.length > 0 && (
            <div
              className="border-t pt-3 space-y-2"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
                <Repeat className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>قوالب المصروفات المتكررة (تسجيل بضغطة واحدة للوكالة الحالية):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recurringTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="font-bold hover:text-[var(--accent)]"
                    >
                      + {tpl.title} ({formatIqd(tpl.amountIqd)})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      aria-label={`حذف قالب ${tpl.title}`}
                      className="opacity-55 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Expenses Ledger Table + Category Filter Strip */}
      <section className="nexus-squircle overflow-hidden">
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <Filter className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>سجل الصرفيات والأجور ({filteredExpenses.length})</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {(
              [
                ['all', 'الكل'],
                ['worker_wages', 'أجور العمال'],
                ['packaging', 'التعبئة'],
                ['hospitality', 'الضيافة'],
                ['custom', 'خاصة وعامة'],
              ] as Array<[CategoryFilter, string]>
            ).map(([fKey, fLabel]) => (
              <button
                key={fKey}
                type="button"
                onClick={() => setLedgerFilter(fKey)}
                className="rounded-lg border px-2.5 py-1 font-bold transition-colors"
                style={{
                  backgroundColor:
                    ledgerFilter === fKey ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor:
                    ledgerFilter === fKey ? 'var(--accent)' : 'var(--border-color)',
                  color: ledgerFilter === fKey ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {fLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-xs">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
                <th className="border-b px-3 py-2.5">التاريخ</th>
                <th className="border-b px-3 py-2.5">التصنيف</th>
                <th className="border-b px-3 py-2.5">البيان والتفاصيل</th>
                <th className="border-b px-3 py-2.5 text-center">المبلغ</th>
                {capabilities.canManageFinance && (
                  <th className="border-b px-3 py-2.5 text-center">حذف</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    لا توجد أجور عمال أو صرفيات ضمن هذا التصنيف للوكالة الحالية.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const detailParts: string[] = [];
                  if (exp.wageBasis) {
                    detailParts.push(`النوع: ${WAGE_BASIS_LABELS[exp.wageBasis]}`);
                  }
                  if (exp.workerCount) {
                    detailParts.push(`العدد: ${exp.workerCount} عامل`);
                  }
                  if (exp.workerNames) {
                    detailParts.push(`العمال: ${exp.workerNames}`);
                  }
                  if (exp.quantity && exp.unitCostIqd) {
                    detailParts.push(
                      `${exp.quantity} × ${formatIqd(exp.unitCostIqd)}`
                    );
                  } else if (exp.quantity) {
                    detailParts.push(`الكمية: ${exp.quantity}`);
                  }
                  if (exp.quotaLabel) {
                    detailParts.push(exp.quotaLabel);
                  }
                  if (exp.notes) {
                    detailParts.push(exp.notes);
                  }

                  return (
                    <tr
                      key={exp.id}
                      className="border-b"
                      style={{ borderColor: 'var(--grid-color)' }}
                    >
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                        {exp.occurredAt}
                      </td>
                      <td className="px-3 py-2.5 font-bold whitespace-nowrap">
                        <span
                          className="inline-flex rounded-md border px-2 py-0.5 text-[11px]"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          {getExpenseCategoryLabel(
                            exp.category,
                            exp.customCategoryLabel
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold">{exp.description}</div>
                        {detailParts.length > 0 && (
                          <div
                            className="mt-0.5 text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {detailParts.join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black tabular-nums whitespace-nowrap">
                        {formatIqd(exp.amountIqd)}
                      </td>
                      {capabilities.canManageFinance && (
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => onRequestDeleteExpense(exp)}
                            aria-label={`حذف مصروف ${exp.description}`}
                            className="living-control rounded-lg border p-1.5 hover:opacity-80"
                            style={{
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
