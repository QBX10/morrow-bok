import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crop,
  Crosshair,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  NormalizedBox,
  QuickExtractEvaluatedRow,
} from '../../types/agency';
import {
  computeRowZeroTrustSummary,
  getFullRowCropBox,
} from '../../utils/zeroTrustExtract';

interface SmartSourceViewerProps {
  rows: QuickExtractEvaluatedRow[];
  sourceImageUrl?: string;
  sourceImageUrls?: Record<number, string>;
  sourcePdfUrl?: string;
  hoveredRowId: string | null;
  selectedRowId: string | null;
  onHoverRow: (rowId: string | null) => void;
  onSelectRow: (row: QuickExtractEvaluatedRow) => void;
  onExtractCroppedRegion?: (
    croppedDataUrl: string,
    box?: NormalizedBox
  ) => Promise<void>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SmartSourceViewer: React.FC<SmartSourceViewerProps> = ({
  rows,
  sourceImageUrl,
  sourceImageUrls,
  sourcePdfUrl,
  hoveredRowId,
  selectedRowId,
  onHoverRow,
  onSelectRow,
  onExtractCroppedRegion,
  collapsed = false,
  onToggleCollapse,
}) => {
  const pageKeys = useMemo(() => {
    const keys = new Set<number>();
    if (sourceImageUrls) {
      for (const k of Object.keys(sourceImageUrls)) {
        const n = Number(k);
        if (Number.isFinite(n) && sourceImageUrls[n]) keys.add(n);
      }
    }
    if (keys.size === 0 && sourceImageUrl) keys.add(1);
    return Array.from(keys).sort((a, b) => a - b);
  }, [sourceImageUrl, sourceImageUrls]);

  const [activePage, setActivePage] = useState<number>(pageKeys[0] || 1);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [cropActive, setCropActive] = useState(false);
  const [cropDragStart, setCropDragStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [cropRect, setCropRect] = useState<NormalizedBox | null>(null);
  const [extractingCrop, setExtractingCrop] = useState(false);

  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const boxRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (pageKeys.length > 0 && !pageKeys.includes(activePage)) {
      setActivePage(pageKeys[0]);
    }
  }, [pageKeys, activePage]);

  const activeImage =
    (sourceImageUrls && sourceImageUrls[activePage]) || sourceImageUrl;

  const activeRowId = hoveredRowId || selectedRowId;

  // Automatically scroll/center highlighted bounding box when active row changes
  useEffect(() => {
    if (!autoFollow || !activeRowId) return;
    const targetRow = rows.find((r) => r.id === activeRowId);
    if (!targetRow) return;

    if (
      targetRow.pageNumber &&
      pageKeys.includes(targetRow.pageNumber) &&
      targetRow.pageNumber !== activePage
    ) {
      setActivePage(targetRow.pageNumber);
    }

    const el = boxRefs.current[activeRowId];
    if (el && viewportRef.current) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeRowId, autoFollow, rows, pageKeys, activePage]);

