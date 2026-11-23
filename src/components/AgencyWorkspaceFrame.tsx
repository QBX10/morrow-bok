import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import type {
  Agency,
  AgencyExpense,
  AppView,
  CalculationSettings,
  MonthlyArchiveRecord,
  Person,
  SettingsSectionId,
} from '../types/agency';
import {
  auditAgencyPersons,
  calculateAllocation,
  computeAgencyMetrics,
  formatIqd,
  formatQuota,
  formatTotalQuota,
} from '../utils/agencyLogic';
import { BottomSheet } from './cosmos/BottomSheet';

export type AgencySubTabId = 'table' | 'overview' | 'calculator' | 'audit' | 'archives';

interface AgencyWorkspaceFrameProps {
  agencies: Agency[];
  currentAgency: Agency;
  persons: Person[];
  expenses: AgencyExpense[];
  archives: MonthlyArchiveRecord[];
  calculationSettings: CalculationSettings;
  agencyAccentColors?: Record<number, string>;
  onSelectAgency: (agencyId: number) => void;
  onNavigateView: (view: AppView, settingsSection?: SettingsSectionId) => void;
  children: React.ReactNode;
}

const SUB_TABS: Array<{ id: AgencySubTabId; label: string; icon: React.ReactNode }> = [
  { id: 'table', label: 'الجدول', icon: <Table2 className="h-3.5 w-3.5" /> },
  { id: 'overview', label: 'نظرة', icon: <Eye className="h-3.5 w-3.5" /> },
  { id: 'calculator', label: 'الحاسبة', icon: <Calculator className="h-3.5 w-3.5" /> },
  { id: 'audit', label: 'المطابقة', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'archives', label: 'الأرشفة', icon: <Archive className="h-3.5 w-3.5" /> },
];

