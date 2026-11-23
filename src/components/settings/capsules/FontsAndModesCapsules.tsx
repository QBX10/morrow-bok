import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Hash,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Tag,
  Type,
  Unlock,
} from 'lucide-react';
import type {
  AccessibilityAndExperiencePrefs,
  AppModeTier,
  ArabicFontId,
  ExpertTableConfig,
  FontSizeStep,
  FontWeightStep,
  GeneralAppPrefs,
  GranularControlPrefs,
  RowDensityStep,
  ThemePreferences,
} from '../../../types/agency';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
} from '../../../utils/hierarchyRegistry';
import { resolveHierarchyNodeBadge } from '../../../utils/hierarchyRegistry';
import {
  DEFAULT_GRANULAR_CONTROLS,
  MODE_TIER_META,
} from '../../../utils/modePermissions';
import {
  ARABIC_FONTS,
  DEFAULT_THEME_PREFERENCES,
  FONT_SIZE_MAP,
  FONT_WEIGHT_MAP,
  ROW_DENSITY_MAP,
} from '../../../utils/themes';
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
                <button
                  key={font.id}
                  type="button"
                  onClick={() => {
                    onUpdateThemePrefs({
                      fontFamily: font.id as ArabicFontId,
                    });
                    onNotifySuccess(`تم اختيار الخط: ${font.name}`);
                  }}
                  className="flex min-h-[116px] flex-col items-start rounded-2xl border p-4 text-right transition-colors"
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
                </button>
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

const GRANULAR_ITEMS: Array<{
  key: keyof GranularControlPrefs;
  title: string;
  desc: string;
}> = [
  {
    key: 'enableEditRecords',
    title: 'التعديل المباشر داخل الجداول',
    desc: 'تحديث الأسماء والأعداد والأختام مباشرة داخل صفوف الوكالات.',
  },
  {
    key: 'enableAgencyManagement',
    title: 'إنشاء وإدارة الوكالات',
    desc: 'إضافة وكالات جديدة أو تعديل شعاراتها وحالات القفل الخاصة بها.',
  },
  {
    key: 'enableFinance',
    title: 'إظهار قسم الحسابات والمالية',
    desc: 'متابعة الإيرادات والأجور والمصروفات وصافي الأرباح.',
  },
  {
    key: 'enableQuickExtract',
    title: 'محرك السحب الذكي (OCR)',
    desc: 'استخراج قوائم PDF والصور والمطابقة التلقائية بالوكالات.',
  },
  {
    key: 'enableColumnCustomization',
    title: 'تخصيص وترتيب أعمدة الجداول',
    desc: 'إخفاء أو إظهار الأعمدة وإضافة أعمدة مخصصة جديدة.',
  },
  {
    key: 'enableBulkEdit',
    title: 'التحديد المتعدد والإجراءات الجماعية',
    desc: 'نقل أو حظر أو تعديل عدة سجلات دفعة واحدة.',
  },
  {
    key: 'enableSmartAudit',
    title: 'رادار التدقيق وفحص التضاربات',
    desc: 'تنبيه تلقائي عند تكرار الأسماء أو فقدان البيانات.',
  },
  {
    key: 'bypassEditConfirm',
    title: 'تحرير سريع بدون نوافذ تأكيد',
    desc: 'تطبيق تعديلات الصفوف مباشرة مع الاحتفاظ بالتراجع وسلة الاسترجاع.',
  },
];