  const pageRowsWithBoxes = useMemo(() => {
    return rows
      .filter((r) => !r.pageNumber || r.pageNumber === activePage || pageKeys.length <= 1)
      .map((r) => ({
        row: r,
        box: getFullRowCropBox(r),
        summary: computeRowZeroTrustSummary(r),
      }))
      .filter((item): item is {
        row: QuickExtractEvaluatedRow;
        box: NormalizedBox;
        summary: ReturnType<typeof computeRowZeroTrustSummary>;
      } => item.box !== null);
  }, [rows, activePage, pageKeys.length]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getRelPoint = (clientX: number, clientY: number) => {
    const el = stageRef.current;
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

  const handleConfirmInlineCrop = async () => {
    if (!activeImage || !cropRect || !onExtractCroppedRegion) return;
    if (cropRect.xmax - cropRect.xmin < 15 || cropRect.ymax - cropRect.ymin < 10) {
      return;
    }
    setExtractingCrop(true);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('تعذر قراءة الصورة للقص.'));
        img.src = activeImage;
      });
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const sx = Math.round((cropRect.xmin / 1000) * w);
      const sy = Math.round((cropRect.ymin / 1000) * h);
      const sw = Math.max(24, Math.round(((cropRect.xmax - cropRect.xmin) / 1000) * w));
      const sh = Math.max(20, Math.round(((cropRect.ymax - cropRect.ymin) / 1000) * h));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
      await onExtractCroppedRegion(dataUrl, cropRect);
      setCropActive(false);
      setCropRect(null);
    } finally {
      setExtractingCrop(false);
    }
  };

  if (collapsed) {
    return (
      <div
        className="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs backdrop-blur-md"
        style={{
          backgroundColor:
            'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-2 font-bold">
          <Eye className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>عارض المصدر الذكي (مطوي)</span>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>فتح العارض</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <aside
      aria-label="عارض المصدر الذكي المتزامن"
      className="flex flex-col overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-200"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Top Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5"
        style={{
          backgroundColor:
            'color-mix(in srgb, var(--bg-main) 78%, transparent)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor:
                'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
              color: 'var(--accent)',
            }}
          >
            {activeImage ? (
              <Eye className="h-3.5 w-3.5" />
            ) : sourcePdfUrl ? (
              <FileText className="h-3.5 w-3.5" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
          </span>
          <div>
            <div className="text-xs font-bold leading-tight">
              عارض الملف الذكي
            </div>
            <div
              className="text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              ربط بصري متزامن مع صفوف الجدول ({rows.length} صف)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {pageKeys.length > 1 && (
            <div
              className="inline-flex items-center rounded-lg border p-0.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              {pageKeys.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePage(p)}
                  className="rounded-md px-2 py-0.5 font-bold tabular-nums"
                  style={{
                    backgroundColor:
                      activePage === p ? 'var(--accent)' : 'transparent',
                    color:
                      activePage === p
                        ? 'var(--accent-fg)'
                        : 'var(--text-primary)',
                  }}
                >
                  ص {p}
                </button>
              ))}
            </div>
          )}

          {activeImage && (
            <>
              <div
                className="inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))
                  }
                  className="rounded p-1 hover:opacity-75"
                  aria-label="تصغير العارض"
                  title="تصغير"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-10 text-center font-mono font-semibold tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))
                  }
                  className="rounded p-1 hover:opacity-75"
                  aria-label="تكبير العارض"
                  title="تكبير"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  className="rounded p-1 hover:opacity-75"
                  aria-label="إعادة التعيين"
                  title="إعادة ضبط التكبير والموضع"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAutoFollow((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium"
                style={{
                  backgroundColor: autoFollow
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-surface)',
                  borderColor: autoFollow
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                  color: autoFollow ? 'var(--accent)' : 'var(--text-muted)',
                }}
                title="تتبع السطر تلقائياً عند التمرير بالماوس"
              >
                <Crosshair className="h-3 w-3" />
                <span className="hidden sm:inline">تتبع</span>
              </button>

              {onExtractCroppedRegion && (
                <button
                  type="button"
                  onClick={() => {
                    setCropActive((v) => !v);
                    setCropRect(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-semibold"
                  style={{
                    backgroundColor: cropActive
                      ? 'var(--accent)'
                      : 'var(--bg-surface)',
                    borderColor: cropActive
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: cropActive
                      ? 'var(--accent-fg)'
                      : 'var(--text-primary)',
                  }}
                  title="تحديد منطقة مباشرة على الصورة لاستخراجها"
                >
                  <Crop className="h-3 w-3" />
                  <span>{cropActive ? 'إلغاء القص' : 'قص مباشر'}</span>
                </button>
              )}
            </>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg border p-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
              title="طي العارض وتوسيع الجدول"
              aria-label="طي عارض الملف"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Crop Confirmation Bar */}
      {cropActive && activeImage && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2 text-[11px]"
          style={{
            backgroundColor: 'var(--bg-nav-active)',
            borderColor: 'var(--border-color)',
          }}
        >
          <span className="font-semibold">
            اسحب بالمؤشر فوق السطر الناقص في الصورة لتحديده واستخراجه:
          </span>
          <button
            type="button"
            disabled={
              extractingCrop ||
              !cropRect ||
              cropRect.xmax - cropRect.xmin < 15
            }
            onClick={() => void handleConfirmInlineCrop()}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1 font-bold text-white disabled:opacity-45"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {extractingCrop ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            <span>سحب المربع المحدد</span>
          </button>
        </div>
      )}

      {/* Viewport Stage */}
      <div
        ref={viewportRef}
        className="relative max-h-[68vh] min-h-[380px] overflow-auto p-3"
        style={{ backgroundColor: 'var(--bg-main)' }}
      >
        {activeImage ? (
          <div
            className="flex min-h-full items-start justify-center"
            onPointerDown={(e) => {
              if (cropActive) return;
              if (zoom <= 1) return;
              setPanning(true);
              panStartRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                origX: pan.x,
                origY: pan.y,
              };
            }}
            onPointerMove={(e) => {
              if (!panning || !panStartRef.current || cropActive) return;
              setPan({
                x: panStartRef.current.origX + (e.clientX - panStartRef.current.clientX),
                y: panStartRef.current.origY + (e.clientY - panStartRef.current.clientY),
              });
            }}
            onPointerUp={() => {
              setPanning(false);
              panStartRef.current = null;
            }}
          >
            <div
              ref={stageRef}
              onPointerDown={(e) => {
                if (!cropActive) return;
                e.stopPropagation();
                const pt = getRelPoint(e.clientX, e.clientY);
                setCropDragStart(pt);
                setCropRect({ xmin: pt.x, ymin: pt.y, xmax: pt.x, ymax: pt.y });
              }}
              onPointerMove={(e) => {
                if (!cropActive || !cropDragStart) return;
                e.stopPropagation();
                const pt = getRelPoint(e.clientX, e.clientY);
                setCropRect({
                  xmin: Math.min(cropDragStart.x, pt.x),
                  ymin: Math.min(cropDragStart.y, pt.y),
                  xmax: Math.max(cropDragStart.x, pt.x),
                  ymax: Math.max(cropDragStart.y, pt.y),
                });
              }}
              onPointerUp={() => {
                if (cropActive) setCropDragStart(null);
              }}
              className={`relative inline-block origin-top-center overflow-hidden rounded-xl border bg-white shadow-sm ${
                cropActive
                  ? 'cursor-crosshair select-none'
                  : zoom > 1
                    ? 'cursor-grab'
                    : ''
              }`}
              style={{
                borderColor: 'var(--border-color)',
                width: `${Math.round(zoom * 100)}%`,
                transform:
                  pan.x !== 0 || pan.y !== 0
                    ? `translate3d(${pan.x}px, ${pan.y}px, 0)`
                    : undefined,
                transition: panning ? 'none' : 'transform 140ms ease-out',
              }}
            >
              <img
                src={activeImage}
                alt="المستند الأصلي"
                className="block w-full select-none pointer-events-none"
                draggable={false}
              />

              {/* Synchronized Row Bounding Boxes */}
              {!cropActive &&
                pageRowsWithBoxes.map(({ row, box, summary }) => {
                  const isActive = activeRowId === row.id;
                  const strokeColor = isActive
                    ? 'var(--accent)'
                    : summary.worstStatus === 'red'
                      ? 'var(--danger)'
                      : summary.worstStatus === 'yellow'
                        ? 'var(--warning)'
                        : 'rgba(13, 148, 136, 0.35)';
                  const fillColor = isActive
                    ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
                    : summary.worstStatus === 'red'
                      ? 'rgba(220, 38, 38, 0.10)'
                      : summary.worstStatus === 'yellow'
                        ? 'rgba(217, 119, 6, 0.12)'
                        : 'transparent';

                  return (
                    <button
                      key={row.id}
                      ref={(el) => {
                        boxRefs.current[row.id] = el;
                      }}
                      type="button"
                      onMouseEnter={() => onHoverRow(row.id)}
                      onMouseLeave={() => onHoverRow(null)}
                      onClick={() => onSelectRow(row)}
                      className="absolute transition-all duration-150 focus:outline-none"
                      style={{
                        top: `${box.ymin / 10}%`,
                        left: `${box.xmin / 10}%`,
                        height: `${Math.max(1.8, (box.ymax - box.ymin) / 10)}%`,
                        width: `${Math.max(6, (box.xmax - box.xmin) / 10)}%`,
                        border: `${isActive ? '2px' : '1px'} solid ${strokeColor}`,
                        backgroundColor: fillColor,
                        boxShadow: isActive
                          ? '0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)'
                          : undefined,
                        zIndex: isActive ? 20 : 5,
                      }}
                      title={`سطر #${row.rowIndex}: ${row.resolvedName || '—'}`}
                      aria-label={`تمييز السطر ${row.rowIndex} في المصدر`}
                    >
                      <span
                        className="pointer-events-none absolute -top-4 right-0 rounded px-1 py-0.2 text-[9px] font-bold text-white tabular-nums transition-opacity"
                        style={{
                          backgroundColor: isActive
                            ? 'var(--accent)'
                            : summary.worstStatus === 'red'
                              ? 'var(--danger)'
                              : summary.worstStatus === 'yellow'
                                ? 'var(--warning)'
                                : 'rgba(15, 23, 42, 0.65)',
                          opacity: isActive || summary.anyDoubt ? 1 : 0,
                        }}
                      >
                        #{row.rowIndex}
                      </span>
                    </button>
                  );
                })}

              {/* Manual Inline Crop Box */}
              {cropActive &&
                cropRect &&
                cropRect.xmax > cropRect.xmin &&
                cropRect.ymax > cropRect.ymin && (
                  <div
                    className="pointer-events-none absolute border-2"
                    style={{
                      left: `${cropRect.xmin / 10}%`,
                      top: `${cropRect.ymin / 10}%`,
                      width: `${(cropRect.xmax - cropRect.xmin) / 10}%`,
                      height: `${(cropRect.ymax - cropRect.ymin) / 10}%`,
                      borderColor: 'var(--accent)',
                      backgroundColor:
                        'color-mix(in srgb, var(--accent) 18%, transparent)',
                      zIndex: 30,
                    }}
                  />
                )}
            </div>
          </div>
        ) : sourcePdfUrl ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>معاينة PDF التفاعلية:</span>
              {activeRowId && (
                <span className="font-bold" style={{ color: 'var(--accent)' }}>
                  السطر المحدد حالياً: #{rows.find((r) => r.id === activeRowId)?.rowIndex || 1} — صفحة{' '}
                  {rows.find((r) => r.id === activeRowId)?.pageNumber || 1}
                </span>
              )}
            </div>
            <iframe
              src={`${sourcePdfUrl}#page=${rows.find((r) => r.id === activeRowId)?.pageNumber || 1}`}
              title="معاينة مستند PDF الأصلي"
              className="h-[58vh] w-full rounded-xl border bg-white"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>
        ) : (
          /* Raw Structured Text / Spreadsheet Band Sync View */
          <div className="space-y-2">
            <div
              className="flex items-center justify-between text-[11px] font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>شريط الأسطر الأصلية المتزامن (Excel / CSV / Word / نص)</span>
              <span className="tabular-nums">{rows.length} سطر</span>
            </div>
            <div className="space-y-1.5">
              {rows.map((r) => {
                const isActive = activeRowId === r.id;
                const summary = computeRowZeroTrustSummary(r);
                return (
                  <button
                    key={r.id}
                    ref={(el) => {
                      boxRefs.current[r.id] = el;
                    }}
                    type="button"
                    onMouseEnter={() => onHoverRow(r.id)}
                    onMouseLeave={() => onHoverRow(null)}
                    onClick={() => onSelectRow(r)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-right text-xs transition-all duration-150"
                    style={{
                      backgroundColor: isActive
                        ? 'var(--bg-nav-active)'
                        : summary.worstStatus === 'red'
                          ? 'var(--danger-bg)'
                          : summary.worstStatus === 'yellow'
                            ? 'var(--warning-bg)'
                            : 'var(--bg-surface)',
                      borderColor: isActive
                        ? 'var(--accent)'
                        : summary.worstStatus === 'yellow'
                          ? 'var(--warning)'
                          : summary.worstStatus === 'red'
                            ? 'var(--danger)'
                            : 'var(--border-color)',
                    }}
                  >
                    <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                      #{r.rowIndex}
                    </span>
                    <span className="flex-1 truncate font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>
                      {r.rawSnippet || `${r.resolvedName} | ${r.resolvedIndividuals ?? '—'}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t px-3.5 py-2 text-[10px]"
        style={{
          borderColor: 'var(--border-color)',
          color: 'var(--text-muted)',
        }}
      >
        <span className="inline-flex items-center gap-1">
          <Move className="h-3 w-3" />
          مرّر الماوس على أي صف في الجدول ليتم تظليله هنا والعكس
        </span>
        {pageRowsWithBoxes.length > 0 && (
          <span className="tabular-nums">
            {pageRowsWithBoxes.length} إشارة مكانية مرصودة
          </span>
        )}
      </div>
    </aside>
  );
};
