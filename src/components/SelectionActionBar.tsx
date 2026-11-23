import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  CheckSquare,
  ChevronDown,
  Copy,
  Eye,
  FilePlus2,
  FileText,
  HeartHandshake,
  Image as ImageIcon,
  ListPlus,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Agency,
  BlockScope,
  CalculationSettings,
  FreeformHeaderConfig,
  PeriodQuotaMeta,
  ReadyList,
  RelationCategory,
  RelationEntry,
} from '../types/agency';
import { getEffectiveAllocationForPerson } from '../utils/agencyLogic';
import { exportSelectedRecordsToImage } from '../utils/excelExport';
import {
  getRelationCategoryMeta,
  RELATION_CATEGORIES,
} from '../utils/relationMeta';
import {
  computeSelectionAggregates,
  formatSelectedRecordsCopy,
  type SmartCopyMode,
} from '../utils/selectionActions';
import { SnippetExportModal } from './modals/SnippetExportModal';

export interface SelectablePersonRecord {
  selectionKey: string;
  personId: number | null;
  readyListItemId?: number;
  name: string;
  agencyId: number;
  agencyName?: string;
  nationalId?: string;
  individuals: number | null;
  legacyQuantity?: string;
  decreaseCount?: number;
  addOrDeleteCount?: number;
  addOrDeleteAction?: 'إضافة' | 'حذف' | 'لا يوجد';
  blockType?: BlockScope;
  blockedIndividuals?: number;
  blockReason?: string;
  status?: '' | 'محجوب' | 'مؤرشف';
  notes?: string;
  updatedAt?: string;
}

