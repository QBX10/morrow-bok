import React, { useEffect, useState } from 'react';
import { Calendar, Check, Clock, Edit3, X } from 'lucide-react';
import type { SectionTableHeaderMeta } from '../types/agency';

interface TableHeaderEditorProps {
  meta: SectionTableHeaderMeta;
  onSaveMeta: (patch: Partial<SectionTableHeaderMeta>) => void;
  subtitleSuffix?: string;
  compact?: boolean;
}

export const TableHeaderEditor: React.FC<TableHeaderEditorProps> = ({
  meta,
  onSaveMeta,
  subtitleSuffix,
  compact = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(meta.title);
  const [subtitle, setSubtitle] = useState(meta.subtitle);
  const [date, setDate] = useState(meta.date);
  const [autoUpdateDate, setAutoUpdateDate] = useState(meta.autoUpdateDate);

  useEffect(() => {
    setTitle(meta.title);
    setSubtitle(meta.subtitle);
    setDate(meta.date);
    setAutoUpdateDate(meta.autoUpdateDate);
  }, [meta.title, meta.subtitle, meta.date, meta.autoUpdateDate]);

  useEffect(() => {
    const cleanTitle = meta.title.trim();
    if (cleanTitle) {
      document.title = `${cleanTitle} — تابريكس`;
    }
    return () => {
      document.title = 'تابريكس';
    };
  }, [meta.title]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSaveMeta({
      title: title.trim(),
      subtitle: subtitle.trim(),
      date: date.trim() || new Date().toISOString().slice(0, 10),
      autoUpdateDate,
    });
    setEditing(false);
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className={compact ? 'text-base font-bold sm:text-lg' : 'text-lg font-bold sm:text-xl'}>
          {meta.title}
        </h1>

        {meta.date && (
          <span
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <Calendar className="h-3 w-3" />
            <span>{meta.date}</span>
          </span>
        )}

        {meta.autoUpdateDate && meta.lastUpdatedAt && (
          <span
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
            title="يتم تحديث هذا التاريخ تلقائيًا عند كل تعديل"
          >
            <Clock className="h-3 w-3" />
            <span>آخر تحديث: {meta.lastUpdatedAt}</span>
          </span>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="تعديل عنوان الجدول والصفحة والتاريخ"
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors hover:opacity-85"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <Edit3 className="h-3 w-3" />
          <span>تعديل العنوان والتاريخ</span>
        </button>
      </div>

      {(meta.subtitle || subtitleSuffix) && (
        <div
          className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {meta.subtitle && <span>{meta.subtitle}</span>}
          {meta.subtitle && subtitleSuffix && <span>·</span>}
          {subtitleSuffix && <span className="tabular-nums">{subtitleSuffix}</span>}
        </div>
      )}

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تخصيص عنوان الجدول والصفحة والتاريخ"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border p-5 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">عنونة الجدول والصفحة والتاريخ</h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="إغلاق"
                className="rounded p-1 hover:opacity-75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium">
                  عنوان الجدول والصفحة *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium">
                  العنوان الفرعي / الوصف
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="مثال: وجبة شهر أيار — التوزيع الصباحي"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium">
                  التاريخ الظاهر (الإنشاء / الوجبة)
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoUpdateDate}
                  onChange={(e) => setAutoUpdateDate(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold">تحديث تاريخ آخر تعديل تلقائيًا</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    يعرض شارة «آخر تحديث» تلقائيًا لمعرفة ما إذا كانت القائمة حديثة أو قديمة.
                  </div>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border px-4 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>حفظ العنوان والتاريخ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
