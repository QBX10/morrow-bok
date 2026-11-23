import React, { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  Edit3,
  HeartHandshake,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import type {
  Agency,
  CalculationSettings,
  Person,
  ReadyList,
  RelationCategory,
  RelationEntry,
  RelationsReadyListsPrefs,
  SectionTableHeaderMeta,
} from '../types/agency';
import {
  getEffectiveAllocationForPerson,
  normalizeArabic,
} from '../utils/agencyLogic';
import {
  getRelationCategoryMeta,
  RELATION_CATEGORIES,
  resolveSectionTableHeader,
} from '../utils/relationMeta';
import {
  SelectionActionBar,
  type SelectablePersonRecord,
} from './SelectionActionBar';
import { TableHeaderEditor } from './TableHeaderEditor';

interface RelationshipsViewProps {
  agencies: Agency[];
  persons: Person[];
  relations: RelationEntry[];
  readyLists: ReadyList[];
  tableHeaders: Record<string, SectionTableHeaderMeta>;
  calculationSettings: CalculationSettings;
  canEditRecords: boolean;
  relationsPrefs?: RelationsReadyListsPrefs;
  onUpdateTableHeaderMeta: (
    key: string,
    patch: Partial<SectionTableHeaderMeta>
  ) => void;
  onUpsertRelation: (input: {
    personId: number;
    category: RelationCategory;
    note: string;
    reminderDate?: string;
    deliveryAddress?: string;
    deliveryPhone?: string;
    deliveryTime?: string;
  }) => void;
  onRequestDeleteRelation: (entry: RelationEntry) => void;
  onMoveToAgency: (personIds: number[], targetAgencyId: number) => void;
  onAddToReadyList: (listId: number, personIds: number[]) => number;
}

export const RelationshipsView: React.FC<RelationshipsViewProps> = ({
  agencies,
  persons,
  relations,
  readyLists,
  tableHeaders,
  calculationSettings,
  canEditRecords,
  relationsPrefs,
  onUpdateTableHeaderMeta,
  onUpsertRelation,
  onRequestDeleteRelation,
  onMoveToAgency,
  onAddToReadyList,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | RelationCategory>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelationIds, setSelectedRelationIds] = useState<number[]>([]);

  // Add / Edit Relation Modal
  const [formOpen, setFormOpen] = useState(false);
  const [formPersonId, setFormPersonId] = useState<number>(persons[0]?.id ?? 0);
  const [formCategory, setFormCategory] =
    useState<RelationCategory>('favorites');
  const [formNote, setFormNote] = useState('');
  const [formReminderDate, setFormReminderDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTime, setFormTime] = useState('');
  const [personSearch, setPersonSearch] = useState('');

  const headerMeta = useMemo(
    () =>
      resolveSectionTableHeader({
        key: 'relationships',
        tableHeaders,
        fallbackTitle: 'قسم العلاقات والمتابعة',
        fallbackSubtitle:
          'المفضلة، التعديل لاحقاً، التذكير، ملاحظات التوصيل والخط، وقيد المراجعة',
      }),
    [tableHeaders]
  );

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  const personMap = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<RelationCategory, number> = {
      favorites: 0,
      edit_later: 0,
      reminder: 0,
      delivery_notes: 0,
      pending_audit: 0,
    };
    for (const r of relations) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return counts;
  }, [relations]);

  const visibleEntries = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    return relations
      .filter((r) => {
        if (activeCategory !== 'all' && r.category !== activeCategory) {
          return false;
        }
        if (!q) return true;
        const p = personMap.get(r.personId);
        return (
          normalizeArabic(p?.name || r.personName).includes(q) ||
          normalizeArabic(r.note).includes(q) ||
          normalizeArabic(r.deliveryAddress || '').includes(q) ||
          (r.deliveryPhone || '').includes(searchQuery.trim())
        );
      })
      .map((rel) => ({
        rel,
        person: personMap.get(rel.personId) || null,
      }));
  }, [relations, activeCategory, searchQuery, personMap]);

  const selectedRecords: SelectablePersonRecord[] = useMemo(() => {
    const chosen = visibleEntries.filter(({ rel }) =>
      selectedRelationIds.includes(rel.id)
    );
    return chosen.map(({ rel, person }) => ({
      selectionKey: `rel:${rel.id}`,
      personId: person?.id ?? rel.personId,
      name: person?.name || rel.personName,
      agencyId: person?.agencyId ?? rel.agencyId,
      agencyName: agencyMap.get(person?.agencyId ?? rel.agencyId) || '',
      nationalId: person?.nationalId || '',
      individuals: person?.individuals ?? null,
      blockType: person?.blockType || 'none',
      blockedIndividuals: person?.blockedIndividuals || 0,
      blockReason: person?.blockReason || '',
      status: person?.status || '',
      notes: [person?.notes, rel.note, rel.deliveryAddress].filter(Boolean).join(' · '),
      updatedAt: rel.updatedAt,
    }));
  }, [visibleEntries, selectedRelationIds, agencyMap]);

  const upcomingReminders = useMemo(() => {
    if (relationsPrefs?.enableReminderAlerts === false) return [];
    const leadDays = relationsPrefs?.defaultReminderLeadDays ?? 3;
    const now = new Date();
    const cutoff = new Date(now.getTime() + leadDays * 86400000)
      .toISOString()
      .slice(0, 10);
    return relations.filter(
      (r) => r.category === 'reminder' && r.reminderDate && r.reminderDate <= cutoff
    );
  }, [relations, relationsPrefs]);

  const openNewRelationModal = (presetCategory?: RelationCategory) => {
    const resolvedCat =
      presetCategory || (activeCategory === 'all' ? 'favorites' : activeCategory);
    setFormPersonId(persons[0]?.id ?? 0);
    setFormCategory(resolvedCat);
    setFormNote(
      resolvedCat === 'delivery_notes' &&
        relationsPrefs?.defaultDeliveryNotePrefix
        ? relationsPrefs.defaultDeliveryNotePrefix
        : ''
    );
    setFormReminderDate(new Date().toISOString().slice(0, 10));
    setFormAddress('');
    setFormPhone('');
    setFormTime('');
    setPersonSearch('');
    setFormOpen(true);
  };

  const openEditRelationModal = (rel: RelationEntry) => {
    setFormPersonId(rel.personId);
    setFormCategory(rel.category);
    setFormNote(rel.note);
    setFormReminderDate(
      rel.reminderDate || new Date().toISOString().slice(0, 10)
    );
    setFormAddress(rel.deliveryAddress || '');
    setFormPhone(rel.deliveryPhone || '');
    setFormTime(rel.deliveryTime || '');
    setPersonSearch('');
    setFormOpen(true);
  };

  const filteredModalPersons = useMemo(() => {
    const q = normalizeArabic(personSearch);
    if (!q) return persons;
    return persons.filter(
      (p) =>
        normalizeArabic(p.name).includes(q) ||
        p.nationalId.includes(personSearch.trim())
    );
  }, [persons, personSearch]);

  const toggleRowSelection = (relId: number) => {
    setSelectedRelationIds((curr) =>
      curr.includes(relId) ? curr.filter((x) => x !== relId) : [...curr, relId]
    );
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 pb-24 sm:p-6 sm:pb-20">
      {/* Editable Page & Table Title + Date */}
      <div
        data-assistant-target="relationships-header"
        className="tabrix-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <span
            className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'color-mix(in srgb, var(--accent) 26%, var(--border-color))',
              color: 'var(--accent)',
            }}
            aria-hidden="true"
          >
            <HeartHandshake className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <TableHeaderEditor
              meta={headerMeta}
              onSaveMeta={(patch) => onUpdateTableHeaderMeta('relationships', patch)}
              subtitleSuffix={`${visibleEntries.length} سجل متابعة`}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => openNewRelationModal()}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          <Plus className="h-4 w-4" />
          <span>إضافة اسم للعلاقات</span>
        </button>
      </div>

      {upcomingReminders.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"
          style={{
            backgroundColor: 'var(--warning-bg)',
            borderColor: 'var(--warning)',
            color: 'var(--warning)',
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Bell className="h-4 w-4 shrink-0" />
            <span>
              تنبيه التذكيرات المستحقة أو القريبة ({upcomingReminders.length}):{' '}
              {upcomingReminders
                .slice(0, 3)
                .map((r) => `${r.personName} (${r.reminderDate})`)
                .join(' · ')}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setActiveCategory('reminder')}
            className="underline"
          >
            عرض التذكيرات
          </button>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className="rounded-lg border px-3 py-2 font-bold transition-colors"
          style={{
            backgroundColor:
              activeCategory === 'all' ? 'var(--accent)' : 'var(--bg-surface)',
            borderColor:
              activeCategory === 'all'
                ? 'var(--accent)'
                : 'var(--border-color)',
            color:
              activeCategory === 'all'
                ? 'var(--accent-fg)'
                : 'var(--text-primary)',
          }}
        >
          الكل ({relations.length})
        </button>

        {RELATION_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className="rounded-lg border px-3 py-2 font-bold transition-colors"
              style={{
                backgroundColor: active ? 'var(--accent)' : 'var(--bg-surface)',
                borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                color: active ? 'var(--accent-fg)' : 'var(--text-primary)',
              }}
            >
              {cat.label} ({categoryCounts[cat.id] || 0})
            </button>
          );
        })}
      </div>

      {/* Sleek Top Selection Action Bar */}
      <SelectionActionBar
        selectedRecords={selectedRecords}
        totalVisibleCount={visibleEntries.length}
        agencies={agencies}
        readyLists={readyLists}
        relations={relations}
        calculationSettings={calculationSettings}
        tableTitle={headerMeta.title}
        tableDate={headerMeta.date}
        onSelectAll={() =>
          setSelectedRelationIds(visibleEntries.map((e) => e.rel.id))
        }
        onClearSelection={() => setSelectedRelationIds([])}
        onMoveToAgency={onMoveToAgency}
        onAddToReadyList={onAddToReadyList}
        onUpsertRelation={onUpsertRelation}
      />

      {/* Search Bar */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو ملاحظة التوصيل أو التذكير..."
            aria-label="بحث في قسم العلاقات"
            className="w-full rounded-lg border py-1.5 pr-8 pl-3 text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          />
        </div>
      </div>

      {/* Relationships Table */}
      <div
        className="overflow-x-auto rounded-xl border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <table className="agency-table text-right text-xs sm:text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
              <th
                className="border-l px-2.5 text-center"
                style={{ borderColor: 'var(--grid-color)' }}
              >
                <input
                  type="checkbox"
                  aria-label="تحديد جميع سجلات العلاقات الظاهرة"
                  checked={
                    visibleEntries.length > 0 &&
                    selectedRelationIds.length === visibleEntries.length
                  }
                  onChange={(e) =>
                    setSelectedRelationIds(
                      e.target.checked
                        ? visibleEntries.map((x) => x.rel.id)
                        : []
                    )
                  }
                />
              </th>
              <th
                className="border-l px-3 font-bold whitespace-nowrap"
                style={{ borderColor: 'var(--grid-color)' }}
              >
                الاسم
              </th>
              <th
                className="border-l px-3 font-bold whitespace-nowrap"
                style={{ borderColor: 'var(--grid-color)' }}
              >
                الفئة
              </th>
              <th
                className="border-l px-3 font-bold whitespace-nowrap"
                style={{ borderColor: 'var(--grid-color)' }}
              >
                الوكالة والأفراد
              </th>
              <th
                className="border-l px-3 font-bold"
                style={{ borderColor: 'var(--grid-color)' }}
              >
                الموضوع / تفاصيل التوصيل والتذكير
              </th>
              <th
                className="border-l px-3 text-center font-bold whitespace-nowrap"
                style={{ borderColor: 'var(--grid-color)' }}
              >
                التحديث
              </th>
              <th className="px-3 text-center font-bold whitespace-nowrap">
                إجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  لا توجد سجلات في هذا القسم. اضغط «إضافة اسم للعلاقات» أو حدد أي اسم من الجداول لإضافته.
                </td>
              </tr>
            ) : (
              visibleEntries.map(({ rel, person }) => {
                const catMeta = getRelationCategoryMeta(rel.category);
                const selected = selectedRelationIds.includes(rel.id);
                const eff = person
                  ? getEffectiveAllocationForPerson(person, calculationSettings)
                  : null;

                return (
                  <tr
                    key={rel.id}
                    className="transition-colors"
                    style={{
                      backgroundColor: selected
                        ? 'var(--bg-nav-active)'
                        : undefined,
                    }}
                  >
                    <td
                      className="border-l px-2.5 text-center"
                      style={{ borderColor: 'var(--grid-color)' }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`تحديد ${person?.name || rel.personName}`}
                        checked={selected}
                        onChange={() => toggleRowSelection(rel.id)}
                      />
                    </td>
                    <td
                      className="border-l px-3 font-bold whitespace-nowrap"
                      style={{ borderColor: 'var(--grid-color)' }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRowSelection(rel.id)}
                        className="text-right hover:underline"
                      >
                        {person?.name || rel.personName}
                      </button>
                    </td>
                    <td
                      className="border-l px-3 whitespace-nowrap"
                      style={{ borderColor: 'var(--grid-color)' }}
                    >
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: catMeta.badgeBgVar,
                          color: catMeta.badgeColorVar,
                        }}
                      >
                        <HeartHandshake className="h-3 w-3" />
                        <span>{catMeta.label}</span>
                      </span>
                    </td>
                    <td
                      className="border-l px-3 text-xs whitespace-nowrap"
                      style={{ borderColor: 'var(--grid-color)' }}
                    >
                      <div>{agencyMap.get(person?.agencyId ?? rel.agencyId) || '—'}</div>
                      {eff && (
                        <div className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {eff.eligibleIndividuals ?? 0} أفراد · {eff.quotaText}
                        </div>
                      )}
                    </td>
                    <td
                      className="border-l px-3 text-xs"
                      style={{ borderColor: 'var(--grid-color)' }}
                    >
                      <div className="font-semibold">{rel.note || '—'}</div>
                      {rel.reminderDate && (
                        <div
                          className="mt-0.5 inline-flex items-center gap-1 tabular-nums"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Bell className="h-3 w-3" />
                          <span>موعد التذكير: {rel.reminderDate}</span>
                        </div>
                      )}
                      {(rel.deliveryAddress || rel.deliveryPhone || rel.deliveryTime) && (
                        <div
                          className="mt-0.5 flex flex-wrap items-center gap-2"
                          style={{ color: 'var(--success)' }}
                        >
                          <Truck className="h-3 w-3 shrink-0" />
                          {rel.deliveryAddress && <span>{rel.deliveryAddress}</span>}
                          {rel.deliveryPhone && <span dir="ltr">{rel.deliveryPhone}</span>}
                          {rel.deliveryTime && <span>({rel.deliveryTime})</span>}
                        </div>
                      )}
                    </td>
                    <td
                      className="border-l px-3 text-center text-xs tabular-nums whitespace-nowrap"
                      style={{
                        borderColor: 'var(--grid-color)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {rel.updatedAt}
                    </td>
                    <td className="px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditRelationModal(rel)}
                          aria-label={`تعديل علاقة ${person?.name || rel.personName}`}
                          className="rounded border p-1.5 hover:opacity-80"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        {canEditRecords !== undefined && (
                          <button
                            type="button"
                            onClick={() => onRequestDeleteRelation(rel)}
                            aria-label={`حذف ${person?.name || rel.personName} من العلاقات`}
                            className="rounded border p-1.5 hover:opacity-80"
                            style={{
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Relation Modal */}
      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="إضافة أو تعديل سجل في قسم العلاقات"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setFormOpen(false)}
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
              <h3 className="text-base font-bold">إضافة / تحديث في قسم العلاقات</h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="إغلاق"
                className="rounded p-1 hover:opacity-75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formPersonId) return;
                onUpsertRelation({
                  personId: formPersonId,
                  category: formCategory,
                  note: formNote,
                  reminderDate:
                    formCategory === 'reminder' ? formReminderDate : undefined,
                  deliveryAddress:
                    formCategory === 'delivery_notes' ? formAddress : undefined,
                  deliveryPhone:
                    formCategory === 'delivery_notes' ? formPhone : undefined,
                  deliveryTime:
                    formCategory === 'delivery_notes' ? formTime : undefined,
                });
                setFormOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="mb-1 block font-medium">بحث سريع عن المستفيد</label>
                <input
                  type="search"
                  value={personSearch}
                  onChange={(e) => {
                    setPersonSearch(e.target.value);
                    const q = normalizeArabic(e.target.value);
                    const first = persons.find(
                      (p) =>
                        normalizeArabic(p.name).includes(q) ||
                        p.nationalId.includes(e.target.value.trim())
                    );
                    if (first) setFormPersonId(first.id);
                  }}
                  placeholder="اكتب جزء من الاسم..."
                  className="mb-1.5 w-full rounded-lg border px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <select
                  value={formPersonId}
                  onChange={(e) => setFormPersonId(Number(e.target.value))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {filteredModalPersons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {agencyMap.get(p.agencyId)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium">الفئة</label>
                <select
                  value={formCategory}
                  onChange={(e) =>
                    setFormCategory(e.target.value as RelationCategory)
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {RELATION_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium">
                  الملاحظة أو الموضوع
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="اكتب التفاصيل أو سبب التذكير..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              {formCategory === 'reminder' && (
                <div>
                  <label className="mb-1 block font-medium">تاريخ التذكير</label>
                  <input
                    type="date"
                    value={formReminderDate}
                    onChange={(e) => setFormReminderDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              )}

              {formCategory === 'delivery_notes' && (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block font-medium">موقع السكن / الخط</label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="مثال: حي الحسين - قرب المدرسة"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block font-medium">رقم التواصل</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="0770..."
                        className="w-full rounded-lg border px-3 py-2 text-left text-sm tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium">التوقيت المناسب</label>
                      <input
                        type="text"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        placeholder="صباحاً 9-12"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border px-4 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg px-4 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>حفظ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
