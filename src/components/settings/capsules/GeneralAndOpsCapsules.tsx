import React from 'react';
import { Bell, Camera, Trash2 } from 'lucide-react';
import {
  DEFAULT_GENERAL_PREFS,
  DEFAULT_QUICK_EXTRACT_PREFS,
  DEFAULT_RELATIONS_PREFS,
} from '../../../data/seedData';
import type {
  GeneralAppPrefs,
  QuickExtractFocusField,
  QuickExtractPrefs,
  RelationsReadyListsPrefs,
  TopBarConfig,
} from '../../../types/agency';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
} from '../../../utils/hierarchyRegistry';
import { resolveHierarchyNodeBadge } from '../../../utils/hierarchyRegistry';
import { ALL_QUICK_EXTRACT_FIELDS } from '../../../utils/quickExtractEngine';
import { NodeCard } from '../NodeCard';
import { NodeView } from '../NodeView';

/* ─── GENERAL APP SETTINGS CAPSULES (Level 3 -> Level 4) ──────────────────── */

interface GeneralCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  generalPrefs: GeneralAppPrefs;
  topBarConfig: TopBarConfig;
  requireLoginOnStart: boolean;
  onUpdateGeneralPrefs: (patch: Partial<GeneralAppPrefs>) => void;
  onChangeTopBarConfig: (patch: Partial<TopBarConfig>) => void;
  onToggleRequireLogin: (req: boolean) => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
}

