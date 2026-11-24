import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Edit3, Trash2 } from 'lucide-react';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../utils/tabrixMotion';
import type {
  BlockScope,
  CalculationSettings,
  ExpertTableConfig,
  QuickExtractEvaluatedRow,
  ThemePreferences,
} from '../types/agency';
import {
  getEffectiveAllocationForPerson,
  initialLetter,
  normalizeArabic,
} from '../utils/agencyLogic';
import { resolveTableThemeId } from '../utils/themes';

export interface CoreRosterRow {
  rowKey: string;
  selectionId: string;
  agencyId: number;
  agencyName?: string;
  name: string;
  nationalId?: string;
  individuals: number | null;
  legacyQuantity?: string;
  blockType?: BlockScope;
  blockedIndividuals?: number;
  blockReason?: string;
  status?: '' | 'محجوب' | 'مؤرشف';
  notes: string;
  customCategory?: string;
  customFields?: Record<string, string>;
  // Optional Quick Extract Stage-4 fields
  extractSource?: QuickExtractEvaluatedRow;
  extractDecreaseCount?: number | null;
  extractAddOrDeleteCount?: number | null;
  extractAddOrDeleteAction?: 'إضافة' | 'حذف' | 'لا يوجد';
  destinationLabel?: string;
  routeActionLabel?: string;
  routeActionTone?: 'success' | 'warning' | 'accent' | 'danger' | 'muted';
  routeOverrideValue?: 'auto' | 'update_matched' | 'add_new' | 'replace' | 'exclude';
}

export interface CoreRosterInlinePatch {
  name?: string;
  individuals?: number | null;
  decreaseCount?: number | null;
  addOrDeleteCount?: number | null;
  addOrDeleteAction?: 'إضافة' | 'حذف' | 'لا يوجد';
  notes?: string;
  customCategory?: string;
  customFields?: Record<string, string>;
}

