import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, Crop, Edit3, GitBranch } from 'lucide-react';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import type {
  NormalizedBox,
  QuickExtractEvaluatedRow,
  QuickExtractFocusField,
} from '../../types/agency';
import {
  ALL_QUICK_EXTRACT_FIELDS,
  analyzeArabicNameAgainstTree,
  type ArabicNameTree,
} from '../../utils/quickExtractEngine';

interface RedFlagDoubtSegmentProps {
  row: QuickExtractEvaluatedRow;
  nameTree: ArabicNameTree;
  sourceImageUrl?: string;
  focusedFields?: QuickExtractFocusField[];
  onUpdateRow: (
    rowId: string,
    patch: Partial<QuickExtractEvaluatedRow>,
    options?: { resetConfirmOnNameEdit?: boolean }
  ) => void;
}

const CroppedLedgerSnippet: React.FC<{
  imageUrl?: string;
  box?: NormalizedBox;
  altText: string;
}> = ({ imageUrl, box, altText }) => {
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
      const padX = Math.round(w * 0.03);
      const padY = Math.round(h * 0.015);
      const sx = Math.max(0, Math.round((box.xmin / 1000) * w) - padX);
      const sy = Math.max(0, Math.round((box.ymin / 1000) * h) - padY);
      const ex = Math.min(w, Math.round((box.xmax / 1000) * w) + padX);
      const ey = Math.min(h, Math.round((box.ymax / 1000) * h) + padY);
      const sw = Math.max(24, ex - sx);
      const sh = Math.max(18, ey - sy);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      try {
        setCroppedUrl(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        setCroppedUrl(null);
      }
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, box]);

  if (!croppedUrl) return null;

  return (
    <div
      className="flex flex-col gap-1 rounded-lg border p-2"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div
        className="flex items-center gap-1 text-[10px] font-bold"
        style={{ color: 'var(--text-muted)' }}
      >
        <Crop className="h-3 w-3" />
        <span>مقتطف الصورة الأصلي للتحقق:</span>
      </div>
      <img
        src={croppedUrl}
        alt={altText}
        className="max-h-24 w-auto max-w-full rounded border object-contain"
        style={{ borderColor: 'var(--border-color)' }}
      />
    </div>
  );
};

