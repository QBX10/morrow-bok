import { useEffect, useMemo, useState } from 'react';
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
import { HierarchyBreadcrumbBar } from './components/HierarchyBreadcrumbBar';
import { ToastHost } from './components/ToastHost';
import { useAgencyStore } from './hooks/useAgencyStore';
import { useAssistantEngine } from './hooks/useAssistantEngine';
import { useToastQueue } from './hooks/useToastQueue';
import { getStoredSession } from './lib/authClient';
import type { AssistantExternalTableCommand } from './types/assistant';
import type {
  AgencyExpense,
  AppView,
  AuthUser,
  Person,
  ReadyList,
  ReadyListItem,
  RelationEntry,
  SettingsSectionId,
  TopBarAutoFocusAction,
  TopBarFocusMode,
} from './types/agency';
import { auditAgencyPersons } from './utils/agencyLogic';
import {
  buildMorrowHierarchyTree,
  resolveActiveHierarchyNodeId,
  type HierarchyBadgeContext,
  type HierarchyTarget,
} from './utils/hierarchyRegistry';
import { getModeCapabilities } from './utils/modePermissions';
import { APP_THEMES, resolveAppThemeId } from './utils/themes';

type DeleteTarget =
  | { kind: 'person'; item: Person }
  | { kind: 'expense'; item: AgencyExpense }
  | { kind: 'ready_item'; item: ReadyListItem }
  | { kind: 'ready_list'; item: ReadyList }
  | { kind: 'relation'; item: RelationEntry };

