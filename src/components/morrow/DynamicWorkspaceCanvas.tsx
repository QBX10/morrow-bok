import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import type {
  Agency,
  AgencyExpense,
  AppDatabaseState,
  BlockScope,
  CalculationSettings,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
} from '../../types/agency.ts';
import type {
  AssistantToolCall,
  MorrowCanvasMode,
  MorrowEditableRowDraft,
  MorrowExecutiveReport,
  MorrowForecastReport,
  MorrowMacroDefinition,
  MorrowMacroExecutionResult,
  MorrowMacroStepAction,
  MorrowTextAnalysisResult,
  MorrowTextExtractedEntry,
} from '../../types/assistant.ts';
import { formatIqd, formatTotalQuota, normalizeArabic } from '../../utils/agencyLogic.ts';
import {
  analyzeRawArabicText,
  buildIndexedWorkspaceAnalytics,
  executeMorrowMacro,
  generateExecutiveReport,
  MACRO_STEP_LABELS,
} from '../../utils/morrowWorkspaceEngine.ts';
import { exportRosterToExcel } from '../../utils/excelExport.ts';

interface DynamicWorkspaceCanvasProps {
  canvasMode: MorrowCanvasMode;
  onChangeCanvasMode: (mode: MorrowCanvasMode) => void;
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  calculationSettings: CalculationSettings;
  monthlyArchives: MonthlyArchiveRecord[];
  activePeriod?: PeriodQuotaMeta;
  selectedAgencyId?: number | null;
  lastBackupAt?: string | null;
  forecast: MorrowForecastReport;
  macros: MorrowMacroDefinition[];
  onSaveMacros: (nextMacros: MorrowMacroDefinition[]) => void;
  lastMacroResult: MorrowMacroExecutionResult | null;
  onRunMacro: (macro: MorrowMacroDefinition) => void;
  onStageToolDrafts: (tools: AssistantToolCall[], sourceLabel: string) => void;
  onOpenAgencyRoster: (agencyId: number) => void;
  onSendPrompt: (prompt: string) => void;
  cloudConfigured?: boolean;
}

const CANVAS_TABS: Array<{
  id: MorrowCanvasMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'overview_charts', label: 'الرسوم والمؤشرات', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'editable_table', label: 'تعديل الجدول المباشر', icon: <Table2 className="h-3.5 w-3.5" /> },
  { id: 'executive_report', label: 'مولد التقارير', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'forecast', label: 'توقع التغييرات', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'text_analysis', label: 'محلل النصوص', icon: <Wand2 className="h-3.5 w-3.5" /> },
  { id: 'macro_studio', label: 'استوديو الماكرو', icon: <Layers className="h-3.5 w-3.5" /> },
];

