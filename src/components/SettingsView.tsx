import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  Calculator,
  ChevronLeft,
  Command,
  Compass,
  FolderKanban,
  Layers,
  ListChecks,
  Maximize2,
  Minimize2,
  Moon,
  Palette,
  RotateCcw,
  ScanLine,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Type,
  UserCircle2,
  X,
} from 'lucide-react';
import { DEFAULT_WORKSPACE_COSMOS } from '../data/seedData';
import type {
  AccessibilityAndExperiencePrefs,
  AppDatabaseState,
  AppModeTier,
  AuthUser,
  CalculationSettings,
  CosmosExperienceMode,
  CosmosWorldId,
  CustomThemePreset,
  ExpertTableConfig,
  FeatureFlagsMap,
  GeneralAppPrefs,
  MigrationSnapshotRecord,
  QuickExtractPrefs,
  RecycleBinEntry,
  RelationsReadyListsPrefs,
  SecurityPrefs,
  SettingsSectionId,
  ThemePreferences,
  TopBarConfig,
  WorkspaceCosmosState,
} from '../types/agency';
import type {
  AssistantConnectivityState,
  AssistantSettingsConfig,
} from '../types/assistant';
import {
  auditAgencyPersons,
  DEFAULT_CALCULATION_SETTINGS,
  formatIqd,
} from '../utils/agencyLogic';
import {
  DEFAULT_ASSISTANT_SETTINGS,
  type QuotaCheckResult,
} from '../utils/assistantQuota';
import {
  buildCosmosRegistry,
  getCosmosNodeById,
  searchCosmosNodes,
  type CosmosNode,
} from '../utils/cosmosRegistry';
import {
  buildMorrowHierarchyTree,
  getHierarchyNodeById,
  getSettingsSectionNodeId,
  searchHierarchyNodes,
  type HierarchyBadgeContext,
  type HierarchyNode,
  type HierarchyTarget,
} from '../utils/hierarchyRegistry';
import {
  ALL_APP_THEMES,
  ARABIC_FONTS,
  DEFAULT_APPEARANCE_PROFILES,
  resolveAppThemeId,
  resolveTableThemeId,
  TABLE_THEMES,
} from '../utils/themes';
import {
  AccessibilityCosmosPanel,
  HealthAndKpiPanel,
  LegacyArchivePanel,
} from './worlds/CosmosNewWorlds';

const AppearanceCapsules = lazy(() =>
  import('./settings/capsules/AppearanceCapsules').then((m) => ({
    default: m.AppearanceCapsules,
  }))
);
const CalculatorCapsules = lazy(() =>
  import('./settings/capsules/CalculatorCapsules').then((m) => ({
    default: m.CalculatorCapsules,
  }))
);
const FontsCapsules = lazy(() =>
  import('./settings/capsules/FontsAndModesCapsules').then((m) => ({
    default: m.FontsCapsules,
  }))
);
const ModesCapsules = lazy(() =>
  import('./settings/capsules/FontsAndModesCapsules').then((m) => ({
    default: m.ModesCapsules,
  }))
);
const GeneralCapsules = lazy(() =>
  import('./settings/capsules/GeneralAndOpsCapsules').then((m) => ({
    default: m.GeneralCapsules,
  }))
);
const QuickExtractCapsules = lazy(() =>
  import('./settings/capsules/GeneralAndOpsCapsules').then((m) => ({
    default: m.QuickExtractCapsules,
  }))
);
const RelationsListsCapsules = lazy(() =>
  import('./settings/capsules/GeneralAndOpsCapsules').then((m) => ({
    default: m.RelationsListsCapsules,
  }))
);
const SecurityCapsules = lazy(() =>
  import('./settings/capsules/SecurityCapsules').then((m) => ({
    default: m.SecurityCapsules,
  }))
);

interface SettingsViewProps {
  activeSection: SettingsSectionId;
  screenMode?: 'hub' | 'detail';
  onChangeScreenMode?: (mode: 'hub' | 'detail') => void;
  onChangeSection: (section: SettingsSectionId) => void;
  activeCapsuleId?: string | null;
  onChangeCapsuleId?: (capsuleId: string | null) => void;
  spotlightNodeId?: string | null;
  hierarchyTree?: HierarchyNode;
  badgeContext?: HierarchyBadgeContext;
  onNavigateHierarchyTarget?: (
    target: HierarchyTarget,
    nodeId: string
  ) => void;
  onOpenCommandPalette?: () => void;
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
  assistantSettings?: AssistantSettingsConfig;
  assistantConnectivity?: AssistantConnectivityState;
  assistantQuotaInfo?: QuotaCheckResult;
  assistantCacheCount?: number;
  onUpdateAssistantSettings?: (patch: Partial<AssistantSettingsConfig>) => void;
  onResetAssistantQuota?: () => void;
  onClearAssistantCache?: () => void;
  hierarchyBar?: React.ReactNode;
  workspaceCosmos?: WorkspaceCosmosState;
  rootCosmos?: CosmosNode;
  migrationSnapshot?: MigrationSnapshotRecord;
  onUpdateAccessibilityPrefs?: (patch: Partial<AccessibilityAndExperiencePrefs>) => void;
  onUpdateFeatureFlags?: (patch: Partial<FeatureFlagsMap>) => void;
  onUpdateCosmosExperienceMode?: (mode: CosmosExperienceMode) => void;
  onTogglePinnedNode?: (nodeId: string) => void;
  onSaveCustomTheme?: (preset: Omit<CustomThemePreset, 'id' | 'createdAt'>) => void;
  onDeleteCustomTheme?: (id: string) => void;
  onToggleHiddenWorld?: (worldId: string) => void;
  onRestoreMigrationSnapshot?: () => boolean;
  onAppendChangeLog?: (entry: {
    worldId: CosmosWorldId;
    label: string;
    beforeValue?: string;
    afterValue?: string;
  }) => void;
  onRunAutoFix?: () => { fixedCount: number; summaryLines: string[] };
  onOpenWorldSwitcher?: () => void;
  onSelectCosmosNode?: (node: CosmosNode) => void;
}

type DomainCategory = 'all' | 'visual' | 'permissions' | 'operations' | 'security';

interface SubAxisSpec {
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string;
}

interface GalaxySpec {
  id: string;
  title: string;
  subtitle: string;
  subAxes: SubAxisSpec[];
}

