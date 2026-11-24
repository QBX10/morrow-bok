import React, { useRef, useState } from 'react';
import { Check, ImagePlus, MousePointerSquareDashed, Trash2 } from 'lucide-react';
import type {
  NormalizedBox,
  QuickExtractFocusField,
  QuickExtractReferenceTemplate,
  QuickExtractTemplateRegion,
} from '../../types/agency';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';

interface ReferenceTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSaveTemplate: (template: QuickExtractReferenceTemplate) => void;
}

const FIELD_OPTIONS: Array<{
  field: QuickExtractFocusField;
  label: string;
  color: string;
}> = [
  { field: 'name', label: 'عمود / منطقة الاسم', color: '#2563eb' },
  { field: 'individuals', label: 'عمود عدد الأفراد', color: '#059669' },
  { field: 'decreaseCount', label: 'عمود النزول / النقصان', color: '#d97706' },
  { field: 'addOrDelete', label: 'عمود الإضافة / الحذف', color: '#dc2626' },
];

export const ReferenceTemplateModal: React.FC<ReferenceTemplateModalProps> = ({
  open,
  onClose,
  onSaveTemplate,
}) => {
  const [name, setName] = useState('نموذج دفتر الوكالة القياسي');
  const [notes, setNotes] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [activeField, setActiveField] = useState<QuickExtractFocusField>('name');
  const [regions, setRegions] = useState<QuickExtractTemplateRegion[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragCurr, setDragCurr] = useState<{ x: number; y: number } | null>(
    null
  );
  const imgContainerRef = useRef<HTMLDivElement | null>(null);

  if (!open) return null;

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      // Compress large reference images onto canvas to keep localStorage lightweight
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxSide = 960;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(100, Math.round(img.width * scale));
        canvas.height = Math.max(100, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setImageDataUrl(canvas.toDataURL('image/jpeg', 0.82));
          setMimeType('image/jpeg');
        } else {
          setImageDataUrl(rawUrl);
        }
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  };

  const getNormalizedPoint = (clientX: number, clientY: number) => {
    const el = imgContainerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(
      0,
      Math.min(1000, Math.round(((clientX - rect.left) / rect.width) * 1000))
    );
    const y = Math.max(
      0,
      Math.min(1000, Math.round(((clientY - rect.top) / rect.height) * 1000))
    );
    return { x, y };
  };

  const finishDraw = () => {
    if (!dragStart || !dragCurr) {
      setDragStart(null);
      setDragCurr(null);
      return;
    }
    const xmin = Math.min(dragStart.x, dragCurr.x);
    const xmax = Math.max(dragStart.x, dragCurr.x);
    const ymin = Math.min(dragStart.y, dragCurr.y);
    const ymax = Math.max(dragStart.y, dragCurr.y);
    if (xmax - xmin >= 25 && ymax - ymin >= 20) {
      const meta =
        FIELD_OPTIONS.find((f) => f.field === activeField) || FIELD_OPTIONS[0];
      const newBox: NormalizedBox = { ymin, xmin, ymax, xmax };
      setRegions((prev) => [
        ...prev.filter((r) => r.field !== activeField),
        {
          id: `reg_${activeField}_${Date.now()}`,
          field: activeField,
          label: meta.label,
          box: newBox,
        },
      ]);
    }
    setDragStart(null);
    setDragCurr(null);
  };

  const draftRect =
    dragStart && dragCurr
      ? {
          left: `${Math.min(dragStart.x, dragCurr.x) / 10}%`,
          top: `${Math.min(dragStart.y, dragCurr.y) / 10}%`,
          width: `${Math.abs(dragCurr.x - dragStart.x) / 10}%`,
          height: `${Math.abs(dragCurr.y - dragStart.y) / 10}%`,
        }
      : null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageDataUrl || !name.trim()) return;
    onSaveTemplate({
      id: `tpl_${Date.now().toString(36)}`,
      name: name.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      imageDataUrl,
      mimeType,
      notes: notes.trim(),
      regions,
    });
    onClose();
  };

  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      title="الصورة المرجعية / النموذج الأولي لتخطيط الدفتر"
      subtitle="ارفع صورة صفحة نموذجية وحدد أعمدتها لرفع دقة الذكاء الاصطناعي"
      ariaLabel="إعداد الصورة المرجعية والنموذج الأولي"
      icon={<MousePointerSquareDashed className="h-4 w-4" />}
      maxWidthClass="max-w-3xl"
    >
      <div className="nexus-squircle p-5 sm:p-6">
        <form
          onSubmit={handleSave}
          className="space-y-4 text-xs"
        >
          <p style={{ color: 'var(--text-muted)' }}>
            ارفع صورة صفحة نموذجية من دفترك أو جدولك، ثم اختر نوع الحقل واسحب
            بالمؤشر على الصورة لتحديد عموده بدقة. سيستخدم الذكاء الاصطناعي هذا
            النموذج كمرجع ثابت لقراءة الصفحات المشابهة بدقة عالية.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-bold">اسم النموذج المرجعي *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: دفتر وكالة منذر 2026"
                className="w-full rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">ملاحظة تخطيطية (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: الأسماء في العمود الأيمن والأرقام يساره"
                className="w-full rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              className="nexus-pill-btn inline-flex cursor-pointer items-center gap-1.5 border px-4 py-2 font-bold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <ImagePlus className="h-4 w-4" />
              <span>
                {imageDataUrl
                  ? 'تغيير صورة النموذج الأولي'
                  : 'اختيار / رفع صورة الدفتر النموذجية'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*"
                onChange={handleImagePick}
                className="hidden"
              />
            </label>

            {imageDataUrl && (
              <div className="flex flex-wrap gap-1.5">
                {FIELD_OPTIONS.map((opt) => {
                  const isActive = activeField === opt.field;
                  const hasRegion = regions.some((r) => r.field === opt.field);
                  return (
                    <button
                      key={opt.field}
                      type="button"
                      onClick={() => setActiveField(opt.field)}
                      className="nexus-pill-btn border px-3 py-1.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: isActive
                          ? opt.color
                          : 'var(--bg-main)',
                        borderColor: isActive || hasRegion ? opt.color : 'var(--border-color)',
                        color: isActive ? '#ffffff' : 'var(--text-primary)',
                      }}
                    >
                      {opt.label} {hasRegion ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {imageDataUrl ? (
            <div className="space-y-2">
              <div
                ref={imgContainerRef}
                onPointerDown={(e) => {
                  const pt = getNormalizedPoint(e.clientX, e.clientY);
                  if (!pt) return;
                  setDragStart(pt);
                  setDragCurr(pt);
                }}
                onPointerMove={(e) => {
                  if (!dragStart) return;
                  const pt = getNormalizedPoint(e.clientX, e.clientY);
                  if (pt) setDragCurr(pt);
                }}
                onPointerUp={finishDraw}
                className="relative mx-auto max-h-[360px] w-fit cursor-crosshair select-none overflow-hidden rounded-xl border"
                style={{
                  borderColor: 'var(--accent)',
                  touchAction: 'none',
                }}
              >
                <img
                  src={imageDataUrl}
                  alt="معاينة الصورة المرجعية"
                  draggable={false}
                  className="block max-h-[358px] w-auto object-contain"
                />

                {regions.map((r) => {
                  const opt = FIELD_OPTIONS.find((f) => f.field === r.field);
                  const color = opt?.color || '#2563eb';
                  return (
                    <div
                      key={r.id}
                      style={{
                        position: 'absolute',
                        left: `${r.box.xmin / 10}%`,
                        top: `${r.box.ymin / 10}%`,
                        width: `${(r.box.xmax - r.box.xmin) / 10}%`,
                        height: `${(r.box.ymax - r.box.ymin) / 10}%`,
                        border: `2px solid ${color}`,
                        backgroundColor: `${color}22`,
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        className="inline-block px-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {r.label}
                      </span>
                    </div>
                  );
                })}

                {draftRect && (
                  <div
                    style={{
                      position: 'absolute',
                      ...draftRect,
                      border: '2px dashed var(--accent)',
                      backgroundColor: 'rgba(37, 99, 235, 0.16)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>

              {regions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {regions.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span>{r.label}</span>
                      <button
                        type="button"
                        aria-label={`حذف تحديد ${r.label}`}
                        onClick={() =>
                          setRegions((prev) => prev.filter((x) => x.id !== r.id))
                        }
                        className="hover:opacity-75"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-xl border border-dashed p-8 text-center"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              اختر صورة واضحة لصفحة دفتر نموذجية لتحديد مناطق الأعمدة فوقها.
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
            <button
              type="button"
              onClick={onClose}
              className="nexus-pill-btn border px-4 py-2 font-semibold"
              style={{ borderColor: 'var(--border-color)' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!imageDataUrl || !name.trim()}
              className="nexus-pill-btn inline-flex items-center gap-1.5 px-5 py-2 font-bold disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Check className="h-3.5 w-3.5" />
              <span>حفظ وتفعيل النموذج المرجعي</span>
            </button>
          </div>
        </form>
      </div>
    </FullScreenPushPage>
  );
};
