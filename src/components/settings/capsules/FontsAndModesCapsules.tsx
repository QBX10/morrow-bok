import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  Hash,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Tag,
  Type,
} from 'lucide-react';
import type {
  AccessibilityAndExperiencePrefs,
  AppModeTier,
  ArabicFontId,
  ExpertTableConfig,
  FontSizeStep,
  FontWeightStep,
  GeneralAppPrefs,
  RowDensityStep,
  ThemePreferences,
} from '../../../types/agency';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
} from '../../../utils/hierarchyRegistry';
import { resolveHierarchyNodeBadge } from '../../../utils/hierarchyRegistry';
import {
  ARABIC_FONTS,
  DEFAULT_THEME_PREFERENCES,
  FONT_SIZE_MAP,
  FONT_WEIGHT_MAP,
  ROW_DENSITY_MAP,
} from '../../../utils/themes';
import {
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../../utils/tabrixMotion';
import { NodeCard } from '../NodeCard';
import { NodeView } from '../NodeView';

/* ─── FONTS, TYPOGRAPHY & LOCALE CAPSULES ────────────────────────────────── */

interface FontsCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  themePrefs: ThemePreferences;
  accessibility?: AccessibilityAndExperiencePrefs;
  onUpdateThemePrefs: (patch: Partial<ThemePreferences>) => void;
  onUpdateAccessibilityPrefs?: (
    patch: Partial<AccessibilityAndExperiencePrefs>
  ) => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
}

