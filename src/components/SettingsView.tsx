import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowRight,
  Command,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Moon,
  Search,
  Sliders,
  Sun,
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
  flattenCosmosNodes,
  getCosmosNodeById,
  getCosmosWorldById,
  mapSettingsSectionToWorldId,
  type CosmosNode,
} from '../utils/cosmosRegistry';
import {
  buildMorrowHierarchyTree,
  getHierarchyNodeById,
  getHierarchyPath,
  getSettingsSectionNodeId,
  resolveHierarchyNodeBadge,
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
import { GalaxyCard } from './cosmos/GalaxyCard';
import { QuickHome } from './cosmos/QuickHome';
import { WorldShell, type WorldSubTab } from './cosmos/WorldShell';
import { CapsuleBreadcrumb } from './settings/CapsuleBreadcrumb';
import { NodeCard } from './settings/NodeCard';
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

const SECTION_GROUPS: Array<{
  id: SettingsSectionId;
  group: 'experience' | 'operations';
}> = [
  { id: 'appearance', group: 'experience' },
  { id: 'fonts', group: 'experience' },
  { id: 'general', group: 'experience' },
  { id: 'modes', group: 'experience' },
  { id: 'calculator', group: 'operations' },
  { id: 'quick_extract_settings', group: 'operations' },
  { id: 'relations_lists', group: 'operations' },
  { id: 'security_data', group: 'operations' },
];

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
  onNavigateHierarchyTarget,
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
  hierarchyBar,
  workspaceCosmos,
  rootCosmos,
  migrationSnapshot,
  onUpdateAccessibilityPrefs,
  onUpdateFeatureFlags,
  onUpdateCosmosExperienceMode,
  onTogglePinnedNode,
  onSaveCustomTheme,
  onDeleteCustomTheme,
  onToggleHiddenWorld,
  onRestoreMigrationSnapshot,
  onAppendChangeLog,
  onRunAutoFix,
  onOpenWorldSwitcher,
  onSelectCosmosNode,
}) => {
  const [feedback, setFeedback] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');
  const [localScreenMode, setLocalScreenMode] = useState<'hub' | 'detail'>(
    'hub'
  );
  const [localCapsuleId, setLocalCapsuleId] = useState<string | null>(null);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [worldTab, setWorldTab] = useState<WorldSubTab>('galaxies');
  const [localExperienceMode, setLocalExperienceMode] =
    useState<CosmosExperienceMode>('simple');

  const currentScreenMode = screenMode ?? localScreenMode;
  const setScreenMode = onChangeScreenMode ?? setLocalScreenMode;
  const currentCapsuleId =
    activeCapsuleId !== undefined ? activeCapsuleId : localCapsuleId;
  const setCapsuleId = onChangeCapsuleId ?? setLocalCapsuleId;

  const resolvedCosmosRoot = useMemo(
    () => rootCosmos || buildCosmosRegistry(state.agencies),
    [rootCosmos, state.agencies]
  );

  const effectiveWorkspaceCosmos: WorkspaceCosmosState = useMemo(
    () => workspaceCosmos || state.workspaceCosmos || DEFAULT_WORKSPACE_COSMOS,
    [workspaceCosmos, state.workspaceCosmos]
  );

  const activeWorldId: CosmosWorldId = useMemo(() => {
    if (
      currentCapsuleId === 'cap_kpi_dashboard' ||
      currentCapsuleId === 'cap_health_center' ||
      currentCapsuleId === 'cap_registry_inspector'
    ) {
      return 'world_health_kpi';
    }
    if (currentCapsuleId === 'cap_legacy_index') {
      return 'world_legacy_archive';
    }
    if (currentCapsuleId === 'cap_fonts_locale') {
      return 'world_fonts_typography';
    }
    if (currentCapsuleId === 'cap_access_ergonomics') {
      return 'world_general_access';
    }
    return mapSettingsSectionToWorldId(activeSection);
  }, [currentCapsuleId, activeSection]);

  const activeWorldNode = useMemo(
    () =>
      getCosmosWorldById(resolvedCosmosRoot, activeWorldId) ||
      resolvedCosmosRoot.children[0],
    [resolvedCosmosRoot, activeWorldId]
  );

  const auditIssues = useMemo(
    () => auditAgencyPersons(state.persons),
    [state.persons]
  );

  const worldHealthPercent = useMemo(() => {
    if (activeWorldId === 'world_health_kpi') {
      return Math.max(25, Math.min(100, 100 - auditIssues.length * 8));
    }
    if (activeWorldId === 'world_security_backup') {
      return securityPrefs.privacyPin ? 100 : 84;
    }
    if (activeWorldId === 'world_calculator') {
      return calculationSettings.feePerIndividualIqd > 0 ? 100 : 75;
    }
    return 100;
  }, [
    activeWorldId,
    auditIssues.length,
    securityPrefs.privacyPin,
    calculationSettings.feePerIndividualIqd,
  ]);

  const quickWorldNodes = useMemo(() => {
    const all = flattenCosmosNodes(activeWorldNode);
    const preferredIds = activeWorldNode.quickItems || [];
    const preferred = preferredIds
      .map((id) => getCosmosNodeById(resolvedCosmosRoot, id))
      .filter((n): n is CosmosNode => Boolean(n));
    if (preferred.length > 0) return preferred;
    return all.filter((n) => n.nodeType === 'capsule').slice(0, 6);
  }, [activeWorldNode, resolvedCosmosRoot]);

  const favoriteWorldNodes = useMemo(() => {
    const allInWorld = flattenCosmosNodes(activeWorldNode);
    return allInWorld.filter((n) =>
      effectiveWorkspaceCosmos.pinnedNodeIds.includes(n.id)
    );
  }, [activeWorldNode, effectiveWorkspaceCosmos.pinnedNodeIds]);

  const activePeriodLabel = state.activePeriod?.quotaName || 'الحصة الجارية';

  const displayMode: 'fullscreen' | 'contained' =
    generalPrefs.settingsDisplayMode === 'contained'
      ? 'contained'
      : 'fullscreen';

  const resolvedTree = useMemo(
    () => hierarchyTree || buildMorrowHierarchyTree(state.agencies),
    [hierarchyTree, state.agencies]
  );

  const activeThemeObj = useMemo(() => {
    const id = resolveAppThemeId(themePrefs.appTheme);
    return ALL_APP_THEMES.find((t) => t.id === id) || ALL_APP_THEMES[4];
  }, [themePrefs.appTheme]);

  const activeTableThemeObj = useMemo(() => {
    const id = resolveTableThemeId(themePrefs.tableTheme);
    return TABLE_THEMES.find((t) => t.id === id) || TABLE_THEMES[0];
  }, [themePrefs.tableTheme]);

  const activeFontName =
    ARABIC_FONTS.find((f) => f.id === themePrefs.fontFamily)?.name || 'Cairo';

  const shortModeLabel =
    modeTier === 'beginner'
      ? 'الوضع المبتدئ'
      : modeTier === 'intermediate'
      ? 'الوضع المتوسط'
      : modeTier === 'professional'
      ? 'الوضع المحترف'
      : 'وضع الخبير';

  const resolvedBadgeContext = useMemo<HierarchyBadgeContext>(
    () =>
      badgeContext || {
        agenciesCount: state.agencies.length,
        personsCount: state.persons.length,
        auditIssuesCount: 0,
        readyListsCount: state.readyLists.length,
        relationsCount: state.relations.length,
        archivesCount: state.monthlyArchives?.length ?? 0,
        pendingDraftsCount: 0,
        recycleBinCount: recycleBin.length,
        activeThemeName: activeThemeObj.name,
        activeTableThemeName: activeTableThemeObj.name,
        activeFontName,
        fontSizePx: themePrefs.fontSizePx ?? 15,
        modeLabel: shortModeLabel,
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
      state.readyLists.length,
      state.relations.length,
      state.monthlyArchives,
      recycleBin.length,
      activeThemeObj.name,
      activeTableThemeObj.name,
      activeFontName,
      themePrefs.fontSizePx,
      themePrefs.savedProfiles,
      shortModeLabel,
      calculationSettings.feePerIndividualIqd,
      calculationSettings.kgPerIndividual,
      displayMode,
      quickExtractPrefs.focusedFields.length,
      quickExtractPrefs.clarityThreshold,
      topBarConfig.autoFocus,
      securityPrefs.privacyLocked,
    ]
  );

  const sectionNodeId = getSettingsSectionNodeId(activeSection);
  const sectionNode = useMemo(
    () =>
      getHierarchyNodeById(resolvedTree, sectionNodeId) ||
      getHierarchyNodeById(resolvedTree, 'settings_appearance_node') ||
      resolvedTree,
    [resolvedTree, sectionNodeId]
  );

  const activeNode = useMemo(() => {
    if (currentScreenMode === 'hub') {
      return (
        getHierarchyNodeById(resolvedTree, 'settings_hub_node') || resolvedTree
      );
    }
    if (currentCapsuleId) {
      return (
        getHierarchyNodeById(resolvedTree, currentCapsuleId) || sectionNode
      );
    }
    return sectionNode;
  }, [resolvedTree, currentScreenMode, currentCapsuleId, sectionNode]);

  const activePath = useMemo(() => {
    const p = getHierarchyPath(resolvedTree, activeNode.id);
    return p.length > 0 ? p : [resolvedTree];
  }, [resolvedTree, activeNode.id]);

  // Spotlight & Scroll into view when jumping from deep search or Command Palette
  useEffect(() => {
    const targetId = spotlightNodeId || currentCapsuleId;
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-capsule-node-id="${targetId}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('assistant-spotlight-active');
        window.setTimeout(() => {
          el.classList.remove('assistant-spotlight-active');
        }, 2100);
      }
    }, 90);
    return () => window.clearTimeout(timer);
  }, [spotlightNodeId, currentCapsuleId, activeSection, currentScreenMode]);

  const notifySuccess = (msg: string) => {
    setErrorFeedback('');
    if (generalPrefs.showActionAlerts !== false) {
      setFeedback(msg);
    }
  };

  const notifyError = (msg: string) => {
    setFeedback('');
    setErrorFeedback(msg);
  };

  const openSectionCapsule = (
    sectionId: SettingsSectionId,
    capsuleId: string | null = null
  ) => {
    onChangeSection(sectionId);
    setCapsuleId(capsuleId);
    setScreenMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBreadcrumbNodeClick = (node: HierarchyNode) => {
    if (onNavigateHierarchyTarget) {
      onNavigateHierarchyTarget(node.target, node.id);
      return;
    }
    if (node.id === 'root') {
      onBackToApp();
      return;
    }
    if (node.id === 'settings_hub_node') {
      setCapsuleId(null);
      setScreenMode('hub');
      return;
    }
    if (node.target.view === 'settings') {
      if (node.target.settingsSection) {
        onChangeSection(node.target.settingsSection);
      }
      setCapsuleId(node.target.settingsCapsuleId ?? null);
      setScreenMode(node.target.settingsScreenMode ?? 'detail');
      return;
    }
    onBackToApp();
  };

  const handleStepBackInDetail = () => {
    const parent =
      activePath.length > 1 ? activePath[activePath.length - 2] : null;
    if (!parent || parent.id === 'root' || parent.id === 'settings_hub_node') {
      setCapsuleId(null);
      setScreenMode('hub');
      return;
    }
    handleBreadcrumbNodeClick(parent);
  };

  // Recursive deep search across all Level 3-5 settings capsules
  const deepSearchHits = useMemo(() => {
    const q = settingsSearch.trim();
    if (!q) return [];
    return searchHierarchyNodes(resolvedTree, q).filter(
      (hit) =>
        hit.node.target.view === 'settings' && hit.node.id !== 'settings_hub_node'
    );
  }, [resolvedTree, settingsSearch]);

  // All 8 Level 3 section nodes resolved cleanly from the central registry
  const sectionNodesWithGroup = useMemo(() => {
    return SECTION_GROUPS.map((item) => {
      const node = getHierarchyNodeById(
        resolvedTree,
        getSettingsSectionNodeId(item.id)
      );
      return {
        sectionId: item.id,
        group: item.group,
        node,
      };
    }).filter(
      (
        entry
      ): entry is {
        sectionId: SettingsSectionId;
        group: 'experience' | 'operations';
        node: HierarchyNode;
      } => Boolean(entry.node)
    );
  }, [resolvedTree]);

  const experienceNodes = sectionNodesWithGroup.filter(
    (s) => s.group === 'experience'
  );
  const operationsNodes = sectionNodesWithGroup.filter(
    (s) => s.group === 'operations'
  );

  // Live 5 × fee formula preview for Calculator Hub card & Hero
  const sampleFiveFeeTotal = 5 * calculationSettings.feePerIndividualIqd;

  const buildHubCardPreview = (sectionId: SettingsSectionId): React.ReactNode => {
    if (sectionId === 'appearance') {
      return (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {activeThemeObj.swatches.map((hex, idx) => (
              <span
                key={idx}
                className="h-3.5 w-5 rounded border"
                style={{
                  backgroundColor: hex,
                  borderColor: 'var(--border-color)',
                }}
              />
            ))}
          </div>
          <span className="truncate font-bold">{activeTableThemeObj.name}</span>
        </div>
      );
    }
    if (sectionId === 'fonts') {
      return (
        <div className="flex items-center justify-between font-bold tabular-nums">
          <span>خط {activeFontName}</span>
          <span style={{ color: 'var(--accent)' }}>
            {themePrefs.fontSizePx ?? 15}px
          </span>
        </div>
      );
    }
    if (sectionId === 'general') {
      return (
        <div className="flex items-center justify-between font-bold">
          <span>
            {displayMode === 'fullscreen' ? 'ملء الشاشة بالكامل' : 'عرض مدمج'}
          </span>
          <span style={{ color: 'var(--accent)' }}>
            {topBarConfig.autoFocus ? 'تركيز ذكي' : 'شريط ظاهر'}
          </span>
        </div>
      );
    }
    if (sectionId === 'modes') {
      return (
        <div className="flex items-center justify-between font-bold tabular-nums">
          <span>{shortModeLabel}</span>
          <span style={{ color: 'var(--accent)' }}>
            {expertTableConfig.customCategories.length} فئات
          </span>
        </div>
      );
    }
    if (sectionId === 'calculator') {
      return (
        <div className="flex items-center justify-between font-extrabold tabular-nums">
          <span>
            5 × {calculationSettings.feePerIndividualIqd} ={' '}
            {formatIqd(sampleFiveFeeTotal)}
          </span>
          <span style={{ color: 'var(--success)' }}>
            {calculationSettings.kgPerIndividual} كغم/فرد
          </span>
        </div>
      );
    }
    if (sectionId === 'quick_extract_settings') {
      return (
        <div className="flex items-center justify-between font-bold tabular-nums">
          <span>
            {quickExtractPrefs.defaultScanMode === 'audit'
              ? 'تدقيق فائق'
              : 'تصوير سريع'}
          </span>
          <span style={{ color: 'var(--accent)' }}>
            عتبة {quickExtractPrefs.clarityThreshold}%
          </span>
        </div>
      );
    }
    if (sectionId === 'relations_lists') {
      return (
        <div className="flex items-center justify-between font-bold tabular-nums">
          <span>تصدير: {relationsPrefs.defaultExportFormat.toUpperCase()}</span>
          <span style={{ color: 'var(--accent)' }}>
            قبل {relationsPrefs.defaultReminderLeadDays} أيام
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between font-bold tabular-nums">
        <span>
          {securityPrefs.privacyLocked ? 'شاشة مقفلة' : 'حماية مفتوحة'}
        </span>
        <span style={{ color: 'var(--accent)' }}>
          المهملات: {recycleBin.length}
        </span>
      </div>
    );
  };

  const shellContainerClass =
    displayMode === 'fullscreen'
      ? 'capsule-fullscreen-shell flex flex-col'
      : 'min-h-screen w-full flex flex-col';

  const contentWidthClass =
    displayMode === 'fullscreen'
      ? 'w-full px-4 sm:px-8 lg:px-10'
      : 'mx-auto w-full max-w-6xl px-4 sm:px-6';

  return (
    <div
      data-settings-display-mode={displayMode}
      className={shellContainerClass}
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Floating Glassmorphic Standalone Settings Header Bar */}
      <div className="no-print sticky top-0 z-30 w-full px-3 pt-2.5 pb-1.5 sm:px-6 sm:pt-3 pointer-events-none">
        <header
          data-testid="settings-floating-topbar"
          className={`pointer-events-auto mx-auto w-full rounded-2xl border px-3.5 py-2.5 sm:px-5 transition-all duration-200 ${
            displayMode === 'contained' ? 'max-w-6xl' : ''
          }`}
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
            borderColor:
              'color-mix(in srgb, var(--border-color) 80%, transparent)',
            boxShadow: darkTheme
              ? '0 14px 36px -12px rgba(0, 0, 0, 0.56), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
              : '0 14px 32px -14px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78)',
            backdropFilter: 'blur(18px) saturate(165%)',
            WebkitBackdropFilter: 'blur(18px) saturate(165%)',
          }}
        >
          <div className="flex w-full flex-wrap items-center justify-between gap-2.5 md:grid md:grid-cols-[1fr_minmax(220px,380px)_1fr] md:gap-4">
            {/* Right Side (RTL Start): Exit / Back Navigation */}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {currentScreenMode === 'detail' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCapsuleId(null);
                      setScreenMode('hub');
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                      boxShadow:
                        '0 4px 12px color-mix(in srgb, var(--accent) 26%, transparent)',
                    }}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span>أقسام الإعدادات</span>
                  </button>
                  <button
                    type="button"
                    onClick={onBackToApp}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:opacity-85"
                    style={{
                      backgroundColor:
                        'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                    <span>العودة للتطبيق</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onBackToApp}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    boxShadow:
                      '0 4px 12px color-mix(in srgb, var(--accent) 26%, transparent)',
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>العودة للتطبيق</span>
                </button>
              )}

              <div className="hidden xl:flex items-center gap-2 text-xs min-w-0">
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    color: 'var(--accent)',
                  }}
                  aria-hidden="true"
                >
                  M
                </span>
                <span dir="ltr" className="font-extrabold shrink-0">
                  Morrow
                </span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <button
                  type="button"
                  onClick={() => {
                    setCapsuleId(null);
                    setScreenMode('hub');
                  }}
                  className="font-bold whitespace-nowrap hover:underline"
                  style={{
                    color:
                      currentScreenMode === 'hub'
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                  }}
                >
                  الإعدادات
                </button>
              </div>
            </div>

            {/* Center Zone: Recursive Settings Search + Section Jump */}
            <div className="w-full md:w-full md:max-w-[380px] md:justify-self-center order-3 md:order-2">
              {currentScreenMode === 'hub' ? (
                <div
                  className="flex h-10 items-center gap-2 rounded-xl border px-2.5 transition-all"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--bg-main) 88%, var(--bg-surface))',
                    borderColor: settingsSearch
                      ? 'var(--accent)'
                      : 'color-mix(in srgb, var(--accent) 20%, var(--border-color))',
                  }}
                >
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      color: 'var(--accent)',
                    }}
                    aria-hidden="true"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="search"
                    value={settingsSearch}
                    onChange={(e) => setSettingsSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && deepSearchHits.length > 0) {
                        const first = deepSearchHits[0];
                        handleBreadcrumbNodeClick(first.node);
                      }
                    }}
                    placeholder="ابحث في الكبسولات العميقة (مثل: رسم الفرد، ثيم زجاجي، كاش)..."
                    aria-label="بحث في أقسام وكبسولات الإعدادات"
                    className="min-w-0 w-full bg-transparent text-xs font-medium outline-none"
                  />
                  {settingsSearch && (
                    <button
                      type="button"
                      onClick={() => setSettingsSearch('')}
                      aria-label="مسح بحث الإعدادات"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-75 hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <select
                  aria-label="الانتقال السريع بين أقسام الإعدادات"
                  value={activeSection}
                  onChange={(e) =>
                    openSectionCapsule(e.target.value as SettingsSectionId, null)
                  }
                  className="h-10 w-full rounded-xl border px-3 text-xs font-extrabold"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--bg-main) 88%, var(--bg-surface))',
                    borderColor:
                      'color-mix(in srgb, var(--accent) 28%, var(--border-color))',
                  }}
                >
                  {sectionNodesWithGroup.map(({ sectionId, node }) => {
                    const b = resolveHierarchyNodeBadge(
                      node,
                      resolvedBadgeContext
                    );
                    return (
                      <option key={sectionId} value={sectionId}>
                        {node.title}
                        {b ? ` — ${b.text}` : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Left Side (RTL End): Command Palette + Fullscreen Switcher + Mode + Dark/Light + Auth */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 order-2 md:order-3">
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  aria-label="لوحة الأوامر والبحث العميق"
                  title="لوحة الأوامر السريعة (Ctrl+K)"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--bg-main) 84%, transparent)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--accent)',
                  }}
                >
                  <Command className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">بحث الأوامر</span>
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
                      ? 'تم تفعيل وضع ملء الشاشة بالكامل.'
                      : 'تم تفعيل العرض المركزي المدمج.'
                  );
                }}
                aria-label="تبديل وضع ملء الشاشة"
                title={
                  displayMode === 'fullscreen'
                    ? 'التبديل إلى العرض المدمج'
                    : 'التبديل إلى ملء الشاشة (الافتراضي)'
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor:
                    displayMode === 'fullscreen'
                      ? 'var(--bg-nav-active)'
                      : 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                  borderColor:
                    displayMode === 'fullscreen'
                      ? 'color-mix(in srgb, var(--accent) 30%, var(--border-color))'
                      : 'var(--border-color)',
                  color:
                    displayMode === 'fullscreen'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                {displayMode === 'fullscreen' ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden md:inline">
                  {displayMode === 'fullscreen' ? 'ملء الشاشة' : 'مدمج'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openSectionCapsule('modes', null)}
                title="تغيير مستوى التحكم والأوضاع"
                className="hidden lg:inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor:
                    'color-mix(in srgb, var(--accent) 28%, var(--border-color))',
                  color: 'var(--accent)',
                }}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>{shortModeLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleDarkTheme(!darkTheme);
                  notifySuccess(
                    !darkTheme
                      ? 'تم تفعيل الوضع الليلي.'
                      : 'تم تفعيل الوضع النهاري.'
                  );
                }}
                aria-label={
                  darkTheme ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 text-xs font-bold whitespace-nowrap transition-opacity hover:opacity-85"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--bg-main) 82%, transparent)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {darkTheme ? (
                  <>
                    <Sun className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span className="hidden sm:inline">نهاري</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span className="hidden sm:inline">ليلي</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenAuth}
                aria-label={authUser ? `حساب ${authUser.displayName}` : 'الحساب'}
                className="inline-flex h-9 items-center gap-2 rounded-xl border px-2 sm:px-3 text-xs font-bold whitespace-nowrap transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: authUser
                    ? 'var(--bg-nav-active)'
                    : 'var(--accent)',
                  borderColor: 'var(--accent)',
                  color: authUser ? 'var(--text-primary)' : 'var(--accent-fg)',
                }}
              >
                {authUser?.avatarUrl ? (
                  <img
                    src={authUser.avatarUrl}
                    alt={authUser.displayName}
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-md object-cover"
                  />
                ) : (
                  <UserCircle2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {authUser ? authUser.displayName : 'الحساب'}
                </span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {hierarchyBar && (
        <div className="w-full px-1 sm:px-4">{hierarchyBar}</div>
      )}

      {/* Alerts */}
      {(feedback || errorFeedback) && (
        <div className={`${contentWidthClass} pt-3`}>
          {feedback && (
            <div
              role="status"
              className="capsule-glass-card border px-4 py-2.5 text-xs font-extrabold"
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
              className="capsule-glass-card border px-4 py-2.5 text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--danger-bg)',
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
              }}
            >
              {errorFeedback}
            </div>
          )}
        </div>
      )}

      {/* STAGE 1: BENTO CAPSULE SETTINGS HUB (FULLSCREEN BY DEFAULT) */}
      {currentScreenMode === 'hub' ? (
        <main
          data-testid="settings-hub-view"
          className={`${contentWidthClass} flex-1 space-y-8 py-6 pb-24 sm:py-8 sm:pb-20 capsule-level-enter`}
        >
          {/* Executive Live Status Banner */}
          <section
            aria-label="ملخص حالة الإعدادات"
            className="capsule-glass-card grid grid-cols-1 gap-6 border p-6 lg:grid-cols-12 lg:items-center"
            style={{
              borderColor: 'var(--border-color)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="space-y-1.5 lg:col-span-5">
              <div
                className="text-xs font-extrabold"
                style={{ color: 'var(--accent)' }}
              >
                نظام الكبسولات الهرمي المتداخل ·{' '}
                {displayMode === 'fullscreen' ? 'ملء الشاشة' : 'عرض مدمج'}
              </div>
              <h1 className="text-xl font-extrabold sm:text-2xl">
                إعدادات التطبيق الشاملة — Morrow
              </h1>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                كل أداة منظمة في كبسولات مركّزة وبسيطة بدون ازدحام، مع معاينات حية وحماية متكاملة لكل فرع.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-7">
              <button
                type="button"
                onClick={() => openSectionCapsule('appearance', null)}
                className="rounded-2xl border p-3.5 text-right transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  الثيم النشط
                </div>
                <div className="mt-1 truncate text-xs font-extrabold">
                  {activeThemeObj.name}
                </div>
              </button>

              <button
                type="button"
                onClick={() => openSectionCapsule('modes', null)}
                className="rounded-2xl border p-3.5 text-right transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  مستوى التحكم
                </div>
                <div
                  className="mt-1 truncate text-xs font-extrabold"
                  style={{ color: 'var(--accent)' }}
                >
                  {shortModeLabel}
                </div>
              </button>

              <button
                type="button"
                onClick={() => openSectionCapsule('calculator', 'calc_preview_cap')}
                className="rounded-2xl border p-3.5 text-right transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  رسم الفرد (5 أفراد)
                </div>
                <div
                  className="mt-1 truncate text-xs font-extrabold tabular-nums"
                  style={{ color: 'var(--success)' }}
                >
                  {calculationSettings.feePerIndividualIqd} ·{' '}
                  {formatIqd(sampleFiveFeeTotal)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => openSectionCapsule('security_data', 'sec_recycle_bin_cap')}
                className="rounded-2xl border p-3.5 text-right transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  سلة المهملات
                </div>
                <div className="mt-1 truncate text-xs font-extrabold tabular-nums">
                  {recycleBin.length} عنصر محفوظ
                </div>
              </button>
            </div>
          </section>

          {/* Deep Recursive Search Results Mode */}
          {settingsSearch.trim() ? (
            deepSearchHits.length === 0 ? (
              <div
                className="capsule-glass-card border p-8 text-center space-y-3"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="text-sm font-extrabold">
                  لا توجد كبسولات أو إعدادات مطابقة للبحث «{settingsSearch}»
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsSearch('')}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>عرض جميع الكبسولات</span>
                </button>
              </div>
            ) : (
              <section
                aria-label="نتائج البحث العميق في الكبسولات"
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold">
                    نتائج البحث في الشجرة الهرمية ({deepSearchHits.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSettingsSearch('')}
                    className="text-xs font-bold hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    مسح البحث
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {deepSearchHits.map((hit) => {
                    const badge = resolveHierarchyNodeBadge(
                      hit.node,
                      resolvedBadgeContext
                    );
                    const trailText = hit.path.map((p) => p.title).join(' ◂ ');
                    return (
                      <NodeCard
                        key={hit.node.id}
                        node={hit.node}
                        badge={badge}
                        preview={
                          <div className="truncate font-semibold" style={{ color: 'var(--text-muted)' }}>
                            {trailText}
                          </div>
                        }
                        actionLabel={`فتح مستوى ${hit.node.level}`}
                        onOpen={(n) => handleBreadcrumbNodeClick(n)}
                      />
                    );
                  })}
                </div>
              </section>
            )
          ) : (
            <>
              {/* Master Group 1: Experience, Appearance & Workspace Modes */}
              <section aria-label="قسم الشكل والواجهة والتحكم" className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-extrabold sm:text-lg">
                    01. المظهر والواجهة والتحكم
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    كبسولات الألوان، الخطوط، العرض الافتراضي، وصلاحيات الخبير
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
                  {experienceNodes.map(({ sectionId, node }) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      badge={resolveHierarchyNodeBadge(
                        node,
                        resolvedBadgeContext
                      )}
                      preview={buildHubCardPreview(sectionId)}
                      actionLabel="فتح الكبسولة"
                      onOpen={() => openSectionCapsule(sectionId, null)}
                    />
                  ))}
                </div>
              </section>

              {/* Master Group 2: Operations, Smart Capture & Data Security */}
              <section aria-label="قسم العمليات والحاسبة والأمان" className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-extrabold sm:text-lg">
                    02. العمليات والحاسبة والبيانات
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    ضبط الحاسبة (250 د.ع)، السحب الذكي، القوائم، والحماية السحابية
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
                  {operationsNodes.map(({ sectionId, node }) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      badge={resolveHierarchyNodeBadge(
                        node,
                        resolvedBadgeContext
                      )}
                      preview={buildHubCardPreview(sectionId)}
                      actionLabel="فتح الكبسولة"
                      onOpen={() => openSectionCapsule(sectionId, null)}
                    />
                  ))}
                </div>
              </section>

              {/* Master Group 3: New Flagship Cosmos Worlds & Governance */}
              <section aria-label="العوالم الجديدة الذكية والحوكمة" className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-extrabold sm:text-lg">
                    03. الصحة والمؤشرات والوصول والأرشيف الشامل
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    مؤشرات الأداء KPI، فحص التضاربات، التقويم الهجري، وفهرس الصفر-حذف
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      id: 'cap_kpi_dashboard',
                      section: 'general' as SettingsSectionId,
                      title: 'لوحة المؤشرات التنفيذية KPI',
                      sub: `${state.agencies.length} وكالات · توزيع الإيرادات والحصص`,
                    },
                    {
                      id: 'cap_health_center',
                      section: 'general' as SettingsSectionId,
                      title: 'مركز صحة البيانات والتضاربات',
                      sub:
                        auditIssues.length > 0
                          ? `${auditIssues.length} ملاحظة قابلة للإصلاح`
                          : 'سليم 100%',
                    },
                    {
                      id: 'cap_access_ergonomics',
                      section: 'general' as SettingsSectionId,
                      title: 'إمكانية الوصول واليد الواحدة',
                      sub: 'الأرقام ١٢٣، الهجري، تقليل الحركة واللمس',
                    },
                    {
                      id: 'cap_legacy_index',
                      section: 'general' as SettingsSectionId,
                      title: 'عالم الأرشيف الكامل (0 حذف)',
                      sub: 'فهرس جميع المفاتيح القديمة واسترجاع اللقطات',
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openSectionCapsule(item.section, item.id)}
                      className="capsule-glass-card rounded-[20px] border p-4 text-right transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="text-sm font-extrabold">{item.title}</div>
                      <div
                        className="mt-1 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {item.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      ) : (
        /* STAGE 2+: ISOLATED WORLD SHELL + NESTED RECURSIVE CAPSULE WORKSPACE */
        <WorldShell
          world={activeWorldNode}
          rootCosmos={resolvedCosmosRoot}
          activeTab={worldTab}
          onChangeTab={setWorldTab}
          experienceMode={
            onUpdateCosmosExperienceMode || onUpdateAccessibilityPrefs
              ? effectiveWorkspaceCosmos.accessibility.experienceMode
              : localExperienceMode
          }
          onChangeExperienceMode={(mode) => {
            if (onUpdateCosmosExperienceMode) {
              onUpdateCosmosExperienceMode(mode);
            } else if (onUpdateAccessibilityPrefs) {
              onUpdateAccessibilityPrefs({ experienceMode: mode });
            } else {
              setLocalExperienceMode(mode);
            }
          }}
          healthPercent={worldHealthPercent}
          healthNote={
            auditIssues.length > 0
              ? `رُصدت ${auditIssues.length} ملاحظات في فحص سجلات الوكالات`
              : 'إعدادات هذا العالم متوافقة ومحمية'
          }
          onFixWorldIssues={
            auditIssues.length > 0 && onRunAutoFix
              ? () => {
                  const res = onRunAutoFix();
                  notifySuccess(
                    res.fixedCount > 0
                      ? `تم إصلاح ${res.fixedCount} حالة تلقائياً.`
                      : 'افتح مركز صحة البيانات لمراجعة الملاحظات اليدوية.'
                  );
                }
              : undefined
          }
          changeLog={effectiveWorkspaceCosmos.changeLog}
          worldExportJson={JSON.stringify(
            activeWorldId === 'world_themes'
              ? themePrefs
              : activeWorldId === 'world_calculator'
              ? calculationSettings
              : activeWorldId === 'world_security_backup'
              ? securityPrefs
              : { generalPrefs, topBarConfig, modeTier },
            null,
            2
          )}
          onResetWorld={() => {
            if (activeWorldId === 'world_themes') {
              onResetThemePrefs();
              onAppendChangeLog?.({
                worldId: 'world_themes',
                label: 'استعادة افتراضي عالم المظهر (مع حفظ الثيمات المخصصة)',
              });
              notifySuccess(
                'تمت استعادة عالم المظهر الافتراضي مع بقاء ثيماتك وملفاتك المخصصة.'
              );
            } else if (activeWorldId === 'world_calculator') {
              onAppendChangeLog?.({
                worldId: 'world_calculator',
                label: 'استعادة افتراضيات حاسبة الجدول (رسم 250 د.ع)',
                beforeValue: `${calculationSettings.feePerIndividualIqd}`,
                afterValue: `${DEFAULT_CALCULATION_SETTINGS.feePerIndividualIqd}`,
              });
              onSaveCalculationSettings({ ...DEFAULT_CALCULATION_SETTINGS });
              notifySuccess('تمت استعادة معادلات الحاسبة الافتراضية فقط.');
            } else {
              onResetExpertTableConfig();
              notifySuccess(`تمت إعادة ضبط ${activeWorldNode.title} فقط.`);
            }
          }}
          onOpenWorldSwitcher={() => onOpenWorldSwitcher?.()}
          onOpenGlobalCommandPalette={() => onOpenCommandPalette?.()}
          onNavigateNode={(node) => {
            setWorldTab('galaxies');
            if (onSelectCosmosNode) {
              onSelectCosmosNode(node);
            } else if (node.target.settingsSection) {
              openSectionCapsule(
                node.target.settingsSection,
                node.target.settingsCapsuleId ?? null
              );
            }
          }}
          onBack={() => {
            setCapsuleId(null);
            setScreenMode('hub');
          }}
          quickSlot={
            <QuickHome
              world={activeWorldNode}
              quickNodes={quickWorldNodes}
              pinnedNodeIds={effectiveWorkspaceCosmos.pinnedNodeIds}
              badgeContext={resolvedBadgeContext}
              onOpenNode={(n) => {
                setWorldTab('galaxies');
                if (onSelectCosmosNode) {
                  onSelectCosmosNode(n);
                } else if (n.target.settingsSection) {
                  openSectionCapsule(
                    n.target.settingsSection,
                    n.target.settingsCapsuleId ?? null
                  );
                }
              }}
              onTogglePin={(id) => onTogglePinnedNode?.(id)}
              onShowAllGalaxies={() => setWorldTab('galaxies')}
            />
          }
          favoritesSlot={
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold">
                العناصر المثبتة في {activeWorldNode.title} ({favoriteWorldNodes.length})
              </h3>
              {favoriteWorldNodes.length === 0 ? (
                <div
                  className="rounded-2xl border p-6 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  لا توجد كبسولات مثبتة داخل هذا العالم بعد — اضغط أيقونة النجمة ⭐ في «سريع» لتثبيتها هنا.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {favoriteWorldNodes.map((n) => (
                    <GalaxyCard
                      key={n.id}
                      node={n}
                      badgeContext={resolvedBadgeContext}
                      isPinned
                      onOpen={(node) => {
                        setWorldTab('galaxies');
                        if (onSelectCosmosNode) {
                          onSelectCosmosNode(node);
                        } else if (node.target.settingsSection) {
                          openSectionCapsule(
                            node.target.settingsSection,
                            node.target.settingsCapsuleId ?? null
                          );
                        }
                      }}
                      onTogglePin={(id) => onTogglePinnedNode?.(id)}
                    />
                  ))}
                </div>
              )}
            </section>
          }
        >
          <main
            data-testid={`settings-detail-${activeSection}`}
            className={`${contentWidthClass} flex-1 py-2 pb-16 space-y-5`}
          >
            {/* Persistent Interactive Icon Breadcrumb */}
            <CapsuleBreadcrumb
              path={activePath}
              onNavigateNode={handleBreadcrumbNodeClick}
              onBackStep={handleStepBackInDetail}
            />

            {/* New Flagship Cosmos Capsules inside Settings */}
            {(currentCapsuleId === 'cap_fonts_locale' ||
              currentCapsuleId === 'cap_access_ergonomics') && (
              <AccessibilityCosmosPanel
                accessibility={effectiveWorkspaceCosmos.accessibility}
                onUpdateAccessibility={(patch) =>
                  onUpdateAccessibilityPrefs?.(patch)
                }
                onNotify={notifySuccess}
              />
            )}

            {(currentCapsuleId === 'cap_kpi_dashboard' ||
              currentCapsuleId === 'cap_health_center' ||
              currentCapsuleId === 'cap_registry_inspector') && (
              <HealthAndKpiPanel
                tab={
                  currentCapsuleId === 'cap_health_center'
                    ? 'health'
                    : currentCapsuleId === 'cap_registry_inspector'
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
                  onRunAutoFix
                    ? onRunAutoFix()
                    : { fixedCount: 0, summaryLines: [] }
                }
                onOpenNode={(n) => {
                  if (onSelectCosmosNode) {
                    onSelectCosmosNode(n);
                  } else if (n.target.settingsSection) {
                    openSectionCapsule(
                      n.target.settingsSection,
                      n.target.settingsCapsuleId ?? null
                    );
                  }
                }}
                onNotify={notifySuccess}
              />
            )}

            {currentCapsuleId === 'cap_legacy_index' && (
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
                    openSectionCapsule(
                      hit.target.settingsSection,
                      hit.target.settingsCapsuleId ?? null
                    );
                  }
                }}
                onNotify={notifySuccess}
              />
            )}

            {currentCapsuleId !== 'cap_fonts_locale' &&
              currentCapsuleId !== 'cap_access_ergonomics' &&
              currentCapsuleId !== 'cap_kpi_dashboard' &&
              currentCapsuleId !== 'cap_health_center' &&
              currentCapsuleId !== 'cap_registry_inspector' &&
              currentCapsuleId !== 'cap_legacy_index' && (
                <Suspense
                  fallback={
                    <div
                      className="capsule-glass-card border p-8 text-center text-xs font-bold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      جاري فتح الكبسولة...
                    </div>
                  }
                >
                  {activeSection === 'appearance' && (
                    <AppearanceCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
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
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                      accessibility={effectiveWorkspaceCosmos.accessibility}
                      onSaveCustomTheme={onSaveCustomTheme}
                      onDeleteCustomTheme={onDeleteCustomTheme}
                    />
                  )}

                  {activeSection === 'fonts' && (
                    <FontsCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
                      displayMode={displayMode}
                      badgeContext={resolvedBadgeContext}
                      themePrefs={themePrefs}
                      onUpdateThemePrefs={onUpdateThemePrefs}
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                    />
                  )}

                  {activeSection === 'modes' && (
                    <ModesCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
                      displayMode={displayMode}
                      badgeContext={resolvedBadgeContext}
                      modeTier={modeTier}
                      editorEnabled={editorEnabled}
                      expertTableConfig={expertTableConfig}
                      onChangeModeTier={onChangeModeTier}
                      onToggleEditor={onToggleEditor}
                      onUpdateExpertTableConfig={onUpdateExpertTableConfig}
                      onResetExpertTableConfig={onResetExpertTableConfig}
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                    />
                  )}

                  {activeSection === 'calculator' && (
                    <CalculatorCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
                      displayMode={displayMode}
                      badgeContext={resolvedBadgeContext}
                      calculationSettings={calculationSettings}
                      agenciesCount={state.agencies.length}
                      activePeriodLabel={activePeriodLabel}
                      onSaveCalculationSettings={(nextCalc) => {
                        onAppendChangeLog?.({
                          worldId: 'world_calculator',
                          label: 'تحديث معادلة الحاسبة',
                          beforeValue: `رسم ${calculationSettings.feePerIndividualIqd} د.ع`,
                          afterValue: `رسم ${nextCalc.feePerIndividualIqd} د.ع`,
                        });
                        onSaveCalculationSettings(nextCalc);
                      }}
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                    />
                  )}

                  {activeSection === 'general' && (
                    <GeneralCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
                      displayMode={displayMode}
                      badgeContext={resolvedBadgeContext}
                      generalPrefs={generalPrefs}
                      topBarConfig={topBarConfig}
                      requireLoginOnStart={requireLoginOnStart}
                      onUpdateGeneralPrefs={onUpdateGeneralPrefs}
                      onChangeTopBarConfig={onChangeTopBarConfig}
                      onToggleRequireLogin={onToggleRequireLogin}
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                    />
                  )}

                  {activeSection === 'quick_extract_settings' && (
                    <QuickExtractCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
                      displayMode={displayMode}
                      badgeContext={resolvedBadgeContext}
                      quickExtractPrefs={quickExtractPrefs}
                      onUpdateQuickExtractPrefs={onUpdateQuickExtractPrefs}
                      onDeleteQuickExtractTemplate={
                        onDeleteQuickExtractTemplate
                      }
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                    />
                  )}

                  {activeSection === 'relations_lists' && (
                    <RelationsListsCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
                      displayMode={displayMode}
                      badgeContext={resolvedBadgeContext}
                      relationsPrefs={relationsPrefs}
                      onUpdateRelationsPrefs={onUpdateRelationsPrefs}
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                    />
                  )}

                  {activeSection === 'security_data' && (
                    <SecurityCapsules
                      sectionNode={sectionNode}
                      activeNode={activeNode}
                      activeCapsuleId={currentCapsuleId}
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
                      onOpenCapsule={(capId) => setCapsuleId(capId)}
                      onNotifySuccess={notifySuccess}
                      onNotifyError={notifyError}
                    />
                  )}
                </Suspense>
              )}
          </main>
        </WorldShell>
      )}
    </div>
  );
};
