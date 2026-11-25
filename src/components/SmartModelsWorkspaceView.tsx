import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Copy,
  Download,
  Gauge,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { AppDatabaseState, AppView } from '../types/agency';
import {
  SMART_MODELS_CATALOG,
  SMART_TASK_CHIPS,
  executeSmartModelTask,
  getSmartModelById,
  type SmartModelExecutionParams,
  type SmartModelExecutionResult,
  type SmartModelId,
  type SmartModelTaskChipId,
  type SmartOutputFormat,
  type SmartPrecisionLevel,
  type SmartSpeedMode,
} from '../utils/smartModelsEngine';
import {
  ModelPulseCore2D,
  type SmartCoreExecutionState,
} from './motion2d/ModelPulseCore2D';
import {
  BentoCard2D,
  GeometricSectionHeader,
  RecessedChannelWell,
} from './motion2d/SurfacePrimitives2D';
import { formatIqd } from '../utils/agencyLogic';

interface SmartModelsWorkspaceViewProps {
  state: AppDatabaseState;
  reduceMotion?: boolean;
  onApplyAutoFixes?: () => { fixedCount: number; summaryLines: string[] };
  onOpenAgencyRoster?: (agencyId: number) => void;
  onNavigateView?: (view: AppView) => void;
  onShowToast?: (message: string, tone?: 'success' | 'info' | 'warning' | 'danger') => void;
}