export const FontsCapsules: React.FC<FontsCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  themePrefs,
  accessibility,
  onUpdateThemePrefs,
  onUpdateAccessibilityPrefs,
  onOpenCapsule,
  onNotifySuccess,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const activeFont =
    ARABIC_FONTS.find((f) => f.id === themePrefs.fontFamily) || ARABIC_FONTS[0];
  const numeralSystem = accessibility?.numeralSystem || 'western';
  const calendarSystem = accessibility?.calendarSystem || 'gregorian';

  const formatSampleNumber = (n: string) =>
    numeralSystem === 'hindi'
      ? n.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
      : n;

  const sampleDate = (() => {
    try {
      return new Intl.DateTimeFormat(
        calendarSystem === 'hijri' ? 'ar-SA-u-ca-islamic-umalqura' : 'ar-IQ',
        { dateStyle: 'full' }
      ).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  })();

  // Level 3 Hub
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={`${activeFont.name} · ${FONT_SIZE_MAP[themePrefs.fontSize].label}`}
        onResetBranch={() => {
          onUpdateThemePrefs({
            fontFamily: DEFAULT_THEME_PREFERENCES.fontFamily,
            fontSize: DEFAULT_THEME_PREFERENCES.fontSize,
            fontWeight: DEFAULT_THEME_PREFERENCES.fontWeight,
            rowDensity: DEFAULT_THEME_PREFERENCES.rowDensity,
            tabularNumerals: DEFAULT_THEME_PREFERENCES.tabularNumerals,
            rowHoverHighlight: DEFAULT_THEME_PREFERENCES.rowHoverHighlight,
          });
          onUpdateAccessibilityPrefs?.({
            numeralSystem: 'western',
            calendarSystem: 'gregorian',
          });
          onNotifySuccess('تمت استعادة إعدادات الخطوط والترقيم الافتراضية.');
        }}
        resetBranchLabel="استعادة افتراضي الخطوط"
      >
        {/* Live Typography Specimen Banner */}
        <section
          aria-label="معاينة فورية للخطوط والأرقام"
          className="capsule-glass-card border p-5 space-y-2"
          style={{
            borderColor: 'var(--border-color)',
            fontFamily: activeFont.cssFamily,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-extrabold" style={{ color: 'var(--accent)' }}>
              معاينة الخط الحي: {activeFont.name}
            </span>
            <span className="font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {FONT_SIZE_MAP[themePrefs.fontSize].label} ·{' '}
              {FONT_WEIGHT_MAP[themePrefs.fontWeight].label} ·{' '}
              {numeralSystem === 'hindi' ? 'أرقام هندية (١٢٣)' : 'أرقام غربية (123)'}
            </span>
          </div>
          <div className="text-base sm:text-lg font-extrabold tabular-nums">
            {formatSampleNumber(
              'وكالة منذر الحلو · 5 أفراد = 45 كغم · الرسم التلقائي 1,500 د.ع'
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            const preview =
              child.id === 'fonts_family_cap' ? (
                <div
                  className="flex items-center justify-between font-bold"
                  style={{ fontFamily: activeFont.cssFamily }}
                >
                  <span>{activeFont.name}</span>
                  <span style={{ color: 'var(--accent)' }}>6 خطوط عربية</span>
                </div>
              ) : (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>{FONT_SIZE_MAP[themePrefs.fontSize].label}</span>
                  <span>{ROW_DENSITY_MAP[themePrefs.rowDensity].label}</span>
                </div>
              );

            return (
              <NodeCard
                key={child.id}
                node={child}
                badge={badge}
                preview={preview}
                actionLabel="فتح المحور"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}

          {onUpdateAccessibilityPrefs && (
            <NodeCard
              node={{
                id: 'cap_fonts_locale',
                parentId: sectionNode.id,
                level: 4,
                category: 'settings',
                title: 'الأرقام والتقويم (١٢٣ / هجري)',
                subtitle: 'التبديل بين الأرقام العربية/الهندية والتقويم الهجري والميلادي',
                icon: 'calendar',
                accentTone: 'cyan',
                keywords: ['أرقام', 'هجري', 'ميلادي'],
                target: {
                  view: 'settings',
                  settingsSection: 'fonts',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'cap_fonts_locale',
                },
                children: [],
              }}
              preview={
                <div className="flex items-center justify-between font-bold">
                  <span>{numeralSystem === 'hindi' ? '١٢٣ هندية' : '123 قياسية'}</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {calendarSystem === 'hijri' ? 'التقويم الهجري' : 'التقويم الميلادي'}
                  </span>
                </div>
              }
              actionLabel="فتح المحور"
              onOpen={() => onOpenCapsule('cap_fonts_locale')}
            />
          )}
        </div>
      </NodeView>
    );
  }

  // Deep Sub-Axis: Numerals & Calendar Locale
  if (activeCapsuleId === 'cap_fonts_locale') {
    return (
      <NodeView
        node={{
          ...activeNode,
          id: 'cap_fonts_locale',
          title: 'صيغة الأرقام والتقويم (هجري / ميلادي)',
          description:
            'تحديد شكل الأرقام وطريقة عرض التواريخ في البطاقات والملخصات الرسمية.',
        }}
        displayMode={displayMode}
        liveStatusText={`${
          numeralSystem === 'hindi' ? '١٢٣ هندية' : '123 غربية'
        } · ${calendarSystem === 'hijri' ? 'هجري' : 'ميلادي'}`}
        onResetBranch={() => {
          onUpdateAccessibilityPrefs?.({
            numeralSystem: 'western',
            calendarSystem: 'gregorian',
          });
          onNotifySuccess('تمت استعادة الأرقام القياسية والتقويم الميلادي.');
        }}
      >
        <section
          className="capsule-glass-card border p-5 space-y-5 text-xs"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Numeral System */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <Hash className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>نظام عرض الأرقام</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateAccessibilityPrefs?.({ numeralSystem: 'western' });
                    onNotifySuccess('تم اعتماد الأرقام الغربية القياسية (123).');
                  }}
                  className="rounded-xl border p-3.5 text-right transition-colors"
                  style={{
                    backgroundColor:
                      numeralSystem === 'western'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                    borderColor:
                      numeralSystem === 'western'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                  }}
                >
                  <div className="font-extrabold">أرقام قياسية (123)</div>
                  <div className="mt-1 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    5 أفراد · 45 كغم · 1,500 د.ع
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateAccessibilityPrefs?.({ numeralSystem: 'hindi' });
                    onNotifySuccess('تم اعتماد الأرقام الهندية العربية (١٢٣).');
                  }}
                  className="rounded-xl border p-3.5 text-right transition-colors"
                  style={{
                    backgroundColor:
                      numeralSystem === 'hindi'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                    borderColor:
                      numeralSystem === 'hindi'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                  }}
                >
                  <div className="font-extrabold">أرقام هندية (١٢٣)</div>
                  <div className="mt-1 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    ٥ أفراد · ٤٥ كغم · ١,٥٠٠ د.ع
                  </div>
                </button>
              </div>
            </div>

            {/* Calendar System */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <Calendar className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>نظام التقويم والتاريخ</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateAccessibilityPrefs?.({ calendarSystem: 'gregorian' });
                    onNotifySuccess('تم تفعيل التقويم الميلادي.');
                  }}
                  className="rounded-xl border p-3.5 text-right transition-colors"
                  style={{
                    backgroundColor:
                      calendarSystem === 'gregorian'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                    borderColor:
                      calendarSystem === 'gregorian'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                  }}
                >
                  <div className="font-extrabold">التقويم الميلادي</div>
                  <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                    تشرين الثاني · كانون الأول
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateAccessibilityPrefs?.({ calendarSystem: 'hijri' });
                    onNotifySuccess('تم تفعيل التقويم الهجري (أم القرى).');
                  }}
                  className="rounded-xl border p-3.5 text-right transition-colors"
                  style={{
                    backgroundColor:
                      calendarSystem === 'hijri'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                    borderColor:
                      calendarSystem === 'hijri'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                  }}
                >
                  <div className="font-extrabold">التقويم الهجري</div>
                  <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                    جمادى الآخرة · رمضان
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Live Locale Sample Preview */}
          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              معاينة الترويسة المعتمدة الآن:
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm font-extrabold tabular-nums">
              <span>{sampleDate}</span>
              <span style={{ color: 'var(--accent)' }}>
                {formatSampleNumber('124 عائلة · 620 فرد · 111 كيس')}
              </span>
            </div>
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4A: 6 Arabic Fonts
  if (activeCapsuleId === 'fonts_family_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={activeFont.name}
        onResetBranch={() => {
          onUpdateThemePrefs({
            fontFamily: DEFAULT_THEME_PREFERENCES.fontFamily,
          });
          onNotifySuccess('تمت استعادة الخط العربي الافتراضي.');
        }}
        resetBranchLabel="استعادة الخط الافتراضي"
      >
        <section
          aria-label="الخطوط العربية الاحترافية"
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-extrabold">
              الخطوط العربية الاحترافية (6 خطوط)
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ARABIC_FONTS.map((font) => {
              const selected = themePrefs.fontFamily === font.id;
              return (
                <motion.button
                  key={font.id}
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -3, scale: 1.015 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={() => {
                    onUpdateThemePrefs({
                      fontFamily: font.id as ArabicFontId,
                    });
                    onNotifySuccess(`تم اختيار الخط: ${font.name}`);
                  }}
                  className="flex min-h-[116px] flex-col items-start rounded-2xl border p-4 text-right transition-colors nexus-squircle"
                  style={{
                    fontFamily: font.cssFamily,
                    backgroundColor: selected
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: selected
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className="text-sm font-extrabold"
                      style={{
                        color: selected
                          ? 'var(--accent)'
                          : 'var(--text-primary)',
                      }}
                    >
                      {font.name}
                    </span>
                    {selected && (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                    )}
                  </div>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {font.description}
                  </p>
                  <div className="mt-2.5 text-xs font-bold tabular-nums">
                    {formatSampleNumber('Morrow · 5 أفراد · 45 كغم · 1,500 د.ع')}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4B: Size, Weight, Row Density & Numeric Alignment
  return (
    <NodeView
      node={activeNode}
      displayMode={displayMode}
      liveStatusText={`${FONT_SIZE_MAP[themePrefs.fontSize].label} · ${
        ROW_DENSITY_MAP[themePrefs.rowDensity].label
      }`}
      onResetBranch={() => {
        onUpdateThemePrefs({
          fontSize: DEFAULT_THEME_PREFERENCES.fontSize,
          fontWeight: DEFAULT_THEME_PREFERENCES.fontWeight,
          rowDensity: DEFAULT_THEME_PREFERENCES.rowDensity,
          tabularNumerals: DEFAULT_THEME_PREFERENCES.tabularNumerals,
          rowHoverHighlight: DEFAULT_THEME_PREFERENCES.rowHoverHighlight,
        });
        onNotifySuccess('تمت استعادة مقاسات الخط والتباعد الافتراضية.');
      }}
      resetBranchLabel="استعادة المقاسات الافتراضية"
    >
      <section
        aria-label="الخطوط العربية وأدوات الوضوح"
        className="capsule-glass-card border p-5 space-y-5"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="mb-2.5 text-xs font-extrabold">حجم الخط</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(FONT_SIZE_MAP) as FontSizeStep[]).map((key) => {
                const active = themePrefs.fontSize === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onUpdateThemePrefs({ fontSize: key })}
                    className="min-h-[40px] rounded-xl border px-2.5 py-1.5 text-xs font-bold"
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
                    {FONT_SIZE_MAP[key].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="mb-2.5 text-xs font-extrabold">وزن الخط</div>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(FONT_WEIGHT_MAP) as FontWeightStep[]).map((key) => {
                const active = themePrefs.fontWeight === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onUpdateThemePrefs({ fontWeight: key })}
                    className="min-h-[38px] rounded-xl border px-2.5 py-1.5 text-xs font-bold"
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
                    {FONT_WEIGHT_MAP[key].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="mb-2.5 text-xs font-extrabold">
              ارتفاع الصف وتباعد الأسطر
            </div>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(ROW_DENSITY_MAP) as RowDensityStep[]).map((key) => {
                const active = themePrefs.rowDensity === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onUpdateThemePrefs({ rowDensity: key })}
                    className="min-h-[38px] rounded-xl border px-2.5 py-1.5 text-xs font-bold"
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
                    {ROW_DENSITY_MAP[key].label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className="flex min-h-[60px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4 text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: themePrefs.tabularNumerals
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={themePrefs.tabularNumerals}
              onChange={(e) =>
                onUpdateThemePrefs({ tabularNumerals: e.target.checked })
              }
              className="mt-0.5"
            />
            <div>
              <div className="font-extrabold">
                وضوح الأرقام المتساوي (Tabular Numerals)
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                محاذاة عمودية دقيقة للأرقام والكميات والمبالغ تحت بعضها البعض.
              </div>
            </div>
          </label>

          <label
            className="flex min-h-[60px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4 text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: themePrefs.rowHoverHighlight
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={themePrefs.rowHoverHighlight}
              onChange={(e) =>
                onUpdateThemePrefs({ rowHoverHighlight: e.target.checked })
              }
              className="mt-0.5"
            />
            <div>
              <div className="font-extrabold">مؤشر تتبع السطر عند المرور/اللمس</div>
              <div style={{ color: 'var(--text-muted)' }}>
                تظليل خفيف للسطر بأكمله لقراءة صحيحة من الاسم إلى المبلغ.
              </div>
            </div>
          </label>
        </div>
      </section>
    </NodeView>
  );
};

/* ─── MODES, GRANULAR PERMISSIONS & EXPERT CAPSULES ─────────────────────── */

interface ModesCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  modeTier: AppModeTier;
  editorEnabled: boolean;
  expertTableConfig: ExpertTableConfig;
  generalPrefs?: GeneralAppPrefs;
  onChangeModeTier: (tier: AppModeTier) => void;
  onToggleEditor: (enabled: boolean) => void;
  onUpdateExpertTableConfig: (patch: Partial<ExpertTableConfig>) => void;
  onResetExpertTableConfig: () => void;
  onUpdateGeneralPrefs?: (patch: Partial<GeneralAppPrefs>) => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
}

export const ModesCapsules: React.FC<ModesCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  expertTableConfig,
  generalPrefs,
  onUpdateExpertTableConfig,
  onResetExpertTableConfig,
  onUpdateGeneralPrefs,
  onOpenCapsule,
  onNotifySuccess,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');

  const confirmEdit = generalPrefs?.confirmBeforeEdit ?? true;
  const confirmDelete = generalPrefs?.confirmBeforeDelete ?? true;
  const instantSave = expertTableConfig.allowDirectNoConfirmEdit;

  // Level 3 Hub
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={`${expertTableConfig.customCategories.length} فئات مخصصة`}
        onResetBranch={() => {
          onResetExpertTableConfig();
          onUpdateGeneralPrefs?.({
            confirmBeforeEdit: true,
            confirmBeforeDelete: true,
          });
          onNotifySuccess('تمت استعادة الإعدادات الافتراضية للتحرير وتخطيط الجدول.');
        }}
        resetBranchLabel="إعادة ضبط الجدول والتفضيلات"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sectionNode.children
            .filter((child) => child.id !== 'modes_tier_cap')
            .map((child) => {
              const badge = resolveHierarchyNodeBadge(child, badgeContext);
              const preview =
                child.id === 'modes_editor_cap' ? (
                  <div className="flex items-center justify-between font-bold">
                    <span>نمط الحفظ:</span>
                    <span style={{ color: 'var(--accent)' }}>
                      {instantSave ? 'حفظ فوري مباشر' : 'تأكيد قبل التعديل والحذف'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between font-bold tabular-nums">
                    <span>الفئات المخصصة</span>
                    <span style={{ color: 'var(--accent)' }}>
                      {expertTableConfig.customCategories.length} فئات
                    </span>
                  </div>
                );

              return (
                <NodeCard
                  key={child.id}
                  node={child}
                  badge={badge}
                  preview={preview}
                  actionLabel="فتح الإعدادات"
                  onOpen={(n) => onOpenCapsule(n.id)}
                />
              );
            })}
        </div>
      </NodeView>
    );
  }

  // Level 4A: Editing, Confirmation Rules & Instant Save Preferences
  if (activeCapsuleId === 'modes_tier_cap' || activeCapsuleId === 'modes_editor_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={instantSave ? 'حفظ فوري' : 'تأكيد ذكي نشط'}
      >
        <section
          aria-label="قواعد التأكيد والحفظ السريع"
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <div>
                <h2 className="text-base font-extrabold">
                  قواعد التأكيد والحفظ الفوري
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  التعديل وتخصيص الجداول متاحان دائماً بشكل مباشر؛ حدد هنا متى ترغب بظهور نافذة تأكيد.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <label
              className="flex cursor-pointer items-start gap-2.5 rounded-2xl border p-4 transition-colors"
              style={{
                backgroundColor: instantSave ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor: instantSave ? 'var(--accent)' : 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={instantSave}
                onChange={(e) => {
                  onUpdateExpertTableConfig({
                    allowDirectNoConfirmEdit: e.target.checked,
                  });
                  onNotifySuccess(
                    e.target.checked
                      ? 'تم تفعيل الحفظ الفوري بدون نوافذ تأكيد.'
                      : 'تم تفعيل خطوة التأكيد عند التعديل والحذف.'
                  );
                }}
                className="mt-0.5"
              />
              <div>
                <div className="font-extrabold">حفظ فوري مباشر بدون نوافذ تأكيد</div>
                <div className="mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  يطبق التعديلات في الجدول فوراً مع بقاء سجل التراجع وسلة الاسترجاع نشطة.
                </div>
              </div>
            </label>

            {onUpdateGeneralPrefs && generalPrefs && (
              <>
                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-2xl border p-4 transition-colors"
                  style={{
                    backgroundColor: !instantSave && confirmEdit ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: !instantSave && confirmEdit ? 'var(--accent)' : 'var(--border-color)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmEdit}
                    onChange={(e) => {
                      onUpdateGeneralPrefs({ confirmBeforeEdit: e.target.checked });
                      onNotifySuccess('تم تحديث قاعدة التأكيد قبل التعديل.');
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-extrabold">تأكيد قبل تعديل السجلات</div>
                    <div className="mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      يطلب تأكيداً سريعاً قبل حفظ تعديلات بطاقة المستفيد.
                    </div>
                  </div>
                </label>

                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-2xl border p-4 transition-colors"
                  style={{
                    backgroundColor: !instantSave && confirmDelete ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: !instantSave && confirmDelete ? 'var(--accent)' : 'var(--border-color)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmDelete}
                    onChange={(e) => {
                      onUpdateGeneralPrefs({ confirmBeforeDelete: e.target.checked });
                      onNotifySuccess('تم تحديث قاعدة التأكيد قبل الحذف.');
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-extrabold">تأكيد قبل حذف أي سجل</div>
                    <div className="mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      رسالة حماية قبل نقل السجلات أو المصاريف إلى سلة الاسترجاع.
                    </div>
                  </div>
                </label>
              </>
            )}
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4B: Custom Categories & Default Table Column Layout
  return (
    <NodeView
      node={activeNode}
      displayMode={displayMode}
      liveStatusText={`${expertTableConfig.customCategories.length} فئات`}
      onResetBranch={() => {
        onResetExpertTableConfig();
        onNotifySuccess('تمت استعادة ترتيب وأسماء الأعمدة الافتراضية.');
      }}
      resetBranchLabel="إعادة ضبط تخطيط الجدول"
    >
      <section
        aria-label="الفئات المخصصة وتخطيط الجدول"
        className="capsule-glass-card border p-5 space-y-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold">
              تخصيص الفئات وتخطيط الجدول
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              إدارة الفئات التصنيفية للمستفيدين وإعادة تعيين ترتيب وأسماء الأعمدة الافتراضية.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onResetExpertTableConfig();
              onNotifySuccess('تمت استعادة ترتيب وأسماء الأعمدة الافتراضية.');
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>إعادة ضبط تخطيط الجدول</span>
          </button>
        </div>

        {/* Custom Categories Manager */}
        <div
          className="rounded-2xl border p-4 space-y-3 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-1.5 font-extrabold">
            <Tag className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>إدارة الفئات المخصصة للمستفيدين</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {expertTableConfig.customCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span>{cat}</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateExpertTableConfig({
                      customCategories: expertTableConfig.customCategories.filter(
                        (c) => c !== cat
                      ),
                    })
                  }
                  aria-label={`حذف الفئة ${cat}`}
                  className="text-[11px] font-bold hover:opacity-75"
                  style={{ color: 'var(--danger)' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="أضف فئة جديدة (مثال: توصيل مستعجل)..."
              className="min-h-[44px] min-w-[200px] flex-1 rounded-xl border px-3 py-1.5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = newCategoryName.trim();
                if (!trimmed) return;
                if (!expertTableConfig.customCategories.includes(trimmed)) {
                  onUpdateExpertTableConfig({
                    customCategories: [
                      ...expertTableConfig.customCategories,
                      trimmed,
                    ],
                  });
                  onNotifySuccess(`تمت إضافة الفئة: ${trimmed}`);
                }
                setNewCategoryName('');
              }}
              className="min-h-[44px] rounded-xl px-4 py-1.5 font-extrabold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              إضافة فئة
            </button>
          </div>
        </div>
      </section>
    </NodeView>
  );
};
