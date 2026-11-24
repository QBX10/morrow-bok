import React, { useState } from 'react';
import {
  CheckCircle2,
  Palette,
  RotateCcw,
  ShieldCheck,
  Table2,
  Trash2,
} from 'lucide-react';
import type {
  AccessibilityAndExperiencePrefs,
  CardShadowLevel,
  ConditionalFormattingPrefs,
  CustomThemePreset,
  ThemePreferences,
  TopBarConfig,
  TopBarFocusMode,
} from '../../../types/agency';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
} from '../../../utils/hierarchyRegistry';
import { resolveHierarchyNodeBadge } from '../../../utils/hierarchyRegistry';
import {
  DEFAULT_APPEARANCE_PROFILES,
  DEFAULT_THEME_PREFERENCES,
  OBSIDIAN_GOLD_THEME,
  resolveTableThemeId,
  TABLE_THEMES,
} from '../../../utils/themes';
import { NodeCard } from '../NodeCard';
import { NodeView } from '../NodeView';

interface AppearanceCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  themePrefs: ThemePreferences;
  topBarConfig: TopBarConfig;
  onUpdateThemePrefs: (patch: Partial<ThemePreferences>) => void;
  onResetThemePrefs: () => void;
  onSaveAppearanceProfile: (name: string) => void;
  onApplyAppearanceProfile: (profileId: string) => void;
  onDeleteAppearanceProfile: (profileId: string) => void;
  onChangeTopBarConfig: (patch: Partial<TopBarConfig>) => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
  accessibility?: AccessibilityAndExperiencePrefs;
  onSaveCustomTheme?: (preset: Omit<CustomThemePreset, 'id' | 'createdAt'>) => void;
  onDeleteCustomTheme?: (id: string) => void;
}

