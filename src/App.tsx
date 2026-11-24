import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { AgenciesHubView } from './components/AgenciesHubView';
import { AgencyRosterView } from './components/AgencyRosterView';
import { FinanceWorkspaceView } from './components/FinanceWorkspaceView';
import { AuthModal } from './components/modals/AuthModal';
import {
  AddPersonModal,
  DeleteConfirmModal,
  EditPersonModal,
} from './components/modals/PersonEditorModals';
import { QuickExtractView } from './components/QuickExtractView';
import { DataArchivesView } from './components/DataArchivesView';
import { GoogleWorkspaceView } from './components/GoogleWorkspaceView';
import { ReadyListsView } from './components/ReadyListsView';
import { RelationshipsView } from './components/RelationshipsView';
import { SettingsView } from './components/SettingsView';
import { AppSidebar } from './components/AppSidebar';
import { TopBar } from './components/TopBar';
import { AssistantWidget } from './components/AssistantWidget';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { MorrowCommandCenterView } from './components/MorrowCommandCenterView';
import { ToastHost } from './components/ToastHost';
import { AccountSecurityHubView } from './components/AccountSecurityHubView';
import { Switcher } from './components/cosmos/Switcher';
import { CosmosBottomNav } from './components/cosmos/CosmosBottomNav';
import { useAgencyStore } from './hooks/useAgencyStore';
import { useAssistantEngine } from './hooks/useAssistantEngine';
import { useToastQueue } from './hooks/useToastQueue';
import { clearSession, getStoredSession } from './lib/authClient';
import { OnboardingFlow } from './components/auth/OnboardingFlow';
import { FlipAuthGuard } from './components/auth/FlipAuthGuard';
import { getTenantOnboardingKey } from './services/storage/tenantStorage';
import type {
  AssistantExternalTableCommand,
  MorrowCanvasMode,
  MorrowCenterTab,
} from './types/assistant';
import type {
  AgencyExpense,
  AppView,
  AuthUser,
  Person,
  ReadyList,
  ReadyListItem,
  RelationEntry,
  SettingsSectionId,
  TopBarFocusMode,
} from './types/agency';
import { auditAgencyPersons } from './utils/agencyLogic';
import {
  buildCosmosRegistry,
  getCosmosNodeById,
  recordCosmosNodeVisit,
  resolveCosmosNodeForTarget,
  type CosmosNode,
} from './utils/cosmosRegistry';
import {
  buildMorrowHierarchyTree,
  type HierarchyBadgeContext,
  type HierarchyTarget,
} from './utils/hierarchyRegistry';
import { getUnifiedCapabilities } from './utils/modePermissions';
import {
  ARABIC_FONTS,
  DEFAULT_APPEARANCE_PROFILES,
  resolveTableThemeId,
  TABLE_THEMES,
} from './utils/themes';
import { playTactileFeedback } from './utils/tactileFeedback';
import { computeTopBarScrollHidden } from './utils/scrollAutoHide';
import {
  buildNextCheckpoint,
  compressAndVerifyWorkspacePayload,
  computeWorkspaceDiff,
  isWeeklyAutoBackupDue,
  stageLocalRecoveryBackup,
} from './utils/smartSyncEngine';

type AppNavSnapshot = {
  view: AppView;
  selectedAgencyId: number;
  settingsSection: SettingsSectionId;
  settingsScreenMode: 'hub' | 'detail';
  settingsCapsuleId: string | null;
  morrowTab: MorrowCenterTab;
};

type DeleteTarget =
  | { kind: 'person'; item: Person }
  | { kind: 'expense'; item: AgencyExpense }
  | { kind: 'ready_item'; item: ReadyListItem }
  | { kind: 'ready_list'; item: ReadyList }
  | { kind: 'relation'; item: RelationEntry };

