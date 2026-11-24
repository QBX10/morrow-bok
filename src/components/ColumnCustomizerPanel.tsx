import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  GripVertical,
  Pin,
  RotateCcw,
  Sliders,
  Tag,
  Trash2,
} from 'lucide-react';
import { DEFAULT_EXPERT_COLUMN_PRESETS } from '../data/seedData';
import type { ExpertColumnPreset, ExpertTableConfig } from '../types/agency';
import {
  applyExpertColumnPreset,
  deleteCustomExpertColumnPreset,
  moveExpertColumnInOrder,
  moveExpertColumnToEdge,
  reorderExpertColumnsByDrag,
  saveCustomExpertColumnPreset,
  setExpertColumnRank,
} from '../utils/recycleBin';
import { AnimatePresence, motion } from 'motion/react';
import { TABRIX_POPOVER_VARIANTS } from '../utils/tabrixMotion';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';

export interface CustomizableColumnMeta {
  id: string;
  defaultLabel: string;
  isCustom?: boolean;
}

interface ColumnCustomizerPanelProps {
  expertTableConfig: ExpertTableConfig;
  allColumns: CustomizableColumnMeta[];
  selectedPersonIds: number[];
  onUpdateExpertTableConfig: (patch: Partial<ExpertTableConfig>) => void;
  onAddExpertCustomColumn: (input: { label: string; type: 'text' | 'number' }) => void;
  onRemoveExpertCustomColumn: (colId: string) => void;
  onResetExpertTableConfig: () => void;
  onBulkUpdateCategory: (personIds: number[], category: string) => void;
}

