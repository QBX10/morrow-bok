import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  FileText,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { NormalizedBox, QuickExtractEvaluatedRow } from '../../types/agency';
import { getFullRowCropBox } from '../../utils/zeroTrustExtract';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';

function useCroppedRowDataUrl(
  imageUrl?: string,
  box?: NormalizedBox | null
): string | null {
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl || !box || box.ymax <= box.ymin || box.xmax <= box.xmin) {
      setCroppedUrl(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return;

      const sx = Math.max(0, Math.round((box.xmin / 1000) * w));
      const sy = Math.max(0, Math.round((box.ymin / 1000) * h));
      const ex = Math.min(w, Math.round((box.xmax / 1000) * w));
      const ey = Math.min(h, Math.round((box.ymax / 1000) * h));
      const sw = Math.max(48, ex - sx);
      const sh = Math.max(22, ey - sy);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      try {
        setCroppedUrl(canvas.toDataURL('image/jpeg', 0.94));
      } catch {
        setCroppedUrl(null);
      }
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl, box]);

  return croppedUrl;
}

interface ContextualRowSnippetProps {
  row: QuickExtractEvaluatedRow;
  issueSummary: string;
  sourceImageUrl?: string;
  sourcePdfUrl?: string;
  onOpenZoom: (row: QuickExtractEvaluatedRow) => void;
}