export const GeneralCapsules: React.FC<GeneralCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  generalPrefs,
  topBarConfig,
  requireLoginOnStart,
  onUpdateGeneralPrefs,
  onChangeTopBarConfig,
  onToggleRequireLogin,
  onOpenCapsule,
  onNotifySuccess,
}) => {
  const effectiveDisplayMode = generalPrefs.settingsDisplayMode || 'fullscreen';

  // Level 3 Hub
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={
          effectiveDisplayMode === 'fullscreen' ? 'ملء الشاشة' : 'عرض مدمج'
        }
        onResetBranch={() => {
          onUpdateGeneralPrefs(DEFAULT_GENERAL_PREFS);
          onChangeTopBarConfig({
            mode: 'normal',
            autoFocus: false,
            autoFocusAction: 'hide',
            autoHideInTables: false,
            showViewTitle: true,
            showQuickFocusToggle: true,
            showUndoRedo: true,
            showAuthButton: true,
          });
          onToggleRequireLogin(false);
          onNotifySuccess('تمت استعادة الإعدادات العامة الافتراضية فقط.');
        }}
        resetBranchLabel="استعادة افتراضي العامة"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            const preview =
              child.id === 'general_display_cap' ? (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>
                    {effectiveDisplayMode === 'fullscreen'
                      ? 'ملء الشاشة (100%)'
                      : 'عرض مدمج'}
                  </span>
                  <span style={{ color: 'var(--accent)' }}>
                    Undo: {generalPrefs.undoLimit}
                  </span>
                </div>
              ) : child.id === 'general_behavior_cap' ? (
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {generalPrefs.confirmBeforeDelete
                      ? 'حماية الحذف مفعّلة'
                      : 'حذف مباشر'}
                  </span>
                  <span style={{ color: 'var(--accent)' }}>
                    {generalPrefs.showActionAlerts ? 'تنبيهات نشطة' : 'صامت'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {topBarConfig.autoFocus ? 'إخفاء تلقائي نشط' : 'شريط قياسي'}
                  </span>
                  <span style={{ color: 'var(--accent)' }}>
                    {topBarConfig.mode === 'compact'
                      ? 'مضغوط'
                      : topBarConfig.mode === 'hidden'
                      ? 'مخفي'
                      : 'عادي'}
                  </span>
                </div>
              );

            return (
              <NodeCard
                key={child.id}
                node={child}
                badge={badge}
                preview={preview}
                actionLabel="فتح الكبسولة"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}
        </div>
      </NodeView>
    );
  }

  // Level 4A: Display Mode (Fullscreen default vs Contained), Undo Limit & Require Login
  if (activeCapsuleId === 'general_display_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={
          effectiveDisplayMode === 'fullscreen' ? 'ملء الشاشة' : 'عرض مدمج'
        }
        onResetBranch={() => {
          onUpdateGeneralPrefs({
            settingsDisplayMode: 'fullscreen',
            undoLimit: DEFAULT_GENERAL_PREFS.undoLimit,
          });
          onToggleRequireLogin(false);
          onNotifySuccess('تمت استعادة وضع ملء الشاشة الافتراضي وسعة التراجع.');
        }}
        resetBranchLabel="استعادة الافتراضي"
      >
        <section
          aria-label="وضع عرض الإعدادات"
          className="capsule-glass-card border p-5 space-y-4 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div>
            <h2 className="text-base font-extrabold">
              وضع العرض الافتراضي لشاشة الإعدادات والأدوات
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              الوضع الافتراضي هو ملء الشاشة بالكامل (100dvh × 100vw) لراحة العين وتوسيع الكبسولات، مع حفظ اختيارك فوراً.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: 'fullscreen' as const,
                  title: 'ملء الشاشة بالكامل (افتراضي)',
                  desc: 'يفتح استوديو الإعدادات والكبسولات على كامل مساحة الجهاز مع احترام الحواف الآمنة.',
                },
                {
                  id: 'contained' as const,
                  title: 'عرض إطار مركزي مدمج',
                  desc: 'يعرض الإعدادات ضمن إطار وسطي مضبوط الحواف لمن يفضل المساحات الضيقة على الشاشات العريضة.',
                },
              ] as const
            ).map((opt) => {
              const active = effectiveDisplayMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onUpdateGeneralPrefs({ settingsDisplayMode: opt.id });
                    onNotifySuccess(`تم تعيين وضع العرض: ${opt.title}`);
                  }}
                  className="min-h-[84px] rounded-2xl border p-4 text-right transition-colors"
                  style={{
                    backgroundColor: active
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: active
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  }}
                >
                  <div
                    className="text-sm font-extrabold"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {opt.title}
                  </div>
                  <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <label className="mb-1.5 block font-extrabold">
                سعة سجل التراجع والإعادة (Undo Limit)
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={generalPrefs.undoLimit}
                onChange={(e) =>
                  onUpdateGeneralPrefs({
                    undoLimit: Math.max(
                      5,
                      Math.min(100, Number(e.target.value) || 35)
                    ),
                  })
                }
                className="min-h-[42px] w-32 rounded-xl border px-3 py-1.5 font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            <label
              className="flex min-h-[68px] cursor-pointer items-center gap-2.5 rounded-2xl border p-4 font-extrabold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: requireLoginOnStart
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={requireLoginOnStart}
                onChange={(e) => onToggleRequireLogin(e.target.checked)}
              />
              <span>إلزام تسجيل الدخول عند فتح التطبيق</span>
            </label>
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4B: Confirmation, Alerts & Compact Numbers
  if (activeCapsuleId === 'general_behavior_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        onResetBranch={() => {
          onUpdateGeneralPrefs({
            confirmBeforeDelete: DEFAULT_GENERAL_PREFS.confirmBeforeDelete,
            confirmBeforeEdit: DEFAULT_GENERAL_PREFS.confirmBeforeEdit,
            showActionAlerts: DEFAULT_GENERAL_PREFS.showActionAlerts,
            compactNumbers: DEFAULT_GENERAL_PREFS.compactNumbers,
          });
          onNotifySuccess('تمت استعادة تفضيلات التأكيد والأرقام الافتراضية.');
        }}
        resetBranchLabel="استعادة الافتراضي"
      >
        <section
          aria-label="إعدادات التطبيق العامة"
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <h2 className="text-base font-extrabold">
            التفضيلات العامة وسلوك التأكيد والأرقام
          </h2>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <label
              className="flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={generalPrefs.confirmBeforeDelete}
                onChange={(e) =>
                  onUpdateGeneralPrefs({
                    confirmBeforeDelete: e.target.checked,
                  })
                }
                className="mt-0.5"
              />
              <div>
                <div className="font-extrabold">تأكيد صريح قبل الحذف</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  يُظهر رسالة تأكيد قبل نقل السجل إلى سلة الاسترجاع الآمنة.
                </div>
              </div>
            </label>

            <label
              className="flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={generalPrefs.confirmBeforeEdit}
                onChange={(e) =>
                  onUpdateGeneralPrefs({ confirmBeforeEdit: e.target.checked })
                }
                className="mt-0.5"
              />
              <div>
                <div className="font-extrabold">تأكيد صريح قبل حفظ التعديلات</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  يعرض خطوة مراجعة قبل تثبيت تعديل بيانات المستفيد في النوافذ.
                </div>
              </div>
            </label>

            <label
              className="flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={generalPrefs.showActionAlerts}
                onChange={(e) =>
                  onUpdateGeneralPrefs({ showActionAlerts: e.target.checked })
                }
                className="mt-0.5"
              />
              <div>
                <div className="font-extrabold">إظهار إشعارات تأكيد العمليات</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  رسائل خفيفة لتأكيد الحفظ والتحديث والمزامنة.
                </div>
              </div>
            </label>

            <label
              className="flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={generalPrefs.compactNumbers}
                onChange={(e) =>
                  onUpdateGeneralPrefs({ compactNumbers: e.target.checked })
                }
                className="mt-0.5"
              />
              <div>
                <div className="font-extrabold">عرض الأرقام بشكل مضغوط</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  تقليص المسافات داخل خلايا الأرقام والبطاقات الكثيفة.
                </div>
              </div>
            </label>
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4C: TopBar Auto Focus & Visibility Elements
  return (
    <NodeView
      node={activeNode}
      displayMode={displayMode}
      liveStatusText={topBarConfig.autoFocus ? 'إخفاء تلقائي نشط' : 'شريط قياسي'}
      onResetBranch={() => {
        onChangeTopBarConfig({
          mode: 'normal',
          autoFocus: false,
          autoFocusAction: 'hide',
          autoHideInTables: false,
          showViewTitle: true,
          showQuickFocusToggle: true,
          showUndoRedo: true,
          showAuthButton: true,
        });
        onNotifySuccess('تمت استعادة إعدادات الشريط العلوي الافتراضية.');
      }}
      resetBranchLabel="استعادة افتراضي الشريط"
    >
      <section
        className="capsule-glass-card border p-5 space-y-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <h2 className="text-base font-extrabold">
          الإخفاء التلقائي وعناصر الشريط العلوي
        </h2>

        <div
          className="space-y-3 rounded-2xl border p-4 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={topBarConfig.autoFocus}
              onChange={(e) =>
                onChangeTopBarConfig({ autoFocus: e.target.checked })
              }
              className="mt-0.5"
            />
            <div>
              <div className="font-extrabold">
                تفعيل الإخفاء / التصغير التلقائي عند التركيز والتمرير
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                يمكن استعادته بتمرير المؤشر أعلى الشاشة أو عبر الزر العائم.
              </div>
            </div>
          </label>

          {topBarConfig.autoFocus && (
            <div
              className="space-y-2.5 border-t pt-3"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    onChangeTopBarConfig({ autoFocusAction: 'hide' })
                  }
                  className="min-h-[42px] rounded-xl border px-3 py-1.5 font-bold"
                  style={{
                    backgroundColor:
                      (topBarConfig.autoFocusAction || 'hide') === 'hide'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-surface)',
                    borderColor:
                      (topBarConfig.autoFocusAction || 'hide') === 'hide'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    color:
                      (topBarConfig.autoFocusAction || 'hide') === 'hide'
                        ? 'var(--accent)'
                        : 'var(--text-primary)',
                  }}
                >
                  إخفاء تلقائي بالكامل عند التركيز
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChangeTopBarConfig({ autoFocusAction: 'compact' })
                  }
                  className="min-h-[42px] rounded-xl border px-3 py-1.5 font-bold"
                  style={{
                    backgroundColor:
                      topBarConfig.autoFocusAction === 'compact'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-surface)',
                    borderColor:
                      topBarConfig.autoFocusAction === 'compact'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    color:
                      topBarConfig.autoFocusAction === 'compact'
                        ? 'var(--accent)'
                        : 'var(--text-primary)',
                  }}
                >
                  تصغير ارتفاع الشريط فقط
                </button>
              </div>

              <label className="flex min-h-[40px] cursor-pointer items-center gap-2 pt-1 font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(topBarConfig.autoHideInTables)}
                  onChange={(e) =>
                    onChangeTopBarConfig({ autoHideInTables: e.target.checked })
                  }
                />
                <span>إخفاء تلقائي فوري في شاشات الجداول والسحب السريع</span>
              </label>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
          {(
            [
              {
                key: 'showViewTitle',
                label: 'اسم القسم الحالي',
                checked: topBarConfig.showViewTitle !== false,
              },
              {
                key: 'showQuickFocusToggle',
                label: 'أزرار التركيز السريع',
                checked: topBarConfig.showQuickFocusToggle !== false,
              },
              {
                key: 'showUndoRedo',
                label: 'أزرار التراجع والإعادة',
                checked: topBarConfig.showUndoRedo !== false,
              },
              {
                key: 'showAuthButton',
                label: 'زر الحساب والدخول',
                checked: topBarConfig.showAuthButton !== false,
              },
            ] as const
          ).map((item) => (
            <label
              key={item.key}
              className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) =>
                  onChangeTopBarConfig({ [item.key]: e.target.checked })
                }
              />
              <span className="font-bold">{item.label}</span>
            </label>
          ))}
        </div>
      </section>
    </NodeView>
  );
};