interface SelectionActionBarProps {
  selectedRecords: SelectablePersonRecord[];
  totalVisibleCount: number;
  agencies: Agency[];
  readyLists: ReadyList[];
  relations: RelationEntry[];
  calculationSettings: CalculationSettings;
  tableTitle: string;
  tableDate?: string;
  periodMeta?: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
  readOnlyArchiveMode?: boolean;
  customCategories?: string[];
  canUndo?: boolean;
  onUndo?: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onMoveToAgency: (personIds: number[], targetAgencyId: number) => void;
  onAddToReadyList: (listId: number, personIds: number[]) => number;
  onUpsertRelation: (input: {
    personId: number;
    category: RelationCategory;
    note: string;
    reminderDate?: string;
    deliveryAddress?: string;
    deliveryPhone?: string;
    deliveryTime?: string;
  }) => void;
  onBulkDeleteSelected?: (records: SelectablePersonRecord[]) => void;
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
}

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  selectedRecords,
  totalVisibleCount,
  agencies,
  readyLists,
  relations,
  calculationSettings,
  tableTitle,
  tableDate,
  periodMeta,
  freeformHeader,
  readOnlyArchiveMode = false,
  customCategories = ['عام', 'أولوية', 'مراجعة', 'حالة خاصة'],
  canUndo = false,
  onUndo,
  onSelectAll,
  onClearSelection,
  onMoveToAgency,
  onAddToReadyList,
  onUpsertRelation,
  onBulkDeleteSelected,
  onBulkUpdateStatusAndCategory,
  onCreateReadyListFromSelection,
}) => {
  const [showQuickDetails, setShowQuickDetails] = useState(false);
  const [fullInfoOpen, setFullInfoOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [snippetModalOpen, setSnippetModalOpen] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastDeletedBanner, setLastDeletedBanner] = useState<{
    count: number;
  } | null>(null);
  const [exportingImg, setExportingImg] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement | null>(null);

  // Batch status & category edit state
  const [batchBlockType, setBatchBlockType] = useState<'keep' | BlockScope>('keep');
  const [batchPartialBlocked, setBatchPartialBlocked] = useState('1');
  const [batchBlockReason, setBatchBlockReason] = useState('');
  const [batchCategory, setBatchCategory] = useState<string>('__keep__');

  // Create Ready List from selection state
  const [newReadyListName, setNewReadyListName] = useState('');

  // Move modal state
  const [moveMode, setMoveMode] = useState<'agency' | 'ready_list'>('ready_list');
  const [targetAgencyId, setTargetAgencyId] = useState<number>(
    agencies[0]?.id ?? 1
  );
  const [targetListId, setTargetListId] = useState<number>(
    readyLists[0]?.id ?? 0
  );

  // Relation modal state
  const [relCategory, setRelCategory] = useState<RelationCategory>('favorites');
  const [relNote, setRelNote] = useState('');
  const [relReminderDate, setRelReminderDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [relAddress, setRelAddress] = useState('');
  const [relPhone, setRelPhone] = useState('');
  const [relTime, setRelTime] = useState('');

  const linkedPersonIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedRecords
            .map((r) => r.personId)
            .filter((id): id is number => id !== null)
        )
      ),
    [selectedRecords]
  );

  useEffect(() => {
    if (!copyMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setCopyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [copyMenuOpen]);

  const aggregates = useMemo(
    () => computeSelectionAggregates(selectedRecords, calculationSettings),
    [selectedRecords, calculationSettings]
  );

  const summaryTotals = useMemo(
    () => ({
      individuals: aggregates.totalEligibleIndividuals,
      totalIqd: aggregates.totalPriceIqd,
    }),
    [aggregates]
  );

  if (selectedRecords.length === 0) {
    if (!lastDeletedBanner) return null;
    return (
      <section
        role="status"
        aria-label="تأكيد الحذف الآمن"
        data-testid="bulk-delete-undo-banner"
        className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs shadow-sm"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--warning)',
          color: 'var(--text-primary)',
        }}
      >
        <span className="font-bold">
          تم نقل {lastDeletedBanner.count} سجل إلى سلة المهملات بأمان.
        </span>
        <div className="flex items-center gap-2">
          {canUndo && onUndo && (
            <button
              type="button"
              onClick={() => {
                onUndo();
                setLastDeletedBanner(null);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>تراجع عن الحذف</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setLastDeletedBanner(null)}
            aria-label="إغلاق إشعار الحذف"
            className="rounded-lg border px-2.5 py-1.5 font-semibold"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            إغلاق
          </button>
        </div>
      </section>
    );
  }

  const showNoticeMsg = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3600);
  };

  const handleCopyMode = async (mode: SmartCopyMode = 'details_table') => {
    setCopyMenuOpen(false);
    const text = formatSelectedRecordsCopy(
      selectedRecords,
      mode,
      calculationSettings,
      { title: tableTitle, date: tableDate }
    );
    try {
      await navigator.clipboard?.writeText(text);
      const label =
        mode === 'names_only'
          ? 'الأسماء فقط'
          : mode === 'share_summary'
          ? 'تقرير المشاركة'
          : 'البيانات والحصص والمبالغ';
      showNoticeMsg(`تم نسخ (${label}) لـ ${selectedRecords.length} سجل بنجاح.`);
    } catch {
      showNoticeMsg('تعذر الوصول للحافظة تلقائيًا — افتح معلومات كاملة للنسخ.');
    }
  };

  const handleCopy = () => handleCopyMode('details_table');

  const handleExportImage = async () => {
    try {
      setExportingImg(true);
      await exportSelectedRecordsToImage({
        title: tableTitle,
        date: tableDate,
        records: selectedRecords,
        settings: calculationSettings,
      });
      showNoticeMsg(
        selectedRecords.length === 1
          ? `تم حفظ بطاقة الصورة لـ ${selectedRecords[0].name}.`
          : `تم حفظ صورة المجموعة (${selectedRecords.length} أسماء).`
      );
    } catch (err) {
      showNoticeMsg(
        err instanceof Error ? err.message : 'تعذر تحويل المحدد إلى صورة.'
      );
    } finally {
      setExportingImg(false);
    }
  };

  const primary = selectedRecords[0];
  const primaryEff = getEffectiveAllocationForPerson(
    primary,
    calculationSettings
  );

  return (
    <section
      aria-label="شريط الإجراءات العلوي للمحددين"
      data-testid="selection-action-bar"
      className="no-print md:sticky md:top-2 z-[35] space-y-2.5 rounded-xl border p-3 shadow-md"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--accent)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Row: Selection Count + Live Multi-Metric Aggregates */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 text-xs"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold tabular-nums whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>المحدد: {aggregates.count}</span>
          </span>

          {selectedRecords.length < totalVisibleCount && (
            <button
              type="button"
              onClick={onSelectAll}
              className="min-h-[34px] rounded-lg border px-2.5 py-1 font-semibold whitespace-nowrap hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              تحديد الكل ({totalVisibleCount})
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowQuickDetails(false);
              setConfirmDeleteOpen(false);
              onClearSelection();
            }}
            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold whitespace-nowrap hover:opacity-85"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <X className="h-3.5 w-3.5" />
            <span>إلغاء التحديد</span>
          </button>
        </div>

        {/* Live Aggregate Totals Strip */}
        <div
          data-testid="selection-aggregates-strip"
          className="flex flex-wrap items-center gap-3 text-xs tabular-nums"
        >
          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text-muted)' }}>صافي الأفراد:</span>
            <span className="font-extrabold">
              {aggregates.totalEligibleIndividuals} فرد
            </span>
          </div>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text-muted)' }}>إجمالي الحصة:</span>
            <span className="font-extrabold" style={{ color: 'var(--accent)' }}>
              {aggregates.quotaLabel}
            </span>
          </div>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <div className="flex items-center gap-1">
            <span style={{ color: 'var(--text-muted)' }}>إجمالي المبلغ:</span>
            <span className="font-extrabold" style={{ color: 'var(--success)' }}>
              {aggregates.priceLabel}
            </span>
          </div>
          {aggregates.blockedRecordsCount > 0 && (
            <>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span className="font-bold" style={{ color: 'var(--warning)' }}>
                {aggregates.blockedRecordsCount} مستبعد/محجوب
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowQuickDetails((v) => !v)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
            style={{
              backgroundColor: showQuickDetails
                ? 'var(--bg-nav-active)'
                : 'var(--bg-main)',
              borderColor: showQuickDetails
                ? 'var(--accent)'
                : 'var(--border-color)',
              color: showQuickDetails ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>إظهار التفاصيل</span>
          </button>

          <button
            type="button"
            onClick={() => setFullInfoOpen(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <FileText className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>معلومات كاملة</span>
          </button>

          {!readOnlyArchiveMode && (
            <button
              type="button"
              onClick={() => {
                setMoveMode(readyLists.length > 0 ? 'ready_list' : 'agency');
                if (readyLists.length > 0 && !targetListId) {
                  setTargetListId(readyLists[0].id);
                }
                setMoveModalOpen(true);
              }}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>نقل</span>
            </button>
          )}

          {!readOnlyArchiveMode &&
            linkedPersonIds.length > 0 &&
            onBulkUpdateStatusAndCategory && (
              <button
                type="button"
                onClick={() => {
                  setBatchBlockType('keep');
                  setBatchCategory('__keep__');
                  setBatchBlockReason('');
                  setBatchEditOpen(true);
                }}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <SlidersHorizontal
                  className="h-3.5 w-3.5"
                  style={{ color: 'var(--accent)' }}
                />
                <span>تعديل جماعي</span>
              </button>
            )}

          {!readOnlyArchiveMode &&
            linkedPersonIds.length > 0 &&
            onCreateReadyListFromSelection && (
              <button
                type="button"
                onClick={() => {
                  setNewReadyListName(
                    `قائمة توزيع (${linkedPersonIds.length}) · ${new Date()
                      .toISOString()
                      .slice(0, 10)}`
                  );
                  setCreateListOpen(true);
                }}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <FilePlus2
                  className="h-3.5 w-3.5"
                  style={{ color: 'var(--accent)' }}
                />
                <span>إنشاء قائمة توزيع</span>
              </button>
            )}

          <button
            type="button"
            onClick={() => setSnippetModalOpen(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-3 py-1.5 font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <Scissors className="h-3.5 w-3.5" />
            <span>تصدير حقل / قصاصة</span>
          </button>

          <button
            type="button"
            disabled={exportingImg}
            onClick={handleExportImage}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <ImageIcon className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>{exportingImg ? 'جارٍ التحويل...' : 'تحويله كصورة'}</span>
          </button>

          {/* Smart Formatted Copy Dropdown */}
          <div ref={copyMenuRef} className="relative">
            <div className="inline-flex items-stretch">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-r-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Copy className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>نسخ سريع</span>
              </button>
              <button
                type="button"
                aria-label="خيارات صيغة النسخ الذكي"
                aria-expanded={copyMenuOpen}
                onClick={() => setCopyMenuOpen((v) => !v)}
                className="inline-flex min-h-[36px] items-center rounded-l-lg border border-r-0 px-2 py-1.5 font-bold"
                style={{
                  backgroundColor: copyMenuOpen
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {copyMenuOpen && (
              <div
                role="menu"
                aria-label="صيغ النسخ الذكي"
                className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border p-1.5 shadow-xl space-y-1"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleCopyMode('names_only')}
                  className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-right hover:bg-[var(--bg-main)]"
                >
                  <span className="font-bold">نسخ الأسماء فقط</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    قائمة مرقمة للأسماء المحددة دون أرقام
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleCopyMode('details_table')}
                  className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-right hover:bg-[var(--bg-main)]"
                >
                  <span className="font-bold">الأسماء + الأفراد + الحصة + المبلغ</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    تفاصيل الأكياس والكغم والمبالغ مع الإجمالي
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleCopyMode('share_summary')}
                  className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-right hover:bg-[var(--bg-main)]"
                >
                  <span className="font-bold">تقرير جاهز للمشاركة (واتساب / طباعة)</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    كشف منسق بعنوان وتاريخ ومجاميع ختامية
                  </span>
                </button>
              </div>
            )}
          </div>

          {!readOnlyArchiveMode && linkedPersonIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRelNote('');
                setRelAddress('');
                setRelPhone('');
                setRelTime('');
                setRelationModalOpen(true);
              }}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              <span>إضافة للعلاقات</span>
            </button>
          )}
        </div>

        {!readOnlyArchiveMode && onBulkDeleteSelected && (
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen((v) => !v)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
            style={{
              backgroundColor: confirmDeleteOpen
                ? 'var(--danger)'
                : 'var(--bg-main)',
              borderColor: 'var(--danger)',
              color: confirmDeleteOpen ? '#ffffff' : 'var(--danger)',
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>حذف المحدد ({selectedRecords.length})</span>
          </button>
        )}
      </div>

      {/* Inline Safe Bulk Delete Confirmation Bar */}
      {confirmDeleteOpen && onBulkDeleteSelected && (
        <div
          role="alertdialog"
          aria-label="تأكيد الحذف الجماعي الآمن"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
          style={{
            backgroundColor: 'var(--danger-bg, var(--bg-main))',
            borderColor: 'var(--danger)',
          }}
        >
          <span className="font-bold">
            سيتم نقل {selectedRecords.length} سجل إلى سلة المهملات بأمان (يمكنك الاسترجاع والتراجع مباشرة).
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const count = selectedRecords.length;
                onBulkDeleteSelected(selectedRecords);
                setConfirmDeleteOpen(false);
                setLastDeletedBanner({ count });
                onClearSelection();
              }}
              className="min-h-[34px] rounded-lg px-3 py-1 font-bold text-white"
              style={{ backgroundColor: 'var(--danger)' }}
            >
              تأكيد النقل لسلة المهملات
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              className="min-h-[34px] rounded-lg border px-3 py-1 font-semibold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border px-3 py-1.5 text-xs font-bold"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success)',
            color: 'var(--success)',
          }}
        >
          {notice}
        </div>
      )}

      {/* Expandable Quick Details Strip */}
      {showQuickDetails && (
        <div
          className="grid grid-cols-1 gap-2 rounded-lg border p-3 text-xs sm:grid-cols-2 lg:grid-cols-4"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {selectedRecords.length === 1 ? (
            <>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>الاسم والوكالة</div>
                <div className="font-bold">
                  {primary.name}
                  {primary.agencyName ? ` — ${primary.agencyName}` : ''}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>الأفراد والحصة</div>
                <div className="font-bold tabular-nums">
                  {primaryEff.eligibleIndividuals ?? 0} أفراد · {primaryEff.quotaText}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>المبلغ والحالة</div>
                <div className="font-bold tabular-nums">
                  {primaryEff.priceText} · {primaryEff.summary.shortLabel}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>ملاحظات / بطاقة</div>
                <div className="font-semibold">
                  {primary.notes || 'لا توجد ملاحظات'}
                  {primary.nationalId ? ` (${primary.nationalId})` : ''}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>عدد المحددين</div>
                <div className="font-bold tabular-nums">
                  {selectedRecords.length} أسماء
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>مجموع الأفراد المستحقة</div>
                <div className="font-bold tabular-nums">
                  {summaryTotals.individuals} أفراد
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>مجموع المبلغ</div>
                <div className="font-bold tabular-nums" style={{ color: 'var(--success)' }}>
                  {summaryTotals.totalIqd.toLocaleString('en-US')} د.ع
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>الأسماء</div>
                <div className="truncate font-semibold">
                  {selectedRecords.map((r) => r.name).join('، ')}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Full Info Modal */}
      {fullInfoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="المعلومات الكاملة والمفصلة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setFullInfoOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border p-5 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                معلومات كاملة ومفصلة ({selectedRecords.length})
              </h3>
              <button
                type="button"
                onClick={() => setFullInfoOpen(false)}
                aria-label="إغلاق"
                className="rounded p-1 hover:opacity-75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {selectedRecords.map((rec) => {
                const eff = getEffectiveAllocationForPerson(
                  rec,
                  calculationSettings
                );
                const personRelations = rec.personId
                  ? relations.filter((rel) => rel.personId === rec.personId)
                  : [];

                return (
                  <div
                    key={rec.selectionKey}
                    className="space-y-2.5 rounded-xl border p-4 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-bold">{rec.name}</div>
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: 'var(--bg-nav-active)',
                          color: 'var(--accent)',
                        }}
                      >
                        {rec.agencyName || tableTitle}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>البطاقة: </span>
                        <span className="font-bold tabular-nums">
                          {rec.nationalId || '—'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>إجمالي الأفراد: </span>
                        <span className="font-bold tabular-nums">
                          {rec.individuals ?? '—'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>المستحقون: </span>
                        <span className="font-bold tabular-nums">
                          {eff.eligibleIndividuals ?? 0}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>الحصة: </span>
                        <span className="font-bold tabular-nums">{eff.quotaText}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>المبلغ: </span>
                        <span className="font-bold tabular-nums">{eff.priceText}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>الحالة: </span>
                        <span className="font-bold">{eff.summary.shortLabel}</span>
                      </div>
                    </div>

                    {rec.blockReason && (
                      <div>
                        <span style={{ color: 'var(--danger)' }}>سبب الحظر: </span>
                        <span>{rec.blockReason}</span>
                      </div>
                    )}

                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>الملاحظات: </span>
                      <span>{rec.notes || 'لا توجد'}</span>
                    </div>

                    {rec.updatedAt && (
                      <div style={{ color: 'var(--text-muted)' }}>
                        تاريخ السجل: <span className="tabular-nums">{rec.updatedAt}</span>
                      </div>
                    )}

                    {personRelations.length > 0 && (
                      <div className="space-y-1 border-t pt-2" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="font-bold" style={{ color: 'var(--accent)' }}>
                          وسوم وملاحظات العلاقات:
                        </div>
                        {personRelations.map((rel) => {
                          const meta = getRelationCategoryMeta(rel.category);
                          return (
                            <div key={rel.id} className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                                style={{
                                  backgroundColor: meta.badgeBgVar,
                                  color: meta.badgeColorVar,
                                }}
                              >
                                {meta.label}
                              </span>
                              <span>{rel.note}</span>
                              {rel.deliveryAddress && <span>· {rel.deliveryAddress}</span>}
                              {rel.deliveryPhone && <span dir="ltr">· {rel.deliveryPhone}</span>}
                              {rel.reminderDate && <span className="tabular-nums">· تذكير: {rel.reminderDate}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 font-bold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ التقرير</span>
              </button>
              <button
                type="button"
                onClick={() => setFullInfoOpen(false)}
                className="rounded-lg px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal (To Another Agency OR To Ready List) */}
      {moveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="نقل الأسماء المحددة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setMoveModalOpen(false)}
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
              <h3 className="text-base font-bold">
                نقل أو إلحاق المحددين ({selectedRecords.length})
              </h3>
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                aria-label="إغلاق"
                className="rounded p-1 hover:opacity-75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {linkedPersonIds.length === 0 ? (
              <div className="space-y-3 text-xs">
                <p style={{ color: 'var(--text-muted)' }}>
                  الأسماء المحددة مضافة يدويًا داخل هذه القائمة الجاهزة فقط ولا ترتبط بسجل وكالة رئيسي.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMoveModalOpen(false)}
                    className="rounded-lg px-4 py-2 font-bold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    حسناً
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMoveMode('ready_list')}
                    className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-bold"
                    style={{
                      backgroundColor:
                        moveMode === 'ready_list'
                          ? 'var(--bg-nav-active)'
                          : 'var(--bg-main)',
                      borderColor:
                        moveMode === 'ready_list'
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                      color:
                        moveMode === 'ready_list'
                          ? 'var(--accent)'
                          : 'var(--text-primary)',
                    }}
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                    <span>إلى قائمة جاهزة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveMode('agency')}
                    className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-bold"
                    style={{
                      backgroundColor:
                        moveMode === 'agency'
                          ? 'var(--bg-nav-active)'
                          : 'var(--bg-main)',
                      borderColor:
                        moveMode === 'agency'
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                      color:
                        moveMode === 'agency'
                          ? 'var(--accent)'
                          : 'var(--text-primary)',
                    }}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    <span>نقل لوكالة أخرى</span>
                  </button>
                </div>

                {moveMode === 'ready_list' ? (
                  readyLists.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>
                      لا توجد قوائم جاهزة حاليًا. أنشئ قائمة جاهزة أولًا.
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block font-medium">
                        اختر القائمة الجاهزة المستهدفة
                      </label>
                      <select
                        value={targetListId}
                        onChange={(e) => setTargetListId(Number(e.target.value))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        {readyLists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.listDate})
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                ) : (
                  <div>
                    <label className="mb-1 block font-medium">
                      اختر الوكالة الجديدة لنقل ({linkedPersonIds.length}) مستفيد
                    </label>
                    <select
                      value={targetAgencyId}
                      onChange={(e) => setTargetAgencyId(Number(e.target.value))}
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
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMoveModalOpen(false)}
                    className="rounded-lg border px-4 py-2 font-semibold"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={moveMode === 'ready_list' && readyLists.length === 0}
                    onClick={() => {
                      if (moveMode === 'ready_list') {
                        const added = onAddToReadyList(
                          targetListId || readyLists[0]?.id,
                          linkedPersonIds
                        );
                        showNoticeMsg(
                          added > 0
                            ? `تمت إضافة ${added} اسم للقائمة الجاهزة.`
                            : 'الأسماء المحددة مضافة مسبقًا في تلك القائمة.'
                        );
                      } else {
                        onMoveToAgency(linkedPersonIds, targetAgencyId);
                        const agName =
                          agencies.find((a) => a.id === targetAgencyId)?.name ||
                          '';
                        showNoticeMsg(
                          `تم نقل ${linkedPersonIds.length} سجل إلى ${agName}.`
                        );
                      }
                      setMoveModalOpen(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-4 py-2 font-bold disabled:opacity-45"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>تأكيد التنفيذ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add to Relationships Modal */}
      {relationModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="إضافة المحددين إلى قسم العلاقات"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setRelationModalOpen(false)}
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
              <h3 className="text-base font-bold">
                إضافة إلى قسم العلاقات ({linkedPersonIds.length})
              </h3>
              <button
                type="button"
                onClick={() => setRelationModalOpen(false)}
                aria-label="إغلاق"
                className="rounded p-1 hover:opacity-75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                for (const pid of linkedPersonIds) {
                  onUpsertRelation({
                    personId: pid,
                    category: relCategory,
                    note: relNote,
                    reminderDate:
                      relCategory === 'reminder' ? relReminderDate : undefined,
                    deliveryAddress:
                      relCategory === 'delivery_notes' ? relAddress : undefined,
                    deliveryPhone:
                      relCategory === 'delivery_notes' ? relPhone : undefined,
                    deliveryTime:
                      relCategory === 'delivery_notes' ? relTime : undefined,
                  });
                }
                const meta = getRelationCategoryMeta(relCategory);
                showNoticeMsg(
                  `تم حفظ ${linkedPersonIds.length} اسم في قسم «${meta.label}».`
                );
                setRelationModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="mb-1 block font-medium">تصنيف العلاقة</label>
                <select
                  value={relCategory}
                  onChange={(e) =>
                    setRelCategory(e.target.value as RelationCategory)
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
                  الملاحظة / سبب الإدراج
                </label>
                <input
                  type="text"
                  value={relNote}
                  onChange={(e) => setRelNote(e.target.value)}
                  placeholder="مثال: مراجعة عدد الأفراد أو توصيل للباب"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              {relCategory === 'reminder' && (
                <div>
                  <label className="mb-1 block font-medium">تاريخ التذكير</label>
                  <input
                    type="date"
                    value={relReminderDate}
                    onChange={(e) => setRelReminderDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              )}

              {relCategory === 'delivery_notes' && (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block font-medium">عنوان السكن / الدلالة</label>
                    <input
                      type="text"
                      value={relAddress}
                      onChange={(e) => setRelAddress(e.target.value)}
                      placeholder="مثال: قرب جامع النور - زقاق 5"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block font-medium">رقم الهاتف</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={relPhone}
                        onChange={(e) => setRelPhone(e.target.value)}
                        placeholder="0770..."
                        className="w-full rounded-lg border px-3 py-2 text-left text-sm tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium">الوقت المناسب</label>
                      <input
                        type="text"
                        value={relTime}
                        onChange={(e) => setRelTime(e.target.value)}
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
                  onClick={() => setRelationModalOpen(false)}
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
                  <span>حفظ في العلاقات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Status & Category Modal */}
      {batchEditOpen && onBulkUpdateStatusAndCategory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="التعديل الجماعي للحالة والفئة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setBatchEditOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const patch: {
                blockType?: BlockScope;
                blockedIndividuals?: number;
                blockReason?: string;
                customCategory?: string;
              } = {};
              if (batchBlockType !== 'keep') {
                patch.blockType = batchBlockType;
                if (batchBlockType === 'partial') {
                  patch.blockedIndividuals = Math.max(
                    1,
                    Number(batchPartialBlocked) || 1
                  );
                }
                if (batchBlockReason.trim()) {
                  patch.blockReason = batchBlockReason.trim();
                }
              }
              if (batchCategory !== '__keep__') {
                patch.customCategory = batchCategory;
              }
              onBulkUpdateStatusAndCategory(linkedPersonIds, patch);
              showNoticeMsg(
                `تم تطبيق التعديل الجماعي على ${linkedPersonIds.length} سجل.`
              );
              setBatchEditOpen(false);
            }}
            className="w-full max-w-md space-y-4 rounded-xl border p-5 text-xs shadow-xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                تعديل جماعي للحالة والفئة ({linkedPersonIds.length})
              </h3>
              <button
                type="button"
                onClick={() => setBatchEditOpen(false)}
                aria-label="إغلاق"
                className="rounded p-1 hover:opacity-75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block font-bold">تحديث الحالة / الحجب</label>
              <select
                value={batchBlockType}
                onChange={(e) =>
                  setBatchBlockType(e.target.value as 'keep' | BlockScope)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="keep">عدم تغيير الحالة الحالية</option>
                <option value="none">نشط (إزالة الحجب بالكامل)</option>
                <option value="partial">حجب جزئي (تحديد عدد محجوبين)</option>
                <option value="full">حجب كلي (استبعاد كامل العائلة)</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>

            {batchBlockType === 'partial' && (
              <div>
                <label className="mb-1 block font-bold">
                  عدد الأفراد المحجوبين لكل سجل
                </label>
                <input
                  type="number"
                  min={1}
                  value={batchPartialBlocked}
                  onChange={(e) => setBatchPartialBlocked(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
            )}

            {batchBlockType !== 'keep' && batchBlockType !== 'none' && (
              <div>
                <label className="mb-1 block font-bold">سبب التعديل (اختياري)</label>
                <input
                  type="text"
                  value={batchBlockReason}
                  onChange={(e) => setBatchBlockReason(e.target.value)}
                  placeholder="مثال: تحديث بيانات الشهر الحالي"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block font-bold">تعيين الفئة المخصصة</label>
              <select
                value={batchCategory}
                onChange={(e) => setBatchCategory(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="__keep__">عدم تغيير الفئة الحالية</option>
                <option value="">بدون فئة</option>
                {customCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBatchEditOpen(false)}
                className="rounded-lg border px-4 py-2 font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={
                  batchBlockType === 'keep' && batchCategory === '__keep__'
                }
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 font-bold disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Check className="h-3.5 w-3.5" />
                <span>تطبيق التعديلات</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Ready List Directly From Selection Modal */}
      {createListOpen && onCreateReadyListFromSelection && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="إنشاء قائمة توزيع مباشرة من المحددين"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setCreateListOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = onCreateReadyListFromSelection({
                name: newReadyListName.trim(),
                personIds: linkedPersonIds,
              });
              showNoticeMsg(
                `تم إنشاء قائمة توزيع جديدة وتعبئتها بـ ${
                  res && typeof res === 'object'
                    ? res.addedCount
                    : linkedPersonIds.length
                } مستفيد.`
              );
              setCreateListOpen(false);
            }}
            className="w-full max-w-md space-y-4 rounded-xl border p-5 text-xs shadow-xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                إنشاء قائمة توزيع جديدة ({linkedPersonIds.length} مستفيد)
              </h3>
              <button
                type="button"
                onClick={() => setCreateListOpen(false)}
                aria-label="إغلاق"
                className="rounded p-1 hover:opacity-75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block font-bold">اسم القائمة الجاهزة</label>
              <input
                type="text"
                required
                value={newReadyListName}
                onChange={(e) => setNewReadyListName(e.target.value)}
                placeholder="مثال: وجبة توزيع قطاع الشمال..."
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <div
              className="rounded-lg border p-3 tabular-nums"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="font-bold">ملخص القائمة التي سيتم إنشاؤها:</div>
              <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                {aggregates.count} سجل · {aggregates.totalEligibleIndividuals}{' '}
                فرد · {aggregates.quotaLabel} · {aggregates.priceLabel}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCreateListOpen(false)}
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
                <FilePlus2 className="h-3.5 w-3.5" />
                <span>إنشاء القائمة وحفظها</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <SnippetExportModal
        open={snippetModalOpen}
        tableTitle={tableTitle}
        tableSubtitle={
          tableDate ? `التاريخ المرجعي للجدول: ${tableDate}` : undefined
        }
        periodMeta={periodMeta}
        freeformHeader={freeformHeader}
        records={selectedRecords}
        settings={calculationSettings}
        onClose={() => setSnippetModalOpen(false)}
      />
    </section>
  );
};