export const RedFlagDoubtSegment: React.FC<RedFlagDoubtSegmentProps> = ({
  row,
  nameTree,
  sourceImageUrl,
  focusedFields = ALL_QUICK_EXTRACT_FIELDS,
  onUpdateRow,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [editingActive, setEditingActive] = useState(false);

  const focusSet = new Set(
    focusedFields.length > 0 ? focusedFields : ALL_QUICK_EXTRACT_FIELDS
  );

  const treeAnalysis = useMemo(
    () =>
      analyzeArabicNameAgainstTree({
        name: row.resolvedName,
        tree: nameTree,
        suspectSpans: row.suspectSpans,
        nameConfidence: row.nameConfidence,
        modelDoubtFlag: row.modelDoubtFlag,
        modelDoubtReason: row.modelDoubtReason,
      }),
    [
      row.resolvedName,
      nameTree,
      row.suspectSpans,
      row.nameConfidence,
      row.modelDoubtFlag,
      row.modelDoubtReason,
    ]
  );

  const activeSegments =
    row.suspectSegments.length > 0
      ? row.suspectSegments
      : treeAnalysis.suspectSegments;

  const words = useMemo(
    () => row.resolvedName.trim().split(/\s+/).filter(Boolean),
    [row.resolvedName]
  );

  const suspectByWordIndex = useMemo(
    () => new Map(activeSegments.map((s) => [s.wordIndex, s])),
    [activeSegments]
  );

  const allReadyForConfirm =
    row.isComplete &&
    (!focusSet.has('name') || row.resolvedName.trim().length >= 3);

  return (
    <div
      className="space-y-3 rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--danger)',
      }}
    >
      {/* Top Meta Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle
            className="h-4 w-4 shrink-0"
            style={{ color: 'var(--danger)' }}
          />
          <span>
            صف {row.rowIndex} (صفحة {row.pageNumber}) · ثقة الاسم:{' '}
            <span style={{ color: 'var(--danger)' }} className="tabular-nums">
              {Math.round(row.nameConfidence * 100)}%
            </span>
          </span>
        </div>

        {/* Immediate Correct / Edit Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <motion.button
            type="button"
            disabled={!allReadyForConfirm}
            whileHover={reducedMotion || !allReadyForConfirm ? undefined : { scale: 1.03 }}
            whileTap={reducedMotion || !allReadyForConfirm ? undefined : { scale: 0.95 }}
            transition={TABRIX_TACTILE_SPRING}
            onClick={() =>
              onUpdateRow(row.id, {
                doubtConfirmed: true,
                mathConfirmed: true,
              })
            }
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold disabled:opacity-40"
            style={{
              backgroundColor: 'var(--success)',
              color: 'var(--success-fg)',
            }}
          >
            <Check className="h-3.5 w-3.5" />
            <span>صحيح</span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={reducedMotion ? undefined : { scale: 1.03 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={TABRIX_TACTILE_SPRING}
            onClick={() => setEditingActive((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold"
            style={{
              backgroundColor: editingActive
                ? 'var(--bg-nav-active)'
                : 'var(--bg-surface)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>تعديل</span>
          </motion.button>
        </div>
      </div>

      {/* Red-Flag Decomposed Name + Cropped Visual Snippet Side by Side */}
      <div
        className="grid grid-cols-1 gap-3 rounded-lg border px-3 py-2.5 md:grid-cols-2"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div>
          <div
            className="mb-1 text-[11px] font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            تفكيك الاسم وكشف المقاطع المشكوك فيها (باللون الأحمر):
          </div>
          {words.length === 0 ? (
            <span
              className="text-sm font-bold"
              style={{ color: 'var(--danger)' }}
            >
              [اسم مفقود بالكامل — يرجى الإدخال يدويًا]
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-base font-bold leading-relaxed">
              {words.map((word, idx) => {
                const seg = suspectByWordIndex.get(idx);
                if (!seg) {
                  return <span key={idx}>{word}</span>;
                }
                return (
                  <span
                    key={idx}
                    title={seg.reason}
                    className="inline-flex flex-col rounded-md border px-2 py-0.5"
                    style={{
                      color: 'var(--danger)',
                      backgroundColor: 'var(--danger-bg)',
                      borderColor: 'var(--danger)',
                    }}
                  >
                    <span className="underline decoration-2 underline-offset-4">
                      {word}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
          {row.rawSnippet && (
            <div
              className="font-data mt-1.5 text-[11px]"
              style={{ color: 'var(--text-muted)' }}
            >
              النص الخام: {row.rawSnippet}
            </div>
          )}
        </div>

        <CroppedLedgerSnippet
          imageUrl={sourceImageUrl}
          box={row.suspectBox}
          altText={`مقتطف صورة للاسم ${row.resolvedName}`}
        />
      </div>

      {/* Doubt Reasons + Math Audit Alerts */}
      {(row.doubtReasons.length > 0 || row.mathIssues.length > 0) && (
        <ul
          className="list-disc space-y-1 pr-5 text-xs font-semibold"
          style={{ color: 'var(--danger)' }}
        >
          {row.doubtReasons.map((reason, i) => (
            <li key={`d-${i}`}>{reason}</li>
          ))}
          {row.mathIssues.map((issue, i) => (
            <li key={`m-${i}`}>تنبيه حسابي: {issue}</li>
          ))}
        </ul>
      )}

      {/* Name & Prefix Tree Suggestions (Explicit Click Only - Never Blind Auto-Commit) */}
      <AnimatePresence initial={false}>
        {focusSet.has('name') && treeAnalysis.suggestedNames.length > 0 && (
          <motion.div
            key="doubt-suggestions"
            variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <span
              className="inline-flex items-center gap-1 font-bold"
              style={{ color: 'var(--accent)' }}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>مطابقات مقترحة من شجرة الأسماء:</span>
            </span>
            {treeAnalysis.suggestedNames.map((cand) => (
              <motion.button
                key={cand}
                type="button"
                whileHover={reducedMotion ? undefined : { scale: 1.03 }}
                whileTap={reducedMotion ? undefined : { scale: 0.95 }}
                transition={TABRIX_TACTILE_SPRING}
                onClick={() =>
                  onUpdateRow(
                    row.id,
                    { resolvedName: cand },
                    { resetConfirmOnNameEdit: true }
                  )
                }
                className="rounded-lg border px-2.5 py-1 font-semibold hover:opacity-85"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                {cand}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focused Correction & Confirmation Inputs */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
        {focusSet.has('name') && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold">
              الاسم المصحّح
            </label>
            <input
              type="text"
              autoFocus={editingActive}
              value={row.resolvedName}
              onChange={(e) =>
                onUpdateRow(
                  row.id,
                  { resolvedName: e.target.value },
                  { resetConfirmOnNameEdit: false }
                )
              }
              placeholder="اكتب الاسم المؤكد..."
              className="w-full rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: row.missingFields.includes('name')
                  ? 'var(--danger)'
                  : editingActive
                  ? 'var(--accent)'
                  : 'var(--border-color)',
                color:
                  row.hasDoubt && !row.doubtConfirmed
                    ? 'var(--danger)'
                    : 'var(--text-primary)',
              }}
            />
          </div>
        )}

        {focusSet.has('individuals') && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold">
              الأفراد
            </label>
            <input
              type="number"
              min={0}
              value={row.resolvedIndividuals ?? ''}
              onChange={(e) =>
                onUpdateRow(row.id, {
                  resolvedIndividuals:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: row.missingFields.includes('individuals')
                  ? 'var(--danger)'
                  : 'var(--border-color)',
              }}
            />
          </div>
        )}

        {focusSet.has('decreaseCount') && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold">
              النزول / النقصان
            </label>
            <input
              type="number"
              min={0}
              value={row.resolvedDecreaseCount ?? ''}
              onChange={(e) =>
                onUpdateRow(row.id, {
                  resolvedDecreaseCount:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: row.missingFields.includes('decreaseCount')
                  ? 'var(--danger)'
                  : 'var(--border-color)',
              }}
            />
          </div>
        )}

        {focusSet.has('addOrDelete') && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold">
              الإضافة / الحذف
            </label>
            <div className="flex gap-1">
              <input
                type="number"
                min={0}
                value={row.resolvedAddOrDeleteCount ?? ''}
                onChange={(e) =>
                  onUpdateRow(row.id, {
                    resolvedAddOrDeleteCount:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border px-2 py-1.5 text-xs tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: row.missingFields.includes('addOrDeleteCount')
                    ? 'var(--danger)'
                    : 'var(--border-color)',
                }}
              />
              <select
                value={row.resolvedAddOrDeleteAction}
                onChange={(e) =>
                  onUpdateRow(row.id, {
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
        )}

        <div className="flex items-end">
          <motion.button
            type="button"
            disabled={!allReadyForConfirm}
            whileHover={reducedMotion || !allReadyForConfirm ? undefined : { y: -1, scale: 1.02 }}
            whileTap={reducedMotion || !allReadyForConfirm ? undefined : { scale: 0.96 }}
            transition={TABRIX_TACTILE_SPRING}
            onClick={() =>
              onUpdateRow(row.id, {
                doubtConfirmed: true,
                mathConfirmed: true,
              })
            }
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            style={{
              backgroundColor: 'var(--success)',
              color: 'var(--success-fg)',
            }}
          >
            <Check className="h-3.5 w-3.5" />
            <span>اعتماد وتأكيد الصف</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