export const ContextualRowSnippet: React.FC<ContextualRowSnippetProps> = ({
  row,
  issueSummary,
  sourceImageUrl,
  sourcePdfUrl,
  onOpenZoom,
}) => {
  const fullBox = getFullRowCropBox(row);
  const croppedUrl = useCroppedRowDataUrl(sourceImageUrl, fullBox);

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-2.5 text-xs"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--warning)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--warning)' }} />
          <span>
            المشكلة في السطر {row.rowIndex} ({issueSummary}). إليك صورة السطر كاملاً لتتأكد بعينك:
          </span>
        </div>

        {(croppedUrl || sourceImageUrl || sourcePdfUrl) && (
          <button
            type="button"
            onClick={() => onOpenZoom(row)}
            className="nexus-pill-btn inline-flex items-center gap-1 border px-2.5 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            <Maximize2 className="h-3 w-3" />
            تكبير / فتح الأصل
          </button>
        )}
      </div>

      {croppedUrl ? (
        <button
          type="button"
          onClick={() => onOpenZoom(row)}
          className="group relative overflow-hidden rounded-md border text-right"
          style={{ borderColor: 'var(--border-color)' }}
          title="اضغط للتكبير أو عرض الصورة الأصلية عند هذه النقطة"
        >
          <img
            src={croppedUrl}
            alt={`قص السطر الكامل رقم ${row.rowIndex}`}
            className="max-h-24 w-full object-contain bg-white"
          />
          <span
            className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium opacity-90"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.78)',
              color: '#fff',
            }}
          >
            <ZoomIn className="h-3 w-3" /> اضغط للتكبير
          </span>
        </button>
      ) : (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono">{row.rawSnippet || 'لا يتوفر نص خام إضافي لهذا السطر'}</span>
          </span>
          {sourcePdfUrl && (
            <button
              type="button"
              onClick={() => onOpenZoom(row)}
              className="font-medium underline"
              style={{ color: 'var(--accent)' }}
            >
              معاينة المستند الأصلي
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface RowZoomViewerModalProps {
  row: QuickExtractEvaluatedRow | null;
  sourceImageUrl?: string;
  sourcePdfUrl?: string;
  onClose: () => void;
}

export const RowZoomViewerModal: React.FC<RowZoomViewerModalProps> = ({
  row,
  sourceImageUrl,
  sourcePdfUrl,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1.5);
  const [viewMode, setViewMode] = useState<'row_crop' | 'full_source'>('row_crop');
  const fullBox = row ? getFullRowCropBox(row) : null;
  const croppedUrl = useCroppedRowDataUrl(sourceImageUrl, fullBox);

  useEffect(() => {
    if (row) {
      setZoom(1.5);
      setViewMode(croppedUrl ? 'row_crop' : 'full_source');
    }
  }, [row, croppedUrl]);

  if (!row) return null;

  return (
    <FullScreenPushPage
      open={Boolean(row)}
      onBack={onClose}
      title={`التحقق البصري للسطر #${row.rowIndex} — ${row.resolvedName || 'اسم غير واضح'}`}
      subtitle={`النص المقروء: ${row.rawSnippet || 'غير متوفر'}`}
      icon={<Eye className="h-4 w-4" />}
      maxWidthClass="max-w-5xl"
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {sourceImageUrl && (
            <div
              className="inline-flex rounded-full border p-0.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('row_crop')}
                className="nexus-pill-btn px-3 py-1 text-xs font-bold"
                style={{
                  backgroundColor:
                    viewMode === 'row_crop' ? 'var(--accent)' : 'transparent',
                  color:
                    viewMode === 'row_crop'
                      ? 'var(--accent-fg)'
                      : 'var(--text-primary)',
                }}
              >
                قص السطر
              </button>
              <button
                type="button"
                onClick={() => setViewMode('full_source')}
                className="nexus-pill-btn inline-flex items-center gap-1 px-3 py-1 text-xs font-bold"
                style={{
                  backgroundColor:
                    viewMode === 'full_source' ? 'var(--accent)' : 'transparent',
                  color:
                    viewMode === 'full_source'
                      ? 'var(--accent-fg)'
                      : 'var(--text-primary)',
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                الأصل
              </button>
            </div>
          )}

          <div
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
              aria-label="تصغير"
              className="p-0.5 hover:opacity-75"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-10 text-center font-mono tabular-nums font-bold">
              {zoom}x
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.5).toFixed(1))))}
              aria-label="تكبير"
              className="p-0.5 hover:opacity-75"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      }
    >
      <div className="nexus-squircle p-4">
        {viewMode === 'row_crop' && croppedUrl ? (
          <div
            className="flex min-h-48 items-center justify-center overflow-auto rounded-2xl border bg-white p-3"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <img
              src={croppedUrl}
              alt={`السطر الكامل ${row.rowIndex}`}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease',
              }}
              className="max-w-full object-contain"
            />
          </div>
        ) : sourceImageUrl ? (
          <div
            className="relative mx-auto w-fit overflow-auto rounded-2xl border bg-white p-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="relative"
              style={{
                width: `${Math.round(zoom * 100)}%`,
                minWidth: '100%',
              }}
            >
              <img
                src={sourceImageUrl}
                alt="الصورة الأصلية للمستند"
                className="block w-full"
              />
              {fullBox && (
                <div
                  className="pointer-events-none absolute border-2"
                  style={{
                    top: `${fullBox.ymin / 10}%`,
                    left: `${fullBox.xmin / 10}%`,
                    height: `${Math.max(2, (fullBox.ymax - fullBox.ymin) / 10)}%`,
                    width: `${Math.max(10, (fullBox.xmax - fullBox.xmin) / 10)}%`,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.16)',
                  }}
                />
              )}
            </div>
          </div>
        ) : sourcePdfUrl ? (
          <iframe
            src={`${sourcePdfUrl}#page=${row.pageNumber || 1}`}
            title={`معاينة صفحة ${row.pageNumber || 1}`}
            className="h-[72vh] w-full rounded-2xl border bg-white"
            style={{ borderColor: 'var(--border-color)' }}
          />
        ) : (
          <div
            className="rounded-2xl border p-6 text-center text-sm"
            style={{ borderColor: 'var(--border-color)' }}
          >
            لا تتوفر صورة أصلية لهذا السطر. النص المستخرج:{' '}
            <span className="font-mono">{row.rawSnippet}</span>
          </div>
        )}
      </div>
    </FullScreenPushPage>
  );
};
