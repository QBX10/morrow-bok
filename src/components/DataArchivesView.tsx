import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  CalendarPlus,
  Check,
  Cloud,
  CloudUpload,
  Database,
  Download,
  FileSpreadsheet,
  Lock,
  Printer,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
import {
  Tabrix3DTiltSurface,
  TabrixPillIndicator,
  TabrixSubViewTransition,
} from './ui/TabrixMotionPrimitives';
import {
  TABRIX_POPOVER_VARIANTS,
  useTabrixDirection,
  useTabrixOrderedDirection,
} from '../utils/tabrixMotion';
import type {
  AuthUser,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
} from '../types/agency';
import {
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
  initialLetter,
} from '../utils/agencyLogic';
import {
  ARABIC_MONTH_NAMES,
  type ArchiveChangeFilter,
  filterArchivePersons,
  filterMonthlyArchives,
  formatPeriodDateYMD,
  prepareNextMonthRollover,
} from '../utils/archiveLogic';
import {
  exportFinancialReportToExcel,
  exportReadyListToExcel,
  exportRosterToExcel,
  resolveReadyListItemRecord,
} from '../utils/excelExport';
import type { ModeCapabilities } from '../utils/modePermissions';
import {
  exportArchiveToCloudJson,
  printArchiveRecordPdf,
} from '../utils/snippetExport';
import { SnippetExportModal } from './modals/SnippetExportModal';
import { PeriodHeaderBanner } from './PeriodHeaderBanner';
import {
  SelectionActionBar,
  type SelectablePersonRecord,
} from './SelectionActionBar';

interface DataArchivesViewProps {
  activePeriod: PeriodQuotaMeta;
  archives: MonthlyArchiveRecord[];
  capabilities: ModeCapabilities;
  authUser: AuthUser | null;
  onUpdateActivePeriod: (patch: Partial<PeriodQuotaMeta>) => void;
  onArchiveCurrentPeriod: (options: {
    label?: string;
    isClosed: boolean;
    archiveSource: 'manual' | 'auto';
  }) => MonthlyArchiveRecord;
  onStartNextMonthRollover: (options: {
    nextQuotaName?: string;
    nextQuotaNumber?: string;
    nextDate?: string;
    autoArchiveCurrent: boolean;
    resetNotesAndChanges: boolean;
  }) => void;
  onMarkArchiveCloudSynced: (archiveId: string) => void;
  onDeleteArchive: (archiveId: string) => void;
  onSyncServer: () => Promise<unknown>;
  onOpenAuth: () => void;
}

