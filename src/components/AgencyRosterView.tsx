import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Columns3,
  Download,
  Edit3,
  EyeOff,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
  Trash2,
  Undo2,
} from 'lucide-react';
import type {
  Agency,
  CalculationSettings,
  ExpertTableConfig,
  PeriodQuotaMeta,
  Person,
  ReadyList,
  RelationCategory,
  RelationEntry,
  SectionTableHeaderMeta,
  ThemePreferences,
} from '../types/agency';
import {
  auditAgencyPersons,
  getEffectiveAllocationForPerson,
  initialLetter,
  normalizeArabic,
} from '../utils/agencyLogic';
import { formatPeriodDateYMD, resolvePeriodMeta } from '../utils/archiveLogic';
import { exportRosterToExcel, printViaIframe } from '../utils/excelExport';
import type { ModeCapabilities } from '../utils/modePermissions';
import { moveExpertColumnInOrder } from '../utils/recycleBin';
import { resolveSectionTableHeader } from '../utils/relationMeta';
import {
  CoreRosterTable,
  type CoreRosterInlinePatch,
  type CoreRosterRow,
} from './CoreRosterTable';
import { PeriodHeaderBanner } from './PeriodHeaderBanner';
import {
  SelectionActionBar,
  type SelectablePersonRecord,
} from './SelectionActionBar';
import { TableHeaderEditor } from './TableHeaderEditor';

interface AgencyRosterViewProps {
  title: string;
  agencyId: number | null; // null = السجل الشامل
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  relations: RelationEntry[];
  tableHeaders: Record<string, SectionTableHeaderMeta>;
  activePeriod: PeriodQuotaMeta;
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  themePrefs: ThemePreferences;
  expertTableConfig: ExpertTableConfig;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onBackToHub: () => void;
  onUpdateTableHeaderMeta: (
    key: string,
    patch: Partial<SectionTableHeaderMeta>
  ) => void;
  onMovePersonsToAgency: (personIds: number[], targetAgencyId: number) => void;
  onAddPersonsToReadyList: (listId: number, personIds: number[]) => number;
  onUpsertRelation: (input: {
    personId: number;
    category: RelationCategory;
    note: string;
    reminderDate?: string;
    deliveryAddress?: string;
    deliveryPhone?: string;
    deliveryTime?: string;
  }) => void;
  onOpenAddPerson: (defaultAgencyId: number) => void;
  onOpenEditPerson: (person: Person) => void;
  onRequestDeletePerson: (person: Person) => void;
  onInlineUpdatePerson: (personId: number, patch: Partial<Person>) => void;
  onBulkUpdateCategory: (personIds: number[], customCategory: string) => void;
  onUpdateExpertTableConfig: (patch: Partial<ExpertTableConfig>) => void;
  onAddExpertCustomColumn: (input: { label: string; type: 'text' | 'number' }) => void;
  onRemoveExpertCustomColumn: (colId: string) => void;
  onResetExpertTableConfig: () => void;
  onOpenSettings: () => void;
}

const CORE_COLUMN_DEFS: Array<{ id: string; defaultLabel: string }> = [
  { id: 'serial', defaultLabel: '#' },
  { id: 'letter', defaultLabel: 'الحرف' },
  { id: 'name', defaultLabel: 'الاسم' },
  { id: 'agency', defaultLabel: 'الوكالة' },
  { id: 'category', defaultLabel: 'الفئة' },
  { id: 'individuals', defaultLabel: 'الأنفار' },
  { id: 'quantity', defaultLabel: 'الحصة' },
  { id: 'price', defaultLabel: 'المبلغ' },
  { id: 'status', defaultLabel: 'الحالة' },
  { id: 'notes', defaultLabel: 'الملاحظات' },
];