export const DynamicWorkspaceCanvas: React.FC<DynamicWorkspaceCanvasProps> = ({
  canvasMode,
  onChangeCanvasMode,
  agencies,
  persons,
  expenses,
  calculationSettings,
  monthlyArchives,
  activePeriod,
  selectedAgencyId,
  lastBackupAt,
  forecast,
  macros,
  onSaveMacros,
  lastMacroResult,
  onRunMacro,
  onStageToolDrafts,
  onOpenAgencyRoster,
  onSendPrompt,
  cloudConfigured,
}) => {
  // Chart metric focus
  const [chartMetric, setChartMetric] = useState<'individuals' | 'bags' | 'profit'>('individuals');
  const [hoveredAgencyId, setHoveredAgencyId] = useState<number | null>(null);

  // Inline editable table state (strictly Zero-Trust buffered before staging drafts)
  const [tableAgencyFilter, setTableAgencyFilter] = useState<number | 'all'>(
    selectedAgencyId || 'all'
  );
  const [tableQuery, setTableQuery] = useState('');
  const [pendingEdits, setPendingEdits] = useState<Record<number, MorrowEditableRowDraft>>({});

  // Report state
  const [reportScopeId, setReportScopeId] = useState<number | 'all'>('all');
  const [copiedReport, setCopiedReport] = useState(false);

  // Text Analyzer state
  const [rawTextToAnalyze, setRawTextToAnalyze] = useState('');
  const [textAnalysis, setTextAnalysis] = useState<MorrowTextAnalysisResult | null>(null);
  const [aiAnalyzingText, setAiAnalyzingText] = useState(false);

  // Custom Macro Builder state
  const [creatingMacro, setCreatingMacro] = useState(false);
  const [newMacroName, setNewMacroName] = useState('');
  const [newMacroTrigger, setNewMacroTrigger] = useState('');
  const [newMacroSteps, setNewMacroSteps] = useState<MorrowMacroStepAction[]>([
    'run_diagnostics',
    'generate_report',
  ]);

  const indexed = useMemo(
    () =>
      buildIndexedWorkspaceAnalytics(
        agencies,
        persons,
        expenses,
        calculationSettings
      ),
    [agencies, persons, expenses, calculationSettings]
  );

  const agencyNameMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  const reportData: MorrowExecutiveReport = useMemo(
    () =>
      generateExecutiveReport({
        agencies,
        persons,
        expenses,
        settings: calculationSettings,
        periodLabel: activePeriod?.quotaName,
        scopeAgencyId: reportScopeId === 'all' ? null : reportScopeId,
      }),
    [agencies, persons, expenses, calculationSettings, activePeriod?.quotaName, reportScopeId]
  );

  // Filtered rows for inline Canvas editing
  const canvasEditableRows = useMemo(() => {
    const q = normalizeArabic(tableQuery.trim());
    const pool =
      tableAgencyFilter === 'all'
        ? persons
        : indexed.byAgencyId.get(tableAgencyFilter)?.persons || [];

    return pool
      .filter((p) => {
        if (p.blockType === 'archived' || p.status === 'مؤرشف') return false;
        if (!q) return true;
        return (
          normalizeArabic(p.name).includes(q) ||
          (p.nationalId || '').includes(q) ||
          normalizeArabic(p.notes || '').includes(q)
        );
      })
      .slice(0, 35);
  }, [persons, indexed.byAgencyId, tableAgencyFilter, tableQuery]);

  const pendingEditsList = useMemo(() => Object.values(pendingEdits), [pendingEdits]);

  const handleInlineFieldChange = (
    person: Person,
    patch: Partial<Pick<MorrowEditableRowDraft, 'individuals' | 'blockType' | 'notes'>>
  ) => {
    setPendingEdits((prev) => {
      const existing = prev[person.id] || {
        personId: person.id,
        name: person.name,
        agencyId: person.agencyId,
        agencyName: agencyNameMap.get(person.agencyId) || 'وكالة',
        originalIndividuals: person.individuals ?? 0,
        individuals: person.individuals ?? 0,
        originalBlockType: person.blockType,
        blockType: person.blockType,
        originalNotes: person.notes || '',
        notes: person.notes || '',
      };
      const updated: MorrowEditableRowDraft = { ...existing, ...patch };
      const isUnchanged =
        updated.individuals === updated.originalIndividuals &&
        updated.blockType === updated.originalBlockType &&
        updated.notes.trim() === updated.originalNotes.trim();
      if (isUnchanged) {
        const clone = { ...prev };
        delete clone[person.id];
        return clone;
      }
      return { ...prev, [person.id]: updated };
    });
  };

  const commitInlineEditsToApprovalQueue = () => {
    if (pendingEditsList.length === 0) return;
    const toolCalls: AssistantToolCall[] = pendingEditsList.map((row) => ({
      name: 'update_person',
      args: {
        personId: row.personId,
        ...(row.individuals !== row.originalIndividuals
          ? { individuals: row.individuals }
          : {}),
        ...(row.blockType !== row.originalBlockType
          ? { blockType: row.blockType }
          : {}),
        ...(row.notes.trim() !== row.originalNotes.trim()
          ? { notes: row.notes.trim() }
          : {}),
      },
    }));
    onStageToolDrafts(
      toolCalls,
      `تعديل مباشر من اللوحة التفاعلية (${pendingEditsList.length} سجل)`
    );
    setPendingEdits({});
  };

  const handleRunTextAnalyzer = async (useCloudAi: boolean) => {
    if (!rawTextToAnalyze.trim()) return;
    const localResult = analyzeRawArabicText({
      rawText: rawTextToAnalyze,
      persons,
      agencies,
    });
    if (!useCloudAi || !cloudConfigured) {
      setTextAnalysis(localResult);
      return;
    }

    setAiAnalyzingText(true);
    try {
      const res = await fetch('/api/morrow/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: rawTextToAnalyze,
          agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
        }),
      });
      if (!res.ok) {
        setTextAnalysis(localResult);
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        summary?: string;
        items?: Array<{
          line: string;
          name: string;
          individuals?: number | null;
          action?: 'update_individuals' | 'block_full' | 'add_person' | 'note';
        }>;
      };
      if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
        const mergedLocal = analyzeRawArabicText({
          rawText: data.items
            .map((it) => `${it.name} ${it.individuals ?? ''} ${it.action === 'block_full' ? 'حجب' : ''}`.trim())
            .join('\n'),
          persons,
          agencies,
        });
        setTextAnalysis({
          ...mergedLocal,
          rawText: rawTextToAnalyze,
          usedCloudAi: true,
          summary: data.summary || mergedLocal.summary,
        });
      } else {
        setTextAnalysis(localResult);
      }
    } catch {
      setTextAnalysis(localResult);
    } finally {
      setAiAnalyzingText(false);
    }
  };

  const stageTextAnalysisEntry = (entry: MorrowTextExtractedEntry) => {
    if (entry.matchedPersonId && entry.actionHint === 'block_full') {
      onStageToolDrafts(
        [
          {
            name: 'update_person',
            args: { personId: entry.matchedPersonId, blockType: 'full' },
          },
        ],
        `محلل النصوص: حجب «${entry.matchedPersonName || entry.candidateName}»`
      );
      return;
    }
    if (entry.matchedPersonId && entry.extractedIndividuals !== null) {
      onStageToolDrafts(
        [
          {
            name: 'update_person',
            args: {
              personId: entry.matchedPersonId,
              individuals: entry.extractedIndividuals,
            },
          },
        ],
        `محلل النصوص: تعديل أفراد «${entry.matchedPersonName}»`
      );
      return;
    }
    if (!entry.matchedPersonId && entry.candidateName.length >= 2) {
      onStageToolDrafts(
        [
          {
            name: 'add_person',
            args: {
              name: entry.candidateName,
              agencyId: entry.matchedAgencyId || agencies[0]?.id || 1,
              individuals: entry.extractedIndividuals ?? 1,
            },
          },
        ],
        `محلل النصوص: إضافة «${entry.candidateName}»`
      );
    }
  };

  const handleCopyReport = () => {
    const text = [
      reportData.title,
      `الفترة: ${reportData.periodLabel}`,
      ...reportData.summaryPoints.map((s) => `• ${s}`),
      '',
      ...reportData.agencyRows.map(
        (r) =>
          `${r.label}: ${r.activeHouseholds} عائلة | ${r.activeIndividuals} فرد | ${r.fullBags} كيس | صافي ${formatIqd(
            r.profit
          )}`
      ),
    ].join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {});
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 1800);
    }
  };

  const handleSaveCustomMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMacroName.trim() || !newMacroTrigger.trim() || newMacroSteps.length === 0) return;
    const custom: MorrowMacroDefinition = {
      id: `macro_custom_${Date.now()}`,
      name: newMacroName.trim(),
      triggerPhrase: newMacroTrigger.trim(),
      description: `ماكرو مخصص (${newMacroSteps.length} خطوات)`,
      builtIn: false,
      steps: newMacroSteps,
    };
    onSaveMacros([...macros, custom]);
    setCreatingMacro(false);
    setNewMacroName('');
    setNewMacroTrigger('');
  };

  // Max value for SVG chart bars
  const maxBarValue = useMemo(() => {
    const vals = indexed.chartSeries.map((item) =>
      chartMetric === 'individuals'
        ? item.activeIndividuals
        : chartMetric === 'bags'
        ? item.fullBags
        : Math.max(0, item.profit)
    );
    return Math.max(1, ...vals);
  }, [indexed.chartSeries, chartMetric]);

  const totalDonutCount = Math.max(
    1,
    indexed.blockBreakdown.activeHouseholds +
      indexed.blockBreakdown.partialBlockedHouseholds +
      indexed.blockBreakdown.fullBlockedHouseholds
  );
  const activeRatioPct = Math.round(
    (indexed.blockBreakdown.activeHouseholds / totalDonutCount) * 100
  );
  const partialRatioPct = Math.round(
    (indexed.blockBreakdown.partialBlockedHouseholds / totalDonutCount) * 100
  );

  // Helper to run an inline macro directly if none is provided
  const activeMacroResult = useMemo(() => {
    if (lastMacroResult) return lastMacroResult;
    const defaultCloseMacro = macros[0];
    if (!defaultCloseMacro) return null;
    const syntheticState = {
      agencies,
      persons,
      expenses,
      calculationSettings,
      readyLists: [],
      readyListItems: [],
      relations: [],
      monthlyArchives,
    } as unknown as AppDatabaseState;
    return executeMorrowMacro({
      macro: defaultCloseMacro,
      state: syntheticState,
      monthlyArchives,
      activePeriod,
      lastBackupAt,
    });
  }, [
    lastMacroResult,
    macros,
    agencies,
    persons,
    expenses,
    calculationSettings,
    monthlyArchives,
    activePeriod,
    lastBackupAt,
  ]);

  return (
    <section
      aria-label="مساحة العمل التفاعلية — Morrow Canvas"
      className="flex flex-col rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Canvas Header + Mode Switcher */}
      <div
        className="border-b p-3.5 sm:p-4 space-y-3"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <span>مساحة العمل التفاعلية — Morrow Canvas</span>
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              لوحة تحليل حيّة، رسوم بيانية فورية، وتعديل مباشر محمي بمسودة الموافقة
            </p>
          </div>
          <span
            className="text-[11px] font-bold tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {activePeriod?.quotaName || 'الحصة الحالية'} · {agencies.length} وكالات
          </span>
        </div>

        <nav
          aria-label="أوضاع مساحة العمل التفاعلية"
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
        >
          {CANVAS_TABS.map((tab) => {
            const active = canvasMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeCanvasMode(tab.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-transform duration-150 active:scale-[0.98]"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--accent)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }
                    : {
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Canvas Body */}
      <div className="p-3.5 sm:p-5 space-y-4">
        {/* MODE 1: OVERVIEW & INTERACTIVE CHARTS */}
        {canvasMode === 'overview_charts' && (
          <div className="space-y-4">
            {/* Animated KPI Bento Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'الأفراد المستحقون',
                  value: indexed.totals.activeIndividuals.toLocaleString('en-US'),
                  sub: `${indexed.totals.activeHouseholds} عائلة نشطة`,
                  tone: 'var(--accent)',
                },
                {
                  label: 'الطحين المطلوب',
                  value: `${indexed.totals.fullBags} كيس`,
                  sub: formatTotalQuota(indexed.totals.totalKg, calculationSettings),
                  tone: 'var(--text-primary)',
                },
                {
                  label: 'صافي الربح التقديري',
                  value: formatIqd(indexed.totals.profit),
                  sub: `مصروفات ${formatIqd(indexed.totals.totalExpenses)}`,
                  tone: indexed.totals.profit >= 0 ? 'var(--success)' : 'var(--danger)',
                },
                {
                  label: 'حالات الحجب',
                  value: String(indexed.totals.blockedCount),
                  sub: `${indexed.totals.blockedIndividualsTotal} فرد مستبعد`,
                  tone: indexed.totals.blockedCount > 0 ? 'var(--warning)' : 'var(--success)',
                },
              ].map((kpi, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border p-3 transition-transform duration-150 hover:-translate-y-0.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {kpi.label}
                  </div>
                  <div
                    className="mt-1 text-base sm:text-lg font-extrabold tabular-nums truncate"
                    style={{ color: kpi.tone }}
                  >
                    {kpi.value}
                  </div>
                  <div className="mt-0.5 text-[10px] tabular-nums truncate" style={{ color: 'var(--text-muted)' }}>
                    {kpi.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive SVG Comparison Chart + Status Donut */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Bar Chart Card */}
              <div
                className="xl:col-span-8 rounded-xl border p-4 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-extrabold">مقارنة الوكالات التفاعلية</div>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'individuals' as const, label: 'الأفراد' },
                      { id: 'bags' as const, label: 'الأكياس' },
                      { id: 'profit' as const, label: 'صافي الربح' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setChartMetric(opt.id)}
                        className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                        style={
                          chartMetric === opt.id
                            ? {
                                backgroundColor: 'var(--accent)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent-fg)',
                              }
                            : {
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-color)',
                              }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG Horizontal Bar Chart */}
                <div className="space-y-2.5">
                  {indexed.chartSeries.map((item) => {
                    const val =
                      chartMetric === 'individuals'
                        ? item.activeIndividuals
                        : chartMetric === 'bags'
                        ? item.fullBags
                        : Math.max(0, item.profit);
                    const pct = Math.max(4, Math.round((val / maxBarValue) * 100));
                    const isHovered = hoveredAgencyId === item.agencyId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setHoveredAgencyId(item.agencyId)}
                        onMouseLeave={() => setHoveredAgencyId(null)}
                        onClick={() => onOpenAgencyRoster(item.agencyId)}
                        className="block w-full rounded-xl border p-2.5 text-right transition-colors"
                        style={{
                          backgroundColor: isHovered ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                          borderColor: isHovered ? 'var(--accent)' : 'var(--border-color)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold">
                          <span className="truncate">
                            {item.icon} {item.label}
                          </span>
                          <span className="tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
                            {chartMetric === 'individuals'
                              ? `${item.activeIndividuals} فرد (${item.sharePercent}%)`
                              : chartMetric === 'bags'
                              ? `${item.fullBags} كيس`
                              : formatIqd(item.profit)}
                          </span>
                        </div>
                        <div
                          className="mt-2 h-2.5 w-full overflow-hidden rounded-full"
                          style={{ backgroundColor: 'var(--bg-main)' }}
                        >
                          <svg width="100%" height="10" aria-hidden="true">
                            <rect
                              x="0"
                              y="0"
                              width={`${pct}%`}
                              height="10"
                              rx="5"
                              fill="var(--accent)"
                            />
                          </svg>
                        </div>
                        {isHovered && (
                          <div
                            className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] tabular-nums"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <span>العائلات: {item.activeHouseholds}</span>
                            <span>·</span>
                            <span>المحجوب: {item.blockedCount}</span>
                            <span>·</span>
                            <span>اضغط لفتح جدول الوكالة</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Distribution SVG Donut */}
              <div
                className="xl:col-span-4 rounded-xl border p-4 flex flex-col justify-between gap-3"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="text-xs font-extrabold">توزيع حالات السجلات</div>

                <div className="flex flex-col items-center justify-center py-2">
                  <svg viewBox="0 0 120 120" className="h-32 w-32" role="img" aria-label="نسبة العائلات النشطة">
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="var(--border-color)"
                      strokeWidth="12"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="12"
                      strokeDasharray={`${(activeRatioPct / 100) * 289} 289`}
                      transform="rotate(-90 60 60)"
                      strokeLinecap="round"
                    />
                    {partialRatioPct > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="var(--warning)"
                        strokeWidth="12"
                        strokeDasharray={`${(partialRatioPct / 100) * 289} 289`}
                        strokeDashoffset={`${-((activeRatioPct / 100) * 289)}`}
                        transform="rotate(-90 60 60)"
                      />
                    )}
                    <text
                      x="60"
                      y="58"
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      fontSize="18"
                      fontWeight="800"
                    >
                      {activeRatioPct}%
                    </text>
                    <text
                      x="60"
                      y="74"
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize="9"
                    >
                      نشط مستحق
                    </text>
                  </svg>
                </div>

                <div className="space-y-1.5 text-[11px] tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                      <span>عائلات نشطة</span>
                    </span>
                    <span className="font-bold">{indexed.blockBreakdown.activeHouseholds}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--warning)' }} />
                      <span>حظر جزئي</span>
                    </span>
                    <span className="font-bold">{indexed.blockBreakdown.partialBlockedHouseholds}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                      <span>حظر كامل</span>
                    </span>
                    <span className="font-bold">{indexed.blockBreakdown.fullBlockedHouseholds}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: INLINE EDITABLE TABLE INSIDE CANVAS (Zero-Trust Staged!) */}
        {canvasMode === 'editable_table' && (
          <div className="space-y-3">
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border-color))',
              }}
            >
              <div className="flex items-center gap-2 font-bold">
                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span>
                  تعديل مباشر محمي بقاعدة Zero-Trust: تعديلاتك هنا تُرسل إلى طابور الموافقات أولاً ولا تغيّر الجدول الفعلي إلا بعد موافقتك.
                </span>
              </div>
              {pendingEditsList.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingEdits({})}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>تراجع</span>
                  </button>
                  <button
                    type="button"
                    onClick={commitInlineEditsToApprovalQueue}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-extrabold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    <span>إرسال ({pendingEditsList.length}) للموافقة</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={tableQuery}
                  onChange={(e) => setTableQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم البطاقة للتعديل..."
                  className="w-full rounded-xl border pr-8 pl-3 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <select
                value={tableAgencyFilter}
                onChange={(e) =>
                  setTableAgencyFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                aria-label="تصفية حسب الوكالة"
                className="rounded-xl border px-3 py-2 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="all">جميع الوكالات</option>
                {agencies.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="overflow-x-auto rounded-xl border"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <table className="w-full text-right text-xs">
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <th className="px-3 py-2.5 font-extrabold">المستفيد</th>
                    <th className="px-3 py-2.5 font-extrabold">الوكالة</th>
                    <th className="px-3 py-2.5 font-extrabold w-24">الأفراد</th>
                    <th className="px-3 py-2.5 font-extrabold w-32">الحالة</th>
                    <th className="px-3 py-2.5 font-extrabold">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {canvasEditableRows.map((p) => {
                    const staged = pendingEdits[p.id];
                    const curInd = staged ? staged.individuals : p.individuals ?? 0;
                    const curBlock = staged ? staged.blockType : p.blockType;
                    const curNotes = staged ? staged.notes : p.notes || '';
                    return (
                      <tr
                        key={p.id}
                        style={{
                          backgroundColor: staged ? 'var(--warning-bg)' : 'var(--bg-surface)',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <td className="px-3 py-2 font-bold whitespace-nowrap">{p.name}</td>
                        <td
                          className="px-3 py-2 text-[11px] whitespace-nowrap"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {agencyNameMap.get(p.agencyId) || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={40}
                            value={curInd}
                            aria-label={`عدد أفراد ${p.name}`}
                            onChange={(e) =>
                              handleInlineFieldChange(p, {
                                individuals: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-20 rounded-lg border px-2 py-1 text-center font-bold tabular-nums"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={curBlock}
                            aria-label={`حالة ${p.name}`}
                            onChange={(e) =>
                              handleInlineFieldChange(p, {
                                blockType: e.target.value as BlockScope,
                              })
                            }
                            className="rounded-lg border px-2 py-1 text-[11px] font-bold"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <option value="none">نشط</option>
                            <option value="partial">حظر جزئي</option>
                            <option value="full">حظر كامل</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={curNotes}
                            placeholder="إضافة ملاحظة..."
                            onChange={(e) =>
                              handleInlineFieldChange(p, { notes: e.target.value })
                            }
                            className="w-full min-w-[140px] rounded-lg border px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODE 3: AUTO-REPORT GENERATOR */}
        {canvasMode === 'executive_report' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={reportScopeId}
                  onChange={(e) =>
                    setReportScopeId(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  aria-label="نطاق التقرير التنفيذي"
                  className="rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="all">جميع الوكالات</option>
                  {agencies.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {copiedReport ? (
                    <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedReport ? 'تم النسخ' : 'نسخ الملخص'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const scopedPersons =
                      reportScopeId === 'all'
                        ? persons
                        : persons.filter((p) => p.agencyId === reportScopeId);
                    exportRosterToExcel({
                      filename: `تقرير_تنفيذي_${reportData.scopeLabel}`,
                      persons: scopedPersons,
                      agencies,
                      settings: calculationSettings,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>تصدير Excel معزول</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            <div
              className="rounded-xl border p-4 space-y-3"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold">{reportData.title}</h3>
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {reportData.periodLabel}
                </span>
              </div>

              <ul className="space-y-1.5 text-xs leading-relaxed">
                {reportData.summaryPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 mt-1"
                      style={{ color: 'var(--success)' }}
                    />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>

              <div
                className="overflow-x-auto rounded-xl border mt-3"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <table className="w-full text-right text-xs tabular-nums">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      <th className="px-3 py-2 font-extrabold">الوكالة</th>
                      <th className="px-3 py-2 font-extrabold">العائلات</th>
                      <th className="px-3 py-2 font-extrabold">الأفراد</th>
                      <th className="px-3 py-2 font-extrabold">الأكياس</th>
                      <th className="px-3 py-2 font-extrabold">الإيراد</th>
                      <th className="px-3 py-2 font-extrabold">الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.agencyRows.map((row) => (
                      <tr
                        key={row.id}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <td className="px-3 py-2 font-bold">
                          {row.icon} {row.label}
                        </td>
                        <td className="px-3 py-2">{row.activeHouseholds}</td>
                        <td className="px-3 py-2">{row.activeIndividuals}</td>
                        <td className="px-3 py-2">{row.fullBags}</td>
                        <td className="px-3 py-2">{formatIqd(row.revenue)}</td>
                        <td
                          className="px-3 py-2 font-bold"
                          style={{ color: row.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}
                        >
                          {formatIqd(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODE 4: CHANGE FORECASTER */}
        {canvasMode === 'forecast' && (
          <div className="space-y-4">
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <Activity className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>{forecast.horizonLabel}</span>
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {forecast.baselineLabel}
                  </p>
                </div>
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold tabular-nums"
                  style={{
                    color:
                      forecast.trendDirection === 'up'
                        ? 'var(--success)'
                        : forecast.trendDirection === 'down'
                        ? 'var(--warning)'
                        : 'var(--accent)',
                  }}
                >
                  {forecast.trendDirection === 'down' ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  <span>
                    {forecast.deltaPercent >= 0 ? '+' : ''}
                    {forecast.deltaPercent}% ({forecast.deltaIndividuals >= 0 ? '+' : ''}
                    {forecast.deltaIndividuals} فرد)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
                <div
                  className="rounded-xl border p-3"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>الأفراد المتوقعون</div>
                  <div className="mt-1 text-base font-extrabold">{forecast.projectedIndividuals}</div>
                </div>
                <div
                  className="rounded-xl border p-3"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>الأكياس التقديرية</div>
                  <div className="mt-1 text-base font-extrabold" style={{ color: 'var(--accent)' }}>
                    {forecast.projectedBags} كيس
                  </div>
                </div>
                <div
                  className="rounded-xl border p-3"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>الصافي المتوقع</div>
                  <div className="mt-1 text-sm font-extrabold" style={{ color: 'var(--success)' }}>
                    {formatIqd(forecast.projectedProfit)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {forecast.agencyForecasts.map((af) => (
                <div
                  key={af.agencyId}
                  className="rounded-xl border p-3.5 text-xs space-y-1.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor:
                      af.riskLevel === 'high' ? 'var(--warning)' : 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 font-extrabold">
                    <span>{af.agencyName}</span>
                    <span
                      className="tabular-nums"
                      style={{
                        color:
                          af.riskLevel === 'high'
                            ? 'var(--warning)'
                            : af.changePercent >= 0
                            ? 'var(--success)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {af.currentIndividuals} ← {af.projectedIndividuals} فرد ({af.projectedBags} كيس)
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {af.note}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="rounded-xl border p-3.5 text-xs space-y-1.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="font-extrabold">توصيات Morrow الاستباقية:</div>
              {forecast.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2" style={{ color: 'var(--text-muted)' }}>
                  <span>•</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODE 5: SMART TEXT ANALYZER */}
        {canvasMode === 'text_analysis' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label
                htmlFor="morrow-smart-text-input"
                className="block text-xs font-extrabold"
              >
                الصق رسالة واتساب أو ملاحظات الوكيل لاستخراج التعديلات تلقائياً:
              </label>
              <textarea
                id="morrow-smart-text-input"
                rows={4}
                value={rawTextToAnalyze}
                onChange={(e) => setRawTextToAnalyze(e.target.value)}
                placeholder={'مثال:\nتعديل عائلة حيدر كاظم الى 6 أفراد\nحجب سجل جاسم محمد\nاضافة عائلة كريم سلمان 4 افراد'}
                className="w-full rounded-xl border p-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRunTextAnalyzer(false)}
                  disabled={!rawTextToAnalyze.trim() || aiAnalyzingText}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>تحليل النص محلياً (فوري)</span>
                </button>

                {cloudConfigured && (
                  <button
                    type="button"
                    onClick={() => void handleRunTextAnalyzer(true)}
                    disabled={!rawTextToAnalyze.trim() || aiAnalyzingText}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    {aiAnalyzingText ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>تحليل متقدم بالذكاء الاصطناعي</span>
                  </button>
                )}
              </div>
            </div>

            {textAnalysis && (
              <div
                className="rounded-xl border p-3.5 space-y-2.5"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="text-xs font-extrabold">{textAnalysis.summary}</div>
                <div className="space-y-2">
                  {textAnalysis.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-bold truncate">
                          {entry.matchedPersonName
                            ? `مطابق: ${entry.matchedPersonName} (${entry.matchedAgencyName || ''})`
                            : `اسم مستخلص: ${entry.candidateName}`}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          النص: «{entry.rawLine}» ·{' '}
                          {entry.actionHint === 'block_full'
                            ? 'حجب'
                            : entry.actionHint === 'update_individuals'
                            ? `تعديل الأفراد إلى ${entry.extractedIndividuals}`
                            : entry.actionHint === 'add_person'
                            ? `إضافة (${entry.extractedIndividuals ?? 1} أفراد)`
                            : 'ملاحظة عامة'}
                        </div>
                      </div>
                      {entry.actionHint !== 'note' && (
                        <button
                          type="button"
                          onClick={() => stageTextAnalysisEntry(entry)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-extrabold shrink-0"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-fg)',
                          }}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          <span>تجهيز مسودة موافقة</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 6: MACRO STUDIO ("إغلاق الشهر" + Custom User Macros) */}
        {canvasMode === 'macro_studio' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold">أوامر الماكرو المبرمجة (Macros)</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  نفّذ سلسلة مهام معقدة مثل «إغلاق الشهر» بضغطة واحدة أو برمج ماكرو خاص بك
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatingMacro((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إنشاء ماكرو مخصص</span>
              </button>
            </div>

            {creatingMacro && (
              <form
                onSubmit={handleSaveCustomMacro}
                className="rounded-xl border p-3.5 space-y-3 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newMacroName}
                    onChange={(e) => setNewMacroName(e.target.value)}
                    placeholder="اسم الماكرو (مثلاً: تدقيق المساء)"
                    className="rounded-xl border px-3 py-2"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                  <input
                    type="text"
                    required
                    value={newMacroTrigger}
                    onChange={(e) => setNewMacroTrigger(e.target.value)}
                    placeholder="عبارة التشغيل (مثلاً: تدقيق المساء)"
                    className="rounded-xl border px-3 py-2"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="font-bold">اختر خطوات التسلسل:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(MACRO_STEP_LABELS) as MorrowMacroStepAction[]).map((stepKey) => {
                      const active = newMacroSteps.includes(stepKey);
                      return (
                        <button
                          key={stepKey}
                          type="button"
                          onClick={() =>
                            setNewMacroSteps((prev) =>
                              prev.includes(stepKey)
                                ? prev.filter((s) => s !== stepKey)
                                : [...prev, stepKey]
                            )
                          }
                          className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                          style={
                            active
                              ? {
                                  backgroundColor: 'var(--accent)',
                                  borderColor: 'var(--accent)',
                                  color: 'var(--accent-fg)',
                                }
                              : {
                                  backgroundColor: 'var(--bg-surface)',
                                  borderColor: 'var(--border-color)',
                                }
                          }
                        >
                          {MACRO_STEP_LABELS[stepKey]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreatingMacro(false)}
                    className="rounded-xl border px-3 py-1.5 font-bold"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl px-4 py-1.5 font-extrabold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    حفظ الماكرو
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {macros.map((macro) => (
                <div
                  key={macro.id}
                  className="rounded-xl border p-3.5 flex flex-col justify-between gap-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">{macro.name}</span>
                      {!macro.builtIn && (
                        <button
                          type="button"
                          onClick={() => onSaveMacros(macros.filter((m) => m.id !== macro.id))}
                          aria-label={`حذف ${macro.name}`}
                          className="p-1 opacity-70 hover:opacity-100"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {macro.description}
                    </p>
                    <div className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
                      الأمر الصوتي/النصي: «{macro.triggerPhrase}» · {macro.steps.length} خطوات
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRunMacro(macro)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>تشغيل الماكرو</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendPrompt(macro.triggerPhrase)}
                      className="rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      في المحادثة
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {activeMacroResult && (
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-extrabold">
                    نتيجة تنفيذ: {activeMacroResult.macroName}
                  </div>
                  {activeMacroResult.stagedDraftTools.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onStageToolDrafts(
                          activeMacroResult.stagedDraftTools,
                          `ماكرو: ${activeMacroResult.macroName}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-extrabold"
                      style={{
                        backgroundColor: 'var(--success)',
                        color: 'var(--success-fg)',
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>
                        إرسال خطوات الحفظ ({activeMacroResult.stagedDraftTools.length}) للموافقة الآمنة
                      </span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  {activeMacroResult.steps.map((st, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-xl border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {st.status === 'warning' ? (
                        <AlertTriangle
                          className="h-4 w-4 shrink-0 mt-0.5"
                          style={{ color: 'var(--warning)' }}
                        />
                      ) : (
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 mt-0.5"
                          style={{
                            color: st.status === 'staged_draft' ? 'var(--accent)' : 'var(--success)',
                          }}
                        />
                      )}
                      <div>
                        <div className="font-bold">{st.label}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {st.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