export const SmartModelsWorkspaceView: React.FC<SmartModelsWorkspaceViewProps> = ({
  state,
  reduceMotion = false,
  onApplyAutoFixes,
  onOpenAgencyRoster,
  onNavigateView,
  onShowToast,
}) => {
  const [selectedModelId, setSelectedModelId] =
    useState<SmartModelId>('audit_inspector');
  const [selectedChipId, setSelectedChipId] =
    useState<SmartModelTaskChipId>('diff_analysis');
  const [customPrompt, setCustomPrompt] = useState('');
  const [params, setParams] = useState<SmartModelExecutionParams>({
    precisionLevel: 'deep',
    speedMode: 'balanced',
    outputFormat: 'executive_grid',
  });

  const [executionState, setExecutionState] =
    useState<SmartCoreExecutionState>('idle');
  const [result, setResult] = useState<SmartModelExecutionResult>(() =>
    executeSmartModelTask({
      modelId: 'audit_inspector',
      taskChipId: 'diff_analysis',
      params: {
        precisionLevel: 'deep',
        speedMode: 'balanced',
        outputFormat: 'executive_grid',
      },
      state,
    })
  );

  const activeModel = useMemo(
    () => getSmartModelById(selectedModelId),
    [selectedModelId]
  );

  const runTask = (
    overrideModel?: SmartModelId,
    overrideChip?: SmartModelTaskChipId,
    overridePrompt?: string
  ) => {
    const mId = overrideModel || selectedModelId;
    const cId = overrideChip || selectedChipId;
    const pText = overridePrompt !== undefined ? overridePrompt : customPrompt;

    setExecutionState('thinking');
    window.setTimeout(() => {
      const next = executeSmartModelTask({
        modelId: mId,
        taskChipId: cId,
        prompt: pText,
        params,
        state,
      });
      setResult(next);
      setExecutionState('complete');
    }, 180);
  };

  const handleSelectModel = (modelId: SmartModelId) => {
    const def = getSmartModelById(modelId);
    setSelectedModelId(modelId);
    setSelectedChipId(def.recommendedChip);
    runTask(modelId, def.recommendedChip, customPrompt);
  };

  const handleChipClick = (chipId: SmartModelTaskChipId) => {
    setSelectedChipId(chipId);
    const chip = SMART_TASK_CHIPS.find((c) => c.id === chipId);
    if (chip && !customPrompt.trim()) {
      setCustomPrompt(chip.defaultPromptAr);
    }
    runTask(selectedModelId, chipId, customPrompt || chip?.defaultPromptAr);
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(result.exportMarkdown);
      onShowToast?.('تم نسخ التقرير الهندسي إلى الحافظة بنجاح.', 'success');
    } catch {
      onShowToast?.('تعذر النسخ التلقائي — يمكنك التصدير كملف.', 'warning');
    }
  };

  const handleExportCsv = () => {
    const blob = new Blob(['\uFEFF' + result.exportCsv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morrow-smart-model-${result.model.id}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.('تم تصدير مصفوفة التحليل بصيغة CSV.', 'success');
  };

  const handleApplyFixesToRoster = () => {
    if (!onApplyAutoFixes) return;
    const summary = onApplyAutoFixes();
    if (summary.fixedCount > 0) {
      onShowToast?.(
        `تم تطبيق ${summary.fixedCount} إصلاحاً تلقائياً على السجل بنجاح.`,
        'success'
      );
      runTask(selectedModelId, 'error_detection', customPrompt);
    } else {
      onShowToast?.('السجل منضبط حالياً ولا توجد إصلاحات آلية معلقة.', 'info');
    }
  };

  const autoFixableCount = result.findings.filter((f) => f.autoFixable).length;

  return (
    <main
      dir="rtl"
      data-testid="smart-models-workspace"
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 pb-28 sm:px-6 lg:pb-24"
    >
      {/* 3.1 Hero 2D Analytical Core & Command Header */}
      <BentoCard2D elevated className="p-5 sm:p-7">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.85fr] gap-6 items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl border border-[var(--border-color)] flex items-center justify-center shrink-0"
                  style={{
                    background: `radial-gradient(circle at 30% 25%, ${activeModel.accentHex}24, var(--surface-well))`,
                  }}
                >
                  <BrainCircuit
                    className="h-6 w-6"
                    style={{ color: activeModel.accentHex }}
                  />
                </div>
                <div>
                  <span className="font-mono-num text-[11px] font-black tracking-[0.16em] text-[var(--accent)] block">
                    Morrow
                  </span>
                  <h1 className="font-display-ar text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                    النماذج الذكية
                  </h1>
                </div>
              </div>

              {onNavigateView && (
                <button
                  type="button"
                  onClick={() => onNavigateView('hub')}
                  className="px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-pill)] hover:border-[var(--accent)] text-xs font-extrabold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>العودة للرئيسية</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              تحليل وتوليد ذكي متصل مباشرة ببيانات الوكالات والأفراد والأكياس والمصروفات لتقديم تدقيق وتوقعات فورية قابلة للتطبيق.
            </p>

            {/* Quick Workspace Metrics inside Recessed Well */}
            <RecessedChannelWell className="p-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] font-bold text-[var(--text-muted)]">
                  النموذج النشط
                </div>
                <div
                  className="text-xs font-black mt-0.5 truncate"
                  style={{ color: activeModel.accentHex }}
                >
                  {activeModel.shortTitleAr}
                </div>
              </div>
              <div className="border-x border-[var(--border-color)]">
                <div className="text-[10px] font-bold text-[var(--text-muted)]">
                  السجلات المشمولة
                </div>
                <div className="font-mono-num text-xs font-black text-[var(--text-primary)] mt-0.5 tabular-nums">
                  {state.persons.length.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[var(--text-muted)]">
                  الملاحظات المكتشفة
                </div>
                <div className="font-mono-num text-xs font-black text-emerald-400 mt-0.5 tabular-nums">
                  {result.findings.length}
                </div>
              </div>
            </RecessedChannelWell>
          </div>

          {/* Interactive 2D Analytical Matrix Core */}
          <ModelPulseCore2D
            accentHex={activeModel.accentHex}
            secondaryHex={activeModel.secondaryHex}
            executionState={executionState}
            modelTitle={activeModel.shortTitleAr}
            selectedModelId={selectedModelId}
            reduceMotion={reduceMotion}
          />
        </div>
      </BentoCard2D>

      {/* 3.2 Specialized 2D Bento Model Cards */}
      <section aria-label="اختيار النموذج الذكي">
        <GeometricSectionHeader
          title="النماذج الذكية المتخصصة"
          subtitle="اختر المحرك الهندسي المناسب لمهمتك ليتم تكييف النواة التفاعلية ومعاملات الدقة"
          icon={<Layers className="h-5 w-5 text-[var(--accent-bright)]" />}
          className="mb-4"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {SMART_MODELS_CATALOG.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <BentoCard2D
                key={model.id}
                elevated={isSelected}
                noPadding
                accentGlow={`${model.accentHex}28`}
                className={`transition-all ${
                  isSelected
                    ? 'ring-1 ring-[var(--accent)]'
                    : 'opacity-90 hover:opacity-100'
                }`}
              >
                <button
                  type="button"
                  data-testid={`smart-model-card-${model.id}`}
                  onClick={() => handleSelectModel(model.id)}
                  className="w-full h-full p-4 text-right flex flex-col justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="w-10 h-10 rounded-xl border border-[var(--border-color)] flex items-center justify-center shrink-0"
                      style={{
                        background: `${model.accentHex}22`,
                        color: model.accentHex,
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-well)]"
                      style={{ color: model.accentHex }}
                    >
                      {model.precisionBadgeAr}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-black text-[var(--text-primary)] leading-snug">
                      {model.nameAr}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      {model.roleAr}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] font-bold">
                    <span className="text-[var(--text-muted)]">
                      {model.shortTitleAr}
                    </span>
                    <span
                      style={{
                        color: isSelected ? model.accentHex : 'var(--text-muted)',
                      }}
                    >
                      {isSelected ? 'نشط الآن ✓' : 'تفعيل'}
                    </span>
                  </div>
                </button>
              </BentoCard2D>
            );
          })}
        </div>
      </section>

      {/* Interactive 2D Command Bar + Quick Chips + Parameter Controls */}
      <BentoCard2D className="space-y-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              data-testid="smart-model-prompt-input"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runTask();
                }
              }}
              placeholder="اكتب أمر التحليل أو التدقيق المطلوب (مثال: قارن أرباح الوكالات واكشف التكرارات)..."
              className="w-full h-12 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] px-4 text-xs sm:text-sm font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="button"
            data-testid="smart-model-run-btn"
            onClick={() => runTask()}
            className="obsidian-gold-cta h-12 px-6 rounded-2xl text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Play className="h-4 w-4" />
            <span>تشغيل التحليل</span>
          </button>
        </div>

        {/* 4 Quick Task Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[var(--text-muted)] ml-1">
            مهام فورية:
          </span>
          {SMART_TASK_CHIPS.map((chip) => {
            const active = selectedChipId === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                data-testid={`smart-chip-${chip.id}`}
                onClick={() => handleChipClick(chip.id)}
                className="h-9 px-3.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer"
                style={{
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                  backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--surface-pill)',
                  color: active ? 'var(--accent-bright)' : 'var(--text-muted)',
                  boxShadow: active ? '0 6px 16px -8px var(--spatial-glow)' : 'none',
                }}
              >
                {chip.labelAr}
              </button>
            );
          })}
        </div>

        {/* Geometric Parameter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border-color)]">
          <RecessedChannelWell className="p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-[var(--text-muted)]">
              <Sliders className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>مستوى الدقة والتحليل</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['standard', 'قياسي'],
                  ['deep', 'عميق'],
                  ['forensic', 'جنائي'],
                ] as Array<[SmartPrecisionLevel, string]>
              ).map(([val, lbl]) => {
                const isSel = params.precisionLevel === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setParams((p) => ({ ...p, precisionLevel: val }))}
                    className="py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSel ? 'var(--accent)' : 'var(--surface-subtle)',
                      color: isSel ? 'var(--accent-fg)' : 'var(--text-muted)',
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </RecessedChannelWell>

          <RecessedChannelWell className="p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-[var(--text-muted)]">
              <Gauge className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>سرعة الاستجابة</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['turbo', 'توربو'],
                  ['balanced', 'متوازن'],
                  ['thorough', 'شامل'],
                ] as Array<[SmartSpeedMode, string]>
              ).map(([val, lbl]) => {
                const isSel = params.speedMode === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setParams((p) => ({ ...p, speedMode: val }))}
                    className="py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSel ? 'var(--accent)' : 'var(--surface-subtle)',
                      color: isSel ? 'var(--accent-fg)' : 'var(--text-muted)',
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </RecessedChannelWell>

          <RecessedChannelWell className="p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-[var(--text-muted)]">
              <Layers className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>نمط الإخراج الهندسي</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['executive_grid', 'بطاقات'],
                  ['audit_matrix', 'مصفوفة'],
                  ['action_blueprint', 'مخطط'],
                ] as Array<[SmartOutputFormat, string]>
              ).map(([val, lbl]) => {
                const isSel = params.outputFormat === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setParams((p) => ({ ...p, outputFormat: val }))}
                    className="py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSel ? 'var(--accent)' : 'var(--surface-subtle)',
                      color: isSel ? 'var(--accent-fg)' : 'var(--text-muted)',
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </RecessedChannelWell>
        </div>
      </BentoCard2D>

      {/* 3.3 Structured 2D Response & Reasoning Workspace */}
      <BentoCard2D elevated data-testid="smart-model-output-card" className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold text-[var(--accent-bright)]">
              <Activity className="h-3.5 w-3.5" />
              <span>مخرجات {result.model.shortTitleAr}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)]">
              {result.headlineAr}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              {result.executiveSummaryAr}
            </p>
          </div>

          {/* Output Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="smart-output-copy-btn"
              onClick={() => void handleCopyMarkdown()}
              className="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-pill)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>نسخ</span>
            </button>

            <button
              type="button"
              data-testid="smart-output-apply-btn"
              onClick={handleApplyFixesToRoster}
              className="h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
              style={{
                borderColor: 'color-mix(in srgb, var(--accent) 45%, transparent)',
                backgroundColor: 'var(--bg-nav-active)',
                color: 'var(--accent-bright)',
              }}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>تطبيق على السجل ({autoFixableCount})</span>
            </button>

            <button
              type="button"
              data-testid="smart-output-export-btn"
              onClick={handleExportCsv}
              className="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-pill)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>تصدير CSV</span>
            </button>

            <button
              type="button"
              data-testid="smart-output-regen-btn"
              onClick={() => runTask()}
              className="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-pill)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>إعادة توليد</span>
            </button>
          </div>
        </div>

        {/* Structured KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {result.kpis.map((kpi) => (
            <RecessedChannelWell key={kpi.label} className="p-3.5">
              <div className="text-[11px] font-bold text-[var(--text-muted)]">
                {kpi.label}
              </div>
              <div className="mt-1 font-mono-num text-xl font-black text-[var(--text-primary)] tabular-nums">
                {kpi.value}
              </div>
              {kpi.hint && (
                <div className="mt-0.5 text-[10px] font-semibold text-[var(--accent-bright)]">
                  {kpi.hint}
                </div>
              )}
            </RecessedChannelWell>
          ))}
        </div>

        {/* Agency Comparison Matrix Table */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-black text-[var(--text-primary)]">
            مصفوفة مقارنة الوكالات والحصص ({result.comparisonRows.length} وكالة)
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] recessed-well">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--surface-subtle)]">
                  <th className="py-2.5 px-3 font-black">الوكالة</th>
                  <th className="py-2.5 px-3 font-black">العوائل</th>
                  <th className="py-2.5 px-3 font-black">الأفراد المستحقون</th>
                  <th className="py-2.5 px-3 font-black">الكمية (كغم)</th>
                  <th className="py-2.5 px-3 font-black">الأكياس</th>
                  <th className="py-2.5 px-3 font-black">صافي الربح</th>
                  <th className="py-2.5 px-3 font-black">السلامة</th>
                </tr>
              </thead>
              <tbody>
                {result.comparisonRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-5 px-3 text-center text-xs font-semibold text-[var(--text-muted)]"
                    >
                      لا توجد وكالات مضافة بعد — أضف وكالة أو حمّل البيانات التجريبية لعرض المقارنة التفصيلية.
                    </td>
                  </tr>
                ) : (
                  result.comparisonRows.map((row) => (
                    <tr
                      key={row.agencyId}
                      className="border-b border-[var(--border-color)]/60 last:border-b-0 hover:bg-[var(--surface-subtle)]"
                    >
                      <td className="py-2.5 px-3 font-extrabold text-[var(--text-primary)]">
                        {onOpenAgencyRoster ? (
                          <button
                            type="button"
                            onClick={() => onOpenAgencyRoster(row.agencyId)}
                            className="hover:text-[var(--accent-bright)] hover:underline cursor-pointer"
                          >
                            {row.agencyName}
                          </button>
                        ) : (
                          row.agencyName
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num tabular-nums">
                        {row.households.toLocaleString('en-US')}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num font-bold text-[var(--accent-bright)] tabular-nums">
                        {row.eligibleIndividuals.toLocaleString('en-US')}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num tabular-nums">
                        {row.totalKg.toLocaleString('en-US')}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num tabular-nums">
                        {row.fullBags.toLocaleString('en-US')}
                        {row.remainderKg > 0 ? ` + ${row.remainderKg}ك` : ''}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num font-bold tabular-nums">
                        {formatIqd(row.netProfitIqd)}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num font-black tabular-nums">
                        <span
                          className={
                            row.healthScore >= 90
                              ? 'text-emerald-400'
                              : row.healthScore >= 75
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }
                        >
                          {row.healthScore}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Two-Column Bottom: Findings + Reasoning & Action Plan */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecessedChannelWell className="p-4 space-y-2.5">
            <h3 className="text-xs font-black text-[var(--text-primary)] flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>نتائج التدقيق والفحص ({result.findings.length})</span>
            </h3>
            <div className="space-y-2">
              {result.findings.map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {f.title}
                    </span>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                      style={{
                        backgroundColor:
                          f.severity === 'high'
                            ? 'var(--danger-bg)'
                            : f.severity === 'medium'
                            ? 'var(--warning-bg)'
                            : 'var(--success-bg)',
                        color:
                          f.severity === 'high'
                            ? 'var(--danger)'
                            : f.severity === 'medium'
                            ? 'var(--warning)'
                            : 'var(--success)',
                      }}
                    >
                      {f.severity === 'high'
                        ? 'أولوية قصوى'
                        : f.severity === 'medium'
                        ? 'انتباه'
                        : 'سليم'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>
          </RecessedChannelWell>

          <RecessedChannelWell className="p-4 space-y-3">
            <h3 className="text-xs font-black text-[var(--text-primary)] flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
              <span>مسار الاستنتاج وخطة العمل التنفيذية</span>
            </h3>
            <div className="space-y-1.5">
              {result.reasoningSteps.map((step) => (
                <div
                  key={step}
                  className="text-[11px] text-[var(--text-muted)] leading-relaxed"
                >
                  {step}
                </div>
              ))}
            </div>
            <div className="laser-divider" />
            <div className="space-y-2">
              {result.actionPlanSteps.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <CheckCircle2 className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </RecessedChannelWell>
        </div>
      </BentoCard2D>
    </main>
  );
};