interface SectionSpec {
  id: SettingsSectionId;
  category: Exclude<DomainCategory, 'all'>;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  galaxies: GalaxySpec[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeSection,
  screenMode,
  onChangeScreenMode,
  onChangeSection,
  activeCapsuleId,
  onChangeCapsuleId,
  spotlightNodeId,
  hierarchyTree,
  badgeContext,
  onOpenCommandPalette,
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
  assistantSettings = DEFAULT_ASSISTANT_SETTINGS,
  assistantConnectivity = 'offline',
  assistantQuotaInfo,
  assistantCacheCount = 0,
  onUpdateAssistantSettings,
  onResetAssistantQuota,
  onClearAssistantCache,
  workspaceCosmos,
  rootCosmos,
  migrationSnapshot,
  onUpdateAccessibilityPrefs,
  onUpdateFeatureFlags,
  onToggleHiddenWorld,
  onSaveCustomTheme,
  onDeleteCustomTheme,
  onRestoreMigrationSnapshot,
  onAppendChangeLog,
  onRunAutoFix,
  onSelectCosmosNode,
}) => {
  const [feedback, setFeedback] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');
  const [localScreenMode, setLocalScreenMode] = useState<'hub' | 'detail'>('hub');
  const [localCapsuleId, setLocalCapsuleId] = useState<string | null>(null);
  const [selectedGalaxyId, setSelectedGalaxyId] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<DomainCategory>('all');
  const [settingsSearch, setSettingsSearch] = useState('');

  const currentScreenMode = screenMode ?? localScreenMode;
  const setScreenMode = onChangeScreenMode ?? setLocalScreenMode;
  const currentCapsuleId =
    activeCapsuleId !== undefined ? activeCapsuleId : localCapsuleId;
  const setCapsuleId = onChangeCapsuleId ?? setLocalCapsuleId;

  const displayMode: 'fullscreen' | 'contained' =
    generalPrefs.settingsDisplayMode === 'contained'
      ? 'contained'
      : 'fullscreen';

  const resolvedCosmosRoot = useMemo(
    () => rootCosmos || buildCosmosRegistry(state.agencies),
    [rootCosmos, state.agencies]
  );

  const effectiveWorkspaceCosmos: WorkspaceCosmosState = useMemo(
    () => workspaceCosmos || state.workspaceCosmos || DEFAULT_WORKSPACE_COSMOS,
    [workspaceCosmos, state.workspaceCosmos]
  );

  const resolvedTree = useMemo(
    () => hierarchyTree || buildMorrowHierarchyTree(state.agencies),
    [hierarchyTree, state.agencies]
  );

  const activeThemeObj = useMemo(() => {
    const id = resolveAppThemeId(themePrefs.appTheme);
    return ALL_APP_THEMES.find((t) => t.id === id) || ALL_APP_THEMES[0];
  }, [themePrefs.appTheme]);

  const activeTableObj = useMemo(() => {
    const id = resolveTableThemeId(themePrefs.tableTheme);
    return TABLE_THEMES.find((t) => t.id === id) || TABLE_THEMES[0];
  }, [themePrefs.tableTheme]);

  const activeFontObj = useMemo(
    () =>
      ARABIC_FONTS.find((f) => f.id === themePrefs.fontFamily) || ARABIC_FONTS[0],
    [themePrefs.fontFamily]
  );

  const auditIssues = useMemo(
    () => auditAgencyPersons(state.persons),
    [state.persons]
  );

  const resolvedBadgeContext = useMemo<HierarchyBadgeContext>(
    () =>
      badgeContext || {
        agenciesCount: state.agencies.length,
        personsCount: state.persons.length,
        auditIssuesCount: auditIssues.length,
        readyListsCount: state.readyLists.length,
        relationsCount: state.relations.length,
        archivesCount: state.monthlyArchives?.length || 0,
        pendingDraftsCount: 0,
        recycleBinCount: recycleBin.length,
        activeThemeName: activeThemeObj.name,
        activeTableThemeName: activeTableObj.name,
        activeFontName: activeFontObj.name,
        fontSizePx: themePrefs.fontSizePx ?? 15,
        modeLabel: modeTier === 'expert' ? 'الموحد' : modeTier,
        feePerIndividualIqd: calculationSettings.feePerIndividualIqd,
        kgPerIndividual: calculationSettings.kgPerIndividual,
        settingsDisplayMode: displayMode,
        savedProfilesCount:
          themePrefs.savedProfiles?.length ?? DEFAULT_APPEARANCE_PROFILES.length,
        quickExtractFieldsCount: quickExtractPrefs.focusedFields.length,
        clarityThreshold: quickExtractPrefs.clarityThreshold,
        autoHideTopBar: topBarConfig.autoFocus,
        privacyLocked: securityPrefs.privacyLocked,
      },
    [
      badgeContext,
      state.agencies.length,
      state.persons.length,
      auditIssues.length,
      state.readyLists.length,
      state.relations.length,
      state.monthlyArchives,
      recycleBin.length,
      activeThemeObj.name,
      activeTableObj.name,
      activeFontObj.name,
      themePrefs.fontSizePx,
      themePrefs.savedProfiles,
      modeTier,
      calculationSettings.feePerIndividualIqd,
      calculationSettings.kgPerIndividual,
      displayMode,
      quickExtractPrefs.focusedFields.length,
      quickExtractPrefs.clarityThreshold,
      topBarConfig.autoFocus,
      securityPrefs.privacyLocked,
    ]
  );

  const notifySuccess = (msg: string) => {
    setErrorFeedback('');
    setFeedback(msg);
  };
  const notifyError = (msg: string) => {
    setFeedback('');
    setErrorFeedback(msg);
  };

  useEffect(() => {
    if (!feedback && !errorFeedback) return;
    const t = setTimeout(() => {
      setFeedback('');
      setErrorFeedback('');
    }, 4500);
    return () => clearTimeout(t);
  }, [feedback, errorFeedback]);

  // Spotlight scroll
  useEffect(() => {
    if (!spotlightNodeId) return;
    const timer = setTimeout(() => {
      const targetEl = document.querySelector<HTMLElement>(
        `[data-capsule-node-id="${spotlightNodeId}"]`
      );
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.add('assistant-spotlight-active');
        setTimeout(() => {
          targetEl.classList.remove('assistant-spotlight-active');
        }, 2800);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [spotlightNodeId, activeSection, currentCapsuleId, currentScreenMode]);

  // Master 10-Section -> Galaxies -> Deep Sub-Axes Architecture
  const sectionSpecs: SectionSpec[] = useMemo(
    () => [
      {
        id: 'appearance',
        category: 'visual',
        title: 'المظهر والهوية البصرية',
        subtitle: 'الثيمات، الألوان المخصصة، هندسة البطاقات، ومحركات الجداول الـ8',
        icon: <Palette className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_app_themes',
            title: 'مجرة مكتبة الثيمات والملفات',
            subtitle: 'الثيمات الكلاسيكية الـ8 والعصرية الزجاجية الـ4 وملفات المظهر المحفوظة',
            subAxes: [
              {
                id: 'appearance_themes_cap',
                title: 'جميع الثيمات (12)',
                subtitle: 'استعراض الثيمات الكلاسيكية والعصرية',
                badgeText: activeThemeObj.name,
              },
              {
                id: 'appearance_themes_classic_cap',
                title: 'الكلاسيكية الأصيلة (8)',
                subtitle: 'السبج، الثلج، الشفق، الزمرد، والسراب',
              },
              {
                id: 'appearance_themes_modern_cap',
                title: 'العصرية والزجاجية (4)',
                subtitle: 'المرمر الزجاجي والكتان وغسق الشمال',
              },
              {
                id: 'appearance_profiles_cap',
                title: 'ملفات المظهر المحفوظة',
                subtitle: 'حفظ واسترجاع توليفاتك الكاملة',
                badgeText: `${themePrefs.savedProfiles?.length ?? 2} ملف`,
              },
            ],
          },
          {
            id: 'gal_app_custom_geometry',
            title: 'مجرة الألوان الحرة والهندسة والزجاجية',
            subtitle: 'محرر الثيم المخصص والألوان الحرة، انحناء الحواف، والظلال',
            subAxes: [
              {
                id: 'appearance_themes_custom_cap',
                title: 'محرر الثيم والألوان الحرة',
                subtitle: 'تخصيص الخلفية والسطح واللون المميز وحفظه',
              },
              {
                id: 'appearance_geometry_cap',
                title: 'الهندسة والزجاجية والظلال',
                subtitle: 'انحناء الزوايا، شفافية الزجاج، وارتفاع البطاقات',
              },
            ],
          },
          {
            id: 'gal_app_tables',
            title: 'مجرة محركات وتصميم الجداول',
            subtitle: 'أنماط الجداول الـ8 وقواعد التنسيق الشرطي للأسماء والمحجوبين',
            subAxes: [
              {
                id: 'appearance_tables_cap',
                title: 'مركز تصميم الجداول',
                subtitle: 'نظرة عامة ومعاينة الجداول',
                badgeText: activeTableObj.name,
              },
              {
                id: 'appearance_table_engines_cap',
                title: 'محركات الجداول الـ8',
                subtitle: 'الزجاجي، الدفتر الورقي، الملكي، النيون...',
              },
              {
                id: 'appearance_table_rules_cap',
                title: 'التنسيق الشرطي والتمييز',
                subtitle: 'تلوين المحجوبين والمكررين وسجلات 0 أفراد',
              },
            ],
          },
        ],
      },
      {
        id: 'fonts',
        category: 'visual',
        title: 'الخطوط والقراءة والترقيم',
        subtitle: 'عائلات الخطوط العربية الـ6، المقاسات، الأرقام ١٢٣/123، والتقويم الهجري',
        icon: <Type className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_fonts_typography',
            title: 'مجرة الخطوط العربية والمقاسات',
            subtitle: 'اختيار الخط، حجم النص، وزن الحروف، وكثافة الجداول',
            subAxes: [
              {
                id: 'fonts_family_cap',
                title: 'الخطوط العربية (6)',
                subtitle: 'Cairo، Tajawal، Almarai، IBM Plex...',
                badgeText: activeFontObj.name,
              },
              {
                id: 'fonts_scale_cap',
                title: 'المقاسات والكثافة والوضوح',
                subtitle: 'حجم الخط، الوزن، الأرقام المتساوية، والتتبع',
                badgeText: `${themePrefs.fontSizePx ?? 15}px`,
              },
            ],
          },
          {
            id: 'gal_fonts_locale',
            title: 'مجرة الترقيم والتقويم العالمي',
            subtitle: 'الأرقام القياسية (123) أم الهندية (١٢٣)، والتقويم الهجري والميلادي',
            subAxes: [
              {
                id: 'cap_fonts_locale',
                title: 'الأرقام والتقويم (١٢٣ / هجري)',
                subtitle: 'صيغة الأرقام والتواريخ عبر كل البطاقات',
                badgeText:
                  effectiveWorkspaceCosmos.accessibility.numeralSystem === 'hindi'
                    ? '١٢٣ هندية'
                    : '123 غربية',
              },
            ],
          },
        ],
      },
      {
        id: 'general',
        category: 'permissions',
        title: 'تجربة الواجهة والوصول',
        subtitle: 'الشريط العلوي، وضع ملء الشاشة، سلوك التراجع، واليد الواحدة',
        icon: <Sliders className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_general_workspace',
            title: 'مجرة الشاشة والشريط العلوي والسلوك',
            subtitle: 'تخصيص وضع العرض وإخفاء الشريط العلوي والتأكيدات',
            subAxes: [
              {
                id: 'general_display_cap',
                title: 'العرض وسعة التراجع (Undo)',
                subtitle: 'ملء الشاشة / المدمج وسعة سجل التراجع',
                badgeText: displayMode === 'fullscreen' ? 'ملء الشاشة' : 'مدمج',
              },
              {
                id: 'general_topbar_cap',
                title: 'تحكم الشريط العلوي',
                subtitle: 'نمط الشريط والإخفاء التلقائي عند التمرير',
                badgeText: topBarConfig.autoFocus ? 'ذكي تلقائي' : 'ثابت',
              },
              {
                id: 'general_behavior_cap',
                title: 'سلوك التعديل والتنبيهات وبوابة الدخول',
                subtitle: 'تنبيهات العمليات وقفل البداية الإلزامي',
              },
            ],
          },
          {
            id: 'gal_general_accessibility',
            title: 'مجرة الراحة البصرية واليد الواحدة',
            subtitle: 'تقليل الحركة، وضع اليد الواحدة للجوال، والتجاوب اللمسي والصوتي',
            subAxes: [
              {
                id: 'cap_access_ergonomics',
                title: 'الوصولية واليد الواحدة واللمس',
                subtitle: 'ضبط الإزاحة للأسفل، الاهتزاز، وتقليل الحركة',
              },
            ],
          },
        ],
      },
      {
        id: 'modes',
        category: 'permissions',
        title: 'الصلاحيات ومصفوفة التحكم والخبير',
        subtitle: 'مصفوفة الصلاحيات المستقلة، المحرر، القراءة فقط، والفئات المخصصة',
        icon: <Layers className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_modes_matrix',
            title: 'مجرة مصفوفة الصلاحيات التشغيلية',
            subtitle: 'فتح أو قفل كل صلاحية باستقلال تام (المالية، السحب، التحرير، الأعمدة)',
            subAxes: [
              {
                id: 'modes_tier_cap',
                title: 'مصفوفة الصلاحيات ومستوى الوضع',
                subtitle: 'تبديل 8 صلاحيات مستقلة + مستوى التحكم',
              },
              {
                id: 'modes_editor_cap',
                title: 'وضع المحرر وقواعد التأكيد',
                subtitle: 'التحكم بالتعديل والحذف وتفعيل التحرير',
                badgeText: editorEnabled ? 'المحرر نشط' : 'قراءة فقط',
              },
            ],
          },
          {
            id: 'gal_modes_expert',
            title: 'مجرة الفئات المخصصة وتخطيط الجداول',
            subtitle: 'إدارة تصنيفات المستفيدين المخصصة وإعادة ضبط أعمدة الجدول',
            subAxes: [
              {
                id: 'modes_expert_cap',
                title: 'الفئات المخصصة والتحرير الفوري',
                subtitle: 'إضافة/حذف الفئات وضبط تخطيط الجداول',
                badgeText: `${expertTableConfig.customCategories.length} فئات`,
              },
            ],
          },
        ],
      },
      {
        id: 'calculator',
        category: 'operations',
        title: 'الحاسبة المالية والحصص',
        subtitle: 'حصص الأفراد والأكياس، الرسوم التلقائية، التقريب، والمختبر الحي',
        icon: <Calculator className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_calc_formulas',
            title: 'مجرة الأوزان والرسوم القياسية',
            subtitle: 'وزن الفرد والكيس ورسم الفرد (250 د.ع) وأجور العمال الافتراضية',
            subAxes: [
              {
                id: 'calc_fees_cap',
                title: 'الرسوم والأجور الافتراضية',
                subtitle: 'رسم الفرد والبطاقة والأجور والمصاريف',
                badgeText: `${calculationSettings.feePerIndividualIqd} د.ع`,
              },
              {
                id: 'calc_quotas_cap',
                title: 'الحصص والأوزان (كغم)',
                subtitle: 'كغم/فرد ووزن الكيس الكامل',
                badgeText: `${calculationSettings.kgPerIndividual} كغم`,
              },
            ],
          },
          {
            id: 'gal_calc_rules_lab',
            title: 'مجرة القواعد والمختبر الحي والقوالب',
            subtitle: 'التقريب والخصم والمحجوبين + اختبار رقمي حي قبل الحفظ ومقارنة قبل/بعد',
            subAxes: [
              {
                id: 'calc_rules_cap',
                title: 'التقريب والخصم والمحجوبين',
                subtitle: 'خطوة التقريب ونسبة الخصم وشمول المحجوبين',
              },
              {
                id: 'calc_preview_cap',
                title: 'المختبر الحي والقوالب الجاهزة',
                subtitle: 'تجربة فورية وتطبيق القوالب على الوكالات',
              },
            ],
          },
        ],
      },
      {
        id: 'quick_extract_settings',
        category: 'operations',
        title: 'السحب الذكي OCR',
        subtitle: 'أوضاع الكاميرا وعتبة الوضوح، الحقول المستهدفة، والقوالب المرجعية',
        icon: <ScanLine className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_qe_camera',
            title: 'مجرة التصوير وعتبة الوضوح',
            subtitle: 'ضبط التصوير الفائق (4 لقطات) أو السريع وحد وضوح اللقطات',
            subAxes: [
              {
                id: 'qe_scan_mode_cap',
                title: 'وضع التصوير وعتبة الوضوح',
                subtitle: 'ضبط الحساسية ونمط الالتقاط التلقائي',
                badgeText: `${quickExtractPrefs.clarityThreshold}%`,
              },
            ],
          },
          {
            id: 'gal_qe_templates',
            title: 'مجرة الحقول والقوالب المرجعية',
            subtitle: 'تخصيص الأعمدة المستخرجة وإدارة قوالب دفاتر الوكالات المحفوظة',
            subAxes: [
              {
                id: 'qe_fields_cap',
                title: 'الحقول المستهدفة',
                subtitle: 'الأسماء، الأفراد، النقصان، والإضافة/الحذف',
                badgeText: `${quickExtractPrefs.focusedFields.length} حقول`,
              },
              {
                id: 'qe_templates_cap',
                title: 'القوالب المرجعية المحفوظة',
                subtitle: 'تفعيل أو إزالة صور الدفاتر المرجعية',
                badgeText: `${quickExtractPrefs.referenceTemplates.length} قالب`,
              },
            ],
          },
        ],
      },
      {
        id: 'ai_assistant',
        category: 'operations',
        title: 'الذكاء الاصطناعي وتوجيه النماذج',
        subtitle: 'معمارية النماذج التخصصية، التسلسل من الأقوى للأضعف، الاحتياطي، وMorrow الأخير',
        icon: <Bot className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_ai_brain_quota',
            title: 'معمارية النماذج والتوجيه من الأقوى للأضعف',
            subtitle: 'تخصيص كل مهمة بالنموذج الأقوى والاحتياطي المباشر مع بقاء Morrow المحلي مرجعاً أخيراً',
            subAxes: [
              {
                id: 'sec_ai_assistant_cap',
                title: 'استوديو النماذج والتوجيه والحصة',
                subtitle: 'توجيه المهام، سجل القوة، الربط الجذري، والأوفلاين',
                badgeText: assistantSettings.onlineDisabled
                  ? 'أوفلاين 100%'
                  : `${assistantQuotaInfo?.dailyUsed ?? 0}/${assistantSettings.dailyRequestLimit}`,
              },
            ],
          },
        ],
      },
      {
        id: 'relations_lists',
        category: 'operations',
        title: 'القوائم والعلاقات والتصدير',
        subtitle: 'صيغ التصدير الافتراضية، التواريخ التلقائية، وتنبيهات المتابعة',
        icon: <ListChecks className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_rel_export',
            title: 'مجرة التصدير والتحديث التلقائي',
            subtitle: 'تحديد صيغة الإخراج المفضلة (Excel / PDF / صورة / نص)',
            subAxes: [
              {
                id: 'rel_export_cap',
                title: 'صيغ التصدير وتاريخ القوائم',
                subtitle: 'افتراضيات التصدير وتحديث التاريخ التلقائي',
              },
            ],
          },
          {
            id: 'gal_rel_followups',
            title: 'مجرة تنبيهات التذكير والتوصيل',
            subtitle: 'أيام التنبيه المسبق وبادئة ملاحظات التسليم الافتراضية',
            subAxes: [
              {
                id: 'rel_reminders_cap',
                title: 'التذكيرات وبادئة التوصيل',
                subtitle: 'تفعيل الإشعارات وأيام التنبيه المسبق',
                badgeText: `${relationsPrefs.defaultReminderLeadDays} أيام`,
              },
            ],
          },
        ],
      },
      {
        id: 'security_data',
        category: 'security',
        title: 'الأمان والنسخ الاحتياطي وسلة الاسترجاع',
        subtitle: 'قفل الخصوصية PIN، تصدير JSON، المزامنة السحابية، واستعادة المحذوفات',
        icon: <Shield className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_sec_lock_sync',
            title: 'مجرة الحماية والقفل والمزامنة السحابية',
            subtitle: 'حماية الشاشة برمز PIN والربط السحابي بالحساب',
            subAxes: [
              {
                id: 'sec_privacy_lock_cap',
                title: 'قفل الخصوصية (PIN)',
                subtitle: 'تعيين رمز الحماية والقفل الفوري للشاشة',
                badgeText: securityPrefs.privacyLocked ? 'مقفول' : 'آمن',
              },
              {
                id: 'sec_cloud_sync_cap',
                title: 'الحساب والمزامنة السحابية',
                subtitle: 'حفظ واسترجاع نسخة البيانات على الخادم',
                badgeText: authUser ? 'متصل' : 'محلي',
              },
            ],
          },
          {
            id: 'gal_sec_backup_recycle',
            title: 'مجرة النسخ الاحتياطي وسلة الاسترجاع الآمنة',
            subtitle: 'تصدير/استيراد JSON وخصوصية الأسماء واسترجاع السجلات المحذوفة',
            subAxes: [
              {
                id: 'sec_backup_json_cap',
                title: 'النسخ الاحتياطي (JSON) والخصوصية',
                subtitle: 'تنزيل واستيراد الملفات وإرسال الأسماء للسحابة',
              },
              {
                id: 'sec_recycle_bin_cap',
                title: 'سلة الاسترجاع الآمنة',
                subtitle: 'استعادة الأسماء والقوائم والمصاريف المحذوفة',
                badgeText: `${recycleBin.length} عنصر`,
              },
            ],
          },
        ],
      },
      {
        id: 'system_map',
        category: 'security',
        title: 'المؤشرات وصحة البيانات والحوكمة',
        subtitle: 'لوحة الأداء KPI، إصلاح التضاربات، فاحص الحوكمة، وسجل المفاتيح',
        icon: <Activity className="h-5 w-5" />,
        galaxies: [
          {
            id: 'gal_gov_health',
            title: 'مجرة المؤشرات التنفيذية وصحة السجلات',
            subtitle: 'تشخيص وتصحيح المكررين والشواذ وتحليل الأداء الحقيقي',
            subAxes: [
              {
                id: 'cap_kpi_dashboard',
                title: 'لوحة المؤشرات التنفيذية (KPI)',
                subtitle: 'توزيع الأفراد والإيرادات والمصاريف حياً',
              },
              {
                id: 'cap_health_center',
                title: 'مركز صحة البيانات وإصلاح التضاربات',
                subtitle: 'فحص التكرارات وإصلاحها بنقرة واحدة',
                badgeText:
                  auditIssues.length > 0 ? `${auditIssues.length} ملاحظة` : 'سليم 100%',
              },
            ],
          },
          {
            id: 'gal_gov_registry',
            title: 'مجرة حوكمة النظام وأرشيف المفاتيح',
            subtitle: 'فاحص السجل و Feature Flags واستعادة لقطات ما قبل الترحيل',
            subAxes: [
              {
                id: 'cap_registry_inspector',
                title: 'فاحص السجل و Feature Flags',
                subtitle: 'التحقق من سلامة العوالم والميزات الجديدة',
              },
              {
                id: 'cap_legacy_index',
                title: 'الأرشيف الشامل للمفاتيح (0 حذف)',
                subtitle: 'فهرس الإعدادات الكلاسيكية ولقطات الترحيل',
              },
            ],
          },
        ],
      },
    ],
    [
      activeThemeObj.name,
      activeTableObj.name,
      activeFontObj.name,
      themePrefs.savedProfiles,
      themePrefs.fontSizePx,
      effectiveWorkspaceCosmos.accessibility.numeralSystem,
      displayMode,
      topBarConfig.autoFocus,
      editorEnabled,
      expertTableConfig.customCategories.length,
      calculationSettings.feePerIndividualIqd,
      calculationSettings.kgPerIndividual,
      quickExtractPrefs.clarityThreshold,
      quickExtractPrefs.focusedFields.length,
      quickExtractPrefs.referenceTemplates.length,
      assistantSettings.onlineDisabled,
      assistantSettings.dailyRequestLimit,
      assistantQuotaInfo?.dailyUsed,
      relationsPrefs.defaultReminderLeadDays,
      securityPrefs.privacyLocked,
      authUser,
      recycleBin.length,
      auditIssues.length,
    ]
  );

  // Resolve effective section spec (handle legacy cross-section deep links gracefully)
  const effectiveSectionId: SettingsSectionId = useMemo(() => {
    if (
      currentCapsuleId === 'sec_ai_assistant_cap' &&
      activeSection === 'security_data'
    ) {
      return 'ai_assistant';
    }
    if (
      (currentCapsuleId === 'cap_kpi_dashboard' ||
        currentCapsuleId === 'cap_health_center' ||
        currentCapsuleId === 'cap_registry_inspector' ||
        currentCapsuleId === 'cap_legacy_index') &&
      activeSection === 'general'
    ) {
      return 'system_map';
    }
    return activeSection;
  }, [activeSection, currentCapsuleId]);

  const currentSectionSpec =
    sectionSpecs.find((s) => s.id === effectiveSectionId) || sectionSpecs[0];

  // Auto-resolve active Galaxy from activeCapsuleId or selectedGalaxyId
  const activeGalaxySpec = useMemo(() => {
    if (currentCapsuleId) {
      const ownerGal = currentSectionSpec.galaxies.find((g) =>
        g.subAxes.some((sa) => sa.id === currentCapsuleId)
      );
      if (ownerGal) return ownerGal;
    }
    if (selectedGalaxyId) {
      const explicitGal = currentSectionSpec.galaxies.find(
        (g) => g.id === selectedGalaxyId
      );
      if (explicitGal) return explicitGal;
    }
    return null;
  }, [currentCapsuleId, selectedGalaxyId, currentSectionSpec]);

  const sectionNode = useMemo(() => {
    const mappedId =
      effectiveSectionId === 'ai_assistant'
        ? 'settings_security_node'
        : effectiveSectionId === 'system_map'
        ? 'settings_general_node'
        : getSettingsSectionNodeId(effectiveSectionId);
    return (
      getHierarchyNodeById(resolvedTree, mappedId) ||
      resolvedTree.children[0] ||
      resolvedTree
    );
  }, [resolvedTree, effectiveSectionId]);

  const activeNode = useMemo(() => {
    if (currentCapsuleId) {
      return getHierarchyNodeById(resolvedTree, currentCapsuleId) || sectionNode;
    }
    return sectionNode;
  }, [resolvedTree, currentCapsuleId, sectionNode]);

  // Unified Deep Search across both Section/Galaxy/SubAxis specs & Cosmos registry
  const deepSearchHits = useMemo(() => {
    const q = settingsSearch.trim();
    if (!q) return [];
    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      trailLabel: string;
      onOpen: () => void;
    }> = [];
    const seen = new Set<string>();

    // 1. Search Section -> Galaxy -> SubAxis directly
    const qLower = q.toLowerCase();
    for (const sec of sectionSpecs) {
      if (sec.title.toLowerCase().includes(qLower) || sec.subtitle.toLowerCase().includes(qLower)) {
        const key = `sec:${sec.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: key,
            title: sec.title,
            subtitle: sec.subtitle,
            trailLabel: `قسم رئيسي (${sec.galaxies.length} مجرات)`,
            onOpen: () => openSection(sec.id, null, null),
          });
        }
      }
      for (const gal of sec.galaxies) {
        if (gal.title.toLowerCase().includes(qLower) || gal.subtitle.toLowerCase().includes(qLower)) {
          const key = `gal:${gal.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              id: key,
              title: gal.title,
              subtitle: gal.subtitle,
              trailLabel: `${sec.title} ◂ مجرة`,
              onOpen: () => openSection(sec.id, gal.id, gal.subAxes[0]?.id || null),
            });
          }
        }
        for (const sa of gal.subAxes) {
          if (sa.title.toLowerCase().includes(qLower) || sa.subtitle.toLowerCase().includes(qLower)) {
            const key = `sa:${sa.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                id: key,
                title: sa.title,
                subtitle: sa.subtitle,
                trailLabel: `${sec.title} ◂ ${gal.title}`,
                onOpen: () => openSection(sec.id, gal.id, sa.id),
              });
            }
          }
        }
      }
    }

    // 2. Natural Arabic Cosmos search
    for (const hit of searchCosmosNodes(resolvedCosmosRoot, q).slice(0, 6)) {
      if (hit.node.target.settingsSection) {
        const secId = hit.node.target.settingsSection;
        const capId = hit.node.target.settingsCapsuleId || null;
        const key = `cos:${secId}:${capId || 'root'}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: key,
            title: hit.node.title,
            subtitle: hit.node.subtitle,
            trailLabel: hit.matchedReason,
            onOpen: () => openSection(secId, null, capId),
          });
        }
      }
    }

    // 3. Hierarchy search
    for (const h of searchHierarchyNodes(resolvedTree, q).slice(0, 5)) {
      if (h.node.target.view === 'settings' && h.node.target.settingsSection) {
        const secId = h.node.target.settingsSection;
        const capId = h.node.target.settingsCapsuleId || null;
        const key = `hier:${secId}:${capId || 'root'}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: key,
            title: h.node.title,
            subtitle: h.node.subtitle,
            trailLabel: 'بحث الإعدادات العميق',
            onOpen: () => openSection(secId, null, capId),
          });
        }
      }
    }

    return results.slice(0, 12);
  }, [settingsSearch, sectionSpecs, resolvedCosmosRoot, resolvedTree]);

  const openSection = (
    sectionId: SettingsSectionId,
    galaxyId: string | null = null,
    capsuleId: string | null = null
  ) => {
    const mappedSection: SettingsSectionId =
      sectionId === 'ai_assistant' ? 'ai_assistant' : sectionId;
    onChangeSection(mappedSection);
    setSelectedGalaxyId(galaxyId);
    setCapsuleId(capsuleId);
    setScreenMode('detail');
    setSettingsSearch('');
  };

  const handleOpenGalaxy = (galaxy: GalaxySpec) => {
    setSelectedGalaxyId(galaxy.id);
    setCapsuleId(galaxy.subAxes[0]?.id || null);
  };

  const containerMaxWidth =
    displayMode === 'contained' ? 'max-w-6xl mx-auto' : 'max-w-[1440px] mx-auto';

  const filteredSections = useMemo(
    () =>
      domainFilter === 'all'
        ? sectionSpecs
        : sectionSpecs.filter((s) => s.category === domainFilter),
    [domainFilter, sectionSpecs]
  );

  // Underlying capsule renderer for Level 3
  const renderCapsuleWorkspace = (capId: string) => {
    if (capId === 'cap_fonts_locale' && effectiveSectionId === 'fonts') {
      return (
        <Suspense
          fallback={
            <div className="rounded-2xl border p-8 text-center text-xs font-bold" style={{ borderColor: 'var(--border-color)' }}>
              جاري فتح المحور...
            </div>
          }
        >
          <FontsCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId="cap_fonts_locale"
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            themePrefs={themePrefs}
            accessibility={effectiveWorkspaceCosmos.accessibility}
            onUpdateThemePrefs={onUpdateThemePrefs}
            onUpdateAccessibilityPrefs={onUpdateAccessibilityPrefs}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
          />
        </Suspense>
      );
    }

    if (capId === 'cap_access_ergonomics') {
      return (
        <AccessibilityCosmosPanel
          accessibility={effectiveWorkspaceCosmos.accessibility}
          onUpdateAccessibility={(patch) => onUpdateAccessibilityPrefs?.(patch)}
          onNotify={notifySuccess}
        />
      );
    }

    if (
      capId === 'cap_kpi_dashboard' ||
      capId === 'cap_health_center' ||
      capId === 'cap_registry_inspector'
    ) {
      return (
        <HealthAndKpiPanel
          tab={
            capId === 'cap_health_center'
              ? 'health'
              : capId === 'cap_registry_inspector'
              ? 'inspector'
              : 'kpi'
          }
          agencies={state.agencies}
          persons={state.persons}
          expenses={state.expenses}
          calculationSettings={calculationSettings}
          rootCosmos={resolvedCosmosRoot}
          featureFlags={effectiveWorkspaceCosmos.featureFlags}
          onUpdateFeatureFlags={(patch) => onUpdateFeatureFlags?.(patch)}
          onRunAutoFix={() =>
            onRunAutoFix ? onRunAutoFix() : { fixedCount: 0, summaryLines: [] }
          }
          onOpenNode={(n) => {
            if (onSelectCosmosNode) {
              onSelectCosmosNode(n);
            } else if (n.target.settingsSection) {
              openSection(
                n.target.settingsSection,
                null,
                n.target.settingsCapsuleId ?? null
              );
            }
          }}
          onNotify={notifySuccess}
        />
      );
    }

    if (capId === 'cap_legacy_index') {
      return (
        <LegacyArchivePanel
          rootCosmos={resolvedCosmosRoot}
          workspaceCosmos={effectiveWorkspaceCosmos}
          migrationSnapshot={migrationSnapshot || state.migrationSnapshot}
          onToggleHiddenWorld={(wId) => onToggleHiddenWorld?.(wId)}
          onRestoreMigrationSnapshot={() =>
            onRestoreMigrationSnapshot ? onRestoreMigrationSnapshot() : false
          }
          onNavigateToLegacyEntry={(nodeId) => {
            const hit = getCosmosNodeById(resolvedCosmosRoot, nodeId);
            if (!hit) return;
            if (onSelectCosmosNode) {
              onSelectCosmosNode(hit);
            } else if (hit.target.settingsSection) {
              openSection(
                hit.target.settingsSection,
                null,
                hit.target.settingsCapsuleId ?? null
              );
            }
          }}
          onNotify={notifySuccess}
        />
      );
    }

    return (
      <Suspense
        fallback={
          <div
            className="rounded-2xl border p-8 text-center text-xs font-bold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            جاري فتح الإعدادات...
          </div>
        }
      >
        {effectiveSectionId === 'appearance' && (
          <AppearanceCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            themePrefs={themePrefs}
            topBarConfig={topBarConfig}
            onUpdateThemePrefs={onUpdateThemePrefs}
            onResetThemePrefs={onResetThemePrefs}
            onSaveAppearanceProfile={onSaveAppearanceProfile}
            onApplyAppearanceProfile={onApplyAppearanceProfile}
            onDeleteAppearanceProfile={onDeleteAppearanceProfile}
            onChangeTopBarConfig={onChangeTopBarConfig}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
            accessibility={effectiveWorkspaceCosmos.accessibility}
            onSaveCustomTheme={onSaveCustomTheme}
            onDeleteCustomTheme={onDeleteCustomTheme}
          />
        )}

        {effectiveSectionId === 'fonts' && (
          <FontsCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            themePrefs={themePrefs}
            accessibility={effectiveWorkspaceCosmos.accessibility}
            onUpdateThemePrefs={onUpdateThemePrefs}
            onUpdateAccessibilityPrefs={onUpdateAccessibilityPrefs}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
          />
        )}

        {effectiveSectionId === 'modes' && (
          <ModesCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            modeTier={modeTier}
            editorEnabled={editorEnabled}
            expertTableConfig={expertTableConfig}
            generalPrefs={generalPrefs}
            onChangeModeTier={onChangeModeTier}
            onToggleEditor={onToggleEditor}
            onUpdateExpertTableConfig={onUpdateExpertTableConfig}
            onResetExpertTableConfig={onResetExpertTableConfig}
            onUpdateGeneralPrefs={onUpdateGeneralPrefs}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
          />
        )}

        {effectiveSectionId === 'calculator' && (
          <CalculatorCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            calculationSettings={calculationSettings}
            agenciesCount={state.agencies.length}
            activePeriodLabel={state.activePeriod?.quotaName || 'الحصة الحالية'}
            onSaveCalculationSettings={(nextCalc) => {
              onAppendChangeLog?.({
                worldId: 'world_calculator',
                label: 'تحديث معادلة الحاسبة',
                beforeValue: `رسم ${calculationSettings.feePerIndividualIqd} د.ع`,
                afterValue: `رسم ${nextCalc.feePerIndividualIqd} د.ع`,
              });
              onSaveCalculationSettings(nextCalc);
            }}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
          />
        )}

        {effectiveSectionId === 'general' && (
          <GeneralCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            generalPrefs={generalPrefs}
            topBarConfig={topBarConfig}
            requireLoginOnStart={requireLoginOnStart}
            onUpdateGeneralPrefs={onUpdateGeneralPrefs}
            onChangeTopBarConfig={onChangeTopBarConfig}
            onToggleRequireLogin={onToggleRequireLogin}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
          />
        )}

        {effectiveSectionId === 'quick_extract_settings' && (
          <QuickExtractCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            quickExtractPrefs={quickExtractPrefs}
            onUpdateQuickExtractPrefs={onUpdateQuickExtractPrefs}
            onDeleteQuickExtractTemplate={onDeleteQuickExtractTemplate}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
          />
        )}

        {effectiveSectionId === 'relations_lists' && (
          <RelationsListsCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            relationsPrefs={relationsPrefs}
            onUpdateRelationsPrefs={onUpdateRelationsPrefs}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
          />
        )}

        {(effectiveSectionId === 'security_data' ||
          effectiveSectionId === 'ai_assistant') && (
          <SecurityCapsules
            sectionNode={sectionNode}
            activeNode={activeNode}
            activeCapsuleId={capId}
            displayMode={displayMode}
            badgeContext={resolvedBadgeContext}
            state={state}
            securityPrefs={securityPrefs}
            recycleBin={recycleBin}
            authUser={authUser}
            assistantSettings={assistantSettings}
            assistantConnectivity={assistantConnectivity}
            assistantQuotaInfo={assistantQuotaInfo}
            assistantCacheCount={assistantCacheCount}
            onUpdateSecurityPrefs={onUpdateSecurityPrefs}
            onRestoreRecycleBinItem={onRestoreRecycleBinItem}
            onPurgeRecycleBinItem={onPurgeRecycleBinItem}
            onClearRecycleBin={onClearRecycleBin}
            onImportWorkspaceJson={onImportWorkspaceJson}
            onSyncServer={onSyncServer}
            onRestoreServer={onRestoreServer}
            onOpenAuth={onOpenAuth}
            onUpdateAssistantSettings={onUpdateAssistantSettings}
            onResetAssistantQuota={onResetAssistantQuota}
            onClearAssistantCache={onClearAssistantCache}
            onOpenCapsule={(id) => setCapsuleId(id)}
            onNotifySuccess={notifySuccess}
            onNotifyError={notifyError}
          />
        )}
      </Suspense>
    );
  };

  return (
    <div
      data-settings-display-mode={displayMode}
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      {/* 1. Single Unified Executive Settings Header */}
      <header
        data-testid="settings-floating-topbar"
        className="no-print sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 ${containerMaxWidth}`}
        >
          {/* Start: Back + Hierarchical Breadcrumb */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <ArrowRight className="h-4 w-4" />
              <span>العودة للتطبيق</span>
            </button>

            <nav
              aria-label="مسار الإعدادات"
              className="flex flex-wrap items-center gap-1 text-xs"
            >
              <button
                type="button"
                onClick={() => {
                  setScreenMode('hub');
                  setSelectedGalaxyId(null);
                  setCapsuleId(null);
                }}
                className="rounded-lg px-2 py-1 font-extrabold transition-colors hover:bg-[var(--bg-main)]"
                style={{
                  color:
                    currentScreenMode === 'hub'
                      ? 'var(--accent)'
                      : 'var(--text-muted)',
                }}
              >
                مركز الإعدادات
              </button>

              {currentScreenMode === 'detail' && (
                <>
                  <ChevronLeft
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGalaxyId(null);
                      setCapsuleId(null);
                    }}
                    className="rounded-lg px-2 py-1 font-bold transition-colors hover:bg-[var(--bg-main)]"
                    style={{
                      color: activeGalaxySpec
                        ? 'var(--text-muted)'
                        : 'var(--accent)',
                    }}
                  >
                    {currentSectionSpec.title}
                  </button>
                </>
              )}

              {currentScreenMode === 'detail' && activeGalaxySpec && (
                <>
                  <ChevronLeft
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <span
                    className="rounded-lg px-2 py-1 font-extrabold"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      color: 'var(--accent)',
                    }}
                  >
                    {activeGalaxySpec.title}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Center: Universal Deep Settings Search */}
          <div className="relative flex-1 min-w-[220px] max-w-md order-3 md:order-2">
            <div
              className="flex h-9 items-center gap-2 rounded-xl border px-3 transition-colors focus-within:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: settingsSearch ? 'var(--accent)' : 'var(--border-color)',
              }}
            >
              <Search
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="search"
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deepSearchHits.length > 0) {
                    deepSearchHits[0].onOpen();
                  }
                }}
                placeholder="بحث عميق في الأقسام والمجرات والإعدادات..."
                aria-label="بحث في الإعدادات"
                className="w-full bg-transparent text-xs outline-none"
              />
              {settingsSearch && (
                <button
                  type="button"
                  onClick={() => setSettingsSearch('')}
                  aria-label="مسح البحث"
                  className="p-0.5 rounded hover:bg-[var(--bg-surface)]"
                >
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>

            {settingsSearch.trim() && (
              <div
                className="tabrix-popover-enter absolute inset-x-0 top-full z-50 mt-2 max-h-[360px] overflow-y-auto rounded-2xl border p-2 shadow-xl space-y-1"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {deepSearchHits.length === 0 ? (
                  <div
                    className="py-5 text-center text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    لا توجد نتائج مطابقة في الإعدادات.
                  </div>
                ) : (
                  deepSearchHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={hit.onOpen}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right transition-colors hover:bg-[var(--bg-nav-active)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold">
                          {hit.title}
                        </div>
                        <div
                          className="truncate text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {hit.subtitle}
                        </div>
                      </div>
                      <span
                        className="shrink-0 text-[10px] font-bold"
                        style={{ color: 'var(--accent)' }}
                      >
                        {hit.trailLabel}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* End: View Density, Theme Light/Dark, Command Palette, Auth (Settings-Only!) */}
          <div className="flex items-center gap-1.5 order-2 md:order-3">
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                title="لوحة الأوامر السريعة (Ctrl+K)"
                aria-label="لوحة الأوامر"
                className="inline-flex h-9 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <Command className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">K</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const nextMode =
                  displayMode === 'fullscreen' ? 'contained' : 'fullscreen';
                onUpdateGeneralPrefs({ settingsDisplayMode: nextMode });
                notifySuccess(
                  nextMode === 'fullscreen'
                    ? 'تم تفعيل العرض الممتد (ملء الشاشة).'
                    : 'تم تفعيل العرض المدمج المركزي.'
                );
              }}
              aria-label="تبديل حجم صفحة الإعدادات"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              {displayMode === 'fullscreen' ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {displayMode === 'fullscreen' ? 'ممتد' : 'مدمج'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleDarkTheme(!darkTheme);
                notifySuccess(
                  !darkTheme ? 'تم تفعيل الوضع الليلي.' : 'تم تفعيل الوضع النهاري.'
                );
              }}
              aria-label={darkTheme ? 'الوضع النهاري' : 'الوضع الليلي'}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              {darkTheme ? (
                <Sun className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              ) : (
                <Moon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              )}
              <span className="hidden sm:inline">
                {darkTheme ? 'نهاري' : 'ليلي'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <UserCircle2 className="h-4 w-4" />
              <span className="hidden lg:inline max-w-[90px] truncate" dir="auto">
                {authUser ? authUser.displayName : 'الحساب'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Inline Toast Notifications */}
      {(feedback || errorFeedback) && (
        <div className={`w-full px-4 pt-4 sm:px-6 ${containerMaxWidth}`}>
          <div
            role="status"
            className="tabrix-view-enter flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"
            style={{
              backgroundColor: errorFeedback
                ? 'var(--danger-bg)'
                : 'var(--success-bg)',
              borderColor: errorFeedback ? 'var(--danger)' : 'var(--success)',
              color: errorFeedback ? 'var(--danger)' : 'var(--success)',
            }}
          >
            <span>{errorFeedback || feedback}</span>
            <button
              type="button"
              onClick={() => {
                setFeedback('');
                setErrorFeedback('');
              }}
              aria-label="إغلاق التنبيه"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── LEVEL 1: SETTINGS HUB (الأقسام الرئيسية والمجرات) ──────────────── */}
      {currentScreenMode === 'hub' && (
        <main
          data-testid="settings-sections-hub"
          className={`w-full flex-1 space-y-6 px-4 py-6 pb-16 sm:px-6 ${containerMaxWidth}`}
        >
          {/* Executive Settings Identity Strip */}
          <section
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                  <h1 className="text-xl font-black sm:text-2xl">
                    مركز الإعدادات المتقدم
                  </h1>
                </div>
                <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                  بنية هرمية احترافية: اختر القسم الرئيسي ◂ ثم المجرة ◂ ثم المحور والإعدادات العميقة.
                </p>
              </div>

              {/* Live Environment Status Summary */}
              <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                <div
                  className="rounded-xl border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    الثيم والخط
                  </div>
                  <div className="font-extrabold">
                    {activeThemeObj.name} · {activeFontObj.name}
                  </div>
                </div>
                <div
                  className="rounded-xl border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    معادلة الحاسبة
                  </div>
                  <div className="font-extrabold" style={{ color: 'var(--accent)' }}>
                    {calculationSettings.kgPerIndividual} كغم ·{' '}
                    {formatIqd(calculationSettings.feePerIndividualIqd)}
                  </div>
                </div>
              </div>
            </div>

            {/* Domain Filter Tabs */}
            <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
              {(
                [
                  ['all', `جميع الأقسام (${sectionSpecs.length})`],
                  ['visual', 'المظهر والخطوط'],
                  ['permissions', 'الواجهة والصلاحيات'],
                  ['operations', 'الحاسبة والسحب والذكاء'],
                  ['security', 'الأمان والصحة والحوكمة'],
                ] as Array<[DomainCategory, string]>
              ).map(([cat, label]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDomainFilter(cat)}
                  className="min-h-[36px] rounded-xl border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor:
                      domainFilter === cat ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor:
                      domainFilter === cat ? 'var(--accent)' : 'var(--border-color)',
                    color: domainFilter === cat ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Sections Cards Grid */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredSections.map((sec) => {
              const totalSubAxes = sec.galaxies.reduce(
                (acc, g) => acc + g.subAxes.length,
                0
              );
              return (
                <article
                  key={sec.id}
                  className="flex flex-col justify-between rounded-2xl border p-5 transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                          style={{
                            backgroundColor: 'var(--bg-nav-active)',
                            borderColor:
                              'color-mix(in srgb, var(--accent) 28%, var(--border-color))',
                            color: 'var(--accent)',
                          }}
                        >
                          {sec.icon}
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-base font-extrabold">{sec.title}</h2>
                          <p
                            className="mt-1 text-xs leading-relaxed"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {sec.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Preview of Galaxies Inside This Section */}
                    <div className="space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <span className="font-bold">المجرات الداخلية ({sec.galaxies.length})</span>
                        <span className="tabular-nums font-semibold">
                          {totalSubAxes} محور عميق
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {sec.galaxies.map((gal) => (
                          <button
                            key={gal.id}
                            type="button"
                            onClick={() =>
                              openSection(sec.id, gal.id, gal.subAxes[0]?.id || null)
                            }
                            className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-right text-xs transition-colors hover:border-[var(--accent)]"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <span className="truncate font-bold">{gal.title}</span>
                            <span
                              className="shrink-0 text-[10px] font-bold tabular-nums"
                              style={{ color: 'var(--accent)' }}
                            >
                              {gal.subAxes.length} محاور
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openSection(sec.id, null, null)}
                    className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <FolderKanban className="h-4 w-4" />
                    <span>استعراض مجرات القسم</span>
                  </button>
                </article>
              );
            })}
          </section>
        </main>
      )}

      {/* ─── LEVEL 2: GALAXIES INSIDE SECTION ───────────────────────────────── */}
      {currentScreenMode === 'detail' && !activeGalaxySpec && (
        <main
          data-testid={`settings-detail-${effectiveSectionId}`}
          className={`w-full flex-1 space-y-6 px-4 py-6 pb-16 sm:px-6 ${containerMaxWidth}`}
        >
          {/* Section Banner */}
          <section
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 sm:p-6"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-start gap-3.5">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor:
                    'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
                  color: 'var(--accent)',
                }}
              >
                {currentSectionSpec.icon}
              </span>
              <div>
                <h1 className="text-xl font-black">{currentSectionSpec.title}</h1>
                <p
                  className="mt-1 text-xs sm:text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {currentSectionSpec.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setScreenMode('hub')}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>جميع الأقسام</span>
            </button>
          </section>

          {/* Galaxies Grid */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {currentSectionSpec.galaxies.map((gal) => (
              <article
                key={gal.id}
                className="flex flex-col justify-between rounded-2xl border p-5 space-y-4 transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-extrabold">{gal.title}</h2>
                      <p
                        className="mt-1 text-xs leading-relaxed"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {gal.subtitle}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-lg border px-2.5 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-nav-active)',
                        borderColor:
                          'color-mix(in srgb, var(--accent) 28%, var(--border-color))',
                        color: 'var(--accent)',
                      }}
                    >
                      {gal.subAxes.length} محاور
                    </span>
                  </div>

                  {/* Direct Sub-Axes inside this Galaxy */}
                  <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                    {gal.subAxes.map((sa) => (
                      <button
                        key={sa.id}
                        type="button"
                        onClick={() => {
                          setSelectedGalaxyId(gal.id);
                          setCapsuleId(sa.id);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-right text-xs transition-colors hover:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold">{sa.title}</div>
                          <div
                            className="mt-0.5 truncate text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {sa.subtitle}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {sa.badgeText && (
                            <span
                              className="text-[11px] font-bold tabular-nums"
                              style={{ color: 'var(--accent)' }}
                            >
                              {sa.badgeText}
                            </span>
                          )}
                          <ChevronLeft
                            className="h-3.5 w-3.5"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenGalaxy(gal)}
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>الدخول إلى المجرة</span>
                </button>
              </article>
            ))}
          </section>
        </main>
      )}

      {/* ─── LEVEL 3: DEEP SUB-AXES & CAPSULES INSIDE A GALAXY ──────────────── */}
      {currentScreenMode === 'detail' && activeGalaxySpec && (
        <main
          data-testid={`settings-detail-${effectiveSectionId}`}
          className={`w-full flex-1 space-y-5 px-4 py-6 pb-16 sm:px-6 ${containerMaxWidth}`}
        >
          {/* Galaxy Sub-Axes Switcher Bar */}
          <section
            className="rounded-2xl border p-4 space-y-3"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-base font-black sm:text-lg">
                  {activeGalaxySpec.title}
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activeGalaxySpec.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGalaxyId(null);
                  setCapsuleId(null);
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>العودة لمجرات {currentSectionSpec.title}</span>
              </button>
            </div>

            {activeGalaxySpec.subAxes.length > 1 && (
              <div
                className="flex flex-wrap gap-1.5 border-t pt-3"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {activeGalaxySpec.subAxes.map((sa) => {
                  const isActive =
                    (currentCapsuleId || activeGalaxySpec.subAxes[0]?.id) === sa.id;
                  return (
                    <button
                      key={sa.id}
                      type="button"
                      onClick={() => setCapsuleId(sa.id)}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors"
                      style={{
                        backgroundColor: isActive
                          ? 'var(--accent)'
                          : 'var(--bg-main)',
                        borderColor: isActive
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                        color: isActive ? 'var(--accent-fg)' : 'var(--text-primary)',
                      }}
                    >
                      <span>{sa.title}</span>
                      {sa.badgeText && (
                        <span
                          className="text-[10px] opacity-85 tabular-nums"
                        >
                          ({sa.badgeText})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Active Deep Capsule */}
          <div>
            {renderCapsuleWorkspace(
              currentCapsuleId || activeGalaxySpec.subAxes[0]?.id || ''
            )}
          </div>
        </main>
      )}
    </div>
  );
};
