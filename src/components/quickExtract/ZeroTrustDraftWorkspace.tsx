import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  Columns,
  Crop,
  Edit3,
  Eye,
  HelpCircle,
  Loader2,
  Redo2,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import type {
  InferredDocumentMetadata,
  NormalizedBox,
  QuickExtractEvaluatedRow,
} from '../../types/agency';
import { computeRowZeroTrustSummary } from '../../utils/zeroTrustExtract';
import {
  ContextualRowSnippet,
  RowZoomViewerModal,
} from './ContextualRowSnippetModal';
import { LiveDraftCopilot, type CopilotOperation } from './LiveDraftCopilot';

export type DraftFilterMode = 'all' | 'doubtful' | 'blocked' | 'verified';

interface ZeroTrustDraftWorkspaceProps {
  rows: QuickExtractEvaluatedRow[];
  inferredMetadata?: InferredDocumentMetadata | null;
  documentSummary: string;
  sourceImageUrl?: string;
  sourcePdfUrl?: string;
  filterMode: DraftFilterMode;
  onChangeFilterMode: (mode: DraftFilterMode) => void;
  hideEmptyColumns: boolean;
  onToggleHideEmptyColumns: (hide: boolean) => void;
  highlightedRowIndex: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
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
  onAnalyzeCroppedRegion: (croppedDataUrl: string, box?: NormalizedBox) => Promise<void>;
  onFinalCommit: () => void;
  committing?: boolean;
  commitLabel?: string;
}

