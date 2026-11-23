import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Columns3,
  Download,
  Edit3,
  EyeOff,
  Plus,
  Printer,
  Redo2,
  Search,
  ShieldAlert,
  Undo2,
} from 'lucide-react';
import type {
  Agency,
  BlockScope,
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
  normalizeArabic,
} from '../utils/agencyLogic';
import { formatPeriodDateYMD, resolvePeriodMeta } from '../utils/archiveLogic';
import {
  exportFormattedRosterToPdf,
  exportRosterToExcel,
} from '../utils/excelExport';
import { runAsyncExportTask } from '../hooks/useToastQueue';
import type { ModeCapabilities } from '../utils/modePermissions';
import { resolveSectionTableHeader } from '../utils/relationMeta';
import { ColumnCustomizerPanel } from './ColumnCustomizerPanel';
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
  onBulkDeletePersons?: (personIds: number[]) => void;
  onBulkUpdateStatusAndCategory?: (
    personIds: number[],
    patch: {
      blockType?: BlockScope;
      blockedIndividuals?: number;
      blockReason?: string;
      customCategory?: string;
    }
  ) => void;
  onCreateReadyListFromSelection?: (params: {
    name: string;
    personIds: number[];
  }) => { listId: number; addedCount: number } | void;
  columnCustomizerOpen?: boolean;
  onColumnCustomizerOpenChange?: (open: boolean) => void;
  onEnableExpertModeForCustomizer?: () => void;
  externalTableCommand?: import('../types/assistant').AssistantExternalTableCommand | null;
  onFocusedPersonChange?: (personId: number | null) => void;
}

