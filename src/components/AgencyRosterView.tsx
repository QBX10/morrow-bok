import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  Edit3,
  Eye,
  EyeOff,
  Lock,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_SUBVIEW_VARIANTS,
} from '../utils/tabrixMotion';
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
  getEffectiveAllocationForPerson,
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
import {
  SelectionActionBar,
  type SelectablePersonRecord,
} from './SelectionActionBar';
import { LedgerActionsDrawer } from './roster/LedgerActionsDrawer';
import { SmartAttachedTableHeader } from './roster/SmartAttachedTableHeader';
import { ViewingModeHeader } from './roster/ViewingModeHeader';

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
  viewingMode?: boolean;
  onViewingModeChange?: (active: boolean) => void;
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
  viewingMode,
  onViewingModeChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [normalSearchOpen, setNormalSearchOpen] = useState(false);
  const normalSearchInputRef = useRef<HTMLInputElement | null>(null);

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
  const [rowEditorMode, setRowEditorMode] = useState(false);

  // Viewing Mode & Smart Auto-Lock state
  const [localViewingMode, setLocalViewingMode] = useState(false);
  const isViewingMode =
    viewingMode !== undefined ? viewingMode : localViewingMode;
  const [isTableLocked, setIsTableLocked] = useState(false);
  const [lockShakeNonce, setLockShakeNonce] = useState(0);
  const [lockHintNotice, setLockHintNotice] = useState('');
  const lockNoticeTimerRef = useRef<number | null>(null);

  const [actionsDrawerOpen, setActionsDrawerOpen] = useState(false);
  const [headerCustomizerOpen, setHeaderCustomizerOpen] = useState(false);

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
    if (normalSearchOpen) {
      window.setTimeout(() => normalSearchInputRef.current?.focus(), 40);
    }
  }, [normalSearchOpen]);

  useEffect(() => {
    return () => {
      if (lockNoticeTimerRef.current) {
        window.clearTimeout(lockNoticeTimerRef.current);
      }
    };
  }, []);

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
      if (externalTableCommand.searchQuery) setNormalSearchOpen(true);
    }
    if (externalTableCommand.statusFilter !== undefined) {
      setStatusFilter(externalTableCommand.statusFilter);
    }
    if (externalTableCommand.sortBy !== undefined) {
      setSortBy(externalTableCommand.sortBy);
    }
    if (
      externalTableCommand.hideColumns &&
      externalTableCommand.hideColumns.length > 0
    ) {
      const hideSet = new Set(externalTableCommand.hideColumns);
      onUpdateExpertTableConfig({
        visibleColumns: expertTableConfig.visibleColumns.filter(
          (c) => !hideSet.has(c)
        ),
      });
    }
    if (
      externalTableCommand.showColumns &&
      externalTableCommand.showColumns.length > 0
    ) {
      onUpdateExpertTableConfig({
        visibleColumns: Array.from(
          new Set([
            ...expertTableConfig.visibleColumns,
            ...externalTableCommand.showColumns,
          ])
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

  // Disable editor modes if read-only permission turns on
  useEffect(() => {
    if (!capabilities.canEditRecords) {
      setRowEditorMode(false);
      setExpertInlineEdit(false);
    }
  }, [capabilities.canEditRecords]);

  const setViewingModeState = (next: boolean) => {
    setLocalViewingMode(next);
    onViewingModeChange?.(next);
    if (next) {
      // Auto-lock immediately upon entering Viewing Mode
      setIsTableLocked(true);
      setRowEditorMode(false);
      setExpertInlineEdit(false);
      setHeaderCustomizerOpen(false);
      setLockHintNotice('');
    } else {
      // Restore normal interactive state when exiting Viewing Mode
      setIsTableLocked(false);
      setLockHintNotice('');
    }
  };

  const handleToggleLock = () => {
    setIsTableLocked((prev) => {
      const next = !prev;
      if (next) {
        setRowEditorMode(false);
        setExpertInlineEdit(false);
        setHeaderCustomizerOpen(false);
      } else {
        setLockHintNotice('');
      }
      return next;
    });
  };

  const handleLockedInteraction = () => {
    setLockShakeNonce((n) => n + 1);
    setLockHintNotice(
      'الجدول مقفل للقراءة الآمنة — انقر «فتح القفل» للتحديد أو التعديل.'
    );
    if (lockNoticeTimerRef.current) {
      window.clearTimeout(lockNoticeTimerRef.current);
    }
    lockNoticeTimerRef.current = window.setTimeout(() => {
      setLockHintNotice('');
    }, 2800);
  };

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

  const currentAgencyName = useMemo(() => {
    if (agencyId === null) return 'جميع الوكالات (السجل الشامل)';
    return agencyMap.get(agencyId) || title;
  }, [agencyId, agencyMap, title]);

  const scopedPersons = useMemo(() => {
    if (agencyId === null) return persons;
    return persons.filter((p) => p.agencyId === agencyId);
  }, [persons, agencyId]);

  const visiblePersons = useMemo(() => {
    let list = scopedPersons;

    if (!capabilities.canSortAndFilter && statusFilter === 'all') {
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
    if (isTableLocked) {
      handleLockedInteraction();
      return;
    }
    setSelectedPersonIds((curr) =>
      curr.includes(personId)
        ? curr.filter((x) => x !== personId)
        : [...curr, personId]
    );
  };

  const effectivePeriodMeta = headerMeta.periodMeta || activePeriod;

  const handlePrintPdfView = () => {
    const pMeta = resolvePeriodMeta(effectivePeriodMeta);
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

  const handleExportExcel = () => {
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

  const focusedPerson = useMemo(
    () =>
      focusedRowId !== null
        ? personByIdMap.get(String(focusedRowId)) || null
        : null,
    [focusedRowId, personByIdMap]
  );

  const focusedPersonEff = useMemo(
    () =>
      focusedPerson
        ? getEffectiveAllocationForPerson(focusedPerson, calculationSettings)
        : null,
    [focusedPerson, calculationSettings]
  );

  const handleInlinePatchRow = (
    rowKey: string,
    patch: CoreRosterInlinePatch
  ) => {
    if (isTableLocked) {
      handleLockedInteraction();
      return;
    }
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

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      statusFilter !== 'all' ||
      categoryFilter !== 'all' ||
      sortBy !== 'default'
  );

  const resetAllFilters = () => {
    setSearchQuery('');
    setNormalSearchOpen(false);
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortBy('default');
  };

  // Contextual Editor Column rule:
  // Hidden during calm normal reading; shown ONLY when explicitly enabled (rowEditorMode or expertInlineEdit) & unlocked.
  const showEditorColumn =
    capabilities.canEditRecords &&
    !isTableLocked &&
    (rowEditorMode || (capabilities.isExpertMode && expertInlineEdit));

  // Contextual single-row quick action bar when a user taps a specific row/name while unlocked
  const showFocusedRowQuickBar =
    !isTableLocked && focusedPerson !== null && !showEditorColumn;

  const attachedHeaderElement = (
    <SmartAttachedTableHeader
      headerMeta={headerMeta}
      periodMeta={effectivePeriodMeta}
      fallbackPeriod={activePeriod}
      agencyId={agencyId}
      agencyName={currentAgencyName}
      recordCount={visiblePersons.length}
      locked={isTableLocked}
      customizerOpen={headerCustomizerOpen}
      onCustomizerOpenChange={setHeaderCustomizerOpen}
      onSaveHeader={(patch) => onUpdateTableHeaderMeta(headerKey, patch)}
    />
  );

  return (
    <>
      {isViewingMode && (
        <ViewingModeHeader
          title={headerMeta.title}
          recordCount={visiblePersons.length}
          hasActiveFilters={hasActiveFilters}
          isTableLocked={isTableLocked}
          lockShakeNonce={lockShakeNonce}
          canSearch={capabilities.canSortAndFilter}
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          onToggleLock={handleToggleLock}
          onOpenDrawer={() => setActionsDrawerOpen(true)}
          onExitViewingMode={() => setViewingModeState(false)}
        />
      )}

      <main
        className={
          isViewingMode
            ? 'mx-auto w-full max-w-7xl flex-1 space-y-3 px-3 py-3 pb-16 sm:px-5 sm:py-4'
            : 'mx-auto w-full max-w-6xl flex-1 space-y-3 p-4 pb-24 sm:p-6 sm:pb-20'
        }
      >
        {/* Slim, Calm Normal Reading Control Bar */}
        {!isViewingMode && (
          <div
            data-assistant-target="agency-roster-toolbar"
            className="no-print nexus-glass-lite flex flex-wrap items-center justify-between gap-2 rounded-3xl border px-3.5 py-2.5 shadow-sm"
          >
            {/* Right (RTL Start): Back + Table Options Hamburger + Contextual Status */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={onBackToHub}
                className="nexus-pill-btn inline-flex min-h-[36px] h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ArrowRight
                  className="h-3.5 w-3.5"
                  style={{ color: 'var(--accent)' }}
                />
                <span className="hidden sm:inline">الوكالات</span>
              </button>

              <button
                type="button"
                data-testid="ledger-actions-menu-btn"
                onClick={() => setActionsDrawerOpen(true)}
                aria-label="خيارات وأدوات الجدول"
                className="nexus-pill-btn relative inline-flex min-h-[36px] h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Menu className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>أدوات الجدول</span>
                {hasActiveFilters && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                  />
                )}
              </button>

              <AnimatePresence>
                {capabilities.canSortAndFilter && normalSearchOpen && (
                  <motion.div
                    key="roster-normal-search"
                    variants={TABRIX_POPOVER_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="relative flex min-w-[180px] flex-1 max-w-sm items-center"
                  >
                    <Search
                      className="pointer-events-none absolute right-2.5 h-3.5 w-3.5"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <input
                      ref={normalSearchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearchQuery('');
                          setNormalSearchOpen(false);
                        }
                      }}
                      placeholder="بحث بالاسم أو البطاقة..."
                      aria-label="بحث بالاسم أو رقم البطاقة"
                      className="h-9 w-full rounded-xl border pr-8 pl-8 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--accent)',
                      }}
                    />
                    <button
                      type="button"
                      aria-label="إغلاق البحث"
                      onClick={() => {
                        setSearchQuery('');
                        setNormalSearchOpen(false);
                      }}
                      className="absolute left-2 rounded p-1 hover:opacity-75"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Left (RTL End): On-Demand Search + Lock + Viewing Mode + Primary Add CTA */}
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {capabilities.canSortAndFilter && !normalSearchOpen && (
                <button
                  type="button"
                  data-testid="roster-search-expand-btn"
                  onClick={() => setNormalSearchOpen(true)}
                  aria-label="فتح البحث"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: searchQuery
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: searchQuery
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: searchQuery ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  <Search className="h-4 w-4" />
                </button>
              )}

              <button
                key={`norm-lock-${isTableLocked ? '1' : '0'}-${lockShakeNonce}`}
                type="button"
                data-testid="roster-lock-toggle-btn"
                onClick={handleToggleLock}
                aria-pressed={isTableLocked}
                title={
                  isTableLocked
                    ? 'الجدول مقفل للقراءة الآمنة — انقر لفتح القفل'
                    : 'قفل الجدول لمنع التعديل أو اللمس بالخطأ'
                }
                className={`${
                  lockShakeNonce > 0 && isTableLocked
                    ? 'lock-shake-hint'
                    : 'lock-toggle-spring'
                } inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap`}
                style={{
                  backgroundColor: isTableLocked
                    ? 'var(--warning-bg)'
                    : 'var(--bg-main)',
                  borderColor: isTableLocked
                    ? 'var(--warning)'
                    : 'var(--border-color)',
                  color: isTableLocked ? 'var(--warning)' : 'var(--text-primary)',
                }}
              >
                {isTableLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">مقفل</span>
                  </>
                ) : (
                  <>
                    <Unlock
                      className="h-3.5 w-3.5"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span className="hidden sm:inline">قفل</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="enter-viewing-mode-btn"
                onClick={() => setViewingModeState(true)}
                className="nexus-pill-btn inline-flex min-h-[36px] h-9 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>وضع المشاهدة</span>
              </button>

              {capabilities.canEditRecords && !isTableLocked && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenAddPerson(agencyId ?? agencies[0]?.id ?? 1)
                  }
                  className="nexus-pill-btn inline-flex min-h-[36px] h-9 items-center gap-1 px-3.5 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة سجل</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Filter / Editor Mode Status Pills (Shown ONLY when active) */}
        <AnimatePresence>
          {(hasActiveFilters || showEditorColumn) && (
            <motion.div
              key="roster-active-filter-pills"
              variants={TABRIX_POPOVER_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="no-print flex flex-wrap items-center justify-between gap-2 text-[11px]"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {showEditorColumn && (
                  <button
                    type="button"
                    onClick={() => {
                      setRowEditorMode(false);
                      setExpertInlineEdit(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>وضع التحرير نشط · إغلاق</span>
                    <X className="h-3 w-3" />
                  </button>
                )}

                {statusFilter !== 'all' && (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    الحالة:{' '}
                    {statusFilter === 'active'
                      ? 'النشطون'
                      : statusFilter === 'blocked'
                      ? 'المحجوبون'
                      : 'المؤرشفون'}
                  </span>
                )}

                {categoryFilter !== 'all' && (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    الفئة: {categoryFilter}
                  </span>
                )}

                {sortBy !== 'default' && (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    الفرز:{' '}
                    {sortBy === 'name_asc' ? 'أبجديًا' : 'الأكثر أفرادًا'}
                  </span>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--accent)',
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>إعادة ضبط الفلاتر</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Locked Reading Feedback Hint */}
        <AnimatePresence>
          {lockHintNotice && (
            <motion.div
              key="roster-lock-hint"
              variants={TABRIX_POPOVER_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              role="status"
              data-testid="locked-table-hint"
              className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)',
                color: 'var(--warning)',
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>{lockHintNotice}</span>
              </span>
              <button
                type="button"
                onClick={handleToggleLock}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                style={{
                  backgroundColor: 'var(--warning)',
                  color: '#ffffff',
                }}
              >
                <Unlock className="h-3 w-3" />
                <span>فتح القفل الآن</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table Column Customizer Studio */}
        <AnimatePresence>
          {showExpertPanel && (
            <motion.div
              key="roster-column-customizer"
              variants={TABRIX_SUBVIEW_VARIANTS}
              custom={1}
              initial="initial"
              animate="animate"
              exit="exit"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expert Smart Audit Panel */}
        <AnimatePresence>
          {showAuditPanel && capabilities.canUseSmartAudit && (
            <motion.section
              key="roster-smart-audit"
              variants={TABRIX_SUBVIEW_VARIANTS}
              custom={1}
              initial="initial"
              animate="animate"
              exit="exit"
              className="nexus-squircle p-4 sm:p-5"
              style={{
                borderColor: 'var(--warning)',
              }}
            >
              <div
                className="mb-2 flex items-center justify-between gap-2 text-xs font-bold"
                style={{ color: 'var(--warning)' }}
              >
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>نتائج التدقيق الذكي ({auditIssues.length} ملاحظة)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAuditPanel(false)}
                  className="rounded p-1 hover:opacity-75"
                  aria-label="إغلاق التدقيق"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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
            </motion.section>
          )}
        </AnimatePresence>

        {/* Contextual Single-Row Quick Actions (Appears ONLY on tapping a row while unlocked) */}
        <AnimatePresence>
          {showFocusedRowQuickBar && focusedPerson && (
            <motion.section
              key={`row-quick-bar-${focusedPerson.id}`}
              variants={TABRIX_POPOVER_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              data-testid="contextual-row-actions-bar"
              aria-label="إجراءات السطر المحدد"
              className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs shadow-sm"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--accent)',
              }}
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-extrabold truncate max-w-[220px]">
                  {focusedPerson.name}
                </span>
                {focusedPersonEff && (
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {focusedPersonEff.eligibleIndividuals ?? 0} أفراد ·{' '}
                    {focusedPersonEff.quotaText} · {focusedPersonEff.priceText}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {capabilities.canEditRecords && (
                  <>
                    <button
                      type="button"
                      data-testid="row-quick-edit-btn"
                      onClick={() => onOpenEditPerson(focusedPerson)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      data-testid="row-quick-delete-btn"
                      onClick={() => onRequestDeletePerson(focusedPerson)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => toggleSelectPerson(focusedPerson.id)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold"
                  style={{
                    backgroundColor: selectedPersonIds.includes(focusedPerson.id)
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: selectedPersonIds.includes(focusedPerson.id)
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: selectedPersonIds.includes(focusedPerson.id)
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                  }}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>
                    {selectedPersonIds.includes(focusedPerson.id)
                      ? 'إلغاء من المحددين'
                      : 'تحديد للإجراءات'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFocusedRowId(null);
                    onFocusedPersonChange?.(null);
                  }}
                  aria-label="إغلاق إجراءات السطر"
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {themePrefs.activeRowFocusMode ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>إلغاء التركيز</span>
                    </>
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Multi-Selection Action Bar (Hidden when locked) */}
        {!isTableLocked && (
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
        )}

        {/* Unified Table Card = Smart Attached Header + Core Roster Table */}
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
          showEditActions={showEditorColumn}
          editableInline={capabilities.isExpertMode && expertInlineEdit}
          locked={isTableLocked}
          onLockedInteraction={handleLockedInteraction}
          attachedHeader={attachedHeaderElement}
          allowRowFocusOnClick
          onToggleSelectRow={(selId) => toggleSelectPerson(Number(selId))}
          onToggleSelectAll={(checked) => {
            if (isTableLocked) {
              handleLockedInteraction();
              return;
            }
            setSelectedPersonIds(
              checked ? visiblePersons.map((p) => p.id) : []
            );
          }}
          onFocusRow={(key) => {
            if (isTableLocked) {
              handleLockedInteraction();
              return;
            }
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

      {/* Dedicated Table Options & Tools Hamburger Drawer */}
      <LedgerActionsDrawer
        open={actionsDrawerOpen}
        onClose={() => setActionsDrawerOpen(false)}
        title={headerMeta.title}
        recordCount={visiblePersons.length}
        capabilities={capabilities}
        viewingMode={isViewingMode}
        onToggleViewingMode={setViewingModeState}
        isTableLocked={isTableLocked}
        onToggleLock={handleToggleLock}
        rowEditorMode={rowEditorMode}
        onToggleRowEditorMode={() => setRowEditorMode((v) => !v)}
        expertInlineEdit={expertInlineEdit}
        onToggleExpertInlineEdit={() => setExpertInlineEdit((v) => !v)}
        statusFilter={statusFilter}
        onChangeStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        onChangeCategoryFilter={setCategoryFilter}
        customCategories={expertTableConfig.customCategories}
        sortBy={sortBy}
        onChangeSortBy={setSortBy}
        onResetFilters={resetAllFilters}
        hasActiveFilters={hasActiveFilters}
        showColumnCustomizer={showExpertPanel}
        onToggleColumnCustomizer={() => setShowExpertPanel((v) => !v)}
        showAuditPanel={showAuditPanel}
        auditIssuesCount={auditIssues.length}
        onToggleAuditPanel={() => setShowAuditPanel((v) => !v)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onAddPerson={() => onOpenAddPerson(agencyId ?? agencies[0]?.id ?? 1)}
        onOpenHeaderCustomizer={() => setHeaderCustomizerOpen(true)}
        onExportExcel={handleExportExcel}
        onPrintPdf={handlePrintPdfView}
        onOpenSettings={onOpenSettings}
        onBackToHub={onBackToHub}
      />
    </>
  );
};