export default function App() {
  const {
    state,
    activePeriod,
    monthlyArchives,
    themePrefs,
    expertTableConfig,
    quickExtractPrefs,
    relationsPrefs,
    generalPrefs,
    securityPrefs,
    recycleBin,
    canUndo,
    canRedo,
    undo,
    redo,
    setModeTier,
    setEditorEnabled,
    setDarkTheme,
    setThemePrefs,
    resetThemePrefs,
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
  } = useAgencyStore();

  const [activeView, setActiveView] = useState<AppView>('hub');
  const [previousView, setPreviousView] = useState<AppView>('hub');
  const [settingsSection, setSettingsSection] =
    useState<SettingsSectionId>('appearance');
  const [settingsScreenMode, setSettingsScreenMode] = useState<'hub' | 'detail'>(
    'hub'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  const [scrolledDown, setScrolledDown] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [manualReveal, setManualReveal] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number>(
    state.agencies[0]?.id ?? 1
  );

  // Privacy lock overlay input state
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [unlockPinError, setUnlockPinError] = useState('');

  // Multi-Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(
    () => getStoredSession()?.user || null
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);

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

  const capabilities = useMemo(
    () =>
      getModeCapabilities(
        state.modeTier,
        state.editorEnabled,
        expertTableConfig.allowDirectNoConfirmEdit,
        generalPrefs.confirmBeforeEdit,
        generalPrefs.confirmBeforeDelete
      ),
    [
      state.modeTier,
      state.editorEnabled,
      expertTableConfig.allowDirectNoConfirmEdit,
      generalPrefs.confirmBeforeEdit,
      generalPrefs.confirmBeforeDelete,
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
    setScrolledDown(false);
    setManualReveal(false);
    setInputFocused(false);
  }, [activeView]);

  useEffect(() => {
    if (!state.topBarConfig.autoFocus) {
      setScrolledDown(false);
      setInputFocused(false);
      setManualReveal(false);
      return;
    }

    const isFocusableField = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      if (!el.closest('main')) return false;
      if (el.isContentEditable) return true;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
      if (el.tagName === 'INPUT') {
        const type = (el as HTMLInputElement).type.toLowerCase();
        return ![
          'checkbox',
          'radio',
          'file',
          'button',
          'submit',
          'reset',
          'color',
        ].includes(type);
      }
      return false;
    };

    const onScroll = () => {
      const next = window.scrollY > 60;
      setScrolledDown(next);
      if (!next) {
        setManualReveal(false);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isFocusableField(e.target)) {
        setManualReveal(false);
        setInputFocused(true);
      }
    };

    const onFocusOut = () => {
      requestAnimationFrame(() => {
        setInputFocused(isFocusableField(document.activeElement));
      });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 10 && window.scrollY > 60) {
        setManualReveal(true);
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [state.topBarConfig.autoFocus]);

  const isTableView = [
    'agency_roster',
    'master_roster',
    'ready_lists',
    'relationships',
    'quick_extract',
  ].includes(activeView);

  const autoTriggerActive =
    state.topBarConfig.autoFocus &&
    !manualReveal &&
    (scrolledDown ||
      inputFocused ||
      (Boolean(state.topBarConfig.autoHideInTables) && isTableView));

  const autoAction: TopBarAutoFocusAction =
    state.topBarConfig.autoFocusAction || 'hide';

  const isAutoHidden =
    state.topBarConfig.mode !== 'hidden' &&
    autoTriggerActive &&
    autoAction === 'hide';

  const effectiveTopBarMode: TopBarFocusMode =
    state.topBarConfig.mode === 'hidden'
      ? 'hidden'
      : isAutoHidden
      ? 'hidden'
      : state.topBarConfig.mode === 'compact'
      ? 'compact'
      : autoTriggerActive && autoAction === 'compact'
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
    return 'إعدادات التطبيق';
  }, [activeView, currentAgency]);

  const isAuthGateLocked = Boolean(state.requireLoginOnStart && !authUser);

  const handleNavigate = (
    view: AppView,
    nextSettingsSection?: SettingsSectionId
  ) => {
    if (view !== 'agency_roster' && view !== 'master_roster') {
      setColumnCustomizerOpen(false);
    }
    if (view === 'settings') {
      if (activeView !== 'settings') {
        setPreviousView(activeView);
      }
      if (nextSettingsSection) {
        setSettingsSection(nextSettingsSection);
        setSettingsScreenMode('detail');
      } else {
        setSettingsScreenMode('hub');
      }
    }
    setActiveView(view);
  };

  const hierarchyTree = useMemo(
    () => buildMorrowHierarchyTree(state.agencies),
    [state.agencies]
  );

  const auditIssuesCount = useMemo(
    () => auditAgencyPersons(state.persons).length,
    [state.persons]
  );

  const activeThemeLabel = useMemo(() => {
    const resolvedId = resolveAppThemeId(themePrefs.appTheme);
    return APP_THEMES.find((t) => t.id === resolvedId)?.name || 'كلاسيكي';
  }, [themePrefs.appTheme]);

  const handleNavigateHierarchyTarget = (target: HierarchyTarget) => {
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
      setColumnCustomizerOpen(false);
      setActiveView('settings');
      return;
    }

    if (target.view === 'morrow_center' && target.morrowTab) {
      assistant.setActiveCommandCenterTab(target.morrowTab);
    }

    if (target.openColumnCustomizer) {
      setColumnCustomizerOpen(true);
    } else {
      setColumnCustomizerOpen(false);
    }

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

  const { toasts, dismissToast } = useToastQueue();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
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
      applyAutoFixes: applyAssistantAutoFixes,
      archiveCurrentPeriod: () => {
        archiveCurrentPeriod({ isClosed: true, archiveSource: 'manual' });
      },
    },
    onExportBackupFile: handleDownloadBackupJson,
    canUndoApp: canUndo,
    onUndoAppAction: undo,
  });

  const activeHierarchyNodeId = useMemo(
    () =>
      resolveActiveHierarchyNodeId({
        activeView,
        selectedAgencyId,
        settingsSection,
        settingsScreenMode,
        morrowTab: assistant.activeCommandCenterTab,
        columnCustomizerOpen,
      }),
    [
      activeView,
      selectedAgencyId,
      settingsSection,
      settingsScreenMode,
      assistant.activeCommandCenterTab,
      columnCustomizerOpen,
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
      modeLabel: capabilities.label,
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
      capabilities.label,
    ]
  );

  const renderedHierarchyBar = (
    <HierarchyBreadcrumbBar
      tree={hierarchyTree}
      activeNodeId={activeHierarchyNodeId}
      badgeContext={hierarchyBadgeContext}
      onNavigateTarget={handleNavigateHierarchyTarget}
    />
  );

  return (
    <div className="flex min-h-screen flex-col [overflow-x:clip]">
      {activeView !== 'settings' && (
        <TopBar
          capabilities={capabilities}
          authUser={authUser}
          darkTheme={state.darkTheme}
          canUndo={canUndo}
          canRedo={canRedo}
          topBarConfig={state.topBarConfig}
          effectiveMode={effectiveTopBarMode}
          isAutoHidden={isAutoHidden}
          activeViewLabel={activeViewLabel}
          agencies={state.agencies}
          persons={state.persons}
          readyLists={state.readyLists}
          relations={state.relations}
          ucrsSessions={ucrsSessions}
          onToggleDarkTheme={setDarkTheme}
          onChangeTopBarConfig={(patch) => {
            setManualReveal(false);
            setTopBarConfig(patch);
          }}
          onNavigateHome={() => handleNavigate('hub')}
          onNavigateView={handleNavigate}
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
          onRequestReveal={() => setManualReveal(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
      )}

      <div className="flex flex-1 min-h-0">
        {activeView !== 'settings' && (
          <AppSidebar
            activeView={activeView}
            selectedAgencyId={selectedAgencyId}
            agencies={state.agencies}
            persons={state.persons}
            activePeriod={activePeriod}
            relationsCount={state.relations.length}
            readyListsCount={state.readyLists.length}
            archivesCount={monthlyArchives.length}
            pendingDraftsCount={assistant.pendingDraftsCount}
            calculationSettings={state.calculationSettings}
            capabilities={capabilities}
            themePrefs={themePrefs}
            collapsed={sidebarCollapsed}
            mobileOpen={drawerOpen}
            onToggleCollapse={toggleSidebarCollapsed}
            onCloseMobile={() => setDrawerOpen(false)}
            onNavigate={handleNavigate}
            onOpenAgencyRoster={(id) => {
              setSelectedAgencyId(id);
              setActiveView('agency_roster');
            }}
            onSelectAppTheme={(appTheme) => setThemePrefs({ appTheme })}
          />
        )}

        <div key={activeView} className="flex-1 min-w-0 flex flex-col tabrix-view-enter">
          {activeView !== 'settings' && renderedHierarchyBar}

          {activeView === 'hub' && (
            <AgenciesHubView
              agencies={state.agencies}
              persons={state.persons}
              expenses={state.expenses}
              activePeriod={activePeriod}
              readyListsCount={state.readyLists.length}
              relationsCount={state.relations.length}
              calculationSettings={state.calculationSettings}
              capabilities={capabilities}
              hierarchyTree={hierarchyTree}
              hierarchyBadgeContext={hierarchyBadgeContext}
              onNavigateHierarchyTarget={handleNavigateHierarchyTarget}
              onOpenMasterRoster={() => setActiveView('master_roster')}
              onOpenAgencyRoster={(id) => {
                setSelectedAgencyId(id);
                setActiveView('agency_roster');
              }}
              onNavigateView={(v, sec) => handleNavigate(v, sec)}
              onAddAgency={addAgencyDirect}
              onUpdateAgencyDetails={updateAgencyDetails}
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
          onAuthenticatedUser={(user) => setAuthUser(user)}
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
        />
      )}

      {activeView === 'settings' && (
        <SettingsView
          activeSection={settingsSection}
          screenMode={settingsScreenMode}
          onChangeScreenMode={setSettingsScreenMode}
          onChangeSection={setSettingsSection}
          onBackToApp={() =>
            setActiveView(previousView === 'settings' ? 'hub' : previousView)
          }
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
          hierarchyBar={renderedHierarchyBar}
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
        open={authModalOpen || isAuthGateLocked}
        lockedGate={isAuthGateLocked}
        currentUser={authUser}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(user) => setAuthUser(user)}
        onLoggedOut={() => setAuthUser(null)}
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
            className="w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
              color: 'var(--text-primary)',
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border"
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
                  className="w-full rounded-lg border px-3 py-2 text-center text-sm tracking-widest tabular-nums"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold"
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
          onOpenCommandCenter={assistant.openCommandCenter}
          onOpenAssistantSettings={() => {
            assistant.setIsOpen(false);
            setPreviousView(activeView);
            setSettingsSection('security_data');
            setSettingsScreenMode('detail');
            setActiveView('settings');
          }}
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
          onClose={() => setCommandPaletteOpen(false)}
          onChangeBrainMode={assistant.setBrainMode}
          onNavigateView={handleNavigate}
          onOpenCommandCenterTab={assistant.openCommandCenter}
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

      {/* Discreet Background & Stealth Execution Toast Stack */}
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
