import React, { useMemo, useState } from 'react';
import { Check, HeartHandshake, Plus, Search, X } from 'lucide-react';
import type {
  Agency,
  CalculationSettings,
  Person,
  ReadyList,
  RelationCategory,
  RelationEntry,
} from '../../types/agency';
import {
  getEffectiveAllocationForPerson,
  normalizeArabic,
} from '../../utils/agencyLogic';
import {
  getRelationCategoryMeta,
  RELATION_CATEGORIES,
} from '../../utils/relationMeta';

interface AddReadyListMembersModalProps {
  open: boolean;
  list: ReadyList;
  persons: Person[];
  agencies: Agency[];
  relations: RelationEntry[];
  existingSourcePersonIds: Set<number>;
  calculationSettings: CalculationSettings;
  onClose: () => void;
  onAddSelectedPersons: (
    personIds: number[],
    overrideNotesMap?: Record<number, string>
  ) => number;
}

export const AddReadyListMembersModal: React.FC<
  AddReadyListMembersModalProps
> = ({
  open,
  list,
  persons,
  agencies,
  relations,
  existingSourcePersonIds,
  calculationSettings,
  onClose,
  onAddSelectedPersons,
}) => {
  const [activeSourceTab, setActiveSourceTab] = useState<'tables' | 'relations'>(
    'tables'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>(
    'all'
  );
  const [relCatFilter, setRelCatFilter] = useState<'all' | RelationCategory>(
    'all'
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  const personMap = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons]
  );

  const filteredTablePersons = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    return persons.filter((p) => {
      if (agencyFilter !== 'all' && p.agencyId !== Number(agencyFilter)) {
        return false;
      }
      if (
        statusFilter === 'active' &&
        (p.status !== '' || p.blockType === 'full')
      ) {
        return false;
      }
      if (
        statusFilter === 'blocked' &&
        p.status !== 'محجوب' &&
        p.blockType !== 'full' &&
        p.blockType !== 'partial'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        normalizeArabic(p.name).includes(q) ||
        p.nationalId.includes(searchQuery.trim()) ||
        normalizeArabic(p.status).includes(q) ||
        normalizeArabic(p.notes).includes(q)
      );
    });
  }, [persons, agencyFilter, statusFilter, searchQuery]);

  const filteredRelations = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    return relations
      .filter((r) => {
        if (relCatFilter !== 'all' && r.category !== relCatFilter) return false;
        const p = personMap.get(r.personId);
        if (!p) return false;
        if (!q) return true;
        return (
          normalizeArabic(p.name).includes(q) ||
          normalizeArabic(r.note).includes(q) ||
          normalizeArabic(r.deliveryAddress || '').includes(q) ||
          p.nationalId.includes(searchQuery.trim())
        );
      })
      .map((r) => ({
        rel: r,
        person: personMap.get(r.personId)!,
      }));
  }, [relations, relCatFilter, personMap, searchQuery]);

  if (!open) return null;

  const togglePick = (pid: number) => {
    setSelectedIds((curr) =>
      curr.includes(pid) ? curr.filter((x) => x !== pid) : [...curr, pid]
    );
  };

  const buildRelationNotesMap = (pids: number[]) => {
    const map: Record<number, string> = {};
    for (const pid of pids) {
      const rel = relations.find((r) => r.personId === pid);
      const p = personMap.get(pid);
      if (rel) {
        const extra = [
          rel.deliveryAddress,
          rel.deliveryPhone,
          rel.deliveryTime,
          rel.note,
        ]
          .filter(Boolean)
          .join(' · ');
        if (extra) {
          map[pid] = p?.notes ? `${p.notes} | ${extra}` : extra;
        }
      }
    }
    return map;
  };

  const handleInstantAdd = (pid: number, withRelationNote = false) => {
    const added = onAddSelectedPersons(
      [pid],
      withRelationNote ? buildRelationNotesMap([pid]) : undefined
    );
    if (added > 0) {
      setFeedback('تمت إضافة العضو إلى القائمة بنجاح.');
      setSelectedIds((curr) => curr.filter((x) => x !== pid));
    } else {
      setFeedback('هذا العضو مضاف مسبقًا في القائمة.');
    }
  };

  const handleBatchAdd = () => {
    if (selectedIds.length === 0) return;
    const added = onAddSelectedPersons(
      selectedIds,
      activeSourceTab === 'relations'
        ? buildRelationNotesMap(selectedIds)
        : undefined
    );
    setFeedback(
      added > 0
        ? `تمت إضافة ${added} أعضاء جدد إلى القائمة.`
        : 'جميع المحددين مضافون مسبقًا.'
    );
    setSelectedIds([]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`إضافة أعضاء إلى ${list.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div>
            <h3 className="text-base font-bold">
              إضافة أعضاء إلى: {list.name}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              أضف بالبحث المباشر في الجداول أو من قسم العلاقات والمتابعة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded p-1 hover:opacity-75"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source Method Tabs */}
        <div
          className="flex flex-wrap items-center gap-2 border-b px-5 py-3 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
            onClick={() => setActiveSourceTab('tables')}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 font-bold"
            style={{
              backgroundColor:
                activeSourceTab === 'tables'
                  ? 'var(--accent)'
                  : 'var(--bg-main)',
              borderColor:
                activeSourceTab === 'tables'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              color:
                activeSourceTab === 'tables'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <Search className="h-3.5 w-3.5" />
            <span>1. البحث المباشر في الجداول ({persons.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSourceTab('relations')}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 font-bold"
            style={{
              backgroundColor:
                activeSourceTab === 'relations'
                  ? 'var(--accent)'
                  : 'var(--bg-main)',
              borderColor:
                activeSourceTab === 'relations'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              color:
                activeSourceTab === 'relations'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            <span>2. الاختيار من قسم العلاقات ({relations.length})</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div
          className="flex flex-wrap items-center gap-2 border-b px-5 py-3 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeSourceTab === 'tables'
                  ? 'ابحث بالاسم أو رقم البطاقة أو الحالة...'
                  : 'ابحث في العلاقات بالاسم أو الملاحظة أو العنوان...'
              }
              className="w-full rounded-lg border py-2 pr-8 pl-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          {activeSourceTab === 'tables' ? (
            <>
              <select
                value={agencyFilter}
                onChange={(e) => setAgencyFilter(e.target.value)}
                aria-label="تصفية حسب الوكالة"
                className="rounded-lg border px-2.5 py-2 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="all">جميع الوكالات</option>
                {agencies.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'blocked')
                }
                aria-label="تصفية حسب الحالة"
                className="rounded-lg border px-2.5 py-2 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="all">كل الحالات</option>
                <option value="active">النشطون فقط</option>
                <option value="blocked">المحجوبون</option>
              </select>
            </>
          ) : (
            <select
              value={relCatFilter}
              onChange={(e) =>
                setRelCatFilter(e.target.value as 'all' | RelationCategory)
              }
              aria-label="تصفية فئة العلاقات"
              className="rounded-lg border px-2.5 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <option value="all">جميع فئات العلاقات</option>
              {RELATION_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="status"
            className="mx-5 mt-3 rounded-lg border px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: 'var(--success-bg)',
              borderColor: 'var(--success)',
              color: 'var(--success)',
            }}
          >
            {feedback}
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 space-y-2 overflow-y-auto p-5 text-xs">
          {activeSourceTab === 'tables' ? (
            filteredTablePersons.length === 0 ? (
              <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                لا توجد نتائج مطابقة للبحث في الجداول.
              </div>
            ) : (
              filteredTablePersons.map((p) => {
                const alreadyInList = existingSourcePersonIds.has(p.id);
                const checked = selectedIds.includes(p.id);
                const eff = getEffectiveAllocationForPerson(
                  p,
                  calculationSettings
                );

                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    style={{
                      backgroundColor: checked
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                      borderColor: checked
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    }}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        disabled={alreadyInList}
                        checked={checked || alreadyInList}
                        onChange={() => togglePick(p.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{p.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {agencyMap.get(p.agencyId)}
                          </span>
                          <span
                            className="rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--accent)',
                            }}
                          >
                            {eff.eligibleIndividuals ?? 0} أنفار · {eff.quotaText}
                          </span>
                          {eff.summary.scope !== 'none' && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                              style={{
                                backgroundColor: 'var(--warning-bg)',
                                color: 'var(--warning)',
                              }}
                            >
                              {eff.summary.shortLabel}
                            </span>
                          )}
                        </div>
                        {(p.nationalId || p.notes) && (
                          <div className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {p.nationalId ? `بطاقة: ${p.nationalId}` : ''}
                            {p.nationalId && p.notes ? ' · ' : ''}
                            {p.notes}
                          </div>
                        )}
                      </div>
                    </label>

                    {alreadyInList ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold"
                        style={{
                          backgroundColor: 'var(--success-bg)',
                          color: 'var(--success)',
                        }}
                      >
                        <Check className="h-3 w-3" />
                        <span>مضاف</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstantAdd(p.id, false)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-fg)',
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>إضافة فورية</span>
                      </button>
                    )}
                  </div>
                );
              })
            )
          ) : filteredRelations.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              لا توجد أسماء مطابقة في قسم العلاقات.
            </div>
          ) : (
            filteredRelations.map(({ rel, person }) => {
              const alreadyInList = existingSourcePersonIds.has(person.id);
              const checked = selectedIds.includes(person.id);
              const catMeta = getRelationCategoryMeta(rel.category);
              const eff = getEffectiveAllocationForPerson(
                person,
                calculationSettings
              );

              return (
                <div
                  key={rel.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  style={{
                    backgroundColor: checked
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: checked
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  }}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      disabled={alreadyInList}
                      checked={checked || alreadyInList}
                      onChange={() => togglePick(person.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{person.name}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                          style={{
                            backgroundColor: catMeta.badgeBgVar,
                            color: catMeta.badgeColorVar,
                          }}
                        >
                          {catMeta.label}
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                          {eff.eligibleIndividuals ?? 0} أنفار
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {rel.note}
                        {rel.deliveryAddress ? ` · ${rel.deliveryAddress}` : ''}
                        {rel.deliveryPhone ? ` · ${rel.deliveryPhone}` : ''}
                        {rel.deliveryTime ? ` · ${rel.deliveryTime}` : ''}
                        {rel.reminderDate ? ` · تاريخ التذكير: ${rel.reminderDate}` : ''}
                      </div>
                    </div>
                  </label>

                  {alreadyInList ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold"
                      style={{
                        backgroundColor: 'var(--success-bg)',
                        color: 'var(--success)',
                      }}
                    >
                      <Check className="h-3 w-3" />
                      <span>مضاف</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInstantAdd(person.id, true)}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة مع الملاحظة</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Batch Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <span className="font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
            المحددون للإضافة: {selectedIds.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 font-semibold"
              style={{ borderColor: 'var(--border-color)' }}
            >
              إغلاق
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleBatchAdd}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold disabled:opacity-45"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة المحددين للقائمة ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
