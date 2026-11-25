import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  Edit3,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Plus,
  Printer,
  Redo2,
  Search,
  Share2,
  ShieldAlert,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_PUSH_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../utils/tabrixMotion';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
import { MotionSurfaceCard } from './ui/TabrixMotionPrimitives';
import type {
  Agency,
  BlockScope,
  CalculationSettings,
  FreeformHeaderConfig,
  PeriodQuotaMeta,
  Person,
  ReadyList,
  ReadyListItem,
  RelationCategory,
  RelationEntry,
  RelationsReadyListsPrefs,
  ThemePreferences,
} from '../types/agency';
import {
  auditAgencyPersons,
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
  initialLetter,
  normalizeArabic,
} from '../utils/agencyLogic';
import {
  buildReadyListShareText,
  exportReadyListToExcel,
  exportReadyListToImage,
  exportReadyListToTextFile,
  printViaIframe,
  resolveReadyListItemRecord,
} from '../utils/excelExport';
import { escapeHtml, getExportMemoryFlags } from '../utils/exportFormatting';
import { runAsyncExportTask } from '../hooks/useToastQueue';
import type { ModeCapabilities } from '../utils/modePermissions';
import { AddReadyListMembersModal } from './modals/AddReadyListMembersModal';
import { PeriodHeaderBanner } from './PeriodHeaderBanner';
import {
  SelectionActionBar,
  type SelectablePersonRecord,
} from './SelectionActionBar';
import { useDelayedLoading } from '../utils/delayedLoader';

interface ReadyListsViewProps {
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  readyListItems: ReadyListItem[];
  relations: RelationEntry[];
  activePeriod: PeriodQuotaMeta;
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  themePrefs: ThemePreferences;
  relationsPrefs?: RelationsReadyListsPrefs;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCreateReadyList: (input: {
    agencyId: number;
    name: string;
    listDate?: string;
    subtitle1?: string;
    subtitle2?: string;
    autoUpdateDate?: boolean;
    populateFromAgency?: boolean;
  }) => number;
  onUpdateListMetaConfirmed: (
    listId: number,
    patch: {
      name?: string;
      listDate?: string;
      subtitle1?: string;
      subtitle2?: string;
      autoUpdateDate?: boolean;
      periodMeta?: PeriodQuotaMeta;
      freeformHeader?: FreeformHeaderConfig;
    }
  ) => void;
  onRequestDeleteList: (list: ReadyList) => void;
  onAddReadyListItemDirect: (input: {
    listId: number;
    name: string;
    nationalId?: string;
    individuals: number | null;
    notes: string;
  }) => void;
  onAddPersonsToReadyList: (
    listId: number,
    personIds: number[],
    overrideNotesMap?: Record<number, string>
  ) => number;
  onMoveItemOrder: (itemId: number, direction: 'up' | 'down') => void;
  onUpdateItemConfirmed: (
    itemId: number,
    patch: {
      name?: string;
      nationalId?: string;
      individuals?: number | null;
      blockType?: BlockScope;
      blockedIndividuals?: number;
      blockReason?: string;
      notes?: string;
    }
  ) => void;
  onRequestDeleteItem: (item: ReadyListItem) => void;
  onBulkDeleteItems?: (itemIds: number[]) => void;
  onMovePersonsToAgency: (personIds: number[], targetAgencyId: number) => void;
  onUpsertRelation: (input: {
    personId: number;
    category: RelationCategory;
    note: string;
    reminderDate?: string;
    deliveryAddress?: string;
    deliveryPhone?: string;
    deliveryTime?: string;
  }) => void;
}