export const ZeroTrustDraftWorkspace: React.FC<ZeroTrustDraftWorkspaceProps> = ({
  rows,
  inferredMetadata,
  documentSummary,
  sourceImageUrl,
  sourcePdfUrl,
  filterMode,
  onChangeFilterMode,
  hideEmptyColumns,
  onToggleHideEmptyColumns,
  highlightedRowIndex,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpdateRow,
  onDeleteRow,
  onApplyCopilotOperations,
  onAnalyzeCroppedRegion,
  onFinalCommit,
  committing,
  commitLabel = 'تأكيد نهائي وحفظ في الجدول الأساسي',
}) => {
  const [copilotOpenMobile, setCopilotOpenMobile] = useState(false);
  const [presetPrompt, setPresetPrompt] = useState<string | null>(null);
  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    resolvedName: string;
    resolvedIndividuals: string;
    resolvedDecreaseCount: string;
    resolvedAddOrDeleteCount: string;
    resolvedAddOrDeleteAction: 'إضافة' | 'حذف' | 'لا يوجد';
    resolvedRowDate: string;
    notes: string;
  } | null>(null);
  const [zoomRow, setZoomRow] = useState<QuickExtractEvaluatedRow | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  // Compute 1% doubt summary across all draft rows
  const rowSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeRowZeroTrustSummary>>();
    for (const r of rows) {
      map.set(r.id, computeRowZeroTrustSummary(r));
    }
    return map;
  }, [rows]);

  const counts = useMemo(() => {
    let doubtful = 0;
    let blocked = 0;
    let verified = 0;
    for (const r of rows) {
      const summary = rowSummaries.get(r.id);
      if (summary?.anyDoubt) doubtful += 1;
      else verified += 1;
      if ((r.resolvedDecreaseCount ?? 0) > 0) blocked += 1;
    }
    return { total: rows.length, doubtful, blocked, verified };
  }, [rows, rowSummaries]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      const summary = rowSummaries.get(r.id);
      if (filterMode === 'doubtful') return Boolean(summary?.anyDoubt);
      if (filterMode === 'verified') return !summary?.anyDoubt;
      if (filterMode === 'blocked') return (r.resolvedDecreaseCount ?? 0) > 0;
      return true;
    });
  }, [rows, rowSummaries, filterMode]);

  const columnVisibility = useMemo(() => {
    if (!hideEmptyColumns) {
      return {
        showDecrease: true,
        showAddDel: true,
        showDate: true,
        showNotes: true,
      };
    }
    return {
      showDecrease: rows.some((r) => (r.resolvedDecreaseCount ?? 0) > 0),
      showAddDel: rows.some(
        (r) =>
          (r.resolvedAddOrDeleteCount ?? 0) > 0 &&
          r.resolvedAddOrDeleteAction !== 'لا يوجد'
      ),
      showDate: rows.some((r) => Boolean((r.resolvedRowDate || r.rowDate || '').trim())),
      showNotes: rows.some((r) => Boolean((r.notes || '').trim())),
    };
  }, [rows, hideEmptyColumns]);

  const startManualEdit = (row: QuickExtractEvaluatedRow) => {
    setEditingRowId(row.id);
    setEditDraft({
      resolvedName: row.resolvedName,
      resolvedIndividuals:
        row.resolvedIndividuals !== null ? String(row.resolvedIndividuals) : '',
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

  return (
    <div className="space-y-4">
      {/* Draft Mode Top Toolbar */}
      <div
        className="flex flex-col gap-3 rounded-xl border p-3.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              مسودة السحب (Draft Mode)
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              لا يتم الحفظ نهائياً إلا بعد مراجعتك والضغط على زر التأكيد النهائي
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-40"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              title="تراجع"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-40"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              title="إعادة"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setCropModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Crop className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              قص منطقة أخرى
            </button>

            <button
              type="button"
              onClick={() => {
                setPresetPrompt(
                  'يا مساعد، قم بإخفاء الأعمدة الفارغة وأخبرني إن وجدت أسطر ناقصة.'
                );
                setCopilotOpenMobile(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Bot className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              طلب تعديل من المساعد
            </button>

            <button
              type="button"
              onClick={onFinalCommit}
              disabled={committing || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              style={{
                backgroundColor:
                  counts.doubtful > 0 ? 'var(--warning)' : 'var(--success)',
              }}
            >
              {committing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {commitLabel}
              {counts.doubtful > 0 ? ` (${counts.doubtful} سطر بحاجة لمراجعة)` : ''}
            </button>
          </div>
        </div>

        {/* Interactive Draft Filters & Column Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(
              [
                { id: 'all', label: `الكل (${counts.total})` },
                { id: 'doubtful', label: `شك <99% (${counts.doubtful})` },
                { id: 'blocked', label: `أفراد محجوبين/نزول (${counts.blocked})` },
                { id: 'verified', label: `مؤكد ≥99% (${counts.verified})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeFilterMode(tab.id)}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor:
                    filterMode === tab.id ? 'var(--accent)' : 'var(--bg-main)',
                  borderColor:
                    filterMode === tab.id ? 'var(--accent)' : 'var(--border-color)',
                  color: filterMode === tab.id ? '#fff' : 'var(--text-primary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleHideEmptyColumns(!hideEmptyColumns)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
              style={{
                backgroundColor: hideEmptyColumns
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Columns className="h-3.5 w-3.5" />
              {hideEmptyColumns ? 'إظهار كل الأعمدة' : 'إخفاء الأعمدة الفارغة'}
            </button>

            <button
              type="button"
              onClick={() => setCopilotOpenMobile((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs lg:hidden"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--accent)',
              }}
            >
              <Bot className="h-3.5 w-3.5" />
              الدردشة الحية
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Editable Zero-Trust Draft Table (2/3) + Live Copilot Side Chat (1/3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <div
            className="overflow-x-auto rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-surface)',
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
                  <th className="px-3 py-2.5 font-semibold">اسم المستفيد (قاعدة 99%)</th>
                  <th className="px-3 py-2.5 font-semibold">الأفراد</th>
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
                      colSpan={8}
                      className="px-4 py-8 text-center text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      لا توجد صفوف مطابقة للتصفية الحالية داخل المسودة.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const zt = rowSummaries.get(row.id) || computeRowZeroTrustSummary(row);
                    const isEditing = editingRowId === row.id;
                    const isHighlighted = highlightedRowIndex === row.rowIndex;

                    const issueParts: string[] = [];
                    if (zt.name.needsReview) {
                      issueParts.push(`الاسم مشكوك بنسبة ${zt.name.confidencePct}%`);
                    }
                    if (zt.numbers.needsReview) {
                      issueParts.push(`الأرقام مشكوكة بنسبة ${zt.numbers.confidencePct}%`);
                    }
                    if (zt.date.needsReview) {
                      issueParts.push(`التاريخ مشكوك بنسبة ${zt.date.confidencePct}%`);
                    }

                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          className="border-b transition-colors"
                          style={{
                            borderColor: 'var(--border-color)',
                            backgroundColor: isHighlighted
                              ? 'var(--bg-nav-active)'
                              : 'transparent',
                          }}
                        >
                          <td className="px-3 py-2.5 font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
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
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span
                                      className="font-mono text-[10px] tabular-nums"
                                      style={{ color: 'var(--text-muted)' }}
                                    >
                                      {zt.name.confidencePct}%
                                    </span>
                                    {zt.name.needsReview && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenTooltipKey((prev) =>
                                            prev === `${row.id}:name`
                                              ? null
                                              : `${row.id}:name`
                                          )
                                        }
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

                                {openTooltipKey === `${row.id}:name` && (
                                  <div
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
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Individuals Cell with 1% Doubt Rule */}
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
                                className="w-20 rounded-md border px-2 py-1 text-xs font-mono tabular-nums"
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
                                      onClick={() =>
                                        setOpenTooltipKey((prev) =>
                                          prev === `${row.id}:num`
                                            ? null
                                            : `${row.id}:num`
                                        )
                                      }
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
                                {openTooltipKey === `${row.id}:num` && (
                                  <div
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
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

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
                                <span>{row.resolvedDecreaseCount ?? 0}</span>
                              )}
                            </td>
                          )}

                          {/* Add/Delete */}
                          {columnVisibility.showAddDel && (
                            <td className="px-3 py-2.5 align-top">
                              {isEditing && editDraft ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={editDraft.resolvedAddOrDeleteAction}
                                    onChange={(e) =>
                                      setEditDraft({
                                        ...editDraft,
                                        resolvedAddOrDeleteAction: e.target.value as
                                          | 'إضافة'
                                          | 'حذف'
                                          | 'لا يوجد',
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
                                        resolvedAddOrDeleteCount: e.target.value,
                                      })
                                    }
                                    className="w-14 rounded-md border px-1.5 py-1 text-xs font-mono tabular-nums"
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
                                  <span>{row.resolvedRowDate || row.rowDate || '—'}</span>
                                  {zt.date.needsReview && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenTooltipKey((prev) =>
                                          prev === `${row.id}:date`
                                            ? null
                                            : `${row.id}:date`
                                        )
                                      }
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
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white"
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
                                  className="rounded-md border px-2 py-1 text-[11px]"
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
                                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium"
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
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white"
                                    style={{ backgroundColor: 'var(--success)' }}
                                  >
                                    <Check className="h-3 w-3" />
                                    تأكيد
                                  </button>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{ color: 'var(--success)' }}
                                  >
                                    <Check className="h-3 w-3" /> موثق
                                  </span>
                                )}

                                {(sourceImageUrl || sourcePdfUrl) && (
                                  <button
                                    type="button"
                                    onClick={() => setZoomRow(row)}
                                    className="rounded-md border p-1"
                                    style={{ borderColor: 'var(--border-color)' }}
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

                        {/* Contextual Full-Row Snippet attached directly beneath any <99% doubted row */}
                        {zt.anyDoubt && (
                          <tr
                            className="border-b"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            <td colSpan={8} className="px-3 py-2">
                              <ContextualRowSnippet
                                row={row}
                                issueSummary={
                                  issueParts.join('، ') ||
                                  row.modelDoubtReason ||
                                  'درجة الثقة أقل من 99%'
                                }
                                sourceImageUrl={sourceImageUrl}
                                sourcePdfUrl={sourcePdfUrl}
                                onOpenZoom={setZoomRow}
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
        </div>

        {/* Live Assistant Copilot Side Panel */}
        <div
          className={`${
            copilotOpenMobile ? 'block' : 'hidden'
          } lg:col-span-4 lg:block`}
        >
          <LiveDraftCopilot
            draftRows={rows}
            inferredMetadata={inferredMetadata}
            documentSummary={documentSummary}
            sourceImageUrl={sourceImageUrl}
            presetPrompt={presetPrompt}
            onClearPresetPrompt={() => setPresetPrompt(null)}
            onApplyOperations={onApplyCopilotOperations}
            onCloseMobile={() => setCopilotOpenMobile(false)}
          />
        </div>
      </div>

      {/* Zoom & Original Source Viewer Modal */}
      <RowZoomViewerModal
        row={zoomRow}
        sourceImageUrl={sourceImageUrl}
        sourcePdfUrl={sourcePdfUrl}
        onClose={() => setZoomRow(null)}
      />

      {/* Interactive Custom Region Crop Modal ("قص منطقة أخرى") */}
      {cropModalOpen && (
        <CustomRegionCropModal
          sourceImageUrl={sourceImageUrl}
          onClose={() => setCropModalOpen(false)}
          onSubmitCrop={async (dataUrl, box) => {
            await onAnalyzeCroppedRegion(dataUrl, box);
            setCropModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

interface CustomRegionCropModalProps {
  sourceImageUrl?: string;
  onClose: () => void;
  onSubmitCrop: (croppedDataUrl: string, box?: NormalizedBox) => Promise<void>;
}

const CustomRegionCropModal: React.FC<CustomRegionCropModalProps> = ({
  sourceImageUrl,
  onClose,
  onSubmitCrop,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [rect, setRect] = useState<{
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  } | null>(null);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeImgUrl = uploadedDataUrl || sourceImageUrl;

  const getRelPct = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1000, Math.round(((clientX - bounds.left) / bounds.width) * 1000))
    );
    const y = Math.max(
      0,
      Math.min(1000, Math.round(((clientY - bounds.top) / bounds.height) * 1000))
    );
    return { x, y };
  };

  const handleExtractSelection = async () => {
    if (!activeImgUrl) return;
    setSubmitting(true);
    setErr(null);
    try {
      const targetBox: NormalizedBox =
        rect && rect.xmax - rect.xmin >= 20 && rect.ymax - rect.ymin >= 15
          ? rect
          : { xmin: 0, ymin: 0, xmax: 1000, ymax: 1000 };

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('تعذر تحميل الصورة للقص.'));
        img.src = activeImgUrl;
      });

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const sx = Math.round((targetBox.xmin / 1000) * w);
      const sy = Math.round((targetBox.ymin / 1000) * h);
      const sw = Math.max(24, Math.round(((targetBox.xmax - targetBox.xmin) / 1000) * w));
      const sh = Math.max(24, Math.round(((targetBox.ymax - targetBox.ymin) / 1000) * h));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('تعذر تهيئة أداة القص.');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.94);

      await onSubmitCrop(croppedDataUrl, targetBox);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'فشل سحب المنطقة المقصوصة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Crop className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              قص منطقة أخرى وإضافتها لمسودة السحب
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ارسم مستطيلاً بالسحب فوق المعلومة أو السطر الناقص ليقوم المحرك بسحبه وإضافته للمسودة فوراً.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-1.5"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3" style={{ backgroundColor: 'var(--bg-main)' }}>
          {!activeImgUrl ? (
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Upload className="h-6 w-6" style={{ color: 'var(--accent)' }} />
              <span className="font-semibold">
                المصدر الحالي لا يحتوي على صورة مسطحة — ارفع لقطة أو صورة للجزء المراد قصه
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      setUploadedDataUrl(reader.result);
                    }
                  };
                  reader.readAsDataURL(f);
                }}
              />
            </label>
          ) : (
            <div
              ref={containerRef}
              onPointerDown={(e) => {
                const pt = getRelPct(e.clientX, e.clientY);
                setDragStart(pt);
                setRect({ xmin: pt.x, ymin: pt.y, xmax: pt.x, ymax: pt.y });
              }}
              onPointerMove={(e) => {
                if (!dragStart) return;
                const pt = getRelPct(e.clientX, e.clientY);
                setRect({
                  xmin: Math.min(dragStart.x, pt.x),
                  ymin: Math.min(dragStart.y, pt.y),
                  xmax: Math.max(dragStart.x, pt.x),
                  ymax: Math.max(dragStart.y, pt.y),
                });
              }}
              onPointerUp={() => setDragStart(null)}
              className="relative mx-auto w-fit cursor-crosshair select-none overflow-hidden rounded-xl border bg-white"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <img
                src={activeImgUrl}
                alt="تحديد منطقة للقص والاستخراج"
                className="block max-h-[58vh] w-auto select-none pointer-events-none"
                draggable={false}
              />
              {rect && rect.xmax > rect.xmin && rect.ymax > rect.ymin && (
                <div
                  className="pointer-events-none absolute border-2"
                  style={{
                    left: `${rect.xmin / 10}%`,
                    top: `${rect.ymin / 10}%`,
                    width: `${(rect.xmax - rect.xmin) / 10}%`,
                    height: `${(rect.ymax - rect.ymin) / 10}%`,
                    borderColor: 'var(--accent)',
                    backgroundColor: 'rgba(13, 148, 136, 0.18)',
                  }}
                />
              )}
            </div>
          )}

          {err && (
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--danger-bg)',
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
              }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t px-4 py-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {rect && rect.xmax - rect.xmin >= 20
              ? 'تم تحديد المنطقة بنجاح — جاهزة للاستخراج الفوري'
              : 'اسحب بالمؤشر فوق المنطقة المراد استخراجها'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--border-color)' }}
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={!activeImgUrl || submitting}
              onClick={() => void handleExtractSelection()}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crop className="h-3.5 w-3.5" />
              )}
              سحب المنطقة وإضافتها للمسودة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