export const AgencyWorkspaceFrame: React.FC<AgencyWorkspaceFrameProps> = ({
  agencies,
  currentAgency,
  persons,
  expenses,
  archives,
  calculationSettings,
  agencyAccentColors = {},
  onSelectAgency,
  onNavigateView,
  children,
}) => {
  const [subTab, setSubTab] = useState<AgencySubTabId>('table');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [calcCount, setCalcCount] = useState('5');

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentIdx = agencies.findIndex((a) => a.id === currentAgency.id);
  const prevAgency = currentIdx > 0 ? agencies[currentIdx - 1] : null;
  const nextAgency =
    currentIdx >= 0 && currentIdx < agencies.length - 1 ? agencies[currentIdx + 1] : null;

  const agencyPersons = useMemo(
    () => persons.filter((p) => p.agencyId === currentAgency.id),
    [persons, currentAgency.id]
  );

  const agencyExpenses = useMemo(
    () => expenses.filter((ex) => ex.agencyId === currentAgency.id),
    [expenses, currentAgency.id]
  );

  const summary = useMemo(() => {
    const metrics = computeAgencyMetrics(
      agencyPersons,
      agencyExpenses,
      calculationSettings
    );
    return {
      familiesCount: metrics.activeHouseholds,
      totalIndividuals: metrics.activeIndividuals,
      totalBagsLabel: formatTotalQuota(metrics.totalKg, calculationSettings),
      totalPriceIqd: metrics.revenue,
      blockedCount: metrics.blockedCount,
    };
  }, [agencyPersons, agencyExpenses, calculationSettings]);

  const agencyExpensesTotal = useMemo(
    () => agencyExpenses.reduce((acc, ex) => acc + ex.amountIqd, 0),
    [agencyExpenses]
  );

  const auditIssues = useMemo(
    () => auditAgencyPersons(agencyPersons),
    [agencyPersons]
  );

  const calcSample = useMemo(() => {
    const n = Math.max(0, Math.min(99999, Number(calcCount) || 0));
    return {
      n,
      alloc: calculateAllocation(n, calculationSettings),
      quota: formatQuota(n, undefined, calculationSettings),
    };
  }, [calcCount, calculationSettings]);

  const accentColor = agencyAccentColors[currentAgency.id] || 'var(--accent)';

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > 68 && Math.abs(dy) < 42) {
      if (dx > 0 && prevAgency) {
        onSelectAgency(prevAgency.id);
      } else if (dx < 0 && nextAgency) {
        onSelectAgency(nextAgency.id);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* External Frame Header (Swipe Left/Right on header switches agencies) */}
      <section
        onTouchStart={handleHeaderTouchStart}
        onTouchEnd={handleHeaderTouchEnd}
        className="no-print tabrix-card border px-3.5 py-3 sm:px-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Agency Identity + Picker Trigger */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg shadow-xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${accentColor} 14%, var(--bg-main))`,
                borderColor: `color-mix(in srgb, ${accentColor} 40%, var(--border-color))`,
              }}
            >
              {currentAgency.icon}
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSwitcherOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm sm:text-base font-black truncate hover:opacity-80"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accentColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{currentAgency.name}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-65" />
                </button>
              </div>
              <p
                className="text-[11px] font-semibold tabular-nums truncate mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {summary.familiesCount} عائلة · {summary.totalIndividuals} فرد ·{' '}
                {summary.totalBagsLabel} · {formatIqd(summary.totalPriceIqd)}
              </p>
            </div>
          </div>

          {/* Prev / Next Agency Controls (Desktop + Mobile Swipe Hint) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!prevAgency}
              onClick={() => prevAgency && onSelectAgency(prevAgency.id)}
              title={prevAgency ? `الوكالة السابقة: ${prevAgency.name}` : 'أول وكالة'}
              aria-label="الوكالة السابقة"
              className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2.5 text-xs font-bold disabled:opacity-35 hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSwitcherOpen(true)}
              className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-bold hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Building2 className="h-3.5 w-3.5" style={{ color: accentColor }} />
              <span className="tabular-nums">
                {currentIdx + 1}/{agencies.length}
              </span>
            </button>
            <button
              type="button"
              disabled={!nextAgency}
              onClick={() => nextAgency && onSelectAgency(nextAgency.id)}
              title={nextAgency ? `الوكالة التالية: ${nextAgency.name}` : 'آخر وكالة'}
              aria-label="الوكالة التالية"
              className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2.5 text-xs font-bold disabled:opacity-35 hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-Tabs Strip */}
        <div
          className="mt-3 flex items-center gap-1.5 overflow-x-auto border-t pt-2.5 pb-0.5"
          style={{ borderColor: 'var(--border-color)' }}
          role="tablist"
          aria-label="تبويبات الوكالة"
        >
          {SUB_TABS.map((tab) => {
            const active = subTab === tab.id;
            const badge =
              tab.id === 'audit' && auditIssues.length > 0
                ? auditIssues.length
                : tab.id === 'archives' && archives.length > 0
                  ? archives.length
                  : undefined;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubTab(tab.id)}
                className="cosmos-touch-target inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-colors"
                style={{
                  backgroundColor: active
                    ? `color-mix(in srgb, ${accentColor} 14%, var(--bg-nav-active))`
                    : 'var(--bg-main)',
                  borderColor: active ? accentColor : 'var(--border-color)',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <span style={{ color: active ? accentColor : 'var(--text-muted)' }}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {badge !== undefined && (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                    style={{
                      backgroundColor:
                        tab.id === 'audit' ? 'var(--warning-bg)' : 'var(--bg-surface)',
                      color:
                        tab.id === 'audit' ? 'var(--warning)' : 'var(--text-muted)',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Sub-Tab Body */}
      {subTab === 'table' && children}

      {subTab === 'overview' && (
        <div
          className="tabrix-card border p-4 sm:p-6 space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black">نظرة تنفيذية — {currentAgency.name}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                ملخص الحصص والمستفيدين دون مغادرة سياق الوكالة
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('table')}
              className="cosmos-touch-target rounded-xl px-4 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: accentColor,
                color: '#ffffff',
              }}
            >
              فتح الجدول المباشر
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              className="rounded-2xl border p-3.5"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                العائلات النشطة
              </div>
              <div className="mt-1 text-xl font-black tabular-nums">
                {summary.familiesCount}
              </div>
            </div>
            <div
              className="rounded-2xl border p-3.5"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                مجموع الأفراد
              </div>
              <div className="mt-1 text-xl font-black tabular-nums">
                {summary.totalIndividuals}
              </div>
            </div>
            <div
              className="rounded-2xl border p-3.5"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                الحصة الإجمالية
              </div>
              <div className="mt-1 text-xl font-black tabular-nums" style={{ color: accentColor }}>
                {summary.totalBagsLabel}
              </div>
            </div>
            <div
              className="rounded-2xl border p-3.5"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                المبالغ والمصاريف
              </div>
              <div
                className="mt-1 text-base font-black tabular-nums"
                style={{ color: 'var(--success)' }}
              >
                {formatIqd(summary.totalPriceIqd)}
              </div>
              <div className="text-[10px] font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                مصاريف مسجلة: {formatIqd(agencyExpensesTotal)}
              </div>
            </div>
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 text-xs"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>
              سجلات محجوبة: <strong className="tabular-nums">{summary.blockedCount}</strong> ·
              ملاحظات تدقيق: <strong className="tabular-nums">{auditIssues.length}</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigateView('finance')}
              className="font-extrabold hover:underline"
              style={{ color: accentColor }}
            >
              فتح تفاصيل المالية ←
            </button>
          </div>
        </div>
      )}

      {subTab === 'calculator' && (
        <div
          className="tabrix-card border p-4 sm:p-6 space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black">حاسبة الوكالة الفورية — {currentAgency.name}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                حساب مباشر وفق الإعداد الحالي ({formatIqd(calculationSettings.feePerIndividualIqd)} للفرد)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateView('settings', 'calculator')}
              className="cosmos-touch-target rounded-xl border px-3 py-1.5 text-xs font-bold"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              ضبط معادلات الحاسبة
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <label htmlFor="agency-frame-calc" className="block text-xs font-extrabold">
                اختبار عدد أفراد سريع
              </label>
              <input
                id="agency-frame-calc"
                type="number"
                min={0}
                value={calcCount}
                onChange={(e) => setCalcCount(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-base font-black tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[3, 5, 7, 10, summary.totalIndividuals].map((preset, i) => (
                  <button
                    key={`${preset}-${i}`}
                    type="button"
                    onClick={() => setCalcCount(String(preset))}
                    className="rounded-lg border px-2.5 py-1 text-[11px] font-bold tabular-nums hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    {i === 4 ? `إجمالي الوكالة (${preset})` : `${preset} أفراد`}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-2xl border p-4 flex flex-col justify-center space-y-2"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                النتيجة الفورية ({calcSample.n} فرد ×{' '}
                {formatIqd(calculationSettings.feePerIndividualIqd)})
              </div>
              <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--success)' }}>
                {calcSample.alloc ? formatIqd(calcSample.alloc.priceIqd) : '—'}
              </div>
              <div className="text-xs font-bold tabular-nums" style={{ color: accentColor }}>
                الحصة المقدرة: {calcSample.quota}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'audit' && (
        <div
          className="tabrix-card border p-4 sm:p-6 space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black">فحص ومطابقة سجلات {currentAgency.name}</h3>
              <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                إجمالي الملاحظات المكتشفة في هذه الوكالة: {auditIssues.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('table')}
              className="cosmos-touch-target rounded-xl border px-3 py-1.5 text-xs font-bold"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              معالجة في الجدول
            </button>
          </div>

          {auditIssues.length === 0 ? (
            <div
              className="flex items-center gap-3 rounded-2xl border p-4 text-xs font-bold"
              style={{
                backgroundColor: 'var(--success-bg)',
                borderColor: 'var(--success)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>جميع سجلات {currentAgency.name} مكتملة وسليمة بدون تعارضات.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {auditIssues.slice(0, 12).map((issue, idx) => (
                <div
                  key={`${issue.personId}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--warning-bg)',
                    borderColor: 'var(--warning)',
                  }}
                >
                  <span className="font-bold">{issue.message}</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {issue.personName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'archives' && (
        <div
          className="tabrix-card border p-4 sm:p-6 space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black">أرشفة {currentAgency.name}</h3>
              <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                تتوفر {archives.length} دورة مؤرشفة على مستوى النظام للمقارنة والمطابقة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateView('data_archives')}
              className="cosmos-touch-target rounded-xl px-4 py-2 text-xs font-extrabold"
              style={{ backgroundColor: accentColor, color: '#ffffff' }}
            >
              فتح مركز الأرشفة والمطابقة
            </button>
          </div>
          {archives.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {archives.slice(0, 4).map((arc) => {
                const countInAgency = arc.persons.filter(
                  (p) => p.agencyId === currentAgency.id
                ).length;
                return (
                  <div
                    key={arc.id}
                    className="rounded-xl border p-3 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="font-extrabold">{arc.label}</div>
                    <div className="mt-1 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      سجلات هذه الوكالة في الأرشيف: {countInAgency}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Agency Quick Switcher BottomSheet */}
      <BottomSheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="التبديل السريع بين الوكالات"
        subtitle="اختر الوكالة لفتح مساحة عملها مباشرة"
        icon={<Building2 className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {agencies.map((ag) => {
            const active = ag.id === currentAgency.id;
            const color = agencyAccentColors[ag.id] || 'var(--accent)';
            const count = persons.filter((p) => p.agencyId === ag.id).length;
            return (
              <button
                key={ag.id}
                type="button"
                onClick={() => {
                  onSelectAgency(ag.id);
                  setSwitcherOpen(false);
                }}
                className="cosmos-touch-primary flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-right transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor: active ? color : 'var(--border-color)',
                }}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: `color-mix(in srgb, ${color} 45%, var(--border-color))`,
                    }}
                  >
                    {ag.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{ag.name}</span>
                    <span
                      className="block text-[11px] tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {count} عائلة مسجلة
                    </span>
                  </span>
                </span>
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
};
