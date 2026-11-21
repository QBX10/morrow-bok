import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Calculator,
  Camera,
  CheckCircle2,
  CloudUpload,
  Download,
  FileJson,
  Lock,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Table2,
  Tag,
  Trash2,
  Type,
  Unlock,
  Upload,
} from 'lucide-react';
import type {
  AppDatabaseState,
  AppModeTier,
  ArabicFontId,
  AuthUser,
  CalculationSettings,
  CardShadowLevel,
  ConditionalFormattingPrefs,
  ExpertTableConfig,
  FontSizeStep,
  FontWeightStep,
  GeneralAppPrefs,
  QuickExtractFocusField,
  QuickExtractPrefs,
  RecycleBinEntry,
  RelationsReadyListsPrefs,
  RowDensityStep,
  SecurityPrefs,
  SettingsSectionId,
  ThemePreferences,
  TopBarConfig,
  TopBarFocusMode,
} from '../types/agency';
import {
  calculateAllocation,
  formatIqd,
  formatQuota,
} from '../utils/agencyLogic';
import { MODE_TIER_META } from '../utils/modePermissions';
import { ALL_QUICK_EXTRACT_FIELDS } from '../utils/quickExtractEngine';
import {
  APP_THEMES,
  ARABIC_FONTS,
  DEFAULT_APPEARANCE_PROFILES,
  FONT_SIZE_MAP,
  FONT_WEIGHT_MAP,
  resolveAppThemeId,
  resolveTableThemeId,
  ROW_DENSITY_MAP,
  TABLE_THEMES,
} from '../utils/themes';

