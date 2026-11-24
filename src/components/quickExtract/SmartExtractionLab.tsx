import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Columns,
  Edit3,
  Eye,
  EyeOff,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';
import type {
  InferredDocumentMetadata,
  QuickExtractEvaluatedRow,
} from '../../types/agency';
import type { AiTaskRoutingMap } from '../../types/assistant';
import { computeRowZeroTrustSummary } from '../../utils/zeroTrustExtract';
import { ContextualRowSnippet } from './ContextualRowSnippetModal';
import { LiveDraftCopilot, type CopilotOperation } from './LiveDraftCopilot';
import { SmartSourceViewer } from './SmartSourceViewer';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_SUBVIEW_VARIANTS,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

export type SmartLabFilterMode =
  | 'all'
  | 'blocked'
  | 'large_families'
  | 'doubtful'
  | 'verified';

export interface SmartExtractionLabProps {
  rows: QuickExtractEvaluatedRow[];
  inferredMetadata?: InferredDocumentMetadata | null;
  documentSummary: string;
  sourceImageUrl?: string;
  sourceImageUrls?: Record<number, string>;
  sourcePdfUrl?: string;
  filterMode: SmartLabFilterMode;
  hideEmptyColumns: boolean;
  highlightedRowIndex: number | null;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  showToggleHeader?: boolean;
  onUpdateRow: (
    rowId: string,
    patch: Partial<QuickExtractEvaluatedRow>,
    options?: {
      resetConfirmOnNameEdit?: boolean;
      zeroTrustConfirmed?: boolean;
    }
  ) => void;
  onDeleteRow: (rowId: string) => void;
  onApplyCopilotOperations: (ops: CopilotOperation[]) => string[];
  onAnalyzeCroppedRegion: (
    croppedDataUrl: string,
    box?: { ymin: number; xmin: number; ymax: number; xmax: number }
  ) => Promise<void>;
  onSelectZoomRow?: (row: QuickExtractEvaluatedRow) => void;
  presetPrompt?: string | null;
  onClearPresetPrompt?: () => void;
  copilotSectionRef?: React.RefObject<HTMLDivElement | null>;
  taskRouting?: AiTaskRoutingMap;
}