export default function App() {
  // Multi-Auth state lifted above store to guarantee strict per-uid isolation
  const [authUser, setAuthUser] = useState<AuthUser | null>(
    () => getStoredSession()?.user || null
  );
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return true;
      return localStorage.getItem(getTenantOnboardingKey(null)) === '1';
    } catch {
      return false;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const {
    state,
    workspaceCosmos,
    activePeriod,
    monthlyArchives,
    themePrefs,
    expertTableConfig,
    quickExtractPrefs,
    relationsPrefs,
    generalPrefs,
    securityPrefs,
    recycleBin,
    workspaceNotes,
    canUndo,
    canRedo,
    undo,
    redo,
    setModeTier,
    setEditorEnabled,
    setDarkTheme,
    setThemePrefs,
    resetThemePrefs,
    saveCustomThemePreset,
    deleteCustomThemePreset,
    updateAccessibilityPrefs,
    updateFeatureFlags,
    togglePinnedCosmosNode,
    recordRecentCosmosNode,
    toggleHiddenCosmosWorld,
    appendWorldChangeLog,
    restorePreMigrationSnapshot,
    saveAppearanceProfile,
    applyAppearanceProfile,
    deleteAppearanceProfile,
    setRequireLoginOnStart,
    setCalculationSettings,
    setTopBarConfig,
    setExpertTableConfig,
    resetExpertTableConfig,
    addExpertCustomColumn,
    removeExpertCustomColumn,
    setQuickExtractPrefs,
    saveQuickExtractTemplate,
    deleteQuickExtractTemplate,
    setRelationsPrefs,
    setGeneralPrefs,
    setSecurityPrefs,
    updateSmartSyncCheckpoint,
    addWorkspaceNote,
    updateWorkspaceNote,
    deleteWorkspaceNote,
    restoreRecycleBinItem,
    purgeRecycleBinItem,
    clearRecycleBin,
    importWorkspaceJson,
    updateTableHeaderMeta,
    updateActivePeriod,
    archiveCurrentPeriod,
    startNextMonthRollover,
    markArchiveCloudSynced,
    deleteMonthlyArchive,
    addPersonDirect,
    updatePersonConfirmed,
    bulkUpdatePersonsCategory,
    bulkUpdatePersonsStatusAndCategory,
    deletePersonConfirmed,
    deletePersonsBulkConfirmed,
    commitQuickExtractPlan,
    addExpense,
    deleteExpenseConfirmed,
    createReadyList,
    createReadyListFromSelection,
    updateReadyListMetaConfirmed,
    deleteReadyListConfirmed,
    addReadyListItemDirect,
    updateReadyListItemConfirmed,
    removeReadyListItemConfirmed,
    deleteReadyListItemsBulkConfirmed,
    addPersonsToReadyList,
    moveReadyListItemOrder,
    movePersonsToAgencyConfirmed,
    upsertRelationEntry,
    removeRelationEntryConfirmed,
    addAgencyDirect,
    updateAgencyDetails,
    ucrsSessions,
    ucrsLearningRules,
    upsertUcrsSession,
    deleteUcrsSession,
    upsertUcrsLearningRule,
    toggleUcrsLearningRule,
    deleteUcrsLearningRule,
    applyAssistantAutoFixes,
    syncWorkspaceToServer,
    restoreWorkspaceFromServer,
    compressionStats,
    loadStarterDemoData,
  } = useAgencyStore(authUser?.uid ?? null);

  const [activeView, setActiveView] = useState<AppView>('hub');
  const [previousView, setPreviousView] = useState<AppView>('hub');
  const [settingsSection, setSettingsSection] =
    useState<SettingsSectionId>('appearance');
  const [settingsScreenMode, setSettingsScreenMode] = useState<'hub' | 'detail'>(
    'hub'
  );
  const [settingsCapsuleId, setSettingsCapsuleId] = useState<string | null>(
    null
  );
  const [spotlightNodeId, setSpotlightNodeId] = useState<string | null>(null);
  const [tableViewingMode, setTableViewingMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (activeView !== 'agency_roster' && activeView !== 'master_roster') {
      setTableViewingMode(false);
    }
  }, [activeView]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tabrix_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tabrix_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };
  const [autoScrollHidden, setAutoScrollHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const pointerNearTopRef = useRef(false);
  const headerFocusActiveRef = useRef(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number>(
    state.agencies[0]?.id ?? 0
  );

  useEffect(() => {
    if (state.agencies.length === 0) {
      setSelectedAgencyId(0);
    } else if (!state.agencies.some((a) => a.id === selectedAgencyId)) {
      setSelectedAgencyId(state.agencies[0].id);
    }
  }, [state.agencies, selectedAgencyId]);

  const handleAuthenticated = (user: AuthUser) => {
    setAuthUser(user);
    setAuthModalOpen(false);
    setActiveView('hub');
    try {
      localStorage.setItem(getTenantOnboardingKey(user.uid), '1');
      localStorage.setItem(getTenantOnboardingKey(null), '1');
    } catch {
      // ignore storage failures
    }
    setOnboardingDone(true);
  };

  const handleLogout = () => {
    clearSession();
    setAuthUser(null);
    setAuthModalOpen(false);
    setDrawerOpen(false);
    setActiveView('hub');
  };

  // Privacy lock overlay input state
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [unlockPinError, setUnlockPinError] = useState('');

  // Editor modals state
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addDefaultAgencyId, setAddDefaultAgencyId] = useState<number>(1);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Copilot focus & table control bridge
  const [focusedPersonId, setFocusedPersonId] = useState<number | null>(null);
  const [externalTableCommand, setExternalTableCommand] =
    useState<AssistantExternalTableCommand | null>(null);
  const [columnCustomizerOpen, setColumnCustomizerOpen] = useState(false);
  const [initialMorrowCanvas, setInitialMorrowCanvas] = useState<{
    mode: MorrowCanvasMode;
    nonce: number;
  } | null>(null);
  const [pendingExtractFiles, setPendingExtractFiles] = useState<{
    files: File[];
    nonce: number;
  } | null>(null);

  const capabilities = useMemo(
    () =>
      getUnifiedCapabilities(
        generalPrefs.granularControls,
        generalPrefs.confirmBeforeEdit,
        generalPrefs.confirmBeforeDelete,
        expertTableConfig.allowDirectNoConfirmEdit
      ),
    [
      generalPrefs.granularControls,
      generalPrefs.confirmBeforeEdit,
      generalPrefs.confirmBeforeDelete,
      expertTableConfig.allowDirectNoConfirmEdit,
    ]
  );

  // Guard restricted routes if user switches down to Beginner mode
  useEffect(() => {
    if (activeView === 'finance' && !capabilities.canViewFinance) {
      setActiveView('hub');
    }
    if (activeView === 'quick_extract' && !capabilities.canUseQuickExtract) {
      setActiveView('hub');
    }
  }, [activeView, capabilities]);

  // Keyboard Undo/Redo shortcuts when Editor mode is enabled
  useEffect(() => {
    if (!capabilities.canEditRecords) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [capabilities.canEditRecords, undo, redo]);

  const currentAgency =
    state.agencies.find((a) => a.id === selectedAgencyId) || state.agencies[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
    lastScrollYRef.current = 0;
    pointerNearTopRef.current = false;
    setAutoScrollHidden(false);
  }, [activeView]);

  useEffect(() => {
    if (!state.topBarConfig.autoFocus || state.topBarConfig.mode === 'hidden') {
      setAutoScrollHidden(false);
      return;
    }

    const isFocusInsideHeader = (el: EventTarget | null): boolean =>
      el instanceof HTMLElement && Boolean(el.closest('header'));

    const onScroll = () => {
      const y = Math.max(0, window.scrollY || 0);
      const prevY = lastScrollYRef.current;
      setAutoScrollHidden((wasHidden) =>
        computeTopBarScrollHidden({
          enabled: Boolean(state.topBarConfig.autoFocus),
          currentY: y,
          prevY,
          wasHidden,
          pointerNearTop: pointerNearTopRef.current,
          hasActiveOverlayOrFocusInHeader: headerFocusActiveRef.current,
        })
      );
      lastScrollYRef.current = y;
    };

    const onMouseMove = (e: MouseEvent) => {
      const nearTop = e.clientY <= 16;
      if (nearTop !== pointerNearTopRef.current) {
        pointerNearTopRef.current = nearTop;
        if (nearTop) {
          setAutoScrollHidden(false);
        }
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isFocusInsideHeader(e.target)) {
        headerFocusActiveRef.current = true;
        setAutoScrollHidden(false);
      }
    };

    const onFocusOut = () => {
      requestAnimationFrame(() => {
        headerFocusActiveRef.current = isFocusInsideHeader(document.activeElement);
      });
    };

    lastScrollYRef.current = Math.max(0, window.scrollY || 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [state.topBarConfig.autoFocus, state.topBarConfig.mode]);

  const isAutoHidden =
    state.topBarConfig.mode !== 'hidden' &&
    Boolean(state.topBarConfig.autoFocus) &&
    autoScrollHidden;

  const effectiveTopBarMode: TopBarFocusMode =
    state.topBarConfig.mode === 'hidden'
      ? 'hidden'
      : state.topBarConfig.mode === 'compact'
      ? 'compact'
      : 'normal';

  const activeViewLabel = useMemo(() => {
    if (activeView === 'hub') return 'الشاشة الرئيسية';
    if (activeView === 'agency_roster')
      return currentAgency?.name || 'سجل الوكالة';
    if (activeView === 'master_roster') return 'السجل الشامل';
    if (activeView === 'ready_lists') return 'القوائم الجاهزة';
    if (activeView === 'relationships') return 'قسم العلاقات';
    if (activeView === 'finance') return 'الحسابات والمالية';
    if (activeView === 'quick_extract') return 'السحب السريع';
    if (activeView === 'morrow_center') return 'مركز Morrow';
    if (activeView === 'data_archives') return 'البيانات والأرشفة الشهرية';
    if (activeView === 'google_workspace') return 'التقويم والمهام (Google)';
    if (activeView === 'account_security') return 'الحساب والبيانات والأمان';
    return 'إعدادات التطبيق';
  }, [activeView, currentAgency]);

  const isAuthGateLocked = !authUser;

  const handleNavigate = (
    view: AppView,
    nextSettingsSection?: SettingsSectionId
  ) => {
    if (view !== 'agency_roster' && view !== 'master_roster') {
      setColumnCustomizerOpen(false);
    }
    if (view === 'settings') {
      if (activeView !== 'settings' && activeView !== 'morrow_center') {
        setPreviousView(activeView);
      }
      setSettingsCapsuleId(null);
      setSpotlightNodeId(null);
      if (nextSettingsSection) {
        setSettingsSection(nextSettingsSection);
        setSettingsScreenMode('detail');
      } else {
        setSettingsScreenMode('hub');
      }
    } else if (view === 'morrow_center') {
      if (activeView !== 'morrow_center' && activeView !== 'settings') {
        setPreviousView(activeView);
      }
    }
    setActiveView(view);
  };

  const hierarchyTree = useMemo(
    () => buildMorrowHierarchyTree(state.agencies),
    [state.agencies]
  );

  const cosmosRoot = useMemo(
    () => buildCosmosRegistry(state.agencies),
    [state.agencies]
  );

  const [worldSwitcherOpen, setWorldSwitcherOpen] = useState(false);

  const auditIssuesCount = useMemo(
    () => auditAgencyPersons(state.persons).length,
    [state.persons]
  );

  const activeThemeLabel = 'السبج والذهب';

  const activeTableThemeLabel = useMemo(() => {
    const resolvedId = resolveTableThemeId(themePrefs.tableTheme);
    return TABLE_THEMES.find((t) => t.id === resolvedId)?.name || 'الزجاجي';
  }, [themePrefs.tableTheme]);

  const activeFontLabel = useMemo(
    () =>
      ARABIC_FONTS.find((f) => f.id === themePrefs.fontFamily)?.name || 'Cairo',
    [themePrefs.fontFamily]
  );

  const handleNavigateHierarchyTarget = (
    target: HierarchyTarget,
    nodeId?: string
  ) => {
    if (typeof target.agencyId === 'number') {
      setSelectedAgencyId(target.agencyId);
    }
    if (target.view === 'settings') {
      if (activeView !== 'settings') {
        setPreviousView(activeView);
      }
      if (target.settingsSection) {
        setSettingsSection(target.settingsSection);
        setSettingsScreenMode(target.settingsScreenMode || 'detail');
      } else {
        setSettingsScreenMode(target.settingsScreenMode || 'hub');
      }
      setSettingsCapsuleId(target.settingsCapsuleId ?? null);
      setSpotlightNodeId(
        target.controlAnchorId || target.settingsCapsuleId || nodeId || null
      );
      setColumnCustomizerOpen(false);
      setActiveView('settings');
      return;
    }

    if (target.view === 'morrow_center') {
      if (activeView !== 'morrow_center' && activeView !== 'settings') {
        setPreviousView(activeView);
      }
      if (target.morrowTab) {
        assistant.setActiveCommandCenterTab(target.morrowTab);
      }
    }

    if (target.openColumnCustomizer) {
      setColumnCustomizerOpen(true);
    } else {
      setColumnCustomizerOpen(false);
    }

    setSpotlightNodeId(null);
    setActiveView(target.view);
  };

  const executeDeleteTarget = (target: DeleteTarget) => {
    if (target.kind === 'person') {
      deletePersonConfirmed(target.item.id);
    } else if (target.kind === 'expense') {
      deleteExpenseConfirmed(target.item.id);
    } else if (target.kind === 'ready_list') {
      deleteReadyListConfirmed(target.item.id);
    } else if (target.kind === 'relation') {
      removeRelationEntryConfirmed(target.item.id);
    } else {
      removeReadyListItemConfirmed(target.item.id);
    }
  };

  const handleRequestDelete = (target: DeleteTarget) => {
    if (!capabilities.requireDeleteConfirm) {
      executeDeleteTarget(target);
      return;
    }
    setDeleteTarget(target);
  };

  const handleUnlockPrivacy = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = (securityPrefs.privacyPin || '').trim();
    if (!expected || unlockPinInput.trim() === expected) {
      setSecurityPrefs({ privacyLocked: false });
      setUnlockPinInput('');
      setUnlockPinError('');
    } else {
      setUnlockPinError('رمز القفل غير صحيح، يرجى المحاولة مجدداً.');
    }
  };

  const handleDownloadBackupJson = (silentAuto = false) => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${silentAuto ? 'morrow-auto-backup' : 'morrow-backup'}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const focusedPersonName = useMemo(
    () =>
      focusedPersonId !== null
        ? state.persons.find((p) => p.id === focusedPersonId)?.name
        : undefined,
    [focusedPersonId, state.persons]
  );

  const { toasts, pushToast, dismissToast } = useToastQueue();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Silent Smart Weekly Auto-Backup Evaluator
  const weeklyAutoRanRef = useRef(false);
  useEffect(() => {
    if (weeklyAutoRanRef.current) return;
    weeklyAutoRanRef.current = true;
    const cp = securityPrefs.smartSync;
    if (!isWeeklyAutoBackupDue(cp)) return;

    const timer = window.setTimeout(async () => {
      try {
        const diff = computeWorkspaceDiff(state, cp);
        if (diff.status === 'unchanged') {
          if (cp?.lastSavedAt) {
            updateSmartSyncCheckpoint({
              ...cp,
              lastCheckedAt: new Date().toISOString(),
            });
            pushToast({
              title: 'الفحص الأسبوعي الذكي',
              description:
                'بياناتك محفوظة ومحدّثة بالكامل، ولا يوجد أي تغيير جديد يتطلب الحفظ.',
              tone: 'success',
            });
          }
          return;
        }
        const compressed = await compressAndVerifyWorkspacePayload(state);
        if (!compressed.verified) return;
        stageLocalRecoveryBackup(compressed);
        const nextCp = buildNextCheckpoint({
          prevCheckpoint: cp,
          diff,
          mode: 'weekly_auto',
          checksum: compressed.integrityChecksum,
          compressedBytes: compressed.compressedBytes,
        });
        updateSmartSyncCheckpoint(nextCp);
      } catch {
        // Silent recovery: preserve state cleanly without alarming alerts
      }
    }, 1800);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectCosmosNode = (node: CosmosNode) => {
    playTactileFeedback('tap', {
      haptic: workspaceCosmos.accessibility.hapticFeedback,
      sound: workspaceCosmos.accessibility.soundFeedback,
      reduceMotion: workspaceCosmos.accessibility.reduceMotion,
    });
    recordCosmosNodeVisit(node.id);
    if (node.id !== 'cosmos_hub') {
      recordRecentCosmosNode(node.id);
    }
    handleNavigateHierarchyTarget(node.target, node.id);
    try {
      const nextHash = node.id === 'cosmos_hub' ? '#hub' : `#node=${encodeURIComponent(node.id)}`;
      window.history.replaceState(null, '', nextHash);
    } catch {
      // ignore history API failures in restricted frames
    }
  };

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setWorldSwitcherOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const assistant = useAssistantEngine({
    runtime: {
      state,
      uiContext: {
        activeView,
        selectedAgencyId:
          activeView === 'agency_roster' ? selectedAgencyId : null,
        focusedPersonId,
        focusedPersonName,
        modeTier: state.modeTier,
        themeId: themePrefs.appTheme,
        agencies: state.agencies.map((a) => ({ id: a.id, name: a.name })),
        readyLists: state.readyLists.map((l) => ({
          id: l.id,
          name: l.name,
          agencyId: l.agencyId,
        })),
        preferences: [],
        totalPersonsCount: state.persons.length,
      },
      mutations: {
        addPersonDirect,
        updatePersonConfirmed,
        createReadyList,
        addPersonsToReadyList,
        addExpense,
        upsertRelationEntry,
      },
      navigate: handleNavigate,
      selectAgency: (agencyId) => setSelectedAgencyId(agencyId),
      focusPerson: (personId) => setFocusedPersonId(personId),
      issueTableCommand: (cmd) =>
        setExternalTableCommand({
          ...cmd,
          nonce: Date.now(),
        }),
      setModeTier,
      setAppTheme: (appTheme) => setThemePrefs({ appTheme }),
      setDarkTheme,
      setAllowCloudNames: (allowed) =>
        setSecurityPrefs({ allowCloudBeneficiaryNames: allowed }),
      saveCalculationSettings: setCalculationSettings,
      applyAutoFixes: applyAssistantAutoFixes,
      archiveCurrentPeriod: () => {
        archiveCurrentPeriod({ isClosed: true, archiveSource: 'manual' });
      },
    },
    onExportBackupFile: handleDownloadBackupJson,
    canUndoApp: canUndo,
    onUndoAppAction: undo,
  });

  // Restore deep-linked Cosmos node on initial mount if URL hash is set
  const hashBootstrappedRef = useRef(false);
  useEffect(() => {
    if (hashBootstrappedRef.current) return;
    hashBootstrappedRef.current = true;
    try {
      const hash = window.location.hash || '';
      if (hash.startsWith('#node=')) {
        const nodeId = decodeURIComponent(hash.slice('#node='.length));
        const node = getCosmosNodeById(cosmosRoot, nodeId);
        if (node && node.id !== 'cosmos_hub') {
          handleNavigateHierarchyTarget(node.target, node.id);
        }
      }
    } catch {
      // ignore invalid hash
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 10-step Back/Forward Navigation History
  const [navHistory, setNavHistory] = useState<{
    stack: AppNavSnapshot[];
    index: number;
  }>(() => ({
    stack: [
      {
        view: 'hub',
        selectedAgencyId: state.agencies[0]?.id ?? 1,
        settingsSection: 'appearance',
        settingsScreenMode: 'hub',
        settingsCapsuleId: null,
        morrowTab: 'chat',
      },
    ],
    index: 0,
  }));
  const isRestoringHistoryRef = useRef(false);

  useEffect(() => {
    if (isRestoringHistoryRef.current) {
      isRestoringHistoryRef.current = false;
      return;
    }
    const snap: AppNavSnapshot = {
      view: activeView,
      selectedAgencyId,
      settingsSection,
      settingsScreenMode,
      settingsCapsuleId,
      morrowTab: assistant.activeCommandCenterTab,
    };
    setNavHistory((prev) => {
      const cur = prev.stack[prev.index];
      if (
        cur &&
        cur.view === snap.view &&
        cur.selectedAgencyId === snap.selectedAgencyId &&
        cur.settingsSection === snap.settingsSection &&
        cur.settingsScreenMode === snap.settingsScreenMode &&
        cur.settingsCapsuleId === snap.settingsCapsuleId &&
        cur.morrowTab === snap.morrowTab
      ) {
        return prev;
      }
      const trimmed = prev.stack.slice(0, prev.index + 1);
      const nextStack = [...trimmed, snap].slice(-10);
      return {
        stack: nextStack,
        index: nextStack.length - 1,
      };
    });
  }, [
    activeView,
    selectedAgencyId,
    settingsSection,
    settingsScreenMode,
    settingsCapsuleId,
    assistant.activeCommandCenterTab,
  ]);

  const applyNavSnapshot = (snap: AppNavSnapshot) => {
    isRestoringHistoryRef.current = true;
    setSelectedAgencyId(snap.selectedAgencyId);
    setSettingsSection(snap.settingsSection);
    setSettingsScreenMode(snap.settingsScreenMode);
    setSettingsCapsuleId(snap.settingsCapsuleId);
    assistant.setActiveCommandCenterTab(snap.morrowTab);
    setActiveView(snap.view);
  };

  const goBackHistory = () => {
    if (navHistory.index <= 0) return;
    const nextIdx = navHistory.index - 1;
    const targetSnap = navHistory.stack[nextIdx];
    if (!targetSnap) return;
    setNavHistory((prev) => ({ ...prev, index: nextIdx }));
    applyNavSnapshot(targetSnap);
  };

  const goForwardHistory = () => {
    if (navHistory.index >= navHistory.stack.length - 1) return;
    const nextIdx = navHistory.index + 1;
    const targetSnap = navHistory.stack[nextIdx];
    if (!targetSnap) return;
    setNavHistory((prev) => ({ ...prev, index: nextIdx }));
    applyNavSnapshot(targetSnap);
  };

  const activeCosmosNode = useMemo(
    () =>
      resolveCosmosNodeForTarget(cosmosRoot, {
        view: activeView,
        agencyId: activeView === 'agency_roster' ? selectedAgencyId : undefined,
        settingsSection: activeView === 'settings' ? settingsSection : undefined,
        settingsScreenMode: activeView === 'settings' ? settingsScreenMode : undefined,
        settingsCapsuleId: activeView === 'settings' ? settingsCapsuleId || undefined : undefined,
        morrowTab:
          activeView === 'morrow_center' ? assistant.activeCommandCenterTab : undefined,
      }),
    [
      cosmosRoot,
      activeView,
      selectedAgencyId,
      settingsSection,
      settingsScreenMode,
      settingsCapsuleId,
      assistant.activeCommandCenterTab,
    ]
  );

  const hierarchyBadgeContext = useMemo<HierarchyBadgeContext>(
    () => ({
      agenciesCount: state.agencies.length,
      personsCount: state.persons.length,
      auditIssuesCount,
      readyListsCount: state.readyLists.length,
      relationsCount: state.relations.length,
      archivesCount: monthlyArchives.length,
      pendingDraftsCount: assistant.pendingDraftsCount,
      recycleBinCount: recycleBin.length,
      activeThemeName: activeThemeLabel,
      activeTableThemeName: activeTableThemeLabel,
      activeFontName: activeFontLabel,
      fontSizePx: themePrefs.fontSizePx ?? 15,
      modeLabel: capabilities.label,
      feePerIndividualIqd: state.calculationSettings.feePerIndividualIqd,
      kgPerIndividual: state.calculationSettings.kgPerIndividual,
      settingsDisplayMode: generalPrefs.settingsDisplayMode || 'fullscreen',
      savedProfilesCount:
        themePrefs.savedProfiles?.length ?? DEFAULT_APPEARANCE_PROFILES.length,
      quickExtractFieldsCount: quickExtractPrefs.focusedFields.length,
      clarityThreshold: quickExtractPrefs.clarityThreshold,
      autoHideTopBar: state.topBarConfig.autoFocus,
      privacyLocked: securityPrefs.privacyLocked,
    }),
    [
      state.agencies.length,
      state.persons.length,
      auditIssuesCount,
      state.readyLists.length,
      state.relations.length,
      monthlyArchives.length,
      assistant.pendingDraftsCount,
      recycleBin.length,
      activeThemeLabel,
      activeTableThemeLabel,
      activeFontLabel,
      themePrefs.fontSizePx,
      themePrefs.savedProfiles,
      capabilities.label,
      state.calculationSettings.feePerIndividualIqd,
      state.calculationSettings.kgPerIndividual,
      generalPrefs.settingsDisplayMode,
      quickExtractPrefs.focusedFields.length,
      quickExtractPrefs.clarityThreshold,
      state.topBarConfig.autoFocus,
      securityPrefs.privacyLocked,
    ]
  );

  const openMorrowStudio = (tab: 'chat' | 'approvals' | 'memory' | 'quick_notes' = 'chat') => {
    if (activeView !== 'morrow_center' && activeView !== 'settings') {
      setPreviousView(activeView);
    }
    assistant.openCommandCenter(tab);
  };

  const openAiModelsStudio = () => {
    if (activeView !== 'settings') {
      setPreviousView(activeView);
    }
    assistant.setIsOpen(false);
    setSettingsSection('ai_assistant');
    setSettingsCapsuleId('sec_ai_assistant_cap');
    setSettingsScreenMode('detail');
    setActiveView('settings');
  };

  const backFromMorrowLabel = useMemo(() => {
    if (previousView === 'agency_roster') {
      return `العودة إلى ${currentAgency?.name || 'جدول الوكالة'}`;
    }
    if (previousView === 'master_roster') return 'العودة إلى الجدول الشامل';
    if (previousView === 'quick_extract') return 'العودة إلى السحب الذكي';
    if (previousView === 'ready_lists') return 'العودة إلى القوائم الجاهزة';
    if (previousView === 'relationships') return 'العودة إلى العلاقات';
    if (previousView === 'finance') return 'العودة إلى المالية';
    if (previousView === 'data_archives') return 'العودة إلى الأرشفة';
    if (previousView === 'account_security') return 'العودة إلى الحساب والأمان';
    return 'العودة إلى المركز';
  }, [previousView, currentAgency]);

  const isRosterViewingModeActive =
    tableViewingMode &&
    (activeView === 'agency_roster' || activeView === 'master_roster');

  const isDedicatedFullScreenView =
    activeView === 'settings' ||
    activeView === 'morrow_center' ||
    isRosterViewingModeActive;

  if (!authUser) {
    if (!onboardingDone) {
      return (
        <>
          <OnboardingFlow
            onComplete={() => {
              try {
                localStorage.setItem(getTenantOnboardingKey(null), '1');
              } catch {
                // ignore storage failures
              }
              setOnboardingDone(true);
            }}
          />
          <ToastHost toasts={toasts} onDismiss={dismissToast} />
        </>
      );
    }
    return (
      <>
        <FlipAuthGuard
          onAuthenticated={handleAuthenticated}
          onReplayOnboarding={() => setOnboardingDone(false)}
        />
        <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="ambient-obsidian-canvas relative flex min-h-screen flex-col [overflow-x:clip]">
      <div className="ambient-orb-gold ambient-orb-gold-1" />
      <div className="ambient-orb-gold ambient-orb-gold-2" />

      {!isDedicatedFullScreenView && (
        <TopBar
          capabilities={capabilities}
          authUser={authUser}
          canUndo={canUndo}
          canRedo={canRedo}
          effectiveMode={effectiveTopBarMode}
          isAutoHidden={isAutoHidden}
          activeView={activeView}
          activeViewLabel={activeViewLabel}
          activePeriodLabel={activePeriod?.quotaName}
          darkTheme={state.darkTheme}
          activeThemeName={activeThemeLabel}
          showViewTitle={state.topBarConfig.showViewTitle}
          showUndoRedo={state.topBarConfig.showUndoRedo}
          showAuthButton={state.topBarConfig.showAuthButton}
          agencies={state.agencies}
          persons={state.persons}
          readyLists={state.readyLists}
          relations={state.relations}
          ucrsSessions={ucrsSessions}
          hierarchyTree={hierarchyTree}
          pendingDraftsCount={assistant.pendingDraftsCount}
          onNavigateHome={() => handleNavigate('hub')}
          onNavigateView={handleNavigate}
          onOpenSettings={(sec) => handleNavigate('settings', sec)}
          onQuickAddPerson={() => {
            setAddDefaultAgencyId(currentAgency?.id ?? state.agencies[0]?.id ?? 1);
            setAddPersonOpen(true);
          }}
          onOpenColumnCustomizer={() => setColumnCustomizerOpen(true)}
          onOpenMorrowStudio={() => openMorrowStudio('chat')}
          onNavigateHierarchyTarget={handleNavigateHierarchyTarget}
          onSelectPersonFromSearch={(person) => {
            setSelectedAgencyId(person.agencyId);
            setFocusedPersonId(person.id);
            setActiveView('agency_roster');
            setExternalTableCommand({
              agencyId: person.agencyId,
              searchQuery: person.name,
              focusPersonId: person.id,
              nonce: Date.now(),
            });
          }}
          onSelectAgencyFromSearch={(agencyId) => {
            setSelectedAgencyId(agencyId);
            setActiveView('agency_roster');
          }}
          onUndo={undo}
          onRedo={redo}
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenMobileSidebar={() => setDrawerOpen(true)}
          onRequestReveal={() => setAutoScrollHidden(false)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          canGoBack={navHistory.index > 0}
          canGoForward={navHistory.index < navHistory.stack.length - 1}
          onGoBack={goBackHistory}
          onGoForward={goForwardHistory}
        />
      )}

      <div className="relative z-10 flex flex-1 min-h-0">
        {!isDedicatedFullScreenView && (
          <AppSidebar
            activeView={activeView}
            selectedAgencyId={selectedAgencyId}
            agencies={state.agencies}
            persons={state.persons}
            authUser={authUser}
            activePeriod={activePeriod}
            relationsCount={state.relations.length}
            readyListsCount={state.readyLists.length}
            archivesCount={monthlyArchives.length}
            pendingDraftsCount={assistant.pendingDraftsCount}
            compressionStats={compressionStats}
            calculationSettings={state.calculationSettings}
            capabilities={capabilities}
            collapsed={sidebarCollapsed}
            mobileOpen={drawerOpen}
            onToggleCollapse={toggleSidebarCollapsed}
            onCloseMobile={() => setDrawerOpen(false)}
            onNavigate={handleNavigate}
            onNavigateMorrowTab={(tab) => openMorrowStudio(tab)}
            onOpenAgencyRoster={(id) => {
              setSelectedAgencyId(id);
              setActiveView('agency_roster');
            }}
            onLogout={handleLogout}
          />
        )}

        <div
          key={activeView}
          className={`flex-1 min-w-0 flex flex-col tabrix-view-enter ${
            !isDedicatedFullScreenView ? 'pb-24' : ''
          }`}
        >
          {activeView === 'hub' && (
            <AgenciesHubView
              agencies={state.agencies}
              persons={state.persons}
              expenses={state.expenses}
              relations={state.relations}
              activePeriod={activePeriod}
              monthlyArchives={monthlyArchives}
              calculationSettings={state.calculationSettings}
              capabilities={capabilities}
              generalPrefs={generalPrefs}
              onUpdateGeneralPrefs={setGeneralPrefs}
              onAddExpense={addExpense}
              onOpenMasterRoster={() => setActiveView('master_roster')}
              onOpenAgencyRoster={(id) => {
                setSelectedAgencyId(id);
                setActiveView('agency_roster');
              }}
              onAddAgency={addAgencyDirect}
              onUpdateAgencyDetails={updateAgencyDetails}
              onNavigateView={handleNavigate}
              onLoadStarterData={loadStarterDemoData}
            />
          )}

      {activeView === 'agency_roster' && currentAgency && (
        <AgencyRosterView
          title={`${currentAgency.icon} ${currentAgency.name}`}
          agencyId={currentAgency.id}
          agencies={state.agencies}
          persons={state.persons}
          readyLists={state.readyLists}
          relations={state.relations}
          tableHeaders={state.tableHeaders}
          activePeriod={activePeriod}
          calculationSettings={state.calculationSettings}
          capabilities={capabilities}
          themePrefs={themePrefs}
          expertTableConfig={expertTableConfig}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onBackToHub={() => setActiveView('hub')}
          onUpdateTableHeaderMeta={updateTableHeaderMeta}
          onMovePersonsToAgency={movePersonsToAgencyConfirmed}
          onAddPersonsToReadyList={(listId, pids) =>
            addPersonsToReadyList(listId, pids)
          }
          onUpsertRelation={upsertRelationEntry}
          onOpenAddPerson={(agId) => {
            setAddDefaultAgencyId(agId);
            setAddPersonOpen(true);
          }}
          onOpenEditPerson={(person) => setEditingPerson(person)}
          onRequestDeletePerson={(person) =>
            handleRequestDelete({ kind: 'person', item: person })
          }
          onInlineUpdatePerson={updatePersonConfirmed}
          onBulkUpdateCategory={bulkUpdatePersonsCategory}
          onBulkDeletePersons={deletePersonsBulkConfirmed}
          onBulkUpdateStatusAndCategory={bulkUpdatePersonsStatusAndCategory}
          onCreateReadyListFromSelection={createReadyListFromSelection}
          columnCustomizerOpen={columnCustomizerOpen}
          onColumnCustomizerOpenChange={setColumnCustomizerOpen}
          onEnableExpertModeForCustomizer={() => setModeTier('expert')}
          onUpdateExpertTableConfig={setExpertTableConfig}
          onAddExpertCustomColumn={addExpertCustomColumn}
          onRemoveExpertCustomColumn={removeExpertCustomColumn}
          onResetExpertTableConfig={resetExpertTableConfig}
          onOpenSettings={() => handleNavigate('settings', 'modes')}
          externalTableCommand={externalTableCommand}
          onFocusedPersonChange={setFocusedPersonId}
          viewingMode={tableViewingMode}
          onViewingModeChange={setTableViewingMode}
        />
      )}

      {activeView === 'master_roster' && (
        <AgencyRosterView
          title="السجل الشامل — جميع الوكالات"
          agencyId={null}
          agencies={state.agencies}
          persons={state.persons}
          readyLists={state.readyLists}
          relations={state.relations}
          tableHeaders={state.tableHeaders}
          activePeriod={activePeriod}
          calculationSettings={state.calculationSettings}
          capabilities={capabilities}
          themePrefs={themePrefs}
          expertTableConfig={expertTableConfig}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onBackToHub={() => setActiveView('hub')}
          onUpdateTableHeaderMeta={updateTableHeaderMeta}
          onMovePersonsToAgency={movePersonsToAgencyConfirmed}
          onAddPersonsToReadyList={(listId, pids) =>
            addPersonsToReadyList(listId, pids)
          }
          onUpsertRelation={upsertRelationEntry}
          onOpenAddPerson={(agId) => {
            setAddDefaultAgencyId(agId);
            setAddPersonOpen(true);
          }}
          onOpenEditPerson={(person) => setEditingPerson(person)}
          onRequestDeletePerson={(person) =>
            handleRequestDelete({ kind: 'person', item: person })
          }
          onInlineUpdatePerson={updatePersonConfirmed}
          onBulkUpdateCategory={bulkUpdatePersonsCategory}
          onBulkDeletePersons={deletePersonsBulkConfirmed}
          onBulkUpdateStatusAndCategory={bulkUpdatePersonsStatusAndCategory}
          onCreateReadyListFromSelection={createReadyListFromSelection}
          columnCustomizerOpen={columnCustomizerOpen}
          onColumnCustomizerOpenChange={setColumnCustomizerOpen}
          onEnableExpertModeForCustomizer={() => setModeTier('expert')}
          onUpdateExpertTableConfig={setExpertTableConfig}
          onAddExpertCustomColumn={addExpertCustomColumn}
          onRemoveExpertCustomColumn={removeExpertCustomColumn}
          onResetExpertTableConfig={resetExpertTableConfig}
          onOpenSettings={() => handleNavigate('settings', 'modes')}
          externalTableCommand={externalTableCommand}
          onFocusedPersonChange={setFocusedPersonId}
          viewingMode={tableViewingMode}
          onViewingModeChange={setTableViewingMode}
        />
      )}

      {activeView === 'ready_lists' && (
        <ReadyListsView
          agencies={state.agencies}
          persons={state.persons}
          readyLists={state.readyLists}
          readyListItems={state.readyListItems}
          relations={state.relations}
          activePeriod={activePeriod}
          calculationSettings={state.calculationSettings}
          capabilities={capabilities}
          themePrefs={themePrefs}
          relationsPrefs={relationsPrefs}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onCreateReadyList={createReadyList}
          onUpdateListMetaConfirmed={updateReadyListMetaConfirmed}
          onRequestDeleteList={(list) =>
            handleRequestDelete({ kind: 'ready_list', item: list })
          }
          onAddReadyListItemDirect={addReadyListItemDirect}
          onAddPersonsToReadyList={addPersonsToReadyList}
          onMoveItemOrder={moveReadyListItemOrder}
          onUpdateItemConfirmed={updateReadyListItemConfirmed}
          onRequestDeleteItem={(item) =>
            handleRequestDelete({ kind: 'ready_item', item })
          }
          onBulkDeleteItems={deleteReadyListItemsBulkConfirmed}
          onMovePersonsToAgency={movePersonsToAgencyConfirmed}
          onUpsertRelation={upsertRelationEntry}
        />
      )}

      {activeView === 'relationships' && (
        <RelationshipsView
          agencies={state.agencies}
          persons={state.persons}
          relations={state.relations}
          readyLists={state.readyLists}
          tableHeaders={state.tableHeaders}
          calculationSettings={state.calculationSettings}
          canEditRecords={capabilities.canEditRecords}
          relationsPrefs={relationsPrefs}
          onUpdateTableHeaderMeta={updateTableHeaderMeta}
          onUpsertRelation={upsertRelationEntry}
          onRequestDeleteRelation={(rel) =>
            handleRequestDelete({ kind: 'relation', item: rel })
          }
          onMoveToAgency={movePersonsToAgencyConfirmed}
          onAddToReadyList={(listId, pids) =>
            addPersonsToReadyList(listId, pids)
          }
        />
      )}

      {activeView === 'finance' && capabilities.canViewFinance && (
        <FinanceWorkspaceView
          agencies={state.agencies}
          persons={state.persons}
          expenses={state.expenses}
          calculationSettings={state.calculationSettings}
          capabilities={capabilities}
          activePeriod={activePeriod}
          generalPrefs={generalPrefs}
          onUpdateGeneralPrefs={setGeneralPrefs}
          onAddExpense={addExpense}
          onRequestDeleteExpense={(expense) =>
            handleRequestDelete({ kind: 'expense', item: expense })
          }
        />
      )}

      {activeView === 'quick_extract' && capabilities.canUseQuickExtract && (
        <QuickExtractView
          agencies={state.agencies}
          persons={state.persons}
          readyLists={state.readyLists}
          readyListItems={state.readyListItems}
          relations={state.relations}
          calculationSettings={state.calculationSettings}
          themePrefs={themePrefs}
          quickExtractPrefs={quickExtractPrefs}
          defaultAgencyId={selectedAgencyId}
          ucrsSessions={ucrsSessions}
          ucrsLearningRules={ucrsLearningRules}
          onUpdateQuickExtractPrefs={setQuickExtractPrefs}
          onSaveQuickExtractTemplate={saveQuickExtractTemplate}
          onCommitQuickExtractPlan={commitQuickExtractPlan}
          onMovePersonsToAgency={movePersonsToAgencyConfirmed}
          onAddPersonsToReadyList={(listId, pids) =>
            addPersonsToReadyList(listId, pids)
          }
          onUpsertRelation={upsertRelationEntry}
          onUpsertUcrsSession={upsertUcrsSession}
          onDeleteUcrsSession={deleteUcrsSession}
          onUpsertUcrsLearningRule={upsertUcrsLearningRule}
          onToggleUcrsLearningRule={toggleUcrsLearningRule}
          onDeleteUcrsLearningRule={deleteUcrsLearningRule}
          onDoneNavigateToAgency={(agId) => {
            setSelectedAgencyId(agId);
            setActiveView('agency_roster');
          }}
          onNavigateToView={(view) => setActiveView(view)}
          initialQueuedFiles={pendingExtractFiles}
          taskRouting={assistant.assistantSettings.taskRouting}
          onOpenAiModelsStudio={openAiModelsStudio}
        />
      )}

      {activeView === 'data_archives' && (
        <DataArchivesView
          activePeriod={activePeriod}
          archives={monthlyArchives}
          capabilities={capabilities}
          authUser={authUser}
          onUpdateActivePeriod={updateActivePeriod}
          onArchiveCurrentPeriod={archiveCurrentPeriod}
          onStartNextMonthRollover={startNextMonthRollover}
          onMarkArchiveCloudSynced={markArchiveCloudSynced}
          onDeleteArchive={deleteMonthlyArchive}
          onSyncServer={syncWorkspaceToServer}
          onOpenAuth={() => setAuthModalOpen(true)}
        />
      )}

      {activeView === 'google_workspace' && (
        <GoogleWorkspaceView
          activePeriod={activePeriod}
          relations={state.relations}
          onAuthenticatedUser={handleAuthenticated}
        />
      )}

      {activeView === 'account_security' && (
        <AccountSecurityHubView
          state={state}
          authUser={authUser}
          requireLoginOnStart={state.requireLoginOnStart}
          securityPrefs={securityPrefs}
          recycleBin={recycleBin}
          workspaceNotes={workspaceNotes}
          onAuthenticated={handleAuthenticated}
          onLoggedOut={handleLogout}
          onToggleRequireLogin={setRequireLoginOnStart}
          onUpdateSecurityPrefs={setSecurityPrefs}
          onUpdateSmartSyncCheckpoint={updateSmartSyncCheckpoint}
          onAddNote={addWorkspaceNote}
          onUpdateNote={updateWorkspaceNote}
          onDeleteNote={deleteWorkspaceNote}
          onRestoreRecycleBinItem={restoreRecycleBinItem}
          onPurgeRecycleBinItem={purgeRecycleBinItem}
          onClearRecycleBin={clearRecycleBin}
          onImportWorkspaceJson={importWorkspaceJson}
          onSyncServer={syncWorkspaceToServer}
          onRestoreServer={restoreWorkspaceFromServer}
          onNotifySuccess={(msg) =>
            pushToast({ title: msg, tone: 'success' })
          }
          onNotifyError={(msg) =>
            pushToast({ title: msg, tone: 'error' })
          }
        />
      )}

      {activeView === 'morrow_center' && (
        <MorrowCommandCenterView
          activeTab={assistant.activeCommandCenterTab}
          onChangeTab={assistant.setActiveCommandCenterTab}
          brainMode={assistant.brainMode}
          onChangeBrainMode={assistant.setBrainMode}
          connectivity={assistant.connectivity}
          isThinking={assistant.isThinking}
          messages={assistant.messages}
          smartSuggestions={assistant.smartSuggestions}
          hasUndoableAction={assistant.hasUndoableAssistantMessage}
          onUndoLastAction={assistant.undoLastAssistantAction}
          onSendMessage={(prompt) => void assistant.sendMessage(prompt)}
          onChoiceClick={assistant.handleChoiceClick}
          onResolveDiff={assistant.resolveConfirmationDiff}
          onTriggerSpotlight={assistant.triggerSpotlight}
          approvalDrafts={assistant.approvalDrafts}
          onApproveDraft={assistant.approveDraft}
          onRejectDraft={assistant.rejectDraft}
          preferences={assistant.preferences}
          onSaveMemoryRule={assistant.saveCustomMemoryPref}
          onDeleteMemoryRule={assistant.deleteUserPref}
          agencies={state.agencies}
          persons={state.persons}
          quickNotes={assistant.quickNotes}
          onAddQuickNote={assistant.addQuickNote}
          onUpdateQuickNoteLink={assistant.updateQuickNoteLink}
          onSyncQuickNoteToPerson={assistant.syncQuickNoteToPerson}
          onDeleteQuickNote={assistant.deleteQuickNote}
          onJumpToPerson={(person) => {
            setSelectedAgencyId(person.agencyId);
            setFocusedPersonId(person.id);
            setActiveView('agency_roster');
            setExternalTableCommand({
              agencyId: person.agencyId,
              focusPersonId: person.id,
              nonce: Date.now(),
            });
          }}
          onBackToApp={() =>
            setActiveView(
              previousView === 'morrow_center' || previousView === 'settings'
                ? 'hub'
                : previousView
            )
          }
          backLabel={backFromMorrowLabel}
          activeAgencyId={selectedAgencyId}
          onSelectActiveAgency={(agId) => setSelectedAgencyId(agId)}
          activePeriodLabel={activePeriod?.quotaName}
          onNavigateView={handleNavigate}
          onTogglePinMessage={assistant.togglePinMessage}
          onExportChatHistory={assistant.exportChatHistoryJson}
          expenses={state.expenses}
          monthlyArchives={monthlyArchives}
          activePeriod={activePeriod}
          calculationSettings={state.calculationSettings}
          lastBackupAt={assistant.lastBackupAt}
          cloudConfigured={assistant.cloudConfigured}
          onStageToolDrafts={assistant.stageToolDrafts}
          onOpenAgencyRoster={(agId) => {
            setSelectedAgencyId(agId);
            setActiveView('agency_roster');
          }}
          initialCanvasMode={assistant.requestedCanvasHandoff || initialMorrowCanvas}
          collaborationMode={assistant.assistantSettings.collaborationMode}
          onChangeCollaborationMode={(mode) =>
            assistant.updateAssistantSettings({ collaborationMode: mode })
          }
          responseStyle={assistant.assistantSettings.responseStyle || 'balanced'}
          onChangeResponseStyle={(style) =>
            assistant.updateAssistantSettings({ responseStyle: style })
          }
          chatThreads={assistant.chatThreads}
          activeThreadId={assistant.activeThreadId}
          onSwitchThread={assistant.switchChatThread}
          onDeleteThread={assistant.deleteChatThread}
          onHandoffFilesToQuickExtract={(files) => {
            setPendingExtractFiles({ files, nonce: Date.now() });
            setActiveView('quick_extract');
          }}
          liveCloudContext={assistant.liveCloudContext}
          onLiveToolAction={assistant.handleLiveVoiceToolAction}
          onVerifySystemIntegrity={assistant.verifyMorrowSystemIntegrity}
          taskRouting={assistant.assistantSettings.taskRouting}
          onOpenAiModelsStudio={openAiModelsStudio}
          onCancelRequest={assistant.cancelActiveRequest}
          onClearMessages={assistant.clearMessages}
          onRetryLastPrompt={assistant.retryLastPrompt}
          modelHealthSnapshots={assistant.modelHealthSnapshots}
          canViewFinance={capabilities.canViewFinance}
          canUseQuickExtract={capabilities.canUseQuickExtract}
        />
      )}

      {activeView === 'settings' && (
        <SettingsView
          activeSection={settingsSection}
          screenMode={settingsScreenMode}
          onChangeScreenMode={(mode) => {
            setSettingsScreenMode(mode);
            if (mode === 'hub') setSettingsCapsuleId(null);
          }}
          onChangeSection={(sec) => {
            setSettingsSection(sec);
            setSettingsCapsuleId(null);
          }}
          activeCapsuleId={settingsCapsuleId}
          onChangeCapsuleId={setSettingsCapsuleId}
          spotlightNodeId={spotlightNodeId}
          hierarchyTree={hierarchyTree}
          badgeContext={hierarchyBadgeContext}
          onNavigateHierarchyTarget={handleNavigateHierarchyTarget}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onBackToApp={() =>
            setActiveView(previousView === 'settings' ? 'hub' : previousView)
          }
          onNavigateAppView={(view) => handleNavigate(view)}
          state={state}
          modeTier={state.modeTier}
          editorEnabled={state.editorEnabled}
          darkTheme={state.darkTheme}
          requireLoginOnStart={state.requireLoginOnStart}
          calculationSettings={state.calculationSettings}
          themePrefs={themePrefs}
          topBarConfig={state.topBarConfig}
          expertTableConfig={expertTableConfig}
          quickExtractPrefs={quickExtractPrefs}
          relationsPrefs={relationsPrefs}
          generalPrefs={generalPrefs}
          securityPrefs={securityPrefs}
          recycleBin={recycleBin}
          authUser={authUser}
          onChangeModeTier={setModeTier}
          onToggleEditor={setEditorEnabled}
          onToggleDarkTheme={setDarkTheme}
          onToggleRequireLogin={setRequireLoginOnStart}
          onSaveCalculationSettings={setCalculationSettings}
          onUpdateThemePrefs={setThemePrefs}
          onResetThemePrefs={resetThemePrefs}
          onSaveAppearanceProfile={saveAppearanceProfile}
          onApplyAppearanceProfile={applyAppearanceProfile}
          onDeleteAppearanceProfile={deleteAppearanceProfile}
          onChangeTopBarConfig={setTopBarConfig}
          onUpdateExpertTableConfig={setExpertTableConfig}
          onResetExpertTableConfig={resetExpertTableConfig}
          onUpdateQuickExtractPrefs={setQuickExtractPrefs}
          onDeleteQuickExtractTemplate={deleteQuickExtractTemplate}
          onUpdateRelationsPrefs={setRelationsPrefs}
          onUpdateGeneralPrefs={setGeneralPrefs}
          onUpdateSecurityPrefs={setSecurityPrefs}
          onRestoreRecycleBinItem={restoreRecycleBinItem}
          onPurgeRecycleBinItem={purgeRecycleBinItem}
          onClearRecycleBin={clearRecycleBin}
          onImportWorkspaceJson={importWorkspaceJson}
          onSyncServer={syncWorkspaceToServer}
          onRestoreServer={restoreWorkspaceFromServer}
          onOpenAuth={() => setAuthModalOpen(true)}
          assistantSettings={assistant.assistantSettings}
          assistantConnectivity={assistant.connectivity}
          assistantQuotaInfo={assistant.quotaInfo}
          assistantCacheCount={assistant.cacheCount}
          onUpdateAssistantSettings={assistant.updateAssistantSettings}
          onResetAssistantQuota={assistant.resetQuotaStats}
          onClearAssistantCache={assistant.clearResponseCache}
          workspaceCosmos={workspaceCosmos}
          rootCosmos={cosmosRoot}
          migrationSnapshot={state.migrationSnapshot}
          onUpdateAccessibilityPrefs={updateAccessibilityPrefs}
          onUpdateFeatureFlags={updateFeatureFlags}
          onUpdateCosmosExperienceMode={(mode) =>
            updateAccessibilityPrefs({ experienceMode: mode })
          }
          onTogglePinnedNode={togglePinnedCosmosNode}
          onSaveCustomTheme={saveCustomThemePreset}
          onDeleteCustomTheme={deleteCustomThemePreset}
          onToggleHiddenWorld={toggleHiddenCosmosWorld}
          onRestoreMigrationSnapshot={restorePreMigrationSnapshot}
          onAppendChangeLog={appendWorldChangeLog}
          onRunAutoFix={() => applyAssistantAutoFixes()}
          onOpenWorldSwitcher={() => setWorldSwitcherOpen(true)}
          onSelectCosmosNode={handleSelectCosmosNode}
        />
      )}
        </div>
      </div>

      {/* Editor Modals */}
      <AddPersonModal
        open={addPersonOpen}
        agencies={state.agencies}
        defaultAgencyId={addDefaultAgencyId}
        onClose={() => setAddPersonOpen(false)}
        onSubmitDirect={addPersonDirect}
      />

      <EditPersonModal
        person={editingPerson}
        agencies={state.agencies}
        customCategories={expertTableConfig.customCategories}
        requireEditConfirm={capabilities.requireEditConfirm}
        onClose={() => setEditingPerson(null)}
        onSaveWithConfirm={updatePersonConfirmed}
      />

      <DeleteConfirmModal
        targetLabel={
          deleteTarget
            ? deleteTarget.kind === 'person'
              ? `المستفيد: ${deleteTarget.item.name}`
              : deleteTarget.kind === 'expense'
              ? `المصروف: ${deleteTarget.item.description}`
              : deleteTarget.kind === 'ready_list'
              ? `القائمة الجاهزة: ${deleteTarget.item.name}`
              : deleteTarget.kind === 'relation'
              ? `سجل العلاقة: ${deleteTarget.item.personName}`
              : `عضو القائمة: ${deleteTarget.item.name}`
            : null
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirmDelete={() => {
          if (!deleteTarget) return;
          executeDeleteTarget(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      {/* Multi-Login Modal (Gmail, Username, Phone) */}
      <AuthModal
        open={authModalOpen}
        lockedGate={false}
        currentUser={authUser}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
        onLoggedOut={handleLogout}
      />

      {/* Privacy Lock Overlay */}
      {securityPrefs.privacyLocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="شاشة مقفلة للخصوصية"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <form
            onSubmit={handleUnlockPrivacy}
            className="nexus-squircle w-full max-w-sm p-6 text-center space-y-4"
            style={{
              borderColor: 'var(--accent)',
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">شاشة مقفلة للخصوصية — Morrow</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {securityPrefs.privacyPin
                  ? 'أدخل رمز القفل لإظهار السجلات والبيانات.'
                  : 'انقر على «فتح القفل» للعودة إلى البيانات.'}
              </p>
            </div>

            {securityPrefs.privacyPin && (
              <div>
                <input
                  type="password"
                  dir="ltr"
                  autoFocus
                  value={unlockPinInput}
                  onChange={(e) => {
                    setUnlockPinInput(e.target.value);
                    setUnlockPinError('');
                  }}
                  placeholder="رمز القفل..."
                  className="w-full rounded-xl border px-3 py-2.5 text-center text-sm tracking-widest tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                {unlockPinError && (
                  <p
                    className="mt-1.5 text-xs font-bold"
                    style={{ color: 'var(--danger)' }}
                  >
                    {unlockPinError}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="nexus-pill-btn inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Unlock className="h-4 w-4" />
              <span>فتح القفل</span>
            </button>
          </form>
        </div>
      )}

      {/* Integrated 3-Brain AI Assistant Widget */}
      {!isAuthGateLocked && !securityPrefs.privacyLocked && (
        <AssistantWidget
          isOpen={assistant.isOpen}
          onToggleOpen={assistant.setIsOpen}
          brainMode={assistant.brainMode}
          onChangeBrainMode={assistant.setBrainMode}
          connectivity={assistant.connectivity}
          isThinking={assistant.isThinking}
          messages={assistant.messages}
          proactiveTip={assistant.proactiveTip}
          preferences={assistant.preferences}
          onDeletePref={assistant.deleteUserPref}
          queuedTasks={assistant.queuedTasks}
          onSaveToQueue={assistant.savePromptToQueue}
          onRunQueuedTask={assistant.runQueuedTask}
          onRemoveQueuedTask={assistant.removeQueuedTask}
          spotlight={assistant.spotlight}
          onDismissSpotlight={assistant.dismissSpotlight}
          onTriggerSpotlight={assistant.triggerSpotlight}
          onSendMessage={assistant.sendMessage}
          onChoiceClick={assistant.handleChoiceClick}
          onResolveDiff={assistant.resolveConfirmationDiff}
          focusedPersonName={focusedPersonName}
          smartSuggestions={assistant.smartSuggestions}
          assistantSettings={assistant.assistantSettings}
          quotaInfo={assistant.quotaInfo}
          hasUndoableAction={assistant.hasUndoableAssistantMessage}
          onUndoLastAction={assistant.undoLastAssistantAction}
          pendingDraftsCount={assistant.pendingDraftsCount}
          onOpenCommandCenter={openMorrowStudio}
          onTriggerCanvasHandoff={(handoff) =>
            assistant.openCanvasMode(handoff.canvasMode, handoff.agencyId)
          }
          collaborationMode={assistant.assistantSettings.collaborationMode}
          onChangeCollaborationMode={(mode) =>
            assistant.updateAssistantSettings({ collaborationMode: mode })
          }
          hideLauncher={
            activeView === 'morrow_center' || isRosterViewingModeActive
          }
          onQuickCameraExtract={() => {
            if (capabilities.canUseQuickExtract) {
              assistant.setIsOpen(false);
              handleNavigate('quick_extract');
            }
          }}
          onQuickBackupJson={() => handleDownloadBackupJson(false)}
          onTogglePinMessage={assistant.togglePinMessage}
          onExportChatHistory={assistant.exportChatHistoryJson}
          onOpenAssistantSettings={openAiModelsStudio}
          onCancelRequest={assistant.cancelActiveRequest}
          onClearMessages={assistant.clearMessages}
          onRetryLastPrompt={assistant.retryLastPrompt}
          modelHealthSnapshots={assistant.modelHealthSnapshots}
        />
      )}

      {/* Global Ctrl+K Command Palette */}
      {!isAuthGateLocked && !securityPrefs.privacyLocked && (
        <CommandPaletteModal
          open={commandPaletteOpen}
          darkTheme={state.darkTheme}
          brainMode={assistant.brainMode}
          agencies={state.agencies}
          persons={state.persons}
          pendingDraftsCount={assistant.pendingDraftsCount}
          hierarchyTree={hierarchyTree}
          onNavigateHierarchyTarget={handleNavigateHierarchyTarget}
          cosmosTree={cosmosRoot}
          onSelectCosmosNode={handleSelectCosmosNode}
          onOpenWorldSwitcher={() => setWorldSwitcherOpen(true)}
          onClose={() => setCommandPaletteOpen(false)}
          onChangeBrainMode={assistant.setBrainMode}
          onNavigateView={handleNavigate}
          onOpenCommandCenterTab={openMorrowStudio}
          onSelectAgency={(agId) => setSelectedAgencyId(agId)}
          onSelectPerson={(person) => {
            setSelectedAgencyId(person.agencyId);
            setFocusedPersonId(person.id);
            setActiveView('agency_roster');
            setExternalTableCommand({
              agencyId: person.agencyId,
              searchQuery: person.name,
              focusPersonId: person.id,
              nonce: Date.now(),
            });
          }}
          onSendAssistantPrompt={(prompt) => {
            void assistant.sendMessage(prompt, { fromFloatingWidget: true });
          }}
        />
      )}

      {/* Fast Cosmos World Switcher & Orbital Map */}
      {!isAuthGateLocked && !securityPrefs.privacyLocked && (
        <Switcher
          open={worldSwitcherOpen}
          onClose={() => setWorldSwitcherOpen(false)}
          root={cosmosRoot}
          activeWorldId={activeCosmosNode.worldId}
          hiddenWorldIds={workspaceCosmos.hiddenWorldIds}
          enableOrbitalMode={workspaceCosmos.featureFlags.orbitalMapView}
          onSelectNode={handleSelectCosmosNode}
          onToggleHiddenWorld={toggleHiddenCosmosWorld}
        />
      )}

      {/* Floating Smoked-Glass Navigation Dock (hidden in dedicated Full-Screen views) */}
      {!isAuthGateLocked && !securityPrefs.privacyLocked && !isDedicatedFullScreenView && (
        <CosmosBottomNav
          activeView={activeView}
          canAddPerson={capabilities.canEditRecords}
          canUseQuickExtract={capabilities.canUseQuickExtract}
          onNavigateView={handleNavigate}
          onQuickAddPerson={() => {
            setAddDefaultAgencyId(currentAgency?.id ?? state.agencies[0]?.id ?? 1);
            setAddPersonOpen(true);
          }}
          onOpenAssistant={() => openMorrowStudio('chat')}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          pendingDraftsCount={assistant.pendingDraftsCount}
        />
      )}

      {/* Discreet Background & Stealth Execution Toast Stack */}
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