interface CoreRosterTableProps {
  rows: CoreRosterRow[];
  selectedIds: string[];
  focusedRowKey: string | null;
  calculationSettings: CalculationSettings;
  themePrefs: ThemePreferences;
  expertTableConfig?: ExpertTableConfig;
  showAgencyColumn?: boolean;
  showExtractColumns?: boolean;
  showEditActions?: boolean;
  editableInline?: boolean;
  locked?: boolean;
  onLockedInteraction?: () => void;
  attachedHeader?: React.ReactNode;
  allowRowFocusOnClick?: boolean;
  emptyMessage?: string;
  onToggleSelectRow: (selectionId: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onFocusRow?: (rowKey: string | null) => void;
  onEditRowModal?: (row: CoreRosterRow) => void;
  onDeleteRowModal?: (row: CoreRosterRow) => void;
  onInlinePatchRow?: (rowKey: string, patch: CoreRosterInlinePatch) => void;
  onOverrideRowRoute?: (
    rowKey: string,
    mode: 'auto' | 'update_matched' | 'add_new' | 'replace' | 'exclude'
  ) => void;
}

const DEFAULT_COLUMN_LABELS: Record<string, string> = {
  serial: '#',
  letter: 'الحرف',
  name: 'الاسم',
  agency: 'الوكالة',
  category: 'الفئة',
  individuals: 'الأفراد',
  quantity: 'الحصة',
  price: 'المبلغ',
  status: 'الحالة',
  notes: 'الملاحظات',
};

const DEFAULT_CORE_ORDER = [
  'serial',
  'letter',
  'name',
  'agency',
  'individuals',
  'quantity',
  'price',
  'status',
  'notes',
];

export const CoreRosterTable: React.FC<CoreRosterTableProps> = ({
  rows,
  selectedIds,
  focusedRowKey,
  calculationSettings,
  themePrefs,
  expertTableConfig,
  showAgencyColumn = false,
  showExtractColumns = false,
  showEditActions = false,
  editableInline = false,
  locked = false,
  onLockedInteraction,
  attachedHeader,
  allowRowFocusOnClick = false,
  emptyMessage = 'لا توجد سجلات مطابقة في هذا الجدول.',
  onToggleSelectRow,
  onToggleSelectAll,
  onFocusRow,
  onEditRowModal,
  onDeleteRowModal,
  onInlinePatchRow,
  onOverrideRowRoute,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const effectiveInlineEdit = editableInline && !locked;
  const effectiveShowEditActions = showEditActions && !locked;
  const canTapRowToFocus =
    Boolean(onFocusRow) && (themePrefs.activeRowFocusMode || allowRowFocusOnClick);
  const numClass = themePrefs.tabularNumerals ? 'font-data tabular-nums' : '';
  const numericTintStyle = themePrefs.smartNumericSplit
    ? { backgroundColor: 'var(--bg-numeric)' }
    : undefined;
  const focusActive =
    themePrefs.activeRowFocusMode && focusedRowKey !== null;

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => selectedSet.has(r.selectionId));

  const customColMap = new Map(
    (expertTableConfig?.customColumns || []).map((c) => [c.id, c])
  );

  // Build effective ordered visible column IDs
  const orderedColumns: string[] = (() => {
    if (showExtractColumns) {
      return [
        'serial',
        'letter',
        'name',
        ...(showAgencyColumn ? ['agency'] : []),
        'individuals',
        'extract_decrease',
        'extract_add_delete',
        'quantity',
        'price',
        'status',
        'extract_route',
        'notes',
      ];
    }

    if (!expertTableConfig) {
      return DEFAULT_CORE_ORDER.filter(
        (id) => id !== 'agency' || showAgencyColumn
      );
    }

    const visibleSet = new Set(expertTableConfig.visibleColumns);
    const customIds = (expertTableConfig.customColumns || []).map((c) => c.id);
    const mergedOrder = Array.from(
      new Set([
        ...expertTableConfig.columnOrder,
        ...DEFAULT_CORE_ORDER,
        'category',
        ...customIds,
      ])
    );

    const active = mergedOrder.filter((id) => {
      if (id === 'agency' && !showAgencyColumn) return false;
      if (!visibleSet.has(id)) return false;
      if (id.startsWith('custom_') && !customColMap.has(id)) return false;
      return true;
    });

    return active.length > 0 ? active : ['serial', 'name', 'individuals'];
  })();

  const resolvedTableTheme = resolveTableThemeId(themePrefs.tableTheme);
  const condRules = themePrefs.conditionalFormatting || {
    highlightBlockedRows: true,
    highlightDuplicateNames: true,
    highlightZeroIndividuals: true,
  };

  const duplicateNameSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = normalizeArabic(r.name);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dups = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) dups.add(key);
    });
    return dups;
  }, [rows]);

  const getHeaderLabel = (colId: string): string => {
    if (colId === 'individuals' && showExtractColumns) {
      return 'الصافي (الأفراد)';
    }
    if (colId === 'extract_decrease') return 'النزول / النقصان';
    if (colId === 'extract_add_delete') return 'الإضافة / الحذف';
    if (colId === 'extract_route') return 'التوجيه والإجراء';
    if (expertTableConfig?.columnLabels?.[colId]) {
      return expertTableConfig.columnLabels[colId];
    }
    const custom = customColMap.get(colId);
    if (custom) return custom.label;
    return DEFAULT_COLUMN_LABELS[colId] || colId;
  };

  const totalColSpan =
    1 + orderedColumns.length + (effectiveShowEditActions ? 1 : 0);

  if (resolvedTableTheme === 'card-based') {
    return (
      <div className="space-y-3">
        <div className="nexus-squircle overflow-hidden">
          {attachedHeader}
          <div className="flex items-center justify-between px-4 py-2.5 text-xs">
            <label
              onClick={() => {
                if (locked) onLockedInteraction?.();
              }}
              className={`flex items-center gap-2 font-bold ${
                locked ? 'cursor-not-allowed opacity-65' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                disabled={locked}
                aria-label="تحديد جميع الأسماء الظاهرة"
                checked={allVisibleSelected}
                onChange={(e) => {
                  if (locked) {
                    onLockedInteraction?.();
                    return;
                  }
                  onToggleSelectAll(e.target.checked);
                }}
              />
              <span>تحديد الكل ({rows.length})</span>
            </label>
            <span style={{ color: 'var(--text-muted)' }}>
              {locked ? 'الجدول مقفل للقراءة الآمنة' : 'وضع العرض البطاقي المرن'}
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div
            className="nexus-squircle py-10 text-center text-xs"
            style={{
              color: 'var(--text-muted)',
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row, index) => {
              const eff = getEffectiveAllocationForPerson(
                {
                  individuals: row.individuals,
                  legacyQuantity: row.legacyQuantity,
                  status: row.status,
                  blockType: row.blockType,
                  blockedIndividuals: row.blockedIndividuals,
                },
                calculationSettings
              );
              const isBlocked =
                eff.summary.scope === 'full' ||
                eff.summary.scope === 'archived';
              const isDup =
                condRules.highlightDuplicateNames &&
                duplicateNameSet.has(normalizeArabic(row.name));
              const isZeroInd =
                condRules.highlightZeroIndividuals &&
                !isBlocked &&
                (eff.eligibleIndividuals === 0 || row.individuals === 0);
              const highlightBlocked =
                condRules.highlightBlockedRows && isBlocked;
              const isRowSelected = selectedSet.has(row.selectionId);
              const isFocused =
                (themePrefs.activeRowFocusMode || allowRowFocusOnClick) &&
                focusedRowKey === row.rowKey;

              const statusColor =
                eff.summary.scope === 'none'
                  ? 'var(--success)'
                  : eff.summary.scope === 'partial'
                  ? 'var(--warning)'
                  : 'var(--danger)';

              return (
                <div
                  key={row.rowKey}
                  data-row-key={row.rowKey}
                  onClick={() => {
                    if (locked) {
                      onLockedInteraction?.();
                      return;
                    }
                    if (canTapRowToFocus && onFocusRow) {
                      onFocusRow(
                        focusedRowKey === row.rowKey ? null : row.rowKey
                      );
                    }
                  }}
                  className={`nexus-squircle nexus-squircle-interactive flex flex-col justify-between gap-3 p-4 text-xs ${
                    canTapRowToFocus && !locked ? 'cursor-pointer' : ''
                  }`}
                  style={{
                    backgroundColor: isRowSelected || isFocused
                      ? 'var(--bg-nav-active)'
                      : highlightBlocked
                      ? 'var(--danger-bg)'
                      : isZeroInd
                      ? 'var(--warning-bg)'
                      : 'var(--bg-surface)',
                    borderColor: isRowSelected || isFocused
                      ? 'var(--accent)'
                      : isDup || highlightBlocked
                      ? 'var(--danger)'
                      : isZeroInd
                      ? 'var(--warning)'
                      : 'var(--border-color)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        disabled={locked}
                        aria-label={`تحديد ${row.name}`}
                        checked={isRowSelected}
                        onChange={() => {
                          if (locked) {
                            onLockedInteraction?.();
                            return;
                          }
                          onToggleSelectRow(row.selectionId);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (locked) onLockedInteraction?.();
                        }}
                        className="mt-1 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          <span className={numClass}>#{index + 1}</span>
                          {showAgencyColumn && row.agencyName && (
                            <span>· {row.agencyName}</span>
                          )}
                          {isDup && (
                            <span className="font-bold" style={{ color: 'var(--danger)' }}>
                              · اسم مكرر
                            </span>
                          )}
                          {isZeroInd && (
                            <span className="font-bold" style={{ color: 'var(--warning)' }}>
                              · 0 أفراد
                            </span>
                          )}
                        </div>

                        {effectiveInlineEdit && onInlinePatchRow ? (
                          <input
                            type="text"
                            value={row.name}
                            aria-label={`تعديل اسم ${row.name}`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onInlinePatchRow(row.rowKey, {
                                name: e.target.value,
                              })
                            }
                            className="w-full rounded border px-2 py-1 text-sm font-bold"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: isDup
                                ? 'var(--danger)'
                                : 'var(--border-color)',
                              color: isDup
                                ? 'var(--danger)'
                                : 'var(--text-primary)',
                            }}
                          />
                        ) : (
                          <div
                            className="text-sm font-bold"
                            style={{
                              color: isDup
                                ? 'var(--danger)'
                                : 'var(--text-primary)',
                            }}
                          >
                            {row.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className="shrink-0 font-bold"
                      style={{ color: statusColor }}
                    >
                      {eff.summary.shortLabel}
                    </span>
                  </div>

                  <div
                    className={`grid grid-cols-3 gap-2 rounded-lg border p-2.5 text-center ${numClass}`}
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        الأفراد
                      </div>
                      {effectiveInlineEdit && onInlinePatchRow && !showExtractColumns ? (
                        <input
                          type="number"
                          min={0}
                          aria-label={`أفراد ${row.name}`}
                          value={row.individuals ?? 0}
                          onChange={(e) =>
                            onInlinePatchRow(row.rowKey, {
                              individuals:
                                e.target.value === ''
                                  ? 0
                                  : Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="mt-0.5 w-14 rounded border px-1 py-0.5 text-center text-xs font-bold tabular-nums"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        />
                      ) : (
                        <div className="font-bold">
                          {eff.eligibleIndividuals ?? '—'}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        الحصة
                      </div>
                      <div className="font-bold">{eff.quotaText}</div>
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        المبلغ
                      </div>
                      <div className="font-bold">{eff.priceText}</div>
                    </div>
                  </div>

                  {(row.notes || (effectiveInlineEdit && onInlinePatchRow) || effectiveShowEditActions) && (
                    <div
                      className="flex items-center justify-between gap-2 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {effectiveInlineEdit && onInlinePatchRow ? (
                        <input
                          type="text"
                          value={row.notes}
                          aria-label={`ملاحظات ${row.name}`}
                          placeholder="أضف ملاحظة..."
                          onChange={(e) =>
                            onInlinePatchRow(row.rowKey, {
                              notes: e.target.value,
                            })
                          }
                          className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        />
                      ) : (
                        <span
                          className="truncate"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {row.notes || '—'}
                        </span>
                      )}

                      {effectiveShowEditActions && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {onEditRowModal && (
                            <motion.button
                              type="button"
                              whileHover={reducedMotion ? undefined : { scale: 1.08 }}
                              whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                              transition={TABRIX_TACTILE_SPRING}
                              onClick={() => onEditRowModal(row)}
                              aria-label={`تعديل ${row.name}`}
                              className="nexus-pill-btn border p-1.5 hover:opacity-85"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </motion.button>
                          )}
                          {onDeleteRowModal && (
                            <motion.button
                              type="button"
                              whileHover={reducedMotion ? undefined : { scale: 1.08 }}
                              whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                              transition={TABRIX_TACTILE_SPRING}
                              onClick={() => onDeleteRowModal(row)}
                              aria-label={`حذف ${row.name}`}
                              className="nexus-pill-btn border p-1.5 hover:opacity-85"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--danger)',
                                color: 'var(--danger)',
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="nexus-squircle overflow-hidden">
      {attachedHeader}
      <div
        className={`overflow-auto px-1.5 sm:px-2 pb-2 ${
          themePrefs.stickyHeaderAndName ? 'max-h-[72vh]' : ''
        }`}
      >
        <table
          className={`agency-table ${
            resolvedTableTheme === 'paper-ledger' ? '' : 'nexus-slab-table'
          } theme-${resolvedTableTheme} ${
            themePrefs.rowHoverHighlight ? 'hover-highlight' : ''
          } ${focusActive ? 'has-focused-row' : ''} text-right text-xs sm:text-sm`}
        >
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
              <th
                onClick={() => {
                  if (locked) onLockedInteraction?.();
                }}
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
                  disabled={locked}
                  aria-label="تحديد جميع الأسماء الظاهرة"
                  checked={allVisibleSelected}
                  onChange={(e) => {
                    if (locked) {
                      onLockedInteraction?.();
                      return;
                    }
                    onToggleSelectAll(e.target.checked);
                  }}
                />
              </th>

              {orderedColumns.map((colId) => {
                const effectivePinnedColId =
                  expertTableConfig?.pinnedColumnId === undefined
                    ? 'name'
                    : expertTableConfig.pinnedColumnId;
                const isPinned =
                  Boolean(effectivePinnedColId) && colId === effectivePinnedColId;
                const isCentered = [
                  'serial',
                  'letter',
                  'individuals',
                  'extract_decrease',
                  'extract_add_delete',
                  'quantity',
                  'price',
                  'status',
                  'extract_route',
                ].includes(colId);

                return (
                  <th
                    key={colId}
                    data-col-id={colId}
                    data-pinned={isPinned ? 'true' : undefined}
                    className={`border-l px-3 font-bold whitespace-nowrap ${
                      isCentered ? 'text-center' : ''
                    } ${
                      themePrefs.stickyHeaderAndName
                        ? isPinned
                          ? 'sticky right-0 top-0 z-30 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]'
                          : 'sticky top-0 z-20'
                        : isPinned
                        ? 'sticky right-0 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]'
                        : ''
                    }`}
                    style={{
                      borderColor: 'var(--grid-color)',
                      backgroundColor: 'var(--bg-table-header)',
                    }}
                  >
                    {getHeaderLabel(colId)}
                  </th>
                );
              })}

              {effectiveShowEditActions && (
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
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={totalColSpan}
                className="py-10 text-center text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const eff = getEffectiveAllocationForPerson(
                {
                  individuals: row.individuals,
                  legacyQuantity: row.legacyQuantity,
                  status: row.status,
                  blockType: row.blockType,
                  blockedIndividuals: row.blockedIndividuals,
                },
                calculationSettings
              );
              const isBlocked =
                eff.summary.scope === 'full' ||
                eff.summary.scope === 'archived';
              const highlightBlocked =
                condRules.highlightBlockedRows && isBlocked;
              const isDuplicateName =
                condRules.highlightDuplicateNames &&
                duplicateNameSet.has(normalizeArabic(row.name));
              const isZeroInd =
                condRules.highlightZeroIndividuals &&
                !isBlocked &&
                (eff.eligibleIndividuals === 0 || row.individuals === 0);
              const isFocused =
                (themePrefs.activeRowFocusMode || allowRowFocusOnClick) &&
                focusedRowKey === row.rowKey;
              const prevRow = index > 0 ? rows[index - 1] : null;
              const isAgencyGroupBoundary =
                themePrefs.softGroupDividers &&
                showAgencyColumn &&
                prevRow !== null &&
                prevRow.agencyId !== row.agencyId;

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

              const isRowSelected = selectedSet.has(row.selectionId);

              const routeColor =
                row.routeActionTone === 'warning'
                  ? 'var(--warning)'
                  : row.routeActionTone === 'accent'
                  ? 'var(--accent)'
                  : row.routeActionTone === 'danger'
                  ? 'var(--danger)'
                  : row.routeActionTone === 'muted'
                  ? 'var(--text-muted)'
                  : 'var(--success)';

              const groupTopBorder = isAgencyGroupBoundary
                ? '2px solid var(--accent)'
                : undefined;

              return (
                <tr
                  key={row.rowKey}
                  data-row-key={row.rowKey}
                  onClick={() => {
                    if (locked) {
                      onLockedInteraction?.();
                      return;
                    }
                    if (!canTapRowToFocus || !onFocusRow) return;
                    onFocusRow(
                      focusedRowKey === row.rowKey ? null : row.rowKey
                    );
                  }}
                  className={`transition-colors ${
                    highlightBlocked ? 'row-blocked' : ''
                  } ${isZeroInd ? 'row-warning-cond' : ''} ${
                    isFocused ? 'row-focused' : ''
                  } ${canTapRowToFocus && !locked ? 'cursor-pointer' : ''}`}
                  style={{
                    backgroundColor: isRowSelected
                      ? 'var(--bg-nav-active)'
                      : highlightBlocked
                      ? 'var(--danger-bg)'
                      : isZeroInd
                      ? 'var(--warning-bg)'
                      : undefined,
                  }}
                >
                  <td
                    className="border-l px-2.5 text-center"
                    style={{
                      borderColor: 'var(--grid-color)',
                      borderTop: groupTopBorder,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (locked) onLockedInteraction?.();
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={locked}
                      aria-label={`تحديد ${row.name}`}
                      checked={isRowSelected}
                      onChange={() => {
                        if (locked) {
                          onLockedInteraction?.();
                          return;
                        }
                        onToggleSelectRow(row.selectionId);
                      }}
                    />
                  </td>

                  {orderedColumns.map((colId) => {
                    const effectivePinnedColId =
                      expertTableConfig?.pinnedColumnId === undefined
                        ? 'name'
                        : expertTableConfig.pinnedColumnId;
                    const isPinned =
                      Boolean(effectivePinnedColId) &&
                      colId === effectivePinnedColId;
                    const stickyCellClass = isPinned
                      ? 'sticky right-0 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]'
                      : '';
                    const stickyCellBg = isPinned
                      ? isRowSelected || isFocused
                        ? 'var(--bg-nav-active)'
                        : highlightBlocked
                        ? 'var(--danger-bg)'
                        : isZeroInd
                        ? 'var(--warning-bg)'
                        : 'var(--bg-surface)'
                      : undefined;

                    if (colId === 'serial') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass} ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
                            backgroundColor: stickyCellBg,
                          }}
                        >
                          {index + 1}
                        </td>
                      );
                    }

                    if (colId === 'letter') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-2.5 text-center font-bold whitespace-nowrap ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
                            backgroundColor: stickyCellBg,
                          }}
                        >
                          {initialLetter(row.name)}
                        </td>
                      );
                    }

                    if (colId === 'name') {
                      return (
                        <td
                          key={colId}
                          title={isDuplicateName ? 'اسم مكرر في هذا الجدول' : undefined}
                          className={`border-l px-3 font-semibold whitespace-nowrap ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            backgroundColor: isPinned
                              ? isRowSelected || isFocused
                                ? 'var(--bg-nav-active)'
                                : isDuplicateName || highlightBlocked
                                ? 'var(--danger-bg)'
                                : isZeroInd
                                ? 'var(--warning-bg)'
                                : 'var(--bg-surface)'
                              : undefined,
                            color: isDuplicateName ? 'var(--danger)' : undefined,
                            borderTop: groupTopBorder,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (locked) {
                              onLockedInteraction?.();
                              return;
                            }
                            if (!effectiveInlineEdit) {
                              if (allowRowFocusOnClick && onFocusRow) {
                                onFocusRow(
                                  focusedRowKey === row.rowKey
                                    ? null
                                    : row.rowKey
                                );
                              } else {
                                onToggleSelectRow(row.selectionId);
                                if (themePrefs.activeRowFocusMode && onFocusRow) {
                                  onFocusRow(row.rowKey);
                                }
                              }
                            }
                          }}
                        >
                          {effectiveInlineEdit && onInlinePatchRow ? (
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="text"
                                value={row.name}
                                aria-label={`تعديل اسم ${row.name}`}
                                onChange={(e) =>
                                  onInlinePatchRow(row.rowKey, {
                                    name: e.target.value,
                                  })
                                }
                                className="w-44 rounded border px-2 py-1 text-xs font-semibold sm:w-52"
                                style={{
                                  backgroundColor: 'var(--bg-main)',
                                  borderColor: isDuplicateName
                                    ? 'var(--danger)'
                                    : 'var(--border-color)',
                                  color: isDuplicateName
                                    ? 'var(--danger)'
                                    : undefined,
                                }}
                              />
                              {isDuplicateName && (
                                <span
                                  className="text-[10px] font-bold"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  مكرر
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`تحديد ${row.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSelectRow(row.selectionId);
                                  if (themePrefs.activeRowFocusMode && onFocusRow) {
                                    onFocusRow(row.rowKey);
                                  }
                                }}
                                className="text-right font-semibold hover:underline"
                              >
                                {row.name}
                              </button>
                              {isDuplicateName && (
                                <span
                                  className="text-[10px] font-bold"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  (مكرر)
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    }

                    if (colId === 'agency') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-xs whitespace-nowrap ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            color: 'var(--text-muted)',
                            borderTop: groupTopBorder,
                            backgroundColor: stickyCellBg,
                          }}
                        >
                          {row.agencyName || '—'}
                        </td>
                      );
                    }

                    if (colId === 'category') {
                      const categories =
                        expertTableConfig?.customCategories || [];
                      return (
                        <td
                          key={colId}
                          className={`border-l px-2.5 text-xs whitespace-nowrap ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
                            backgroundColor: stickyCellBg,
                          }}
                          onClick={(e) => effectiveInlineEdit && e.stopPropagation()}
                        >
                          {effectiveInlineEdit && onInlinePatchRow ? (
                            <select
                              aria-label={`فئة ${row.name}`}
                              value={row.customCategory || ''}
                              onChange={(e) =>
                                onInlinePatchRow(row.rowKey, {
                                  customCategory: e.target.value,
                                })
                              }
                              className="rounded border px-2 py-1 text-xs"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <option value="">بدون فئة</option>
                              {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          ) : row.customCategory ? (
                            <span
                              className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                backgroundColor: 'var(--bg-nav-active)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--accent)',
                              }}
                            >
                              {row.customCategory}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      );
                    }

                    if (colId === 'individuals') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-center font-bold whitespace-nowrap ${numClass} ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                            ...(stickyCellBg ? { backgroundColor: stickyCellBg } : {}),
                            borderTop: groupTopBorder,
                          }}
                          onClick={(e) => effectiveInlineEdit && e.stopPropagation()}
                        >
                          {effectiveInlineEdit && onInlinePatchRow ? (
                            showExtractColumns ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  aria-label={`الأساسي لـ ${row.name}`}
                                  value={
                                    row.extractSource?.resolvedIndividuals ?? 0
                                  }
                                  onChange={(e) =>
                                    onInlinePatchRow(row.rowKey, {
                                      individuals:
                                        e.target.value === ''
                                          ? 0
                                          : Math.max(0, Number(e.target.value)),
                                    })
                                  }
                                  className="w-14 rounded border px-1.5 py-0.5 text-center text-xs tabular-nums"
                                  style={{
                                    backgroundColor: 'var(--bg-main)',
                                    borderColor: 'var(--border-color)',
                                  }}
                                />
                                <span
                                  className="text-xs font-bold"
                                  style={{ color: 'var(--accent)' }}
                                  title="الصافي النهائي بعد النزول والإضافة/الحذف"
                                >
                                  ← {eff.eligibleIndividuals ?? 0}
                                </span>
                              </div>
                            ) : (
                                <input
                                type="number"
                                min={0}
                                aria-label={`أفراد ${row.name}`}
                                value={row.individuals ?? 0}
                                onChange={(e) =>
                                  onInlinePatchRow(row.rowKey, {
                                    individuals:
                                      e.target.value === ''
                                        ? 0
                                        : Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="w-16 rounded border px-1.5 py-0.5 text-center text-xs font-bold tabular-nums"
                                style={{
                                  backgroundColor: 'var(--bg-main)',
                                  borderColor: 'var(--border-color)',
                                }}
                              />
                            )
                          ) : eff.summary.scope === 'partial' ? (
                            `${eff.eligibleIndividuals} من ${row.individuals ?? 0}`
                          ) : (
                            <span
                              style={{
                                color: isZeroInd ? 'var(--warning)' : undefined,
                              }}
                            >
                              {eff.eligibleIndividuals ?? '—'}
                            </span>
                          )}
                        </td>
                      );
                    }

                    if (colId === 'extract_decrease') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-2.5 text-center whitespace-nowrap ${numClass} ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                            ...(stickyCellBg ? { backgroundColor: stickyCellBg } : {}),
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {effectiveInlineEdit && onInlinePatchRow ? (
                            <input
                              type="number"
                              min={0}
                              aria-label={`النزول لـ ${row.name}`}
                              value={row.extractDecreaseCount ?? 0}
                              onChange={(e) =>
                                onInlinePatchRow(row.rowKey, {
                                  decreaseCount:
                                    e.target.value === ''
                                      ? 0
                                      : Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="w-14 rounded border px-1.5 py-0.5 text-center text-xs tabular-nums"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            />
                          ) : (
                            row.extractDecreaseCount ?? 0
                          )}
                        </td>
                      );
                    }

                    if (colId === 'extract_add_delete') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-2.5 text-center whitespace-nowrap ${numClass} ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                            ...(stickyCellBg ? { backgroundColor: stickyCellBg } : {}),
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {effectiveInlineEdit && onInlinePatchRow ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                aria-label={`قيمة الإضافة/الحذف لـ ${row.name}`}
                                value={row.extractAddOrDeleteCount ?? 0}
                                onChange={(e) =>
                                  onInlinePatchRow(row.rowKey, {
                                    addOrDeleteCount:
                                      e.target.value === ''
                                        ? 0
                                        : Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="w-14 rounded border px-1.5 py-0.5 text-center text-xs tabular-nums"
                                style={{
                                  backgroundColor: 'var(--bg-main)',
                                  borderColor: 'var(--border-color)',
                                }}
                              />
                              <select
                                aria-label={`إجراء الإضافة/الحذف لـ ${row.name}`}
                                value={row.extractAddOrDeleteAction || 'لا يوجد'}
                                onChange={(e) =>
                                  onInlinePatchRow(row.rowKey, {
                                    addOrDeleteAction: e.target.value as
                                      | 'إضافة'
                                      | 'حذف'
                                      | 'لا يوجد',
                                  })
                                }
                                className="rounded border px-1.5 py-0.5 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--bg-main)',
                                  borderColor: 'var(--border-color)',
                                }}
                              >
                                <option value="لا يوجد">لا يوجد</option>
                                <option value="إضافة">إضافة</option>
                                <option value="حذف">حذف</option>
                              </select>
                            </div>
                          ) : (
                            `${row.extractAddOrDeleteCount ?? 0} (${
                              row.extractAddOrDeleteAction || 'لا يوجد'
                            })`
                          )}
                        </td>
                      );
                    }

                    if (colId === 'quantity') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass} ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                            ...(stickyCellBg ? { backgroundColor: stickyCellBg } : {}),
                            borderTop: groupTopBorder,
                          }}
                        >
                          {eff.quotaText}
                        </td>
                      );
                    }

                    if (colId === 'price') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass} ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                            ...(stickyCellBg ? { backgroundColor: stickyCellBg } : {}),
                            borderTop: groupTopBorder,
                          }}
                        >
                          {eff.priceText}
                        </td>
                      );
                    }

                    if (colId === 'status') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-center text-xs font-semibold whitespace-nowrap ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
                            backgroundColor: stickyCellBg,
                          }}
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
                      );
                    }

                    if (colId === 'extract_route') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-2.5 text-center text-xs whitespace-nowrap ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            backgroundColor: stickyCellBg,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-bold" style={{ color: routeColor }}>
                            {row.routeActionLabel || 'إضافة جديدة'}
                          </div>
                          {row.destinationLabel && (
                            <div
                              className="text-[11px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {row.destinationLabel}
                            </div>
                          )}
                          {onOverrideRowRoute && (
                            <select
                              aria-label={`تخصيص ترحيل ${row.name}`}
                              value={row.routeOverrideValue || 'auto'}
                              onChange={(e) =>
                                onOverrideRowRoute(
                                  row.rowKey,
                                  e.target.value as
                                    | 'auto'
                                    | 'update_matched'
                                    | 'add_new'
                                    | 'replace'
                                    | 'exclude'
                                )
                              }
                              className="mt-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <option value="auto">حسب القواعد</option>
                              <option value="update_matched">تحديث المطابق</option>
                              <option value="add_new">إضافة جديدة</option>
                              <option value="replace">استبدال</option>
                              <option value="exclude">استبعاد</option>
                            </select>
                          )}
                        </td>
                      );
                    }

                    if (colId === 'notes') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-xs ${stickyCellClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            color: 'var(--text-muted)',
                            borderTop: groupTopBorder,
                            backgroundColor: stickyCellBg,
                          }}
                          onClick={(e) => effectiveInlineEdit && e.stopPropagation()}
                        >
                          {effectiveInlineEdit && onInlinePatchRow ? (
                            <input
                              type="text"
                              value={row.notes}
                              aria-label={`ملاحظات ${row.name}`}
                              placeholder="أضف ملاحظة..."
                              onChange={(e) =>
                                onInlinePatchRow(row.rowKey, {
                                  notes: e.target.value,
                                })
                              }
                              className="w-36 rounded border px-2 py-1 text-xs"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            />
                          ) : (
                            row.notes || '—'
                          )}
                        </td>
                      );
                    }

                    // Dynamic Expert custom column
                    const customDef = customColMap.get(colId);
                    const customVal = row.customFields?.[colId] || '';
                    return (
                      <td
                        key={colId}
                        className={`border-l px-3 text-xs whitespace-nowrap ${
                          customDef?.type === 'number' ? numClass : ''
                        } ${stickyCellClass}`}
                        style={{
                          borderColor: 'var(--grid-color)',
                          borderTop: groupTopBorder,
                          backgroundColor: stickyCellBg,
                        }}
                        onClick={(e) => effectiveInlineEdit && e.stopPropagation()}
                      >
                        {effectiveInlineEdit && onInlinePatchRow ? (
                          <input
                            type={customDef?.type === 'number' ? 'number' : 'text'}
                            value={customVal}
                            aria-label={`${customDef?.label || colId} لـ ${row.name}`}
                            onChange={(e) =>
                              onInlinePatchRow(row.rowKey, {
                                customFields: { [colId]: e.target.value },
                              })
                            }
                            className="w-28 rounded border px-2 py-1 text-xs"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                          />
                        ) : (
                          customVal || '—'
                        )}
                      </td>
                    );
                  })}

                  {effectiveShowEditActions && (
                    <td
                      className="border-r px-3 text-center"
                      style={{
                        borderColor: 'var(--grid-color)',
                        borderTop: groupTopBorder,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        {onEditRowModal && (
                          <motion.button
                            type="button"
                            whileHover={reducedMotion ? undefined : { scale: 1.08 }}
                            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                            transition={TABRIX_TACTILE_SPRING}
                            onClick={() => onEditRowModal(row)}
                            aria-label={`تعديل ${row.name}`}
                            className="nexus-pill-btn border p-1.5 hover:opacity-85"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </motion.button>
                        )}
                        {onDeleteRowModal && (
                          <motion.button
                            type="button"
                            whileHover={reducedMotion ? undefined : { scale: 1.08 }}
                            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                            transition={TABRIX_TACTILE_SPRING}
                            onClick={() => onDeleteRowModal(row)}
                            aria-label={`حذف ${row.name}`}
                            className="nexus-pill-btn border p-1.5 hover:opacity-85"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </motion.button>
                        )}
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
  );
};
