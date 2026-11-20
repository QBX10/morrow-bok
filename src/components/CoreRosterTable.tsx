import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
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
} from '../utils/agencyLogic';

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
  individuals: 'الأنفار',
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
  emptyMessage = 'لا توجد سجلات مطابقة في هذا الجدول.',
  onToggleSelectRow,
  onToggleSelectAll,
  onFocusRow,
  onEditRowModal,
  onDeleteRowModal,
  onInlinePatchRow,
  onOverrideRowRoute,
}) => {
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

  const getHeaderLabel = (colId: string): string => {
    if (colId === 'individuals' && showExtractColumns) {
      return 'الصافي (الأنفار)';
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
    1 + orderedColumns.length + (showEditActions ? 1 : 0);

  return (
    <div
      className={`overflow-auto rounded-xl border ${
        themePrefs.stickyHeaderAndName ? 'max-h-[70vh]' : ''
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      <table
        className={`agency-table theme-${themePrefs.tableTheme} ${
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
                aria-label="تحديد جميع الأسماء الظاهرة"
                checked={allVisibleSelected}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
              />
            </th>

            {orderedColumns.map((colId) => {
              const isName = colId === 'name';
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
                  className={`border-l px-3 font-bold whitespace-nowrap ${
                    isCentered ? 'text-center' : ''
                  } ${
                    themePrefs.stickyHeaderAndName
                      ? isName
                        ? 'sticky right-0 top-0 z-30 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]'
                        : 'sticky top-0 z-20'
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

            {showEditActions && (
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
              const isFocused =
                themePrefs.activeRowFocusMode && focusedRowKey === row.rowKey;
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
                  onClick={() => {
                    if (!themePrefs.activeRowFocusMode || !onFocusRow) return;
                    onFocusRow(
                      focusedRowKey === row.rowKey ? null : row.rowKey
                    );
                  }}
                  className={`transition-colors ${
                    isBlocked ? 'row-blocked' : ''
                  } ${isFocused ? 'row-focused' : ''} ${
                    themePrefs.activeRowFocusMode ? 'cursor-pointer' : ''
                  }`}
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
                    style={{
                      borderColor: 'var(--grid-color)',
                      borderTop: groupTopBorder,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      aria-label={`تحديد ${row.name}`}
                      checked={isRowSelected}
                      onChange={() => onToggleSelectRow(row.selectionId)}
                    />
                  </td>

                  {orderedColumns.map((colId) => {
                    if (colId === 'serial') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
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
                          className="border-l px-2.5 text-center font-bold whitespace-nowrap"
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
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
                          className={`border-l px-3 font-semibold whitespace-nowrap ${
                            themePrefs.stickyHeaderAndName
                              ? 'sticky right-0 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]'
                              : ''
                          }`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            backgroundColor:
                              isRowSelected || isFocused
                                ? 'var(--bg-nav-active)'
                                : isBlocked
                                ? 'var(--danger-bg)'
                                : 'var(--bg-surface)',
                            borderTop: groupTopBorder,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editableInline) {
                              onToggleSelectRow(row.selectionId);
                              if (themePrefs.activeRowFocusMode && onFocusRow) {
                                onFocusRow(row.rowKey);
                              }
                            }
                          }}
                        >
                          {editableInline && onInlinePatchRow ? (
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
                                borderColor: 'var(--border-color)',
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="text-right font-semibold hover:underline"
                            >
                              {row.name}
                            </button>
                          )}
                        </td>
                      );
                    }

                    if (colId === 'agency') {
                      return (
                        <td
                          key={colId}
                          className="border-l px-3 text-xs whitespace-nowrap"
                          style={{
                            borderColor: 'var(--grid-color)',
                            color: 'var(--text-muted)',
                            borderTop: groupTopBorder,
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
                          className="border-l px-2.5 text-xs whitespace-nowrap"
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
                          }}
                          onClick={(e) => editableInline && e.stopPropagation()}
                        >
                          {editableInline && onInlinePatchRow ? (
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
                          className={`border-l px-3 text-center font-bold whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                            borderTop: groupTopBorder,
                          }}
                          onClick={(e) => editableInline && e.stopPropagation()}
                        >
                          {editableInline && onInlinePatchRow ? (
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
                                aria-label={`أنفار ${row.name}`}
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
                            eff.eligibleIndividuals ?? '—'
                          )}
                        </td>
                      );
                    }

                    if (colId === 'extract_decrease') {
                      return (
                        <td
                          key={colId}
                          className={`border-l px-2.5 text-center whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editableInline && onInlinePatchRow ? (
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
                          className={`border-l px-2.5 text-center whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editableInline && onInlinePatchRow ? (
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
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
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
                          className={`border-l px-3 text-center whitespace-nowrap ${numClass}`}
                          style={{
                            borderColor: 'var(--grid-color)',
                            ...(isBlocked ? {} : numericTintStyle),
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
                          className="border-l px-3 text-center text-xs font-semibold whitespace-nowrap"
                          style={{
                            borderColor: 'var(--grid-color)',
                            borderTop: groupTopBorder,
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
                          className="border-l px-2.5 text-center text-xs whitespace-nowrap"
                          style={{ borderColor: 'var(--grid-color)' }}
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
                          className="border-l px-3 text-xs"
                          style={{
                            borderColor: 'var(--grid-color)',
                            color: 'var(--text-muted)',
                            borderTop: groupTopBorder,
                          }}
                          onClick={(e) => editableInline && e.stopPropagation()}
                        >
                          {editableInline && onInlinePatchRow ? (
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
                        }`}
                        style={{
                          borderColor: 'var(--grid-color)',
                          borderTop: groupTopBorder,
                        }}
                        onClick={(e) => editableInline && e.stopPropagation()}
                      >
                        {editableInline && onInlinePatchRow ? (
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

                  {showEditActions && (
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
                          <button
                            type="button"
                            onClick={() => onEditRowModal(row)}
                            aria-label={`تعديل ${row.name}`}
                            className="rounded border p-1.5 hover:opacity-80"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onDeleteRowModal && (
                          <button
                            type="button"
                            onClick={() => onDeleteRowModal(row)}
                            aria-label={`حذف ${row.name}`}
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
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
