import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  Bot,
  Calculator,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  CloudUpload,
  Coins,
  Columns3,
  Compass,
  Cpu,
  Edit3,
  Eye,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  Gauge,
  GitBranch,
  Hand,
  Hash,
  HeartHandshake,
  HeartPulse,
  Home,
  Layers,
  ListChecks,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  PanelTop,
  Percent,
  RotateCcw,
  Scale,
  ScanLine,
  Search,
  Share2,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Table2,
  Tag,
  Type,
  Unlock,
  Wrench,
  X,
} from 'lucide-react';
import { DEFAULT_WORKSPACE_COSMOS } from '../data/seedData';
import { TabrixSubViewTransition } from './ui/TabrixMotionPrimitives';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_SPRING,
  useTabrixDirection,
  useTabrixReducedMotion,
} from '../utils/tabrixMotion';
import { getAppThemeById } from '../utils/themes';
import { playTactileFeedback } from '../utils/tactileFeedback';
import type {
  AccessibilityAndExperiencePrefs,
  AppDatabaseState,
  AppModeTier,
  AppView,
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
  SmartLivingSectionCard,
  type SmartSubIconItem,
} from './ui/SmartLivingSectionCard';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
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
  onNavigateAppView?: (view: AppView) => void;
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
  onRestoreMigrationSnapshot?: () => boolean | Promise<boolean>;
  onAppendChangeLog?: (entry: {
    worldId: CosmosWorldId;
    label: string;
    beforeValue?: string;
    afterValue?: string;
  }) => void;
  onRunAutoFix?: () =>
    | { fixedCount: number; summaryLines: string[] }
    | Promise<{ fixedCount: number; summaryLines: string[] }>;
  onOpenWorldSwitcher?: () => void;
  onSelectCosmosNode?: (node: CosmosNode) => void;
}

type DomainCategory = 'all' | 'visual' | 'permissions' | 'operations' | 'security';

interface SubAxisSpec {
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string;
  icon?: React.ReactNode;
}

interface GalaxySpec {
  id: string;
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  subAxes: SubAxisSpec[];
}

interface SectionSpec {
  id: SettingsSectionId;
  category: Exclude<DomainCategory, 'all'>;
  title: string;
  subtitle: string;
  metaText: string;
  icon: React.ReactNode;
  subIcons: Array<{
    id: string;
    label: string;
    hint: string;
    icon: React.ReactNode;
    galaxyId?: string | null;
    capsuleId?: string | null;
  }>;
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
  onNavigateAppView,
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
  const [settingsSearchOpen, setSettingsSearchOpen] = useState(false);
  const settingsSearchInputRef = useRef<HTMLInputElement>(null);
  const settingsSearchWrapRef = useRef<HTMLDivElement>(null);

  const currentScreenMode = screenMode ?? localScreenMode;
  const setScreenMode = onChangeScreenMode ?? setLocalScreenMode;
  const currentCapsuleId =
    activeCapsuleId !== undefined ? activeCapsuleId : localCapsuleId;
  const setCapsuleId = onChangeCapsuleId ?? setLocalCapsuleId;

  // Collapse on-demand settings search when navigating views/galaxies/sub-pages
  useEffect(() => {
    setSettingsSearchOpen(false);
    setSettingsSearch('');
  }, [currentScreenMode, activeSection, selectedGalaxyId, currentCapsuleId]);

