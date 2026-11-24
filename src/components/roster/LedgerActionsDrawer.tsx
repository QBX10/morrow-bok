import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownUp,
  ArrowRight,
  Columns3,
  Download,
  Edit3,
  Eye,
  Filter,
  Lock,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  TableProperties,
  Undo2,
  Unlock,
} from 'lucide-react';
import type { ModeCapabilities } from '../../utils/modePermissions';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import { TabrixPillIndicator } from '../ui/TabrixMotionPrimitives';

interface LedgerActionsDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  recordCount: number;
  capabilities: ModeCapabilities;
  viewingMode: boolean;
  onToggleViewingMode: (next: boolean) => void;
  isTableLocked: boolean;
  onToggleLock: () => void;
  rowEditorMode: boolean;
  onToggleRowEditorMode: () => void;
  expertInlineEdit: boolean;
  onToggleExpertInlineEdit: () => void;
  statusFilter: 'all' | 'active' | 'blocked' | 'archived';
  onChangeStatusFilter: (
    next: 'all' | 'active' | 'blocked' | 'archived'
  ) => void;
  categoryFilter: string;
  onChangeCategoryFilter: (next: string) => void;
  customCategories: string[];
  sortBy: 'default' | 'name_asc' | 'individuals_desc';
  onChangeSortBy: (next: 'default' | 'name_asc' | 'individuals_desc') => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  showColumnCustomizer: boolean;
  onToggleColumnCustomizer: () => void;
  showAuditPanel: boolean;
  auditIssuesCount: number;
  onToggleAuditPanel: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddPerson: () => void;
  onOpenHeaderCustomizer: () => void;
  onExportExcel: () => void;
  onPrintPdf: () => void;
  onOpenSettings: () => void;
  onBackToHub: () => void;
}