export const DataArchivesView: React.FC<DataArchivesViewProps> = ({
  activePeriod,
  archives,
  capabilities,
  authUser,
  onArchiveCurrentPeriod,
  onStartNextMonthRollover,
  onMarkArchiveCloudSynced,
  onDeleteArchive,
  onSyncServer,
  onOpenAuth,
}) => {
  const [openedArchiveId, setOpenedArchiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [syncingCloud, setSyncingCloud] = useState(false);

  // Archive browser filters
  const [archiveSearch, setArchiveSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
  const [quotaFilter, setQuotaFilter] = useState('');

  // Manual Archive Modal
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveLabelDraft, setArchiveLabelDraft] = useState('');
  const [archiveCloseDraft, setArchiveCloseDraft] = useState(true);

  // Rollover Modal (Next Month / Quota)
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const nextSuggestion = useMemo(
    () => prepareNextMonthRollover({ currentPeriod: activePeriod }),
    [activePeriod]
  );
  const [nextQuotaName, setNextQuotaName] = useState(nextSuggestion.quotaName);
  const [nextQuotaNumber, setNextQuotaNumber] = useState(
    nextSuggestion.quotaNumber
  );
  const [nextQuotaDate, setNextQuotaDate] = useState(nextSuggestion.fullDate);
  const [autoArchiveBeforeNext, setAutoArchiveBeforeNext] = useState(true);
  const [resetMonthlyChanges, setResetMonthlyChanges] = useState(true);

  // Inside opened archive state
  const [archiveTab, setArchiveTab] = useState<'persons' | 'lists' | 'finance'>(
    'persons'
  );
  const [rowSearch, setRowSearch] = useState('');
  const [rowAgencyFilter, setRowAgencyFilter] = useState<number | 'all'>('all');
  const [rowChangeFilter, setRowChangeFilter] =
    useState<ArchiveChangeFilter>('all');
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [quickSnippetRows, setQuickSnippetRows] = useState<
    SelectablePersonRecord[]
  >([]);
  const [openedArchivedListId, setOpenedArchivedListId] = useState<
    number | null
  >(null);

  const availableYears = useMemo(() => {
    const set = new Set<number>([activePeriod.year]);
    archives.forEach((a) => set.add(a.periodMeta.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [archives, activePeriod.year]);

  const filteredArchives = useMemo(
    () =>
      filterMonthlyArchives({
        archives,
        query: archiveSearch,
        yearFilter,
        monthFilter,
        quotaFilter,
      }),
    [archives, archiveSearch, yearFilter, monthFilter, quotaFilter]
  );

  const openedArchive = useMemo(
    () => archives.find((a) => a.id === openedArchiveId) || null,
    [archives, openedArchiveId]
  );

  const openedAgencyMap = useMemo(() => {
    if (!openedArchive) return new Map<number, string>();
    return new Map(openedArchive.agencies.map((a) => [a.id, a.name]));
  }, [openedArchive]);

  const filteredArchivePersons = useMemo(() => {
    if (!openedArchive) return [];
    return filterArchivePersons({
      persons: openedArchive.persons,
      periodMeta: openedArchive.periodMeta,
      query: rowSearch,
      agencyId: rowAgencyFilter,
      changeFilter: rowChangeFilter,
    });
  }, [openedArchive, rowSearch, rowAgencyFilter, rowChangeFilter]);

  const selectedRecords: SelectablePersonRecord[] = useMemo(() => {
    if (!openedArchive) return [];
    const idSet = new Set(selectedPersonIds);
    return filteredArchivePersons
      .filter((p) => idSet.has(p.id))
      .map((p) => ({
        selectionKey: `arch_p:${p.id}`,
        personId: p.id,
        name: p.name,
        agencyId: p.agencyId,
        agencyName: openedAgencyMap.get(p.agencyId) || '',
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
  }, [openedArchive, filteredArchivePersons, selectedPersonIds, openedAgencyMap]);

  const handleCloudSync = async (targetArchiveId?: string) => {
    setErrorMsg('');
    setNotice('');
    if (!authUser) {
      onOpenAuth();
      setNotice('يرجى تسجيل الدخول للمزامنة مع التخزين السحابي.');
      return;
    }
    try {
      setSyncingCloud(true);
      await onSyncServer();
      if (targetArchiveId) {
        onMarkArchiveCloudSynced(targetArchiveId);
      }
      setNotice('تمت مزامنة السجلات والأرشيف مع التخزين السحابي بنجاح.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذرت المزامنة السحابية.'
      );
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleOpenArchiveCard = (arch: MonthlyArchiveRecord) => {
    setOpenedArchiveId(arch.id);
    setArchiveTab('persons');
    setRowSearch('');
    setRowAgencyFilter('all');
    setRowChangeFilter('all');
    setSelectedPersonIds([]);
    setOpenedArchivedListId(arch.readyLists[0]?.id ?? null);
  };

  const handleCreateManualArchive = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = onArchiveCurrentPeriod({
      label: archiveLabelDraft.trim() || undefined,
      isClosed: archiveCloseDraft,
      archiveSource: 'manual',
    });
    setArchiveModalOpen(false);
    setArchiveLabelDraft('');
    setNotice(`تم حفظ وأرشفة «${saved.label}» بنجاح.`);
  };

  const handleConfirmRollover = (e: React.FormEvent) => {
    e.preventDefault();
    onStartNextMonthRollover({
      nextQuotaName,
      nextQuotaNumber,
      nextDate: nextQuotaDate,
      autoArchiveCurrent: autoArchiveBeforeNext,
      resetNotesAndChanges: resetMonthlyChanges,
    });
    setRolloverOpen(false);
    setNotice(
      `تم الانتقال إلى الفترة الجديدة بنجاح مع تأمين السجلات السابقة في الأرشيف.`
    );
  };

  const archiveViewKey = openedArchive ? `opened:${openedArchive.id}` : 'hub';
  const archiveViewDirection = useTabrixDirection(
    Boolean(openedArchive),
    (_prev, next) => (next ? 1 : -1)
  );
  const archiveSubTabDirection = useTabrixOrderedDirection(archiveTab, {
    persons: 0,
    lists: 1,
    finance: 2,
  });

  const activeArchivedList = openedArchive
    ? openedArchive.readyLists.find((l) => l.id === openedArchivedListId) ||
      openedArchive.readyLists[0] ||
      null
    : null;
  const archivedPersonMap = useMemo(
    () =>
      openedArchive
        ? new Map(openedArchive.persons.map((p) => [p.id, p]))
        : new Map(),
    [openedArchive]
  );
  const archivedListItems =
    openedArchive && activeArchivedList
      ? openedArchive.readyListItems.filter(
          (it) => it.listId === activeArchivedList.id
        )
      : [];

  return (
    <TabrixSubViewTransition
      viewKey={archiveViewKey}
      direction={archiveViewDirection}
      className="w-full"
    >
      {openedArchive ? (
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 pb-24 sm:p-6 sm:pb-20">
        {/* Top Action Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setOpenedArchiveId(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>العودة لسجل البيانات والأرشيف</span>
            </button>
            <div>
              <h1 className="text-lg font-bold sm:text-xl">
                {openedArchive.label}
              </h1>
              <div
                className="text-xs tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {openedArchive.isClosed ? 'نسخة مغلقة ومؤرشفة' : 'نسخة أرشيف مفتوحة'}{' '}
                · تم الحفظ: {formatPeriodDateYMD(openedArchive.createdAt)}
                {openedArchive.syncedToCloudAt
                  ? ` · متزامن سحابياً`
                  : ''}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => printArchiveRecordPdf(openedArchive)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>معاينة وطباعة PDF</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportRosterToExcel({
                  filename: openedArchive.label,
                  persons: filteredArchivePersons,
                  agencies: openedArchive.agencies,
                  settings: openedArchive.calculationSettings,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                exportArchiveToCloudJson(openedArchive);
                setNotice('تم تنزيل النسخة السحابية بصيغة JSON.');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Cloud className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>نسخة سحابية (JSON)</span>
            </button>

            <button
              type="button"
              disabled={syncingCloud}
              onClick={() => handleCloudSync(openedArchive.id)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <CloudUpload className="h-3.5 w-3.5" />
              <span>{syncingCloud ? 'جارٍ المزامنة...' : 'مزامنة سحابية'}</span>
            </button>
          </div>
        </div>

        {(notice || errorMsg) && (
          <div
            role="status"
            className="rounded-lg border px-4 py-2 text-xs font-bold"
            style={{
              backgroundColor: errorMsg
                ? 'var(--danger-bg)'
                : 'var(--success-bg)',
              borderColor: errorMsg ? 'var(--danger)' : 'var(--success)',
              color: errorMsg ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {errorMsg || notice}
          </div>
        )}

        {/* Historical Period & Designed Header */}
        <PeriodHeaderBanner
          periodMeta={openedArchive.periodMeta}
          freeformHeader={openedArchive.freeformHeader}
          readOnly={true}
        />

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tabrix3DTiltSurface className="p-3.5">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              العائلات المؤرشفة
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums">
              {openedArchive.summary.totalHouseholds}
            </div>
          </Tabrix3DTiltSurface>
          <Tabrix3DTiltSurface className="p-3.5">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              إجمالي الأفراد المستحقة
            </div>
            <div
              className="mt-1 text-lg font-bold tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {openedArchive.summary.totalIndividuals}
            </div>
          </Tabrix3DTiltSurface>
          <Tabrix3DTiltSurface className="p-3.5">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              إجمالي الكمية
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums">
              {formatTotalQuota(
                openedArchive.summary.totalKg,
                openedArchive.calculationSettings
              )}
            </div>
          </Tabrix3DTiltSurface>
          <Tabrix3DTiltSurface className="p-3.5">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              الإيرادات المؤرشفة
            </div>
            <div
              className="mt-1 text-lg font-bold tabular-nums"
              style={{ color: 'var(--success)' }}
            >
              {formatIqd(openedArchive.summary.totalRevenueIqd)}
            </div>
          </Tabrix3DTiltSurface>
        </div>

        {/* Sub-Tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl border p-1.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          {(
            [
              {
                id: 'persons',
                label: `جدول المستفيدين (${openedArchive.persons.length})`,
              },
              {
                id: 'lists',
                label: `القوائم الجاهزة (${openedArchive.readyLists.length})`,
              },
              {
                id: 'finance',
                label: `الملخص المالي (${openedArchive.expenses.length})`,
              },
            ] as const
          ).map((tab) => {
            const active = archiveTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setArchiveTab(tab.id)}
                className="relative rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors"
                style={{
                  color: active ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                {active && (
                  <TabrixPillIndicator
                    layoutId="archive-opened-subtab-pill"
                    className="rounded-lg"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <TabrixSubViewTransition
          viewKey={`arch-tab-${archiveTab}`}
          direction={archiveSubTabDirection}
        >
        {archiveTab === 'persons' && (
          <div className="space-y-3">
            {/* Instant Search & Smart Filters */}
            <div
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="relative min-w-[230px] flex-1">
                <Search
                  className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="search"
                  value={rowSearch}
                  onChange={(e) => setRowSearch(e.target.value)}
                  placeholder="بحث فوري بالاسم، الرقم، الملاحظة، أو رقم الحصة..."
                  aria-label="بحث فوري داخل السجل التاريخي"
                  className="w-full rounded-lg border py-1.5 pr-8 pl-3 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <select
                value={rowAgencyFilter}
                onChange={(e) =>
                  setRowAgencyFilter(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                aria-label="فلترة حسب الوكالة"
                className="rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="all">جميع الوكالات</option>
                {openedArchive.agencies.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name}
                  </option>
                ))}
              </select>

              <select
                value={rowChangeFilter}
                onChange={(e) =>
                  setRowChangeFilter(e.target.value as ArchiveChangeFilter)
                }
                aria-label="فلترة حسب حالة النزول والإضافة"
                className="rounded-lg border px-2.5 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="all">كل الحالات (نزول / إضافة / عادي)</option>
                <option value="active">النشطون فقط</option>
                <option value="decreased">حالات النزول / النقصان</option>
                <option value="added_or_deleted">حالات الإضافة / الحذف</option>
                <option value="partial_block">حظر جزئي</option>
                <option value="full_block">حظر كامل</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>

            {/* Selection Action Bar with Single/Multi Snippet Export */}
            <SelectionActionBar
              selectedRecords={selectedRecords}
              totalVisibleCount={filteredArchivePersons.length}
              agencies={openedArchive.agencies}
              readyLists={openedArchive.readyLists}
              relations={openedArchive.relations}
              calculationSettings={openedArchive.calculationSettings}
              tableTitle={openedArchive.label}
              tableDate={openedArchive.periodMeta.fullDate}
              periodMeta={openedArchive.periodMeta}
              freeformHeader={openedArchive.freeformHeader}
              readOnlyArchiveMode={true}
              onSelectAll={() =>
                setSelectedPersonIds(filteredArchivePersons.map((p) => p.id))
              }
              onClearSelection={() => setSelectedPersonIds([])}
              onMoveToAgency={() => {}}
              onAddToReadyList={() => 0}
              onUpsertRelation={() => {}}
            />

            {/* Formal Archive Table */}
            <div className="nexus-squircle overflow-x-auto p-2">
              <table className="agency-table nexus-slab-table w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
                    <th className="border-l px-2.5 py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label="تحديد جميع سجلات الأرشيف الظاهرة"
                        checked={
                          filteredArchivePersons.length > 0 &&
                          selectedPersonIds.length ===
                            filteredArchivePersons.length
                        }
                        onChange={(e) =>
                          setSelectedPersonIds(
                            e.target.checked
                              ? filteredArchivePersons.map((p) => p.id)
                              : []
                          )
                        }
                      />
                    </th>
                    <th className="border-l px-2.5 py-2.5 text-center">#</th>
                    <th className="border-l px-2.5 py-2.5 text-center">الحرف</th>
                    <th className="border-l px-3 py-2.5">الاسم</th>
                    <th className="border-l px-3 py-2.5">الوكالة</th>
                    <th className="border-l px-2.5 py-2.5 text-center">الأفراد</th>
                    <th className="border-l px-2.5 py-2.5 text-center">النزول</th>
                    <th className="border-l px-2.5 py-2.5 text-center">
                      إضافة/حذف
                    </th>
                    <th className="border-l px-3 py-2.5 text-center">الحصة</th>
                    <th className="border-l px-3 py-2.5 text-center">المبلغ</th>
                    <th className="border-l px-2.5 py-2.5 text-center">الحالة</th>
                    <th className="border-l px-3 py-2.5">الملاحظات</th>
                    <th className="px-2.5 py-2.5 text-center">قصاصة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArchivePersons.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-8 text-center text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        لا توجد سجلات مطابقة لمعايير البحث والفلترة في هذا الأرشيف.
                      </td>
                    </tr>
                  ) : (
                    filteredArchivePersons.map((p, idx) => {
                      const eff = getEffectiveAllocationForPerson(
                        p,
                        openedArchive.calculationSettings
                      );
                      const isSel = selectedPersonIds.includes(p.id);
                      const agName = openedAgencyMap.get(p.agencyId) || '—';
                      return (
                        <tr
                          key={p.id}
                          style={{
                            backgroundColor: isSel
                              ? 'var(--bg-nav-active)'
                              : undefined,
                          }}
                        >
                          <td className="border-l px-2.5 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSel}
                              aria-label={`تحديد ${p.name}`}
                              onChange={() =>
                                setSelectedPersonIds((curr) =>
                                  curr.includes(p.id)
                                    ? curr.filter((x) => x !== p.id)
                                    : [...curr, p.id]
                                )
                              }
                            />
                          </td>
                          <td className="border-l px-2.5 py-2 text-center tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="border-l px-2.5 py-2 text-center font-bold">
                            {initialLetter(p.name)}
                          </td>
                          <td className="border-l px-3 py-2 font-bold">
                            {p.name}
                          </td>
                          <td className="border-l px-3 py-2 text-xs">
                            {agName}
                          </td>
                          <td className="border-l px-2.5 py-2 text-center font-bold tabular-nums">
                            {eff.summary.scope === 'partial'
                              ? `${eff.eligibleIndividuals} من ${p.individuals ?? 0}`
                              : eff.eligibleIndividuals ?? 0}
                          </td>
                          <td className="border-l px-2.5 py-2 text-center tabular-nums">
                            {p.decreaseCount ?? 0}
                          </td>
                          <td className="border-l px-2.5 py-2 text-center text-xs font-semibold">
                            {p.addOrDeleteAction &&
                            p.addOrDeleteAction !== 'لا يوجد'
                              ? `${p.addOrDeleteAction} (${p.addOrDeleteCount ?? 0})`
                              : '—'}
                          </td>
                          <td className="border-l px-3 py-2 text-center tabular-nums">
                            {eff.quotaText}
                          </td>
                          <td className="border-l px-3 py-2 text-center font-bold tabular-nums">
                            {eff.priceText}
                          </td>
                          <td className="border-l px-2.5 py-2 text-center text-xs font-bold">
                            {eff.summary.shortLabel}
                          </td>
                          <td className="border-l px-3 py-2 text-xs">
                            {p.notes || '—'}
                          </td>
                          <td className="px-2.5 py-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setQuickSnippetRows([
                                  {
                                    selectionKey: `single:${p.id}`,
                                    personId: p.id,
                                    name: p.name,
                                    agencyId: p.agencyId,
                                    agencyName: agName,
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
                                  },
                                ])
                              }
                              aria-label={`تصدير قصاصة ${p.name}`}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold whitespace-nowrap hover:opacity-85"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent)',
                              }}
                            >
                              <Scissors className="h-3 w-3" />
                              <span>قصاصة</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {archiveTab === 'lists' && (
          <div className="space-y-4">
            {openedArchive.readyLists.length === 0 ? (
              <div
                className="rounded-xl border p-8 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                لا توجد قوائم جاهزة محفوظة ضمن هذا الشهر.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {openedArchive.readyLists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => setOpenedArchivedListId(list.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-bold"
                        style={{
                          backgroundColor:
                            activeArchivedList?.id === list.id
                              ? 'var(--accent)'
                              : 'var(--bg-surface)',
                          borderColor:
                            activeArchivedList?.id === list.id
                              ? 'var(--accent)'
                              : 'var(--border-color)',
                          color:
                            activeArchivedList?.id === list.id
                              ? 'var(--accent-fg)'
                              : 'var(--text-primary)',
                        }}
                      >
                        {list.name}
                      </button>
                    ))}
                  </div>
                  {activeArchivedList && (
                    <button
                      type="button"
                      onClick={() =>
                        exportReadyListToExcel({
                          list: activeArchivedList,
                          items: archivedListItems,
                          persons: openedArchive.persons,
                          settings: openedArchive.calculationSettings,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>تصدير القائمة Excel</span>
                    </button>
                  )}
                </div>

                {activeArchivedList && (
                  <div
                    className="overflow-x-auto rounded-xl border"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <table className="agency-table w-full text-right text-xs sm:text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
                          <th className="border-l px-2.5 py-2.5 text-center">#</th>
                          <th className="border-l px-3 py-2.5">الاسم</th>
                          <th className="border-l px-2.5 py-2.5 text-center">الأفراد</th>
                          <th className="border-l px-3 py-2.5 text-center">الحصة</th>
                          <th className="border-l px-3 py-2.5 text-center">المبلغ</th>
                          <th className="border-l px-2.5 py-2.5 text-center">الحالة</th>
                          <th className="px-3 py-2.5">الملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedListItems.map((it, idx) => {
                          const rec = resolveReadyListItemRecord(
                            it,
                            archivedPersonMap
                          );
                          const eff = getEffectiveAllocationForPerson(
                            rec,
                            openedArchive.calculationSettings
                          );
                          return (
                            <tr key={it.id}>
                              <td className="border-l px-2.5 py-2 text-center tabular-nums">
                                {idx + 1}
                              </td>
                              <td className="border-l px-3 py-2 font-bold">
                                {rec.name}
                              </td>
                              <td className="border-l px-2.5 py-2 text-center font-bold tabular-nums">
                                {eff.eligibleIndividuals ?? 0}
                              </td>
                              <td className="border-l px-3 py-2 text-center tabular-nums">
                                {eff.quotaText}
                              </td>
                              <td className="border-l px-3 py-2 text-center font-bold tabular-nums">
                                {eff.priceText}
                              </td>
                              <td className="border-l px-2.5 py-2 text-center text-xs font-bold">
                                {eff.summary.shortLabel}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {rec.notes || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {archiveTab === 'finance' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  exportFinancialReportToExcel({
                    agencyName: openedArchive.label,
                    persons: openedArchive.persons,
                    expenses: openedArchive.expenses,
                    settings: openedArchive.calculationSettings,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Download className="h-3.5 w-3.5" />
                <span>تصدير التقرير المالي المؤرشف</span>
              </button>
            </div>
            <div
              className="overflow-x-auto rounded-xl border"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <table className="agency-table w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
                    <th className="border-l px-3 py-2.5">#</th>
                    <th className="border-l px-3 py-2.5">التاريخ</th>
                    <th className="border-l px-3 py-2.5">الوكالة</th>
                    <th className="border-l px-3 py-2.5">التصنيف</th>
                    <th className="border-l px-3 py-2.5">البيان</th>
                    <th className="px-3 py-2.5 text-center">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {openedArchive.expenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        لا توجد مصاريف مسجلة في هذا الشهر.
                      </td>
                    </tr>
                  ) : (
                    openedArchive.expenses.map((exp, idx) => (
                      <tr key={exp.id}>
                        <td className="border-l px-3 py-2 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border-l px-3 py-2 tabular-nums">
                          {exp.occurredAt}
                        </td>
                        <td className="border-l px-3 py-2">
                          {openedAgencyMap.get(exp.agencyId) || '—'}
                        </td>
                        <td className="border-l px-3 py-2 font-semibold">
                          {exp.category === 'worker_wages'
                            ? 'أجور العمال'
                            : exp.category === 'packaging'
                              ? 'مستلزمات التعبئة'
                              : exp.category === 'hospitality'
                                ? 'ضيافة وطعام'
                                : exp.category === 'custom'
                                  ? exp.customCategoryLabel?.trim() || 'مصروفات خاصة'
                                  : 'صرفيات عامة'}
                        </td>
                        <td className="border-l px-3 py-2">{exp.description}</td>
                        <td className="px-3 py-2 text-center font-bold tabular-nums">
                          {formatIqd(exp.amountIqd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </TabrixSubViewTransition>

        <SnippetExportModal
          open={quickSnippetRows.length > 0}
          tableTitle={openedArchive.label}
          tableSubtitle="قصاصة تدقيق من السجل التاريخي المؤرشف"
          periodMeta={openedArchive.periodMeta}
          freeformHeader={openedArchive.freeformHeader}
          records={quickSnippetRows}
          settings={openedArchive.calculationSettings}
          onClose={() => setQuickSnippetRows([])}
        />
      </main>
    ) : (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 pb-24 sm:p-6 sm:pb-20">
      {/* Header */}
      <div className="nexus-squircle flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3.5 min-w-0">
          <NexusDuotoneIcon icon={Database} size="lg" className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold sm:text-xl">
              البيانات — الأرشفة الشهرية والسجلات التاريخية
            </h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
              احفظ وأغلق سجلات كل شهر وحصة بشكل مستقل، وانتقل لأشهر جديدة دون فقدان
              أو تداخل مع السجلات السابقة.
            </p>
          </div>
        </div>

        <div
          data-assistant-target="data-archives-actions"
          className="flex flex-wrap items-center gap-2 shrink-0"
        >
          <button
            type="button"
            disabled={syncingCloud}
            onClick={() => handleCloudSync()}
            className="nexus-pill-btn inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <CloudUpload className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>
              {syncingCloud
                ? 'جارٍ المزامنة...'
                : authUser
                ? 'مزامنة سحابية'
                : 'تسجيل للمزامنة السحابية'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setArchiveLabelDraft(
                `${activePeriod.monthName} ${activePeriod.year} — ${activePeriod.quotaName} (${activePeriod.quotaNumber})`
              );
              setArchiveCloseDraft(true);
              setArchiveModalOpen(true);
            }}
            className="nexus-pill-btn inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>حفظ وأرشفة الشهر الحالي</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNextQuotaName(nextSuggestion.quotaName);
              setNextQuotaNumber(nextSuggestion.quotaNumber);
              setNextQuotaDate(nextSuggestion.fullDate);
              setRolloverOpen(true);
            }}
            className="nexus-pill-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>بدء شهر / حصة جديدة</span>
          </button>
        </div>
      </div>

      {(notice || errorMsg) && (
        <div
          role="status"
          className="rounded-lg border px-4 py-2.5 text-xs font-bold"
          style={{
            backgroundColor: errorMsg ? 'var(--danger-bg)' : 'var(--success-bg)',
            borderColor: errorMsg ? 'var(--danger)' : 'var(--success)',
            color: errorMsg ? 'var(--danger)' : 'var(--success)',
          }}
        >
          {errorMsg || notice}
        </div>
      )}

      {/* Active Current Period Strip */}
      <PeriodHeaderBanner
        periodMeta={activePeriod}
        readOnly={true}
      />

      {/* Search & Historical Filter Bar */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border p-3.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="relative min-w-[230px] flex-1">
          <Search
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={archiveSearch}
            onChange={(e) => setArchiveSearch(e.target.value)}
            placeholder="بحث باسم الشهر، رقم الحصة، أو اسم مستفيد داخل السجلات المؤرشفة..."
            aria-label="بحث في الأرشيف الشهري"
            className="w-full rounded-lg border py-2 pr-8 pl-3 text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          />
        </div>

        <select
          value={yearFilter}
          onChange={(e) =>
            setYearFilter(
              e.target.value === 'all' ? 'all' : Number(e.target.value)
            )
          }
          aria-label="فلترة الأرشيف حسب السنة"
          className="rounded-lg border px-3 py-2 text-xs tabular-nums"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <option value="all">جميع السنوات</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>
              سنة {y}
            </option>
          ))}
        </select>

        <select
          value={monthFilter}
          onChange={(e) =>
            setMonthFilter(
              e.target.value === 'all' ? 'all' : Number(e.target.value)
            )
          }
          aria-label="فلترة الأرشيف حسب الشهر"
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <option value="all">جميع الأشهر</option>
          {Object.entries(ARABIC_MONTH_NAMES).map(([num, name]) => (
            <option key={num} value={num}>
              شهر {num} — {name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={quotaFilter}
          onChange={(e) => setQuotaFilter(e.target.value)}
          placeholder="رقم أو اسم الحصة..."
          aria-label="فلترة حسب رقم الحصة"
          className="w-40 rounded-lg border px-3 py-2 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        />
      </div>

      {/* Monthly Archive Cards Grid */}
      {filteredArchives.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="text-sm font-bold">
            لا توجد سجلات شهرية مطابقة للبحث الحالي
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            يمكنك حفظ نسخة مؤمنة من الشهر الحالي الآن أو مسح الفلاتر لعرض جميع
            الأشهر المؤرشفة.
          </p>
        </div>
      ) : (
        <section
          aria-label="بطاقات الأشهر والحصص المؤرشفة"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {filteredArchives.map((arch) => (
            <Tabrix3DTiltSurface
              as="article"
              key={arch.id}
              className="flex flex-col justify-between gap-4 p-5"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {arch.periodMeta.year} · شهر {arch.periodMeta.monthNumber}{' '}
                      ({arch.periodMeta.monthName}) · حصة رقم{' '}
                      {arch.periodMeta.quotaNumber}
                    </div>
                    <h2 className="text-base font-bold sm:text-lg">
                      {arch.label}
                    </h2>
                  </div>

                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold"
                    style={{
                      color: arch.isClosed
                        ? 'var(--success)'
                        : 'var(--accent)',
                    }}
                  >
                    {arch.isClosed && <Lock className="h-3 w-3" />}
                    <span>{arch.isClosed ? 'مغلق ومؤمن' : 'نسخة مفتوحة'}</span>
                  </span>
                </div>

                <div
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>
                    الحصة: {arch.periodMeta.quotaName}
                  </span>
                  <span>·</span>
                  <span>
                    تاريخ الحصة: {formatPeriodDateYMD(arch.periodMeta.quotaDate)}
                  </span>
                </div>

                <div
                  className="grid grid-cols-3 gap-2 border-t pt-3 text-xs tabular-nums"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>العائلات</div>
                    <div className="font-bold">
                      {arch.summary.totalHouseholds}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>الأفراد</div>
                    <div
                      className="font-bold"
                      style={{ color: 'var(--accent)' }}
                    >
                      {arch.summary.totalIndividuals}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>الإيرادات</div>
                    <div
                      className="font-bold"
                      style={{ color: 'var(--success)' }}
                    >
                      {formatIqd(arch.summary.totalRevenueIqd)}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <button
                  type="button"
                  onClick={() => handleOpenArchiveCard(arch)}
                  className="nexus-pill-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <span>فتح واستعراض الجدول</span>
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => printArchiveRecordPdf(arch)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportArchiveToCloudJson(arch)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Cloud className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>سحابي</span>
                  </button>

                  {capabilities.canEditRecords && (
                    <button
                      type="button"
                      onClick={() => onDeleteArchive(arch.id)}
                      aria-label={`حذف أرشيف ${arch.label}`}
                      className="rounded-lg border p-1.5 hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--danger)',
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </Tabrix3DTiltSurface>
          ))}
        </section>
      )}

      {/* Full-Screen Push Page 1: Archive Current Period */}
      <FullScreenPushPage
        open={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="حفظ وأرشفة الفترة الحالية"
        subtitle="إنشاء نسخة أرشيفية مؤمنة ومستقلة للحصة والشهر الحالي"
        icon={<Archive className="h-4 w-4" />}
        maxWidthClass="max-w-lg"
      >
        <div className="nexus-squircle p-5">
            <form onSubmit={handleCreateManualArchive} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold">
                  اسم نسخة الأرشيف
                </label>
                <input
                  type="text"
                  required
                  value={archiveLabelDraft}
                  onChange={(e) => setArchiveLabelDraft(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={archiveCloseDraft}
                  onChange={(e) => setArchiveCloseDraft(e.target.checked)}
                />
                <span>إغلاق الشهر واعتماده كنسخة نظامية ثابتة</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setArchiveModalOpen(false)}
                  className="nexus-pill-btn border px-4 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="nexus-pill-btn inline-flex items-center gap-1.5 px-5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>حفظ في البيانات</span>
                </button>
              </div>
            </form>
        </div>
      </FullScreenPushPage>

      {/* Full-Screen Push Page 2: Rollover to Next Month / Quota */}
      <FullScreenPushPage
        open={rolloverOpen}
        onClose={() => setRolloverOpen(false)}
        title="بدء شهر / حصة جديدة"
        subtitle="الانتقال إلى دورة التوزيع التالية مع حفظ السجلات الحالية في الأرشيف"
        icon={<CalendarPlus className="h-4 w-4" />}
        maxWidthClass="max-w-lg"
      >
        <div className="nexus-squircle p-5">
            <form onSubmit={handleConfirmRollover} className="space-y-3 text-xs">
              <p style={{ color: 'var(--text-muted)' }}>
                سيتم الانتقال للشهر التالي مع تأمين جميع سجلات شهر{' '}
                <strong>{activePeriod.monthName}</strong> الحالية في قسم البيانات
                دون أي تداخل.
              </p>

              <div>
                <label className="mb-1 block font-semibold">
                  اسم الحصة الجديدة
                </label>
                <input
                  type="text"
                  required
                  value={nextQuotaName}
                  onChange={(e) => setNextQuotaName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">رقم الحصة</label>
                  <input
                    type="text"
                    required
                    value={nextQuotaNumber}
                    onChange={(e) => setNextQuotaNumber(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">تاريخ البدء</label>
                  <input
                    type="date"
                    required
                    value={nextQuotaDate}
                    onChange={(e) => setNextQuotaDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={autoArchiveBeforeNext}
                  onChange={(e) => setAutoArchiveBeforeNext(e.target.checked)}
                />
                <span>حفظ وإغلاق بيانات الشهر الحالي تلقائياً قبل الانتقال</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={resetMonthlyChanges}
                  onChange={(e) => setResetMonthlyChanges(e.target.checked)}
                />
                <span>تصفير عدادات النزول والإضافة لبدء شهر نظيف</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRolloverOpen(false)}
                  className="nexus-pill-btn border px-4 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="nexus-pill-btn inline-flex items-center gap-1.5 px-5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>اعتماد والانتقال للشهر الجديد</span>
                </button>
              </div>
            </form>
        </div>
      </FullScreenPushPage>
    </main>
      )}
    </TabrixSubViewTransition>
  );
};