export const AgencyRosterView: React.FC<AgencyRosterViewProps> = ({
  title,
  agencyId,
  agencies,
  persons,
  readyLists,
  relations,
  tableHeaders,
  activePeriod,
  calculationSettings,
  capabilities,
  themePrefs,
  expertTableConfig,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onBackToHub,
  onUpdateTableHeaderMeta,
  onMovePersonsToAgency,
  onAddPersonsToReadyList,
  onUpsertRelation,
  onOpenAddPerson,
  onOpenEditPerson,
  onRequestDeletePerson,
  onInlineUpdatePerson,
  onBulkUpdateCategory,
  onUpdateExpertTableConfig,
  onAddExpertCustomColumn,
  onRemoveExpertCustomColumn,
  onResetExpertTableConfig,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'blocked' | 'archived'
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'default' | 'name_asc' | 'individuals_desc'
  >('default');
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [showExpertPanel, setShowExpertPanel] = useState(false);
  const [expertInlineEdit, setExpertInlineEdit] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number'>('text');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [bulkCategoryValue, setBulkCategoryValue] = useState('');

  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedPersonIds([]);
    setFocusedRowId(null);
  }, [agencyId]);

  // Disable Expert inline/panel controls immediately when leaving Expert mode
  useEffect(() => {
    if (!capabilities.isExpertMode) {
      setShowExpertPanel(false);
      setExpertInlineEdit(false);
    }
  }, [capabilities.isExpertMode]);

  const headerKey = agencyId !== null ? `agency:${agencyId}` : 'master_roster';
  const headerMeta = useMemo(
    () =>
      resolveSectionTableHeader({
        key: headerKey,
        tableHeaders,
        fallbackTitle: title,
        fallbackSubtitle:
          agencyId === null ? 'سجل موحّد يشمل جميع الوكالات' : undefined,
      }),
    [headerKey, tableHeaders, title, agencyId]
  );

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  const scopedPersons = useMemo(() => {
    if (agencyId === null) return persons;
    return persons.filter((p) => p.agencyId === agencyId);
  }, [persons, agencyId]);

  const visiblePersons = useMemo(() => {
    let list = scopedPersons;

    if (capabilities.canSortAndFilter) {
      const qNorm = normalizeArabic(searchQuery);
      if (qNorm) {
        list = list.filter(
          (p) =>
            normalizeArabic(p.name).includes(qNorm) ||
            p.nationalId.includes(searchQuery.trim()) ||
            normalizeArabic(p.customCategory || '').includes(qNorm)
        );
      }

      if (statusFilter === 'active') {
        list = list.filter(
          (p) => p.status === '' && p.blockType !== 'full'
        );
      } else if (statusFilter === 'blocked') {
        list = list.filter(
          (p) =>
            p.status === 'محجوب' ||
            p.blockType === 'full' ||
            p.blockType === 'partial'
        );
      } else if (statusFilter === 'archived') {
        list = list.filter(
          (p) => p.status === 'مؤرشف' || p.blockType === 'archived'
        );
      }

      if (capabilities.isExpertMode && categoryFilter !== 'all') {
        list = list.filter(
          (p) => (p.customCategory || '') === categoryFilter
        );
      }

      if (sortBy === 'name_asc') {
        list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      } else if (sortBy === 'individuals_desc') {
        list = [...list].sort(
          (a, b) => (b.individuals ?? 0) - (a.individuals ?? 0)
        );
      }
    } else {
      // Beginner PDF-like view hides archived rows for clean reading
      list = list.filter((p) => p.status !== 'مؤرشف');
    }

    return list;
  }, [
    scopedPersons,
    capabilities.canSortAndFilter,
    capabilities.isExpertMode,
    searchQuery,
    statusFilter,
    categoryFilter,
    sortBy,
  ]);

  const auditIssues = useMemo(() => {
    if (!capabilities.canUseSmartAudit) return [];
    return auditAgencyPersons(scopedPersons);
  }, [capabilities.canUseSmartAudit, scopedPersons]);

  const selectedRecords: SelectablePersonRecord[] = useMemo(() => {
    const idSet = new Set(selectedPersonIds);
    return visiblePersons
      .filter((p) => idSet.has(p.id))
      .map((p) => ({
        selectionKey: `person:${p.id}`,
        personId: p.id,
        name: p.name,
        agencyId: p.agencyId,
        agencyName: agencyMap.get(p.agencyId) || '',
        nationalId: p.nationalId,
        individuals: p.individuals,
        decreaseCount: p.decreaseCount,
        addOrDeleteCount: p.addOrDeleteCount,
        addOrDeleteAction: p.addOrDeleteAction,
        blockType: p.blockType,
        blockedIndividuals: p.blockedIndividuals,
        blockReason: p.blockReason,
        status: p.status,
        notes: p.notes,
        updatedAt: p.updatedAt,
      }));
  }, [visiblePersons, selectedPersonIds, agencyMap]);

  const toggleSelectPerson = (personId: number) => {
    setSelectedPersonIds((curr) =>
      curr.includes(personId)
        ? curr.filter((x) => x !== personId)
        : [...curr, personId]
    );
  };

  const handlePrintPdfView = () => {
    const rowsHtml = visiblePersons
      .map((p, idx) => {
        const eff = getEffectiveAllocationForPerson(p, calculationSettings);
        const indLabel =
          eff.summary.scope === 'partial'
            ? `${eff.eligibleIndividuals} من ${p.individuals ?? 0}`
            : String(eff.eligibleIndividuals ?? 0);
        return `<tr>
          <td>${idx + 1}</td>
          <td>${initialLetter(p.name)}</td>
          <td style="text-align:right">${p.name}</td>
          ${agencyId === null ? `<td>${agencyMap.get(p.agencyId) || ''}</td>` : ''}
          <td>${indLabel}</td>
          <td>${eff.quotaText}</td>
          <td>${eff.priceText}</td>
          <td>${eff.summary.shortLabel}</td>
          <td>${p.notes || ''}</td>
        </tr>`;
      })
      .join('');

    const pMeta = resolvePeriodMeta(headerMeta.periodMeta || activePeriod);
    const ff = headerMeta.freeformHeader;
    printViaIframe(`<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /><title>${headerMeta.title}</title>
<style>
  body { font-family: Cairo, Tahoma, Arial, sans-serif; padding: 18px; color: #0f172a; }
  .head { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; text-align: ${ff?.align || 'center'}; }
  .top { font-size: 13px; font-weight: bold; color: #1d4ed8; margin-bottom: 4px; }
  h1 { font-size: 19px; margin: 0 0 6px; }
  .meta { font-size: 12px; color: #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: center; }
  th { background: #e2e8f0; }
</style>
</head>
<body>
  <div class="head">
    ${ff?.topCustomTitle ? `<div class="top">${ff.topCustomTitle}</div>` : ''}
    <h1>${headerMeta.title}</h1>
    <div class="meta">التاريخ: ${formatPeriodDateYMD(pMeta.fullDate)} · ${pMeta.monthName} (شهر ${pMeta.monthNumber}) · ${pMeta.quotaName} (${pMeta.quotaNumber})</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>الحرف</th><th>الاسم</th>
        ${agencyId === null ? '<th>الوكالة</th>' : ''}
        <th>الأنفار</th><th>الحصة</th><th>المبلغ</th><th>الحالة</th><th>الملاحظات</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`);
  };

  const coreTableRows: CoreRosterRow[] = useMemo(
    () =>
      visiblePersons.map((p) => ({
        rowKey: String(p.id),
        selectionId: String(p.id),
        agencyId: p.agencyId,
        agencyName: agencyMap.get(p.agencyId) || '—',
        name: p.name,
        nationalId: p.nationalId,
        individuals: p.individuals,
        legacyQuantity: p.legacyQuantity,
        blockType: p.blockType,
        blockedIndividuals: p.blockedIndividuals,
        blockReason: p.blockReason,
        status: p.status,
        notes: p.notes,
        customCategory: p.customCategory,
        customFields: p.customFields,
      })),
    [visiblePersons, agencyMap]
  );

  const personByIdMap = useMemo(
    () => new Map(visiblePersons.map((p) => [String(p.id), p])),
    [visiblePersons]
  );

  const allCustomizableColumns = useMemo(() => {
    const baseMap = new Map(
      CORE_COLUMN_DEFS.map((c) => [c.id, c.defaultLabel])
    );
    for (const c of expertTableConfig.customColumns) {
      baseMap.set(c.id, c.label);
    }
    const ordered = Array.from(
      new Set([...expertTableConfig.columnOrder, ...baseMap.keys()])
    ).filter((id) => baseMap.has(id));
    return ordered.map((id) => ({
      id,
      defaultLabel: baseMap.get(id) || id,
      isCustom: id.startsWith('custom_'),
    }));
  }, [expertTableConfig]);

  const handleToggleColumnVisible = (colId: string) => {
    const visible = new Set(expertTableConfig.visibleColumns);
    if (visible.has(colId)) {
      if (visible.size <= 1) return;
      visible.delete(colId);
    } else {
      visible.add(colId);
    }
    onUpdateExpertTableConfig({ visibleColumns: Array.from(visible) });
  };

  const handleInlinePatchRow = (
    rowKey: string,
    patch: CoreRosterInlinePatch
  ) => {
    const personId = Number(rowKey);
    if (!Number.isFinite(personId)) return;
    onInlineUpdatePerson(personId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.individuals !== undefined
        ? { individuals: patch.individuals }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.customCategory !== undefined
        ? { customCategory: patch.customCategory }
        : {}),
      ...(patch.customFields !== undefined
        ? { customFields: patch.customFields }
        : {}),
    });
  };

  const focusActive =
    themePrefs.activeRowFocusMode && focusedRowId !== null;

  const effectivePeriodMeta = headerMeta.periodMeta || activePeriod;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 sm:p-6">
      {/* Period, Quota & Freeform Designed Header Banner */}
      <PeriodHeaderBanner
        periodMeta={effectivePeriodMeta}
        fallbackPeriod={activePeriod}
        freeformHeader={headerMeta.freeformHeader}
        onSavePeriodAndHeader={({ periodMeta, freeformHeader }) =>
          onUpdateTableHeaderMeta(headerKey, {
            periodMeta,
            freeformHeader,
            date: periodMeta.fullDate,
          })
        }
      />

      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-[280px] flex-1 flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>العودة للوكالات</span>
          </button>

          <div className="min-w-[200px] flex-1">
            <TableHeaderEditor
              meta={headerMeta}
              onSaveMeta={(patch) => onUpdateTableHeaderMeta(headerKey, patch)}
              subtitleSuffix={`${visiblePersons.length} سجل · ${
                capabilities.isReadOnlyPdfView
                  ? 'عرض بسيط للقراءة (كملف PDF)'
                  : capabilities.isExpertMode
                  ? 'وضع الخبير (تحكم مطلق)'
                  : capabilities.canEditRecords
                  ? 'المحرر مفعّل'
                  : 'وضع القراءة'
              }`}
            />
          </div>
        </div>

        {/* Progressive Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {focusActive && (
            <button
              type="button"
              onClick={() => setFocusedRowId(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>إلغاء التركيز</span>
            </button>
          )}

          {capabilities.isReadOnlyPdfView && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              تبديل الوضع / تفعيل المحرر
            </button>
          )}

          {capabilities.canSortAndFilter && (
            <button
              type="button"
              onClick={handlePrintPdfView}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة / PDF</span>
            </button>
          )}

          {capabilities.canUseExcelTools && (
            <button
              type="button"
              onClick={() =>
                exportRosterToExcel({
                  filename: title,
                  persons: visiblePersons,
                  agencies,
                  settings: calculationSettings,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير Excel</span>
            </button>
          )}

          {capabilities.canUseSmartAudit && (
            <button
              type="button"
              onClick={() => setShowAuditPanel((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor:
                  auditIssues.length > 0
                    ? 'var(--warning)'
                    : 'var(--border-color)',
                color:
                  auditIssues.length > 0
                    ? 'var(--warning)'
                    : 'var(--text-primary)',
              }}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>التدقيق الذكي ({auditIssues.length})</span>
            </button>
          )}

          {/* Expert-Only Unrestricted Freedom Drawer Toggle */}
          {capabilities.isExpertMode && (
            <>
              <button
                type="button"
                onClick={() => setExpertInlineEdit((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: expertInlineEdit
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-surface)',
                  borderColor: expertInlineEdit
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                  color: expertInlineEdit
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
                }}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>
                  {expertInlineEdit
                    ? 'إيقاف التحرير داخل الجدول'
                    : 'تحرير مباشر داخل الجدول'}
                </span>
              </button>

              <button
                type="button"
                aria-expanded={showExpertPanel}
                onClick={() => setShowExpertPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: showExpertPanel
                    ? 'var(--accent)'
                    : 'var(--bg-nav-active)',
                  borderColor: 'var(--accent)',
                  color: showExpertPanel ? 'var(--accent-fg)' : 'var(--accent)',
                }}
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span>تخصيص الجدول (الخبير)</span>
              </button>
            </>
          )}

          {capabilities.canEditRecords && (
            <>
              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                aria-label="تراجع عن آخر تعديل"
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap disabled:opacity-35"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <Undo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>تراجع</span>
              </button>

              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedo}
                aria-label="إعادة التعديل"
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap disabled:opacity-35"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <Redo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>إعادة</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenAddPerson(agencyId ?? agencies[0]?.id ?? 1)
                }
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة سجل</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expert Mode Exclusive Customization Panel */}
      {capabilities.isExpertMode && showExpertPanel && (
        <section
          aria-label="أدوات الوضع الخبير لتخصيص الجدول والفئات"
          className="space-y-4 rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <div>
                <h2 className="text-sm font-bold">
                  أدوات الوضع الخبير — حرية مطلقة في تخصيص الجدول والفئات
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  إظهار وإخفاء الأعمدة، إعادة ترتيبها، تغيير مسمياتها، وإضافة أعمدة وفئات مخصصة.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <input
                  type="checkbox"
                  checked={expertTableConfig.allowDirectNoConfirmEdit}
                  onChange={(e) =>
                    onUpdateExpertTableConfig({
                      allowDirectNoConfirmEdit: e.target.checked,
                    })
                  }
                />
                <span>حفظ التعديلات مباشرة بدون نافذة تأكيد</span>
              </label>

              <button
                type="button"
                onClick={onResetExpertTableConfig}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>إعادة ضبط الأعمدة</span>
              </button>
            </div>
          </div>

          {/* Columns Visibility, Ordering & Label Editing */}
          <div className="space-y-2">
            <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              إدارة الأعمدة (الظهور · الترتيب · التسمية):
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {allCustomizableColumns.map((col, idx) => {
                const isVisible = expertTableConfig.visibleColumns.includes(col.id);
                const labelVal =
                  expertTableConfig.columnLabels[col.id] ?? col.defaultLabel;
                return (
                  <div
                    key={col.id}
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: isVisible
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      aria-label={`إظهار عمود ${col.defaultLabel}`}
                      onChange={() => handleToggleColumnVisible(col.id)}
                    />
                    <input
                      type="text"
                      value={labelVal}
                      aria-label={`تسمية عمود ${col.defaultLabel}`}
                      onChange={(e) =>
                        onUpdateExpertTableConfig({
                          columnLabels: {
                            ...expertTableConfig.columnLabels,
                            [col.id]: e.target.value,
                          },
                        })
                      }
                      className="min-w-0 flex-1 rounded border px-2 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <button
                      type="button"
                      disabled={idx === 0}
                      aria-label={`نقل عمود ${col.defaultLabel} لليمين`}
                      onClick={() =>
                        onUpdateExpertTableConfig(
                          moveExpertColumnInOrder(
                            {
                              ...expertTableConfig,
                              columnOrder: allCustomizableColumns.map(
                                (c) => c.id
                              ),
                            },
                            col.id,
                            'right'
                          )
                        )
                      }
                      className="rounded border p-1 disabled:opacity-30"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === allCustomizableColumns.length - 1}
                      aria-label={`نقل عمود ${col.defaultLabel} لليسار`}
                      onClick={() =>
                        onUpdateExpertTableConfig(
                          moveExpertColumnInOrder(
                            {
                              ...expertTableConfig,
                              columnOrder: allCustomizableColumns.map(
                                (c) => c.id
                              ),
                            },
                            col.id,
                            'left'
                          )
                        )
                      }
                      className="rounded border p-1 disabled:opacity-30"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    {col.isCustom && (
                      <button
                        type="button"
                        aria-label={`حذف عمود ${col.defaultLabel}`}
                        onClick={() => onRemoveExpertCustomColumn(col.id)}
                        className="rounded border p-1"
                        style={{
                          borderColor: 'var(--danger)',
                          color: 'var(--danger)',
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Custom Column + Manage Custom Categories */}
          <div className="grid grid-cols-1 gap-4 border-t pt-3 lg:grid-cols-2" style={{ borderColor: 'var(--border-color)' }}>
            {/* Add Custom Column */}
            <div className="space-y-2 text-xs">
              <div className="font-bold">إضافة عمود مخصص جديد للجدول:</div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="اسم العمود (مثال: المنطقة / الهاتف)"
                  className="min-w-[170px] flex-1 rounded-lg border px-2.5 py-1.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <select
                  value={newColType}
                  onChange={(e) =>
                    setNewColType(e.target.value as 'text' | 'number')
                  }
                  className="rounded-lg border px-2.5 py-1.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="text">نص</option>
                  <option value="number">رقم</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!newColLabel.trim()) return;
                    onAddExpertCustomColumn({
                      label: newColLabel.trim(),
                      type: newColType,
                    });
                    setNewColLabel('');
                  }}
                  className="rounded-lg px-3 py-1.5 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  + إضافة عمود
                </button>
              </div>
            </div>

            {/* Manage Categories & Bulk Category Assignment */}
            <div className="space-y-2 text-xs">
              <div className="font-bold">إدارة الفئات المخصصة وتطبيقها:</div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="اسم فئة جديدة (مثال: خط أ، مستعجل)..."
                  className="min-w-[170px] flex-1 rounded-lg border px-2.5 py-1.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = newCategoryName.trim();
                    if (!clean) return;
                    if (!expertTableConfig.customCategories.includes(clean)) {
                      onUpdateExpertTableConfig({
                        customCategories: [
                          ...expertTableConfig.customCategories,
                          clean,
                        ],
                        visibleColumns: expertTableConfig.visibleColumns.includes(
                          'category'
                        )
                          ? expertTableConfig.visibleColumns
                          : [...expertTableConfig.visibleColumns, 'category'],
                      });
                    }
                    setNewCategoryName('');
                  }}
                  className="rounded-lg px-3 py-1.5 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  + إضافة فئة
                </button>
              </div>

              {selectedPersonIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Tag className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span className="font-semibold">
                    تعيين فئة للمحدد ({selectedPersonIds.length}):
                  </span>
                  <select
                    value={bulkCategoryValue}
                    onChange={(e) => setBulkCategoryValue(e.target.value)}
                    className="rounded border px-2 py-1"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <option value="">بدون فئة</option>
                    {expertTableConfig.customCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      onBulkUpdateCategory(selectedPersonIds, bulkCategoryValue)
                    }
                    className="rounded-lg px-3 py-1 font-bold"
                    style={{
                      backgroundColor: 'var(--success)',
                      color: 'var(--success-fg)',
                    }}
                  >
                    تطبيق على المحدد
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Intermediate+ Search, Filter, Sort Toolbar */}
      {capabilities.canSortAndFilter && (
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
              placeholder="بحث بالاسم أو رقم البطاقة..."
              aria-label="بحث بالاسم أو رقم البطاقة"
              className="w-full rounded-lg border py-1.5 pr-8 pl-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'active' | 'blocked' | 'archived'
              )
            }
            aria-label="فلترة حسب الحالة"
            className="rounded-lg border px-2.5 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <option value="all">جميع الحالات</option>
            <option value="active">النشطون فقط</option>
            <option value="blocked">المحجوبون (كلي/جزئي)</option>
            <option value="archived">المؤرشفون</option>
          </select>

          {capabilities.isExpertMode &&
            expertTableConfig.customCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="فلترة حسب الفئة المخصصة"
                className="rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="all">جميع الفئات</option>
                {expertTableConfig.customCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as 'default' | 'name_asc' | 'individuals_desc'
              )
            }
            aria-label="ترتيب الجدول"
            className="rounded-lg border px-2.5 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <option value="default">الترتيب الافتراضي</option>
            <option value="name_asc">أبجديًا (أ - ي)</option>
            <option value="individuals_desc">الأكثر أفرادًا</option>
          </select>
        </div>
      )}

      {/* Expert Smart Audit Panel */}
      {showAuditPanel && capabilities.canUseSmartAudit && (
        <section
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--warning)',
          }}
        >
          <div
            className="mb-2 flex items-center gap-2 text-xs font-bold"
            style={{ color: 'var(--warning)' }}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>نتائج التدقيق الذكي ({auditIssues.length} ملاحظة)</span>
          </div>
          {auditIssues.length === 0 ? (
            <div className="text-xs" style={{ color: 'var(--success)' }}>
              سجل الوكالة سليم تمامًا ولا توجد أخطاء أو تكرارات.
            </div>
          ) : (
            <ul className="space-y-1 text-xs">
              {auditIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    <strong>{issue.personName}</strong> — {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Sleek Top Selection Action Bar */}
      <SelectionActionBar
        selectedRecords={selectedRecords}
        totalVisibleCount={visiblePersons.length}
        agencies={agencies}
        readyLists={readyLists}
        relations={relations}
        calculationSettings={calculationSettings}
        tableTitle={headerMeta.title}
        tableDate={headerMeta.date}
        periodMeta={effectivePeriodMeta}
        freeformHeader={headerMeta.freeformHeader}
        onSelectAll={() =>
          setSelectedPersonIds(visiblePersons.map((p) => p.id))
        }
        onClearSelection={() => setSelectedPersonIds([])}
        onMoveToAgency={onMovePersonsToAgency}
        onAddToReadyList={onAddPersonsToReadyList}
        onUpsertRelation={onUpsertRelation}
      />

      {/* Shared Core Spreadsheet Table */}
      <CoreRosterTable
        rows={coreTableRows}
        selectedIds={selectedPersonIds.map(String)}
        focusedRowKey={focusedRowId !== null ? String(focusedRowId) : null}
        calculationSettings={calculationSettings}
        themePrefs={themePrefs}
        expertTableConfig={
          capabilities.canCustomizeColumns ? expertTableConfig : undefined
        }
        showAgencyColumn={agencyId === null}
        showEditActions={capabilities.canEditRecords}
        editableInline={capabilities.isExpertMode && expertInlineEdit}
        onToggleSelectRow={(selId) => toggleSelectPerson(Number(selId))}
        onToggleSelectAll={(checked) =>
          setSelectedPersonIds(checked ? visiblePersons.map((p) => p.id) : [])
        }
        onFocusRow={(key) => setFocusedRowId(key ? Number(key) : null)}
        onEditRowModal={(row) => {
          const person = personByIdMap.get(row.rowKey);
          if (person) onOpenEditPerson(person);
        }}
        onDeleteRowModal={(row) => {
          const person = personByIdMap.get(row.rowKey);
          if (person) onRequestDeletePerson(person);
        }}
        onInlinePatchRow={handleInlinePatchRow}
      />
    </main>
  );
};
