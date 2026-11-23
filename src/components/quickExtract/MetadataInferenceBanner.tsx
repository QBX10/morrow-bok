import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  Edit3,
  Hash,
  Sparkles,
  X,
} from 'lucide-react';
import type { Agency, InferredDocumentMetadata } from '../../types/agency';
import { ZERO_TRUST_CONFIDENCE_THRESHOLD } from '../../utils/zeroTrustExtract';

interface MetadataInferenceBannerProps {
  metadata: InferredDocumentMetadata | null | undefined;
  agencies: Agency[];
  onConfirm: (updated: InferredDocumentMetadata) => void;
  onUpdate: (updated: InferredDocumentMetadata) => void;
}

export const MetadataInferenceBanner: React.FC<MetadataInferenceBannerProps> = ({
  metadata,
  agencies,
  onConfirm,
  onUpdate,
}) => {
  const [editing, setEditing] = useState(false);
  const [agencyName, setAgencyName] = useState(metadata?.agencyName || '');
  const [matchedAgencyId, setMatchedAgencyId] = useState<number | null>(
    metadata?.matchedAgencyId ?? null
  );
  const [tableDateLabel, setTableDateLabel] = useState(
    metadata?.tableDateLabel || ''
  );
  const [centerNumber, setCenterNumber] = useState(
    metadata?.centerOrAgencyNumber || ''
  );

  useEffect(() => {
    setAgencyName(metadata?.agencyName || '');
    setMatchedAgencyId(metadata?.matchedAgencyId ?? null);
    setTableDateLabel(metadata?.tableDateLabel || '');
    setCenterNumber(metadata?.centerOrAgencyNumber || '');
  }, [metadata]);

  if (!metadata && !editing) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>
            لم تُرصد ترويسة واضحة للوكالة أو الشهر تلقائيًا في هذا الملف. يمكنك تحديد الهوية يدويًا قبل الحفظ.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <Edit3 className="h-3.5 w-3.5" />
          تحديد الهوية يدويًا
        </button>
      </div>
    );
  }

  const meta: InferredDocumentMetadata = metadata || {
    agencyName: agencyName || null,
    agencyNameConfidence: agencyName ? 1 : 0,
    matchedAgencyId,
    tableDateLabel: tableDateLabel || null,
    tableDateConfidence: tableDateLabel ? 1 : 0,
    centerOrAgencyNumber: centerNumber || null,
    centerNumberConfidence: centerNumber ? 1 : 0,
    confirmedByUser: false,
  };

  const agencyLowConf =
    !meta.confirmedByUser &&
    Boolean(meta.agencyName) &&
    meta.agencyNameConfidence < ZERO_TRUST_CONFIDENCE_THRESHOLD;
  const dateLowConf =
    !meta.confirmedByUser &&
    Boolean(meta.tableDateLabel) &&
    meta.tableDateConfidence < ZERO_TRUST_CONFIDENCE_THRESHOLD;

  const displayAgency = meta.agencyName || 'وكالة غير محددة في الترويسة';
  const displayDate = meta.tableDateLabel || 'تاريخ غير محدد';

  const handleSaveEdit = () => {
    const pickedAgency =
      matchedAgencyId !== null
        ? agencies.find((a) => a.id === matchedAgencyId) || null
        : null;
    const next: InferredDocumentMetadata = {
      ...meta,
      agencyName: agencyName.trim() || pickedAgency?.name || null,
      agencyNameConfidence: 1,
      matchedAgencyId: pickedAgency?.id ?? matchedAgencyId ?? null,
      tableDateLabel: tableDateLabel.trim() || null,
      tableDateConfidence: 1,
      centerOrAgencyNumber: centerNumber.trim() || null,
      centerNumberConfidence: 1,
      confirmedByUser: true,
    };
    onUpdate(next);
    setEditing(false);
  };

  return (
    <div
      className="rounded-xl border p-3.5 transition-colors"
      style={{
        backgroundColor: meta.confirmedByUser
          ? 'var(--success-bg)'
          : 'var(--warning-bg)',
        borderColor: meta.confirmedByUser ? 'var(--success)' : 'var(--warning)',
        color: 'var(--text-primary)',
      }}
    >
      {!editing ? (
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2.5">
            {meta.confirmedByUser ? (
              <Check
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: 'var(--success)' }}
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: 'var(--warning)' }}
              />
            )}
            <div className="space-y-1 text-xs leading-relaxed">
              <div className="text-sm font-semibold">
                {meta.confirmedByUser ? (
                  <>
                    تم اعتماد هوية الجدول: «{displayAgency}» — لشهر «{displayDate}»
                  </>
                ) : (
                  <>
                    لقد استنتجت أن هذا الجدول يخص{' '}
                    <span
                      className="mx-0.5 rounded px-1.5 py-0.5 font-bold"
                      style={{
                        backgroundColor: agencyLowConf
                          ? 'var(--danger-bg)'
                          : 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      ({displayAgency})
                    </span>{' '}
                    لشهر{' '}
                    <span
                      className="mx-0.5 rounded px-1.5 py-0.5 font-bold"
                      style={{
                        backgroundColor: dateLowConf
                          ? 'var(--danger-bg)'
                          : 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      ({displayDate})
                    </span>
                    . هل هذا صحيح؟
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {meta.centerOrAgencyNumber && (
                  <span className="inline-flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    رقم المركز/الوكالة: <strong style={{ color: 'var(--text-primary)' }}>{meta.centerOrAgencyNumber}</strong>
                  </span>
                )}
                {meta.matchedAgencyId && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    مطابق مع وكالة مسجلة في النظام
                  </span>
                )}
                {!meta.confirmedByUser && (agencyLowConf || dateLowConf) && (
                  <span className="font-medium" style={{ color: 'var(--danger)' }}>
                    ثقة الاستنتاج أقل من 99% ({Math.round(Math.min(meta.agencyNameConfidence || 1, meta.tableDateConfidence || 1) * 100)}%) — يُرجى المراجعة
                  </span>
                )}
                {meta.headerSnippet && (
                  <span className="truncate max-w-md" title={meta.headerSnippet}>
                    الترويسة: {meta.headerSnippet}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!meta.confirmedByUser && (
              <button
                type="button"
                onClick={() => onConfirm({ ...meta, confirmedByUser: true })}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--success)' }}
              >
                <Check className="h-3.5 w-3.5" />
                نعم، متابعة
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل الهوية
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">تعديل هوية الجدول والترويسة المستنتجة</span>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded p-1"
              style={{ color: 'var(--text-muted)' }}
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4">
            <label className="space-y-1 text-xs">
              <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                <Building2 className="h-3 w-3" /> ربط بوكالة مسجلة
              </span>
              <select
                value={matchedAgencyId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setMatchedAgencyId(val);
                  if (val !== null) {
                    const found = agencies.find((a) => a.id === val);
                    if (found) setAgencyName(found.name);
                  }
                }}
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">— اختيار يدوي / خارجي —</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs">
              <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
                اسم الوكالة المستخرج
              </span>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="مثال: وكالة منذر الحلو"
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>

            <label className="space-y-1 text-xs">
              <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                <Calendar className="h-3 w-3" /> شهر / تاريخ الجدول
              </span>
              <input
                type="text"
                value={tableDateLabel}
                onChange={(e) => setTableDateLabel(e.target.value)}
                placeholder="مثال: تشرين الأول 2026"
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>

            <label className="space-y-1 text-xs">
              <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                <Hash className="h-3 w-3" /> رقم المركز أو الوكالة
              </span>
              <input
                type="text"
                value={centerNumber}
                onChange={(e) => setCenterNumber(e.target.value)}
                placeholder="مثال: 412"
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border px-3 py-1.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Check className="h-3.5 w-3.5" />
              حفظ وتأكيد الهوية
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
