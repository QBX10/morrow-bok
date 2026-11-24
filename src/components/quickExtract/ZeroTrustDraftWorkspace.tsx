import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Columns,
  Crop,
  Eye,
  EyeOff,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  ShieldCheck,
  Sparkles,
  Undo2,
  Upload,
} from 'lucide-react';
import type {
  InferredDocumentMetadata,
  NormalizedBox,
  QuickExtractEvaluatedRow,
} from '../../types/agency';
import type { AiTaskRoutingMap } from '../../types/assistant';
import { computeRowZeroTrustSummary } from '../../utils/zeroTrustExtract';
import { RowZoomViewerModal } from './ContextualRowSnippetModal';
import { type CopilotOperation } from './LiveDraftCopilot';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import {
  SmartExtractionLab,
  type SmartLabFilterMode,
} from './SmartExtractionLab';

export type DraftFilterMode = SmartLabFilterMode;

interface ZeroTrustDraftWorkspaceProps {
  rows: QuickExtractEvaluatedRow[];
  inferredMetadata?: InferredDocumentMetadata | null;
  documentSummary: string;
  sourceImageUrl?: string;
  sourceImageUrls?: Record<number, string>;
  sourcePdfUrl?: string;
  filterMode: DraftFilterMode;
  onChangeFilterMode: (mode: DraftFilterMode) => void;
  hideEmptyColumns: boolean;
  onToggleHideEmptyColumns: (hide: boolean) => void;
  highlightedRowIndex: number | null;
  labOpen?: boolean;
  onToggleLabOpen?: () => void;
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
  onApplyVisibleSelection?: (visibleRowIds: string[]) => void;
  onFinalCommit: () => void;
  committing?: boolean;
  commitLabel?: string;
  taskRouting?: AiTaskRoutingMap;
}