export const ReadyListsView: React.FC<ReadyListsViewProps> = ({
  agencies,
  persons,
  readyLists,
  readyListItems,
  relations,
  activePeriod,
  calculationSettings,
  capabilities,
  themePrefs,
  relationsPrefs,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCreateReadyList,
  onUpdateListMetaConfirmed,
  onRequestDeleteList,
  onAddReadyListItemDirect,
  onAddPersonsToReadyList,
  onMoveItemOrder,
  onUpdateItemConfirmed,
  onRequestDeleteItem,
  onBulkDeleteItems,
  onMovePersonsToAgency,
  onUpsertRelation,
}) => {
  const [openedListId, setOpenedListId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Create List form state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [newListAgencyId, setNewListAgencyId] = useState(
    agencies[0]?.id ?? 1
  );
  const [newListName, setNewListName] = useState('');
  const [newListDate, setNewListDate] = useState(todayStr);
  const [newSubtitle1, setNewSubtitle1] = useState('');
  const [newSubtitle2, setNewSubtitle2] = useState('');
  const [newAutoUpdateDate, setNewAutoUpdateDate] = useState(
    relationsPrefs?.autoUpdateReadyListDate ?? true
  );
  const [newPopulateFromAgency, setNewPopulateFromAgency] = useState(true);

  // Full-screen table controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'blocked' | 'archived'
  >('all');
  const [sortBy, setSortBy] = useState<
    'default' | 'name_asc' | 'individuals_desc'
  >('default');
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<number | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [dualPickerOpen, setDualPickerOpen] = useState(false);

  // Share / Export status & modal
  const [sharePreviewText, setSharePreviewText] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState('');
  const [exportingImage, setExportingImage] = useState(false);
  useDelayedLoading(exportingImage, 'جاري تجهيز وتصدير القائمة...');

  // Edit List Meta Modal (with confirmation per Editor rules)
  const [editingMetaOpen, setEditingMetaOpen] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDate, setMetaDate] = useState('');
  const [metaSub1, setMetaSub1] = useState('');
  const [metaSub2, setMetaSub2] = useState('');
  const [metaAutoUpdateDate, setMetaAutoUpdateDate] = useState(true);
  const [confirmMetaStep, setConfirmMetaStep] = useState(false);

  // Add Item Modal (direct per Editor rules)
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNid, setAddNid] = useState('');
  const [addInd, setAddInd] = useState('4');
  const [addNotes, setAddNotes] = useState('');

  // Edit Item Modal (with confirmation per Editor rules)
  const [editingItem, setEditingItem] = useState<ReadyListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editNid, setEditNid] = useState('');
  const [editInd, setEditInd] = useState('');
  const [editBlockType, setEditBlockType] = useState<BlockScope>('none');
  const [editBlockedInd, setEditBlockedInd] = useState('0');
  const [editBlockReason, setEditBlockReason] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [confirmEditStep, setConfirmEditStep] = useState(false);

  const personMap = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons]
  );

  // Reset full-screen view if the opened list is removed (e.g., deleted or undone)
  useEffect(() => {
    if (
      openedListId !== null &&
      !readyLists.some((l) => l.id === openedListId)
    ) {
      setOpenedListId(null);
    }
  }, [openedListId, readyLists]);

  useEffect(() => {
    if (!exportNotice) return;
    const t = setTimeout(() => setExportNotice(''), 3500);
    return () => clearTimeout(t);
  }, [exportNotice]);

  const activeList = useMemo(
    () => readyLists.find((l) => l.id === openedListId) || null,
    [readyLists, openedListId]
  );

  useEffect(() => {
    document.title = activeList
      ? `${activeList.name} — القوائم الجاهزة — Morrow`
      : 'القوائم الجاهزة — Morrow';
    return () => {
      document.title = 'Morrow';
    };
  }, [activeList]);

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  const resolvedActiveRows = useMemo(() => {
    if (!activeList) return [];
    return readyListItems
      .filter((it) => it.listId === activeList.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        item,
        rec: resolveReadyListItemRecord(item, personMap),
      }));
  }, [activeList, readyListItems, personMap]);

  const existingSourcePersonIds = useMemo(
    () =>
      new Set(
        resolvedActiveRows
          .map((r) => r.item.sourcePersonId)
          .filter((id): id is number => id !== null)
      ),
    [resolvedActiveRows]
  );

  const visibleRows = useMemo(() => {
    let rows = resolvedActiveRows;
    if (capabilities.canSortAndFilter) {
      const qNorm = normalizeArabic(searchQuery);
      if (qNorm) {
        rows = rows.filter(
          ({ rec }) =>
            normalizeArabic(rec.name).includes(qNorm) ||
            rec.nationalId.includes(searchQuery.trim())
        );
      }

      if (statusFilter === 'active') {
        rows = rows.filter(
          ({ rec }) => rec.blockType === 'none' && rec.status === ''
        );
      } else if (statusFilter === 'blocked') {
        rows = rows.filter(
          ({ rec }) =>
            rec.blockType === 'full' ||
            rec.blockType === 'partial' ||
            rec.status === 'محجوب'
        );
      } else if (statusFilter === 'archived') {
        rows = rows.filter(
          ({ rec }) => rec.blockType === 'archived' || rec.status === 'مؤرشف'
        );
      }

      if (sortBy === 'name_asc') {
        rows = [...rows].sort((a, b) =>
          a.rec.name.localeCompare(b.rec.name, 'ar')
        );
      } else if (sortBy === 'individuals_desc') {
        rows = [...rows].sort(
          (a, b) => (b.rec.individuals ?? 0) - (a.rec.individuals ?? 0)
        );
      }
    }
    return rows;
  }, [
    resolvedActiveRows,
    capabilities.canSortAndFilter,
    searchQuery,
    statusFilter,
    sortBy,
  ]);

  const activeListTotals = useMemo(() => {
    let activeInd = 0;
    let totalKg = 0;
    let totalIqd = 0;
    for (const { rec } of visibleRows) {
      const eff = getEffectiveAllocationForPerson(rec, calculationSettings);
      const elig = eff.eligibleIndividuals ?? 0;
      activeInd += elig;
      totalKg += elig * calculationSettings.kgPerIndividual;
      totalIqd += eff.priceIqd ?? 0;
    }
    return {
      count: visibleRows.length,
      activeInd,
      totalKg,
      totalIqd,
    };
  }, [visibleRows, calculationSettings]);

  const auditIssues = useMemo(() => {
    if (!capabilities.canUseSmartAudit || !activeList) return [];
    const pseudoPersons: Person[] = resolvedActiveRows.map(({ item, rec }) => ({
      id: item.id,
      agencyId: activeList.agencyId,
      name: rec.name,
      nationalId: rec.nationalId,
      individuals: rec.individuals,
      blockType: rec.blockType,
      blockedIndividuals: rec.blockedIndividuals,
      blockReason: rec.blockReason,
      status: rec.status,
      notes: rec.notes,
      updatedAt: activeList.listDate,
    }));
    return auditAgencyPersons(pseudoPersons);
  }, [capabilities.canUseSmartAudit, activeList, resolvedActiveRows]);

  const selectedRecords: SelectablePersonRecord[] = useMemo(() => {
    if (!activeList) return [];
    const idSet = new Set(selectedItemIds);
    return visibleRows
      .filter(({ item }) => idSet.has(item.id))
      .map(({ item, rec }) => ({
        selectionKey: `item:${item.id}`,
        personId: item.sourcePersonId,
        readyListItemId: item.id,
        name: rec.name,
        agencyId: activeList.agencyId,
        agencyName: agencyMap.get(activeList.agencyId) || activeList.name,
        nationalId: rec.nationalId,
        individuals: rec.individuals,
        blockType: rec.blockType,
        blockedIndividuals: rec.blockedIndividuals,
        blockReason: rec.blockReason,
        status: rec.status,
        notes: rec.notes,
        updatedAt: activeList.lastUpdatedAt || activeList.listDate,
      }));
  }, [visibleRows, selectedItemIds, activeList, agencyMap]);

  const toggleSelectItem = (itemId: number) => {
    setSelectedItemIds((curr) =>
      curr.includes(itemId)
        ? curr.filter((x) => x !== itemId)
        : [...curr, itemId]
    );
  };

  const handleOpenList = (listId: number) => {
    setOpenedListId(listId);
    setFocusedItemId(null);
    setSelectedItemIds([]);
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('default');
    setShowAuditPanel(false);
    setSharePreviewText(null);
  };

  const handlePrintList = () => {
    if (!activeList) return;
    const memFlags = getExportMemoryFlags();
    const hideAmount = memFlags.hideAmountColumn;
    const hideStatus = memFlags.hideStatusColumn;
    const hideNotes = memFlags.hideNotesColumn;

    runAsyncExportTask(
      'جاري تجهيز طباعة القائمة / PDF...',
      'تم تجهيز القائمة للطباعة بنجاح.',
      () => {
        const rowsHtml = visibleRows
          .map(({ rec }, idx) => {
            const eff = getEffectiveAllocationForPerson(rec, calculationSettings);
            const indLabel =
              eff.summary.scope === 'partial'
                ? `${eff.eligibleIndividuals} من ${rec.individuals ?? 0}`
                : String(eff.eligibleIndividuals ?? 0);
            return `<tr>
              <td>${idx + 1}</td>
              <td>${escapeHtml(initialLetter(rec.name))}</td>
              <td style="text-align:right;font-weight:700">${escapeHtml(rec.name)}</td>
              <td>${escapeHtml(indLabel)}</td>
              <td>${escapeHtml(eff.quotaText)}</td>
              ${hideAmount ? '' : `<td>${escapeHtml(eff.priceText)}</td>`}
              ${hideStatus ? '' : `<td>${escapeHtml(eff.summary.shortLabel)}</td>`}
              ${hideNotes ? '' : `<td style="text-align:right">${escapeHtml(rec.notes || '')}</td>`}
            </tr>`;
          })
          .join('');

        printViaIframe(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>${escapeHtml(activeList.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Cairo', 'Amiri', Tahoma, Arial, sans-serif; padding: 18px; color: #0f172a; direction: rtl; }
  .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { font-size: 19px; margin: 0 0 6px; }
  .meta { font-size: 12px; color: #334155; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: center; }
  th { background: #e2e8f0; }
  .footer { margin-top: 12px; font-size: 12px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(activeList.name)}</h1>
    <div class="meta">
      <div>${escapeHtml(activeList.subtitle1 || '')}${activeList.subtitle2 ? ` — ${escapeHtml(activeList.subtitle2)}` : ''}</div>
      <div>التاريخ: ${escapeHtml(activeList.listDate || activeList.createdAt)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>الحرف</th><th>الاسم</th><th>الأفراد</th><th>الحصة</th>${
        hideAmount ? '' : '<th>المبلغ</th>'
      }${hideStatus ? '' : '<th>الحالة</th>'}${hideNotes ? '' : '<th>الملاحظات</th>'}</tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">الإجمالي: ${activeListTotals.count} عائلة | ${activeListTotals.activeInd} أفراد | ${escapeHtml(
          formatTotalQuota(activeListTotals.totalKg, calculationSettings)
        )}${hideAmount ? '' : ` | ${escapeHtml(formatIqd(activeListTotals.totalIqd))}`}</div>
</body></html>`);
      }
    );
  };

  const handleShareListText = async () => {
    if (!activeList) return;
    const text = buildReadyListShareText({
      list: activeList,
      items: visibleRows.map((r) => r.item),
      persons,
      settings: calculationSettings,
    });
    try {
      if (navigator.share) {
        await navigator.share({
          title: activeList.name,
          text,
        });
        setExportNotice('تمت مشاركة القائمة بنجاح.');
        return;
      }
    } catch {
      // Fallback to share modal + clipboard copy
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setExportNotice('تم نسخ نص القائمة للحافظة ومجهز للمشاركة.');
      }
    } catch {
      // Clipboard blocked in non-HTTPS contexts; modal lets user copy manually
    }
    setSharePreviewText(text);
  };

  const handleExportPng = async () => {
    if (!activeList) return;
    try {
      setExportingImage(true);
      await exportReadyListToImage({
        list: activeList,
        items: visibleRows.map((r) => r.item),
        persons,
        settings: calculationSettings,
      });
      setExportNotice('تم تنزيل صورة القائمة (PNG) بنجاح.');
    } catch (err) {
      setExportNotice(
        err instanceof Error ? err.message : 'تعذر تصدير الصورة.'
      );
    } finally {
      setExportingImage(false);
    }
  };

  const reducedMotion = useTabrixReducedMotion();
  const numClass = themePrefs.tabularNumerals ? 'font-data tabular-nums' : '';
  const numericTintStyle = themePrefs.smartNumericSplit
    ? { backgroundColor: 'var(--bg-numeric)' }
    : undefined;
  const focusActive =
    themePrefs.activeRowFocusMode && focusedItemId !== null;

  return (
    <>
      {/* ========================================================================
          STANDALONE FULL-SCREEN LIST OVERLAY WITH 2D ENTER/EXIT TRANSITION
         ======================================================================== */}
      <AnimatePresence>
        {activeList && (
          <motion.div
            key={`ready-list-fullscreen-${activeList.id}`}
            variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_PUSH_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            role="region"
            aria-label={`عرض القائمة الجاهزة: ${activeList.name}`}
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
            }}
          >
        {/* Floating Glassmorphic Top Header with Back Button, Metadata, Undo/Redo, and Multi-Format Export */}
        <div className="no-print sticky top-0 z-30 w-full px-3 pt-2.5 pb-1.5 sm:px-6 sm:pt-3 pointer-events-none">
          <header
            className="pointer-events-auto nexus-glass-lite mx-auto max-w-6xl rounded-3xl border px-3.5 py-3 sm:px-5 transition-all"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpenedListId(null);
                  setFocusedItemId(null);
                }}
                className="nexus-pill-btn inline-flex shrink-0 items-center gap-1.5 border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <ArrowRight className="h-4 w-4" />
                <span>رجوع للقوائم الجاهزة</span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-bold sm:text-xl">
                    {activeList.name}
                  </h1>
                  <span
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>{activeList.listDate || activeList.createdAt}</span>
                  </span>
                  {activeList.autoUpdateDate && activeList.lastUpdatedAt && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Clock className="h-3 w-3" />
                      <span>آخر تحديث: {activeList.lastUpdatedAt}</span>
                    </span>
                  )}
                  {capabilities.canEditRecords && (
                    <button
                      type="button"
                      onClick={() => {
                        setMetaName(activeList.name);
                        setMetaDate(activeList.listDate || activeList.createdAt);
                        setMetaSub1(activeList.subtitle1 || '');
                        setMetaSub2(activeList.subtitle2 || '');
                        setMetaAutoUpdateDate(activeList.autoUpdateDate ?? false);
                        setConfirmMetaStep(false);
                        setEditingMetaOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>تعديل العناوين</span>
                    </button>
                  )}
                </div>

                {(activeList.subtitle1 || activeList.subtitle2) && (
                  <div
                    className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {activeList.subtitle1 && <span>• {activeList.subtitle1}</span>}
                    {activeList.subtitle2 && <span>• {activeList.subtitle2}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Undo / Redo + Multi-Format Export / Share Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5">
              {capabilities.canEditRecords && (
                <>
                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={onUndo}
                    aria-label="تراجع عن التعديل"
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap disabled:opacity-35"
                    style={{
                      backgroundColor: 'var(--bg-main)',
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
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Redo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>إعادة</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handlePrintList}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor:
                    relationsPrefs?.defaultExportFormat === 'pdf'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    relationsPrefs?.defaultExportFormat === 'pdf'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    relationsPrefs?.defaultExportFormat === 'pdf'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                <span>طباعة / PDF</span>
              </button>

              {capabilities.canUseExcelTools && (
                <button
                  type="button"
                  onClick={() => {
                    exportReadyListToExcel({
                      list: activeList,
                      items: visibleRows.map((r) => r.item),
                      persons,
                      settings: calculationSettings,
                    });
                    setExportNotice('تم تصدير ملف Excel بنجاح.');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                  style={{
                    backgroundColor:
                      relationsPrefs?.defaultExportFormat === 'excel'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                    borderColor:
                      relationsPrefs?.defaultExportFormat === 'excel'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    color:
                      relationsPrefs?.defaultExportFormat === 'excel'
                        ? 'var(--accent)'
                        : 'var(--text-primary)',
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Excel</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShareListText}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor:
                    relationsPrefs?.defaultExportFormat === 'text'
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                  borderColor:
                    relationsPrefs?.defaultExportFormat === 'text'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    relationsPrefs?.defaultExportFormat === 'text'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                <Share2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>مشاركة / نص</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportReadyListToTextFile({
                    list: activeList,
                    items: visibleRows.map((r) => r.item),
                    persons,
                    settings: calculationSettings,
                  });
                  setExportNotice('تم تنزيل الملف النصي (.txt).');
                }}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>ملف TXT</span>
              </button>

              <button
                type="button"
                disabled={exportingImage}
                onClick={handleExportPng}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>{exportingImage ? 'جارٍ التجهيز...' : 'صورة PNG'}</span>
              </button>
            </div>
            </div>
          </header>
        </div>

        <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 pb-24 sm:p-6 sm:pb-20">
          <AnimatePresence>
            {exportNotice && (
              <motion.div
                key="ready-list-export-notice"
                variants={TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                role="status"
                className="rounded-lg border px-4 py-2 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--success-bg)',
                  borderColor: 'var(--success)',
                  color: 'var(--success)',
                }}
              >
                {exportNotice}
              </motion.div>
            )}
          </AnimatePresence>

          <PeriodHeaderBanner
            periodMeta={activeList.periodMeta || activePeriod}
            fallbackPeriod={activePeriod}
            freeformHeader={activeList.freeformHeader}
            readOnly={!capabilities.canEditRecords}
            onSavePeriodAndHeader={({ periodMeta, freeformHeader }) =>
              onUpdateListMetaConfirmed(activeList.id, {
                periodMeta,
                freeformHeader,
                listDate: periodMeta.fullDate,
              })
            }
          />

          {/* Summary KPI Bar + Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span
                className="rounded-lg border px-3 py-1.5 font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                العائلات: {activeListTotals.count}
              </span>
              <span
                className="rounded-lg border px-3 py-1.5 font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                الأفراد: {activeListTotals.activeInd}
              </span>
              <span
                className="rounded-lg border px-3 py-1.5 font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--accent)',
                }}
              >
                {formatTotalQuota(activeListTotals.totalKg, calculationSettings)}
              </span>
              <span
                className="rounded-lg border px-3 py-1.5 font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--success)',
                }}
              >
                {formatIqd(activeListTotals.totalIqd)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {focusActive && (
                <button
                  type="button"
                  onClick={() => setFocusedItemId(null)}
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

              {capabilities.canEditRecords && (
                <>
                  <button
                    type="button"
                    onClick={() => setDualPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>إضافة أعضاء (بحث / علاقات)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAddName('');
                      setAddNid('');
                      setAddInd('4');
                      setAddNotes('');
                      setAddItemOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>إضافة اسم يدويًا</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Agency-Parity Search, Status Filter, Sort Toolbar */}
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
                  placeholder="بحث داخل القائمة بالاسم أو رقم البطاقة..."
                  aria-label="بحث داخل القائمة"
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
                aria-label="فلترة حالة القائمة"
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

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as 'default' | 'name_asc' | 'individuals_desc'
                  )
                }
                aria-label="ترتيب القائمة"
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

          {/* Smart Audit Panel */}
          <AnimatePresence>
            {showAuditPanel && capabilities.canUseSmartAudit && (
              <motion.section
                key="ready-list-audit-panel"
                variants={TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="nexus-squircle p-4"
                style={{
                  borderColor: 'var(--warning)',
                }}
              >
                <div
                  className="mb-2 flex items-center gap-2 text-xs font-bold"
                  style={{ color: 'var(--warning)' }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>نتائج التدقيق الذكي للقائمة ({auditIssues.length} ملاحظة)</span>
                </div>
                {auditIssues.length === 0 ? (
                  <div className="text-xs" style={{ color: 'var(--success)' }}>
                    بيانات القائمة سليمة تمامًا ولا توجد أخطاء أو تكرارات.
                  </div>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {auditIssues.map((issue) => (
                      <li key={issue.id}>
                        <strong>{issue.personName}</strong> — {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          {/* Sleek Top Selection Action Bar */}
          <SelectionActionBar
            selectedRecords={selectedRecords}
            totalVisibleCount={visibleRows.length}
            agencies={agencies}
            readyLists={readyLists}
            relations={relations}
            calculationSettings={calculationSettings}
            tableTitle={activeList.name}
            tableDate={activeList.listDate}
            periodMeta={activeList.periodMeta || activePeriod}
            freeformHeader={activeList.freeformHeader}
            canUndo={canUndo}
            onUndo={onUndo}
            onSelectAll={() =>
              setSelectedItemIds(visibleRows.map((r) => r.item.id))
            }
            onClearSelection={() => setSelectedItemIds([])}
            onMoveToAgency={onMovePersonsToAgency}
            onAddToReadyList={(listId, pids) =>
              onAddPersonsToReadyList(listId, pids)
            }
            onUpsertRelation={onUpsertRelation}
            onBulkDeleteSelected={
              onBulkDeleteItems
                ? (records) => {
                    const itemIds = records
                      .map((r) => r.readyListItemId)
                      .filter((id): id is number => typeof id === 'number');
                    if (itemIds.length > 0) {
                      onBulkDeleteItems(itemIds);
                      setSelectedItemIds([]);
                    }
                  }
                : undefined
            }
          />

          {/* Full Excel Spreadsheet Table */}
          <div
            className={`nexus-squircle overflow-auto p-2 ${
              themePrefs.stickyHeaderAndName ? 'max-h-[68vh]' : ''
            }`}
          >
            <table
              className={`agency-table theme-${themePrefs.tableTheme} nexus-slab-table ${
                themePrefs.rowHoverHighlight ? 'hover-highlight' : ''
              } ${focusActive ? 'has-focused-row' : ''} text-right text-xs sm:text-sm`}
            >
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
                  <th
                    className={`border-l px-2.5 text-center ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label="تحديد جميع أعضاء القائمة الظاهرين"
                      checked={
                        visibleRows.length > 0 &&
                        selectedRecords.length === visibleRows.length
                      }
                      onChange={(e) =>
                        setSelectedItemIds(
                          e.target.checked
                            ? visibleRows.map((r) => r.item.id)
                            : []
                        )
                      }
                    />
                  </th>
                  <th
                    className={`border-l px-3 text-center font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    #
                  </th>
                  <th
                    className={`border-l px-2.5 text-center font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    الحرف
                  </th>
                  <th
                    className={`border-l px-3 font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName
                        ? 'sticky right-0 top-0 z-30 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]'
                        : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    الاسم
                  </th>
                  <th
                    className={`border-l px-3 text-center font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    الأفراد
                  </th>
                  <th
                    className={`border-l px-3 text-center font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    الحصة
                  </th>
                  <th
                    className={`border-l px-3 text-center font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    المبلغ
                  </th>
                  <th
                    className={`border-l px-3 text-center font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    الحالة
                  </th>
                  <th
                    className={`px-3 font-bold whitespace-nowrap ${
                      themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    الملاحظات
                  </th>
                  {capabilities.canEditRecords && (
                    <th
                      className={`border-r px-3 text-center font-bold whitespace-nowrap ${
                        themePrefs.stickyHeaderAndName ? 'sticky top-0 z-20' : ''
                      }`}
                      style={{
                        borderColor: 'var(--grid-color)',
                        backgroundColor: 'var(--bg-table-header)',
                      }}
                    >
                      إجراءات المحرر
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-10 text-center text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      لا توجد سجلات مطابقة في هذه القائمة.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map(({ item, rec }, idx) => {
                    const eff = getEffectiveAllocationForPerson(
                      rec,
                      calculationSettings
                    );
                    const isBlocked =
                      eff.summary.scope === 'full' ||
                      eff.summary.scope === 'archived';
                    const isFocused =
                      themePrefs.activeRowFocusMode &&
                      focusedItemId === item.id;

                    const statusColor =
                      eff.summary.scope === 'none'
                        ? 'var(--success)'
                        : eff.summary.scope === 'partial'
                        ? 'var(--warning)'
                        : 'var(--danger)';
                    const statusBg =
                      eff.summary.scope === 'none'
                        ? 'var(--success-bg)'
                        : eff.summary.scope === 'partial'
                        ? 'var(--warning-bg)'
                        : 'var(--danger-bg)';
                    const compactLabel =
                      eff.summary.scope === 'none'
                        ? 'نشط'
                        : eff.summary.scope === 'partial'
                        ? `جزئي (${eff.summary.blockedIndividuals})`
                        : eff.summary.scope === 'archived'
                        ? 'مؤرشف'
                        : 'كامل';

                    const isRowSelected = selectedItemIds.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (!themePrefs.activeRowFocusMode) return;
                          setFocusedItemId((curr) =>
                            curr === item.id ? null : item.id
                          );
                        }}
                        className={`${isBlocked ? 'row-blocked' : ''} ${
                          isFocused ? 'row-focused' : ''
                        } ${themePrefs.activeRowFocusMode ? 'cursor-pointer' : ''}`}
                        style={{
                          backgroundColor: isRowSelected
                            ? 'var(--bg-nav-active)'
                            : isBlocked
                            ? 'var(--danger-bg)'
                            : undefined,
                        }}
                      >
                        <td
                          className="border-l px-2.5 text-center"
                          style={{ borderColor: 'var(--grid-color)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`تحديد ${rec.name}`}
                            checked={isRowSelected}
                            onChange={() => toggleSelectItem(item.id)}
                          />
                        </td>
                        <td
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass}`}
                          style={{ borderColor: 'var(--grid-color)' }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          className="border-l px-2.5 text-center font-bold whitespace-nowrap"
                          style={{ borderColor: 'var(--grid-color)' }}
                        >
                          {initialLetter(rec.name)}
                        </td>
                        <td
                          className={`border-l px-3 font-semibold whitespace-nowrap ${
                            themePrefs.stickyHeaderAndName
                              ? 'sticky right-0 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]'
                              : ''
                          }`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            backgroundColor: isRowSelected || isFocused
                              ? 'var(--bg-nav-active)'
                              : isBlocked
                              ? 'var(--danger-bg)'
                              : 'var(--bg-surface)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectItem(item.id);
                            if (themePrefs.activeRowFocusMode) {
                              setFocusedItemId(item.id);
                            }
                          }}
                        >
                          <button
                            type="button"
                            aria-label={`تحديد ${rec.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectItem(item.id);
                              if (themePrefs.activeRowFocusMode) {
                                setFocusedItemId(item.id);
                              }
                            }}
                            className="text-right font-semibold hover:underline"
                          >
                            {rec.name}
                          </button>
                        </td>
                        <td
                          className={`border-l px-3 text-center font-bold whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                          }}
                        >
                          {eff.summary.scope === 'partial'
                            ? `${eff.eligibleIndividuals} من ${rec.individuals ?? 0}`
                            : eff.eligibleIndividuals ?? '—'}
                        </td>
                        <td
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                          }}
                        >
                          {eff.quotaText}
                        </td>
                        <td
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                          }}
                        >
                          {eff.priceText}
                        </td>
                        <td
                          className="border-l px-3 text-center text-xs font-semibold whitespace-nowrap"
                          style={{ borderColor: 'var(--grid-color)' }}
                        >
                          {themePrefs.compactStatusBadges ? (
                            <span
                              className="inline-block rounded-md px-2 py-0.5 text-[11px] font-bold"
                              style={{
                                color: statusColor,
                                backgroundColor: statusBg,
                              }}
                            >
                              {compactLabel}
                            </span>
                          ) : (
                            <span style={{ color: statusColor }}>
                              {eff.summary.shortLabel}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-3 text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {rec.notes || '—'}
                        </td>
                        {capabilities.canEditRecords && (
                          <td
                            className="border-r px-3 text-center"
                            style={{ borderColor: 'var(--grid-color)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              {sortBy === 'default' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => onMoveItemOrder(item.id, 'up')}
                                    aria-label={`تحريك ${rec.name} للأعلى`}
                                    title="تحريك للأعلى"
                                    className="rounded border p-1.5 hover:opacity-80 disabled:opacity-30"
                                    style={{ borderColor: 'var(--border-color)' }}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === visibleRows.length - 1}
                                    onClick={() => onMoveItemOrder(item.id, 'down')}
                                    aria-label={`تحريك ${rec.name} للأسفل`}
                                    title="تحريك للأسفل"
                                    className="rounded border p-1.5 hover:opacity-80 disabled:opacity-30"
                                    style={{ borderColor: 'var(--border-color)' }}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditName(rec.name);
                                  setEditNid(rec.nationalId || '');
                                  setEditInd(
                                    rec.individuals === null
                                      ? ''
                                      : String(rec.individuals)
                                  );
                                  setEditBlockType(rec.blockType);
                                  setEditBlockedInd(
                                    String(rec.blockedIndividuals || 0)
                                  );
                                  setEditBlockReason(rec.blockReason || '');
                                  setEditNotes(rec.notes || '');
                                  setConfirmEditStep(false);
                                }}
                                aria-label={`تعديل عضو القائمة ${rec.name}`}
                                className="rounded border p-1.5 hover:opacity-80"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRequestDeleteItem(item)}
                                aria-label={`حذف عضو القائمة ${rec.name}`}
                                className="rounded border p-1.5 hover:opacity-80"
                                style={{
                                  borderColor: 'var(--danger)',
                                  color: 'var(--danger)',
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Share Text Full-Screen Push Page */}
        <FullScreenPushPage
          open={sharePreviewText !== null}
          onClose={() => setSharePreviewText(null)}
          title="نص القائمة الجاهز للإرسال والمشاركة"
          subtitle="معاينة النص المنسق جاهز للنسخ أو التنزيل كملف نصي"
          icon={<Share2 className="h-4 w-4" />}
          maxWidthClass="max-w-xl"
        >
          {sharePreviewText !== null && (
            <div className="nexus-squircle p-5 space-y-4">
              <textarea
                readOnly
                rows={12}
                value={sharePreviewText}
                className="w-full rounded-xl border p-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <div className="flex flex-wrap justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    exportReadyListToTextFile({
                      list: activeList,
                      items: visibleRows.map((r) => r.item),
                      persons,
                      settings: calculationSettings,
                    });
                    setExportNotice('تم حفظ القائمة كملف نصي.');
                  }}
                  className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>تنزيل (.txt)</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard?.writeText(sharePreviewText);
                      setExportNotice('تم نسخ النص إلى الحافظة بنجاح.');
                    } catch {
                      setExportNotice('يرجى تحديد النص ونسخه يدويًا.');
                    }
                  }}
                  className="nexus-pill-btn inline-flex items-center gap-1.5 px-5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>نسخ النص للإرسال</span>
                </button>
              </div>
            </div>
          )}
        </FullScreenPushPage>

        {/* Edit List Header Metadata Full-Screen Push Page (Confirmation Required) */}
        <FullScreenPushPage
          open={editingMetaOpen}
          onClose={() => setEditingMetaOpen(false)}
          title="تعديل عناوين وتاريخ القائمة"
          subtitle="تعديل العنوان الرئيسي والعناوين الفرعية والتاريخ المرجعي للقائمة"
          icon={<Edit3 className="h-4 w-4" />}
          maxWidthClass="max-w-lg"
        >
          <div className="nexus-squircle p-5">

              {confirmMetaStep ? (
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
                    <span>
                      تأكيد التعديل (قواعد المحرر): سيتم تحديث عنوان وتاريخ وعناوين{' '}
                      <strong>{metaName}</strong>.
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmMetaStep(false)}
                      className="rounded-lg border px-4 py-2 font-semibold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      رجوع
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateListMetaConfirmed(activeList.id, {
                          name: metaName,
                          listDate: metaDate,
                          subtitle1: metaSub1,
                          subtitle2: metaSub2,
                          autoUpdateDate: metaAutoUpdateDate,
                        });
                        setEditingMetaOpen(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-4 py-2 font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>تأكيد الحفظ</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!metaName.trim()) return;
                    setConfirmMetaStep(true);
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="mb-1 block font-medium">العنوان الرئيسي *</label>
                    <input
                      type="text"
                      required
                      value={metaName}
                      onChange={(e) => setMetaName(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium">التاريخ</label>
                    <input
                      type="date"
                      value={metaDate}
                      onChange={(e) => setMetaDate(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium">العنوان الفرعي الأول</label>
                    <input
                      type="text"
                      value={metaSub1}
                      onChange={(e) => setMetaSub1(e.target.value)}
                      placeholder="مثال: الوكالة / خط التوصيل"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium">العنوان الفرعي الثاني</label>
                    <input
                      type="text"
                      value={metaSub2}
                      onChange={(e) => setMetaSub2(e.target.value)}
                      placeholder="مثال: اسم السائق / ملاحظات"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={metaAutoUpdateDate}
                      onChange={(e) => setMetaAutoUpdateDate(e.target.checked)}
                    />
                    <span>إظهار وتحديث تاريخ «آخر تعديل» تلقائيًا</span>
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingMetaOpen(false)}
                      className="nexus-pill-btn border px-4 py-2 font-semibold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="nexus-pill-btn px-5 py-2 font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      متابعة للتأكيد
                    </button>
                  </div>
                </form>
              )}
          </div>
        </FullScreenPushPage>

        {/* Add Item Direct Full-Screen Push Page (Direct without confirmation per Editor rules) */}
        <FullScreenPushPage
          open={addItemOpen}
          onClose={() => setAddItemOpen(false)}
          title="إضافة اسم للقائمة (إدخال مباشر)"
          subtitle="إضافة عضو جديد مباشرة ضمن القائمة الجاهزة المفتوحة"
          icon={<UserPlus className="h-4 w-4" />}
          maxWidthClass="max-w-lg"
        >
          <div className="nexus-squircle p-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!addName.trim()) return;
                  onAddReadyListItemDirect({
                    listId: activeList.id,
                    name: addName,
                    nationalId: addNid,
                    individuals:
                      addInd === '' ? null : Math.max(0, Number(addInd)),
                    notes: addNotes,
                  });
                  setAddItemOpen(false);
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="mb-1 block font-medium">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
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
                    <label className="mb-1 block font-medium">عدد الأفراد</label>
                    <input
                      type="number"
                      min={0}
                      value={addInd}
                      onChange={(e) => setAddInd(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium">رقم البطاقة</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={addNid}
                      onChange={(e) => setAddNid(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-left text-sm tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-medium">الملاحظات / الموقع</label>
                  <input
                    type="text"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="مثال: قرب الجامع - توصيل"
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
                    onClick={() => setAddItemOpen(false)}
                    className="nexus-pill-btn border px-4 py-2 font-semibold"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="nexus-pill-btn inline-flex items-center gap-1 px-5 py-2 font-bold"
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
        </FullScreenPushPage>

        {/* Edit Ready List Item Full-Screen Push Page (Confirmation Required per Editor Rules) */}
        <FullScreenPushPage
          open={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          title="تعديل عضو القائمة الجاهزة"
          subtitle="تحديث بيانات المستفيد أو حالة الحجب داخل هذه القائمة"
          icon={<Edit3 className="h-4 w-4" />}
          maxWidthClass="max-w-lg"
        >
          {editingItem && (
            <div className="nexus-squircle p-5">
              {confirmEditStep ? (
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
                    <span>
                      تأكيد التعديل (قواعد المحرر): سيتم تحديث بيانات{' '}
                      <strong>{editName}</strong> في هذه القائمة الجاهزة.
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmEditStep(false)}
                      className="rounded-lg border px-4 py-2 font-semibold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      رجوع
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateItemConfirmed(editingItem.id, {
                          name: editName.trim(),
                          nationalId: editNid.trim(),
                          individuals:
                            editInd === ''
                              ? null
                              : Math.max(0, Number(editInd)),
                          blockType: editBlockType,
                          blockedIndividuals: Math.max(
                            0,
                            Number(editBlockedInd) || 0
                          ),
                          blockReason: editBlockReason.trim(),
                          notes: editNotes.trim(),
                        });
                        setEditingItem(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-4 py-2 font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>تأكيد التعديل</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setConfirmEditStep(true);
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="mb-1 block font-medium">الاسم</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block font-medium">عدد الأفراد</label>
                      <input
                        type="number"
                        min={0}
                        value={editInd}
                        onChange={(e) => setEditInd(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium">رقم البطاقة</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={editNid}
                        onChange={(e) => setEditNid(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-left text-sm tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block font-medium">حالة الحظر</label>
                      <select
                        value={editBlockType}
                        onChange={(e) =>
                          setEditBlockType(e.target.value as BlockScope)
                        }
                        className="w-full rounded-lg border px-2.5 py-2 text-sm"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <option value="none">نشط (بدون حظر)</option>
                        <option value="partial">حظر جزئي</option>
                        <option value="full">حظر كامل</option>
                        <option value="archived">مؤرشف</option>
                      </select>
                    </div>
                    {editBlockType === 'partial' && (
                      <div>
                        <label className="mb-1 block font-medium">الأفراد المحظورون</label>
                        <input
                          type="number"
                          min={1}
                          value={editBlockedInd}
                          onChange={(e) => setEditBlockedInd(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {editBlockType !== 'none' && (
                    <div>
                      <label className="mb-1 block font-medium">سبب الحظر / الأرشفة</label>
                      <input
                        type="text"
                        value={editBlockReason}
                        onChange={(e) => setEditBlockReason(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block font-medium">الملاحظات</label>
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
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
                      onClick={() => setEditingItem(null)}
                      className="nexus-pill-btn border px-4 py-2 font-semibold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="nexus-pill-btn px-5 py-2 font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      متابعة للتأكيد
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </FullScreenPushPage>

        <AddReadyListMembersModal
          open={dualPickerOpen}
          list={activeList}
          persons={persons}
          agencies={agencies}
          relations={relations}
          existingSourcePersonIds={existingSourcePersonIds}
          calculationSettings={calculationSettings}
          onClose={() => setDualPickerOpen(false)}
          onAddSelectedPersons={(pids, overrideNotesMap) =>
            onAddPersonsToReadyList(activeList.id, pids, overrideNotesMap)
          }
        />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================================
          CENTERED LIST CARDS HUB
         ====================================================================== */}
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 p-4 pb-24 sm:p-6 sm:pb-20">
      <div className="nexus-squircle flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3.5 min-w-0">
          <NexusDuotoneIcon icon={ListChecks} size="lg" className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold sm:text-xl">القوائم الجاهزة</h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
              أنشئ قوائم توزيع متعددة لعمال التوصيل وافتح أي قائمة بملء الشاشة مع التصدير والمشاركة
            </p>
          </div>
        </div>

        {capabilities.canUseReadyListBuilder && (
          <button
            type="button"
            data-assistant-target="ready-lists-create-btn"
            onClick={() => {
              setNewListName('');
              setNewListDate(todayStr);
              setNewSubtitle1('');
              setNewSubtitle2('');
              setNewAutoUpdateDate(relationsPrefs?.autoUpdateReadyListDate ?? true);
              setNewPopulateFromAgency(true);
              setCreateModalOpen(true);
            }}
            className="nexus-pill-btn inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء قائمة جديدة</span>
          </button>
        )}
      </div>

      {/* Centered Sleek Bars / Cards for Each Ready List */}
      <section aria-label="القوائم الجاهزة المتاحة" className="space-y-3">
        {readyLists.length === 0 ? (
          <div
            className="nexus-squircle p-8 text-center text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            لا توجد قوائم جاهزة بعد. أنشئ قائمة جديدة للبدء.
          </div>
        ) : (
          readyLists.map((list) => {
            const listItems = readyListItems.filter((it) => it.listId === list.id);
            let totalInd = 0;
            let totalKg = 0;
            for (const item of listItems) {
              const rec = resolveReadyListItemRecord(item, personMap);
              const eff = getEffectiveAllocationForPerson(
                rec,
                calculationSettings
              );
              const elig = eff.eligibleIndividuals ?? 0;
              totalInd += elig;
              totalKg += elig * calculationSettings.kgPerIndividual;
            }
            const fullBags = Math.floor(
              totalKg / Math.max(1, calculationSettings.kgPerBag)
            );

            return (
              <MotionSurfaceCard
                key={list.id}
                as="article"
                className="group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  onClick={() => handleOpenList(list.id)}
                  className="flex min-w-0 flex-1 flex-col items-start text-right"
                >
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <ListChecks
                      className="h-4 w-4 shrink-0"
                      style={{ color: 'var(--accent)' }}
                    />
                    <h2 className="text-base font-bold group-hover:underline">
                      {list.name}
                    </h2>
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-nav-active)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Calendar className="h-3 w-3" />
                      <span>{list.listDate || list.createdAt}</span>
                    </span>
                    {list.autoUpdateDate && list.lastUpdatedAt && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Clock className="h-3 w-3" />
                        <span>آخر تحديث: {list.lastUpdatedAt}</span>
                      </span>
                    )}
                  </div>

                  {/* Two Subtitles */}
                  <div
                    className="mt-1.5 space-y-0.5 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {list.subtitle1 && <div>• {list.subtitle1}</div>}
                    {list.subtitle2 && <div>• {list.subtitle2}</div>}
                  </div>

                  <div
                    className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] font-bold tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>{listItems.length} عائلة</span>
                    <span>·</span>
                    <span>{totalInd} أفراد</span>
                    <span>·</span>
                    <span style={{ color: 'var(--accent)' }}>
                      {fullBags} كيس
                    </span>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenList(list.id)}
                    className="nexus-pill-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <span>فتح القائمة</span>
                  </button>

                  {capabilities.canEditRecords && (
                    <button
                      type="button"
                      onClick={() => onRequestDeleteList(list)}
                      aria-label={`حذف القائمة ${list.name}`}
                      className="nexus-pill-btn border p-2"
                      style={{
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                        backgroundColor: 'var(--bg-main)',
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </MotionSurfaceCard>
            );
          })
        )}
      </section>

      {/* Create New Ready List Full-Screen Push Page */}
      <FullScreenPushPage
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="إنشاء قائمة جاهزة جديدة"
        subtitle="إعداد قائمة توزيع مخصصة لعمال التوصيل أو خط معين"
        icon={<ListChecks className="h-4 w-4" />}
        maxWidthClass="max-w-lg"
      >
        <div className="nexus-squircle p-5">

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newListName.trim()) return;
                onCreateReadyList({
                  agencyId: newListAgencyId,
                  name: newListName,
                  listDate: newListDate,
                  subtitle1: newSubtitle1,
                  subtitle2: newSubtitle2,
                  autoUpdateDate: newAutoUpdateDate,
                  populateFromAgency: newPopulateFromAgency,
                });
                setCreateModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="mb-1 block font-medium">العنوان الرئيسي للقائمة *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="مثال: قائمة عمال التوصيل — خط المركز"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium">تاريخ القائمة</label>
                  <input
                    type="date"
                    value={newListDate}
                    onChange={(e) => setNewListDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">الوكالة المرتبطة</label>
                  <select
                    value={newListAgencyId}
                    onChange={(e) => setNewListAgencyId(Number(e.target.value))}
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
              </div>

              <div>
                <label className="mb-1 block font-medium">
                  العنوان الفرعي الأول (الوكالة / خط التوصيل)
                </label>
                <input
                  type="text"
                  value={newSubtitle1}
                  onChange={(e) => setNewSubtitle1(e.target.value)}
                  placeholder="مثال: خط التوصيل الأول — الحي الشمالي"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium">
                  العنوان الفرعي الثاني (السائق / الملاحظات)
                </label>
                <input
                  type="text"
                  value={newSubtitle2}
                  onChange={(e) => setNewSubtitle2(e.target.value)}
                  placeholder="مثال: السائق: عباس فاضل — التسليم صباحًا"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <label
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <input
                  type="checkbox"
                  checked={newAutoUpdateDate}
                  onChange={(e) => setNewAutoUpdateDate(e.target.checked)}
                />
                <span>تفعيل التحديث التلقائي لتاريخ آخر تعديل</span>
              </label>

              <label
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 font-semibold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <input
                  type="checkbox"
                  checked={newPopulateFromAgency}
                  onChange={(e) => setNewPopulateFromAgency(e.target.checked)}
                />
                <span>تعبئة القائمة تلقائيًا من مستفيدي الوكالة المختارة</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
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
                  <Plus className="h-3.5 w-3.5" />
                  <span>إنشاء القائمة</span>
                </button>
              </div>
            </form>
        </div>
      </FullScreenPushPage>
      </main>
    </>
  );
};