export const ModesCapsules: React.FC<ModesCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  modeTier,
  editorEnabled,
  expertTableConfig,
  generalPrefs,
  onChangeModeTier,
  onToggleEditor,
  onUpdateExpertTableConfig,
  onResetExpertTableConfig,
  onUpdateGeneralPrefs,
  onOpenCapsule,
  onNotifySuccess,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const currentTierMeta =
    MODE_TIER_META.find((m) => m.tier === modeTier) || MODE_TIER_META[0];
  const granular: GranularControlPrefs = {
    ...DEFAULT_GRANULAR_CONTROLS,
    ...(generalPrefs?.granularControls || {}),
  };

  const toggleGranular = (key: keyof GranularControlPrefs) => {
    const nextVal = !granular[key];
    onUpdateGeneralPrefs?.({
      granularControls: {
        ...granular,
        [key]: nextVal,
      },
    });
    if (key === 'bypassEditConfirm') {
      onUpdateExpertTableConfig({ allowDirectNoConfirmEdit: nextVal });
    }
    onNotifySuccess('تم تحديث مصفوفة الصلاحيات بنجاح.');
  };

  // Level 3 Hub
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={currentTierMeta.title}
        onResetBranch={() => {
          onResetExpertTableConfig();
          onUpdateGeneralPrefs?.({
            granularControls: { ...DEFAULT_GRANULAR_CONTROLS },
          });
          onNotifySuccess('تمت استعادة الصلاحيات القياسية وتخطيط الجدول.');
        }}
        resetBranchLabel="إعادة ضبط الصلاحيات والجدول"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            const preview =
              child.id === 'modes_tier_cap' ? (
                <div className="flex items-center justify-between font-bold">
                  <span>الصلاحيات المفعّلة:</span>
                  <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                    {Object.values(granular).filter(Boolean).length} / 8
                  </span>
                </div>
              ) : child.id === 'modes_editor_cap' ? (
                <div className="flex items-center justify-between font-bold">
                  <span>حالة المحرر:</span>
                  <span
                    style={{
                      color: editorEnabled ? 'var(--success)' : 'var(--text-muted)',
                    }}
                  >
                    {editorEnabled ? 'مفعّل' : 'القراءة فقط'}
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
                actionLabel="فتح المحور"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}
        </div>
      </NodeView>
    );
  }

  // Level 4A: Granular Permissions Matrix & Mode Tiers
  if (activeCapsuleId === 'modes_tier_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={currentTierMeta.title}
      >
        <div className="space-y-5">
          {/* Granular Matrix (Deep Control) */}
          {onUpdateGeneralPrefs && (
            <section
              aria-label="مصفوفة الصلاحيات الدقيقة"
              className="capsule-glass-card border p-5 space-y-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <h2 className="text-base font-extrabold">
                    مصفوفة الصلاحيات التشغيلية المستقلة
                  </h2>
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                  {Object.values(granular).filter(Boolean).length} من {GRANULAR_ITEMS.length} نشط
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                {GRANULAR_ITEMS.map((item) => {
                  const checked = Boolean(granular[item.key]);
                  return (
                    <label
                      key={item.key}
                      className="flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-2xl border p-3.5 transition-colors"
                      style={{
                        backgroundColor: checked
                          ? 'var(--bg-nav-active)'
                          : 'var(--bg-main)',
                        borderColor: checked
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGranular(item.key)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-extrabold">{item.title}</div>
                        <div
                          className="mt-0.5 leading-relaxed"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {item.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Mode Tier Selector */}
          <section
            aria-label="قسم الأوضاع"
            className="capsule-glass-card border p-5 space-y-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-extrabold">
                مستوى التحكم العام للوضع الموحد
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODE_TIER_META.map((item) => {
                const selected = modeTier === item.tier;
                return (
                  <button
                    key={item.tier}
                    type="button"
                    onClick={() => {
                      onChangeModeTier(item.tier);
                      onNotifySuccess(`تم التبديل إلى: ${item.title}`);
                    }}
                    className="flex min-h-[96px] flex-col items-start rounded-2xl border p-4 text-right transition-colors"
                    style={{
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
                        {item.title}
                      </span>
                      {selected && (
                        <CheckCircle2
                          className="h-4 w-4 shrink-0"
                          style={{ color: 'var(--accent)' }}
                        />
                      )}
                    </div>
                    <p
                      className="mt-1.5 text-xs leading-relaxed"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {item.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </NodeView>
    );
  }

  // Level 4B: Editor Mode
  if (activeCapsuleId === 'modes_editor_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={editorEnabled ? 'المحرر مفعّل' : 'القراءة فقط'}
      >
        <section
          aria-label="قسم المحرر"
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {editorEnabled ? (
                <Unlock
                  className="h-4 w-4"
                  style={{ color: 'var(--success)' }}
                />
              ) : (
                <Lock
                  className="h-4 w-4"
                  style={{ color: 'var(--text-muted)' }}
                />
              )}
              <h2 className="text-base font-extrabold">
                وضع «المحرر» وقواعد التأكيد والحماية
              </h2>
            </div>

            <button
              type="button"
              disabled={modeTier === 'beginner'}
              onClick={() => {
                onToggleEditor(!editorEnabled);
                onNotifySuccess(
                  !editorEnabled ? 'تم تفعيل وضع المحرر.' : 'تم إيقاف وضع المحرر.'
                );
              }}
              className="min-h-[44px] rounded-xl px-4 py-2 text-xs font-extrabold whitespace-nowrap disabled:opacity-45"
              style={{
                backgroundColor: editorEnabled
                  ? 'var(--success)'
                  : 'var(--accent)',
                color: editorEnabled
                  ? 'var(--success-fg)'
                  : 'var(--accent-fg)',
              }}
            >
              {modeTier === 'beginner'
                ? 'مقفل في الوضع المبتدئ'
                : editorEnabled
                ? 'المحرر مفعّل (انقر للتعطيل)'
                : 'تفعيل المحرر الآن'}
            </button>
          </div>

          {onUpdateGeneralPrefs && generalPrefs && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: generalPrefs.confirmBeforeEdit
                    ? 'var(--accent)'
                    : 'var(--border-color)',
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
                  <div className="font-extrabold">تأكيد قبل تعديل السجلات</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    يطلب موافقة عند حفظ تغييرات البطاقة الشخصية.
                  </div>
                </div>
              </label>

              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: generalPrefs.confirmBeforeDelete
                    ? 'var(--accent)'
                    : 'var(--border-color)',
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
                  <div className="font-extrabold">تأكيد قبل حذف أي سجل</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    نافذة حماية قبل نقل العناصر إلى سلة الاسترجاع.
                  </div>
                </div>
              </label>
            </div>
          )}
        </section>
      </NodeView>
    );
  }

  // Level 4C: Expert Freedom & Custom Categories
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
        aria-label="تحكم الخبير المطلق"
        className="capsule-glass-card border p-5 space-y-4"
        style={{
          borderColor:
            modeTier === 'expert' ? 'var(--accent)' : 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold">
              الحرية المطلقة وتخصيص الجدول والفئات
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              إدارة الفئات التصنيفية للمستفيدين، التحرير السريع، وتخطيط الأعمدة الافتراضي.
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

        <label
          className="flex min-h-[60px] cursor-pointer items-start gap-2.5 rounded-2xl border p-4 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: expertTableConfig.allowDirectNoConfirmEdit
              ? 'var(--accent)'
              : 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={expertTableConfig.allowDirectNoConfirmEdit}
            onChange={(e) => {
              onUpdateExpertTableConfig({
                allowDirectNoConfirmEdit: e.target.checked,
              });
              onNotifySuccess(
                e.target.checked
                  ? 'تم تفعيل التحرير والحفظ الفوري بدون نوافذ تأكيد.'
                  : 'تمت إعادة تفعيل خطوة التأكيد عند التعديل والحذف.'
              );
            }}
            className="mt-0.5"
          />
          <div>
            <div className="font-extrabold">
              تحرير وحفظ فوري بدون نوافذ تأكيد
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              تعديل الأسماء والأعداد والأعمدة المخصصة مباشرة مع حفظ المحذوفات في سلة الاسترجاع.
            </div>
          </div>
        </label>

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
