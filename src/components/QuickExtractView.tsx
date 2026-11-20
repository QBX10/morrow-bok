import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  FileSearch,
  FileText,
  FileWarning,
  Filter,
  Loader2,
  Lock,
  MousePointerSquareDashed,
  Redo2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Undo2,
  Upload,
  Zap,
} from 'lucide-react';
import type {
  Agency,
  AppView,
  CalculationSettings,
  Person,
  QuickExtractAnalysisResult,
  QuickExtractCaptureMode,
  QuickExtractCommitSummary,
  QuickExtractDestinationSpec,
  QuickExtractEvaluatedRow,
  QuickExtractFocusField,
  QuickExtractPrefs,
  QuickExtractReferenceTemplate,
  QuickExtractRoutingConfig,
  QuickExtractScanMode,
  ReadyList,
  ReadyListItem,
  RelationCategory,
  RelationEntry,
  ThemePreferences,
} from '../types/agency';
import { normalizeArabic } from '../utils/agencyLogic';
import type { BurstFusionSummary } from '../utils/ledgerImageProcessor';
import {
  ALL_QUICK_EXTRACT_FIELDS,
  buildArabicNameTree,
  computeAdjustedIndividuals,
  computeQuickExtractRoutingPlan,
  evaluateExtractedRow,
  findExistingMatchInAgency,
  recomputeRowValidation,
  resolveFocusedFields,
} from '../utils/quickExtractEngine';
import { CoreRosterTable, type CoreRosterRow } from './CoreRosterTable';
import {
  SelectionActionBar,
  type SelectablePersonRecord,
} from './SelectionActionBar';
import { BurstCameraCapture } from './quickExtract/BurstCameraCapture';
import { RedFlagDoubtSegment } from './quickExtract/RedFlagDoubtSegment';
import { ReferenceTemplateModal } from './quickExtract/ReferenceTemplateModal';
import { RoutingPanel } from './quickExtract/RoutingPanel';

interface QuickExtractViewProps {
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  readyListItems?: ReadyListItem[];
  relations: RelationEntry[];
  calculationSettings: CalculationSettings;
  themePrefs: ThemePreferences;
  quickExtractPrefs: QuickExtractPrefs;
  defaultAgencyId: number;
  onUpdateQuickExtractPrefs: (patch: Partial<QuickExtractPrefs>) => void;
  onSaveQuickExtractTemplate: (template: QuickExtractReferenceTemplate) => void;
  onCommitQuickExtractPlan: (params: {
    rows: QuickExtractEvaluatedRow[];
    routing: QuickExtractRoutingConfig;
  }) => QuickExtractCommitSummary;
  onMovePersonsToAgency: (personIds: number[], targetAgencyId: number) => void;
  onAddPersonsToReadyList: (listId: number, personIds: number[]) => number;
  onUpsertRelation: (input: {
    personId: number;
    category: RelationCategory;
    note: string;
    reminderDate?: string;
    deliveryAddress?: string;
    deliveryPhone?: string;
    deliveryTime?: string;
  }) => void;
  onDoneNavigateToAgency: (agencyId: number) => void;
  onNavigateToView: (view: AppView) => void;
}

function createDefaultDestSpec(
  agencyId: number,
  labelPrefix = 'كشف السحب السريع',
  existingReadyListId?: number
): QuickExtractDestinationSpec {
  const today = new Date().toISOString().slice(0, 10);
  return {
    kind: 'agency',
    agencyId,
    existingReadyListId,
    readyListMeta: {
      name: `${labelPrefix} — ${today}`,
      listDate: today,
      subtitle1: 'مستخرج عبر السحب السريع',
      subtitle2: 'مراجع ومعتمد للترحيل',
      autoUpdateDate: false,
    },
  };
}

