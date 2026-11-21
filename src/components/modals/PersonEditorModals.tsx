import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Plus, Trash2, X } from 'lucide-react';
import type { Agency, BlockScope, Person } from '../../types/agency';

interface AddPersonModalProps {
  open: boolean;
  agencies: Agency[];
  defaultAgencyId: number;
  onClose: () => void;
  onSubmitDirect: (input: {
    agencyId: number;
    name: string;
    nationalId: string;
    individuals: number | null;
    notes: string;
  }) => void;
}

export const AddPersonModal: React.FC<AddPersonModalProps> = ({
  open,
  agencies,
  defaultAgencyId,
  onClose,
  onSubmitDirect,
}) => {
  const [agencyId, setAgencyId] = useState(defaultAgencyId);
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [individuals, setIndividuals] = useState('4');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setAgencyId(defaultAgencyId);
      setName('');
      setNationalId('');
      setIndividuals('4');
      setNotes('');
    }
  }, [open, defaultAgencyId]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsedInd = individuals === '' ? null : Math.max(0, Number(individuals));
    onSubmitDirect({
      agencyId,
      name: name.trim(),
      nationalId: nationalId.trim(),
      individuals: parsedInd,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إضافة مستفيد جديد"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        className="w-full max-w-md rounded-xl border p-5 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">إضافة مستفيد جديد (إدخال مباشر)</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الإضافة"
            className="rounded p-1 hover:opacity-75"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="add-person-agency" className="mb-1 block font-medium">
              الوكالة
            </label>
            <select
              id="add-person-agency"
              value={agencyId}
              onChange={(e) => setAgencyId(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="add-person-name" className="mb-1 block font-medium">
              الاسم الكامل *
            </label>
            <input
              id="add-person-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم الثلاثي أو الرباعي"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-person-ind" className="mb-1 block font-medium">
                عدد الأفراد
              </label>
              <input
                id="add-person-ind"
                type="number"
                min={0}
                value={individuals}
                onChange={(e) => setIndividuals(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div>
              <label htmlFor="add-person-nid" className="mb-1 block font-medium">
                رقم البطاقة / الهوية
              </label>
              <input
                id="add-person-nid"
                type="text"
                dir="ltr"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="add-person-notes" className="mb-1 block font-medium">
              الملاحظات
            </label>
            <input
              id="add-person-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 font-semibold whitespace-nowrap"
              style={{ borderColor: 'var(--border-color)' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة فورية</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditPersonModalProps {
  person: Person | null;
  agencies: Agency[];
  customCategories?: string[];
  requireEditConfirm?: boolean;
  onClose: () => void;
  onSaveWithConfirm: (
    personId: number,
    patch: Partial<Person>
  ) => void;
}

export const EditPersonModal: React.FC<EditPersonModalProps> = ({
  person,
  agencies,
  customCategories = [],
  requireEditConfirm = true,
  onClose,
  onSaveWithConfirm,
}) => {
  const [name, setName] = useState('');
  const [agencyId, setAgencyId] = useState(1);
  const [nationalId, setNationalId] = useState('');
  const [individuals, setIndividuals] = useState('0');
  const [blockType, setBlockType] = useState<BlockScope>('none');
  const [blockedIndividuals, setBlockedIndividuals] = useState('0');
  const [blockReason, setBlockReason] = useState('');
  const [notes, setNotes] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (person) {
      setName(person.name);
      setAgencyId(person.agencyId);
      setNationalId(person.nationalId);
      setIndividuals(
        person.individuals === null ? '' : String(person.individuals)
      );
      setBlockType(person.blockType);
      setBlockedIndividuals(String(person.blockedIndividuals || 0));
      setBlockReason(person.blockReason || '');
      setNotes(person.notes || '');
      setCustomCategory(person.customCategory || '');
      setConfirmStep(false);
    }
  }, [person]);

  if (!person) return null;

  const commitEdit = () => {
    onSaveWithConfirm(person.id, {
      name: name.trim(),
      agencyId,
      nationalId: nationalId.trim(),
      individuals: individuals === '' ? null : Math.max(0, Number(individuals)),
      blockType,
      blockedIndividuals: Math.max(0, Number(blockedIndividuals) || 0),
      blockReason: blockReason.trim(),
      notes: notes.trim(),
      customCategory,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تعديل بيانات ${person.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        className="w-full max-w-md rounded-xl border p-5 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">تعديل بيانات المستفيد</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التعديل"
            className="rounded p-1 hover:opacity-75"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmStep ? (
          <div className="space-y-4 text-xs">
            <div
              className="flex items-start gap-2 rounded-lg border p-3"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)',
                color: 'var(--warning)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-bold">تأكيد التعديل (قواعد المحرر)</div>
                <p className="mt-1">
                  هل أنت متأكد من حفظ التعديلات على سجل{' '}
                  <strong>{name}</strong>؟
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmStep(false)}
                className="rounded-lg border px-4 py-2 font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={commitEdit}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Check className="h-3.5 w-3.5" />
                <span>تأكيد وحفظ التعديل</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!requireEditConfirm) {
                commitEdit();
              } else {
                setConfirmStep(true);
              }
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label htmlFor="edit-person-name" className="mb-1 block font-medium">
                الاسم الكامل
              </label>
              <input
                id="edit-person-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-person-agency" className="mb-1 block font-medium">
                  الوكالة
                </label>
                <select
                  id="edit-person-agency"
                  value={agencyId}
                  onChange={(e) => setAgencyId(Number(e.target.value))}
                  className="w-full rounded-lg border px-2.5 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-person-ind" className="mb-1 block font-medium">
                  عدد الأفراد
                </label>
                <input
                  id="edit-person-ind"
                  type="number"
                  min={0}
                  value={individuals}
                  onChange={(e) => setIndividuals(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-person-block" className="mb-1 block font-medium">
                  حالة الحظر / الأرشفة
                </label>
                <select
                  id="edit-person-block"
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as BlockScope)}
                  className="w-full rounded-lg border px-2.5 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="none">نشط (بدون حظر)</option>
                  <option value="partial">حظر جزئي (بعض الأفراد)</option>
                  <option value="full">حظر كامل (محجوب)</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </div>

              {blockType === 'partial' && (
                <div>
                  <label htmlFor="edit-person-blocked-count" className="mb-1 block font-medium">
                    عدد الأفراد المحظورين
                  </label>
                  <input
                    id="edit-person-blocked-count"
                    type="number"
                    min={1}
                    value={blockedIndividuals}
                    onChange={(e) => setBlockedIndividuals(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              )}
            </div>

            {blockType !== 'none' && (
              <div>
                <label htmlFor="edit-person-reason" className="mb-1 block font-medium">
                  سبب الحظر / الأرشفة
                </label>
                <input
                  id="edit-person-reason"
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-person-nid" className="mb-1 block font-medium">
                  رقم البطاقة / الهوية
                </label>
                <input
                  id="edit-person-nid"
                  type="text"
                  dir="ltr"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div>
                <label htmlFor="edit-person-notes" className="mb-1 block font-medium">
                  الملاحظات
                </label>
                <input
                  id="edit-person-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
            </div>

            {customCategories.length > 0 && (
              <div>
                <label htmlFor="edit-person-category" className="mb-1 block font-medium">
                  الفئة المخصصة
                </label>
                <select
                  id="edit-person-category"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="">بدون فئة</option>
                  {customCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-lg px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                {requireEditConfirm ? 'متابعة للتأكيد' : 'حفظ التعديل مباشرة'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  targetLabel: string | null;
  onCancel: () => void;
  onConfirmDelete: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  targetLabel,
  onCancel,
  onConfirmDelete,
}) => {
  if (!targetLabel) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تأكيد الحذف"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        className="w-full max-w-sm rounded-xl border p-5 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--danger)',
        }}
      >
        <div className="flex items-start gap-3">
          <Trash2
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: 'var(--danger)' }}
          />
          <div className="space-y-2">
            <h3 className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
              تأكيد الحذف (قواعد المحرر)
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              هل أنت متأكد من حذف <strong>{targetLabel}</strong>؟ لا يمكن التراجع
              عن الحذف إلا إذا أعدت إضافته.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 font-semibold"
            style={{ borderColor: 'var(--border-color)' }}
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            className="rounded-lg px-4 py-2 font-bold"
            style={{
              backgroundColor: 'var(--danger)',
              color: 'var(--danger-fg)',
            }}
          >
            تأكيد الحذف نهائيًا
          </button>
        </div>
      </div>
    </div>
  );
};
