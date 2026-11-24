import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { CalculationSettings } from '../../../types/agency';
import {
  calculateAllocation,
  DEFAULT_CALCULATION_SETTINGS,
  formatIqd,
  formatQuota,
} from '../../../utils/agencyLogic';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
} from '../../../utils/hierarchyRegistry';
import { resolveHierarchyNodeBadge } from '../../../utils/hierarchyRegistry';
import { CalculatorPresetsStrip } from '../../worlds/CosmosNewWorlds';
import { NodeCard } from '../NodeCard';
import { NodeView } from '../NodeView';

interface CalculatorCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  calculationSettings: CalculationSettings;
  agenciesCount?: number;
  activePeriodLabel?: string;
  onSaveCalculationSettings: (calc: CalculationSettings) => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
}

export const CalculatorCapsules: React.FC<CalculatorCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  calculationSettings,
  agenciesCount = 3,
  activePeriodLabel = 'الفترة الحالية',
  onSaveCalculationSettings,
  onOpenCapsule,
  onNotifySuccess,
}) => {
  const [kgPerInd, setKgPerInd] = useState(
    String(calculationSettings.kgPerIndividual)
  );
  const [kgPerBag, setKgPerBag] = useState(String(calculationSettings.kgPerBag));
  const [feePerInd, setFeePerInd] = useState(
    String(calculationSettings.feePerIndividualIqd)
  );
  const [fixedFee, setFixedFee] = useState(
    String(calculationSettings.fixedCardFeeIqd)
  );
  const [calcMode, setCalcMode] = useState<'instant' | 'manual'>(
    calculationSettings.calculationMode || 'instant'
  );
  const [includeBlocked, setIncludeBlocked] = useState(
    Boolean(calculationSettings.includeBlockedInFees)
  );
  const [roundingStep, setRoundingStep] = useState(
    String(calculationSettings.roundingStepIqd ?? 0)
  );
  const [discountPercent, setDiscountPercent] = useState(
    String(calculationSettings.discountPercent ?? 0)
  );
  const [defaultWorkerWage, setDefaultWorkerWage] = useState(
    String(calculationSettings.defaultWorkerWageIqd ?? 25000)
  );
  const [defaultGeneralExpense, setDefaultGeneralExpense] = useState(
    String(calculationSettings.defaultGeneralExpenseIqd ?? 10000)
  );
  // Rule 6: Default test individuals changed from 6 to 5 (5 × 250 = 1,250)
  const [testIndividuals, setTestIndividuals] = useState('5');

  useEffect(() => {
    setKgPerInd(String(calculationSettings.kgPerIndividual));
    setKgPerBag(String(calculationSettings.kgPerBag));
    setFeePerInd(String(calculationSettings.feePerIndividualIqd));
    setFixedFee(String(calculationSettings.fixedCardFeeIqd));
    setCalcMode(calculationSettings.calculationMode || 'instant');
    setIncludeBlocked(Boolean(calculationSettings.includeBlockedInFees));
    setRoundingStep(String(calculationSettings.roundingStepIqd ?? 0));
    setDiscountPercent(String(calculationSettings.discountPercent ?? 0));
    setDefaultWorkerWage(
      String(calculationSettings.defaultWorkerWageIqd ?? 25000)
    );
    setDefaultGeneralExpense(
      String(calculationSettings.defaultGeneralExpenseIqd ?? 10000)
    );
  }, [calculationSettings]);

  const draftCalcSettings: CalculationSettings = useMemo(
    () => ({
      kgPerIndividual: Math.max(1, Number(kgPerInd) || 9),
      kgPerBag: Math.max(1, Number(kgPerBag) || 50),
      feePerIndividualIqd: Math.max(0, Number(feePerInd) || 0),
      fixedCardFeeIqd: Math.max(0, Number(fixedFee) || 0),
      calculationMode: calcMode,
      includeBlockedInFees: includeBlocked,
      roundingStepIqd: Math.max(0, Number(roundingStep) || 0),
      discountPercent: Math.max(
        0,
        Math.min(100, Number(discountPercent) || 0)
      ),
      defaultWorkerWageIqd: Math.max(0, Number(defaultWorkerWage) || 0),
      defaultGeneralExpenseIqd: Math.max(
        0,
        Number(defaultGeneralExpense) || 0
      ),
    }),
    [
      kgPerInd,
      kgPerBag,
      feePerInd,
      fixedFee,
      calcMode,
      includeBlocked,
      roundingStep,
      discountPercent,
      defaultWorkerWage,
      defaultGeneralExpense,
    ]
  );

  const isDirty = useMemo(
    () =>
      draftCalcSettings.kgPerIndividual !== calculationSettings.kgPerIndividual ||
      draftCalcSettings.kgPerBag !== calculationSettings.kgPerBag ||
      draftCalcSettings.feePerIndividualIqd !==
        calculationSettings.feePerIndividualIqd ||
      draftCalcSettings.fixedCardFeeIqd !==
        calculationSettings.fixedCardFeeIqd ||
      draftCalcSettings.calculationMode !==
        (calculationSettings.calculationMode || 'instant') ||
      Boolean(draftCalcSettings.includeBlockedInFees) !==
        Boolean(calculationSettings.includeBlockedInFees) ||
      (draftCalcSettings.roundingStepIqd ?? 0) !==
        (calculationSettings.roundingStepIqd ?? 0) ||
      (draftCalcSettings.discountPercent ?? 0) !==
        (calculationSettings.discountPercent ?? 0) ||
      (draftCalcSettings.defaultWorkerWageIqd ?? 0) !==
        (calculationSettings.defaultWorkerWageIqd ?? 0) ||
      (draftCalcSettings.defaultGeneralExpenseIqd ?? 0) !==
        (calculationSettings.defaultGeneralExpenseIqd ?? 0),
    [draftCalcSettings, calculationSettings]
  );

  const testCountNum = Math.max(0, Number(testIndividuals) || 0);
  const baseIndividualFeesIqd =
    testCountNum * draftCalcSettings.feePerIndividualIqd;

  const liveTestAllocation = useMemo(
    () => ({
      alloc: calculateAllocation(testCountNum, draftCalcSettings),
      quota: formatQuota(testCountNum, undefined, draftCalcSettings),
    }),
    [testCountNum, draftCalcSettings]
  );

  const handleCommitSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveCalculationSettings(draftCalcSettings);
    onNotifySuccess('تم حفظ إعدادات حاسبة الجدول ومعادلات الرسوم بنجاح.');
  };

  const handleResetCalcBranch = () => {
    const nextDefaults = { ...DEFAULT_CALCULATION_SETTINGS };
    onSaveCalculationSettings(nextDefaults);
    setTestIndividuals('5');
    onNotifySuccess(
      'تمت استعادة افتراضيات حاسبة الجدول فقط (رسم الفرد: 250 د.ع).'
    );
  };

  const renderLivePreviewStrip = () => (
    <div
      data-capsule-node-id="calc_live_preview_box"
      className="capsule-glass-card border p-4 sm:p-5 space-y-3"
      style={{
        borderColor: 'var(--accent)',
        backgroundColor:
          'color-mix(in srgb, var(--bg-nav-active) 45%, var(--bg-surface))',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-extrabold">
            معاينة واختبار المعادلة الحالية لعدد أفراد:
          </span>
          <input
            type="number"
            min={0}
            value={testIndividuals}
            onChange={(e) => setTestIndividuals(e.target.value)}
            aria-label="عدد أفراد اختبار الحاسبة"
            className="min-h-[42px] w-24 rounded-xl border px-3 py-1.5 text-center font-extrabold tabular-nums"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold tabular-nums">
          <span
            className="rounded-xl border px-3 py-1.5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            رسم الأفراد الأساسي: {testCountNum} ×{' '}
            {draftCalcSettings.feePerIndividualIqd} ={' '}
            {formatIqd(baseIndividualFeesIqd)}
          </span>
          <span
            className="rounded-xl border px-3 py-1.5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            الحصة: {liveTestAllocation.quota}
          </span>
          <span
            className="rounded-xl border px-3 py-1.5"
            style={{
              backgroundColor: 'var(--success-bg)',
              borderColor: 'var(--success)',
              color: 'var(--success)',
            }}
          >
            المبلغ النهائي: {formatIqd(liveTestAllocation.alloc?.priceIqd ?? 0)}
          </span>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-[11px]"
        style={{
          borderColor: 'var(--border-color)',
          color: 'var(--text-muted)',
        }}
      >
        <span className="tabular-nums">
          المعادلة: ({testCountNum} فرد × {draftCalcSettings.feePerIndividualIqd}{' '}
          د.ع = {baseIndividualFeesIqd.toLocaleString('en-US')}) + رسم البطاقة (
          {draftCalcSettings.fixedCardFeeIqd.toLocaleString('en-US')} د.ع)
          {(draftCalcSettings.discountPercent ?? 0) > 0
            ? ` − خصم ${draftCalcSettings.discountPercent}%`
            : ''}
          {(draftCalcSettings.roundingStepIqd ?? 0) > 0
            ? ` · تقريب لأقرب ${draftCalcSettings.roundingStepIqd}`
            : ''}
        </span>

        <button
          type="button"
          onClick={() => handleCommitSave()}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>حفظ إعدادات الحاسبة</span>
        </button>
      </div>
    </div>
  );

  // Level 3: Calculator Hub Grid of 4 Sub-Capsules + Live Formula Preview
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={`${draftCalcSettings.kgPerIndividual} كغم · رسم الفرد: ${draftCalcSettings.feePerIndividualIqd}`}
        hasUnsavedDraft={isDirty}
        onResetBranch={handleResetCalcBranch}
        resetBranchLabel="استعادة افتراضيات الحاسبة"
      >
        {renderLivePreviewStrip()}

        <CalculatorPresetsStrip
          currentCalc={draftCalcSettings}
          savedCalc={calculationSettings}
          agenciesCount={agenciesCount}
          activePeriodLabel={activePeriodLabel}
          onApplyPreset={(patch, label) => {
            const next = { ...draftCalcSettings, ...patch };
            onSaveCalculationSettings(next);
            onNotifySuccess(`تم تطبيق قالب الحاسبة: ${label}`);
          }}
          onApplyToAllCurrent={() => {
            onSaveCalculationSettings(draftCalcSettings);
            onNotifySuccess(
              `تم تطبيق معادلة الحاسبة (رسم الفرد: ${draftCalcSettings.feePerIndividualIqd} د.ع) على الوكالات الحالية (${agenciesCount}).`
            );
          }}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            let preview: React.ReactNode = null;
            if (child.id === 'calc_quotas_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>الفرد: {draftCalcSettings.kgPerIndividual} كغم</span>
                  <span>الكيس: {draftCalcSettings.kgPerBag} كغم</span>
                </div>
              );
            } else if (child.id === 'calc_fees_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span style={{ color: 'var(--accent)' }}>
                    رسم الفرد: {formatIqd(draftCalcSettings.feePerIndividualIqd)}
                  </span>
                  <span>
                    البطاقة: {formatIqd(draftCalcSettings.fixedCardFeeIqd)}
                  </span>
                </div>
              );
            } else if (child.id === 'calc_rules_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>خصم: {draftCalcSettings.discountPercent ?? 0}%</span>
                  <span>
                    تقريب:{' '}
                    {(draftCalcSettings.roundingStepIqd ?? 0) === 0
                      ? 'دقيق'
                      : `${draftCalcSettings.roundingStepIqd} د.ع`}
                  </span>
                </div>
              );
            } else if (child.id === 'calc_preview_cap') {
              preview = (
                <div className="flex items-center justify-between font-extrabold tabular-nums">
                  <span>
                    {testCountNum} × {draftCalcSettings.feePerIndividualIqd} ={' '}
                    {baseIndividualFeesIqd.toLocaleString('en-US')} د.ع
                  </span>
                  <span style={{ color: 'var(--success)' }}>
                    {liveTestAllocation.quota}
                  </span>
                </div>
              );
            }

            return (
              <NodeCard
                key={child.id}
                node={child}
                badge={badge}
                preview={preview}
                actionLabel="تعديل المعادلة"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}
        </div>
      </NodeView>
    );
  }

  // Level 4: Specific Sub-Capsule View (Max 2-4 focused controls per screen)
  return (
    <NodeView
      node={activeNode}
      displayMode={displayMode}
      liveStatusText={
        activeCapsuleId === 'calc_fees_cap'
          ? `رسم الفرد: ${draftCalcSettings.feePerIndividualIqd} د.ع`
          : activeCapsuleId === 'calc_quotas_cap'
          ? `${draftCalcSettings.kgPerIndividual} كغم / فرد`
          : undefined
      }
      hasUnsavedDraft={isDirty}
      onResetBranch={handleResetCalcBranch}
      resetBranchLabel="استعادة افتراضيات الحاسبة"
    >
      <form onSubmit={handleCommitSave} className="space-y-5 text-xs">
        {activeCapsuleId === 'calc_quotas_cap' && (
          <div
            className="capsule-glass-card grid grid-cols-1 gap-4 border p-5 sm:grid-cols-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div data-capsule-node-id="ctrl_kg_per_ind">
              <label className="mb-1.5 block font-extrabold">
                حصة الفرد القياسية (كغم / فرد)
              </label>
              <input
                type="number"
                min={1}
                step="0.5"
                value={kgPerInd}
                onChange={(e) => setKgPerInd(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div data-capsule-node-id="ctrl_kg_per_bag">
              <label className="mb-1.5 block font-extrabold">
                وزن الكيس الكامل (كغم / كيس)
              </label>
              <input
                type="number"
                min={1}
                value={kgPerBag}
                onChange={(e) => setKgPerBag(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>
          </div>
        )}

        {activeCapsuleId === 'calc_fees_cap' && (
          <div
            className="capsule-glass-card grid grid-cols-1 gap-4 border p-5 sm:grid-cols-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div data-capsule-node-id="ctrl_fee_per_ind">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="font-extrabold">
                  رسم الفرد التلقائي (د.ع)
                </label>
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: 'var(--accent)' }}
                >
                  الافتراضي: 250 د.ع
                </span>
              </div>
              <input
                type="number"
                min={0}
                value={feePerInd}
                onChange={(e) => setFeePerInd(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div data-capsule-node-id="ctrl_fixed_card_fee">
              <label className="mb-1.5 block font-extrabold">
                رسم البطاقة الثابت (د.ع)
              </label>
              <input
                type="number"
                min={0}
                value={fixedFee}
                onChange={(e) => setFixedFee(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div data-capsule-node-id="ctrl_default_worker_wage">
              <label className="mb-1.5 block font-extrabold">
                أجر العامل الافتراضي في المالية (د.ع)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={defaultWorkerWage}
                onChange={(e) => setDefaultWorkerWage(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div data-capsule-node-id="ctrl_default_general_expense">
              <label className="mb-1.5 block font-extrabold">
                المصروف العام الافتراضي في المالية (د.ع)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={defaultGeneralExpense}
                onChange={(e) => setDefaultGeneralExpense(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>
          </div>
        )}

        {activeCapsuleId === 'calc_rules_cap' && (
          <div
            className="capsule-glass-card space-y-4 border p-5"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div data-capsule-node-id="ctrl_rounding_step">
                <label className="mb-1.5 block font-extrabold">
                  تقريب المبلغ لأقرب
                </label>
                <select
                  value={roundingStep}
                  onChange={(e) => setRoundingStep(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="0">بدون تقريب (دقيق)</option>
                  <option value="250">أقرب 250 د.ع</option>
                  <option value="500">أقرب 500 د.ع</option>
                  <option value="1000">أقرب 1,000 د.ع</option>
                </select>
              </div>

              <div data-capsule-node-id="ctrl_discount_percent">
                <label className="mb-1.5 block font-extrabold">
                  نسبة الخصم (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div data-capsule-node-id="ctrl_calc_mode">
                <label className="mb-1.5 block font-extrabold">
                  نمط إعادة الاحتساب
                </label>
                <select
                  value={calcMode}
                  onChange={(e) =>
                    setCalcMode(e.target.value as 'instant' | 'manual')
                  }
                  className="min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="instant">فوري تلقائي مع كل تعديل</option>
                  <option value="manual">يدوي عند الحاجة</option>
                </select>
              </div>
            </div>

            <label
              data-capsule-node-id="ctrl_include_blocked"
              className="flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 font-bold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: includeBlocked
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={includeBlocked}
                onChange={(e) => setIncludeBlocked(e.target.checked)}
              />
              <span>
                احتساب رسم البطاقة الثابت للحالات ذات الحظر الكامل ضمن الإيرادات
              </span>
            </label>
          </div>
        )}

        {renderLivePreviewStrip()}

        {(activeCapsuleId === 'calc_fees_cap' ||
          activeCapsuleId === 'calc_preview_cap' ||
          activeCapsuleId === 'calc_rules_cap') && (
          <CalculatorPresetsStrip
            currentCalc={draftCalcSettings}
            savedCalc={calculationSettings}
            agenciesCount={agenciesCount}
            activePeriodLabel={activePeriodLabel}
            onApplyPreset={(patch, label) => {
              const next = { ...draftCalcSettings, ...patch };
              onSaveCalculationSettings(next);
              onNotifySuccess(`تم تطبيق قالب الحاسبة: ${label}`);
            }}
            onApplyToAllCurrent={() => {
              onSaveCalculationSettings(draftCalcSettings);
              onNotifySuccess(
                `تم تطبيق معادلة الحاسبة على جميع الوكالات الحالية (${agenciesCount}).`
              );
            }}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpenCapsule(null)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 font-bold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>العودة لأقسام الحاسبة</span>
          </button>

          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 py-2.5 font-extrabold"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>حفظ إعدادات الحاسبة</span>
          </button>
        </div>
      </form>
    </NodeView>
  );
};

export default CalculatorCapsules;