const CORE_COLUMN_DEFS: Array<{ id: string; defaultLabel: string }> = [
  { id: 'serial', defaultLabel: '#' },
  { id: 'letter', defaultLabel: 'الحرف' },
  { id: 'name', defaultLabel: 'الاسم' },
  { id: 'agency', defaultLabel: 'الوكالة' },
  { id: 'category', defaultLabel: 'الفئة' },
  { id: 'individuals', defaultLabel: 'الأفراد' },
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
  onBulkDeletePersons,
  onBulkUpdateStatusAndCategory,
  onCreateReadyListFromSelection,
  columnCustomizerOpen,
  onColumnCustomizerOpenChange,
  onEnableExpertModeForCustomizer,
  externalTableCommand,
  onFocusedPersonChange,
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
  const [localExpertPanelOpen, setLocalExpertPanelOpen] = useState(false);
  const [expertInlineEdit, setExpertInlineEdit] = useState(false);

  const showExpertPanel =
    columnCustomizerOpen !== undefined
      ? columnCustomizerOpen
      : localExpertPanelOpen;
  const setShowExpertPanel = (
    updater: boolean | ((prev: boolean) => boolean)
  ) => {
    const next =
      typeof updater === 'function' ? updater(showExpertPanel) : updater;
    setLocalExpertPanelOpen(next);
    onColumnCustomizerOpenChange?.(next);
  };

  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedPersonIds([]);
    setFocusedRowId(null);
  }, [agencyId]);

  useEffect(() => {
    if (!externalTableCommand) return;
    if (
      externalTableCommand.agencyId !== null &&
      externalTableCommand.agencyId !== agencyId
    ) {
      return;
    }
    if (externalTableCommand.searchQuery !== undefined) {
      setSearchQuery(externalTableCommand.searchQuery);
    }
    if (externalTableCommand.statusFilter !== undefined) {
      setStatusFilter(externalTableCommand.statusFilter);
    }
    if (externalTableCommand.sortBy !== undefined) {
      setSortBy(externalTableCommand.sortBy);
    }
    if (externalTableCommand.hideColumns && externalTableCommand.hideColumns.length > 0) {
      const hideSet = new Set(externalTableCommand.hideColumns);
      onUpdateExpertTableConfig({
        visibleColumns: expertTableConfig.visibleColumns.filter((c) => !hideSet.has(c)),
      });
    }
    if (externalTableCommand.showColumns && externalTableCommand.showColumns.length > 0) {
      onUpdateExpertTableConfig({
        visibleColumns: Array.from(
          new Set([...expertTableConfig.visibleColumns, ...externalTableCommand.showColumns])
        ),
      });
    }
    if (externalTableCommand.focusPersonId !== undefined) {
      const pid = externalTableCommand.focusPersonId;
      setFocusedRowId(pid);
      onFocusedPersonChange?.(pid);
      if (pid !== null) {
        window.setTimeout(() => {
          const rowEl = document.querySelector(`[data-row-key="${pid}"]`);
          if (rowEl instanceof HTMLElement) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    }
  }, [externalTableCommand]);

  // Disable Expert inline edit when leaving Expert mode
  useEffect(() => {
    if (!capabilities.isExpertMode) {
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

    if (!capabilities.canSortAndFilter && statusFilter === 'all') {
      // Beginner PDF-like view hides archived rows by default for clean reading
      list = list.filter((p) => p.status !== 'مؤرشف');
    }

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
        legacyQuantity: p.legacyQuantity,
        decreaseCount: p.decreaseCount,
        addOrDeleteCount: p.addOrDeleteCount,
        addOrDeleteAction: p.addOrDeleteAction,
        blockType: p.blockType,
        blockedIndividuals: p.blockedIndividuals,
        blockReason: p.blockReason,
        status: p.status,
        notes: p.notes,
        customCategory: p.customCategory,
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
    const pMeta = resolvePeriodMeta(headerMeta.periodMeta || activePeriod);
    const ff = headerMeta.freeformHeader;
    runAsyncExportTask(
      'جاري تجهيز ملف الطباعة / PDF بالعربية...',
      'تم تجهيز تقرير PDF للطباعة بنجاح.',
      () => {
        exportFormattedRosterToPdf({
          title: headerMeta.title,
          subtitle: headerMeta.subtitle,
          topCustomTitle: ff?.topCustomTitle,
          align: ff?.align || 'center',
          metaLine: `التاريخ: ${formatPeriodDateYMD(pMeta.fullDate)} · ${pMeta.monthName} (شهر ${pMeta.monthNumber}) · ${pMeta.quotaName} (${pMeta.quotaNumber})`,
          persons: visiblePersons,
          agencies,
          settings: calculationSettings,
          hideAgencyColumn: agencyId !== null,
          themeId: themePrefs.appTheme,
        });
      }
    );
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

  const handleInlinePatchRow = (
    rowKey: string,
    patch: CoreRosterInlinePatch
  ) => {
    const person = personByIdMap.get(rowKey);
    if (!person) return;
    onInlineUpdatePerson(person.id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.individuals !== undefined
        ? { individuals: patch.individuals }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.customCategory !== undefined
        ? { customCategory: patch.customCategory }
        : {}),
      ...(patch.customFields !== undefined
        ? {
            customFields: {
              ...(person.customFields || {}),
              ...patch.customFields,
            },
          }
        : {}),
    });
  };

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

  const focusActive =
    themePrefs.activeRowFocusMode && focusedRowId !== null;

  const effectivePeriodMeta = headerMeta.periodMeta || activePeriod;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 pb-24 sm:p-6 sm:pb-20">
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

      {/* Section Header Bar */}
      <div
        className="tabrix-card flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 sm:p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex min-w-[260px] flex-1 flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <ArrowRight className="h-4 w-4" style={{ color: 'var(--accent)' }} />
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
                runAsyncExportTask(
                  'جاري تصدير ملف Excel...',
                  'تم تصدير ملف Excel بنجاح.',
                  () =>
                    exportRosterToExcel({
                      filename: title,
                      persons: visiblePersons,
                      agencies,
                      settings: calculationSettings,
                    })
                )
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
      {showExpertPanel && (
        capabilities.isExpertMode ? (
          <ColumnCustomizerPanel
            expertTableConfig={expertTableConfig}
            allColumns={allCustomizableColumns}
            selectedPersonIds={selectedPersonIds}
            onUpdateExpertTableConfig={onUpdateExpertTableConfig}
            onAddExpertCustomColumn={onAddExpertCustomColumn}
            onRemoveExpertCustomColumn={onRemoveExpertCustomColumn}
            onResetExpertTableConfig={onResetExpertTableConfig}
            onBulkUpdateCategory={onBulkUpdateCategory}
          />
        ) : (
          <section
            aria-label="تخصيص الأعمدة يتطلب وضع الخبير"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
            }}
          >
            <div>
              <div className="text-sm font-bold">
                استوديو تخصيص الأعمدة والترتيب الحر متاح في «وضع الخبير»
              </div>
              <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                قم بالتبديل إلى وضع الخبير لفتح السحب والإفلات، الترتيب بالأرقام (1..N)، تثبيت الأعمدة، والقوالب الجاهزة.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onEnableExpertModeForCustomizer && (
                <button
                  type="button"
                  onClick={onEnableExpertModeForCustomizer}
                  className="min-h-[38px] rounded-xl px-4 py-2 font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  تفعيل وضع الخبير الآن
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowExpertPanel(false)}
                className="min-h-[38px] rounded-xl border px-3 py-2 font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إغلاق
              </button>
            </div>
          </section>
        )
      )}

      {/* Intermediate+ Search, Filter, Sort Toolbar */}
      {capabilities.canSortAndFilter && (
        <div
          data-assistant-target="agency-roster-toolbar"
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
        customCategories={expertTableConfig.customCategories}
        canUndo={canUndo}
        onUndo={onUndo}
        onSelectAll={() =>
          setSelectedPersonIds(visiblePersons.map((p) => p.id))
        }
        onClearSelection={() => setSelectedPersonIds([])}
        onMoveToAgency={onMovePersonsToAgency}
        onAddToReadyList={onAddPersonsToReadyList}
        onUpsertRelation={onUpsertRelation}
        onBulkDeleteSelected={
          onBulkDeletePersons
            ? (records) => {
                const ids = records
                  .map((r) => r.personId)
                  .filter((id): id is number => id !== null);
                if (ids.length > 0) onBulkDeletePersons(ids);
              }
            : undefined
        }
        onBulkUpdateStatusAndCategory={onBulkUpdateStatusAndCategory}
        onCreateReadyListFromSelection={onCreateReadyListFromSelection}
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
        onFocusRow={(key) => {
          const nextId = key ? Number(key) : null;
          setFocusedRowId(nextId);
          onFocusedPersonChange?.(nextId);
        }}
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