export const ColumnCustomizerPanel: React.FC<ColumnCustomizerPanelProps> = ({
  expertTableConfig,
  allColumns,
  selectedPersonIds,
  onUpdateExpertTableConfig,
  onAddExpertCustomColumn,
  onRemoveExpertCustomColumn,
  onResetExpertTableConfig,
  onBulkUpdateCategory,
}) => {
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number'>('text');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [bulkCategoryValue, setBulkCategoryValue] = useState(
    expertTableConfig.customCategories[0] || ''
  );
  const [newPresetName, setNewPresetName] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const normalizedConfigForOrder = useMemo<ExpertTableConfig>(
    () => ({
      ...expertTableConfig,
      columnOrder: allColumns.map((c) => c.id),
    }),
    [expertTableConfig, allColumns]
  );

  const allPresets = useMemo<ExpertColumnPreset[]>(() => {
    const stored = expertTableConfig.columnPresets;
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return DEFAULT_EXPERT_COLUMN_PRESETS;
  }, [expertTableConfig.columnPresets]);

  const pinnedColumnId =
    expertTableConfig.pinnedColumnId === undefined
      ? 'name'
      : expertTableConfig.pinnedColumnId;

  const visibleOrderedColumns = useMemo(
    () =>
      allColumns.filter((c) => expertTableConfig.visibleColumns.includes(c.id)),
    [allColumns, expertTableConfig.visibleColumns]
  );

  const handleToggleColumnVisible = (colId: string) => {
    const visible = new Set(expertTableConfig.visibleColumns);
    if (visible.has(colId)) {
      if (visible.size <= 1) return;
      visible.delete(colId);
    } else {
      visible.add(colId);
    }
    onUpdateExpertTableConfig({
      visibleColumns: Array.from(visible),
      activePresetId: null,
    });
  };

  return (
    <section
      aria-label="استوديو تخصيص الأعمدة والترتيب الحر"
      data-testid="expert-column-customizer-panel"
      className="nexus-squircle space-y-4 p-4 sm:p-5"
      style={{
        borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border-color))',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <NexusDuotoneIcon sizeClass="h-10 w-10">
            <Sliders className="h-4 w-4" />
          </NexusDuotoneIcon>
          <div>
            <h2 className="text-sm font-extrabold sm:text-base">
              استوديو تخصيص الأعمدة والترتيب الحر
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              اسحب وأفلت، أو حدد رقم الترتيب (1..{allColumns.length})، أو ثبّت عموداً مرجعياً واحفظ قوالبك الجاهزة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label
            className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold"
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
            <span>حفظ التعديلات مباشرة بدون تأكيد</span>
          </label>

          <AnimatePresence mode="wait" initial={false}>
            {confirmResetOpen ? (
              <motion.div
                key="confirm-reset-actions"
                variants={TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="inline-flex items-center gap-1.5 rounded-full border p-1"
                style={{ borderColor: 'var(--danger)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onResetExpertTableConfig();
                    setConfirmResetOpen(false);
                  }}
                  className="nexus-pill-btn inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--danger)' }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>تأكيد استعادة الافتراضي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(false)}
                  className="nexus-pill-btn px-2.5 py-1 text-xs font-semibold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  إلغاء
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="open-reset-confirm"
                type="button"
                variants={TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                onClick={() => setConfirmResetOpen(true)}
                className="nexus-pill-btn inline-flex min-h-[36px] items-center gap-1 border px-3.5 py-1.5 font-bold hover:border-[var(--danger)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>استعادة الضبط الافتراضي</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Saved Column Presets + Pinned Reference Column Bar */}
      <div
        className="grid grid-cols-1 gap-3 rounded-xl border p-3.5 lg:grid-cols-[1fr_auto]"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="space-y-2 text-xs">
          <div className="font-bold" style={{ color: 'var(--text-muted)' }}>
            قوالب الأعمدة الجاهزة والمحفوظة:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {allPresets.map((preset) => {
              const active = expertTableConfig.activePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  className="inline-flex items-center rounded-lg border overflow-hidden"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent)'
                      : 'var(--bg-surface)',
                    borderColor: active
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: active ? 'var(--accent-fg)' : 'var(--text-primary)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateExpertTableConfig(
                        applyExpertColumnPreset(normalizedConfigForOrder, preset)
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-bold whitespace-nowrap"
                  >
                    {preset.name}
                  </button>
                  {!preset.isBuiltIn && (
                    <button
                      type="button"
                      aria-label={`حذف قالب ${preset.name}`}
                      onClick={() =>
                        onUpdateExpertTableConfig(
                          deleteCustomExpertColumnPreset(
                            normalizedConfigForOrder,
                            preset.id
                          )
                        )
                      }
                      className="border-r px-1.5 py-1.5 opacity-80 hover:opacity-100"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save Current Layout as Preset */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="اسم قالب جديد لحفظ الترتيب والأعمدة الحالية..."
              className="min-w-[200px] flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
              <button
                type="button"
                disabled={!newPresetName.trim()}
                onClick={() => {
                  if (!newPresetName.trim()) return;
                  onUpdateExpertTableConfig(
                    saveCustomExpertColumnPreset(
                      normalizedConfigForOrder,
                      newPresetName
                    )
                  );
                  setNewPresetName('');
                }}
                className="nexus-pill-btn inline-flex min-h-[34px] items-center gap-1 border px-3.5 py-1 font-bold disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>حفظ كقالب</span>
              </button>
          </div>
        </div>

        {/* Pinned Reference Column Picker */}
        <div
          className="space-y-1.5 border-t pt-3 text-xs lg:border-t-0 lg:border-r lg:pr-4 lg:pt-0"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <label
            htmlFor="pinned-ref-col-select"
            className="flex items-center gap-1.5 font-bold"
          >
            <Pin className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>العمود المرجعي المثبّت عند التمرير:</span>
          </label>
          <select
            id="pinned-ref-col-select"
            value={pinnedColumnId ?? '__none__'}
            onChange={(e) =>
              onUpdateExpertTableConfig({
                pinnedColumnId:
                  e.target.value === '__none__' ? null : e.target.value,
              })
            }
            className="min-h-[36px] w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <option value="__none__">بدون تثبيت أفقي</option>
            {allColumns.map((col) => (
              <option key={col.id} value={col.id}>
                {expertTableConfig.columnLabels[col.id] || col.defaultLabel}
              </option>
            ))}
          </select>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            يبقى ثابتاً على الشاشات الصغيرة أثناء تمرير الأعمدة.
          </div>
        </div>
      </div>

      {/* Live Preview Strip */}
      <div
        data-testid="columns-live-preview-strip"
        className="rounded-xl border p-3 text-xs"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div
          className="mb-2 flex items-center justify-between font-bold"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>معاينة الترتيب الفوري لرأس الجدول ({visibleOrderedColumns.length} عمود ظاهر):</span>
          <span className="tabular-nums text-[11px]">من اليمين إلى اليسار</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {visibleOrderedColumns.map((col, idx) => {
            const label =
              expertTableConfig.columnLabels[col.id]?.trim() ||
              col.defaultLabel;
            const isPinned = pinnedColumnId === col.id;
            return (
              <div
                key={col.id}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: isPinned
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-surface)',
                  borderColor: isPinned
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                  color: isPinned ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                <span className="text-[10px] tabular-nums opacity-70">
                  {idx + 1}.
                </span>
                <span>{label}</span>
                {isPinned && <Pin className="h-3 w-3" aria-label="مثبت" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Draggable & Rank-Ordered Columns Manager */}
      <div className="space-y-2">
        <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          التحكم الحر بالأعمدة (السحب والإفلات · الترتيب المباشر · الإظهار · إعادة التسمية):
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {allColumns.map((col, idx) => {
            const isVisible = expertTableConfig.visibleColumns.includes(col.id);
            const currentLabel =
              expertTableConfig.columnLabels[col.id] ?? col.defaultLabel;
            const isRenamed =
              expertTableConfig.columnLabels[col.id] !== undefined &&
              expertTableConfig.columnLabels[col.id] !== col.defaultLabel;
            const isDragTarget =
              dragOverColId === col.id && draggedColId !== col.id;

            return (
              <div
                key={col.id}
                draggable
                onDragStart={(e) => {
                  setDraggedColId(col.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', col.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverColId !== col.id) setDragOverColId(col.id);
                }}
                onDragLeave={() => {
                  if (dragOverColId === col.id) setDragOverColId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId =
                    draggedColId || e.dataTransfer.getData('text/plain');
                  if (sourceId && sourceId !== col.id) {
                    onUpdateExpertTableConfig(
                      reorderExpertColumnsByDrag(
                        normalizedConfigForOrder,
                        sourceId,
                        col.id
                      )
                    );
                  }
                  setDraggedColId(null);
                  setDragOverColId(null);
                }}
                onDragEnd={() => {
                  setDraggedColId(null);
                  setDragOverColId(null);
                }}
                data-testid={`customizer-col-row-${col.id}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border p-2.5 text-xs transition-all"
                style={{
                  backgroundColor: isDragTarget
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                  borderColor: isDragTarget
                    ? 'var(--accent)'
                    : isVisible
                    ? 'color-mix(in srgb, var(--accent) 45%, var(--border-color))'
                    : 'var(--border-color)',
                  opacity: isVisible ? 1 : 0.72,
                }}
              >
                {/* Drag Handle + Rank Select */}
                <span
                  title="اسحب لإعادة الترتيب"
                  className="cursor-grab active:cursor-grabbing p-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <GripVertical className="h-4 w-4" />
                </span>

                <select
                  aria-label={`ترتيب عمود ${col.defaultLabel}`}
                  value={idx + 1}
                  onChange={(e) =>
                    onUpdateExpertTableConfig(
                      setExpertColumnRank(
                        normalizedConfigForOrder,
                        col.id,
                        Number(e.target.value)
                      )
                    )
                  }
                  className="min-h-[34px] w-14 rounded-lg border px-1.5 py-1 text-center font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {allColumns.map((_, rankIdx) => (
                    <option key={rankIdx + 1} value={rankIdx + 1}>
                      #{rankIdx + 1}
                    </option>
                  ))}
                </select>

                {/* Show / Hide Toggle Button */}
                <button
                  type="button"
                  onClick={() => handleToggleColumnVisible(col.id)}
                  aria-label={`إظهار أو إخفاء عمود ${col.defaultLabel}`}
                  aria-pressed={isVisible}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2 py-1 font-bold"
                  style={{
                    backgroundColor: isVisible
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-surface)',
                    borderColor: isVisible
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: isVisible ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {isVisible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </button>

                {/* Column Name Input + Default Sublabel */}
                <div className="min-w-[120px] flex-1 space-y-0.5">
                  <input
                    type="text"
                    value={currentLabel}
                    aria-label={`تسمية عمود ${col.defaultLabel}`}
                    onChange={(e) =>
                      onUpdateExpertTableConfig({
                        columnLabels: {
                          ...expertTableConfig.columnLabels,
                          [col.id]: e.target.value,
                        },
                      })
                    }
                    className="min-h-[34px] w-full rounded-lg border px-2.5 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                  {isRenamed && (
                    <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <span>الافتراضي: {col.defaultLabel}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextLabels = {
                            ...expertTableConfig.columnLabels,
                          };
                          delete nextLabels[col.id];
                          onUpdateExpertTableConfig({
                            columnLabels: nextLabels,
                          });
                        }}
                        className="font-bold hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        استعادة الاسم
                      </button>
                    </div>
                  )}
                </div>

                {/* Move Start / Right / Left / End Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    title="نقل إلى البداية"
                    aria-label={`نقل عمود ${col.defaultLabel} إلى البداية`}
                    onClick={() =>
                      onUpdateExpertTableConfig(
                        moveExpertColumnToEdge(
                          normalizedConfigForOrder,
                          col.id,
                          'start'
                        )
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === 0}
                    title="تحريك لليمين"
                    aria-label={`نقل عمود ${col.defaultLabel} لليمين`}
                    onClick={() =>
                      onUpdateExpertTableConfig(
                        moveExpertColumnInOrder(
                          normalizedConfigForOrder,
                          col.id,
                          'right'
                        )
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === allColumns.length - 1}
                    title="تحريك لليسار"
                    aria-label={`نقل عمود ${col.defaultLabel} لليسار`}
                    onClick={() =>
                      onUpdateExpertTableConfig(
                        moveExpertColumnInOrder(
                          normalizedConfigForOrder,
                          col.id,
                          'left'
                        )
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === allColumns.length - 1}
                    title="نقل إلى النهاية"
                    aria-label={`نقل عمود ${col.defaultLabel} إلى النهاية`}
                    onClick={() =>
                      onUpdateExpertTableConfig(
                        moveExpertColumnToEdge(
                          normalizedConfigForOrder,
                          col.id,
                          'end'
                        )
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  {col.isCustom && (
                    <button
                      type="button"
                      aria-label={`حذف عمود ${col.defaultLabel}`}
                      onClick={() => onRemoveExpertCustomColumn(col.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Custom Column + Manage Custom Categories */}
      <div
        className="grid grid-cols-1 gap-4 border-t pt-3 lg:grid-cols-2"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="space-y-2 text-xs">
          <div className="font-bold">إضافة عمود مخصص جديد للجدول:</div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newColLabel}
              onChange={(e) => setNewColLabel(e.target.value)}
              placeholder="اسم العمود (مثال: المنطقة / الهاتف)"
              className="min-h-[38px] min-w-[170px] flex-1 rounded-lg border px-2.5 py-1.5"
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
              className="min-h-[38px] rounded-lg border px-2.5 py-1.5"
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
              className="nexus-pill-btn min-h-[38px] px-4 py-1.5 font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              + إضافة عمود
            </button>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="font-bold">إدارة الفئات المخصصة وتطبيقها:</div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="اسم فئة جديدة (مثال: خط أ، مستعجل)..."
              className="min-h-[38px] min-w-[170px] flex-1 rounded-lg border px-2.5 py-1.5"
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
              className="nexus-pill-btn min-h-[38px] px-4 py-1.5 font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              + إضافة فئة
            </button>
          </div>

          <AnimatePresence>
            {selectedPersonIds.length > 0 && (
              <motion.div
                key="bulk-category-assign-strip"
                variants={TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-wrap items-center gap-2 pt-1"
              >
                <Tag className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span className="font-semibold">
                  تعيين فئة للمحدد ({selectedPersonIds.length}):
                </span>
                <select
                  value={bulkCategoryValue}
                  onChange={(e) => setBulkCategoryValue(e.target.value)}
                  className="min-h-[34px] rounded-lg border px-2 py-1"
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
                  className="nexus-pill-btn min-h-[34px] px-4 py-1 font-bold"
                  style={{
                    backgroundColor: 'var(--success)',
                    color: 'var(--success-fg)',
                  }}
                >
                  تطبيق على المحدد
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