export const AppearanceCapsules: React.FC<AppearanceCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  themePrefs,
  topBarConfig,
  onUpdateThemePrefs,
  onResetThemePrefs,
  onSaveAppearanceProfile,
  onApplyAppearanceProfile,
  onDeleteAppearanceProfile,
  onChangeTopBarConfig,
  onOpenCapsule,
  onNotifySuccess,
  accessibility,
  onSaveCustomTheme,
  onDeleteCustomTheme,
}) => {
  const [newProfileName, setNewProfileName] = useState('');

  const activeTableTheme = resolveTableThemeId(themePrefs.tableTheme);
  const currentThemeObj = OBSIDIAN_GOLD_THEME;
  const savedProfiles =
    themePrefs.savedProfiles && themePrefs.savedProfiles.length > 0
      ? themePrefs.savedProfiles
      : DEFAULT_APPEARANCE_PROFILES;

  const cond = themePrefs.conditionalFormatting || {
    highlightBlockedRows: true,
    highlightDuplicateNames: true,
    highlightZeroIndividuals: true,
  };

  const updateCond = (patch: Partial<ConditionalFormattingPrefs>) =>
    onUpdateThemePrefs({
      conditionalFormatting: { ...cond, ...patch },
    });

  const modernFeatures: Array<{
    key: keyof Pick<
      ThemePreferences,
      | 'stickyHeaderAndName'
      | 'compactStatusBadges'
      | 'smartNumericSplit'
      | 'softGroupDividers'
      | 'activeRowFocusMode'
    >;
    title: string;
    description: string;
  }> = [
    {
      key: 'stickyHeaderAndName',
      title: 'تثبيت عمود الاسم ورأس الجدول',
      description:
        'يبقي رأس الجدول وعمود الاسم ثابتين عند التمرير الأفقي والعمودي لسهولة قراءة الأرقام.',
    },
    {
      key: 'compactStatusBadges',
      title: 'شارات حالة صغيرة وواضحة',
      description:
        'استبدال النصوص الطويلة بعلامات مرئية مركزة مثل: نشط، جزئي، كامل، مؤرشف.',
    },
    {
      key: 'smartNumericSplit',
      title: 'تقسيم بصري ذكي للأرقام',
      description:
        'تظليل خلفية الأعمدة الرقمية بدرجة فائقة النعومة لفصل الأسماء عن الحسابات والأفراد.',
    },
    {
      key: 'softGroupDividers',
      title: 'فواصل مجموعات ناعمة',
      description:
        'خطوط تقسيم أنيقة بين الوكالات في السجل الشامل دون تشتيت الانتباه.',
    },
    {
      key: 'activeRowFocusMode',
      title: 'وضع التركيز على السطر النشط',
      description:
        'عند النقر على أي سطر يبرز بلون واضح وتهدأ باقي السطور لتجنب تداخل الأرقام.',
    },
  ];

  // Level 3 Hub: Locked Obsidian & Gold Banner + Profiles, Geometry & Tables
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={`${currentThemeObj.name} · ${
          TABLE_THEMES.find((t) => t.id === activeTableTheme)?.name || ''
        }`}
        onResetBranch={() => {
          onResetThemePrefs();
          onNotifySuccess(
            'تمت استعادة إعدادات الجداول والزجاجية مع الحفاظ على هوية السبج والذهب.'
          );
        }}
        resetBranchLabel="استعادة افتراضيات الجداول والأبعاد"
      >
        {/* Locked Obsidian & Gold Identity Status Banner */}
        <section className="smoked-glass rounded-2xl border border-[#D4AF37]/30 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/15">
              <ShieldCheck className="h-5 w-5 text-[#F3E5AB]" />
            </div>
            <div>
              <div className="text-sm font-black text-[#F3E5AB]">
                الهوية البصرية المعتمدة: السبج والذهب (Obsidian & Gold)
              </div>
              <div className="text-[11px] text-[#9898AA]">
                مقفل على نظام الزجاج الدخاني الأسود (#09090B) مع اللمسات الذهبية المعدنية (#D4AF37).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {currentThemeObj.swatches.map((hex, i) => (
              <span
                key={i}
                className="h-5 w-7 rounded-md border border-[#D4AF37]/35"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            let preview: React.ReactNode = null;

            if (child.id === 'appearance_profiles_cap') {
              preview = (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold truncate">
                    {savedProfiles[0]?.name || 'ملف مظهر'}
                  </span>
                  <span
                    className="font-bold tabular-nums"
                    style={{ color: 'var(--accent)' }}
                  >
                    {savedProfiles.length} ملفات محفوظة
                  </span>
                </div>
              );
            } else if (child.id === 'appearance_geometry_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>تدوير: {themePrefs.borderRadiusPx ?? 22}px</span>
                  <span>صف: {themePrefs.rowHeightPx ?? 42}px</span>
                  <span>
                    {themePrefs.glassEffect ? 'زجاجي مفعّل' : 'سطح صلب'}
                  </span>
                </div>
              );
            } else if (child.id === 'appearance_tables_cap') {
              preview = (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span>معاينة مصغرة:</span>
                    <span style={{ color: 'var(--accent)' }}>
                      {TABLE_THEMES.find((t) => t.id === activeTableTheme)?.name}
                    </span>
                  </div>
                  <div
                    className="grid grid-cols-3 gap-1 rounded-lg border p-1 text-[10px] font-bold tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <span>الاسم</span>
                    <span className="text-center">الأفراد</span>
                    <span className="text-center">المبلغ</span>
                  </div>
                </div>
              );
            }

            return (
              <NodeCard
                key={child.id}
                node={child}
                badge={badge}
                preview={preview}
                actionLabel="فتح الأداة"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}
        </div>

        {/* Preserved Topbar Size Switcher */}
        <section
          className="capsule-glass-card border p-5 space-y-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <h2 className="text-sm font-extrabold">حجم وشكل الشريط العلوي</h2>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            {(
              [
                { id: 'normal', label: 'صغير ومريح (افتراضي)' },
                { id: 'compact', label: 'مضغوط جداً' },
                { id: 'hidden', label: 'مخفي دائماً (زر استعادة)' },
              ] as Array<{ id: TopBarFocusMode; label: string }>
            ).map((opt) => {
              const active = topBarConfig.mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeTopBarConfig({ mode: opt.id })}
                  className="min-h-[44px] rounded-xl border px-3 py-2 font-bold"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent)'
                      : 'var(--bg-main)',
                    borderColor: active
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: active ? 'var(--accent-fg)' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4A: Saved Profiles Capsule
  if (activeCapsuleId === 'appearance_profiles_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={`${savedProfiles.length} ملفات`}
        onResetBranch={() => {
          onResetThemePrefs();
          onNotifySuccess('تمت استعادة المظهر الافتراضي مع حفظ جميع ملفاتك.');
        }}
        resetBranchLabel="استعادة الافتراضي"
      >
        <section
          aria-label="ملفات المظهر المحفوظة"
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedProfiles.map((profile) => {
              const active = themePrefs.activeProfileId === profile.id;
              const isBuiltIn = profile.id.startsWith('preset_');
              return (
                <div
                  key={profile.id}
                  className="flex flex-col justify-between rounded-2xl border p-4 text-xs"
                  style={{
                    backgroundColor: active
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: active
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-sm">
                        {profile.name}
                      </span>
                      {!isBuiltIn && (
                        <button
                          type="button"
                          aria-label={`حذف ملف المظهر ${profile.name}`}
                          onClick={() => {
                            onDeleteAppearanceProfile(profile.id);
                            onNotifySuccess(
                              `تم حذف ملف المظهر: ${profile.name}`
                            );
                          }}
                          className="rounded-lg p-1.5 hover:opacity-80"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div
                      className="mt-1.5 text-[11px] tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {profile.fontSizePx}px · صف {profile.rowHeightPx}px · تدوير{' '}
                      {profile.borderRadiusPx}px
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onApplyAppearanceProfile(profile.id);
                      onNotifySuccess(`تم تطبيق ملف المظهر: ${profile.name}`);
                    }}
                    className="mt-3 min-h-[42px] w-full rounded-xl border px-3 py-2 font-extrabold"
                    style={{
                      backgroundColor: active
                        ? 'var(--accent)'
                        : 'var(--bg-surface)',
                      borderColor: active
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                      color: active
                        ? 'var(--accent-fg)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {active ? 'مفعّل حالياً' : 'تطبيق الملف'}
                  </button>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = newProfileName.trim();
              if (!trimmed) return;
              onSaveAppearanceProfile(trimmed);
              setNewProfileName('');
              onNotifySuccess(`تم حفظ المظهر الحالي باسم «${trimmed}».`);
            }}
            className="flex flex-wrap items-center gap-2 pt-2 text-xs"
          >
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="اسم ملف المظهر الجديد (مثال: وضع التدقيق المسائي)..."
              className="min-h-[48px] min-w-[220px] flex-1 rounded-xl border px-3.5 py-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="submit"
              className="min-h-[48px] rounded-xl px-5 py-2 font-extrabold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              حفظ التخصيص الحالي كملف
            </button>
          </form>
        </section>
      </NodeView>
    );
  }

  // Level 4C: Geometry & Glassmorphism Capsule
  if (activeCapsuleId === 'appearance_geometry_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={`تدوير ${themePrefs.borderRadiusPx ?? 12}px`}
        onResetBranch={() => {
          onUpdateThemePrefs({
            fontSizePx: DEFAULT_THEME_PREFERENCES.fontSizePx,
            rowHeightPx: DEFAULT_THEME_PREFERENCES.rowHeightPx,
            colWidthScale: DEFAULT_THEME_PREFERENCES.colWidthScale,
            borderRadiusPx: DEFAULT_THEME_PREFERENCES.borderRadiusPx,
            cardShadowLevel: DEFAULT_THEME_PREFERENCES.cardShadowLevel,
            glassEffect: DEFAULT_THEME_PREFERENCES.glassEffect,
          });
          onNotifySuccess('تمت استعادة الهندسة والظلال الافتراضية فقط.');
        }}
        resetBranchLabel="استعادة الهندسة الافتراضية"
      >
        <section
          aria-label="أبعاد الواجهة والزجاجية"
          className="capsule-glass-card border p-5 space-y-4 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between font-extrabold">
                <label htmlFor="slider-font-size-px">حجم الخط العام</label>
                <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                  {themePrefs.fontSizePx ?? 15}px
                </span>
              </div>
              <input
                id="slider-font-size-px"
                type="range"
                min={12}
                max={22}
                step={1}
                value={themePrefs.fontSizePx ?? 15}
                onChange={(e) =>
                  onUpdateThemePrefs({ fontSizePx: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>

            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between font-extrabold">
                <label htmlFor="slider-row-height-px">ارتفاع صف الجدول</label>
                <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                  {themePrefs.rowHeightPx ?? 42}px
                </span>
              </div>
              <input
                id="slider-row-height-px"
                type="range"
                min={32}
                max={68}
                step={2}
                value={themePrefs.rowHeightPx ?? 42}
                onChange={(e) =>
                  onUpdateThemePrefs({ rowHeightPx: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>

            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between font-extrabold">
                <label htmlFor="slider-col-width-scale">مقياس عرض الأعمدة</label>
                <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                  {themePrefs.colWidthScale ?? 100}%
                </span>
              </div>
              <input
                id="slider-col-width-scale"
                type="range"
                min={85}
                max={135}
                step={5}
                value={themePrefs.colWidthScale ?? 100}
                onChange={(e) =>
                  onUpdateThemePrefs({ colWidthScale: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>

            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between font-extrabold">
                <label htmlFor="slider-border-radius-px">
                  انحناء الحواف (Border Radius)
                </label>
                <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                  {themePrefs.borderRadiusPx ?? 12}px
                </span>
              </div>
              <input
                id="slider-border-radius-px"
                type="range"
                min={4}
                max={24}
                step={2}
                value={themePrefs.borderRadiusPx ?? 12}
                onChange={(e) =>
                  onUpdateThemePrefs({ borderRadiusPx: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="font-extrabold">
                مستوى ظلال البطاقات (Depth & Elevation)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['none', 'مسطح'],
                    ['soft', 'ناعم'],
                    ['elevated', 'بارز'],
                  ] as Array<[CardShadowLevel, string]>
                ).map(([lvl, label]) => {
                  const active = (themePrefs.cardShadowLevel || 'soft') === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() =>
                        onUpdateThemePrefs({ cardShadowLevel: lvl })
                      }
                      className="min-h-[42px] rounded-xl border py-1.5 font-extrabold"
                      style={{
                        backgroundColor: active
                          ? 'var(--accent)'
                          : 'var(--bg-surface)',
                        borderColor: active
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                        color: active
                          ? 'var(--accent-fg)'
                          : 'var(--text-primary)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label
              className="flex min-h-[68px] cursor-pointer items-center gap-3 rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: themePrefs.glassEffect
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(themePrefs.glassEffect)}
                onChange={(e) =>
                  onUpdateThemePrefs({ glassEffect: e.target.checked })
                }
              />
              <div>
                <div className="font-extrabold">
                  تفعيل تأثير الزجاج المصقول (Glassmorphism)
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  تغبيش ناعم للبطاقات العائمة ورؤوس الجداول مع احترام تقليل الحركة.
                </div>
              </div>
            </label>
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4D: Tables Hub Capsule (links into Level 5 Table Engines & Table Rules)
  const renderTableEnginesAndPreview = () => (
    <section
      aria-label="ثيمات الجداول"
      className="capsule-glass-card border p-5 space-y-4"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-2">
        <Table2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-base font-extrabold">
            محركات تصميم الجداول (8 تصاميم احترافية)
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            تشمل العرض الجدولي الصارم أو العرض البطاقي المرن على الشاشات كافة
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TABLE_THEMES.map((tableTheme) => {
          const selected = activeTableTheme === tableTheme.id;
          return (
            <button
              key={tableTheme.id}
              type="button"
              onClick={() => {
                onUpdateThemePrefs({
                  tableTheme: tableTheme.id,
                  activeProfileId: null,
                });
                onNotifySuccess(`تم تفعيل تصميم الجدول: ${tableTheme.name}`);
              }}
              className="flex min-h-[124px] flex-col items-start rounded-2xl border p-3.5 text-right transition-colors"
              style={{
                backgroundColor: selected
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
                borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
              }}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className="text-sm font-extrabold"
                  style={{
                    color: selected ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  {tableTheme.name}
                </span>
                {selected && (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--accent)' }}
                  />
                )}
              </div>
              <div
                className="text-[11px] font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                {tableTheme.englishName}
              </div>
              <p
                className="mt-1.5 text-[11px] leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {tableTheme.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Live Table / Card Preview */}
      <div className="space-y-2 pt-2">
        <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
          معاينة حية لمظهر الجدول والبطاقات الحالي:
        </div>

        {activeTableTheme === 'card-based' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div
              className="tabrix-card border p-3.5 space-y-2"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between font-bold">
                <span>حسين علي كاظم</span>
                <span style={{ color: 'var(--success)' }}>نشط</span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span>الأفراد: 5</span>
                <span>45 كغم</span>
                <span>1,500 د.ع</span>
              </div>
            </div>
            <div
              className="tabrix-card border p-3.5 space-y-2"
              style={{
                backgroundColor: cond.highlightZeroIndividuals
                  ? 'var(--warning-bg)'
                  : 'var(--bg-main)',
                borderColor: cond.highlightZeroIndividuals
                  ? 'var(--warning)'
                  : 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between font-bold">
                <span>نموذج تنبيه 0 أفراد</span>
                <span style={{ color: 'var(--warning)' }}>0 أفراد</span>
              </div>
              <div className="flex items-center justify-between tabular-nums">
                <span>الأفراد: 0</span>
                <span>—</span>
                <span>0 د.ع</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="tabrix-card overflow-x-auto border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <table
              className={`agency-table theme-${activeTableTheme} ${
                themePrefs.rowHoverHighlight ? 'hover-highlight' : ''
              } text-right text-xs`}
            >
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-table-header)' }}>
                  <th className="px-3 text-center">#</th>
                  <th className="px-3">الاسم</th>
                  <th className="px-3 text-center">الأفراد</th>
                  <th className="px-3 text-center">الحصة</th>
                  <th className="px-3 text-center">المبلغ</th>
                  <th className="px-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 text-center tabular-nums">1</td>
                  <td className="px-3 font-semibold">حسين علي كاظم</td>
                  <td
                    className={`px-3 text-center font-bold ${
                      themePrefs.tabularNumerals ? 'tabular-nums' : ''
                    }`}
                    style={
                      themePrefs.smartNumericSplit
                        ? { backgroundColor: 'var(--bg-numeric)' }
                        : undefined
                    }
                  >
                    5
                  </td>
                  <td
                    className={`px-3 text-center ${
                      themePrefs.tabularNumerals ? 'tabular-nums' : ''
                    }`}
                    style={
                      themePrefs.smartNumericSplit
                        ? { backgroundColor: 'var(--bg-numeric)' }
                        : undefined
                    }
                  >
                    45 كغم
                  </td>
                  <td
                    className={`px-3 text-center ${
                      themePrefs.tabularNumerals ? 'tabular-nums' : ''
                    }`}
                    style={
                      themePrefs.smartNumericSplit
                        ? { backgroundColor: 'var(--bg-numeric)' }
                        : undefined
                    }
                  >
                    1,500 د.ع
                  </td>
                  <td className="px-3 text-center">
                    <span
                      className={
                        themePrefs.compactStatusBadges
                          ? 'inline-block rounded-md px-2 py-0.5 text-[11px] font-bold'
                          : 'text-xs font-semibold'
                      }
                      style={{
                        color: 'var(--success)',
                        backgroundColor: themePrefs.compactStatusBadges
                          ? 'var(--success-bg)'
                          : 'transparent',
                      }}
                    >
                      نشط
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );

  const renderTableRules = () => (
    <section
      className="capsule-glass-card border p-5 space-y-4 text-xs"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="space-y-2.5">
        <div className="text-sm font-extrabold">
          قواعد التنسيق الشرطي (Conditional Formatting):
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <label
            className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border p-3"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: cond.highlightBlockedRows
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={cond.highlightBlockedRows}
              onChange={(e) =>
                updateCond({ highlightBlockedRows: e.target.checked })
              }
            />
            <span className="font-bold">تمييز الصفوف المحجوبة</span>
          </label>

          <label
            className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border p-3"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: cond.highlightDuplicateNames
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={cond.highlightDuplicateNames}
              onChange={(e) =>
                updateCond({ highlightDuplicateNames: e.target.checked })
              }
            />
            <span className="font-bold">تلوين الأسماء المكررة بالأحمر</span>
          </label>

          <label
            className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border p-3"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: cond.highlightZeroIndividuals
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={cond.highlightZeroIndividuals}
              onChange={(e) =>
                updateCond({ highlightZeroIndividuals: e.target.checked })
              }
            />
            <span className="font-bold">تنبيه سجلات 0 أفراد بالأصفر</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
        {modernFeatures.map((feat) => (
          <label
            key={feat.key}
            className="flex min-h-[60px] cursor-pointer items-start gap-2.5 rounded-2xl border p-3.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: themePrefs[feat.key]
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={themePrefs[feat.key]}
              onChange={(e) =>
                onUpdateThemePrefs({ [feat.key]: e.target.checked })
              }
              className="mt-0.5"
            />
            <div>
              <div className="font-extrabold">{feat.title}</div>
              <div
                className="mt-0.5 leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {feat.description}
              </div>
            </div>
          </label>
        ))}
      </div>
    </section>
  );

  if (activeCapsuleId === 'appearance_tables_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={
          TABLE_THEMES.find((t) => t.id === activeTableTheme)?.name
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {activeNode.children.map((subCap) => (
            <NodeCard
              key={subCap.id}
              node={subCap}
              actionLabel="فتح المستوى الخامس"
              onOpen={(n) => onOpenCapsule(n.id)}
            />
          ))}
        </div>
        {renderTableEnginesAndPreview()}
      </NodeView>
    );
  }

  if (activeCapsuleId === 'appearance_table_engines_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={
          TABLE_THEMES.find((t) => t.id === activeTableTheme)?.name
        }
      >
        {renderTableEnginesAndPreview()}
      </NodeView>
    );
  }

  if (activeCapsuleId === 'appearance_table_rules_cap') {
    return (
      <NodeView node={activeNode} displayMode={displayMode}>
        {renderTableRules()}
      </NodeView>
    );
  }

  return (
    <NodeView node={activeNode} displayMode={displayMode}>
      <button
        type="button"
        onClick={() => onOpenCapsule(null)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span>العودة لاستوديو المظهر</span>
      </button>
    </NodeView>
  );
};

export default AppearanceCapsules;
