import React, { useMemo, useState } from 'react';
import { Download, Plus, Trash2, Wallet } from 'lucide-react';
import type {
  Agency,
  AgencyExpense,
  CalculationSettings,
  ExpenseCategory,
  Person,
} from '../types/agency';
import {
  computeAgencyMetrics,
  formatIqd,
  formatNumberCompact,
} from '../utils/agencyLogic';
import { runAsyncExportTask } from '../hooks/useToastQueue';
import { exportFinancialReportToExcel } from '../utils/excelExport';
import type { ModeCapabilities } from '../utils/modePermissions';

interface FinanceWorkspaceViewProps {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  onAddExpense: (input: {
    agencyId: number;
    description: string;
    amountIqd: number;
    category: ExpenseCategory;
  }) => void;
  onRequestDeleteExpense: (expense: AgencyExpense) => void;
}

export const FinanceWorkspaceView: React.FC<FinanceWorkspaceViewProps> = ({
  agencies,
  persons,
  expenses,
  calculationSettings,
  capabilities,
  onAddExpense,
  onRequestDeleteExpense,
}) => {
  const [selectedAgencyId, setSelectedAgencyId] = useState<number>(
    agencies[0]?.id ?? 1
  );
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('worker_wages');

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

  const metrics = useMemo(
    () =>
      computeAgencyMetrics(
        scopedPersons,
        scopedExpenses,
        calculationSettings
      ),
    [scopedPersons, scopedExpenses, calculationSettings]
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!description.trim() || !Number.isFinite(num) || num <= 0) return;
    onAddExpense({
      agencyId: selectedAgency.id,
      description: description.trim(),
      amountIqd: num,
      category,
    });
    setDescription('');
    setAmount('');
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 pb-24 sm:p-6 sm:pb-20">
      <div
        className="tabrix-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <span
            className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'color-mix(in srgb, var(--accent) 26%, var(--border-color))',
              color: 'var(--accent)',
            }}
            aria-hidden="true"
          >
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold sm:text-xl">الحسابات والمالية</h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
              تفاصيل الأكياس، الأفراد، الإيرادات، أجور العمال، الصرفيات، وصافي الأرباح لكل وكالة
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={selectedAgency?.id}
            onChange={(e) => setSelectedAgencyId(Number(e.target.value))}
            aria-label="اختيار الوكالة في المالية"
            className="rounded-lg border px-3 py-2 text-xs font-bold"
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
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير التقرير المالي</span>
            </button>
          )}
        </div>
      </div>

      {/* 6 Required Financial KPIs */}
      <section
        aria-label="ملخص الحسابات للوكالة"
        data-assistant-target="finance-kpi-grid"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            عدد الأكياس
          </div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">
            {metrics.fullBags} كيس
            {metrics.remainderKg > 0
              ? ` + ${formatNumberCompact(metrics.remainderKg)} كغم`
              : ''}
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            عدد الأفراد
          </div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">
            {metrics.activeIndividuals} فرد
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            الإيرادات
          </div>
          <div
            className="mt-1.5 text-xl font-bold tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {formatIqd(metrics.revenue)}
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            أجور العمال
          </div>
          <div
            className="mt-1.5 text-xl font-bold tabular-nums"
            style={{ color: 'var(--warning)' }}
          >
            {formatIqd(metrics.workerWages)}
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            الصرفيات
          </div>
          <div
            className="mt-1.5 text-xl font-bold tabular-nums"
            style={{ color: 'var(--danger)' }}
          >
            {formatIqd(metrics.generalExpenses)}
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor:
              metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            صافي الأرباح (الإيرادات − الأجور − الصرفيات)
          </div>
          <div
            className="mt-1.5 text-xl font-bold tabular-nums"
            style={{
              color: metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {formatIqd(metrics.profit)}
          </div>
        </div>
      </section>

      {/* Add Worker Wage / General Expense Form (Unlocked in Professional & Expert) */}
      {capabilities.canManageFinance && (
        <section
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">
              تسجيل أجور العمال أو الصرفيات ({selectedAgency?.name})
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {(calculationSettings.defaultWorkerWageIqd ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('worker_wages');
                    setDescription('أجور عمال التوزيع والتحميل');
                    setAmount(String(calculationSettings.defaultWorkerWageIqd));
                  }}
                  className="rounded-lg border px-2.5 py-1 font-bold tabular-nums hover:opacity-85"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  تعبئة أجر عامل ({formatIqd(calculationSettings.defaultWorkerWageIqd || 0)})
                </button>
              )}
              {(calculationSettings.defaultGeneralExpenseIqd ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('general');
                    setDescription('مصاريف تشغيل ونقل');
                    setAmount(String(calculationSettings.defaultGeneralExpenseIqd));
                  }}
                  className="rounded-lg border px-2.5 py-1 font-bold tabular-nums hover:opacity-85"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  تعبئة مصروف عام ({formatIqd(calculationSettings.defaultGeneralExpenseIqd || 0)})
                </button>
              )}
            </div>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              aria-label="تصنيف المصروف"
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <option value="worker_wages">أجور العمال</option>
              <option value="general">صرفيات عامة</option>
            </select>

            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="البيان (مثال: أجور تحميل وتنزيل)"
              className="rounded-lg border px-3 py-2 text-xs sm:col-span-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />

            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="المبلغ (د.ع)"
                className="w-full rounded-lg border px-3 py-2 text-xs tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Expenses Ledger Table */}
      <section
        className="overflow-x-auto rounded-xl border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <table className="w-full border-collapse text-right text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
              <th className="border-b px-3 py-2.5">التاريخ</th>
              <th className="border-b px-3 py-2.5">التصنيف</th>
              <th className="border-b px-3 py-2.5">البيان</th>
              <th className="border-b px-3 py-2.5 text-center">المبلغ</th>
              {capabilities.canManageFinance && (
                <th className="border-b px-3 py-2.5 text-center">حذف</th>
              )}
            </tr>
          </thead>
          <tbody>
            {scopedExpenses.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  لا توجد أجور عمال أو صرفيات مسجلة لهذه الوكالة.
                </td>
              </tr>
            ) : (
              scopedExpenses.map((exp) => (
                <tr
                  key={exp.id}
                  className="border-b"
                  style={{ borderColor: 'var(--grid-color)' }}
                >
                  <td className="px-3 py-2 tabular-nums">{exp.occurredAt}</td>
                  <td className="px-3 py-2 font-semibold">
                    {exp.category === 'worker_wages'
                      ? 'أجور العمال'
                      : 'صرفيات'}
                  </td>
                  <td className="px-3 py-2">{exp.description}</td>
                  <td className="px-3 py-2 text-center font-bold tabular-nums">
                    {formatIqd(exp.amountIqd)}
                  </td>
                  {capabilities.canManageFinance && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onRequestDeleteExpense(exp)}
                        aria-label={`حذف مصروف ${exp.description}`}
                        className="rounded border p-1 hover:opacity-80"
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
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
};