export const QuickExtractView: React.FC<QuickExtractViewProps> = ({
  agencies,
  persons,
  readyLists,
  readyListItems = [],
  relations,
  calculationSettings,
  themePrefs,
  quickExtractPrefs,
  defaultAgencyId,
  onUpdateQuickExtractPrefs,
  onSaveQuickExtractTemplate,
  onCommitQuickExtractPlan,
  onMovePersonsToAgency,
  onAddPersonsToReadyList,
  onUpsertRelation,
  onDoneNavigateToAgency,
  onNavigateToView,
}) => {
  const fallbackAgencyId = agencies[0]?.id ?? 1;
  const initialAgencyId = agencies.some((a) => a.id === defaultAgencyId)
    ? defaultAgencyId
    : fallbackAgencyId;

  const [captureMode, setCaptureMode] = useState<QuickExtractCaptureMode>('pdf');
  const [scanMode, setScanMode] = useState<QuickExtractScanMode>(
    quickExtractPrefs.defaultScanMode || 'audit'
  );
  const [focusedFields, setFocusedFields] = useState<QuickExtractFocusField[]>(
    resolveFocusedFields(quickExtractPrefs.focusedFields)
  );
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [analysis, setAnalysis] =
    useState<QuickExtractAnalysisResult | null>(null);

  // Local Undo / Redo history for inline edits inside Quick Extract
  const [pastRows, setPastRows] = useState<QuickExtractEvaluatedRow[][]>([]);
  const [futureRows, setFutureRows] = useState<QuickExtractEvaluatedRow[][]>([]);

  const [filterQuery, setFilterQuery] = useState('');
  const [filterScope, setFilterScope] = useState<
    'all' | 'new_only' | 'updates_only'
  >('all');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
  const [showConfirmUpdates, setShowConfirmUpdates] = useState(false);
  const [commitSummary, setCommitSummary] =
    useState<QuickExtractCommitSummary | null>(null);

  const [routingConfig, setRoutingConfig] = useState<QuickExtractRoutingConfig>(
    () => ({
      mode: 'single',
      mergeStrategy: 'update_matched',
      primaryDestination: createDefaultDestSpec(initialAgencyId, 'كشف مستخرج'),
      additionsDestination: createDefaultDestSpec(
        initialAgencyId,
        'كشف الإضافات المستخرجة'
      ),
      decreasesDestination: createDefaultDestSpec(
        initialAgencyId,
        'كشف النزول والحذف المستخرج'
      ),
    })
  );

  useEffect(() => {
    const validId = agencies.some((a) => a.id === defaultAgencyId)
      ? defaultAgencyId
      : agencies[0]?.id ?? 1;
    setRoutingConfig((prev) => ({
      ...prev,
      primaryDestination: {
        ...prev.primaryDestination,
        agencyId: prev.primaryDestination.agencyId || validId,
      },
      additionsDestination: {
        ...prev.additionsDestination,
        agencyId: prev.additionsDestination.agencyId || validId,
      },
      decreasesDestination: {
        ...prev.decreasesDestination,
        agencyId: prev.decreasesDestination.agencyId || validId,
      },
    }));
  }, [defaultAgencyId, agencies]);

  const nameTree = useMemo(() => buildArabicNameTree(persons), [persons]);

  const activeReferenceTemplate = useMemo(
    () =>
      quickExtractPrefs.referenceTemplates.find(
        (t) => t.id === quickExtractPrefs.activeTemplateId
      ) || null,
    [quickExtractPrefs]
  );

  const applyNewAnalysisResult = (result: QuickExtractAnalysisResult) => {
    const activeScanMode = result.scanMode || scanMode;
    const activeFocused = resolveFocusedFields(
      result.focusedFields || focusedFields
    );
    // Re-evaluate rows locally with full Arabic Name & Prefix Tree from live persons[]
    const enrichedRows = result.rows.map((r, idx) =>
      evaluateExtractedRow(r, idx, {
        sourceMode: result.sourceMode || captureMode,
        scanMode: activeScanMode,
        focusedFields: activeFocused,
        tree: nameTree,
        persons,
      })
    );
    const hasAnyDoubt = enrichedRows.some(
      (r) => r.hasDoubt || !r.isComplete || r.mathIssues.length > 0
    );
    setAnalysis({
      ...result,
      scanMode: activeScanMode,
      focusedFields: activeFocused,
      status:
        result.status === 'rejected'
          ? 'rejected'
          : hasAnyDoubt
          ? 'needs_review'
          : 'clear',
      rows: enrichedRows,
    });
    setPastRows([]);
    setFutureRows([]);
    setSelectedRowIds(enrichedRows.map((r) => r.id));
    setFocusedRowKey(null);
  };

  const handleToggleFocusField = (field: QuickExtractFocusField) => {
    setFocusedFields((prev) => {
      const exists = prev.includes(field);
      if (exists && prev.length <= 1) return prev;
      const next = exists
        ? prev.filter((f) => f !== field)
        : [...prev, field];
      onUpdateQuickExtractPrefs({ focusedFields: next });
      return next;
    });
  };

  const applyFocusPreset = (preset: QuickExtractFocusField[]) => {
    setFocusedFields(preset);
    onUpdateQuickExtractPrefs({ focusedFields: preset });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setAnalysis(null);
    setCommitSummary(null);

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setUploadError('يرجى رفع ملف بصيغة PDF حصرًا.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('حجم الملف يتجاوز الحد المسموح (20 ميجابايت).');
      return;
    }

    setFileName(file.name);
    setLoading(true);

    try {
      const base64Pdf = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('تعذر قراءة الملف من المتصفح.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/quick-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'pdf',
          filename: file.name,
          base64Pdf,
          scanMode,
          focusedFields,
          clarityThreshold: quickExtractPrefs.clarityThreshold,
          referenceTemplate: activeReferenceTemplate
            ? {
                name: activeReferenceTemplate.name,
                notes: activeReferenceTemplate.notes,
                imageDataUrl: activeReferenceTemplate.imageDataUrl,
                mimeType: activeReferenceTemplate.mimeType,
                regions: activeReferenceTemplate.regions,
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok && data?.status !== 'rejected') {
        throw new Error(data?.error || 'فشل تحليل ملف PDF.');
      }

      applyNewAnalysisResult(data as QuickExtractAnalysisResult);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الملف.'
      );
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleCameraBurstAnalyze = async (summary: BurstFusionSummary) => {
    setUploadError('');
    setAnalysis(null);
    setCommitSummary(null);
    setFileName(`لقطة الدفتر اليدوي (${summary.acceptedFrames.length} إطارات)`);
    setLoading(true);

    try {
      const res = await fetch('/api/quick-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'camera_burst',
          scanMode,
          focusedFields,
          clarityThreshold: quickExtractPrefs.clarityThreshold,
          referenceTemplate: activeReferenceTemplate
            ? {
                name: activeReferenceTemplate.name,
                notes: activeReferenceTemplate.notes,
                imageDataUrl: activeReferenceTemplate.imageDataUrl,
                mimeType: activeReferenceTemplate.mimeType,
                regions: activeReferenceTemplate.regions,
              }
            : undefined,
          enhancementReport: summary.enhancementReport,
          frames: summary.acceptedFrames.map((f) => ({
            mimeType: f.mimeType,
            data: f.enhancedBase64,
            label: f.label,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok && data?.status !== 'rejected') {
        throw new Error(data?.error || 'فشل تحليل لقطات الدفتر اليدوي.');
      }

      const resultObj = data as QuickExtractAnalysisResult;
      if (summary.acceptedFrames[0]?.enhancedPreviewUrl) {
        resultObj.sourceImageUrls = {
          1: summary.acceptedFrames[0].enhancedPreviewUrl,
        };
      }
      applyNewAnalysisResult(resultObj);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة لقطات الكاميرا.'
      );
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (
    rowId: string,
    patch: Partial<QuickExtractEvaluatedRow>,
    options?: { resetConfirmOnNameEdit?: boolean }
  ) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      setPastRows((p) => [...p.slice(-24), prev.rows]);
      setFutureRows([]);
      const activeFocused = resolveFocusedFields(
        prev.focusedFields || focusedFields
      );
      const activeScanMode = prev.scanMode || scanMode;
      const nextRows = prev.rows.map((row) => {
        if (row.id !== rowId) return row;
        return recomputeRowValidation(
          { ...row, ...patch },
          {
            tree: nameTree,
            persons,
            resetConfirmOnNameEdit: options?.resetConfirmOnNameEdit,
            focusedFields: activeFocused,
            scanMode: activeScanMode,
          }
        );
      });
      return { ...prev, rows: nextRows };
    });
  };

  const handleLocalUndo = () => {
    if (!analysis || pastRows.length === 0) return;
    const prevSnapshot = pastRows[pastRows.length - 1];
    setFutureRows((f) => [analysis.rows, ...f.slice(0, 24)]);
    setPastRows((p) => p.slice(0, -1));
    setAnalysis({ ...analysis, rows: prevSnapshot });
  };

  const handleLocalRedo = () => {
    if (!analysis || futureRows.length === 0) return;
    const [nextSnapshot, ...rest] = futureRows;
    setPastRows((p) => [...p.slice(-24), analysis.rows]);
    setFutureRows(rest);
    setAnalysis({ ...analysis, rows: nextSnapshot });
  };

  const rows = analysis?.rows || [];
  const doubtedRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.hasDoubt && !r.doubtConfirmed) ||
          (r.mathIssues.length > 0 && !r.mathConfirmed)
      ),
    [rows]
  );
  const missingRows = useMemo(() => rows.filter((r) => !r.isComplete), [rows]);
  const verifiedRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!r.hasDoubt || r.doubtConfirmed) &&
          (r.mathIssues.length === 0 || r.mathConfirmed) &&
          r.isComplete
      ),
    [rows]
  );

  // Zero-Blind-Commit Gate: strict lock until ALL doubts & missing fields = 0
  const gateUnlocked =
    analysis !== null &&
    analysis.status !== 'rejected' &&
    rows.length > 0 &&
    doubtedRows.length === 0 &&
    missingRows.length === 0;

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, `${a.icon} ${a.name}`])),
    [agencies]
  );

  const primaryPool = useMemo(() => {
    if (routingConfig.primaryDestination.kind === 'master_roster') {
      return persons;
    }
    return persons.filter(
      (p) => p.agencyId === routingConfig.primaryDestination.agencyId
    );
  }, [persons, routingConfig.primaryDestination]);

  const filteredReadyRows = useMemo(() => {
    const qNorm = normalizeArabic(filterQuery);
    return verifiedRows.filter((row) => {
      if (qNorm && !normalizeArabic(row.resolvedName).includes(qNorm)) {
        return false;
      }
      const existing = findExistingMatchInAgency(row.resolvedName, primaryPool);
      if (filterScope === 'new_only' && existing) return false;
      if (filterScope === 'updates_only' && !existing) return false;
      return true;
    });
  }, [verifiedRows, filterQuery, filterScope, primaryPool]);

  const rowsChosenForCommit = useMemo(() => {
    const picked = new Set(selectedRowIds);
    return filteredReadyRows.filter((r) => picked.has(r.id));
  }, [filteredReadyRows, selectedRowIds]);

  const routingPlan = useMemo(
    () =>
      computeQuickExtractRoutingPlan({
        rows: filteredReadyRows,
        routing: routingConfig,
        agencies,
        persons,
        readyLists,
        readyListItems,
      }),
    [filteredReadyRows, routingConfig, agencies, persons, readyLists, readyListItems]
  );

  const selectedPlanCounts = useMemo(
    () =>
      computeQuickExtractRoutingPlan({
        rows: rowsChosenForCommit,
        routing: routingConfig,
        agencies,
        persons,
        readyLists,
        readyListItems,
      }).counts,
    [rowsChosenForCommit, routingConfig, agencies, persons, readyLists, readyListItems]
  );

  const planItemByRowId = useMemo(
    () => new Map(routingPlan.items.map((it) => [it.row.id, it])),
    [routingPlan]
  );

  const corePreviewRows: CoreRosterRow[] = useMemo(() => {
    return filteredReadyRows.map((row) => {
      const calc = computeAdjustedIndividuals(row);
      const planned = planItemByRowId.get(row.id);
      const rowOverride = routingConfig.rowOverrides?.[row.id];
      const overrideValue: CoreRosterRow['routeOverrideValue'] =
        rowOverride?.excluded
          ? 'exclude'
          : rowOverride?.mergeStrategy || 'auto';

      const targetAgencyId =
        planned?.destination.kind === 'agency'
          ? planned.destination.agencyId
          : routingConfig.primaryDestination.agencyId;
      const actionLabel =
        planned?.actionType === 'skip_unmatched'
          ? 'مستبعد'
          : planned?.actionType === 'update_matched'
          ? `تحديث موجود (${planned.matchedPerson?.individuals ?? '—'} ← ${
              calc.finalIndividuals
            })`
          : planned?.actionType === 'replace'
          ? 'استبدال'
          : 'إضافة جديدة';

      const tone: CoreRosterRow['routeActionTone'] =
        planned?.actionType === 'skip_unmatched'
          ? 'muted'
          : planned?.actionType === 'update_matched'
          ? 'warning'
          : planned?.actionType === 'replace'
          ? 'danger'
          : 'success';

      return {
        rowKey: row.id,
        selectionId: row.id,
        agencyId: targetAgencyId,
        agencyName: agencyMap.get(targetAgencyId) || '—',
        name: row.resolvedName,
        individuals: calc.finalIndividuals,
        status: '',
        notes: row.notes || calc.adjustmentNote,
        extractSource: row,
        extractDecreaseCount: row.resolvedDecreaseCount,
        extractAddOrDeleteCount: row.resolvedAddOrDeleteCount,
        extractAddOrDeleteAction: row.resolvedAddOrDeleteAction,
        destinationLabel: planned?.matchedRuleLabel
          ? `${planned.destinationLabel} (${planned.matchedRuleLabel})`
          : planned?.destinationLabel,
        routeActionLabel: actionLabel,
        routeActionTone: tone,
        routeOverrideValue: overrideValue,
      };
    });
  }, [
    filteredReadyRows,
    planItemByRowId,
    routingConfig.primaryDestination.agencyId,
    routingConfig.rowOverrides,
    agencyMap,
  ]);

  const selectablePreviewRecords: SelectablePersonRecord[] = useMemo(() => {
    const picked = new Set(selectedRowIds);
    return filteredReadyRows
      .filter((r) => picked.has(r.id))
      .map((r) => {
        const calc = computeAdjustedIndividuals(r);
        const planned = planItemByRowId.get(r.id);
        return {
          selectionKey: `qe:${r.id}`,
          personId: planned?.matchedPerson?.id ?? null,
          name: r.resolvedName,
          agencyId:
            planned?.destination.kind === 'agency'
              ? planned.destination.agencyId
              : routingConfig.primaryDestination.agencyId,
          agencyName: planned?.destinationLabel || 'السحب السريع',
          individuals: calc.finalIndividuals,
          notes: r.notes || calc.adjustmentNote,
        };
      });
  }, [
    filteredReadyRows,
    selectedRowIds,
    planItemByRowId,
    routingConfig.primaryDestination.agencyId,
  ]);

  const activeCommitCount =
    selectedPlanCounts.add +
    selectedPlanCounts.update +
    selectedPlanCounts.replace;
  const canProceedToCommit =
    gateUnlocked && rowsChosenForCommit.length > 0 && activeCommitCount > 0;

  const executeCommit = () => {
    const summary = onCommitQuickExtractPlan({
      rows: rowsChosenForCommit,
      routing: routingConfig,
    });
    setCommitSummary(summary);
    setShowConfirmUpdates(false);
  };

  const resetAll = () => {
    setAnalysis(null);
    setFileName('');
    setUploadError('');
    setCommitSummary(null);
    setPastRows([]);
    setFutureRows([]);
    setSelectedRowIds([]);
  };

  const stage2Active =
    analysis !== null && analysis.status !== 'rejected' && !gateUnlocked;
  const stage3Active = gateUnlocked;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 sm:p-6">
      {/* Top Pipeline Header + Capture Mode Switcher */}
      <section
        className="rounded-xl border p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileSearch
                className="h-5 w-5"
                style={{ color: 'var(--accent)' }}
              />
              <h1 className="text-lg font-bold">
                السحب السريع الذكي (PDF وكاميرا الدفتر اليدوي)
              </h1>
            </div>
            <p
              className="mt-1 text-xs leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              نطاق الاستخراج الحصري: <strong>الاسم</strong> ·{' '}
              <strong>عدد الأفراد (الأنفار)</strong> ·{' '}
              <strong>النزول/النقصان</strong> ·{' '}
              <strong>الإضافة/الحذف</strong> فقط — مع بوابة الرفض الآمن، كشف
              الحروف المشكوك فيها باللون الأحمر، وتوجيه الوجهة الذكي قبل الترحيل.
            </p>
          </div>

          {analysis && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>بدء عملية سحب جديدة</span>
            </button>
          )}
        </div>

        {/* 3-Stage Stepper Strip */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div
            className="rounded-lg border px-3 py-2 text-xs font-bold"
            style={{
              backgroundColor:
                analysis === null || analysis.status === 'rejected'
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
              borderColor:
                analysis === null || analysis.status === 'rejected'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
            }}
          >
            01. الالتقاط وبوابة الفحص والرفض الآمن
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-xs font-bold"
            style={{
              backgroundColor: stage2Active
                ? 'var(--danger-bg)'
                : 'var(--bg-main)',
              borderColor: stage2Active
                ? 'var(--danger)'
                : 'var(--border-color)',
              color: stage2Active ? 'var(--danger)' : 'var(--text-primary)',
            }}
          >
            02. كشف الشك باللون الأحمر وتقرير النواقص
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-xs font-bold"
            style={{
              backgroundColor: stage3Active
                ? 'var(--success-bg)'
                : 'var(--bg-main)',
              borderColor: stage3Active
                ? 'var(--success)'
                : 'var(--border-color)',
              color: stage3Active ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            03. التحضير والفلترة النهائية والتوجيه
          </div>
        </div>

        {/* Capture Mode Segmented Tabs */}
        <div
          className="mt-4 inline-flex flex-wrap items-center gap-1 rounded-xl border p-1"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setCaptureMode('pdf');
              setUploadError('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor:
                captureMode === 'pdf' ? 'var(--accent)' : 'transparent',
              color:
                captureMode === 'pdf'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <FileText className="h-4 w-4" />
            <span>السحب الذكي من ملفات PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCaptureMode('camera_burst');
              setUploadError('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor:
                captureMode === 'camera_burst'
                  ? 'var(--accent)'
                  : 'transparent',
              color:
                captureMode === 'camera_burst'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <Camera className="h-4 w-4" />
            <span>كاميرا الدفتر اليدوي (Burst Fusion)</span>
          </button>
        </div>

        {/* Custom Field Focus + Scan Mode + Reference Template Config Strip */}
        <div
          className="mt-4 grid grid-cols-1 gap-3 rounded-xl border p-3.5 text-xs lg:grid-cols-3"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* 1. Fast vs Audit Mode */}
          <div className="space-y-1.5">
            <div className="font-bold" style={{ color: 'var(--text-muted)' }}>
              وضع السحب والتصوير:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setScanMode('fast');
                  onUpdateQuickExtractPrefs({ defaultScanMode: 'fast' });
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-2 font-bold"
                style={{
                  backgroundColor:
                    scanMode === 'fast' ? 'var(--accent)' : 'var(--bg-surface)',
                  borderColor:
                    scanMode === 'fast'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    scanMode === 'fast'
                      ? 'var(--accent-fg)'
                      : 'var(--text-primary)',
                }}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>الوضع السريع</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode('audit');
                  onUpdateQuickExtractPrefs({ defaultScanMode: 'audit' });
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-2 font-bold"
                style={{
                  backgroundColor:
                    scanMode === 'audit'
                      ? 'var(--accent)'
                      : 'var(--bg-surface)',
                  borderColor:
                    scanMode === 'audit'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    scanMode === 'audit'
                      ? 'var(--accent-fg)'
                      : 'var(--text-primary)',
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>الوضع المدقق</span>
              </button>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {scanMode === 'fast'
                ? 'التقاط واستخراج فوري للجدول مباشرة بدون تعقيد.'
                : 'تدقيق شامل للحروف مع قص مقتطف الصورة بجانب الأسماء المشكوك بها.'}
            </div>
          </div>

          {/* 2. Custom Field Focus */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-bold" style={{ color: 'var(--text-muted)' }}>
                التركيز المخصص على الحقول:
              </span>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => applyFocusPreset(['name'])}
                  className="rounded border px-1.5 py-0.5 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  الأسماء فقط
                </button>
                <button
                  type="button"
                  onClick={() => applyFocusPreset(['name', 'individuals'])}
                  className="rounded border px-1.5 py-0.5 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  الأسماء + الأنفار
                </button>
                <button
                  type="button"
                  onClick={() => applyFocusPreset(ALL_QUICK_EXTRACT_FIELDS)}
                  className="rounded border px-1.5 py-0.5 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  الكل (4)
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'name', label: 'الاسم' },
                  { id: 'individuals', label: 'عدد الأفراد' },
                  { id: 'decreaseCount', label: 'النزول / النقصان' },
                  { id: 'addOrDelete', label: 'الإضافة / الحذف' },
                ] as const
              ).map((f) => {
                const checked = focusedFields.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 font-semibold"
                    style={{
                      backgroundColor: checked
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-surface)',
                      borderColor: checked
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleFocusField(f.id)}
                    />
                    <span>{f.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Reference Template */}
          <div className="space-y-1.5">
            <div className="font-bold" style={{ color: 'var(--text-muted)' }}>
              الصورة المرجعية / النموذج الأولي:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <select
                aria-label="اختيار النموذج المرجعي"
                value={quickExtractPrefs.activeTemplateId || ''}
                onChange={(e) =>
                  onUpdateQuickExtractPrefs({
                    activeTemplateId: e.target.value || null,
                  })
                }
                className="min-w-[140px] flex-1 rounded-lg border px-2.5 py-1.5 font-semibold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="">بدون نموذج مرجعي</option>
                {quickExtractPrefs.referenceTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.regions.length} تحديد)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <MousePointerSquareDashed className="h-3.5 w-3.5" />
                <span>تحديد نموذج جديد</span>
              </button>
            </div>
            {activeReferenceTemplate && (
              <div
                className="flex items-center gap-2 text-[11px]"
                style={{ color: 'var(--success)' }}
              >
                <span>
                  النموذج النشط: <strong>{activeReferenceTemplate.name}</strong> (
                  {activeReferenceTemplate.regions.length} منطقة محددة)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mode 1: PDF Upload Dropzone */}
        {captureMode === 'pdf' ? (
          <label
            className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--accent)',
            }}
          >
            {loading ? (
              <>
                <Loader2
                  className="h-8 w-8 animate-spin"
                  style={{ color: 'var(--accent)' }}
                />
                <div className="mt-2 text-sm font-bold">
                  جارٍ فحص جودة الصفحات وعزل الجداول العربية ({fileName})...
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  بوابة الفحص الآمن · تفكيك الحروف · تقرير النواقص
                </div>
              </>
            ) : (
              <>
                <Upload
                  className="h-8 w-8"
                  style={{ color: 'var(--accent)' }}
                />
                <div className="mt-2 text-sm font-bold">
                  {fileName
                    ? `ملف محدد: ${fileName} — انقر لاختيار ملف آخر`
                    : 'اضغط هنا لرفع ملف PDF (جداول قديمة أو مرسلة)'}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  صيغة PDF فقط (بحد أقصى 20 ميجابايت) · رفض فوري لأي ملف مشوش
                  أو تالف
                </div>
              </>
            )}
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={loading}
              onChange={handlePdfUpload}
              className="hidden"
            />
          </label>
        ) : (
          <BurstCameraCapture
            analyzing={loading}
            scanMode={scanMode}
            onBurstReadyAndAnalyze={handleCameraBurstAnalyze}
          />
        )}

        {uploadError && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-lg border px-4 py-3 text-xs font-semibold"
            style={{
              borderColor: 'var(--danger)',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </section>

      {/* Safe Rejection Gate Banner */}
      {analysis?.status === 'rejected' && (
        <section
          role="alert"
          className="rounded-xl border p-5"
          style={{
            backgroundColor: 'var(--danger-bg)',
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
          }}
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="space-y-2">
              <h2 className="text-base font-bold">
                تم رفض المستند بأمان منعًا للأخطاء الصامتة (درجة الوضوح:{' '}
                {analysis.clarityScore}%)
              </h2>
              <ul className="list-disc space-y-1 pr-5 text-xs font-semibold">
                {analysis.rejectionReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Commit Receipt Banner */}
      {commitSummary && (
        <section
          className="space-y-3 rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success)',
            color: 'var(--success)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>
                تم اعتماد وترحيل ({commitSummary.totalRows}) سجل بنجاح: إضافة{' '}
                {commitSummary.added} · تحديث {commitSummary.updated}
                {commitSummary.replaced > 0
                  ? ` · استبدال ${commitSummary.replaced}`
                  : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {commitSummary.buckets.map((b, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (b.destinationKind === 'agency' && b.agencyId) {
                      onDoneNavigateToAgency(b.agencyId);
                    } else if (b.destinationKind === 'master_roster') {
                      onNavigateToView('master_roster');
                    } else {
                      onNavigateToView('ready_lists');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--success)',
                    color: 'var(--success-fg)',
                  }}
                >
                  <span>فتح {b.destinationLabel}</span>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Post-Extraction Pipeline */}
      {analysis && analysis.status !== 'rejected' && (
        <>
          {/* 4-Metric Audit Bar */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                فحص جودة المصدر
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{ color: 'var(--success)' }}
              >
                {analysis.clarityScore}% · مقبول
              </div>
            </div>

            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                الصفوف المؤكدة 100%
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                {verifiedRows.length} من {rows.length} صف
              </div>
            </div>

            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor:
                  doubtedRows.length > 0
                    ? 'var(--danger)'
                    : 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                كشف الشك باللون الأحمر
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{
                  color:
                    doubtedRows.length > 0
                      ? 'var(--danger)'
                      : 'var(--success)',
                }}
              >
                {doubtedRows.length} قيد للمراجعة
              </div>
            </div>

            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor:
                  missingRows.length > 0
                    ? 'var(--danger)'
                    : 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                تقرير النواقص الإجباري
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{
                  color:
                    missingRows.length > 0
                      ? 'var(--danger)'
                      : 'var(--success)',
                }}
              >
                {missingRows.length} صف ناقص
              </div>
            </div>
          </section>

          {/* Stage 2A: Red-Flag Doubt & Arabic Glyph Decomposition Panel */}
          {doubtedRows.length > 0 && (
            <section
              aria-label="منطقة الشك الحمراء وتفكيك الحروف"
              className="space-y-3 rounded-xl border p-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--danger)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className="h-5 w-5"
                    style={{ color: 'var(--danger)' }}
                  />
                  <h2
                    className="text-sm font-bold"
                    style={{ color: 'var(--danger)' }}
                  >
                    منطقة الشك باللون الأحمر وتدقيق الحروف ({doubtedRows.length}) —
                    تتطلب مطابقتك وتأكيدك الصريح
                  </h2>
                </div>
              </div>

              <div className="space-y-3">
                {doubtedRows.map((row) => (
                  <RedFlagDoubtSegment
                    key={row.id}
                    row={row}
                    nameTree={nameTree}
                    sourceImageUrl={
                      analysis.sourceImageUrls?.[row.pageNumber] ||
                      analysis.sourceImageUrls?.[1]
                    }
                    focusedFields={analysis.focusedFields || focusedFields}
                    onUpdateRow={updateRow}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Stage 2B: Mandatory Missing Fields Report */}
          {missingRows.length > 0 && (
            <section
              aria-label="تقرير النواقص والإدخال اليدوي الإجباري"
              className="rounded-xl border p-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--danger)',
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <FileWarning
                  className="h-5 w-5"
                  style={{ color: 'var(--danger)' }}
                />
                <h2
                  className="text-sm font-bold"
                  style={{ color: 'var(--danger)' }}
                >
                  تقرير النواقص والإدخال اليدوي الإجباري ({missingRows.length} صف)
                </h2>
              </div>

              <div className="space-y-2">
                {missingRows.map((row) => {
                  const labels: Record<string, string> = {
                    name: 'الاسم',
                    individuals: 'الأفراد',
                    decreaseCount: 'النزول/النقصان',
                    addOrDeleteCount: 'الإضافة/الحذف',
                  };
                  return (
                    <div
                      key={row.id}
                      className="rounded-lg border p-3"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--danger)',
                      }}
                    >
                      <div className="mb-2 text-xs font-bold">
                        صف {row.rowIndex} — الحقول الناقصة:{' '}
                        <span style={{ color: 'var(--danger)' }}>
                          {row.missingFields.map((f) => labels[f]).join('، ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                        <input
                          type="text"
                          value={row.resolvedName}
                          onChange={(e) =>
                            updateRow(row.id, { resolvedName: e.target.value })
                          }
                          placeholder="الاسم الكامل *"
                          className="rounded-lg border px-2.5 py-1.5 text-xs sm:col-span-2"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: row.missingFields.includes('name')
                              ? 'var(--danger)'
                              : 'var(--border-color)',
                          }}
                        />
                        <input
                          type="number"
                          min={0}
                          value={row.resolvedIndividuals ?? ''}
                          onChange={(e) =>
                            updateRow(row.id, {
                              resolvedIndividuals:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="الأفراد *"
                          className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: row.missingFields.includes('individuals')
                              ? 'var(--danger)'
                              : 'var(--border-color)',
                          }}
                        />
                        <input
                          type="number"
                          min={0}
                          value={row.resolvedDecreaseCount ?? ''}
                          onChange={(e) =>
                            updateRow(row.id, {
                              resolvedDecreaseCount:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="النزول/النقصان *"
                          className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: row.missingFields.includes(
                              'decreaseCount'
                            )
                              ? 'var(--danger)'
                              : 'var(--border-color)',
                          }}
                        />
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min={0}
                            value={row.resolvedAddOrDeleteCount ?? ''}
                            onChange={(e) =>
                              updateRow(row.id, {
                                resolvedAddOrDeleteCount:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                            placeholder="إضافة/حذف *"
                            className="w-full rounded-lg border px-2 py-1.5 text-xs tabular-nums"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: row.missingFields.includes(
                                'addOrDeleteCount'
                              )
                                ? 'var(--danger)'
                                : 'var(--border-color)',
                            }}
                          />
                          <select
                            value={row.resolvedAddOrDeleteAction}
                            onChange={(e) =>
                              updateRow(row.id, {
                                resolvedAddOrDeleteAction: e.target
                                  .value as QuickExtractEvaluatedRow['resolvedAddOrDeleteAction'],
                              })
                            }
                            className="rounded-lg border px-1.5 py-1.5 text-xs"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <option value="لا يوجد">لا يوجد</option>
                            <option value="إضافة">إضافة</option>
                            <option value="حذف">حذف</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Zero-Blind-Commit Gate Lock Card */}
          {!gateUnlocked ? (
            <section
              aria-label="بوابة القفل الصارم قبل التحضير النهائي"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)',
                color: 'var(--warning)',
              }}
            >
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 shrink-0" />
                <div className="text-xs font-bold leading-relaxed">
                  شاشة التحضير النهائي والترحيل مقفلة حاليًا (Zero-Blind-Commit):
                  تأكد أولًا من حل جميع الأسماء المشكوك فيها باللون الأحمر وإكمال
                  كافة الحقول الناقصة أعلاه ({doubtedRows.length} شك ·{' '}
                  {missingRows.length} نواقص).
                </div>
              </div>
            </section>
          ) : (
            /* Stage 4: Final Preparation, Core Table Reuse & Smart Multi-Destination Routing */
            <section
              aria-label="شاشة التحضير والفلترة النهائية"
              className="space-y-4"
            >
              <RoutingPanel
                routing={routingConfig}
                agencies={agencies}
                readyLists={readyLists}
                planCounts={selectedPlanCounts}
                onChange={setRoutingConfig}
              />

              <div
                className="space-y-3 rounded-xl border p-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="h-4 w-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <h2 className="text-sm font-bold">
                      معاينة الجدول الأساسي والتحرير المباشر ({filteredReadyRows.length})
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={pastRows.length === 0}
                      onClick={handleLocalUndo}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-35"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <Undo2
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--accent)' }}
                      />
                      <span>تراجع</span>
                    </button>

                    <button
                      type="button"
                      disabled={futureRows.length === 0}
                      onClick={handleLocalRedo}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-35"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <Redo2
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--accent)' }}
                      />
                      <span>إعادة</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Filter
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        type="search"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="فلترة الأسماء..."
                        className="rounded-lg border px-2.5 py-1.5 text-xs"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>

                    <select
                      value={filterScope}
                      onChange={(e) =>
                        setFilterScope(
                          e.target.value as 'all' | 'new_only' | 'updates_only'
                        )
                      }
                      aria-label="فلترة نوع السجل"
                      className="rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <option value="all">الكل (جديد + تحديث)</option>
                      <option value="new_only">الأسماء الجديدة فقط</option>
                      <option value="updates_only">
                        المطابقة الموجودة فقط
                      </option>
                    </select>
                  </div>
                </div>

                {/* Shared Selection Action Bar */}
                <SelectionActionBar
                  selectedRecords={selectablePreviewRecords}
                  totalVisibleCount={filteredReadyRows.length}
                  agencies={agencies}
                  readyLists={readyLists}
                  relations={relations}
                  calculationSettings={calculationSettings}
                  tableTitle={fileName || 'السحب السريع'}
                  tableDate={new Date().toISOString().slice(0, 10)}
                  onSelectAll={() =>
                    setSelectedRowIds(filteredReadyRows.map((r) => r.id))
                  }
                  onClearSelection={() => setSelectedRowIds([])}
                  onMoveToAgency={onMovePersonsToAgency}
                  onAddToReadyList={onAddPersonsToReadyList}
                  onUpsertRelation={onUpsertRelation}
                />

                {/* Reused Core Application Spreadsheet Table */}
                <CoreRosterTable
                  rows={corePreviewRows}
                  selectedIds={selectedRowIds}
                  focusedRowKey={focusedRowKey}
                  calculationSettings={calculationSettings}
                  themePrefs={themePrefs}
                  showExtractColumns
                  editableInline
                  emptyMessage="لا توجد صفوف مطابقة لخيارات الفلترة الحالية."
                  onToggleSelectRow={(rowId) =>
                    setSelectedRowIds((prev) =>
                      prev.includes(rowId)
                        ? prev.filter((id) => id !== rowId)
                        : [...prev, rowId]
                    )
                  }
                  onToggleSelectAll={(checked) =>
                    setSelectedRowIds(
                      checked ? filteredReadyRows.map((r) => r.id) : []
                    )
                  }
                  onFocusRow={setFocusedRowKey}
                  onInlinePatchRow={(rowKey, patch) =>
                    updateRow(
                      rowKey,
                      {
                        ...(patch.name !== undefined
                          ? { resolvedName: patch.name }
                          : {}),
                        ...(patch.individuals !== undefined
                          ? { resolvedIndividuals: patch.individuals }
                          : {}),
                        ...(patch.decreaseCount !== undefined
                          ? { resolvedDecreaseCount: patch.decreaseCount }
                          : {}),
                        ...(patch.addOrDeleteCount !== undefined
                          ? { resolvedAddOrDeleteCount: patch.addOrDeleteCount }
                          : {}),
                        ...(patch.addOrDeleteAction !== undefined
                          ? {
                              resolvedAddOrDeleteAction:
                                patch.addOrDeleteAction,
                            }
                          : {}),
                        ...(patch.notes !== undefined
                          ? { notes: patch.notes }
                          : {}),
                      },
                      { resetConfirmOnNameEdit: false }
                    )
                  }
                  onOverrideRowRoute={(rowKey, mode) => {
                    setRoutingConfig((prev) => {
                      const nextOverrides = { ...(prev.rowOverrides || {}) };
                      if (mode === 'auto') {
                        delete nextOverrides[rowKey];
                      } else if (mode === 'exclude') {
                        nextOverrides[rowKey] = { excluded: true };
                      } else {
                        nextOverrides[rowKey] = {
                          excluded: false,
                          mergeStrategy: mode,
                        };
                      }
                      return { ...prev, rowOverrides: nextOverrides };
                    });
                  }}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    يتم الترحيل الفعلي فقط بعد ضغط زر الموافقة والاعتماد النهائي.
                  </div>

                  <button
                    type="button"
                    disabled={!canProceedToCommit}
                    onClick={() => {
                      if (
                        selectedPlanCounts.update > 0 ||
                        selectedPlanCounts.replace > 0
                      ) {
                        setShowConfirmUpdates(true);
                      } else {
                        executeCommit();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <Check className="h-4 w-4" />
                    <span>
                      الموافقة والترحيل النهائي ({rowsChosenForCommit.length} سجل)
                    </span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Confirmation Modal for Existing Record Updates or Replacement */}
      {showConfirmUpdates && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد التعديلات قبل الترحيل"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        >
          <div
            className="w-full max-w-md rounded-xl border p-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <h3 className="text-base font-bold">
              تأكيد اعتماد التغييرات والترحيل النهائي
            </h3>
            <p
              className="mt-2 text-xs leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              يشمل الترحيل: إضافة <strong>{selectedPlanCounts.add}</strong> سجل
              جديد، وتحديث <strong>{selectedPlanCounts.update}</strong> سجل
              موجود
              {selectedPlanCounts.replace > 0
                ? `، واستبدال ${selectedPlanCounts.replace} سجل في الوجهة المختارة`
                : ''}
              . هل توافق على التنفيذ؟
            </p>
            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowConfirmUpdates(false)}
                className="rounded-lg border px-4 py-2 font-medium"
                style={{ borderColor: 'var(--border-color)' }}
              >
                مراجعة وإلغاء
              </button>
              <button
                type="button"
                onClick={executeCommit}
                className="rounded-lg px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                موافق — تنفيذ الترحيل الآن
              </button>
            </div>
          </div>
        </div>
      )}
      <ReferenceTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSaveTemplate={onSaveQuickExtractTemplate}
      />
    </main>
  );
};