export const ZeroTrustDraftWorkspace: React.FC<ZeroTrustDraftWorkspaceProps> = ({
  rows,
  inferredMetadata,
  documentSummary,
  sourceImageUrl,
  sourceImageUrls,
  sourcePdfUrl,
  filterMode,
  onChangeFilterMode,
  hideEmptyColumns,
  onToggleHideEmptyColumns,
  highlightedRowIndex,
  labOpen: controlledLabOpen,
  onToggleLabOpen,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpdateRow,
  onDeleteRow,
  onApplyCopilotOperations,
  onAnalyzeCroppedRegion,
  onApplyVisibleSelection,
  onFinalCommit,
  committing,
  commitLabel = 'تأكيد نهائي وحفظ في الجدول الأساسي',
  taskRouting,
}) => {
  const [presetPrompt, setPresetPrompt] = useState<string | null>(null);
  const [internalLabOpen, setInternalLabOpen] = useState(true);
  const [zoomRow, setZoomRow] = useState<QuickExtractEvaluatedRow | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const copilotSectionRef = useRef<HTMLDivElement | null>(null);
  const labOpen = controlledLabOpen ?? internalLabOpen;
  const handleToggleLabOpen = () => {
    if (onToggleLabOpen) {
      onToggleLabOpen();
    } else {
      setInternalLabOpen((v) => !v);
    }
  };

  // Compute 1% doubt + automatic math summary across all draft rows
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
    let largeFamilies = 0;
    let verified = 0;
    let mathConflicts = 0;
    for (const r of rows) {
      const summary = rowSummaries.get(r.id);
      if (summary?.anyDoubt) doubtful += 1;
      else verified += 1;
      if (summary?.hasMathConflict) mathConflicts += 1;
      if ((r.resolvedDecreaseCount ?? 0) > 0) blocked += 1;
      if ((r.resolvedIndividuals ?? 0) >= 5) largeFamilies += 1;
    }
    return {
      total: rows.length,
      doubtful,
      blocked,
      largeFamilies,
      verified,
      mathConflicts,
    };
  }, [rows, rowSummaries]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      const summary = rowSummaries.get(r.id);
      if (filterMode === 'doubtful') return Boolean(summary?.anyDoubt);
      if (filterMode === 'verified') return !summary?.anyDoubt;
      if (filterMode === 'blocked') return (r.resolvedDecreaseCount ?? 0) > 0;
      if (filterMode === 'large_families') return (r.resolvedIndividuals ?? 0) >= 5;
      return true;
    });
  }, [rows, rowSummaries, filterMode]);

  return (
    <div className="space-y-4">
      {/* Smart Lab Glassmorphic Control Bar */}
      <div
        className="flex flex-col gap-3 rounded-2xl border p-4 backdrop-blur-md transition-all duration-200"
        style={{
          backgroundColor:
            'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor:
                  'color-mix(in srgb, var(--accent) 35%, var(--border-color))',
                color: 'var(--accent)',
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              مختبر السحب الذكي — وضع المسودة (Draft Mode)
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              لا يتم الترحيل النهائي إلا بعد مراجعتك وتأكيدك الصريح
            </span>
            {counts.mathConflicts > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  borderColor: 'var(--warning)',
                  color: 'var(--warning)',
                }}
              >
                <AlertTriangle className="h-3 w-3" />
                {counts.mathConflicts} تعارض رياضي بحاجة لمراجعة
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-opacity disabled:opacity-40"
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
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-opacity disabled:opacity-40"
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
              onClick={handleToggleLabOpen}
              aria-expanded={labOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              style={{
                backgroundColor: labOpen ? 'var(--bg-nav-active)' : 'var(--accent)',
                borderColor: 'var(--accent)',
                color: labOpen ? 'var(--accent)' : 'var(--accent-fg)',
              }}
            >
              {labOpen ? (
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

            <button
              type="button"
              onClick={() => setCropModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
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
                if (!labOpen) handleToggleLabOpen();
                setPresetPrompt(
                  'يا مساعد، قم بإخفاء الأعمدة الفارغة وأخبرني كم عدد الصفوف المشكوك فيها.'
                );
                window.setTimeout(() => {
                  copilotSectionRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                  });
                }, 80);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Bot className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              طلب من المساعد
            </button>

            <button
              type="button"
              onClick={onFinalCommit}
              disabled={committing || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold text-white whitespace-nowrap shrink-0 transition-opacity disabled:opacity-50"
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
              {counts.doubtful > 0 ? ` (${counts.doubtful} بحاجة لمراجعة)` : ''}
            </button>
          </div>
        </div>

        {/* Contextual Smart Filters & Column Visibility Strip */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(
              [
                { id: 'all', label: `اسحب الكل (${counts.total})` },
                {
                  id: 'blocked',
                  label: `اسحب الذين لديهم محجوبين فقط (${counts.blocked})`,
                },
                {
                  id: 'large_families',
                  label: `اسحب العائلات الكبيرة فقط ≥5 (${counts.largeFamilies})`,
                },
                {
                  id: 'doubtful',
                  label: `تعارض رياضي وشك <99% (${counts.doubtful})`,
                },
                { id: 'verified', label: `مؤكد ≥99% (${counts.verified})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeFilterMode(tab.id)}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    filterMode === tab.id ? 'var(--accent)' : 'var(--bg-main)',
                  borderColor:
                    filterMode === tab.id ? 'var(--accent)' : 'var(--border-color)',
                  color:
                    filterMode === tab.id ? 'var(--accent-fg)' : 'var(--text-primary)',
                }}
              >
                {tab.label}
              </button>
            ))}

            {filterMode !== 'all' &&
              visibleRows.length > 0 &&
              onApplyVisibleSelection && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyVisibleSelection(visibleRows.map((r) => r.id))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>اعتماد المفلترة للترحيل ({visibleRows.length})</span>
                </button>
              )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleHideEmptyColumns(!hideEmptyColumns)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: hideEmptyColumns
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
                borderColor: hideEmptyColumns
                  ? 'var(--accent)'
                  : 'var(--border-color)',
                color: hideEmptyColumns ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              <Columns className="h-3.5 w-3.5" />
              {hideEmptyColumns ? 'إظهار كل الأعمدة' : 'إخفاء الأعمدة الفارغة'}
            </button>
          </div>
        </div>
      </div>

      {/* Flex Split-Screen Smart Extraction Lab (Viewer Right + Interactive Table & Copilot Left) */}
      <SmartExtractionLab
        rows={rows}
        inferredMetadata={inferredMetadata}
        documentSummary={documentSummary}
        sourceImageUrl={sourceImageUrl}
        sourceImageUrls={sourceImageUrls}
        sourcePdfUrl={sourcePdfUrl}
        filterMode={filterMode}
        hideEmptyColumns={hideEmptyColumns}
        highlightedRowIndex={highlightedRowIndex}
        isOpen={labOpen}
        onToggleOpen={handleToggleLabOpen}
        showToggleHeader={false}
        onUpdateRow={onUpdateRow}
        onDeleteRow={onDeleteRow}
        onApplyCopilotOperations={onApplyCopilotOperations}
        onAnalyzeCroppedRegion={onAnalyzeCroppedRegion}
        onSelectZoomRow={setZoomRow}
        presetPrompt={presetPrompt}
        onClearPresetPrompt={() => setPresetPrompt(null)}
        copilotSectionRef={copilotSectionRef}
        taskRouting={taskRouting}
      />

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
    <FullScreenPushPage
      open
      onBack={onClose}
      title="قص منطقة أخرى وإضافتها لمسودة السحب"
      subtitle="ارسم مستطيلاً بالسحب فوق المعلومة أو السطر الناقص ليقوم المحرك بسحبه وإضافته للمسودة فوراً"
      icon={<Crop className="h-4 w-4" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {rect && rect.xmax - rect.xmin >= 20
              ? 'تم تحديد المنطقة بنجاح — جاهزة للاستخراج الفوري'
              : 'اسحب بالمؤشر فوق المنطقة المراد استخراجها'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="nexus-pill-btn border px-3.5 py-1.5 text-xs font-bold"
              style={{ borderColor: 'var(--border-color)' }}
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={!activeImgUrl || submitting}
              onClick={() => void handleExtractSelection()}
              className="nexus-pill-btn inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-extrabold disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
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
      }
    >
      <div className="nexus-squircle p-4 sm:p-5 space-y-3">
        {!activeImgUrl ? (
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
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
            className="relative mx-auto w-fit cursor-crosshair select-none overflow-hidden rounded-2xl border bg-white"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <img
              src={activeImgUrl}
              alt="تحديد منطقة للقص والاستخراج"
              className="block max-h-[65vh] w-auto select-none pointer-events-none"
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
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
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
    </FullScreenPushPage>
  );
};