interface SettingsViewProps {
  activeSection: SettingsSectionId;
  onChangeSection: (section: SettingsSectionId) => void;
  onBackToApp: () => void;
  state: AppDatabaseState;
  modeTier: AppModeTier;
  editorEnabled: boolean;
  darkTheme: boolean;
  requireLoginOnStart: boolean;
  calculationSettings: CalculationSettings;
  themePrefs: ThemePreferences;
  topBarConfig: TopBarConfig;
  expertTableConfig: ExpertTableConfig;
  quickExtractPrefs: QuickExtractPrefs;
  relationsPrefs: RelationsReadyListsPrefs;
  generalPrefs: GeneralAppPrefs;
  securityPrefs: SecurityPrefs;
  recycleBin: RecycleBinEntry[];
  authUser: AuthUser | null;
  onChangeModeTier: (tier: AppModeTier) => void;
  onToggleEditor: (enabled: boolean) => void;
  onToggleDarkTheme: (dark: boolean) => void;
  onToggleRequireLogin: (req: boolean) => void;
  onSaveCalculationSettings: (calc: CalculationSettings) => void;
  onUpdateThemePrefs: (patch: Partial<ThemePreferences>) => void;
  onResetThemePrefs: () => void;
  onSaveAppearanceProfile: (name: string) => void;
  onApplyAppearanceProfile: (profileId: string) => void;
  onDeleteAppearanceProfile: (profileId: string) => void;
  onChangeTopBarConfig: (patch: Partial<TopBarConfig>) => void;
  onUpdateExpertTableConfig: (patch: Partial<ExpertTableConfig>) => void;
  onResetExpertTableConfig: () => void;
  onUpdateQuickExtractPrefs: (patch: Partial<QuickExtractPrefs>) => void;
  onDeleteQuickExtractTemplate: (templateId: string) => void;
  onUpdateRelationsPrefs: (patch: Partial<RelationsReadyListsPrefs>) => void;
  onUpdateGeneralPrefs: (patch: Partial<GeneralAppPrefs>) => void;
  onUpdateSecurityPrefs: (patch: Partial<SecurityPrefs>) => void;
  onRestoreRecycleBinItem: (entryId: string) => void;
  onPurgeRecycleBinItem: (entryId: string) => void;
  onClearRecycleBin: () => void;
  onImportWorkspaceJson: (rawJson: string) => void;
  onSyncServer: () => Promise<void>;
  onRestoreServer: () => Promise<boolean>;
  onOpenAuth: () => void;
}

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'appearance', label: 'استوديو المظهر', icon: Palette },
  { id: 'fonts', label: 'الخطوط والتباعد', icon: Type },
  { id: 'modes', label: 'الأوضاع وتحكم الخبير', icon: Sliders },
  { id: 'calculator', label: 'ضبط حاسبة الجدول', icon: Calculator },
  { id: 'general', label: 'إعدادات التطبيق العامة', icon: Sparkles },
  { id: 'quick_extract_settings', label: 'السحب الذكي والكاميرا', icon: Camera },
  { id: 'relations_lists', label: 'العلاقات والقوائم الجاهزة', icon: Bell },
  { id: 'security_data', label: 'الأمان والبيانات', icon: Shield },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeSection,
  onChangeSection,
  onBackToApp,
  state,
  modeTier,
  editorEnabled,
  darkTheme,
  requireLoginOnStart,
  calculationSettings,
  themePrefs,
  topBarConfig,
  expertTableConfig,
  quickExtractPrefs,
  relationsPrefs,
  generalPrefs,
  securityPrefs,
  recycleBin,
  authUser,
  onChangeModeTier,
  onToggleEditor,
  onToggleDarkTheme,
  onToggleRequireLogin,
  onSaveCalculationSettings,
  onUpdateThemePrefs,
  onResetThemePrefs,
  onSaveAppearanceProfile,
  onApplyAppearanceProfile,
  onDeleteAppearanceProfile,
  onChangeTopBarConfig,
  onUpdateExpertTableConfig,
  onResetExpertTableConfig,
  onUpdateQuickExtractPrefs,
  onDeleteQuickExtractTemplate,
  onUpdateRelationsPrefs,
  onUpdateGeneralPrefs,
  onUpdateSecurityPrefs,
  onRestoreRecycleBinItem,
  onPurgeRecycleBinItem,
  onClearRecycleBin,
  onImportWorkspaceJson,
  onSyncServer,
  onRestoreServer,
  onOpenAuth,
}) => {
  const [feedback, setFeedback] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Calculator settings local draft
  const [kgPerInd, setKgPerInd] = useState(
    String(calculationSettings.kgPerIndividual)
  );
  const [kgPerBag, setKgPerBag] = useState(
    String(calculationSettings.kgPerBag)
  );
  const [feePerInd, setFeePerInd] = useState(
    String(calculationSettings.feePerIndividualIqd)
  );
  const [fixedFee, setFixedFee] = useState(
    String(calculationSettings.fixedCardFeeIqd)
  );
  const [calcMode, setCalcMode] = useState<'instant' | 'manual'>(
    calculationSettings.calculationMode || 'instant'
  );
  const [includeBlocked, setIncludeBlocked] = useState(
    Boolean(calculationSettings.includeBlockedInFees)
  );
  const [roundingStep, setRoundingStep] = useState(
    String(calculationSettings.roundingStepIqd ?? 0)
  );
  const [discountPercent, setDiscountPercent] = useState(
    String(calculationSettings.discountPercent ?? 0)
  );
  const [defaultWorkerWage, setDefaultWorkerWage] = useState(
    String(calculationSettings.defaultWorkerWageIqd ?? 25000)
  );
  const [defaultGeneralExpense, setDefaultGeneralExpense] = useState(
    String(calculationSettings.defaultGeneralExpenseIqd ?? 10000)
  );
  const [testIndividuals, setTestIndividuals] = useState('6');

  // Expert Custom Category Quick Input
  const [newCategoryName, setNewCategoryName] = useState('');

  // Security PIN draft
  const [pinDraft, setPinDraft] = useState(securityPrefs.privacyPin || '');

  useEffect(() => {
    setKgPerInd(String(calculationSettings.kgPerIndividual));
    setKgPerBag(String(calculationSettings.kgPerBag));
    setFeePerInd(String(calculationSettings.feePerIndividualIqd));
    setFixedFee(String(calculationSettings.fixedCardFeeIqd));
    setCalcMode(calculationSettings.calculationMode || 'instant');
    setIncludeBlocked(Boolean(calculationSettings.includeBlockedInFees));
    setRoundingStep(String(calculationSettings.roundingStepIqd ?? 0));
    setDiscountPercent(String(calculationSettings.discountPercent ?? 0));
    setDefaultWorkerWage(String(calculationSettings.defaultWorkerWageIqd ?? 25000));
    setDefaultGeneralExpense(
      String(calculationSettings.defaultGeneralExpenseIqd ?? 10000)
    );
  }, [calculationSettings]);

  useEffect(() => {
    setPinDraft(securityPrefs.privacyPin || '');
  }, [securityPrefs.privacyPin]);

  const notifySuccess = (msg: string) => {
    setErrorFeedback('');
    if (generalPrefs.showActionAlerts !== false) {
      setFeedback(msg);
    }
  };

  const draftCalcSettings: CalculationSettings = useMemo(
    () => ({
      kgPerIndividual: Math.max(1, Number(kgPerInd) || 9),
      kgPerBag: Math.max(1, Number(kgPerBag) || 50),
      feePerIndividualIqd: Math.max(0, Number(feePerInd) || 0),
      fixedCardFeeIqd: Math.max(0, Number(fixedFee) || 0),
      calculationMode: calcMode,
      includeBlockedInFees: includeBlocked,
      roundingStepIqd: Math.max(0, Number(roundingStep) || 0),
      discountPercent: Math.max(0, Math.min(100, Number(discountPercent) || 0)),
      defaultWorkerWageIqd: Math.max(0, Number(defaultWorkerWage) || 0),
      defaultGeneralExpenseIqd: Math.max(0, Number(defaultGeneralExpense) || 0),
    }),
    [
      kgPerInd,
      kgPerBag,
      feePerInd,
      fixedFee,
      calcMode,
      includeBlocked,
      roundingStep,
      discountPercent,
      defaultWorkerWage,
      defaultGeneralExpense,
    ]
  );

  const liveTestAllocation = useMemo(() => {
    const n = Math.max(0, Number(testIndividuals) || 0);
    return {
      alloc: calculateAllocation(n, draftCalcSettings),
      quota: formatQuota(n, undefined, draftCalcSettings),
    };
  }, [testIndividuals, draftCalcSettings]);

  const handleSaveCalc = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCalculationSettings(draftCalcSettings);
    notifySuccess('تم حفظ إعدادات حاسبة الجدول ومعادلات الرسوم بنجاح.');
  };

  const handleExportJsonBackup = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabrex-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifySuccess('تم تنزيل نسخة احتياطية كاملة بصيغة JSON.');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      onImportWorkspaceJson(text);
      notifySuccess('تم استيراد النسخة الاحتياطية بنجاح واستعادة كافة البيانات.');
    } catch (err) {
      setFeedback('');
      setErrorFeedback(
        err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية.'
      );
    }
  };

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

  const toggleFocusField = (field: QuickExtractFocusField) => {
    const exists = quickExtractPrefs.focusedFields.includes(field);
    const next = exists
      ? quickExtractPrefs.focusedFields.filter((f) => f !== field)
      : [...quickExtractPrefs.focusedFields, field];
    if (next.length === 0) return;
    onUpdateQuickExtractPrefs({ focusedFields: next });
    notifySuccess('تم تحديث الحقول الافتراضية للسحب السريع.');
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 sm:p-6">
      {/* Standalone Page Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBackToApp}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة للتطبيق</span>
          </button>

          <div>
            <h1 className="text-lg font-bold sm:text-xl">
              إعدادات التطبيق — تابريكس
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              صفحة مستقلة ومتكاملة لإدارة المظهر، الخطوط، تحكم الخبير، حاسبة الجدول، السحب الذكي، والأمان
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onToggleDarkTheme(!darkTheme);
            notifySuccess(
              !darkTheme ? 'تم تفعيل الوضع الليلي.' : 'تم تفعيل الوضع النهاري.'
            );
          }}
          className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {darkTheme ? (
            <>
              <Sun className="h-4 w-4" />
              <span>الوضع النهاري</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span>الوضع الليلي</span>
            </>
          )}
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded-lg border px-4 py-2.5 text-xs font-bold"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success)',
            color: 'var(--success)',
          }}
        >
          {feedback}
        </div>
      )}

      {errorFeedback && (
        <div
          role="alert"
          className="rounded-lg border px-4 py-2.5 text-xs font-bold"
          style={{
            backgroundColor: 'var(--danger-bg)',
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
          }}
        >
          {errorFeedback}
        </div>
      )}

      {/* 8-Section Navigation + Content Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <nav
          aria-label="أقسام صفحة الإعدادات"
          className="flex flex-row gap-1.5 overflow-x-auto pb-1 lg:col-span-3 lg:flex-col lg:overflow-visible"
        >
          {SETTINGS_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onChangeSection(sec.id)}
                className="flex shrink-0 items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-right text-xs font-bold whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: active
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                  color: active ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{sec.label}</span>
                </span>
                {sec.id === 'security_data' && recycleBin.length > 0 && (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {recycleBin.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-5 lg:col-span-9">
          {/* 1. APPEARANCE STUDIO */}
          {activeSection === 'appearance' && (() => {
            const activeAppTheme = resolveAppThemeId(themePrefs.appTheme);
            const activeTableTheme = resolveTableThemeId(themePrefs.tableTheme);
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

            return (
              <div className="space-y-5">
                {/* 1A. Appearance Profiles Manager */}
                <section
                  aria-label="ملفات المظهر المحفوظة"
                  className="tabrix-card rounded-xl border p-5 space-y-4"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold">
                        ملفات المظهر الجاهزة والمحفوظة
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        احفظ توليفتك الخاصة من الثيم والخط وحجم الصفوف وانتقل بينها بنقرة واحدة
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onResetThemePrefs();
                        notifySuccess('تمت استعادة إعدادات المظهر الافتراضية.');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>استعادة الافتراضي</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {savedProfiles.map((profile) => {
                      const active = themePrefs.activeProfileId === profile.id;
                      const isBuiltIn = profile.id.startsWith('preset_');
                      return (
                        <div
                          key={profile.id}
                          className="flex flex-col justify-between rounded-xl border p-3.5 text-xs"
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
                              <span className="font-bold text-sm">{profile.name}</span>
                              {!isBuiltIn && (
                                <button
                                  type="button"
                                  aria-label={`حذف ملف المظهر ${profile.name}`}
                                  onClick={() => {
                                    onDeleteAppearanceProfile(profile.id);
                                    notifySuccess(`تم حذف ملف المظهر: ${profile.name}`);
                                  }}
                                  className="rounded p-1 hover:opacity-80"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <div
                              className="mt-1 text-[11px] tabular-nums"
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
                              notifySuccess(`تم تطبيق ملف المظهر: ${profile.name}`);
                            }}
                            className="mt-3 w-full rounded-lg border px-3 py-1.5 font-bold"
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
                      notifySuccess(`تم حفظ المظهر الحالي باسم «${trimmed}».`);
                    }}
                    className="flex flex-wrap items-center gap-2 pt-1 text-xs"
                  >
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="اسم ملف المظهر الجديد (مثال: وضع التدقيق المسائي)..."
                      className="min-w-[220px] flex-1 rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <button
                      type="submit"
                      className="rounded-lg px-4 py-2 font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      حفظ التخصيص الحالي كملف
                    </button>
                  </form>
                </section>

                {/* 1B. 8 God-Tier Themes */}
                <section
                  aria-label="ثيمات التطبيق"
                  className="tabrix-card rounded-xl border p-5"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <Palette
                      className="h-4 w-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <div>
                      <h2 className="text-base font-bold">
                        ثيمات التطبيق (8 ثيمات ذات طابع وهوية)
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        اختر الروح اللونية التي تناسب الإضاءة وساعات العمل
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {APP_THEMES.map((theme) => {
                      const selected = activeAppTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            onUpdateThemePrefs({
                              appTheme: theme.id,
                              activeProfileId: null,
                            });
                            notifySuccess(`تم تفعيل ثيم التطبيق: ${theme.name}`);
                          }}
                          className="flex flex-col items-start rounded-xl border p-3.5 text-right transition-colors"
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
                            <div className="flex items-center gap-1.5">
                              {theme.swatches.map((hex, i) => (
                                <span
                                  key={i}
                                  className="inline-block h-4 w-4 rounded border"
                                  style={{
                                    backgroundColor: hex,
                                    borderColor: 'var(--border-color)',
                                  }}
                                />
                              ))}
                            </div>
                            {selected && (
                              <CheckCircle2
                                className="h-4 w-4 shrink-0"
                                style={{ color: 'var(--accent)' }}
                              />
                            )}
                          </div>
                          <div
                            className="mt-2.5 text-sm font-bold"
                            style={{
                              color: selected
                                ? 'var(--accent)'
                                : 'var(--text-primary)',
                            }}
                          >
                            {theme.name}
                          </div>
                          <div
                            className="text-[11px] font-medium"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {theme.englishName} · {theme.isDark ? 'داكن' : 'فاتح'}
                          </div>
                          <p
                            className="mt-1.5 text-[11px] leading-relaxed"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {theme.mood}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Color Pickers */}
                  <div
                    className="mt-5 rounded-xl border p-4 space-y-3 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">تخصيص الألوان الحرة (Color Overrides)</span>
                      {(themePrefs.customBgColor ||
                        themePrefs.customSurfaceColor ||
                        themePrefs.customTextColor ||
                        themePrefs.customAccentColor) && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateThemePrefs({
                              customBgColor: '',
                              customSurfaceColor: '',
                              customTextColor: '',
                              customAccentColor: '',
                            })
                          }
                          className="rounded-md border px-2.5 py-1 font-bold"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          إلغاء الألوان الحرة
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(
                        [
                          {
                            key: 'customBgColor',
                            label: 'خلفية التطبيق',
                            fallback: '#f4f7fb',
                          },
                          {
                            key: 'customSurfaceColor',
                            label: 'البطاقات والجداول',
                            fallback: '#ffffff',
                          },
                          {
                            key: 'customTextColor',
                            label: 'لون النصوص',
                            fallback: '#0f172a',
                          },
                          {
                            key: 'customAccentColor',
                            label: 'اللون المميز (Accent)',
                            fallback: '#1d4ed8',
                          },
                        ] as const
                      ).map((item) => {
                        const val = themePrefs[item.key] || '';
                        return (
                          <div
                            key={item.key}
                            className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <span className="font-semibold">{item.label}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                aria-label={item.label}
                                value={val || item.fallback}
                                onChange={(e) =>
                                  onUpdateThemePrefs({
                                    [item.key]: e.target.value,
                                  })
                                }
                                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                              {val && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateThemePrefs({ [item.key]: '' })
                                  }
                                  aria-label={`استعادة ${item.label}`}
                                  className="text-[11px] font-bold"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* 1C. Sliders, Depth, Radius & Glass */}
                <section
                  aria-label="أبعاد الواجهة والزجاجية"
                  className="tabrix-card rounded-xl border p-5 space-y-4 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <h2 className="text-base font-bold">
                    التحكم الهندسي الدقيق (الأبعاد، التدوير، الظلال، والزجاجية)
                  </h2>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div
                      className="rounded-xl border p-3.5 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="flex items-center justify-between font-bold">
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
                          onUpdateThemePrefs({
                            fontSizePx: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div
                      className="rounded-xl border p-3.5 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="flex items-center justify-between font-bold">
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
                          onUpdateThemePrefs({
                            rowHeightPx: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div
                      className="rounded-xl border p-3.5 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="flex items-center justify-between font-bold">
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
                          onUpdateThemePrefs({
                            colWidthScale: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div
                      className="rounded-xl border p-3.5 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <label htmlFor="slider-border-radius-px">انحناء الحواف (Border Radius)</label>
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
                          onUpdateThemePrefs({
                            borderRadiusPx: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div
                      className="rounded-xl border p-3.5 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="font-bold">مستوى ظلال البطاقات (Depth & Elevation)</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            ['none', 'مسطح'],
                            ['soft', 'ناعم'],
                            ['elevated', 'بارز'],
                          ] as Array<[CardShadowLevel, string]>
                        ).map(([lvl, label]) => {
                          const active =
                            (themePrefs.cardShadowLevel || 'soft') === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() =>
                                onUpdateThemePrefs({ cardShadowLevel: lvl })
                              }
                              className="rounded-lg border py-1.5 font-bold"
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
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5"
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
                        <div className="font-bold">تفعيل تأثير الزجاج المصقول (Glassmorphism)</div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          تغبيش ناعم للبطاقات العائمة ورؤوس الجداول مع احترام تقليل الحركة.
                        </div>
                      </div>
                    </label>
                  </div>
                </section>

                {/* 1D. 8 Table Designs + Conditional Formatting + Live Preview */}
                <section
                  aria-label="ثيمات الجداول"
                  className="tabrix-card rounded-xl border p-5 space-y-4"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <div>
                      <h2 className="text-base font-bold">
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
                            notifySuccess(
                              `تم تفعيل تصميم الجدول: ${tableTheme.name}`
                            );
                          }}
                          className="flex flex-col items-start rounded-xl border p-3.5 text-right transition-colors"
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
                              className="text-sm font-bold"
                              style={{
                                color: selected
                                  ? 'var(--accent)'
                                  : 'var(--text-primary)',
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

                  {/* Conditional Formatting Rules */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold">
                      قواعد التنسيق الشرطي (Conditional Formatting):
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
                      <label
                        className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"
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
                            updateCond({
                              highlightBlockedRows: e.target.checked,
                            })
                          }
                        />
                        <span className="font-semibold">تمييز الصفوف المحجوبة</span>
                      </label>

                      <label
                        className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"
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
                            updateCond({
                              highlightDuplicateNames: e.target.checked,
                            })
                          }
                        />
                        <span className="font-semibold">
                          تلوين الأسماء المكررة بالأحمر
                        </span>
                      </label>

                      <label
                        className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"
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
                            updateCond({
                              highlightZeroIndividuals: e.target.checked,
                            })
                          }
                        />
                        <span className="font-semibold">
                          تنبيه سجلات 0 أفراد بالأصفر
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                    {modernFeatures.map((feat) => (
                      <label
                        key={feat.key}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 text-xs"
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
                          <div className="font-bold">{feat.title}</div>
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

                  {/* Live Table / Card Preview */}
                  <div className="space-y-2 pt-2">
                    <div
                      className="text-xs font-bold"
                      style={{ color: 'var(--text-muted)' }}
                    >
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
                            <span>الأفراد: 6</span>
                            <span>1 كيس + 4 كغم</span>
                            <span>1,450 د.ع</span>
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
                                6
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
                                1 كيس + 4 كغم
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
                                1,450 د.ع
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

                <section
                  className="tabrix-card rounded-xl border p-5 space-y-3"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <h2 className="text-base font-bold">حجم وشكل الشريط العلوي</h2>
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
                          className="rounded-lg border px-3 py-2 font-bold"
                          style={{
                            backgroundColor: active
                              ? 'var(--accent)'
                              : 'var(--bg-main)',
                            borderColor: active
                              ? 'var(--accent)'
                              : 'var(--border-color)',
                            color: active
                              ? 'var(--accent-fg)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            );
          })()}

          {/* 2. FONTS */}
          {activeSection === 'fonts' && (
            <section
              aria-label="الخطوط العربية وأدوات الوضوح"
              className="rounded-xl border p-5 space-y-5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <div>
                  <h2 className="text-base font-bold">
                    الخطوط العربية وأدوات التحكم بالخط والوضوح
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    تخصيص نوع الخط العربي، الحجم، الوزن، وارتفاع السطور مع معاينة فورية
                  </p>
                </div>
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
                        notifySuccess(`تم اختيار الخط: ${font.name}`);
                      }}
                      className="flex flex-col items-start rounded-xl border p-4 text-right transition-colors"
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
                          className="text-sm font-bold"
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
                      <div className="mt-2 text-xs font-semibold tabular-nums">
                        معاينة: تابريكس · 12 فرداً · 108 كغم · 2,650 د.ع
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div
                  className="rounded-xl border p-3.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="mb-2 text-xs font-bold">حجم الخط</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(FONT_SIZE_MAP) as FontSizeStep[]).map((key) => {
                      const active = themePrefs.fontSize === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onUpdateThemePrefs({ fontSize: key })}
                          className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"
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
                          {FONT_SIZE_MAP[key].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="rounded-xl border p-3.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="mb-2 text-xs font-bold">وزن الخط</div>
                  <div className="flex flex-col gap-1.5">
                    {(Object.keys(FONT_WEIGHT_MAP) as FontWeightStep[]).map(
                      (key) => {
                        const active = themePrefs.fontWeight === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              onUpdateThemePrefs({ fontWeight: key })
                            }
                            className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"
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
                            {FONT_WEIGHT_MAP[key].label}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div
                  className="rounded-xl border p-3.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="mb-2 text-xs font-bold">ارتفاع الصف وتباعد الأسطر</div>
                  <div className="flex flex-col gap-1.5">
                    {(Object.keys(ROW_DENSITY_MAP) as RowDensityStep[]).map(
                      (key) => {
                        const active = themePrefs.rowDensity === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              onUpdateThemePrefs({ rowDensity: key })
                            }
                            className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"
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
                            {ROW_DENSITY_MAP[key].label}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
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
                    <div className="font-bold">
                      وضوح الأرقام المتساوي (Tabular Numerals)
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      محاذاة عمودية دقيقة للأرقام والكميات والمبالغ تحت بعضها البعض.
                    </div>
                  </div>
                </label>

                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
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
                    <div className="font-bold">مؤشر تتبع السطر عند المرور/اللمس</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      تظليل خفيف للسطر بأكمله لقراءة صحيحة من الاسم إلى المبلغ.
                    </div>
                  </div>
                </label>
              </div>
            </section>
          )}

          {/* 3. MODES & EXPERT CONTROL */}
          {activeSection === 'modes' && (
            <div className="space-y-5">
              <section
                aria-label="قسم الأوضاع"
                className="rounded-xl border p-5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Sliders className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <h2 className="text-base font-bold">
                    الأوضاع (تدرج مستويات التحكم والقدرات)
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
                          notifySuccess(`تم التبديل إلى: ${item.title}`);
                        }}
                        className="flex flex-col items-start rounded-xl border p-4 text-right transition-colors"
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
                            className="text-sm font-bold"
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

              <section
                aria-label="قسم المحرر"
                className="rounded-xl border p-5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
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
                    <h2 className="text-base font-bold">
                      وضع «المحرر» وقواعد التأكيد
                    </h2>
                  </div>

                  <button
                    type="button"
                    disabled={modeTier === 'beginner'}
                    onClick={() => {
                      onToggleEditor(!editorEnabled);
                      notifySuccess(
                        !editorEnabled ? 'تم تفعيل وضع المحرر.' : 'تم إيقاف وضع المحرر.'
                      );
                    }}
                    className="rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-45"
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

                <div
                  className="mt-3 space-y-1 text-xs leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <div>• <strong>الإضافة:</strong> تتم مباشرة لسرعة الإدخال.</div>
                  <div>• <strong>التعديل والحذف:</strong> يخضع لإعدادات الحماية أو الحرية المطلقة للخبير.</div>
                </div>
              </section>

              {/* Expert Freedom Controls */}
              <section
                aria-label="تحكم الخبير المطلق"
                className="rounded-xl border p-5 space-y-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor:
                    modeTier === 'expert' ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold">
                      الحرية المطلقة وتخصيص الجدول (لوحة الخبير)
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {modeTier === 'expert'
                        ? 'وضع الخبير مفعّل: يمكنك إدارة الحرية المباشرة، الفئات المخصصة، وإعادة ضبط أعمدة الجداول.'
                        : 'فعّل «الوضع الخبير» أعلاه لتشغيل أدوات التخصيص المتقدمة داخل الجداول.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onResetExpertTableConfig();
                      notifySuccess('تمت استعادة ترتيب وأسماء الأعمدة الافتراضية.');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold"
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
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 text-xs"
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
                      notifySuccess(
                        e.target.checked
                          ? 'تم تفعيل التحرير والحفظ الفوري بدون نوافذ تأكيد في وضع الخبير.'
                          : 'تمت إعادة تفعيل خطوة التأكيد عند التعديل والحذف.'
                      );
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold">
                      تحرير وحفظ فوري بدون قيود أو نوافذ تأكيد (في وضع الخبير)
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      يسمح للخبير بتعديل الأسماء والأعداد والأعمدة المخصصة وحذف الصفوف فوراً دون نوافذ تأكيد، مع استمرار حفظ المحذوفات في سلة الاسترجاع.
                    </div>
                  </div>
                </label>

                {/* Custom Categories Manager */}
                <div
                  className="rounded-xl border p-3.5 space-y-2.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <Tag className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>إدارة الفئات المخصصة للمستفيدين</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {expertTableConfig.customCategories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-semibold"
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
                              customCategories:
                                expertTableConfig.customCategories.filter(
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
                      className="min-w-[200px] flex-1 rounded-lg border px-3 py-1.5"
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
                        if (
                          !expertTableConfig.customCategories.includes(trimmed)
                        ) {
                          onUpdateExpertTableConfig({
                            customCategories: [
                              ...expertTableConfig.customCategories,
                              trimmed,
                            ],
                          });
                          notifySuccess(`تمت إضافة الفئة: ${trimmed}`);
                        }
                        setNewCategoryName('');
                      }}
                      className="rounded-lg px-3.5 py-1.5 font-bold"
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
            </div>
          )}

          {/* 4. TABLE CALCULATOR SETTINGS */}
          {activeSection === 'calculator' && (
            <div className="space-y-5">
              <section
                aria-label="ضبط حاسبة الجدول"
                className="rounded-xl border p-5 space-y-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Calculator
                    className="h-4 w-4"
                    style={{ color: 'var(--accent)' }}
                  />
                  <div>
                    <h2 className="text-base font-bold">
                      ضبط حاسبة الجدول ومعادلات الحصص والأجور
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      تحكم كامل بأوزان الحصص، رسوم البطاقة، الخصم، التقريب، واحتساب المحجوبين
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveCalc} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block font-bold">كغم / فرد</label>
                      <input
                        type="number"
                        min={1}
                        step="0.5"
                        value={kgPerInd}
                        onChange={(e) => setKgPerInd(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold">كغم / كيس</label>
                      <input
                        type="number"
                        min={1}
                        value={kgPerBag}
                        onChange={(e) => setKgPerBag(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold">رسم الفرد (د.ع)</label>
                      <input
                        type="number"
                        min={0}
                        value={feePerInd}
                        onChange={(e) => setFeePerInd(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold">رسم البطاقة الثابت (د.ع)</label>
                      <input
                        type="number"
                        min={0}
                        value={fixedFee}
                        onChange={(e) => setFixedFee(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block font-bold">تقريب المبلغ لأقرب</label>
                      <select
                        value={roundingStep}
                        onChange={(e) => setRoundingStep(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 font-semibold tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <option value="0">بدون تقريب (دقيق)</option>
                        <option value="250">أقرب 250 د.ع</option>
                        <option value="500">أقرب 500 د.ع</option>
                        <option value="1000">أقرب 1,000 د.ع</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold">نسبة الخصم (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block font-bold">نمط إعادة الاحتساب</label>
                      <select
                        value={calcMode}
                        onChange={(e) =>
                          setCalcMode(e.target.value as 'instant' | 'manual')
                        }
                        className="w-full rounded-lg border px-3 py-2 font-semibold"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <option value="instant">فوري تلقائي مع كل تعديل</option>
                        <option value="manual">يدوي عند الحاجة</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-bold">
                        أجر العامل الافتراضي في المالية (د.ع)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={defaultWorkerWage}
                        onChange={(e) => setDefaultWorkerWage(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold">
                        المصروف العام الافتراضي في المالية (د.ع)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={defaultGeneralExpense}
                        onChange={(e) =>
                          setDefaultGeneralExpense(e.target.value)
                        }
                        className="w-full rounded-lg border px-3 py-2 tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  </div>

                  <label
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeBlocked}
                      onChange={(e) => setIncludeBlocked(e.target.checked)}
                    />
                    <span>احتساب رسم البطاقة الثابت للحالات ذات الحظر الكامل ضمن الإيرادات</span>
                  </label>

                  {/* Live Formula Test Box */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--accent)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">معاينة واختبار المعادلة الحالية لعدد أفراد:</span>
                      <input
                        type="number"
                        min={0}
                        value={testIndividuals}
                        onChange={(e) => setTestIndividuals(e.target.value)}
                        aria-label="عدد أفراد اختبار الحاسبة"
                        className="w-20 rounded-lg border px-2 py-1 text-center font-bold tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-bold tabular-nums">
                      <span style={{ color: 'var(--accent)' }}>
                        الحصة: {liveTestAllocation.quota}
                      </span>
                      <span style={{ color: 'var(--success)' }}>
                        المبلغ: {formatIqd(liveTestAllocation.alloc?.priceIqd ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg px-5 py-2.5 font-bold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      حفظ إعدادات الحاسبة
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* 5. GENERAL APP SETTINGS */}
          {activeSection === 'general' && (
            <div className="space-y-5">
              <section
                aria-label="إعدادات التطبيق العامة"
                className="rounded-xl border p-5 space-y-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <h2 className="text-base font-bold">التفضيلات العامة وسلوك التأكيد والتراجع</h2>

                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <label
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
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
                      <div className="font-bold">تأكيد صريح قبل الحذف</div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        يُظهر رسالة تأكيد قبل نقل السجل إلى سلة الاسترجاع الآمنة.
                      </div>
                    </div>
                  </label>

                  <label
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={generalPrefs.confirmBeforeEdit}
                      onChange={(e) =>
                        onUpdateGeneralPrefs({
                          confirmBeforeEdit: e.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold">تأكيد صريح قبل حفظ التعديلات</div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        يعرض خطوة مراجعة قبل تثبيت تعديل بيانات المستفيد في النوافذ.
                      </div>
                    </div>
                  </label>

                  <label
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={generalPrefs.showActionAlerts}
                      onChange={(e) =>
                        onUpdateGeneralPrefs({
                          showActionAlerts: e.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold">إظهار إشعارات تأكيد العمليات</div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        رسائل خفيفة لتأكيد الحفظ والتحديث والمزامنة.
                      </div>
                    </div>
                  </label>

                  <label
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
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
                      <div className="font-bold">عرض الأرقام بشكل مضغوط</div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        تقليص المسافات داخل خلايا الأرقام والبطاقات الكثيفة.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div
                    className="rounded-xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <label className="mb-1.5 block font-bold">
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
                      className="w-32 rounded-lg border px-3 py-1.5 font-bold tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <label
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
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

              <section
                className="rounded-xl border p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <h2 className="text-base font-bold">
                  الإخفاء التلقائي وعناصر الشريط العلوي
                </h2>

                <div
                  className="space-y-2.5 rounded-lg border p-3.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={topBarConfig.autoFocus}
                      onChange={(e) =>
                        onChangeTopBarConfig({ autoFocus: e.target.checked })
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold">
                        تفعيل الإخفاء / التصغير التلقائي عند التركيز والتمرير
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        يمكن استعادته بتمرير المؤشر أعلى الشاشة أو عبر الزر العائم.
                      </div>
                    </div>
                  </label>

                  {topBarConfig.autoFocus && (
                    <div
                      className="space-y-2 border-t pt-2.5"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onChangeTopBarConfig({ autoFocusAction: 'hide' })
                          }
                          className="rounded-lg border px-2.5 py-1.5 font-bold"
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
                          className="rounded-lg border px-2.5 py-1.5 font-bold"
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

                      <label className="flex cursor-pointer items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(topBarConfig.autoHideInTables)}
                          onChange={(e) =>
                            onChangeTopBarConfig({
                              autoHideInTables: e.target.checked,
                            })
                          }
                        />
                        <span>إخفاء تلقائي فوري في شاشات الجداول والسحب السريع</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
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
                      className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2"
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
                      <span className="font-semibold">{item.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* 6. QUICK EXTRACT SETTINGS */}
          {activeSection === 'quick_extract_settings' && (
            <div className="space-y-5">
              <section
                aria-label="إعدادات السحب الذكي والكاميرا"
                className="rounded-xl border p-5 space-y-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <div>
                    <h2 className="text-base font-bold">
                      السحب الذكي والكاميرا (الإعدادات الافتراضية)
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      ضبط وضع التصوير الافتراضي، الحقول المستهدفة، وعتبة الوضوح، مع إدارة الصور المرجعية المحفوظة
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateQuickExtractPrefs({ defaultScanMode: 'fast' });
                      notifySuccess('تم تعيين الوضع السريع كافتراضي للتصوير.');
                    }}
                    className="rounded-xl border p-3.5 text-right"
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
                    <div className="font-bold">وضع سريع (لقطة واحدة فورية)</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      مناسب للأوراق الواضحة واستخراج الكشوفات بأسرع وقت ممكن.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateQuickExtractPrefs({ defaultScanMode: 'audit' });
                      notifySuccess('تم تعيين وضع التدقيق الفائق كافتراضي للتصوير.');
                    }}
                    className="rounded-xl border p-3.5 text-right"
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
                    <div className="font-bold">وضع تدقيق فائق (4 لقطات متتالية)</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      يدمج 4 إطارات لرفع الحدة وكشف التعديلات اليدوية الدقيقة.
                    </div>
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="font-bold">الحقول الافتراضية المستخرجة:</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ALL_QUICK_EXTRACT_FIELDS.map((field) => {
                      const active =
                        quickExtractPrefs.focusedFields.includes(field);
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
                          className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-bold"
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
                </div>

                <div
                  className="rounded-xl border p-3.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="clarity-threshold" className="font-bold">
                      حد عتبة وضوح الصورة المقبولة (%)
                    </label>
                    <span className="font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
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
                    className="mt-2 w-full"
                  />
                </div>

                {/* Saved Reference Templates */}
                <div className="space-y-2 pt-1 text-xs">
                  <div className="font-bold">
                    الصور المرجعية المحفوظة لقوالب الدفاتر ({quickExtractPrefs.referenceTemplates.length})
                  </div>
                  {quickExtractPrefs.referenceTemplates.length === 0 ? (
                    <div
                      className="rounded-xl border p-4 text-center"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      لا توجد قوالب مرجعية محفوظة بعد. يمكنك رسم قالب مرجعي مباشرة من شاشة «السحب السريع».
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {quickExtractPrefs.referenceTemplates.map((tpl) => {
                        const isActive = quickExtractPrefs.activeTemplateId === tpl.id;
                        return (
                          <div
                            key={tpl.id}
                            className="flex items-center justify-between gap-3 rounded-xl border p-3"
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
                                  className="h-12 w-16 rounded border object-cover"
                                  style={{ borderColor: 'var(--border-color)' }}
                                />
                              )}
                              <div className="min-w-0">
                                <div className="truncate font-bold">{tpl.name}</div>
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
                                className="rounded-lg border px-2.5 py-1 font-bold"
                                style={{
                                  backgroundColor: isActive
                                    ? 'var(--accent)'
                                    : 'var(--bg-surface)',
                                  borderColor: 'var(--accent)',
                                  color: isActive
                                    ? 'var(--accent-fg)'
                                    : 'var(--accent)',
                                }}
                              >
                                {isActive ? 'نشط' : 'تفعيل'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteQuickExtractTemplate(tpl.id)}
                                aria-label={`حذف القالب ${tpl.name}`}
                                className="rounded-lg border p-1.5"
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
                </div>
              </section>
            </div>
          )}

          {/* 7. RELATIONS & READY LISTS PREFS */}
          {activeSection === 'relations_lists' && (
            <section
              aria-label="إعدادات العلاقات والقوائم الجاهزة"
              className="rounded-xl border p-5 space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <div>
                  <h2 className="text-base font-bold">
                    إعدادات العلاقات والقوائم الجاهزة
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    تخصيص صيغة التصدير المفضلة للقوائم الجاهزة وتنبيهات التذكير وملاحظات التوصيل
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold">
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
                      notifySuccess('تم تحديث صيغة التصدير المفضلة.');
                    }}
                    className="w-full rounded-lg border px-3 py-2 font-semibold"
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

                <div>
                  <label className="mb-1 block font-bold">
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
                    className="w-full rounded-lg border px-3 py-2 tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="mb-1 block font-bold">
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
                  className="w-full rounded-lg border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
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
                    <div className="font-bold">تفعيل تنبيهات التذكير القادمة</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      يظهر شريط تنبيه في قسم العلاقات للتذكيرات القريبة والمستحقة.
                    </div>
                  </div>
                </label>

                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5"
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
                    <div className="font-bold">تحديث التاريخ تلقائياً عند إنشاء قائمة جاهزة</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      يفعّل خيار التحديث التلقائي لتاريخ آخر تعديل افتراضياً.
                    </div>
                  </div>
                </label>
              </div>
            </section>
          )}

          {/* 8. SECURITY, BACKUP, RECYCLE BIN & PRIVACY LOCK */}
          {activeSection === 'security_data' && (
            <div className="space-y-5">
              {/* Multi-Login & Cloud Sync */}
              <section
                className="rounded-xl border p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">
                      الحساب والمزامنة السحابية
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {authUser ? (
                        <>
                          مسجل حاليًا باسم:{' '}
                          <span dir="auto">{authUser.displayName}</span>
                        </>
                      ) : (
                        'سجّل عبر Gmail أو اسم المستخدم أو رقم الهاتف لحفظ نسختك على الخادم.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="rounded-lg border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    {authUser ? 'إدارة الحساب' : 'تسجيل الدخول المتعدد'}
                  </button>
                </div>

                {authUser && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onSyncServer();
                          notifySuccess('تم حفظ البيانات على الخادم بنجاح.');
                        } catch (err) {
                          setErrorFeedback(
                            err instanceof Error ? err.message : 'تعذرت المزامنة.'
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <CloudUpload className="h-3.5 w-3.5" />
                      <span>حفظ في الخادم</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const ok = await onRestoreServer();
                          notifySuccess(
                            ok
                              ? 'تم استرجاع النسخة من الخادم.'
                              : 'لا توجد نسخة محفوظة مسبقًا لهذا الحساب.'
                          );
                        } catch (err) {
                          setErrorFeedback(
                            err instanceof Error
                              ? err.message
                              : 'تعذر الاسترجاع.'
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>استرجاع من الخادم</span>
                    </button>
                  </div>
                )}
              </section>

              {/* Local JSON Backup Export / Import */}
              <section
                className="rounded-xl border p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center gap-2">
                  <FileJson
                    className="h-4 w-4"
                    style={{ color: 'var(--accent)' }}
                  />
                  <div>
                    <h2 className="text-base font-bold">
                      النسخ الاحتياطي المحلي واستعادة البيانات (JSON)
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      تصدير واستيراد قاعدة البيانات الكاملة (الوكالات، المستفيدين، القوائم، العلاقات، والإعدادات)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={handleExportJsonBackup}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>تصدير نسخة احتياطية (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>استيراد من ملف (JSON)</span>
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportJsonFile}
                    className="hidden"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={securityPrefs.offlineCacheEnabled}
                    onChange={(e) =>
                      onUpdateSecurityPrefs({
                        offlineCacheEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>تفعيل الحفظ المحلي التلقائي للعمل دون انترنت (Offline Cache)</span>
                </label>
              </section>

              {/* Privacy Lock */}
              <section
                className="rounded-xl border p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <div>
                    <h2 className="text-base font-bold">قفل الخصوصية السريع</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      اقفل شاشة التطبيق فوراً لحماية السجلات عند ترك الجهاز، برمز اختياري أو قفل مباشر
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 text-xs">
                  <div>
                    <label
                      htmlFor="privacy-pin-input"
                      className="mb-1 block font-bold"
                    >
                      رمز القفل (اختياري)
                    </label>
                    <input
                      id="privacy-pin-input"
                      type="password"
                      dir="ltr"
                      value={pinDraft}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPinDraft(v);
                        onUpdateSecurityPrefs({ privacyPin: v });
                      }}
                      placeholder="اتركه فارغاً لفتح بنقرة"
                      className="w-48 rounded-lg border px-3 py-2 text-left tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSecurityPrefs({
                        privacyPin: pinDraft,
                        privacyLocked: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>تفعيل القفل الآن</span>
                  </button>
                </div>
              </section>

              {/* Safe Recycle Bin */}
              <section
                aria-label="سلة الاسترجاع الآمنة"
                className="rounded-xl border p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trash2
                      className="h-4 w-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <div>
                      <h2 className="text-base font-bold">
                        سلة الاسترجاع الآمنة ({recycleBin.length})
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        كل سجل يُحذف من الوكالات أو القوائم أو المصاريف يُحفظ هنا لاستعادته في أي وقت
                      </p>
                    </div>
                  </div>

                  {recycleBin.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearRecycleBin();
                        notifySuccess('تم إفراغ سلة الاسترجاع.');
                      }}
                      className="rounded-lg border px-3 py-1.5 text-xs font-bold"
                      style={{
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                      }}
                    >
                      إفراغ السلة
                    </button>
                  )}
                </div>

                {recycleBin.length === 0 ? (
                  <div
                    className="rounded-xl border p-4 text-center text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    سلة الاسترجاع فارغة حالياً.
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {recycleBin.map((entry) => {
                      const kindLabel =
                        entry.kind === 'person'
                          ? 'مستفيد'
                          : entry.kind === 'ready_list'
                          ? 'قائمة جاهزة'
                          : entry.kind === 'relation'
                          ? 'علاقة متابعة'
                          : 'مصروف مالي';
                      return (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div>
                            <span className="font-bold">{entry.label}</span>
                            <span
                              className="mx-2 text-[11px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              ({kindLabel}) · حُذف في {entry.deletedAt.slice(0, 10)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onRestoreRecycleBinItem(entry.id);
                                notifySuccess(`تمت استعادة: ${entry.label}`);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold"
                              style={{
                                backgroundColor: 'var(--success)',
                                color: 'var(--success-fg)',
                              }}
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>استعادة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onPurgeRecycleBinItem(entry.id)}
                              className="rounded-lg border px-2.5 py-1.5 font-semibold"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--danger)',
                              }}
                            >
                              حذف نهائي
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