export const SmartExtractionLab: React.FC<SmartExtractionLabProps> = ({
  rows,
  inferredMetadata,
  documentSummary,
  sourceImageUrl,
  sourceImageUrls,
  sourcePdfUrl,
  filterMode,
  hideEmptyColumns,
  highlightedRowIndex,
  isOpen: controlledOpen,
  onToggleOpen,
  showToggleHeader = true,
  onUpdateRow,
  onDeleteRow,
  onApplyCopilotOperations,
  onAnalyzeCroppedRegion,
  onSelectZoomRow,
  presetPrompt = null,
  onClearPresetPrompt,
  copilotSectionRef,
  taskRouting,
}) => {
  const [internalOpen, setInternalOpen] = useState(true);
  const isOpen = controlledOpen ?? internalOpen;
  const handleToggleOpen = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else {
      setInternalOpen((v) => !v);
    }
  };

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [viewerCollapsed, setViewerCollapsed] = useState(false);
  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null);
  const reducedMotion = useTabrixReducedMotion();
  const labVariants = reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_SUBVIEW_VARIANTS;
  const popoverVariants = reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS;
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    resolvedName: string;
    resolvedIndividuals: string;
    resolvedEligibleIndividuals: string;
    resolvedDecreaseCount: string;
    resolvedAddOrDeleteCount: string;
    resolvedAddOrDeleteAction: 'إضافة' | 'حذف' | 'لا يوجد';
    resolvedRowDate: string;
    notes: string;
  } | null>(null);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const fallbackCopilotRef = useRef<HTMLDivElement | null>(null);
  const effectiveCopilotRef = copilotSectionRef || fallbackCopilotRef;

  const rowSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeRowZeroTrustSummary>>();
    for (const r of rows) {
      map.set(r.id, computeRowZeroTrustSummary(r));
    }
    return map;
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      const summary = rowSummaries.get(r.id);
      if (filterMode === 'doubtful') return Boolean(summary?.anyDoubt);
      if (filterMode === 'verified') return !summary?.anyDoubt;
      if (filterMode === 'blocked') return (r.resolvedDecreaseCount ?? 0) > 0;
      if (filterMode === 'large_families') {
        return (r.resolvedIndividuals ?? 0) >= 5;
      }
      return true;
    });
  }, [rows, rowSummaries, filterMode]);

  const hasAnyEligibleCol = useMemo(
    () => rows.some((r) => typeof r.resolvedEligibleIndividuals === 'number'),
    [rows]
  );

  const columnVisibility = useMemo(() => {
    if (!hideEmptyColumns) {
      return {
        showEligible: hasAnyEligibleCol,
        showDecrease: true,
        showAddDel: true,
        showDate: true,
        showNotes: true,
      };
    }
    return {
      showEligible: hasAnyEligibleCol,
      showDecrease: rows.some((r) => (r.resolvedDecreaseCount ?? 0) > 0),
      showAddDel: rows.some(
        (r) =>
          (r.resolvedAddOrDeleteCount ?? 0) > 0 &&
          r.resolvedAddOrDeleteAction !== 'لا يوجد'
      ),
      showDate: rows.some((r) =>
        Boolean((r.resolvedRowDate || r.rowDate || '').trim())
      ),
      showNotes: rows.some((r) => Boolean((r.notes || '').trim())),
    };
  }, [rows, hideEmptyColumns, hasAnyEligibleCol]);

  const activeTableColSpan =
    4 +
    (columnVisibility.showEligible ? 1 : 0) +
    (columnVisibility.showDecrease ? 1 : 0) +
    (columnVisibility.showAddDel ? 1 : 0) +
    (columnVisibility.showDate ? 1 : 0) +
    (columnVisibility.showNotes ? 1 : 0);

  const startManualEdit = (row: QuickExtractEvaluatedRow) => {
    setEditingRowId(row.id);
    setSelectedRowId(row.id);
    setEditDraft({
      resolvedName: row.resolvedName,
      resolvedIndividuals:
        row.resolvedIndividuals !== null ? String(row.resolvedIndividuals) : '',
      resolvedEligibleIndividuals:
        typeof row.resolvedEligibleIndividuals === 'number'
          ? String(row.resolvedEligibleIndividuals)
          : '',
      resolvedDecreaseCount: String(row.resolvedDecreaseCount ?? 0),
      resolvedAddOrDeleteCount: String(row.resolvedAddOrDeleteCount ?? 0),
      resolvedAddOrDeleteAction: row.resolvedAddOrDeleteAction,
      resolvedRowDate: row.resolvedRowDate ?? row.rowDate ?? '',
      notes: row.notes || '',
    });
  };

  const saveManualEdit = (row: QuickExtractEvaluatedRow) => {
    if (!editDraft) return;
    const indNum =
      editDraft.resolvedIndividuals.trim() === ''
        ? null
        : Math.max(0, Math.round(Number(editDraft.resolvedIndividuals) || 0));
    const eligNum =
      editDraft.resolvedEligibleIndividuals.trim() === ''
        ? null
        : Math.max(
            0,
            Math.round(Number(editDraft.resolvedEligibleIndividuals) || 0)
          );
    const decNum = Math.max(
      0,
      Math.round(Number(editDraft.resolvedDecreaseCount) || 0)
    );
    const addDelNum = Math.max(
      0,
      Math.round(Number(editDraft.resolvedAddOrDeleteCount) || 0)
    );

    onUpdateRow(
      row.id,
      {
        resolvedName: editDraft.resolvedName.trim(),
        resolvedIndividuals: indNum,
        resolvedEligibleIndividuals: eligNum,
        resolvedDecreaseCount: decNum,
        resolvedAddOrDeleteCount: addDelNum,
        resolvedAddOrDeleteAction: editDraft.resolvedAddOrDeleteAction,
        resolvedRowDate: editDraft.resolvedRowDate.trim(),
        rowDate: editDraft.resolvedRowDate.trim() || null,
        notes: editDraft.notes.trim(),
        nameConfidence: 1,
        numbersConfidence: 1,
        dateConfidence: 1,
        modelDoubtFlag: false,
        modelDoubtReason: '',
        hasDoubt: false,
        doubtConfirmed: true,
        mathConfirmed: true,
      },
      { zeroTrustConfirmed: true }
    );
    setEditingRowId(null);
    setEditDraft(null);
  };

  const cellStyleForStatus = (status: 'verified' | 'yellow' | 'red') => {
    if (status === 'red') {
      return {
        backgroundColor: 'var(--danger-bg)',
        borderColor: 'var(--danger)',
      };
    }
    if (status === 'yellow') {
      return {
        backgroundColor: 'var(--warning-bg)',
        borderColor: 'var(--warning)',
      };
    }
    return {};
  };

  const handleSelectRowFromViewer = (row: QuickExtractEvaluatedRow) => {
    setSelectedRowId(row.id);
    const el = rowRefs.current[row.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <section className="space-y-3 transition-all duration-200">
      {showToggleHeader && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Columns className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              المختبر التفاعلي المقسّم (Split-Screen)
            </span>
            <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
              ·
            </span>
            <span className="font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {visibleRows.length} من {rows.length} صف
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleOpen}
            aria-expanded={isOpen}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150"
            style={{
              backgroundColor: isOpen ? 'var(--bg-nav-active)' : 'var(--accent)',
              borderColor: 'var(--accent)',
              color: isOpen ? 'var(--accent)' : 'var(--accent-fg)',
            }}
          >
            {isOpen ? (
              <>
                <PanelLeftClose className="h-3.5 w-3.5 shrink-0" />
                <EyeOff className="h-3.5 w-3.5 shrink-0" />
                <span>إخفاء المختبر الذكي</span>
              </>
            ) : (
              <>
                <PanelLeftOpen className="h-3.5 w-3.5 shrink-0" />
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>إظهار المختبر الذكي</span>
              </>
            )}
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isOpen && (
          /*
            True RTL Flex Split-Screen (`dir="rtl"`):
            - Flex child #1 sits on the RIGHT: SmartSourceViewer (PDF/Image viewer + Zoom/Pan + Visual Row Highlight Sync)
            - Flex child #2 sits on the LEFT (`flex-1 min-w-0`): Interactive Draft Table + Mathematical Audits + Snippets + Copilot
          */
          <motion.div
            key="smart-extraction-lab-body"
            custom={1}
            variants={labVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-start gap-4 lg:flex-row"
          >
          {/* RIGHT SIDE IN RTL: PDF / Image Viewer */}
          <div
            className={
              viewerCollapsed
                ? 'w-full'
                : 'w-full shrink-0 lg:sticky lg:top-4 lg:w-[44%]'
            }
          >
            <SmartSourceViewer
              rows={rows}
              sourceImageUrl={sourceImageUrl}
              sourceImageUrls={sourceImageUrls}
              sourcePdfUrl={sourcePdfUrl}
              hoveredRowId={hoveredRowId}
              selectedRowId={selectedRowId}
              onHoverRow={setHoveredRowId}
              onSelectRow={handleSelectRowFromViewer}
              onExtractCroppedRegion={onAnalyzeCroppedRegion}
              collapsed={viewerCollapsed}
              onToggleCollapse={() => setViewerCollapsed((v) => !v)}
            />
          </div>

          {/* LEFT SIDE IN RTL: Interactive Draft Table & Morrow Copilot */}
          <div className="w-full min-w-0 flex-1 space-y-4">
            <div
              className="overflow-x-auto rounded-2xl border backdrop-blur-md"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--bg-surface) 94%, transparent)',
                borderColor: 'var(--border-color)',
              }}
            >
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr
                    className="border-b text-[11px]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <th className="px-3 py-2.5 font-semibold">#</th>
                    <th className="px-3 py-2.5 font-semibold">
                      اسم المستفيد (قاعدة 99%)
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      الأفراد (الكلية)
                    </th>
                    {columnVisibility.showEligible && (
                      <th className="px-3 py-2.5 font-semibold">المستحقة</th>
                    )}
                    {columnVisibility.showDecrease && (
                      <th className="px-3 py-2.5 font-semibold">نزول/محجوب</th>
                    )}
                    {columnVisibility.showAddDel && (
                      <th className="px-3 py-2.5 font-semibold">إضافة / حذف</th>
                    )}
                    {columnVisibility.showDate && (
                      <th className="px-3 py-2.5 font-semibold">التاريخ</th>
                    )}
                    {columnVisibility.showNotes && (
                      <th className="px-3 py-2.5 font-semibold">ملاحظات</th>
                    )}
                    <th className="px-3 py-2.5 font-semibold">إجراءات التحقق</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeTableColSpan}
                        className="px-4 py-8 text-center text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        لا توجد صفوف مطابقة للتصفية الحالية داخل المسودة.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => {
                      const zt =
                        rowSummaries.get(row.id) ||
                        computeRowZeroTrustSummary(row);
                      const isEditing = editingRowId === row.id;
                      const isSyncedActive =
                        hoveredRowId === row.id ||
                        selectedRowId === row.id ||
                        highlightedRowIndex === row.rowIndex;
                      const hasUnconfirmedMath =
                        row.mathIssues.length > 0 && !row.mathConfirmed;

                      const issueParts: string[] = [];
                      if (zt.name.needsReview) {
                        issueParts.push(
                          `الاسم مشكوك بنسبة ${zt.name.confidencePct}%`
                        );
                      }
                      if (hasUnconfirmedMath) {
                        issueParts.push(row.mathIssues.join(' · '));
                      } else if (zt.numbers.needsReview) {
                        issueParts.push(
                          `الأرقام مشكوكة بنسبة ${zt.numbers.confidencePct}%`
                        );
                      }
                      if (zt.date.needsReview) {
                        issueParts.push(
                          `التاريخ مشكوك بنسبة ${zt.date.confidencePct}%`
                        );
                      }

                      return (
                        <React.Fragment key={row.id}>
                          <tr
                            ref={(el) => {
                              rowRefs.current[row.id] = el;
                            }}
                            onMouseEnter={() => setHoveredRowId(row.id)}
                            onMouseLeave={() =>
                              setHoveredRowId((prev) =>
                                prev === row.id ? null : prev
                              )
                            }
                            onClick={() => setSelectedRowId(row.id)}
                            className="border-b transition-colors duration-150"
                            style={{
                              borderColor: 'var(--border-color)',
                              backgroundColor: isSyncedActive
                                ? 'color-mix(in srgb, var(--bg-nav-active) 85%, transparent)'
                                : 'transparent',
                              boxShadow: isSyncedActive
                                ? 'inset -3px 0 0 0 var(--accent)'
                                : undefined,
                            }}
                          >
                            <td
                              className="px-3 py-2.5 font-mono tabular-nums"
                              style={{
                                color: isSyncedActive
                                  ? 'var(--accent)'
                                  : 'var(--text-muted)',
                                fontWeight: isSyncedActive ? 700 : 500,
                              }}
                            >
                              {row.rowIndex}
                            </td>

                            {/* Name Cell with 1% Doubt Rule */}
                            <td className="px-3 py-2.5 align-top">
                              {isEditing && editDraft ? (
                                <input
                                  type="text"
                                  value={editDraft.resolvedName}
                                  onChange={(e) =>
                                    setEditDraft({
                                      ...editDraft,
                                      resolvedName: e.target.value,
                                    })
                                  }
                                  className="w-full min-w-40 rounded-md border px-2 py-1 text-xs"
                                  style={{
                                    backgroundColor: 'var(--bg-main)',
                                    borderColor: 'var(--accent)',
                                    color: 'var(--text-primary)',
                                  }}
                                />
                              ) : (
                                <div
                                  className="relative rounded-md border px-2 py-1.5"
                                  style={{
                                    borderColor: zt.name.needsReview
                                      ? undefined
                                      : 'transparent',
                                    ...cellStyleForStatus(zt.name.status),
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold">
                                      {row.resolvedName || 'اسم مفقود / غير مقروء'}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <span
                                        className="font-mono text-[10px] tabular-nums"
                                        style={{ color: 'var(--text-muted)' }}
                                      >
                                        {zt.name.confidencePct}%
                                      </span>
                                      {zt.name.needsReview && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenTooltipKey((prev) =>
                                              prev === `${row.id}:name`
                                                ? null
                                                : `${row.id}:name`
                                            );
                                          }}
                                          className="rounded p-0.5"
                                          style={{
                                            color:
                                              zt.name.status === 'red'
                                                ? 'var(--danger)'
                                                : 'var(--warning)',
                                          }}
                                          title={zt.name.tooltipQuestion}
                                          aria-label="توضيح الشك في الاسم"
                                        >
                                          <HelpCircle className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {openTooltipKey === `${row.id}:name` && (
                                      <motion.div
                                        key="name-doubt-tooltip"
                                        variants={popoverVariants}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        className="mt-1.5 rounded-md border p-2 text-[11px]"
                                        style={{
                                          backgroundColor: 'var(--bg-surface)',
                                          borderColor: 'var(--warning)',
                                          color: 'var(--text-primary)',
                                        }}
                                      >
                                        <div>{zt.name.tooltipQuestion}</div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenTooltipKey(null);
                                            startManualEdit(row);
                                          }}
                                          className="mt-1 font-semibold underline"
                                          style={{ color: 'var(--accent)' }}
                                        >
                                          تعديل يدوي الآن
                                        </button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </td>

                            {/* Total Individuals Cell with 1% Doubt + Automatic Math Check */}
                            <td className="px-3 py-2.5 align-top">
                              {isEditing && editDraft ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={editDraft.resolvedIndividuals}
                                  onChange={(e) =>
                                    setEditDraft({
                                      ...editDraft,
                                      resolvedIndividuals: e.target.value,
                                    })
                                  }
                                  className="w-20 rounded-md border px-2 py-1 font-mono text-xs tabular-nums"
                                  style={{
                                    backgroundColor: 'var(--bg-main)',
                                    borderColor: 'var(--accent)',
                                    color: 'var(--text-primary)',
                                  }}
                                />
                              ) : (
                                <div
                                  className="rounded-md border px-2 py-1.5 font-mono tabular-nums"
                                  style={{
                                    borderColor: zt.numbers.needsReview
                                      ? undefined
                                      : 'transparent',
                                    ...cellStyleForStatus(zt.numbers.status),
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-bold">
                                      {row.resolvedIndividuals ?? '—'}
                                    </span>
                                    {zt.numbers.needsReview && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenTooltipKey((prev) =>
                                            prev === `${row.id}:num`
                                              ? null
                                              : `${row.id}:num`
                                          );
                                        }}
                                        className="rounded p-0.5"
                                        style={{
                                          color:
                                            zt.numbers.status === 'red'
                                              ? 'var(--danger)'
                                              : 'var(--warning)',
                                        }}
                                        title={zt.numbers.tooltipQuestion}
                                        aria-label="توضيح الشك في الأرقام"
                                      >
                                        <HelpCircle className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  {hasUnconfirmedMath && (
                                    <div
                                      className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-sans text-[10px] font-bold"
                                      style={{
                                        backgroundColor: 'var(--bg-surface)',
                                        color: 'var(--warning)',
                                      }}
                                      title={row.mathIssues[0]}
                                    >
                                      <AlertTriangle className="h-3 w-3 shrink-0" />
                                      <span>تعارض رياضي</span>
                                    </div>
                                  )}

                                  <AnimatePresence>
                                    {openTooltipKey === `${row.id}:num` && (
                                      <motion.div
                                        key="num-doubt-tooltip"
                                        variants={popoverVariants}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        className="mt-1.5 rounded-md border p-2 font-sans text-[11px]"
                                        style={{
                                          backgroundColor: 'var(--bg-surface)',
                                          borderColor: 'var(--warning)',
                                          color: 'var(--text-primary)',
                                        }}
                                      >
                                        <div>{zt.numbers.tooltipQuestion}</div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenTooltipKey(null);
                                            startManualEdit(row);
                                          }}
                                          className="mt-1 font-semibold underline"
                                          style={{ color: 'var(--accent)' }}
                                        >
                                          تعديل يدوي
                                        </button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </td>

                            {/* Eligible Individuals */}
                            {columnVisibility.showEligible && (
                              <td className="px-3 py-2.5 align-top font-mono tabular-nums">
                                {isEditing && editDraft ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={editDraft.resolvedEligibleIndividuals}
                                    onChange={(e) =>
                                      setEditDraft({
                                        ...editDraft,
                                        resolvedEligibleIndividuals:
                                          e.target.value,
                                      })
                                    }
                                    className="w-16 rounded-md border px-2 py-1 text-xs"
                                    style={{
                                      backgroundColor: 'var(--bg-main)',
                                      borderColor: 'var(--accent)',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                ) : (
                                  <span
                                    style={{
                                      color: hasUnconfirmedMath
                                        ? 'var(--warning)'
                                        : 'var(--text-primary)',
                                      fontWeight: hasUnconfirmedMath ? 700 : 500,
                                    }}
                                  >
                                    {row.resolvedEligibleIndividuals ?? '—'}
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Decrease / Blocked Individuals */}
                            {columnVisibility.showDecrease && (
                              <td className="px-3 py-2.5 align-top font-mono tabular-nums">
                                {isEditing && editDraft ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={editDraft.resolvedDecreaseCount}
                                    onChange={(e) =>
                                      setEditDraft({
                                        ...editDraft,
                                        resolvedDecreaseCount: e.target.value,
                                      })
                                    }
                                    className="w-16 rounded-md border px-2 py-1 text-xs"
                                    style={{
                                      backgroundColor: 'var(--bg-main)',
                                      borderColor: 'var(--accent)',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                ) : (
                                  <span
                                    style={{
                                      color: hasUnconfirmedMath
                                        ? 'var(--warning)'
                                        : 'var(--text-primary)',
                                      fontWeight: hasUnconfirmedMath ? 700 : 500,
                                    }}
                                  >
                                    {row.resolvedDecreaseCount ?? 0}
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Add/Delete */}
                            {columnVisibility.showAddDel && (
                              <td className="px-3 py-2.5 align-top">
                                {isEditing && editDraft ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={
                                        editDraft.resolvedAddOrDeleteAction
                                      }
                                      onChange={(e) =>
                                        setEditDraft({
                                          ...editDraft,
                                          resolvedAddOrDeleteAction: e.target
                                            .value as 'إضافة' | 'حذف' | 'لا يوجد',
                                        })
                                      }
                                      className="rounded-md border px-1.5 py-1 text-[11px]"
                                      style={{
                                        backgroundColor: 'var(--bg-main)',
                                        borderColor: 'var(--border-color)',
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      <option value="لا يوجد">لا يوجد</option>
                                      <option value="إضافة">إضافة</option>
                                      <option value="حذف">حذف</option>
                                    </select>
                                    <input
                                      type="number"
                                      min={0}
                                      value={editDraft.resolvedAddOrDeleteCount}
                                      onChange={(e) =>
                                        setEditDraft({
                                          ...editDraft,
                                          resolvedAddOrDeleteCount:
                                            e.target.value,
                                        })
                                      }
                                      className="w-14 rounded-md border px-1.5 py-1 font-mono text-xs tabular-nums"
                                      style={{
                                        backgroundColor: 'var(--bg-main)',
                                        borderColor: 'var(--border-color)',
                                        color: 'var(--text-primary)',
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <span className="font-mono tabular-nums">
                                    {row.resolvedAddOrDeleteAction === 'لا يوجد'
                                      ? '—'
                                      : `${row.resolvedAddOrDeleteAction} (${
                                          row.resolvedAddOrDeleteCount ?? 0
                                        })`}
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Row Date Cell */}
                            {columnVisibility.showDate && (
                              <td className="px-3 py-2.5 align-top">
                                {isEditing && editDraft ? (
                                  <input
                                    type="text"
                                    value={editDraft.resolvedRowDate}
                                    onChange={(e) =>
                                      setEditDraft({
                                        ...editDraft,
                                        resolvedRowDate: e.target.value,
                                      })
                                    }
                                    placeholder="التاريخ"
                                    className="w-24 rounded-md border px-2 py-1 text-xs"
                                    style={{
                                      backgroundColor: 'var(--bg-main)',
                                      borderColor: 'var(--accent)',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-1"
                                    style={{
                                      borderColor: zt.date.needsReview
                                        ? undefined
                                        : 'transparent',
                                      ...cellStyleForStatus(zt.date.status),
                                    }}
                                  >
                                    <span>
                                      {row.resolvedRowDate || row.rowDate || '—'}
                                    </span>
                                    {zt.date.needsReview && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenTooltipKey((prev) =>
                                            prev === `${row.id}:date`
                                              ? null
                                              : `${row.id}:date`
                                          );
                                        }}
                                        title={zt.date.tooltipQuestion}
                                        style={{ color: 'var(--warning)' }}
                                      >
                                        <HelpCircle className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}

                            {/* Notes */}
                            {columnVisibility.showNotes && (
                              <td className="px-3 py-2.5 align-top">
                                {isEditing && editDraft ? (
                                  <input
                                    type="text"
                                    value={editDraft.notes}
                                    onChange={(e) =>
                                      setEditDraft({
                                        ...editDraft,
                                        notes: e.target.value,
                                      })
                                    }
                                    className="w-28 rounded-md border px-2 py-1 text-xs"
                                    style={{
                                      backgroundColor: 'var(--bg-main)',
                                      borderColor: 'var(--border-color)',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    {row.notes || '—'}
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Immediate Actions */}
                            <td className="px-3 py-2.5 align-top">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveManualEdit(row)}
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white whitespace-nowrap"
                                    style={{ backgroundColor: 'var(--success)' }}
                                  >
                                    <Check className="h-3 w-3" />
                                    حفظ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRowId(null);
                                      setEditDraft(null);
                                    }}
                                    className="rounded-md border px-2 py-1 text-[11px] whitespace-nowrap"
                                    style={{ borderColor: 'var(--border-color)' }}
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startManualEdit(row)}
                                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap"
                                    style={{
                                      backgroundColor: 'var(--bg-main)',
                                      borderColor: 'var(--border-color)',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    تعديل يدوي
                                  </button>

                                  {zt.anyDoubt ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateRow(
                                          row.id,
                                          {
                                            nameConfidence: 1,
                                            numbersConfidence: 1,
                                            dateConfidence: 1,
                                            hasDoubt: false,
                                            doubtConfirmed: true,
                                            mathConfirmed: true,
                                          },
                                          { zeroTrustConfirmed: true }
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white whitespace-nowrap"
                                      style={{
                                        backgroundColor: 'var(--success)',
                                      }}
                                    >
                                      <Check className="h-3 w-3" />
                                      تأكيد
                                    </button>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                                      style={{ color: 'var(--success)' }}
                                    >
                                      <Check className="h-3 w-3" /> موثق
                                    </span>
                                  )}

                                  {(sourceImageUrl || sourcePdfUrl) &&
                                    onSelectZoomRow && (
                                      <button
                                        type="button"
                                        onClick={() => onSelectZoomRow(row)}
                                        className="rounded-md border p-1"
                                        style={{
                                          borderColor: 'var(--border-color)',
                                        }}
                                        title="معاينة الصورة عند هذا السطر"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </button>
                                    )}

                                  <button
                                    type="button"
                                    onClick={() => onDeleteRow(row.id)}
                                    className="rounded-md border p-1"
                                    style={{
                                      borderColor: 'var(--border-color)',
                                      color: 'var(--danger)',
                                    }}
                                    title="حذف السطر من المسودة"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Contextual Full-Row Snippet attached directly beneath any <99% doubted or math-conflict row */}
                          {zt.anyDoubt && (
                            <tr
                              className="border-b"
                              style={{ borderColor: 'var(--border-color)' }}
                            >
                              <td
                                colSpan={activeTableColSpan}
                                className="px-3 py-2"
                              >
                                <ContextualRowSnippet
                                  row={row}
                                  issueSummary={
                                    issueParts.join('، ') ||
                                    row.mathIssues[0] ||
                                    row.modelDoubtReason ||
                                    'درجة الثقة أقل من 99%'
                                  }
                                  sourceImageUrl={
                                    (row.pageNumber &&
                                      sourceImageUrls?.[row.pageNumber]) ||
                                    sourceImageUrl
                                  }
                                  sourcePdfUrl={sourcePdfUrl}
                                  onOpenZoom={(r) => onSelectZoomRow?.(r)}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Collapsible Morrow Copilot inside Left Pane */}
            <div ref={effectiveCopilotRef}>
              <LiveDraftCopilot
                draftRows={rows}
                inferredMetadata={inferredMetadata}
                documentSummary={documentSummary}
                sourceImageUrl={sourceImageUrl}
                presetPrompt={presetPrompt}
                onClearPresetPrompt={onClearPresetPrompt}
                onApplyOperations={onApplyCopilotOperations}
                defaultCollapsed={false}
                taskRouting={taskRouting}
              />
            </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