  useEffect(() => {
    if (!settingsSearchOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (
        settingsSearchWrapRef.current &&
        !settingsSearchWrapRef.current.contains(e.target as Node)
      ) {
        setSettingsSearchOpen(false);
        setSettingsSearch('');
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsSearchOpen(false);
        setSettingsSearch('');
      }
    };
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [settingsSearchOpen]);

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
    playTactileFeedback('success', { haptic: true });
  };
  const notifyError = (msg: string) => {
    setFeedback('');
    setErrorFeedback(msg);
    playTactileFeedback('error', { haptic: true });
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

  // Master 10-Section -> Galaxies -> Deep Sub-Axes Architecture (with 4 living visual sub-icons per card)
  const sectionSpecs: SectionSpec[] = useMemo(
    () => [
      {
        id: 'appearance',
        category: 'visual',
        title: 'هندسة السبج والذهب والجداول',
        subtitle: 'ملفات المظهر، الأبعاد الزجاجية، ومحركات الجداول الـ8 تحت هوية السبج والذهب المعتمدة',
        metaText: `السبج والذهب · ${activeTableObj.name}`,
        icon: <Palette className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_tables',
            label: 'الجداول الـ8',
            hint: 'الدفتر الورقي المحاسبي والزجاجي والنيون',
            icon: <Table2 className="h-4 w-4" />,
            galaxyId: 'gal_app_tables',
            capsuleId: 'appearance_table_engines_cap',
          },
          {
            id: 'sub_geometry',
            label: 'الزجاجية والأبعاد',
            hint: 'انحناء الزوايا، شفافية الزجاج، وارتفاع الصفوف',
            icon: <Layers className="h-4 w-4" />,
            galaxyId: 'gal_app_custom_geometry',
            capsuleId: 'appearance_geometry_cap',
          },
          {
            id: 'sub_profiles',
            label: 'ملفات المظهر',
            hint: 'حفظ واستعادة توليفات الجداول والخطوط',
            icon: <Bookmark className="h-4 w-4" />,
            galaxyId: 'gal_app_themes',
            capsuleId: 'appearance_profiles_cap',
          },
          {
            id: 'sub_rules',
            label: 'التنسيق الشرطي',
            hint: 'تمييز المحجوبين والمكررين وسجلات 0 أفراد',
            icon: <Sliders className="h-4 w-4" />,
            galaxyId: 'gal_app_tables',
            capsuleId: 'appearance_table_rules_cap',
          },
        ],
        galaxies: [
          {
            id: 'gal_app_themes',
            title: 'ملفات التخصيص المعتمدة',
            subtitle: 'الهوية مقفلة على السبج والذهب مع حفظ واسترجاع توليفات الجدول والخط',
            icon: <Bookmark className="h-5 w-5" />,
            subAxes: [
              {
                id: 'appearance_profiles_cap',
                title: 'ملفات المظهر المحفوظة',
                subtitle: 'حفظ واسترجاع توليفاتك للجدول والخط والأبعاد',
                badgeText: `${themePrefs.savedProfiles?.length ?? 2} ملف`,
                icon: <Bookmark className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_app_custom_geometry',
            title: 'الهندسة والزجاجية والظلال',
            subtitle: 'ضبط انحناء الحواف، شفافية الزجاج الدخاني، وحجم الصفوف',
            icon: <Layers className="h-5 w-5" />,
            subAxes: [
              {
                id: 'appearance_geometry_cap',
                title: 'الهندسة والزجاجية والظلال',
                subtitle: 'انحناء الزوايا، شفافية الزجاج، وارتفاع البطاقات',
                icon: <Layers className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_app_tables',
            title: 'محركات وتصميم الجداول',
            subtitle: 'أنماط الجداول الـ8 وقواعد التنسيق الشرطي للأسماء والمحجوبين',
            icon: <Table2 className="h-5 w-5" />,
            subAxes: [
              {
                id: 'appearance_tables_cap',
                title: 'مركز تصميم الجداول',
                subtitle: 'نظرة عامة ومعاينة الجداول',
                badgeText: activeTableObj.name,
                icon: <Table2 className="h-4 w-4" />,
              },
              {
                id: 'appearance_table_engines_cap',
                title: 'محركات الجداول الـ8',
                subtitle: 'الزجاجي، الدفتر الورقي، الملكي، النيون...',
                icon: <Sparkles className="h-4 w-4" />,
              },
              {
                id: 'appearance_table_rules_cap',
                title: 'التنسيق الشرطي والتمييز',
                subtitle: 'تلوين المحجوبين والمكررين وسجلات 0 أفراد',
                icon: <Sliders className="h-4 w-4" />,
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
        metaText: `${activeFontObj.name} · ${themePrefs.fontSizePx ?? 15}px`,
        icon: <Type className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_font_family',
            label: 'الخطوط (6)',
            hint: 'Cairo، Tajawal، Almarai، IBM Plex',
            icon: <Type className="h-4 w-4" />,
            galaxyId: 'gal_fonts_typography',
            capsuleId: 'fonts_family_cap',
          },
          {
            id: 'sub_font_scale',
            label: 'المقاس والوزن',
            hint: 'حجم الخط وكثافة الجداول',
            icon: <Sliders className="h-4 w-4" />,
            galaxyId: 'gal_fonts_typography',
            capsuleId: 'fonts_scale_cap',
          },
          {
            id: 'sub_numerals',
            label: 'الأرقام ١٢٣',
            hint: 'الأرقام القياسية 123 أو الهندية ١٢٣',
            icon: <Hash className="h-4 w-4" />,
            galaxyId: 'gal_fonts_locale',
            capsuleId: 'cap_fonts_locale',
          },
          {
            id: 'sub_calendar',
            label: 'التقويم هجري',
            hint: 'صيغ التواريخ الهجرية والميلادية',
            icon: <Calendar className="h-4 w-4" />,
            galaxyId: 'gal_fonts_locale',
            capsuleId: 'cap_fonts_locale',
          },
        ],
        galaxies: [
          {
            id: 'gal_fonts_typography',
            title: 'الخطوط العربية والمقاسات',
            subtitle: 'اختيار الخط، حجم النص، وزن الحروف، وكثافة الجداول',
            icon: <Type className="h-5 w-5" />,
            subAxes: [
              {
                id: 'fonts_family_cap',
                title: 'الخطوط العربية (6)',
                subtitle: 'Cairo، Tajawal، Almarai، IBM Plex...',
                badgeText: activeFontObj.name,
                icon: <Type className="h-4 w-4" />,
              },
              {
                id: 'fonts_scale_cap',
                title: 'المقاسات والكثافة والوضوح',
                subtitle: 'حجم الخط، الوزن، الأرقام المتساوية، والتتبع',
                badgeText: `${themePrefs.fontSizePx ?? 15}px`,
                icon: <Sliders className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_fonts_locale',
            title: 'الترقيم والتقويم العالمي',
            subtitle: 'الأرقام القياسية (123) أم الهندية (١٢٣)، والتقويم الهجري والميلادي',
            icon: <Hash className="h-5 w-5" />,
            subAxes: [
              {
                id: 'cap_fonts_locale',
                title: 'الأرقام والتقويم (١٢٣ / هجري)',
                subtitle: 'صيغة الأرقام والتواريخ عبر كل البطاقات',
                badgeText:
                  effectiveWorkspaceCosmos.accessibility.numeralSystem === 'hindi'
                    ? '١٢٣ هندية'
                    : '123 غربية',
                icon: <Calendar className="h-4 w-4" />,
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
        metaText: `${displayMode === 'fullscreen' ? 'ملء الشاشة' : 'مدمج'} · ${topBarConfig.autoFocus ? 'شريط ذكي' : 'شريط ثابت'}`,
        icon: <Sliders className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_display',
            label: 'ملء الشاشة',
            hint: 'العرض الممتد أو المدمج وسعة التراجع',
            icon: <Monitor className="h-4 w-4" />,
            galaxyId: 'gal_general_workspace',
            capsuleId: 'general_display_cap',
          },
          {
            id: 'sub_topbar',
            label: 'الشريط العلوي',
            hint: 'نمط الشريط والإخفاء التلقائي',
            icon: <PanelTop className="h-4 w-4" />,
            galaxyId: 'gal_general_workspace',
            capsuleId: 'general_topbar_cap',
          },
          {
            id: 'sub_behavior',
            label: 'التنبيهات',
            hint: 'قواعد التعديل وبوابة الدخول',
            icon: <Bell className="h-4 w-4" />,
            galaxyId: 'gal_general_workspace',
            capsuleId: 'general_behavior_cap',
          },
          {
            id: 'sub_ergonomics',
            label: 'اليد الواحدة',
            hint: 'تقليل الحركة والتجاوب اللمسي',
            icon: <Hand className="h-4 w-4" />,
            galaxyId: 'gal_general_accessibility',
            capsuleId: 'cap_access_ergonomics',
          },
        ],
        galaxies: [
          {
            id: 'gal_general_workspace',
            title: 'الشاشة والشريط العلوي والسلوك',
            subtitle: 'تخصيص وضع العرض وإخفاء الشريط العلوي والتأكيدات',
            icon: <Monitor className="h-5 w-5" />,
            subAxes: [
              {
                id: 'general_display_cap',
                title: 'العرض وسعة التراجع (Undo)',
                subtitle: 'ملء الشاشة / المدمج وسعة سجل التراجع',
                badgeText: displayMode === 'fullscreen' ? 'ملء الشاشة' : 'مدمج',
                icon: <Monitor className="h-4 w-4" />,
              },
              {
                id: 'general_topbar_cap',
                title: 'تحكم الشريط العلوي',
                subtitle: 'نمط الشريط والإخفاء التلقائي عند التمرير',
                badgeText: topBarConfig.autoFocus ? 'ذكي تلقائي' : 'ثابت',
                icon: <PanelTop className="h-4 w-4" />,
              },
              {
                id: 'general_behavior_cap',
                title: 'سلوك التعديل والتنبيهات وبوابة الدخول',
                subtitle: 'تنبيهات العمليات وقفل البداية الإلزامي',
                icon: <Bell className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_general_accessibility',
            title: 'الصوت والإشعارات والراحة البصرية',
            subtitle: 'صوت المصباح والموسيقى الخلفية، تقليل الحركة، وضع اليد الواحدة، والتجاوب اللمسي',
            icon: <Hand className="h-5 w-5" />,
            subAxes: [
              {
                id: 'cap_access_ergonomics',
                title: 'الصوت والإشعارات والوصولية',
                subtitle: 'التحكم في صوت المصباح والموسيقى الخلفية والاهتزاز وتقليل الحركة',
                icon: <Hand className="h-4 w-4" />,
              },
            ],
          },
        ],
      },
      {
        id: 'modes',
        category: 'permissions',
        title: 'إعدادات التحرير والجداول',
        subtitle: 'قواعد التأكيد عند التعديل والحذف، الحفظ الفوري، الفئات المخصصة، وتخطيط الأعمدة',
        metaText: `${expertTableConfig.allowDirectNoConfirmEdit ? 'حفظ فوري' : 'تأكيد ذكي'} · ${expertTableConfig.customCategories.length} فئات`,
        icon: <Layers className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_matrix',
            label: 'الحفظ الفوري',
            hint: 'تطبيق التعديلات مباشرة دون نوافذ تأكيد',
            icon: <ShieldCheck className="h-4 w-4" />,
            galaxyId: 'gal_modes_matrix',
            capsuleId: 'modes_editor_cap',
          },
          {
            id: 'sub_editor',
            label: 'قواعد التأكيد',
            hint: 'ضبط تأكيد التعديل والحذف لحماية البيانات',
            icon: <Edit3 className="h-4 w-4" />,
            galaxyId: 'gal_modes_matrix',
            capsuleId: 'modes_editor_cap',
          },
          {
            id: 'sub_categories',
            label: 'الفئات',
            hint: 'تصنيفات المستفيدين المخصصة',
            icon: <Tag className="h-4 w-4" />,
            galaxyId: 'gal_modes_expert',
            capsuleId: 'modes_expert_cap',
          },
          {
            id: 'sub_columns',
            label: 'الأعمدة',
            hint: 'إعادة ضبط تخطيط الأعمدة الافتراضي',
            icon: <Columns3 className="h-4 w-4" />,
            galaxyId: 'gal_modes_expert',
            capsuleId: 'modes_expert_cap',
          },
        ],
        galaxies: [
          {
            id: 'gal_modes_matrix',
            title: 'قواعد التحرير والتأكيدات',
            subtitle: 'تخصيص الحفظ الفوري وتأكيدات التعديل والحذف داخل السجلات',
            icon: <ShieldCheck className="h-5 w-5" />,
            subAxes: [
              {
                id: 'modes_editor_cap',
                title: 'قواعد التأكيد والحفظ الفوري',
                subtitle: 'التحكم بنوافذ التأكيد قبل تعديل أو حذف السجلات',
                badgeText: expertTableConfig.allowDirectNoConfirmEdit ? 'حفظ فوري' : 'تأكيد ذكي',
                icon: <Edit3 className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_modes_expert',
            title: 'الفئات المخصصة وتخطيط الجداول',
            subtitle: 'إدارة تصنيفات المستفيدين المخصصة وإعادة ضبط أعمدة الجدول',
            icon: <Columns3 className="h-5 w-5" />,
            subAxes: [
              {
                id: 'modes_expert_cap',
                title: 'الفئات المخصصة وتخطيط الأعمدة',
                subtitle: 'إضافة/حذف الفئات وضبط تخطيط الجداول',
                badgeText: `${expertTableConfig.customCategories.length} فئات`,
                icon: <Columns3 className="h-4 w-4" />,
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
        metaText: `${calculationSettings.kgPerIndividual} كغم · ${calculationSettings.feePerIndividualIqd} د.ع`,
        icon: <Calculator className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_fees',
            label: 'الرسوم',
            hint: 'رسم الفرد والبطاقة والأجور',
            icon: <Coins className="h-4 w-4" />,
            galaxyId: 'gal_calc_formulas',
            capsuleId: 'calc_fees_cap',
          },
          {
            id: 'sub_quotas',
            label: 'الأوزان',
            hint: 'كغم/فرد ووزن الكيس الكامل',
            icon: <Scale className="h-4 w-4" />,
            galaxyId: 'gal_calc_formulas',
            capsuleId: 'calc_quotas_cap',
          },
          {
            id: 'sub_rounding',
            label: 'التقريب',
            hint: 'التقريب والخصم وشمول المحجوبين',
            icon: <Percent className="h-4 w-4" />,
            galaxyId: 'gal_calc_rules_lab',
            capsuleId: 'calc_rules_cap',
          },
          {
            id: 'sub_lab',
            label: 'المختبر الحي',
            hint: 'اختبار فوري قبل الحفظ + القوالب',
            icon: <FlaskConical className="h-4 w-4" />,
            galaxyId: 'gal_calc_rules_lab',
            capsuleId: 'calc_preview_cap',
          },
        ],
        galaxies: [
          {
            id: 'gal_calc_formulas',
            title: 'الأوزان والرسوم القياسية',
            subtitle: 'وزن الفرد والكيس ورسم الفرد (250 د.ع) وأجور العمال الافتراضية',
            icon: <Coins className="h-5 w-5" />,
            subAxes: [
              {
                id: 'calc_fees_cap',
                title: 'الرسوم والأجور الافتراضية',
                subtitle: 'رسم الفرد والبطاقة والأجور والمصاريف',
                badgeText: `${calculationSettings.feePerIndividualIqd} د.ع`,
                icon: <Coins className="h-4 w-4" />,
              },
              {
                id: 'calc_quotas_cap',
                title: 'الحصص والأوزان (كغم)',
                subtitle: 'كغم/فرد ووزن الكيس الكامل',
                badgeText: `${calculationSettings.kgPerIndividual} كغم`,
                icon: <Scale className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_calc_rules_lab',
            title: 'القواعد والمختبر الحي والقوالب',
            subtitle: 'التقريب والخصم والمحجوبين + اختبار رقمي حي قبل الحفظ ومقارنة قبل/بعد',
            icon: <FlaskConical className="h-5 w-5" />,
            subAxes: [
              {
                id: 'calc_rules_cap',
                title: 'التقريب والخصم والمحجوبين',
                subtitle: 'خطوة التقريب ونسبة الخصم وشمول المحجوبين',
                icon: <Percent className="h-4 w-4" />,
              },
              {
                id: 'calc_preview_cap',
                title: 'المختبر الحي والقوالب الجاهزة',
                subtitle: 'تجربة فورية وتطبيق القوالب على الوكالات',
                icon: <FlaskConical className="h-4 w-4" />,
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
        metaText: `وضوح ${quickExtractPrefs.clarityThreshold}% · ${quickExtractPrefs.referenceTemplates.length} قوالب`,
        icon: <ScanLine className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_camera',
            label: 'الكاميرا',
            hint: 'التصوير الفائق 4 لقطات أو السريع',
            icon: <Camera className="h-4 w-4" />,
            galaxyId: 'gal_qe_camera',
            capsuleId: 'qe_scan_mode_cap',
          },
          {
            id: 'sub_clarity',
            label: 'الوضوح',
            hint: 'عتبة الوضوح والتقاط تلقائي',
            icon: <Eye className="h-4 w-4" />,
            galaxyId: 'gal_qe_camera',
            capsuleId: 'qe_scan_mode_cap',
          },
          {
            id: 'sub_fields',
            label: 'الحقول',
            hint: 'تخصيص الأعمدة المستخرجة',
            icon: <ScanLine className="h-4 w-4" />,
            galaxyId: 'gal_qe_templates',
            capsuleId: 'qe_fields_cap',
          },
          {
            id: 'sub_templates',
            label: 'القوالب',
            hint: 'صور الدفاتر المرجعية المحفوظة',
            icon: <Layers className="h-4 w-4" />,
            galaxyId: 'gal_qe_templates',
            capsuleId: 'qe_templates_cap',
          },
        ],
        galaxies: [
          {
            id: 'gal_qe_camera',
            title: 'التصوير وعتبة الوضوح',
            subtitle: 'ضبط التصوير الفائق (4 لقطات) أو السريع وحد وضوح اللقطات',
            icon: <Camera className="h-5 w-5" />,
            subAxes: [
              {
                id: 'qe_scan_mode_cap',
                title: 'وضع التصوير وعتبة الوضوح',
                subtitle: 'ضبط الحساسية ونمط الالتقاط التلقائي',
                badgeText: `${quickExtractPrefs.clarityThreshold}%`,
                icon: <Camera className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_qe_templates',
            title: 'الحقول والقوالب المرجعية',
            subtitle: 'تخصيص الأعمدة المستخرجة وإدارة قوالب دفاتر الوكالات المحفوظة',
            icon: <Layers className="h-5 w-5" />,
            subAxes: [
              {
                id: 'qe_fields_cap',
                title: 'الحقول المستهدفة',
                subtitle: 'الأسماء، الأفراد، النقصان، والإضافة/الحذف',
                badgeText: `${quickExtractPrefs.focusedFields.length} حقول`,
                icon: <ScanLine className="h-4 w-4" />,
              },
              {
                id: 'qe_templates_cap',
                title: 'القوالب المرجعية المحفوظة',
                subtitle: 'تفعيل أو إزالة صور الدفاتر المرجعية',
                badgeText: `${quickExtractPrefs.referenceTemplates.length} قالب`,
                icon: <Layers className="h-4 w-4" />,
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
        metaText: assistantSettings.onlineDisabled
          ? 'وضع أوفلاين 100%'
          : `الحصة ${assistantQuotaInfo?.dailyUsed ?? 0}/${assistantSettings.dailyRequestLimit}`,
        icon: <Bot className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_models',
            label: 'النماذج',
            hint: 'ترتيب القوة والنماذج التخصصية',
            icon: <Cpu className="h-4 w-4" />,
            galaxyId: 'gal_ai_brain_quota',
            capsuleId: 'sec_ai_assistant_cap',
          },
          {
            id: 'sub_routing',
            label: 'التوجيه',
            hint: 'توجيه كل مهمة للنموذج الأنسب',
            icon: <GitBranch className="h-4 w-4" />,
            galaxyId: 'gal_ai_brain_quota',
            capsuleId: 'sec_ai_assistant_cap',
          },
          {
            id: 'sub_quota',
            label: 'الحصة',
            hint: 'حدود الاستخدام اليومي والذاكرة',
            icon: <Gauge className="h-4 w-4" />,
            galaxyId: 'gal_ai_brain_quota',
            capsuleId: 'sec_ai_assistant_cap',
          },
          {
            id: 'sub_morrow_fallback',
            label: 'Morrow محلي',
            hint: 'الوضع الأوفلاين والاحتياط التلقائي',
            icon: <Bot className="h-4 w-4" />,
            galaxyId: 'gal_ai_brain_quota',
            capsuleId: 'sec_ai_assistant_cap',
          },
        ],
        galaxies: [
          {
            id: 'gal_ai_brain_quota',
            title: 'معمارية النماذج والتوجيه من الأقوى للأضعف',
            subtitle: 'تخصيص كل مهمة بالنموذج الأقوى والاحتياطي المباشر مع بقاء Morrow المحلي مرجعاً أخيراً',
            icon: <Cpu className="h-5 w-5" />,
            subAxes: [
              {
                id: 'sec_ai_assistant_cap',
                title: 'استوديو النماذج والتوجيه والحصة',
                subtitle: 'توجيه المهام، سجل القوة، الربط الجذري، والأوفلاين',
                badgeText: assistantSettings.onlineDisabled
                  ? 'أوفلاين 100%'
                  : `${assistantQuotaInfo?.dailyUsed ?? 0}/${assistantSettings.dailyRequestLimit}`,
                icon: <Cpu className="h-4 w-4" />,
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
        metaText: `تذكير ${relationsPrefs.defaultReminderLeadDays} أيام`,
        icon: <ListChecks className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_export_fmt',
            label: 'Excel / PDF',
            hint: 'صيغ التصدير المفضلة للقوائم',
            icon: <FileSpreadsheet className="h-4 w-4" />,
            galaxyId: 'gal_rel_export',
            capsuleId: 'rel_export_cap',
          },
          {
            id: 'sub_share',
            label: 'مشاركة',
            hint: 'تصدير الصور والنصوص الجاهزة',
            icon: <Share2 className="h-4 w-4" />,
            galaxyId: 'gal_rel_export',
            capsuleId: 'rel_export_cap',
          },
          {
            id: 'sub_reminders',
            label: 'تذكيرات',
            hint: 'أيام التنبيه المسبق والتواريخ',
            icon: <Calendar className="h-4 w-4" />,
            galaxyId: 'gal_rel_followups',
            capsuleId: 'rel_reminders_cap',
          },
          {
            id: 'sub_relations',
            label: 'المتابعة',
            hint: 'بادئة التسليم والعلاقات',
            icon: <HeartHandshake className="h-4 w-4" />,
            galaxyId: 'gal_rel_followups',
            capsuleId: 'rel_reminders_cap',
          },
        ],
        galaxies: [
          {
            id: 'gal_rel_export',
            title: 'التصدير والتحديث التلقائي',
            subtitle: 'تحديد صيغة الإخراج المفضلة (Excel / PDF / صورة / نص)',
            icon: <FileSpreadsheet className="h-5 w-5" />,
            subAxes: [
              {
                id: 'rel_export_cap',
                title: 'صيغ التصدير وتاريخ القوائم',
                subtitle: 'افتراضيات التصدير وتحديث التاريخ التلقائي',
                icon: <FileSpreadsheet className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_rel_followups',
            title: 'تنبيهات التذكير والتوصيل',
            subtitle: 'أيام التنبيه المسبق وبادئة ملاحظات التسليم الافتراضية',
            icon: <HeartHandshake className="h-5 w-5" />,
            subAxes: [
              {
                id: 'rel_reminders_cap',
                title: 'التذكيرات وبادئة التوصيل',
                subtitle: 'تفعيل الإشعارات وأيام التنبيه المسبق',
                badgeText: `${relationsPrefs.defaultReminderLeadDays} أيام`,
                icon: <HeartHandshake className="h-4 w-4" />,
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
        metaText: `${securityPrefs.privacyLocked ? 'مقفول' : 'آمن'} · ${recycleBin.length} بالمهملات`,
        icon: <Shield className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_pin',
            label: 'قفل PIN',
            hint: 'تعيين رمز الحماية والقفل الفوري',
            icon: <Lock className="h-4 w-4" />,
            galaxyId: 'gal_sec_lock_sync',
            capsuleId: 'sec_privacy_lock_cap',
          },
          {
            id: 'sub_cloud',
            label: 'المزامنة',
            hint: 'الربط السحابي وحفظ النسخ',
            icon: <CloudUpload className="h-4 w-4" />,
            galaxyId: 'gal_sec_lock_sync',
            capsuleId: 'sec_cloud_sync_cap',
          },
          {
            id: 'sub_json',
            label: 'نسخة JSON',
            hint: 'تصدير واستيراد البيانات الكاملة',
            icon: <FileJson className="h-4 w-4" />,
            galaxyId: 'gal_sec_backup_recycle',
            capsuleId: 'sec_backup_json_cap',
          },
          {
            id: 'sub_recycle',
            label: 'الاسترجاع',
            hint: 'استعادة المحذوفات بأمان',
            icon: <RotateCcw className="h-4 w-4" />,
            galaxyId: 'gal_sec_backup_recycle',
            capsuleId: 'sec_recycle_bin_cap',
          },
        ],
        galaxies: [
          {
            id: 'gal_sec_lock_sync',
            title: 'الحماية والقفل والمزامنة السحابية',
            subtitle: 'حماية الشاشة برمز PIN والربط السحابي بالحساب',
            icon: <Lock className="h-5 w-5" />,
            subAxes: [
              {
                id: 'sec_privacy_lock_cap',
                title: 'قفل الخصوصية (PIN)',
                subtitle: 'تعيين رمز الحماية والقفل الفوري للشاشة',
                badgeText: securityPrefs.privacyLocked ? 'مقفول' : 'آمن',
                icon: <Lock className="h-4 w-4" />,
              },
              {
                id: 'sec_cloud_sync_cap',
                title: 'الحساب والمزامنة السحابية',
                subtitle: 'حفظ واسترجاع نسخة البيانات على الخادم',
                badgeText: authUser ? 'متصل' : 'محلي',
                icon: <CloudUpload className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_sec_backup_recycle',
            title: 'النسخ الاحتياطي وسلة الاسترجاع الآمنة',
            subtitle: 'تصدير/استيراد JSON وخصوصية الأسماء واسترجاع السجلات المحذوفة',
            icon: <FileJson className="h-5 w-5" />,
            subAxes: [
              {
                id: 'sec_backup_json_cap',
                title: 'النسخ الاحتياطي (JSON) والخصوصية',
                subtitle: 'تنزيل واستيراد الملفات وإرسال الأسماء للسحابة',
                icon: <FileJson className="h-4 w-4" />,
              },
              {
                id: 'sec_recycle_bin_cap',
                title: 'سلة الاسترجاع الآمنة',
                subtitle: 'استعادة الأسماء والقوائم والمصاريف المحذوفة',
                badgeText: `${recycleBin.length} عنصر`,
                icon: <RotateCcw className="h-4 w-4" />,
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
        metaText:
          auditIssues.length > 0 ? `${auditIssues.length} ملاحظة تدقيق` : 'صحة السجلات 100%',
        icon: <Activity className="h-5 w-5" />,
        subIcons: [
          {
            id: 'sub_kpi',
            label: 'المؤشرات',
            hint: 'توزيع الأفراد والإيرادات حياً',
            icon: <BarChart3 className="h-4 w-4" />,
            galaxyId: 'gal_gov_health',
            capsuleId: 'cap_kpi_dashboard',
          },
          {
            id: 'sub_health',
            label: 'صحة البيانات',
            hint: 'فحص التكرارات وإصلاحها فوراً',
            icon: <HeartPulse className="h-4 w-4" />,
            galaxyId: 'gal_gov_health',
            capsuleId: 'cap_health_center',
          },
          {
            id: 'sub_inspector',
            label: 'الحوكمة',
            hint: 'فاحص السجل و Feature Flags',
            icon: <Compass className="h-4 w-4" />,
            galaxyId: 'gal_gov_registry',
            capsuleId: 'cap_registry_inspector',
          },
          {
            id: 'sub_legacy',
            label: 'الأرشيف',
            hint: 'أرشيف المفاتيح ولقطات الترحيل',
            icon: <Archive className="h-4 w-4" />,
            galaxyId: 'gal_gov_registry',
            capsuleId: 'cap_legacy_index',
          },
        ],
        galaxies: [
          {
            id: 'gal_gov_health',
            title: 'المؤشرات التنفيذية وصحة السجلات',
            subtitle: 'تشخيص وتصحيح المكررين والشواذ وتحليل الأداء الحقيقي',
            icon: <HeartPulse className="h-5 w-5" />,
            subAxes: [
              {
                id: 'cap_kpi_dashboard',
                title: 'لوحة المؤشرات التنفيذية (KPI)',
                subtitle: 'توزيع الأفراد والإيرادات والمصاريف حياً',
                icon: <BarChart3 className="h-4 w-4" />,
              },
              {
                id: 'cap_health_center',
                title: 'مركز صحة البيانات وإصلاح التضاربات',
                subtitle: 'فحص التكرارات وإصلاحها بنقرة واحدة',
                badgeText:
                  auditIssues.length > 0 ? `${auditIssues.length} ملاحظة` : 'سليم 100%',
                icon: <HeartPulse className="h-4 w-4" />,
              },
            ],
          },
          {
            id: 'gal_gov_registry',
            title: 'حوكمة النظام وأرشيف المفاتيح',
            subtitle: 'فاحص السجل و Feature Flags واستعادة لقطات ما قبل الترحيل',
            icon: <Compass className="h-5 w-5" />,
            subAxes: [
              {
                id: 'cap_registry_inspector',
                title: 'فاحص السجل و Feature Flags',
                subtitle: 'التحقق من سلامة الأقسام والميزات الجديدة',
                icon: <Compass className="h-4 w-4" />,
              },
              {
                id: 'cap_legacy_index',
                title: 'الأرشيف الشامل للمفاتيح (0 حذف)',
                subtitle: 'فهرس الإعدادات الكلاسيكية ولقطات الترحيل',
                icon: <Archive className="h-4 w-4" />,
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
      expertTableConfig.allowDirectNoConfirmEdit,
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
            trailLabel: `قسم رئيسي (${sec.galaxies.length} أقسام فرعية)`,
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
              trailLabel: `${sec.title} ◂ قسم فرعي`,
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
    if (galaxy.subAxes.length <= 1) {
      setCapsuleId(galaxy.subAxes[0]?.id || null);
    } else {
      setCapsuleId(null);
    }
  };

  const resolvedSubAxisSpec = useMemo(() => {
    if (!activeGalaxySpec || !currentCapsuleId) return null;
    return (
      activeGalaxySpec.subAxes.find((sa) => sa.id === currentCapsuleId) || null
    );
  }, [activeGalaxySpec, currentCapsuleId]);

  const handleStepBack = () => {
    if (currentScreenMode === 'hub') {
      onBackToApp();
      return;
    }
    if (currentCapsuleId && activeGalaxySpec && activeGalaxySpec.subAxes.length > 1) {
      setCapsuleId(null);
      setSelectedGalaxyId(activeGalaxySpec.id);
      return;
    }
    if (activeGalaxySpec) {
      setSelectedGalaxyId(null);
      setCapsuleId(null);
      return;
    }
    setScreenMode('hub');
    setSelectedGalaxyId(null);
    setCapsuleId(null);
  };

  const cycleQuickTableTheme = () => {
    const idx = TABLE_THEMES.findIndex((t) => t.id === activeTableObj.id);
    const next = TABLE_THEMES[(idx + 1) % TABLE_THEMES.length] || TABLE_THEMES[0];
    onUpdateThemePrefs({ tableTheme: next.id, activeProfileId: null });
    notifySuccess(`تم تبديل محرك الجدول إلى: ${next.name}`);
  };

  const stepFontSize = (delta: number) => {
    const cur = themePrefs.fontSizePx ?? 15;
    const next = Math.max(12, Math.min(22, cur + delta));
    onUpdateThemePrefs({ fontSizePx: next });
    notifySuccess(`حجم الخط: ${next}px`);
  };

  const topBarContextKey = `${currentScreenMode}:${effectiveSectionId}:${activeGalaxySpec?.id || 'none'}:${currentCapsuleId || 'none'}`;

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
              جاري فتح الصفحة...
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

  const tabrixReducedMotion = useTabrixReducedMotion();
  const activeThemeName = useMemo(
    () => getAppThemeById(themePrefs.appTheme).name,
    [themePrefs.appTheme]
  );
  const settingsLevelDepth =
    currentScreenMode === 'hub'
      ? 0
      : !activeGalaxySpec
      ? 1
      : !resolvedSubAxisSpec && activeGalaxySpec.subAxes.length > 1
      ? 2
      : 3;
  const settingsTransitionKey =
    currentScreenMode === 'hub'
      ? 'hub'
      : !activeGalaxySpec
      ? `sec-${effectiveSectionId}`
      : !resolvedSubAxisSpec && activeGalaxySpec.subAxes.length > 1
      ? `gal-${activeGalaxySpec.id}`
      : `cap-${currentCapsuleId || activeGalaxySpec.subAxes[0]?.id || 'root'}`;
  const settingsTransitionTuple = useMemo(
    () => ({ depth: settingsLevelDepth, key: settingsTransitionKey }),
    [settingsLevelDepth, settingsTransitionKey]
  );
  const settingsHierarchyDir = useTabrixDirection(
    settingsTransitionTuple,
    (prev, next) => (next.depth >= prev.depth ? 1 : -1)
  );

  return (
    <div
      data-settings-display-mode={displayMode}
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      {/* 1. Slim State-Driven & Context-Smart Settings Top Bar */}
      <header
        data-testid="settings-floating-topbar"
        className="no-print nexus-glass-lite sticky top-0 z-30 border-b"
        style={{
          borderColor: 'var(--border-color)',
        }}
      >
        <div
          className={`flex h-12 flex-nowrap items-center justify-between gap-2 px-3 sm:px-5 ${containerMaxWidth}`}
        >
          {/* Start: State-Driven Back Navigation & Single-Line Hierarchical Title */}
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {currentScreenMode === 'hub' ? (
              <button
                type="button"
                onClick={onBackToApp}
                className="nexus-pill-btn inline-flex h-8 shrink-0 items-center gap-1.5 px-3 text-xs font-extrabold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                <span>العودة للتطبيق</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStepBack}
                  className="nexus-pill-btn inline-flex h-8 shrink-0 items-center gap-1 border px-3 text-xs font-extrabold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span>رجوع</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToApp}
                  title="العودة للتطبيق"
                  aria-label="العودة للتطبيق"
                  className="nexus-pill-btn inline-flex h-8 w-8 shrink-0 items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Home className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            <motion.nav
              aria-label="مسار الإعدادات"
              key={`nav-${topBarContextKey}`}
              variants={
                tabrixReducedMotion
                  ? TABRIX_REDUCED_VARIANTS
                  : TABRIX_POPOVER_VARIANTS
              }
              initial="initial"
              animate="animate"
              className={`flex min-w-0 items-center gap-1 text-xs ${
                settingsSearchOpen ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setScreenMode('hub');
                  setSelectedGalaxyId(null);
                  setCapsuleId(null);
                }}
                className={`rounded-lg px-1.5 py-1 font-extrabold whitespace-nowrap transition-colors hover:bg-[var(--bg-main)] ${
                  currentScreenMode === 'detail' ? 'hidden md:inline-flex' : 'inline-flex'
                }`}
                style={{
                  color:
                    currentScreenMode === 'hub'
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                }}
              >
                الإعدادات
              </button>

              {currentScreenMode === 'hub' && !settingsSearchOpen && (
                <span
                  className="hidden lg:inline truncate max-w-[160px] text-[11px] font-semibold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  · {activeThemeObj.name}
                </span>
              )}

              {currentScreenMode === 'detail' && (
                <>
                  <ChevronLeft
                    className="hidden md:inline h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGalaxyId(null);
                      setCapsuleId(null);
                    }}
                    className={`truncate rounded-lg px-1.5 py-1 font-bold transition-colors hover:bg-[var(--bg-main)] ${
                      activeGalaxySpec
                        ? 'hidden sm:inline max-w-[120px]'
                        : 'max-w-[170px] sm:max-w-[240px]'
                    }`}
                    style={{
                      color: activeGalaxySpec
                        ? 'var(--text-muted)'
                        : 'var(--accent)',
                    }}
                    title={currentSectionSpec.title}
                  >
                    {currentSectionSpec.title}
                  </button>
                </>
              )}

              {currentScreenMode === 'detail' && activeGalaxySpec && (
                <>
                  <ChevronLeft
                    className="hidden sm:inline h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (activeGalaxySpec.subAxes.length > 1) {
                        setSelectedGalaxyId(activeGalaxySpec.id);
                        setCapsuleId(null);
                      }
                    }}
                    className={`truncate rounded-lg px-1.5 py-1 font-bold transition-colors hover:bg-[var(--bg-main)] ${
                      resolvedSubAxisSpec
                        ? 'hidden lg:inline max-w-[140px]'
                        : 'max-w-[170px] sm:max-w-[240px]'
                    }`}
                    style={{
                      color: resolvedSubAxisSpec
                        ? 'var(--text-muted)'
                        : 'var(--accent)',
                    }}
                    title={activeGalaxySpec.title}
                  >
                    {activeGalaxySpec.title}
                  </button>
                </>
              )}

              {currentScreenMode === 'detail' && resolvedSubAxisSpec && (
                <>
                  <ChevronLeft
                    className="hidden lg:inline h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <span
                    className="truncate max-w-[160px] sm:max-w-[230px] rounded-lg px-1.5 py-1 font-extrabold"
                    style={{ color: 'var(--accent)' }}
                    title={resolvedSubAxisSpec.title}
                  >
                    {resolvedSubAxisSpec.title}
                  </span>
                </>
              )}
            </motion.nav>
          </div>

          {/* Center: Expandable On-Demand Settings Search */}
          <div
            ref={settingsSearchWrapRef}
            className={`relative ${settingsSearchOpen ? 'flex-1 max-w-md min-w-[150px]' : 'hidden'}`}
          >
            <AnimatePresence initial={false}>
              {settingsSearchOpen && (
                <motion.div
                  key="settings-search-input-box"
                  variants={
                    tabrixReducedMotion
                      ? TABRIX_REDUCED_VARIANTS
                      : TABRIX_POPOVER_VARIANTS
                  }
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex h-8 items-center gap-2 rounded-xl border px-2.5 transition-colors focus-within:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--accent)',
                    transformOrigin: 'top center',
                  }}
                >
                  <Search
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--accent)' }}
                  />
                  <input
                    ref={settingsSearchInputRef}
                    type="search"
                    value={settingsSearch}
                    onChange={(e) => setSettingsSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && deepSearchHits.length > 0) {
                        deepSearchHits[0].onOpen();
                      }
                    }}
                    placeholder="بحث في الإعدادات والأدوات..."
                    aria-label="بحث في الإعدادات"
                    className="w-full bg-transparent text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsSearch('');
                      setSettingsSearchOpen(false);
                    }}
                    aria-label="إغلاق البحث"
                    className="p-0.5 rounded hover:bg-[var(--bg-surface)]"
                  >
                    <X className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {settingsSearchOpen && settingsSearch.trim() && (
                <motion.div
                  key="settings-search-popover"
                  variants={
                    tabrixReducedMotion
                      ? TABRIX_REDUCED_VARIANTS
                      : TABRIX_POPOVER_VARIANTS
                  }
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="smoked-glass-elevated absolute inset-x-0 top-full z-50 mt-2 max-h-[360px] overflow-y-auto rounded-2xl border p-2 shadow-xl space-y-1"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    transformOrigin: 'top center',
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
                        onClick={() => {
                          setSettingsSearchOpen(false);
                          hit.onOpen();
                        }}
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* End: Max 2-3 Context-Smart Controls + Expandable Search Trigger */}
          <motion.div
            key={topBarContextKey}
            variants={
              tabrixReducedMotion
                ? TABRIX_REDUCED_VARIANTS
                : TABRIX_POPOVER_VARIANTS
            }
            initial="initial"
            animate="animate"
            className="flex shrink-0 items-center gap-1.5"
          >
            {!settingsSearchOpen && (
              <button
                type="button"
                onClick={() => {
                  setSettingsSearchOpen(true);
                  setTimeout(() => settingsSearchInputRef.current?.focus(), 20);
                }}
                aria-label="بحث في الإعدادات"
                title="بحث في الإعدادات"
                className="nexus-pill-btn inline-flex h-8 w-8 shrink-0 items-center justify-center border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Dynamic Screen-Specific Action (1 compact control per context) */}
            {currentScreenMode === 'detail' && effectiveSectionId === 'appearance' && (
              <button
                type="button"
                onClick={cycleQuickTableTheme}
                title="تبديل تصميم الجدول مباشرة"
                className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border-color))',
                  color: 'var(--accent)',
                }}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[115px] truncate">{activeTableObj.name}</span>
              </button>
            )}

            {currentScreenMode === 'detail' && effectiveSectionId === 'fonts' && (
              <div
                className="hidden sm:inline-flex h-8 items-center gap-0.5 rounded-xl border px-1 text-xs font-bold tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => stepFontSize(-1)}
                  aria-label="تصغير الخط"
                  className="rounded-lg px-1.5 py-0.5 hover:bg-[var(--bg-surface)]"
                >
                  A-
                </button>
                <span className="px-1 text-[11px]" style={{ color: 'var(--accent)' }}>
                  {themePrefs.fontSizePx ?? 15}px
                </span>
                <button
                  type="button"
                  onClick={() => stepFontSize(1)}
                  aria-label="تكبير الخط"
                  className="rounded-lg px-1.5 py-0.5 hover:bg-[var(--bg-surface)]"
                >
                  A+
                </button>
              </div>
            )}

            {currentScreenMode === 'detail' && effectiveSectionId === 'modes' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedGalaxyId('gal_modes_expert');
                  setCapsuleId('modes_expert_cap');
                }}
                className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border-color))',
                  color: 'var(--accent)',
                }}
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span>الفئات والأعمدة</span>
              </button>
            )}

            {currentScreenMode === 'detail' &&
              effectiveSectionId === 'calculator' &&
              onNavigateAppView && (
                <button
                  type="button"
                  onClick={() => onNavigateAppView('finance')}
                  className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border-color))',
                    color: 'var(--accent)',
                  }}
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>فتح المالية</span>
                </button>
              )}

            {currentScreenMode === 'detail' &&
              effectiveSectionId === 'quick_extract_settings' &&
              onNavigateAppView && (
                <button
                  type="button"
                  onClick={() => onNavigateAppView('quick_extract')}
                  className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border-color))',
                    color: 'var(--accent)',
                  }}
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  <span>السحب الذكي</span>
                </button>
              )}

            {currentScreenMode === 'detail' &&
              effectiveSectionId === 'ai_assistant' &&
              onNavigateAppView && (
                <button
                  type="button"
                  onClick={() => onNavigateAppView('morrow_center')}
                  className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border-color))',
                    color: 'var(--accent)',
                  }}
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>فتح Morrow</span>
                </button>
              )}

            {currentScreenMode === 'detail' &&
              effectiveSectionId === 'relations_lists' &&
              onNavigateAppView && (
                <button
                  type="button"
                  onClick={() => onNavigateAppView('ready_lists')}
                  className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border-color))',
                    color: 'var(--accent)',
                  }}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>القوائم</span>
                </button>
              )}

            {currentScreenMode === 'detail' && effectiveSectionId === 'security_data' && (
              <button
                type="button"
                onClick={() => onUpdateSecurityPrefs({ privacyLocked: true })}
                className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Lock className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>قفل فوري</span>
              </button>
            )}

            {currentScreenMode === 'detail' &&
              effectiveSectionId === 'system_map' &&
              onRunAutoFix && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await onRunAutoFix();
                    notifySuccess(
                      res.fixedCount > 0
                        ? `تم إصلاح ${res.fixedCount} ملاحظة بنجاح.`
                        : 'جميع السجلات سليمة ولا تحتاج إصلاحاً.'
                    );
                  }}
                  className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border-color))',
                    color: 'var(--accent)',
                  }}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>فحص وإصلاح</span>
                </button>
              )}

            {(currentScreenMode === 'hub' || effectiveSectionId === 'general') && (
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
                title={displayMode === 'fullscreen' ? 'عرض مدمج' : 'عرض ممتد'}
                aria-label="تبديل حجم صفحة الإعدادات"
                className="hidden sm:inline-flex h-8 items-center gap-1 rounded-xl border px-2 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
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
              </button>
            )}
          </motion.div>
        </div>
      </header>

      {/* Inline Toast Notifications */}
      <AnimatePresence>
        {(feedback || errorFeedback) && (
          <motion.div
            key={errorFeedback || feedback}
            initial={tabrixReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={tabrixReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: tabrixReducedMotion ? 0.05 : 0.2 }}
            className={`w-full px-4 pt-4 sm:px-6 ${containerMaxWidth}`}
          >
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"
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
          </motion.div>
        )}
      </AnimatePresence>

      <TabrixSubViewTransition
        viewKey={settingsTransitionKey}
        direction={settingsHierarchyDir}
        className="flex-1 flex flex-col"
      >
      {/* ─── LEVEL 1: SETTINGS HUB (الأقسام الرئيسية ببطاقات حية ذكية) ──────── */}
      {currentScreenMode === 'hub' && (
        <main
          data-testid="settings-sections-hub"
          className={`w-full flex-1 space-y-6 px-4 py-6 pb-16 sm:px-6 ${containerMaxWidth}`}
        >
          {/* Executive Settings Identity Strip */}
          <section className="nexus-squircle p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <NexusDuotoneIcon sizeClass="h-11 w-11">
                  <Compass className="h-5 w-5" />
                </NexusDuotoneIcon>
                <div className="space-y-1">
                  <h1 className="text-xl font-black sm:text-2xl">
                    مركز الإعدادات المتقدم
                  </h1>
                  <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                    اختر أي قسم أو أيقونة أداة للدخول إلى صفحتها المستقلة بالكامل مع بقاء مسار العودة متصلاً.
                  </p>
                </div>
              </div>

              {/* Clean Live Environment Summary */}
              <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    الهوية والخط
                  </div>
                  <div className="font-extrabold">
                    {activeThemeName} · {activeFontObj.name}
                  </div>
                </div>
                <div
                  className="h-7 w-px hidden sm:block"
                  style={{ backgroundColor: 'var(--border-color)' }}
                  aria-hidden="true"
                />
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
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
            <div
              className="mt-5 flex flex-wrap items-center gap-1.5 border-t pt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {(
                [
                  ['all', `جميع الأقسام (${sectionSpecs.length})`],
                  ['visual', 'المظهر والخطوط'],
                  ['permissions', 'الواجهة والتحرير'],
                  ['operations', 'الحاسبة والسحب والذكاء'],
                  ['security', 'الأمان والصحة والحوكمة'],
                ] as Array<[DomainCategory, string]>
              ).map(([cat, label]) => {
                const active = domainFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDomainFilter(cat)}
                    className="nexus-pill-btn relative min-h-[36px] overflow-hidden border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'transparent' : 'var(--bg-main)',
                      borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {active && (
                      <motion.span
                        layoutId="settings-domain-pill"
                        transition={tabrixReducedMotion ? { duration: 0.05 } : TABRIX_SPRING}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{ backgroundColor: 'var(--bg-nav-active)' }}
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Smart Living Section Cards Grid */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredSections.map((sec) => {
              const cardSubIcons: SmartSubIconItem[] = sec.subIcons.map((sub) => ({
                id: sub.id,
                label: sub.label,
                hint: sub.hint,
                icon: sub.icon,
                onClick: () =>
                  openSection(sec.id, sub.galaxyId ?? null, sub.capsuleId ?? null),
              }));

              return (
                <SmartLivingSectionCard
                  key={sec.id}
                  testId={`settings-section-card-${sec.id}`}
                  title={sec.title}
                  subtitle={sec.subtitle}
                  icon={sec.icon}
                  subIcons={cardSubIcons}
                  actionLabel="فتح القسم"
                  onOpen={() => openSection(sec.id, null, null)}
                />
              );
            })}
          </section>
        </main>
      )}

      {/* ─── LEVEL 2: ISOLATED SECTION PAGE (الأقسام الفرعية فقط) ─────────────── */}
      {currentScreenMode === 'detail' && !activeGalaxySpec && (
        <main
          key={`sec-${effectiveSectionId}`}
          data-testid={`settings-detail-${effectiveSectionId}`}
          className={`w-full flex-1 space-y-6 px-4 py-6 pb-16 sm:px-6 ${containerMaxWidth}`}
        >
          {/* Section Banner */}
          <section className="nexus-squircle flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-start gap-3.5">
              <NexusDuotoneIcon sizeClass="h-12 w-12">
                {currentSectionSpec.icon}
              </NexusDuotoneIcon>
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
              className="nexus-pill-btn inline-flex min-h-[40px] items-center gap-1.5 border px-4 py-2 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>جميع الأقسام</span>
            </button>
          </section>

          {/* Sub-sections Grid */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {currentSectionSpec.galaxies.map((gal) => {
              const galSubIcons: SmartSubIconItem[] = gal.subAxes.map((sa) => ({
                id: sa.id,
                label: sa.title,
                hint: sa.subtitle,
                icon: sa.icon || <Sparkles className="h-4 w-4" />,
                onClick: () => {
                  setSelectedGalaxyId(gal.id);
                  setCapsuleId(sa.id);
                },
              }));

              return (
                <SmartLivingSectionCard
                  key={gal.id}
                  testId={`settings-galaxy-card-${gal.id}`}
                  title={gal.title}
                  subtitle={gal.subtitle}
                  icon={gal.icon || currentSectionSpec.icon}
                  subIcons={galSubIcons}
                  actionLabel={
                    gal.subAxes.length === 1
                      ? `فتح ${gal.subAxes[0].title}`
                      : 'فتح القسم الفرعي'
                  }
                  onOpen={() => handleOpenGalaxy(gal)}
                />
              );
            })}
          </section>
        </main>
      )}

      {/* ─── LEVEL 3: ISOLATED SUB-SECTION PAGE ───────────────────────────────── */}
      {currentScreenMode === 'detail' &&
        activeGalaxySpec &&
        !resolvedSubAxisSpec &&
        activeGalaxySpec.subAxes.length > 1 && (
          <main
            key={`gal-${activeGalaxySpec.id}`}
            data-testid={`settings-detail-${effectiveSectionId}`}
            className={`w-full flex-1 space-y-6 px-4 py-6 pb-16 sm:px-6 ${containerMaxWidth}`}
          >
            <section className="nexus-squircle flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div className="flex items-start gap-3.5">
                <NexusDuotoneIcon sizeClass="h-12 w-12">
                  {activeGalaxySpec.icon || currentSectionSpec.icon}
                </NexusDuotoneIcon>
                <div>
                  <div className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
                    {currentSectionSpec.title} · {activeGalaxySpec.subAxes.length} أدوات
                  </div>
                  <h1 className="text-xl font-black">{activeGalaxySpec.title}</h1>
                  <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                    {activeGalaxySpec.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedGalaxyId(null);
                  setCapsuleId(null);
                }}
                className="nexus-pill-btn inline-flex min-h-[40px] items-center gap-1.5 border px-4 py-2 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>العودة إلى {currentSectionSpec.title}</span>
              </button>
            </section>

            <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {activeGalaxySpec.subAxes.map((sa) => (
                <SmartLivingSectionCard
                  key={sa.id}
                  testId={`settings-subaxis-card-${sa.id}`}
                  title={sa.title}
                  subtitle={sa.subtitle}
                  icon={sa.icon || activeGalaxySpec.icon || currentSectionSpec.icon}
                  subIcons={[]}
                  actionLabel={`فتح ${sa.title}`}
                  onOpen={() => {
                    setSelectedGalaxyId(activeGalaxySpec.id);
                    setCapsuleId(sa.id);
                  }}
                />
              ))}
            </section>
          </main>
        )}

      {/* ─── LEVEL 4: ISOLATED TOOL PAGE ─────────────────────────────────────── */}
      {currentScreenMode === 'detail' &&
        activeGalaxySpec &&
        (resolvedSubAxisSpec || activeGalaxySpec.subAxes.length <= 1) && (
          <main
            key={`cap-${currentCapsuleId || activeGalaxySpec.subAxes[0]?.id}`}
            data-testid={`settings-detail-${effectiveSectionId}`}
            className={`w-full flex-1 space-y-5 px-4 py-6 pb-16 sm:px-6 ${containerMaxWidth}`}
          >
            {/* Connected Sub-Axis Header & Quick Sibling Switcher */}
            <section className="nexus-squircle p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
                    {currentSectionSpec.title} · {activeGalaxySpec.title}
                  </div>
                  <h1 className="text-base font-black sm:text-lg">
                    {resolvedSubAxisSpec?.title || activeGalaxySpec.title}
                  </h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {resolvedSubAxisSpec?.subtitle || activeGalaxySpec.subtitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeGalaxySpec.subAxes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGalaxyId(activeGalaxySpec.id);
                        setCapsuleId(null);
                      }}
                      className="nexus-pill-btn inline-flex min-h-[38px] items-center gap-1.5 border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>أدوات القسم</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGalaxyId(null);
                      setCapsuleId(null);
                    }}
                    className="nexus-pill-btn inline-flex min-h-[38px] items-center gap-1.5 border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>أقسام {currentSectionSpec.title}</span>
                  </button>
                </div>
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
                        className="nexus-pill-btn relative inline-flex min-h-[36px] items-center gap-2 overflow-hidden border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: isActive ? 'transparent' : 'var(--bg-main)',
                          borderColor: isActive
                            ? 'var(--accent)'
                            : 'var(--border-color)',
                          color: isActive ? 'var(--accent-fg)' : 'var(--text-primary)',
                        }}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="settings-sibling-capsule-pill"
                            transition={
                              tabrixReducedMotion ? { duration: 0.05 } : TABRIX_SPRING
                            }
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-full"
                            style={{ backgroundColor: 'var(--accent)' }}
                          />
                        )}
                        <span className="relative z-10">{sa.title}</span>
                        {sa.badgeText && (
                          <span className="relative z-10 text-[10px] opacity-85 tabular-nums">
                            · {sa.badgeText}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Isolated Deep Capsule Workspace */}
            <div>
              {renderCapsuleWorkspace(
                currentCapsuleId || activeGalaxySpec.subAxes[0]?.id || ''
              )}
            </div>
          </main>
        )}
      </TabrixSubViewTransition>
    </div>
  );
};