export const LedgerActionsDrawer: React.FC<LedgerActionsDrawerProps> = ({
  open,
  onClose,
  title,
  recordCount,
  capabilities,
  viewingMode,
  onToggleViewingMode,
  isTableLocked,
  onToggleLock,
  rowEditorMode,
  onToggleRowEditorMode,
  expertInlineEdit,
  onToggleExpertInlineEdit,
  statusFilter,
  onChangeStatusFilter,
  categoryFilter,
  onChangeCategoryFilter,
  customCategories,
  sortBy,
  onChangeSortBy,
  onResetFilters,
  hasActiveFilters,
  showColumnCustomizer,
  onToggleColumnCustomizer,
  showAuditPanel,
  auditIssuesCount,
  onToggleAuditPanel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddPerson,
  onOpenHeaderCustomizer,
  onExportExcel,
  onPrintPdf,
  onOpenSettings,
  onBackToHub,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const runAndClose = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <FullScreenPushPage
      open={open}
      onClose={onClose}
      title={title}
      subtitle={`${recordCount} سجل · أدوات التحكم بالجدول`}
      icon={<SlidersHorizontal className="h-4 w-4" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => runAndClose(onBackToHub)}
            className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 font-bold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>الوكالات</span>
          </button>
          <button
            type="button"
            onClick={() => runAndClose(onOpenSettings)}
            className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 font-bold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <Settings className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>الإعدادات</span>
          </button>
        </div>
      }
    >
      <div data-testid="ledger-actions-drawer" className="space-y-4 text-xs">
        {/* 1. Viewing & Lock Safety Controls */}
        <div className="nexus-squircle p-4 space-y-2.5">
          <div
            className="px-1 text-[11px] font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            أوضاع العرض والحماية
          </div>

            <button
              type="button"
              onClick={() => runAndClose(() => onToggleViewingMode(!viewingMode))}
              className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 font-bold"
              style={{
                backgroundColor: viewingMode
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
                borderColor: viewingMode
                  ? 'var(--accent)'
                  : 'var(--border-color)',
                color: viewingMode ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>
                  {viewingMode ? 'الخروج من وضع المشاهدة' : 'تفعيل وضع المشاهدة'}
                </span>
              </span>
              <span className="text-[10px] opacity-80">
                {viewingMode ? 'نشط' : 'ملء الشاشة'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleLock}
              className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 font-bold"
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
              <span className="inline-flex items-center gap-2">
                {isTableLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                )}
                <span>
                  {isTableLocked
                    ? 'الجدول مقفل (فتح القفل)'
                    : 'قفل الجدول للقراءة الآمنة'}
                </span>
              </span>
              <span className="text-[10px]">
                {isTableLocked ? 'مقفل' : 'مفتوح'}
              </span>
            </button>
          </div>

          {/* 2. Filtering & Sorting */}
          {capabilities.canSortAndFilter && (
            <div
              className="space-y-2.5 border-t pt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center justify-between px-1">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>الفرز والتصفية</span>
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="inline-flex items-center gap-1 text-[11px] font-bold"
                    style={{ color: 'var(--accent)' }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>مسح الفلاتر</span>
                  </button>
                )}
              </div>

              <div>
                <label
                  className="mb-1 block text-[11px] font-semibold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  فلترة حسب الحالة
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'الجميع' },
                      { id: 'active', label: 'النشطون' },
                      { id: 'blocked', label: 'المحجوبون' },
                      { id: 'archived', label: 'المؤرشفون' },
                    ] as const
                  ).map((opt) => {
                    const active = statusFilter === opt.id;
                    return (
                      <motion.button
                        key={opt.id}
                        type="button"
                        whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                        whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                        transition={TABRIX_TACTILE_SPRING}
                        onClick={() => onChangeStatusFilter(opt.id)}
                        className="relative overflow-hidden rounded-lg border px-2.5 py-1.5 font-bold"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: active
                            ? 'var(--accent)'
                            : 'var(--border-color)',
                          color: active
                            ? 'var(--accent)'
                            : 'var(--text-primary)',
                        }}
                      >
                        {active && (
                          <TabrixPillIndicator
                            layoutId="ledger-drawer-status-pill"
                            className="rounded-lg"
                          />
                        )}
                        <span className="relative z-10">{opt.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {capabilities.isExpertMode && customCategories.length > 0 && (
                <div>
                  <label
                    className="mb-1 block text-[11px] font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    الفئة المخصصة
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => onChangeCategoryFilter(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <option value="all">جميع الفئات</option>
                    {customCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  className="mb-1 flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ArrowDownUp className="h-3 w-3" />
                  <span>ترتيب السجلات</span>
                </label>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    onChangeSortBy(
                      e.target.value as 'default' | 'name_asc' | 'individuals_desc'
                    )
                  }
                  className="w-full rounded-xl border px-3 py-2 text-xs font-semibold"
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
            </div>
          )}

          {/* 3. Editor & Records Management */}
          {capabilities.canEditRecords && (
            <div
              className="space-y-2 border-t pt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="px-1 text-[11px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                التحرير وإدارة السجلات
              </div>

              <motion.button
                type="button"
                disabled={isTableLocked}
                whileHover={reducedMotion || isTableLocked ? undefined : { y: -1.5, scale: 1.01 }}
                whileTap={reducedMotion || isTableLocked ? undefined : { scale: 0.97 }}
                transition={TABRIX_TACTILE_SPRING}
                onClick={() => runAndClose(onAddPerson)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 font-bold disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Plus className="h-4 w-4" />
                <span>إضافة سجل جديد</span>
              </motion.button>

              <button
                type="button"
                disabled={isTableLocked}
                onClick={onToggleRowEditorMode}
                className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 font-bold disabled:opacity-45"
                style={{
                  backgroundColor: rowEditorMode
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                  borderColor: rowEditorMode
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                  color: rowEditorMode ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>إظهار عمود إجراءات المحرر</span>
                </span>
                <span className="text-[10px]">
                  {rowEditorMode ? 'مفعّل' : 'مخفي'}
                </span>
              </button>

              {capabilities.isExpertMode && (
                <button
                  type="button"
                  disabled={isTableLocked}
                  onClick={onToggleExpertInlineEdit}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 font-bold disabled:opacity-45"
                  style={{
                    backgroundColor: expertInlineEdit
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: expertInlineEdit
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: expertInlineEdit
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <TableProperties className="h-3.5 w-3.5" />
                    <span>التحرير المباشر داخل الخلايا</span>
                  </span>
                  <span className="text-[10px]">
                    {expertInlineEdit ? 'مفعّل' : 'متوقف'}
                  </span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  disabled={!canUndo || isTableLocked}
                  whileTap={reducedMotion || !canUndo || isTableLocked ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={onUndo}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>تراجع</span>
                </motion.button>
                <motion.button
                  type="button"
                  disabled={!canRedo || isTableLocked}
                  whileTap={reducedMotion || !canRedo || isTableLocked ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={onRedo}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Redo2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>إعادة</span>
                </motion.button>
              </div>
            </div>
          )}

          {/* 4. Customization, Audit & Exports */}
          <div
            className="space-y-2 border-t pt-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="px-1 text-[11px] font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              التخصيص والتدقيق والتصدير
            </div>

            <button
              type="button"
              disabled={isTableLocked}
              onClick={() => runAndClose(onOpenHeaderCustomizer)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 font-bold disabled:opacity-45"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal
                  className="h-3.5 w-3.5"
                  style={{ color: 'var(--accent)' }}
                />
                <span>تخصيص رأس الجدول المتصل</span>
              </span>
            </button>

            {capabilities.isExpertMode && (
              <button
                type="button"
                onClick={() => runAndClose(onToggleColumnCustomizer)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 font-bold"
                style={{
                  backgroundColor: showColumnCustomizer
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                  borderColor: showColumnCustomizer
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                  color: showColumnCustomizer
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Columns3
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>إدارة وترتيب الأعمدة</span>
                </span>
              </button>
            )}

            {capabilities.canUseSmartAudit && (
              <button
                type="button"
                onClick={() => runAndClose(onToggleAuditPanel)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 font-bold"
                style={{
                  backgroundColor: showAuditPanel
                    ? 'var(--warning-bg)'
                    : 'var(--bg-main)',
                  borderColor:
                    auditIssuesCount > 0
                      ? 'var(--warning)'
                      : 'var(--border-color)',
                  color:
                    auditIssuesCount > 0
                      ? 'var(--warning)'
                      : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>التدقيق الذكي</span>
                </span>
                <span className="tabular-nums">{auditIssuesCount}</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              {capabilities.canUseExcelTools && (
                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -1, scale: 1.015 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={() => runAndClose(onExportExcel)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Download
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>Excel</span>
                </motion.button>
              )}

              {capabilities.canSortAndFilter && (
                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -1, scale: 1.015 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={() => runAndClose(onPrintPdf)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Printer
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>طباعة / PDF</span>
                </motion.button>
              )}
            </div>
          </div>
      </div>
    </FullScreenPushPage>
  );
};