/* ─── QUICK EXTRACT & CAMERA CAPSULES (Level 3 -> Level 4) ───────────────── */

interface QuickExtractCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  quickExtractPrefs: QuickExtractPrefs;
  onUpdateQuickExtractPrefs: (patch: Partial<QuickExtractPrefs>) => void;
  onDeleteQuickExtractTemplate: (templateId: string) => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
}

export const QuickExtractCapsules: React.FC<QuickExtractCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  quickExtractPrefs,
  onUpdateQuickExtractPrefs,
  onDeleteQuickExtractTemplate,
  onOpenCapsule,
  onNotifySuccess,
}) => {
  const toggleFocusField = (field: QuickExtractFocusField) => {
    const exists = quickExtractPrefs.focusedFields.includes(field);
    const next = exists
      ? quickExtractPrefs.focusedFields.filter((f) => f !== field)
      : [...quickExtractPrefs.focusedFields, field];
    if (next.length === 0) return;
    onUpdateQuickExtractPrefs({ focusedFields: next });
    onNotifySuccess('تم تحديث الحقول الافتراضية للسحب السريع.');
  };

  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={`${quickExtractPrefs.focusedFields.length} حقول · ${quickExtractPrefs.clarityThreshold}%`}
        onResetBranch={() => {
          onUpdateQuickExtractPrefs({
            defaultScanMode: DEFAULT_QUICK_EXTRACT_PREFS.defaultScanMode,
            focusedFields: [...DEFAULT_QUICK_EXTRACT_PREFS.focusedFields],
            clarityThreshold: DEFAULT_QUICK_EXTRACT_PREFS.clarityThreshold,
          });
          onNotifySuccess(
            'تمت استعادة إعدادات السحب الذكي مع الاحتفاظ بقوالب الدفاتر المحفوظة.'
          );
        }}
        resetBranchLabel="استعادة افتراضي السحب الذكي"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            const preview =
              child.id === 'qe_scan_mode_cap' ? (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>
                    {quickExtractPrefs.defaultScanMode === 'audit'
                      ? 'تدقيق فائق (4 لقطات)'
                      : 'لقطة سريعة'}
                  </span>
                  <span style={{ color: 'var(--accent)' }}>
                    عتبة: {quickExtractPrefs.clarityThreshold}%
                  </span>
                </div>
              ) : child.id === 'qe_fields_cap' ? (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>الحقول المستهدفة</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {quickExtractPrefs.focusedFields.length} حقول نشطة
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>القوالب المرجعية</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {quickExtractPrefs.referenceTemplates.length} قالب
                  </span>
                </div>
              );

            return (
              <NodeCard
                key={child.id}
                node={child}
                badge={badge}
                preview={preview}
                actionLabel="فتح الكبسولة"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}
        </div>
      </NodeView>
    );
  }

  if (activeCapsuleId === 'qe_scan_mode_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={`${quickExtractPrefs.clarityThreshold}%`}
        onResetBranch={() => {
          onUpdateQuickExtractPrefs({
            defaultScanMode: DEFAULT_QUICK_EXTRACT_PREFS.defaultScanMode,
            clarityThreshold: DEFAULT_QUICK_EXTRACT_PREFS.clarityThreshold,
          });
          onNotifySuccess('تمت استعادة وضع التصوير وعتبة الوضوح الافتراضية.');
        }}
      >
        <section
          aria-label="إعدادات السحب الذكي والكاميرا"
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-extrabold">وضع التصوير وعتبة الوضوح</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                onUpdateQuickExtractPrefs({ defaultScanMode: 'fast' });
                onNotifySuccess('تم تعيين الوضع السريع كافتراضي للتصوير.');
              }}
              className="min-h-[84px] rounded-2xl border p-4 text-right"
              style={{
                backgroundColor:
                  quickExtractPrefs.defaultScanMode === 'fast'
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                borderColor:
                  quickExtractPrefs.defaultScanMode === 'fast'
                    ? 'var(--accent)'
                    : 'var(--border-color)',
              }}
            >
              <div className="font-extrabold">وضع سريع (لقطة واحدة فورية)</div>
              <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                مناسب للأوراق الواضحة واستخراج الكشوفات بأسرع وقت ممكن.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdateQuickExtractPrefs({ defaultScanMode: 'audit' });
                onNotifySuccess('تم تعيين وضع التدقيق الفائق كافتراضي للتصوير.');
              }}
              className="min-h-[84px] rounded-2xl border p-4 text-right"
              style={{
                backgroundColor:
                  quickExtractPrefs.defaultScanMode === 'audit'
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                borderColor:
                  quickExtractPrefs.defaultScanMode === 'audit'
                    ? 'var(--accent)'
                    : 'var(--border-color)',
              }}
            >
              <div className="font-extrabold">
                وضع تدقيق فائق (4 لقطات متتالية)
              </div>
              <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                يدمج 4 إطارات لرفع الحدة وكشف التعديلات اليدوية الدقيقة.
              </div>
            </button>
          </div>

          <div
            className="rounded-2xl border p-4 text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="clarity-threshold" className="font-extrabold">
                حد عتبة وضوح الصورة المقبولة (%)
              </label>
              <span
                className="font-extrabold tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                {quickExtractPrefs.clarityThreshold}%
              </span>
            </div>
            <input
              id="clarity-threshold"
              type="range"
              min={30}
              max={85}
              step={5}
              value={quickExtractPrefs.clarityThreshold}
              onChange={(e) =>
                onUpdateQuickExtractPrefs({
                  clarityThreshold: Number(e.target.value),
                })
              }
              className="mt-3 w-full"
            />
          </div>
        </section>
      </NodeView>
    );
  }

  if (activeCapsuleId === 'qe_fields_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={`${quickExtractPrefs.focusedFields.length} حقول`}
        onResetBranch={() => {
          onUpdateQuickExtractPrefs({
            focusedFields: [...DEFAULT_QUICK_EXTRACT_PREFS.focusedFields],
          });
          onNotifySuccess('تمت استعادة الحقول الأربعة الافتراضية.');
        }}
      >
        <section
          className="capsule-glass-card border p-5 space-y-4 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-sm font-extrabold">الحقول الافتراضية المستخرجة:</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ALL_QUICK_EXTRACT_FIELDS.map((field) => {
              const active = quickExtractPrefs.focusedFields.includes(field);
              const label =
                field === 'name'
                  ? 'الأسماء'
                  : field === 'individuals'
                  ? 'عدد الأفراد'
                  : field === 'decreaseCount'
                  ? 'النقصان'
                  : 'إضافة / حذف';
              return (
                <label
                  key={field}
                  className="flex min-h-[54px] cursor-pointer items-center gap-2 rounded-2xl border px-3.5 py-2 font-extrabold"
                  style={{
                    backgroundColor: active
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: active
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleFocusField(field)}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </section>
      </NodeView>
    );
  }

  return (
    <NodeView
      node={activeNode}
      displayMode={displayMode}
      liveStatusText={`${quickExtractPrefs.referenceTemplates.length} قالب`}
    >
      <section
        className="capsule-glass-card border p-5 space-y-3 text-xs"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="text-sm font-extrabold">
          الصور المرجعية المحفوظة لقوالب الدفاتر (
          {quickExtractPrefs.referenceTemplates.length})
        </div>
        {quickExtractPrefs.referenceTemplates.length === 0 ? (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            لا توجد قوالب مرجعية محفوظة بعد. يمكنك رسم قالب مرجعي مباشرة من شاشة «السحب السريع».
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickExtractPrefs.referenceTemplates.map((tpl) => {
              const isActive = quickExtractPrefs.activeTemplateId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border p-3.5"
                  style={{
                    backgroundColor: isActive
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: isActive
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {tpl.imageDataUrl && (
                      <img
                        src={tpl.imageDataUrl}
                        alt={tpl.name}
                        className="h-12 w-16 rounded-lg border object-cover"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">{tpl.name}</div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {tpl.regions.length} مناطق محددة · {tpl.createdAt}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateQuickExtractPrefs({
                          activeTemplateId: isActive ? null : tpl.id,
                        })
                      }
                      className="min-h-[38px] rounded-xl border px-3 py-1 font-bold"
                      style={{
                        backgroundColor: isActive
                          ? 'var(--accent)'
                          : 'var(--bg-surface)',
                        borderColor: 'var(--accent)',
                        color: isActive ? 'var(--accent-fg)' : 'var(--accent)',
                      }}
                    >
                      {isActive ? 'نشط' : 'تفعيل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteQuickExtractTemplate(tpl.id)}
                      aria-label={`حذف القالب ${tpl.name}`}
                      className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border p-1.5"
                      style={{
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </NodeView>
  );
};

/* ─── RELATIONS & READY LISTS CAPSULES (Level 3 -> Level 4) ───────────────── */

interface RelationsListsCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  relationsPrefs: RelationsReadyListsPrefs;
  onUpdateRelationsPrefs: (patch: Partial<RelationsReadyListsPrefs>) => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
}

export const RelationsListsCapsules: React.FC<RelationsListsCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  relationsPrefs,
  onUpdateRelationsPrefs,
  onOpenCapsule,
  onNotifySuccess,
}) => {
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={
          relationsPrefs.autoUpdateReadyListDate
            ? 'تحديث تاريخ تلقائي'
            : 'تحديث يدوي'
        }
        onResetBranch={() => {
          onUpdateRelationsPrefs(DEFAULT_RELATIONS_PREFS);
          onNotifySuccess('تمت استعادة تفضيلات العلاقات والقوائم الافتراضية.');
        }}
        resetBranchLabel="استعادة افتراضي العلاقات"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            const preview =
              child.id === 'rel_export_cap' ? (
                <div className="flex items-center justify-between font-bold">
                  <span>الصيغة: {relationsPrefs.defaultExportFormat.toUpperCase()}</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {relationsPrefs.autoUpdateReadyListDate
                      ? 'تاريخ تلقائي'
                      : 'تاريخ يدوي'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>تنبيه قبل {relationsPrefs.defaultReminderLeadDays} أيام</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {relationsPrefs.enableReminderAlerts ? 'مفعّل' : 'متوقف'}
                  </span>
                </div>
              );

            return (
              <NodeCard
                key={child.id}
                node={child}
                badge={badge}
                preview={preview}
                actionLabel="فتح الكبسولة"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}
        </div>
      </NodeView>
    );
  }

  if (activeCapsuleId === 'rel_export_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        onResetBranch={() => {
          onUpdateRelationsPrefs({
            defaultExportFormat: DEFAULT_RELATIONS_PREFS.defaultExportFormat,
            autoUpdateReadyListDate:
              DEFAULT_RELATIONS_PREFS.autoUpdateReadyListDate,
          });
          onNotifySuccess('تمت استعادة صيغة التصدير وتحديث التاريخ الافتراضي.');
        }}
      >
        <section
          aria-label="إعدادات العلاقات والقوائم الجاهزة"
          className="capsule-glass-card border p-5 space-y-4 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-extrabold">
              صيغة التصدير والتاريخ التلقائي
            </h2>
          </div>

          <div>
            <label className="mb-1.5 block font-extrabold">
              صيغة التصدير المفضلة في القوائم الجاهزة
            </label>
            <select
              value={relationsPrefs.defaultExportFormat}
              onChange={(e) => {
                onUpdateRelationsPrefs({
                  defaultExportFormat: e.target.value as
                    | 'excel'
                    | 'pdf'
                    | 'text'
                    | 'image',
                });
                onNotifySuccess('تم تحديث صيغة التصدير المفضلة.');
              }}
              className="min-h-[44px] w-full rounded-xl border px-3.5 py-2 font-bold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <option value="excel">ملف Excel (.xls)</option>
              <option value="pdf">طباعة / PDF</option>
              <option value="text">مشاركة أو ملف نصي (.txt)</option>
              <option value="image">صورة عالية الدقة (PNG)</option>
            </select>
          </div>

          <label
            className="flex min-h-[60px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={relationsPrefs.autoUpdateReadyListDate}
              onChange={(e) =>
                onUpdateRelationsPrefs({
                  autoUpdateReadyListDate: e.target.checked,
                })
              }
              className="mt-0.5"
            />
            <div>
              <div className="font-extrabold">
                تحديث التاريخ تلقائياً عند إنشاء قائمة جاهزة
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                يفعّل خيار التحديث التلقائي لتاريخ آخر تعديل افتراضياً.
              </div>
            </div>
          </label>
        </section>
      </NodeView>
    );
  }

  return (
    <NodeView
      node={activeNode}
      displayMode={displayMode}
      onResetBranch={() => {
        onUpdateRelationsPrefs({
          defaultReminderLeadDays:
            DEFAULT_RELATIONS_PREFS.defaultReminderLeadDays,
          enableReminderAlerts: DEFAULT_RELATIONS_PREFS.enableReminderAlerts,
          defaultDeliveryNotePrefix:
            DEFAULT_RELATIONS_PREFS.defaultDeliveryNotePrefix,
        });
        onNotifySuccess('تمت استعادة إعدادات التذكير والتوصيل الافتراضية.');
      }}
    >
      <section
        aria-label="تنبيهات التذكير وبادئة التوصيل"
        className="capsule-glass-card border p-5 space-y-4 text-xs"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-extrabold">
              التنبيه قبل موعد التذكير بعدد أيام
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={relationsPrefs.defaultReminderLeadDays}
              onChange={(e) =>
                onUpdateRelationsPrefs({
                  defaultReminderLeadDays: Math.max(
                    0,
                    Math.min(30, Number(e.target.value) || 0)
                  ),
                })
              }
              className="min-h-[44px] w-full rounded-xl border px-3.5 py-2 tabular-nums"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div>
            <label className="mb-1.5 block font-extrabold">
              بادئة تلقائية لملاحظات التوصيل الجديدة
            </label>
            <input
              type="text"
              value={relationsPrefs.defaultDeliveryNotePrefix}
              onChange={(e) =>
                onUpdateRelationsPrefs({
                  defaultDeliveryNotePrefix: e.target.value,
                })
              }
              placeholder="مثال: تسليم عبر الموزع: "
              className="min-h-[44px] w-full rounded-xl border px-3.5 py-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>
        </div>

        <label
          className="flex min-h-[60px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={relationsPrefs.enableReminderAlerts}
            onChange={(e) =>
              onUpdateRelationsPrefs({
                enableReminderAlerts: e.target.checked,
              })
            }
            className="mt-0.5"
          />
          <div>
            <div className="font-extrabold">تفعيل تنبيهات التذكير القادمة</div>
            <div style={{ color: 'var(--text-muted)' }}>
              يظهر شريط تنبيه في قسم العلاقات للتذكيرات القريبة والمستحقة.
            </div>
          </div>
        </label>
      </section>
    </NodeView>
  );
};
