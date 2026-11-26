import { useCallback, useEffect, useRef, useState } from 'react';
import { runWithSignatureLoader } from '../utils/delayedLoader.ts';
import {
  DEFAULT_EXPERT_TABLE_CONFIG,
  DEFAULT_GENERAL_PREFS,
  DEFAULT_QUICK_EXTRACT_PREFS,
  DEFAULT_RELATIONS_PREFS,
  DEFAULT_SECURITY_PREFS,
  DEFAULT_WORKSPACE_COSMOS,
} from '../data/seedData';
import { emitAppToast } from './useToastQueue';
import { audioManager } from '../services/audio/AudioManager';
import {
  deleteServerAppearanceProfile,
  fetchStorageStatusApi,
  fetchWorkspaceSnapshotApi,
  getStoredSession,
  pushSyncQueueOpsApi,
  pushWorkspaceLwwApi,
  saveServerAppearanceProfile,
} from '../lib/authClient';
import {
  deleteAppearanceProfileFromFirestore,
  saveAppearanceProfileToFirestore,
  syncWorkspaceSummaryToFirestore,
} from '../lib/firestoreSync';
import {
  createServerChunkTransport,
  fetchStorageQuotaApi,
} from '../lib/securityClient';
import type { CompressionStats } from '../services/compression/compressionEngine';
import {
  buildContentAddressedChunks,
  uploadChunkedWithDedupAndResume,
} from '../services/storage/chunkSyncEngine';
import { mergeWorkspacesCrdt, tickHlc } from '../services/storage/crdtEngine';
import {
  appendAuditCheckpointEvents,
  createAuditCheckpointEvent,
  createMemoryVaultExport,
  parseMemoryVaultImport,
} from '../services/storage/memoryVault';
import {
  createRealtimeSyncSocket,
  triggerBrowserSecurityNotification,
} from '../services/storage/realtimeSyncClient';
import {
  enqueueSyncOperation,
  getOrCreateDeviceId,
  loadSyncQueue,
  markSyncQueueStatus,
  pruneSyncedQueueOperations,
  reconcileWorkspaceLww,
} from '../services/storage/syncEngine';
import {
  getCleanTenantInitialState,
  loadTenantWorkspace,
  saveTenantWorkspace,
  saveTenantWorkspaceSync,
} from '../services/storage/tenantStorage';
import type {
  AccessibilityAndExperiencePrefs,
  Agency,
  AgencyExpense,
  AppearanceProfile,
  AppDatabaseState,
  AppModeTier,
  AuditCheckpointEvent,
  BlockScope,
  CalculationSettings,
  CustomThemePreset,
  ExpenseCategory,
  ExpertCustomColumn,
  ExpertTableConfig,
  FeatureFlagsMap,
  FreeformHeaderConfig,
  GeneralAppPrefs,
  MigrationSnapshotRecord,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
  QuickExtractCommitBucketSummary,
  QuickExtractCommitSummary,
  QuickExtractEvaluatedRow,
  QuickExtractPrefs,
  QuickExtractReferenceTemplate,
  QuickExtractRoutingConfig,
  ReadyList,
  ReadyListItem,
  RelationCategory,
  RelationEntry,
  RelationsReadyListsPrefs,
  SectionTableHeaderMeta,
  SecurityPrefs,
  SmartPreferencesMemory,
  SmartSyncCheckpoint,
  StorageQuotaInfo,
  StorageSystemStatus,
  Surface2DPrefs,
  Surface2DThemeId,
  SyncQueueOperation,
  ThemePreferences,
  TopBarConfig,
  UcrsLearningRule,
  UcrsSession,
  WorkspaceSyncStatus,
  WorldChangeLogEntry,
  WorkspaceCosmosState,
  WorkspaceNoteCategory,
  WorkspaceNoteItem,
} from '../types/agency';
import { DEFAULT_CALCULATION_SETTINGS, normalizeArabic } from '../utils/agencyLogic';
import { applyDiagnosticAutoFixes } from '../utils/assistantDiagnostics';
import {
  createMonthlyArchiveSnapshot,
  prepareNextMonthRollover,
  resolvePeriodMeta,
} from '../utils/archiveLogic';
import {
  computeAdjustedIndividuals,
  computeQuickExtractRoutingPlan,
  findExistingMatchInAgency,
} from '../utils/quickExtractEngine';
import {
  pruneExpiredRecycleBinEntries,
  pushRecycleBinEntry,
  restoreAllRecycleBinEntriesFromState,
  restoreRecycleBinEntryFromState,
} from '../utils/recycleBin';
import {
  applyThemePreferencesToDocument,
  DEFAULT_APPEARANCE_PROFILES,
  DEFAULT_THEME_PREFERENCES,
  getAppShapeById,
  getEffectiveAppTheme,
  resolveAppShapeId,
  resolveAppThemeId,
  resolveArabicFontId,
  resolveTableThemeId,
} from '../utils/themes';
import {
  applySurface2DPrefsToDocument,
  mapAppThemeToSurfaceTheme,
  mapSurfaceThemeToAppTheme,
  resolveSurface2DPrefs,
} from '../utils/surface2dConfig';

const DEFAULT_MAX_UNDO_HISTORY = 35;

interface DataSnapshot {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  readyLists: ReadyList[];
  readyListItems: ReadyListItem[];
  relations: RelationEntry[];
  tableHeaders: Record<string, SectionTableHeaderMeta>;
  calculationSettings?: CalculationSettings;
}

function pickDataSnapshot(state: AppDatabaseState): DataSnapshot {
  return {
    agencies: state.agencies,
    persons: state.persons,
    expenses: state.expenses,
    readyLists: state.readyLists,
    readyListItems: state.readyListItems,
    relations: state.relations,
    tableHeaders: state.tableHeaders,
    calculationSettings: state.calculationSettings,
  };
}

function normalizeReadyLists(
  lists: Partial<ReadyList>[],
  agencies: Agency[]
): ReadyList[] {
  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
  const today = new Date().toISOString().slice(0, 10);
  return lists.map((l, idx) => ({
    id: l.id ?? idx + 1,
    agencyId: l.agencyId ?? agencies[0]?.id ?? 1,
    name: l.name || 'قائمة جاهزة',
    listDate: l.listDate || l.createdAt || today,
    subtitle1:
      l.subtitle1 ??
      (l.agencyId ? `الوكالة: ${agencyMap.get(l.agencyId) || ''}` : ''),
    subtitle2: l.subtitle2 ?? l.note ?? '',
    autoUpdateDate: l.autoUpdateDate ?? false,
    lastUpdatedAt: l.lastUpdatedAt || l.listDate || l.createdAt || today,
    createdAt: l.createdAt || l.listDate || today,
    note: l.note ?? l.subtitle2 ?? '',
  }));
}

function mergeWorkspaceCosmos(raw?: Partial<WorkspaceCosmosState>): WorkspaceCosmosState {
  return {
    ...DEFAULT_WORKSPACE_COSMOS,
    ...(raw || {}),
    pinnedNodeIds: Array.isArray(raw?.pinnedNodeIds)
      ? raw!.pinnedNodeIds
      : DEFAULT_WORKSPACE_COSMOS.pinnedNodeIds,
    recentNodeIds: Array.isArray(raw?.recentNodeIds)
      ? raw!.recentNodeIds
      : DEFAULT_WORKSPACE_COSMOS.recentNodeIds,
    hiddenWorldIds: Array.isArray(raw?.hiddenWorldIds) ? raw!.hiddenWorldIds : [],
    dismissedSuggestionIds: Array.isArray(raw?.dismissedSuggestionIds)
      ? raw!.dismissedSuggestionIds
      : [],
    accessibility: {
      ...DEFAULT_WORKSPACE_COSMOS.accessibility,
      ...(raw?.accessibility || {}),
    },
    featureFlags: {
      ...DEFAULT_WORKSPACE_COSMOS.featureFlags,
      ...(raw?.featureFlags || {}),
    },
    changeLog: Array.isArray(raw?.changeLog) ? raw!.changeLog : [],
    dismissedAiAlertIds: Array.isArray(raw?.dismissedAiAlertIds)
      ? raw!.dismissedAiAlertIds
      : [],
    pinnedAiMessageIds: Array.isArray(raw?.pinnedAiMessageIds)
      ? raw!.pinnedAiMessageIds
      : [],
  };
}

function normalizeLoadedWorkspaceState(
  parsed: Partial<AppDatabaseState> | null | undefined,
  uid: string | null
): AppDatabaseState {
  const cleanBase = getCleanTenantInitialState(uid);
  if (!parsed || typeof parsed !== 'object') {
    return cleanBase;
  }

  const agencies = Array.isArray(parsed.agencies) ? parsed.agencies : [];
  const CURRENT_STATE_VERSION = 4;
  const migrationSnapshot: MigrationSnapshotRecord | undefined =
    parsed.migrationSnapshot;

  const mergedGeneralPrefs: GeneralAppPrefs = {
    ...DEFAULT_GENERAL_PREFS,
    ...(parsed.generalPrefs || {}),
    granularControls: {
      ...DEFAULT_GENERAL_PREFS.granularControls!,
      ...(parsed.generalPrefs?.granularControls || {}),
      bypassEditConfirm:
        parsed.generalPrefs?.granularControls?.bypassEditConfirm ??
        Boolean(parsed.expertTableConfig?.allowDirectNoConfirmEdit),
    },
    hubShortcutIds:
      Array.isArray(parsed.generalPrefs?.hubShortcutIds) &&
      parsed.generalPrefs!.hubShortcutIds!.length > 0
        ? parsed.generalPrefs!.hubShortcutIds!
        : DEFAULT_GENERAL_PREFS.hubShortcutIds,
    quickToggleIds:
      Array.isArray(parsed.generalPrefs?.quickToggleIds) &&
      parsed.generalPrefs!.quickToggleIds!.length > 0
        ? parsed.generalPrefs!.quickToggleIds!.filter(
            (id) => id !== 'qt_dark_mode'
          )
        : (DEFAULT_GENERAL_PREFS.quickToggleIds || []).filter(
            (id) => id !== 'qt_dark_mode'
          ),
    agencyAccentColors: {
      ...DEFAULT_GENERAL_PREFS.agencyAccentColors,
      ...(parsed.generalPrefs?.agencyAccentColors || {}),
    },
    homeLayoutPrefs: {
      sectionOrder:
        Array.isArray(parsed.generalPrefs?.homeLayoutPrefs?.sectionOrder) &&
        parsed.generalPrefs!.homeLayoutPrefs!.sectionOrder.length > 0
          ? parsed.generalPrefs!.homeLayoutPrefs!.sectionOrder
          : [...DEFAULT_GENERAL_PREFS.homeLayoutPrefs!.sectionOrder],
      hiddenSections: Array.isArray(
        parsed.generalPrefs?.homeLayoutPrefs?.hiddenSections
      )
        ? parsed.generalPrefs!.homeLayoutPrefs!.hiddenSections
        : [],
      activeMiniWidgets: Array.isArray(
        parsed.generalPrefs?.homeLayoutPrefs?.activeMiniWidgets
      )
        ? parsed.generalPrefs!.homeLayoutPrefs!.activeMiniWidgets
        : [],
    },
    customExpenseCategories:
      Array.isArray(parsed.generalPrefs?.customExpenseCategories) &&
      parsed.generalPrefs!.customExpenseCategories!.length > 0
        ? parsed.generalPrefs!.customExpenseCategories!
        : DEFAULT_GENERAL_PREFS.customExpenseCategories,
    recurringExpenseTemplates: Array.isArray(
      parsed.generalPrefs?.recurringExpenseTemplates
    )
      ? parsed.generalPrefs!.recurringExpenseTemplates!
      : [],
  };

  const resolvedAppTheme = resolveAppThemeId(parsed.themePrefs?.appTheme);
  const effectiveThemeObj = getEffectiveAppTheme(resolvedAppTheme);
  const resolvedColorMode =
    resolvedAppTheme === 'auto'
      ? 'auto'
      : effectiveThemeObj.isDark
      ? 'dark'
      : 'light';
  const resolvedDarkTheme =
    resolvedAppTheme === 'auto' && typeof parsed.darkTheme === 'boolean'
      ? parsed.darkTheme
      : effectiveThemeObj.isDark;

  return {
    ...cleanBase,
    ...parsed,
    stateVersion: CURRENT_STATE_VERSION,
    updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : cleanBase.updatedAt,
    lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
    deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : getOrCreateDeviceId(),
    migrationSnapshot,
    workspaceCosmos: mergeWorkspaceCosmos(parsed.workspaceCosmos),
    agencies,
    persons: Array.isArray(parsed.persons) ? parsed.persons : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    readyLists: Array.isArray(parsed.readyLists)
      ? normalizeReadyLists(parsed.readyLists, agencies)
      : [],
    readyListItems: Array.isArray(parsed.readyListItems)
      ? parsed.readyListItems
      : [],
    relations: Array.isArray(parsed.relations) ? parsed.relations : [],
    tableHeaders:
      parsed.tableHeaders && typeof parsed.tableHeaders === 'object'
        ? { ...cleanBase.tableHeaders, ...parsed.tableHeaders }
        : cleanBase.tableHeaders,
    topBarConfig:
      parsed.topBarConfig && typeof parsed.topBarConfig === 'object'
        ? { ...cleanBase.topBarConfig, ...parsed.topBarConfig }
        : cleanBase.topBarConfig,
    modeTier: 'expert',
    editorEnabled: true,
    darkTheme: resolvedDarkTheme,
    requireLoginOnStart:
      typeof parsed.requireLoginOnStart === 'boolean'
        ? parsed.requireLoginOnStart
        : cleanBase.requireLoginOnStart,
    calculationSettings: {
      ...DEFAULT_CALCULATION_SETTINGS,
      ...(parsed.calculationSettings || {}),
    },
    themePrefs: {
      ...DEFAULT_THEME_PREFERENCES,
      ...(parsed.themePrefs || {}),
      appTheme: resolvedAppTheme,
      themeColorMode: resolvedColorMode,
      customBgColor: '',
      customSurfaceColor: '',
      customTextColor: '',
      customAccentColor: '',
      customSavedThemes: [],
      tableTheme: resolveTableThemeId(parsed.themePrefs?.tableTheme),
      fontFamily: resolveArabicFontId(parsed.themePrefs?.fontFamily),
      savedProfiles:
        Array.isArray(parsed.themePrefs?.savedProfiles) &&
        parsed.themePrefs!.savedProfiles!.length > 0
          ? parsed.themePrefs!.savedProfiles!
          : DEFAULT_APPEARANCE_PROFILES,
      conditionalFormatting: {
        ...DEFAULT_THEME_PREFERENCES.conditionalFormatting!,
        ...(parsed.themePrefs?.conditionalFormatting || {}),
      },
    },
    expertTableConfig: {
      ...DEFAULT_EXPERT_TABLE_CONFIG,
      ...(parsed.expertTableConfig || {}),
    },
    quickExtractPrefs: {
      ...DEFAULT_QUICK_EXTRACT_PREFS,
      ...(parsed.quickExtractPrefs || {}),
    },
    relationsPrefs: {
      ...DEFAULT_RELATIONS_PREFS,
      ...(parsed.relationsPrefs || {}),
    },
    generalPrefs: mergedGeneralPrefs,
    securityPrefs: {
      ...DEFAULT_SECURITY_PREFS,
      ...(parsed.securityPrefs || {}),
      secondaryCloud: {
        ...DEFAULT_SECURITY_PREFS.secondaryCloud!,
        ...(parsed.securityPrefs?.secondaryCloud || {}),
      },
      driveAccountMeta: {
        ...DEFAULT_SECURITY_PREFS.driveAccountMeta!,
        ...(parsed.securityPrefs?.driveAccountMeta || {}),
      },
      smartSync: {
        ...DEFAULT_SECURITY_PREFS.smartSync!,
        ...(parsed.securityPrefs?.smartSync || {}),
      },
    },
    smartPreferences: {
      ...(cleanBase.smartPreferences || {}),
      ...(parsed.smartPreferences || {}),
      rosterFilters: {
        ...(cleanBase.smartPreferences?.rosterFilters || {}),
        ...(parsed.smartPreferences?.rosterFilters || {}),
      },
    },
    auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
    recycleBin: pruneExpiredRecycleBinEntries(
      Array.isArray(parsed.recycleBin) ? parsed.recycleBin : []
    ),
    workspaceNotes: Array.isArray(parsed.workspaceNotes)
      ? parsed.workspaceNotes
      : [],
    conflictCopies: Array.isArray(parsed.conflictCopies)
      ? parsed.conflictCopies
      : [],
    hlcTimestamp: typeof parsed.hlcTimestamp === 'string' ? parsed.hlcTimestamp : undefined,
    activePeriod: resolvePeriodMeta(
      parsed.activePeriod,
      cleanBase.activePeriod?.fullDate
    ),
    monthlyArchives: Array.isArray(parsed.monthlyArchives)
      ? parsed.monthlyArchives
      : [],
    ucrsSessions: Array.isArray(parsed.ucrsSessions) ? parsed.ucrsSessions : [],
    ucrsLearningRules: Array.isArray(parsed.ucrsLearningRules)
      ? parsed.ucrsLearningRules
      : [],
  };
}

function buildSelectiveCloudSnapshot(state: AppDatabaseState): AppDatabaseState {
  const sel = state.securityPrefs?.selectiveSync;
  if (!sel) return state;
  return {
    ...state,
    ...(sel.syncRecords === false
      ? { agencies: [], persons: [], expenses: [], readyLists: [], readyListItems: [], relations: [] }
      : {}),
    ...(sel.syncArchives === false ? { monthlyArchives: [] } : {}),
    ...(sel.syncNotes === false ? { workspaceNotes: [] } : {}),
    ...(sel.syncAttachments === false
      ? {
          ucrsSessions: (state.ucrsSessions || []).map((s) => ({
            ...s,
            sources: s.sources.map((src) => ({ ...src, previewDataUrl: undefined })),
          })),
        }
      : {}),
  };
}

export function useAgencyStore(
  activeUid: string | null = null,
  options?: { onRemoteSessionRevoked?: (reason?: string) => void }
) {
  const [state, setState] = useState<AppDatabaseState>(() =>
    getCleanTenantInitialState(activeUid)
  );
  const [past, setPast] = useState<DataSnapshot[]>([]);
  const [future, setFuture] = useState<DataSnapshot[]>([]);
  const [storageReady, setStorageReady] = useState<boolean>(!activeUid);
  const [compressionStats, setCompressionStats] =
    useState<CompressionStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<WorkspaceSyncStatus>('local_only');
  const [storageStatus, setStorageStatus] = useState<StorageSystemStatus | null>(null);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [syncQueue, setSyncQueue] = useState<SyncQueueOperation[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [lastConflictNotice, setLastConflictNotice] = useState<string | null>(null);
  const onRemoteSessionRevokedRef = useRef(options?.onRemoteSessionRevoked);
  onRemoteSessionRevokedRef.current = options?.onRemoteSessionRevoked;

  const loadedUidRef = useRef<string | null>(null);
  const latestStateRef = useRef<AppDatabaseState>(state);
  latestStateRef.current = state;
  const syncInFlightRef = useRef<boolean>(false);
  const lastCloudSyncedUpdatedAtRef = useRef<string>('');
  const suppressNextAutoQueueRef = useRef<boolean>(false);
  const hadOfflineOrErrorPendingRef = useRef<boolean>(false);
  const autoRetryCountRef = useRef<number>(0);

  // Track online/offline network status dynamically + verify reachability on reconnect/focus
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastProbeAt = 0;

    const probeConnectivity = async (force = false) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setIsOnline(false);
        return;
      }
      const now = Date.now();
      if (!force && now - lastProbeAt < 4000) return;
      lastProbeAt = now;
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          setIsOnline(true);
          autoRetryCountRef.current = 0;
        }
      } catch {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setIsOnline(false);
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      autoRetryCountRef.current = 0;
      void probeConnectivity(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      hadOfflineOrErrorPendingRef.current = true;
      setSyncStatus((prev) =>
        prev === 'syncing' || prev === 'cloud_synced' ? 'pending_offline' : prev
      );
    };
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void probeConnectivity(false);
      }
    };

    const probeTimer = window.setInterval(() => {
      void probeConnectivity(true);
    }, 15_000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.clearInterval(probeTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, []);

  // Strict per-uid Local-First hydration + Initial Cloud Pull across devices
  useEffect(() => {
    let cancelled = false;
    loadedUidRef.current = null;
    lastCloudSyncedUpdatedAtRef.current = '';
    setPast([]);
    setFuture([]);
    setCompressionStats(null);
    setLastConflictNotice(null);

    const freshClean = getCleanTenantInitialState(activeUid);
    setState(freshClean);

    if (!activeUid) {
      setSyncQueue([]);
      setSyncStatus('local_only');
      setStorageReady(true);
      return () => {
        cancelled = true;
      };
    }

    setStorageReady(false);
    setSyncQueue(loadSyncQueue(activeUid));

    (async () => {
      try {
        void fetchStorageStatusApi()
          .then((st) => {
            if (!cancelled) setStorageStatus(st);
          })
          .catch(() => {});

        void fetchStorageQuotaApi()
          .then((q) => {
            if (!cancelled && q) setStorageQuota(q);
          })
          .catch(() => {});

        const localLoaded = await loadTenantWorkspace(activeUid);
        if (cancelled) return;

        let workingState = freshClean;
        if (localLoaded) {
          workingState = normalizeLoadedWorkspaceState(localLoaded.state, activeUid);
          suppressNextAutoQueueRef.current = true;
          loadedUidRef.current = activeUid;
          setState(workingState);
          setCompressionStats(localLoaded.stats);
          setStorageReady(true);
        }

        // Initial Cloud Pull / Cross-Device Hydration
        const sess = getStoredSession();
        const pendingOps = loadSyncQueue(activeUid).filter(
          (q) => q.status === 'pending' || q.status === 'failed'
        );

        if (sess?.user && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          try {
            setSyncStatus('syncing');
            const remoteRes = await fetchWorkspaceSnapshotApi();
            if (cancelled) return;

            if (remoteRes?.exists && remoteRes.snapshot) {
              const normalizedRemote = normalizeLoadedWorkspaceState(
                remoteRes.snapshot as Partial<AppDatabaseState>,
                activeUid
              );
              const lww = reconcileWorkspaceLww({
                localState: workingState,
                localUpdatedAt: workingState.updatedAt,
                remoteState: normalizedRemote,
                remoteUpdatedAt: remoteRes.updatedAt || normalizedRemote.updatedAt,
                hasPendingLocalOps: pendingOps.length > 0,
              });

              if (lww.winner === 'remote' || lww.conflictDetected) {
                let hydrated = normalizedRemote;
                let conflictSaved = false;
                if (lww.conflictDetected) {
                  const crdt = mergeWorkspacesCrdt({
                    localState: workingState,
                    remoteState: normalizedRemote,
                    deviceId: getOrCreateDeviceId(),
                  });
                  hydrated = crdt.mergedState;
                  conflictSaved = crdt.conflictCopies.length > 0;
                  setLastConflictNotice(crdt.summary);
                  const conflictAudit = createAuditCheckpointEvent({
                    actionType: 'conflict_lww',
                    title: 'حل تعارض المزامنة عبر CRDT',
                    summary: crdt.summary,
                    conflictResolved: true,
                    restorableState: workingState,
                  });
                  hydrated = {
                    ...hydrated,
                    auditLog: appendAuditCheckpointEvents(hydrated.auditLog, conflictAudit),
                  };
                }
                const hydratedStats = await saveTenantWorkspace(activeUid, hydrated);
                if (cancelled) return;
                suppressNextAutoQueueRef.current = true;
                loadedUidRef.current = activeUid;
                lastCloudSyncedUpdatedAtRef.current = hydrated.updatedAt || '';
                setState(hydrated);
                setCompressionStats(hydratedStats);
                setStorageReady(true);
                setSyncStatus(conflictSaved ? 'conflict_saved' : 'cloud_synced');
                return;
              }

              if (lww.winner === 'local') {
                // Local has newer changes or offline pending edits -> push up to unify cloud
                const pushRes = await pushWorkspaceLwwApi({
                  snapshot: buildSelectiveCloudSnapshot(workingState),
                  clientUpdatedAt: workingState.updatedAt || new Date().toISOString(),
                  deviceId: getOrCreateDeviceId(),
                });
                if (!cancelled && pushRes.ok) {
                  lastCloudSyncedUpdatedAtRef.current = workingState.updatedAt || '';
                  if (pendingOps.length > 0) {
                    const updatedQ = markSyncQueueStatus(
                      activeUid,
                      pendingOps.map((o) => o.id),
                      'synced'
                    );
                    setSyncQueue(updatedQ);
                  }
                  setSyncStatus('cloud_synced');
                }
              } else {
                lastCloudSyncedUpdatedAtRef.current = workingState.updatedAt || '';
                setSyncStatus('cloud_synced');
              }
            } else if (
              workingState.agencies.length > 0 ||
              workingState.persons.length > 0 ||
              pendingOps.length > 0
            ) {
              // First cloud seed from existing local device
              await pushWorkspaceLwwApi({
                snapshot: workingState,
                clientUpdatedAt: workingState.updatedAt || new Date().toISOString(),
                deviceId: getOrCreateDeviceId(),
                force: true,
              });
              if (!cancelled) {
                lastCloudSyncedUpdatedAtRef.current = workingState.updatedAt || '';
                setSyncStatus('cloud_synced');
              }
            } else {
              setSyncStatus('cloud_synced');
            }
          } catch {
            if (!cancelled) {
              const hasUnsyncedLocal =
                pendingOps.length > 0 ||
                workingState.agencies.length > 0 ||
                workingState.persons.length > 0 ||
                (typeof navigator !== 'undefined' && navigator.onLine === false);
              if (hasUnsyncedLocal) {
                hadOfflineOrErrorPendingRef.current = true;
              }
              setSyncStatus(hasUnsyncedLocal ? 'pending_offline' : 'local_only');
            }
          }
        } else if (!cancelled) {
          if (pendingOps.length > 0) {
            hadOfflineOrErrorPendingRef.current = true;
          }
          setSyncStatus(pendingOps.length > 0 ? 'pending_offline' : 'local_only');
        }

        if (!cancelled && !localLoaded) {
          const initialStats = await saveTenantWorkspace(activeUid, workingState);
          if (cancelled) return;
          suppressNextAutoQueueRef.current = true;
          loadedUidRef.current = activeUid;
          setState(workingState);
          setCompressionStats(initialStats);
          setStorageReady(true);
        }
      } catch {
        if (!cancelled) {
          loadedUidRef.current = activeUid;
          setState(freshClean);
          setStorageReady(true);
          setSyncStatus('local_only');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (activeUid && loadedUidRef.current === activeUid) {
        saveTenantWorkspaceSync(activeUid, latestStateRef.current);
      }
    };
  }, [activeUid]);

  // Always-on automatic on-device persistence -> per-uid IndexedDB vault + syncQueue enqueue
  useEffect(() => {
    if (!activeUid || loadedUidRef.current !== activeUid) return;

    let cancelled = false;
    const isSuppressed = suppressNextAutoQueueRef.current;
    suppressNextAutoQueueRef.current = false;

    const timer = window.setTimeout(() => {
      void saveTenantWorkspace(activeUid, state)
        .then((stats) => {
          if (!cancelled && loadedUidRef.current === activeUid) {
            setCompressionStats(stats);
          }
        })
        .catch(() => {});

      if (!isSuppressed && state.updatedAt && state.updatedAt !== lastCloudSyncedUpdatedAtRef.current) {
        const nextQ = enqueueSyncOperation(activeUid, {
          type: 'workspace_snapshot',
          entity: 'مساحة العمل',
          summary: `تحديث تلقائي (${state.agencies.length} وكالة، ${state.persons.length} مستفيد)`,
          updatedAt: state.updatedAt,
          deviceId: state.deviceId || getOrCreateDeviceId(),
        });
        autoRetryCountRef.current = 0;
        if (!cancelled) {
          setSyncQueue(nextQ);
          if (!isOnline) {
            hadOfflineOrErrorPendingRef.current = true;
            setSyncStatus('pending_offline');
          }
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeUid, state, isOnline]);

  // Synchronous unload/hide flush so no edit, setting, or customization is ever lost on refresh/close
  useEffect(() => {
    if (!activeUid || typeof window === 'undefined') return;
    const flushSync = () => {
      if (loadedUidRef.current === activeUid) {
        saveTenantWorkspaceSync(activeUid, latestStateRef.current);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      }
    };
    window.addEventListener('pagehide', flushSync);
    window.addEventListener('beforeunload', flushSync);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushSync);
      window.removeEventListener('beforeunload', flushSync);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeUid]);

  const resolvedAppShape = resolveAppShapeId(
    state.themePrefs?.appShape ?? state.generalPrefs?.appShape
  );

  const resolvedAppThemeId = resolveAppThemeId(state.themePrefs?.appTheme);
  const effectiveThemeObj = getEffectiveAppTheme(resolvedAppThemeId);

  const activeThemePrefs: ThemePreferences = {
    ...DEFAULT_THEME_PREFERENCES,
    ...(state.themePrefs || {}),
    appTheme: resolvedAppThemeId,
    appShape: resolvedAppShape,
    themeColorMode:
      resolvedAppThemeId === 'auto'
        ? 'auto'
        : effectiveThemeObj.isDark
        ? 'dark'
        : 'light',
    customBgColor: '',
    customSurfaceColor: '',
    customTextColor: '',
    customAccentColor: '',
  };

  const activeCosmos: WorkspaceCosmosState = mergeWorkspaceCosmos(state.workspaceCosmos);
  const uiDensity = state.generalPrefs?.uiDensity || 'balanced';

  const legacySpatialPrefs = (
    state.generalPrefs as { spatial3dPrefs?: Partial<Surface2DPrefs> } | undefined
  )?.spatial3dPrefs;
  const rawSurfacePrefs = state.generalPrefs?.surface2dPrefs ?? legacySpatialPrefs;
  const activeSurface2dPrefs = resolveSurface2DPrefs({
    ...(rawSurfacePrefs || {}),
    themeId:
      (rawSurfacePrefs?.themeId as Surface2DThemeId | undefined) ||
      mapAppThemeToSurfaceTheme(resolvedAppThemeId),
  });

  const [autoThemeTick, setAutoThemeTick] = useState(0);

  useEffect(() => {
    if (
      activeThemePrefs.appTheme !== 'auto' &&
      activeSurface2dPrefs.themeId !== 'auto_adaptive'
    ) {
      return;
    }
    if (typeof window === 'undefined') return;
    const bump = () => setAutoThemeTick((t) => t + 1);
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: light)')
        : null;
    if (mq?.addEventListener) {
      mq.addEventListener('change', bump);
    }
    const timer = window.setInterval(bump, 60000);
    return () => {
      if (mq?.removeEventListener) {
        mq.removeEventListener('change', bump);
      }
      window.clearInterval(timer);
    };
  }, [activeThemePrefs.appTheme, activeSurface2dPrefs.themeId]);

  useEffect(() => {
    applyThemePreferencesToDocument(activeThemePrefs, {
      reduceMotion: activeCosmos.accessibility.reduceMotion,
      oneHandedMode: activeCosmos.accessibility.oneHandedMode,
      numeralSystem: activeCosmos.accessibility.numeralSystem,
      calendarSystem: activeCosmos.accessibility.calendarSystem,
    });
    applySurface2DPrefsToDocument(activeSurface2dPrefs);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.uiDensity = uiDensity;
    }
  }, [
    autoThemeTick,
    uiDensity,
    activeSurface2dPrefs.themeId,
    activeSurface2dPrefs.motionIntensity,
    activeSurface2dPrefs.cardDensity,
    activeSurface2dPrefs.customColors?.accent,
    activeSurface2dPrefs.customColors?.secondary,
    activeSurface2dPrefs.customColors?.surfaceTone,
    activeThemePrefs.appTheme,
    activeThemePrefs.appShape,
    activeThemePrefs.tableTheme,
    activeThemePrefs.fontFamily,
    activeThemePrefs.fontSize,
    activeThemePrefs.fontWeight,
    activeThemePrefs.rowDensity,
    activeThemePrefs.fontSizePx,
    activeThemePrefs.rowHeightPx,
    activeThemePrefs.colWidthScale,
    activeThemePrefs.borderRadiusPx,
    activeThemePrefs.cardShadowLevel,
    activeThemePrefs.glassEffect,
    activeThemePrefs.glassOpacityPct,
    activeCosmos.accessibility.reduceMotion,
    activeCosmos.accessibility.oneHandedMode,
    activeCosmos.accessibility.numeralSystem,
    activeCosmos.accessibility.calendarSystem,
  ]);

  const maxUndo = Math.max(
    5,
    Math.min(100, state.generalPrefs?.undoLimit ?? DEFAULT_MAX_UNDO_HISTORY)
  );

  const commitDataMutation = useCallback(
    (
      mutator: (prev: AppDatabaseState) => AppDatabaseState,
      auditMeta?: { title?: string; summary?: string }
    ) => {
      setState((prev) => {
        const snapshot = pickDataSnapshot(prev);
        const mutated = mutator(prev);
        if (mutated === prev) return prev;
        const nowIso = new Date().toISOString();
        const deviceId = getOrCreateDeviceId();
        const agenciesDelta = mutated.agencies.length - prev.agencies.length;
        const personsDelta = mutated.persons.length - prev.persons.length;
        const autoSummary =
          auditMeta?.summary ||
          `الوكالات: ${mutated.agencies.length}${agenciesDelta ? ` (${agenciesDelta > 0 ? `+${agenciesDelta}` : agenciesDelta})` : ''} · المستفيدون: ${mutated.persons.length}${personsDelta ? ` (${personsDelta > 0 ? `+${personsDelta}` : personsDelta})` : ''}`;
        const auditEv = createAuditCheckpointEvent({
          actionType: 'data_mutation',
          title: auditMeta?.title || 'تحديث بيانات السجلات',
          summary: autoSummary,
          deviceId,
          restorableState: prev,
        });
        setPast((p) => [...p.slice(-(maxUndo - 1)), snapshot]);
        setFuture([]);
        return {
          ...mutated,
          recycleBin: pruneExpiredRecycleBinEntries(mutated.recycleBin || []),
          hlcTimestamp: tickHlc(prev.hlcTimestamp, deviceId),
          updatedAt: nowIso,
          deviceId,
          auditLog: appendAuditCheckpointEvents(mutated.auditLog, auditEv),
        };
      });
    },
    [maxUndo]
  );

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setState((curr) => {
        const currentSnap = pickDataSnapshot(curr);
        setFuture((f) => [currentSnap, ...f.slice(0, maxUndo - 1)]);
        const auditEv = createAuditCheckpointEvent({
          actionType: 'undo_action',
          title: 'تراجع عن آخر تعديل',
          summary: `تمت استعادة الحالة السابقة (${previous.persons.length} مستفيد)`,
          restorableState: curr,
        });
        return {
          ...curr,
          ...previous,
          updatedAt: new Date().toISOString(),
          auditLog: appendAuditCheckpointEvents(curr.auditLog, auditEv),
        };
      });
      return prevPast.slice(0, -1);
    });
  }, [maxUndo]);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const [nextSnap, ...restFuture] = prevFuture;
      setState((curr) => {
        const currentSnap = pickDataSnapshot(curr);
        setPast((p) => [...p.slice(-(maxUndo - 1)), currentSnap]);
        return {
          ...curr,
          ...nextSnap,
          updatedAt: new Date().toISOString(),
        };
      });
      return restFuture;
    });
  }, [maxUndo]);

  const setModeTier = useCallback((modeTier: AppModeTier) => {
    setState((prev) => ({
      ...prev,
      modeTier,
      editorEnabled: modeTier === 'beginner' ? false : prev.editorEnabled,
    }));
  }, []);

  const setEditorEnabled = useCallback((editorEnabled: boolean) => {
    setState((prev) => ({
      ...prev,
      editorEnabled: prev.modeTier === 'beginner' ? false : editorEnabled,
    }));
  }, []);

  const setDarkTheme = useCallback((nextDarkTheme: boolean) => {
    setState((prev) => {
      const currentTheme = resolveAppThemeId(prev.themePrefs?.appTheme);
      const nextAppTheme = nextDarkTheme
        ? currentTheme === 'daylight-alabaster' || currentTheme === 'auto'
          ? 'abyssal-emerald'
          : currentTheme
        : 'daylight-alabaster';
      return {
        ...prev,
        darkTheme: nextDarkTheme,
        themePrefs: {
          ...DEFAULT_THEME_PREFERENCES,
          ...(prev.themePrefs || {}),
          appTheme: nextAppTheme,
          themeColorMode: nextDarkTheme ? 'dark' : 'light',
        },
      };
    });
  }, []);

  const setThemePrefs = useCallback((patch: Partial<ThemePreferences>) => {
    setState((prev) => {
      const nextAppTheme = resolveAppThemeId(patch.appTheme ?? prev.themePrefs?.appTheme);
      const nextShape = resolveAppShapeId(
        patch.appShape ?? prev.themePrefs?.appShape ?? prev.generalPrefs?.appShape
      );
      const effectiveTheme = getEffectiveAppTheme(nextAppTheme);
      const shapeObj = getAppShapeById(nextShape);
      const merged: ThemePreferences = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
        ...patch,
        appTheme: nextAppTheme,
        appShape: nextShape,
        borderRadiusPx:
          patch.borderRadiusPx !== undefined
            ? patch.borderRadiusPx
            : patch.appShape !== undefined
            ? shapeObj.cardRadiusPx
            : prev.themePrefs?.borderRadiusPx ?? shapeObj.cardRadiusPx,
        themeColorMode:
          nextAppTheme === 'auto'
            ? 'auto'
            : effectiveTheme.isDark
            ? 'dark'
            : 'light',
        customBgColor: '',
        customSurfaceColor: '',
        customTextColor: '',
        customAccentColor: '',
        activeProfileId:
          patch.activeProfileId !== undefined
            ? patch.activeProfileId
            : prev.themePrefs?.activeProfileId ?? null,
      };
      const prevSurface = resolveSurface2DPrefs(
        prev.generalPrefs?.surface2dPrefs ??
          (prev.generalPrefs as { spatial3dPrefs?: Record<string, unknown> } | undefined)
            ?.spatial3dPrefs
      );
      const nextSurface =
        patch.appTheme !== undefined
          ? {
              ...prevSurface,
              themeId: mapAppThemeToSurfaceTheme(nextAppTheme),
              customColors: undefined,
            }
          : prevSurface;
      return {
        ...prev,
        darkTheme: effectiveTheme.isDark,
        themePrefs: merged,
        generalPrefs: {
          ...DEFAULT_GENERAL_PREFS,
          ...(prev.generalPrefs || {}),
          appShape: nextShape,
          surface2dPrefs: nextSurface,
        },
      };
    });
  }, []);

  const resetThemePrefs = useCallback(() => {
    setState((prev) => ({
      ...prev,
      darkTheme: true,
      themePrefs: {
        ...DEFAULT_THEME_PREFERENCES,
        appTheme: 'obsidian-gold',
        appShape: 'geometric-glass',
        themeColorMode: 'dark',
        savedProfiles:
          prev.themePrefs?.savedProfiles && prev.themePrefs.savedProfiles.length > 0
            ? prev.themePrefs.savedProfiles
            : DEFAULT_APPEARANCE_PROFILES,
        customSavedThemes: [],
      },
      generalPrefs: {
        ...DEFAULT_GENERAL_PREFS,
        ...(prev.generalPrefs || {}),
        appShape: 'geometric-glass',
        surface2dPrefs: {
          themeId: 'obsidian_gold',
          motionIntensity: 'subtle',
          cardDensity: 'balanced',
          customColors: undefined,
        },
      },
    }));
  }, []);

  const saveCustomThemePreset = useCallback((_preset: Omit<CustomThemePreset, 'id' | 'createdAt'>) => {
    // Custom color overrides are synced directly via Theme & Color Studio
  }, []);

  const deleteCustomThemePreset = useCallback((_presetId: string) => {
    // Preserved for interface compatibility
  }, []);

  const updateWorkspaceCosmos = useCallback(
    (patch: Partial<WorkspaceCosmosState>) => {
      setState((prev) => {
        const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
        return {
          ...prev,
          workspaceCosmos: {
            ...cur,
            ...patch,
          },
        };
      });
    },
    []
  );

  const updateAccessibilityPrefs = useCallback(
    (patch: Partial<AccessibilityAndExperiencePrefs>) => {
      setState((prev) => {
        const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
        return {
          ...prev,
          workspaceCosmos: {
            ...cur,
            accessibility: {
              ...cur.accessibility,
              ...patch,
            },
          },
        };
      });
    },
    []
  );

  const updateFeatureFlags = useCallback((patch: Partial<FeatureFlagsMap>) => {
    setState((prev) => {
      const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
      return {
        ...prev,
        workspaceCosmos: {
          ...cur,
          featureFlags: {
            ...cur.featureFlags,
            ...patch,
          },
        },
      };
    });
  }, []);

  const togglePinnedCosmosNode = useCallback((nodeId: string) => {
    setState((prev) => {
      const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
      const exists = cur.pinnedNodeIds.includes(nodeId);
      const next = exists
        ? cur.pinnedNodeIds.filter((id) => id !== nodeId)
        : [nodeId, ...cur.pinnedNodeIds].slice(0, 12);
      return {
        ...prev,
        workspaceCosmos: {
          ...cur,
          pinnedNodeIds: next,
        },
      };
    });
  }, []);

  const recordRecentCosmosNode = useCallback((nodeId: string) => {
    if (!nodeId || nodeId === 'cosmos_hub' || nodeId === 'root') return;
    setState((prev) => {
      const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
      const next = [nodeId, ...cur.recentNodeIds.filter((id) => id !== nodeId)].slice(0, 10);
      return {
        ...prev,
        workspaceCosmos: {
          ...cur,
          recentNodeIds: next,
        },
      };
    });
  }, []);

  const toggleHiddenCosmosWorld = useCallback((worldId: string) => {
    setState((prev) => {
      const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
      const hidden = cur.hiddenWorldIds.includes(worldId);
      const next = hidden
        ? cur.hiddenWorldIds.filter((id) => id !== worldId)
        : [...cur.hiddenWorldIds, worldId];
      return {
        ...prev,
        workspaceCosmos: {
          ...cur,
          hiddenWorldIds: next,
        },
      };
    });
  }, []);

  const dismissCosmosSuggestion = useCallback((suggestionId: string) => {
    setState((prev) => {
      const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
      if (cur.dismissedSuggestionIds.includes(suggestionId)) return prev;
      return {
        ...prev,
        workspaceCosmos: {
          ...cur,
          dismissedSuggestionIds: [...cur.dismissedSuggestionIds, suggestionId],
        },
      };
    });
  }, []);

  const appendWorldChangeLog = useCallback(
    (entry: Omit<WorldChangeLogEntry, 'id' | 'timestamp'>) => {
      const item: WorldChangeLogEntry = {
        ...entry,
        id: `clog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
      };
      setState((prev) => {
        const cur = mergeWorkspaceCosmos(prev.workspaceCosmos);
        return {
          ...prev,
          workspaceCosmos: {
            ...cur,
            changeLog: [item, ...cur.changeLog].slice(0, 80),
          },
        };
      });
    },
    []
  );

  const restorePreMigrationSnapshot = useCallback((): boolean => {
    let restored = false;
    setState((prev) => {
      if (!prev.migrationSnapshot) return prev;
      restored = true;
      const snap = prev.migrationSnapshot;
      return {
        ...prev,
        modeTier: snap.modeTier || prev.modeTier,
        editorEnabled:
          typeof snap.editorEnabled === 'boolean'
            ? snap.editorEnabled
            : prev.editorEnabled,
        calculationSettings: snap.calculationSettings || prev.calculationSettings,
        themePrefs: snap.themePrefs || prev.themePrefs,
        generalPrefs: snap.generalPrefs
          ? {
              ...DEFAULT_GENERAL_PREFS,
              ...snap.generalPrefs,
              granularControls: {
                ...DEFAULT_GENERAL_PREFS.granularControls!,
                ...(snap.generalPrefs.granularControls || {}),
              },
            }
          : prev.generalPrefs,
        securityPrefs: snap.securityPrefs || prev.securityPrefs,
      };
    });
    return restored;
  }, []);

  const saveAppearanceProfile = useCallback((name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const id = `prof_${Date.now().toString(36)}`;
    let createdProfile: AppearanceProfile | null = null;
    setState((prev) => {
      const cur = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
      };
      const profile: AppearanceProfile = {
        id,
        name: cleanName.slice(0, 80),
        appTheme: resolveAppThemeId(cur.appTheme),
        tableTheme: resolveTableThemeId(cur.tableTheme),
        fontFamily: resolveArabicFontId(cur.fontFamily),
        fontSizePx: cur.fontSizePx ?? 15,
        rowHeightPx: cur.rowHeightPx ?? 42,
        colWidthScale: cur.colWidthScale ?? 100,
        borderRadiusPx: cur.borderRadiusPx ?? 22,
        cardShadowLevel: cur.cardShadowLevel ?? 'soft',
        glassEffect: Boolean(cur.glassEffect),
        customBgColor: '',
        customSurfaceColor: '',
        customTextColor: '',
        customAccentColor: '',
        conditionalFormatting: cur.conditionalFormatting,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      createdProfile = profile;
      const existing = cur.savedProfiles || DEFAULT_APPEARANCE_PROFILES;
      return {
        ...prev,
        themePrefs: {
          ...cur,
          savedProfiles: [profile, ...existing].slice(0, 16),
          activeProfileId: profile.id,
        },
      };
    });
    if (createdProfile) {
      const sess = getStoredSession();
      void saveServerAppearanceProfile(createdProfile).catch(() => {});
      if (sess?.user?.uid) {
        void saveAppearanceProfileToFirestore(sess.user.uid, createdProfile).catch(() => {});
      }
    }
  }, []);

  const applyAppearanceProfile = useCallback((profileId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
      };
      const list = cur.savedProfiles || DEFAULT_APPEARANCE_PROFILES;
      const found = list.find((p) => p.id === profileId);
      if (!found) return prev;
      const nextAppTheme = resolveAppThemeId(found.appTheme);
      const nextShape = resolveAppShapeId(found.appShape ?? cur.appShape);
      const effectiveTheme = getEffectiveAppTheme(nextAppTheme);
      return {
        ...prev,
        darkTheme: effectiveTheme.isDark,
        themePrefs: {
          ...cur,
          appTheme: nextAppTheme,
          appShape: nextShape,
          themeColorMode:
            nextAppTheme === 'auto'
              ? 'auto'
              : effectiveTheme.isDark
              ? 'dark'
              : 'light',
          tableTheme: resolveTableThemeId(found.tableTheme),
          fontFamily: resolveArabicFontId(found.fontFamily),
          fontSizePx: found.fontSizePx,
          rowHeightPx: found.rowHeightPx,
          colWidthScale: found.colWidthScale,
          borderRadiusPx: found.borderRadiusPx,
          cardShadowLevel: found.cardShadowLevel,
          glassEffect: found.glassEffect,
          customBgColor: '',
          customSurfaceColor: '',
          customTextColor: '',
          customAccentColor: '',
          conditionalFormatting:
            found.conditionalFormatting || cur.conditionalFormatting,
          activeProfileId: found.id,
        },
        generalPrefs: {
          ...DEFAULT_GENERAL_PREFS,
          ...(prev.generalPrefs || {}),
          appShape: nextShape,
          surface2dPrefs: {
            ...resolveSurface2DPrefs(prev.generalPrefs?.surface2dPrefs),
            themeId: mapAppThemeToSurfaceTheme(nextAppTheme),
            customColors: undefined,
          },
        },
      };
    });
  }, []);

  const deleteAppearanceProfile = useCallback((profileId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
      };
      const existing = cur.savedProfiles || DEFAULT_APPEARANCE_PROFILES;
      return {
        ...prev,
        themePrefs: {
          ...cur,
          savedProfiles: existing.filter((p) => p.id !== profileId),
          activeProfileId:
            cur.activeProfileId === profileId ? null : cur.activeProfileId,
        },
      };
    });
    const sess = getStoredSession();
    void deleteServerAppearanceProfile(profileId).catch(() => {});
    if (sess?.user?.uid) {
      void deleteAppearanceProfileFromFirestore(sess.user.uid, profileId).catch(() => {});
    }
  }, []);

  const setRequireLoginOnStart = useCallback((requireLoginOnStart: boolean) => {
    setState((prev) => ({ ...prev, requireLoginOnStart }));
  }, []);

  const setCalculationSettings = useCallback(
    (calculationSettings: CalculationSettings) => {
      commitDataMutation((prev) => ({ ...prev, calculationSettings }));
    },
    [commitDataMutation]
  );

  const setTopBarConfig = useCallback((patch: Partial<TopBarConfig>) => {
    setState((prev) => ({
      ...prev,
      topBarConfig: {
        ...prev.topBarConfig,
        ...patch,
      },
    }));
  }, []);

  const updateTableHeaderMeta = useCallback(
    (key: string, patch: Partial<SectionTableHeaderMeta>) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const current = prev.tableHeaders?.[key] || {
          title: '',
          subtitle: '',
          date: today,
          autoUpdateDate: true,
          lastUpdatedAt: today,
        };
        return {
          ...prev,
          tableHeaders: {
            ...(prev.tableHeaders || {}),
            [key]: {
              ...current,
              ...patch,
              lastUpdatedAt: today,
            },
          },
        };
      });
    },
    [commitDataMutation]
  );

  // Expert Table Config, Quick Extract Prefs, Relations/General/Security Prefs
  const setExpertTableConfig = useCallback(
    (patch: Partial<ExpertTableConfig>) => {
      setState((prev) => ({
        ...prev,
        expertTableConfig: {
          ...DEFAULT_EXPERT_TABLE_CONFIG,
          ...(prev.expertTableConfig || {}),
          ...patch,
        },
      }));
    },
    []
  );

  const resetExpertTableConfig = useCallback(() => {
    setState((prev) => ({
      ...prev,
      expertTableConfig: { ...DEFAULT_EXPERT_TABLE_CONFIG },
    }));
  }, []);

  const addExpertCustomColumn = useCallback(
    (input: { label: string; type: 'text' | 'number' }) => {
      const cleanLabel = input.label.trim();
      if (!cleanLabel) return;
      const colId = `custom_${Date.now().toString(36)}`;
      const col: ExpertCustomColumn = {
        id: colId,
        label: cleanLabel,
        type: input.type,
      };
      setState((prev) => {
        const cur = {
          ...DEFAULT_EXPERT_TABLE_CONFIG,
          ...(prev.expertTableConfig || {}),
        };
        return {
          ...prev,
          expertTableConfig: {
            ...cur,
            customColumns: [...cur.customColumns, col],
            columnOrder: [...cur.columnOrder, colId],
            visibleColumns: [...cur.visibleColumns, colId],
            columnLabels: { ...cur.columnLabels, [colId]: cleanLabel },
          },
        };
      });
    },
    []
  );

  const removeExpertCustomColumn = useCallback((colId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_EXPERT_TABLE_CONFIG,
        ...(prev.expertTableConfig || {}),
      };
      const nextLabels = { ...cur.columnLabels };
      delete nextLabels[colId];
      return {
        ...prev,
        expertTableConfig: {
          ...cur,
          customColumns: cur.customColumns.filter((c) => c.id !== colId),
          columnOrder: cur.columnOrder.filter((id) => id !== colId),
          visibleColumns: cur.visibleColumns.filter((id) => id !== colId),
          columnLabels: nextLabels,
        },
      };
    });
  }, []);

  const setQuickExtractPrefs = useCallback(
    (patch: Partial<QuickExtractPrefs>) => {
      setState((prev) => ({
        ...prev,
        quickExtractPrefs: {
          ...DEFAULT_QUICK_EXTRACT_PREFS,
          ...(prev.quickExtractPrefs || {}),
          ...patch,
        },
      }));
    },
    []
  );

  const saveQuickExtractTemplate = useCallback(
    (template: QuickExtractReferenceTemplate) => {
      setState((prev) => {
        const cur = {
          ...DEFAULT_QUICK_EXTRACT_PREFS,
          ...(prev.quickExtractPrefs || {}),
        };
        const exists = cur.referenceTemplates.some((t) => t.id === template.id);
        const nextTemplates = exists
          ? cur.referenceTemplates.map((t) =>
              t.id === template.id ? template : t
            )
          : [template, ...cur.referenceTemplates].slice(0, 8);
        return {
          ...prev,
          quickExtractPrefs: {
            ...cur,
            referenceTemplates: nextTemplates,
            activeTemplateId: template.id,
          },
        };
      });
    },
    []
  );

  const deleteQuickExtractTemplate = useCallback((templateId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_QUICK_EXTRACT_PREFS,
        ...(prev.quickExtractPrefs || {}),
      };
      const remaining = cur.referenceTemplates.filter(
        (t) => t.id !== templateId
      );
      return {
        ...prev,
        quickExtractPrefs: {
          ...cur,
          referenceTemplates: remaining,
          activeTemplateId:
            cur.activeTemplateId === templateId
              ? remaining[0]?.id ?? null
              : cur.activeTemplateId,
        },
      };
    });
  }, []);

  const setRelationsPrefs = useCallback(
    (patch: Partial<RelationsReadyListsPrefs>) => {
      setState((prev) => ({
        ...prev,
        relationsPrefs: {
          ...DEFAULT_RELATIONS_PREFS,
          ...(prev.relationsPrefs || {}),
          ...patch,
        },
      }));
    },
    []
  );

  const setGeneralPrefs = useCallback((patch: Partial<GeneralAppPrefs>) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_GENERAL_PREFS,
        ...(prev.generalPrefs || {}),
      };
      const nextThemePrefs = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
      };
      let themePrefsModified = false;
      if (patch.appShape !== undefined) {
        const nextShape = resolveAppShapeId(patch.appShape);
        nextThemePrefs.appShape = nextShape;
        nextThemePrefs.borderRadiusPx = getAppShapeById(nextShape).cardRadiusPx;
        themePrefsModified = true;
      }
      if (patch.surface2dPrefs?.themeId !== undefined) {
        const mappedAppTheme = mapSurfaceThemeToAppTheme(patch.surface2dPrefs.themeId);
        nextThemePrefs.appTheme = mappedAppTheme;
        nextThemePrefs.themeColorMode =
          mappedAppTheme === 'auto'
            ? 'auto'
            : getEffectiveAppTheme(mappedAppTheme).isDark
            ? 'dark'
            : 'light';
        themePrefsModified = true;
      }
      const nextDark = getEffectiveAppTheme(nextThemePrefs.appTheme).isDark;

      return {
        ...prev,
        ...(themePrefsModified ? { darkTheme: nextDark, themePrefs: nextThemePrefs } : {}),
        generalPrefs: {
          ...cur,
          ...patch,
          granularControls: patch.granularControls
            ? {
                ...(DEFAULT_GENERAL_PREFS.granularControls || {}),
                ...(cur.granularControls || {}),
                ...patch.granularControls,
              }
            : cur.granularControls,
          agencyAccentColors: patch.agencyAccentColors
            ? {
                ...(DEFAULT_GENERAL_PREFS.agencyAccentColors || {}),
                ...(cur.agencyAccentColors || {}),
                ...patch.agencyAccentColors,
              }
            : cur.agencyAccentColors,
        },
      };
    });
  }, []);

  const setSecurityPrefs = useCallback((patch: Partial<SecurityPrefs>) => {
    setState((prev) => {
      const cur = prev.securityPrefs || DEFAULT_SECURITY_PREFS;
      return {
        ...prev,
        securityPrefs: {
          ...DEFAULT_SECURITY_PREFS,
          ...cur,
          ...patch,
          secondaryCloud: patch.secondaryCloud
            ? {
                ...DEFAULT_SECURITY_PREFS.secondaryCloud!,
                ...(cur.secondaryCloud || {}),
                ...patch.secondaryCloud,
              }
            : cur.secondaryCloud || DEFAULT_SECURITY_PREFS.secondaryCloud,
          driveAccountMeta: patch.driveAccountMeta
            ? {
                ...DEFAULT_SECURITY_PREFS.driveAccountMeta!,
                ...(cur.driveAccountMeta || {}),
                ...patch.driveAccountMeta,
              }
            : cur.driveAccountMeta || DEFAULT_SECURITY_PREFS.driveAccountMeta,
          smartSync: patch.smartSync
            ? {
                ...DEFAULT_SECURITY_PREFS.smartSync!,
                ...(cur.smartSync || {}),
                ...patch.smartSync,
              }
            : cur.smartSync || DEFAULT_SECURITY_PREFS.smartSync,
        },
      };
    });
  }, []);

  const updateSmartSyncCheckpoint = useCallback(
    (checkpoint: SmartSyncCheckpoint) => {
      setState((prev) => ({
        ...prev,
        securityPrefs: {
          ...DEFAULT_SECURITY_PREFS,
          ...(prev.securityPrefs || {}),
          smartSync: checkpoint,
        },
      }));
    },
    []
  );

  const addWorkspaceNote = useCallback(
    (input: {
      title: string;
      content: string;
      category: WorkspaceNoteCategory;
      pinned?: boolean;
      tags?: string[];
    }) => {
      const nowIso = new Date().toISOString();
      const note: WorkspaceNoteItem = {
        id: `wnote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        title: input.title.trim() || 'ملاحظة جديدة',
        content: input.content.trim(),
        category: input.category,
        pinned: Boolean(input.pinned),
        tags: input.tags || [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        workspaceNotes: [note, ...(prev.workspaceNotes || [])],
      }));
      return note;
    },
    []
  );

  const updateWorkspaceNote = useCallback(
    (
      noteId: string,
      patch: Partial<
        Pick<WorkspaceNoteItem, 'title' | 'content' | 'category' | 'pinned' | 'tags'>
      >
    ) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        workspaceNotes: (prev.workspaceNotes || []).map((n) =>
          n.id === noteId ? { ...n, ...patch, updatedAt: nowIso } : n
        ),
      }));
    },
    []
  );

  const deleteWorkspaceNote = useCallback((noteId: string) => {
    setState((prev) => {
      const target = (prev.workspaceNotes || []).find((n) => n.id === noteId);
      return {
        ...prev,
        workspaceNotes: (prev.workspaceNotes || []).filter((n) => n.id !== noteId),
        recycleBin: target
          ? pushRecycleBinEntry(prev.recycleBin, {
              kind: 'note',
              label: target.title || 'ملاحظة مساحة العمل',
              payload: { kind: 'note', note: target },
            })
          : prev.recycleBin,
      };
    });
  }, []);

  const restoreRecycleBinItem = useCallback((entryId: string) => {
    setState((prev) => restoreRecycleBinEntryFromState(prev, entryId));
  }, []);

  const restoreAllRecycleBinItems = useCallback(() => {
    setState((prev) => restoreAllRecycleBinEntriesFromState(prev));
  }, []);

  const purgeRecycleBinItem = useCallback((entryId: string) => {
    setState((prev) => ({
      ...prev,
      recycleBin: (prev.recycleBin || []).filter((e) => e.id !== entryId),
    }));
  }, []);

  const clearRecycleBin = useCallback(() => {
    setState((prev) => ({
      ...prev,
      recycleBin: [],
    }));
  }, []);

  const importWorkspaceJson = useCallback((rawJson: string) => {
    const imported = parseMemoryVaultImport(rawJson);
    const parsed = imported.state;
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const normalized = normalizeLoadedWorkspaceState(
        {
          ...prev,
          ...parsed,
          agencies: parsed.agencies!,
          persons: parsed.persons!,
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : prev.expenses,
          readyLists: Array.isArray(parsed.readyLists)
            ? normalizeReadyLists(parsed.readyLists, parsed.agencies!)
            : prev.readyLists,
          readyListItems: Array.isArray(parsed.readyListItems)
            ? parsed.readyListItems
            : prev.readyListItems,
          relations: Array.isArray(parsed.relations)
            ? parsed.relations
            : prev.relations,
        },
        activeUid ?? null
      );
      const importAudit = createAuditCheckpointEvent({
        actionType: 'vault_import',
        title:
          imported.sourceKind === 'memory_vault_v1'
            ? 'استيراد لقطة الذاكرة الكاملة (Memory Vault)'
            : 'استيراد نسخة احتياطية JSON',
        summary: `تمت استعادة ${normalized.agencies.length} وكالة و${normalized.persons.length} مستفيد بنجاح.`,
        restorableState: prev,
      });
      return {
        ...normalized,
        updatedAt: nowIso,
        auditLog: appendAuditCheckpointEvents(normalized.auditLog, importAudit),
      };
    });
    setPast([]);
    setFuture([]);
  }, [activeUid]);

  const exportMemoryVaultJson = useCallback(() => {
    return createMemoryVaultExport(latestStateRef.current);
  }, []);

  const restoreAuditCheckpoint = useCallback((eventId: string): boolean => {
    let restored = false;
    setState((prev) => {
      const target = (prev.auditLog || []).find((ev) => ev.id === eventId);
      if (!target || !target.restorableData) return prev;
      restored = true;
      const currentSnap = pickDataSnapshot(prev);
      setPast((p) => [...p.slice(-(maxUndo - 1)), currentSnap]);
      setFuture([]);
      const restoreAudit = createAuditCheckpointEvent({
        actionType: 'checkpoint_restore',
        title: `استرجاع نقطة: ${target.title}`,
        summary: `تمت الاستعادة من سجل التدقيق المؤرخ في ${new Date(target.timestamp).toLocaleString('ar-IQ')}`,
        restorableState: prev,
      });
      return {
        ...prev,
        ...target.restorableData,
        updatedAt: new Date().toISOString(),
        auditLog: appendAuditCheckpointEvents(prev.auditLog, restoreAudit),
      };
    });
    return restored;
  }, [maxUndo]);

  const updateSmartPreferences = useCallback(
    (patch: Partial<SmartPreferencesMemory>) => {
      setState((prev) => {
        const nowIso = new Date().toISOString();
        const prevPrefs = prev.smartPreferences || {};
        const nextPrefs: SmartPreferencesMemory = {
          ...prevPrefs,
          ...patch,
          rosterFilters: patch.rosterFilters
            ? { ...(prevPrefs.rosterFilters || {}), ...patch.rosterFilters }
            : prevPrefs.rosterFilters,
          updatedAt: nowIso,
        };
        return {
          ...prev,
          smartPreferences: nextPrefs,
          updatedAt: nowIso,
        };
      });
    },
    []
  );

  // Add Person — Direct without confirmation per Editor rules
  const addPersonDirect = useCallback(
    (input: {
      agencyId: number;
      name: string;
      nationalId: string;
      individuals: number | null;
      notes: string;
      blockType?: Person['blockType'];
      blockedIndividuals?: number;
      blockReason?: string;
      customCategory?: string;
      customFields?: Record<string, string>;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const nextId =
          prev.persons.reduce((max, p) => Math.max(max, p.id), 100) + 1;
        const bType = input.blockType || 'none';
        const status: Person['status'] =
          bType === 'full' ? 'محجوب' : bType === 'archived' ? 'مؤرشف' : '';
        const newPerson: Person = {
          id: nextId,
          agencyId: input.agencyId,
          name: input.name.trim(),
          nationalId: input.nationalId.trim(),
          individuals: input.individuals,
          blockType: bType,
          blockedIndividuals: input.blockedIndividuals ?? 0,
          blockReason: input.blockReason || '',
          status,
          notes: input.notes.trim(),
          customCategory: input.customCategory || '',
          customFields: input.customFields || {},
          updatedAt: today,
        };
        return {
          ...prev,
          persons: [...prev.persons, newPerson],
        };
      });
    },
    [commitDataMutation]
  );

  // Update Person — Invoked after confirmation modal (or directly in Expert unrestricted mode)
  const updatePersonConfirmed = useCallback(
    (
      personId: number,
      patch: Partial<
        Pick<
          Person,
          | 'name'
          | 'nationalId'
          | 'individuals'
          | 'blockType'
          | 'blockedIndividuals'
          | 'blockReason'
          | 'status'
          | 'notes'
          | 'agencyId'
          | 'customCategory'
          | 'customFields'
        >
      >
    ) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) => {
          if (p.id !== personId) return p;
          const nextBlockType = patch.blockType ?? p.blockType;
          const nextStatus: Person['status'] =
            nextBlockType === 'full'
              ? 'محجوب'
              : nextBlockType === 'archived'
              ? 'مؤرشف'
              : '';
          const nextTotal =
            patch.individuals !== undefined ? patch.individuals : p.individuals;
          const nextBlocked =
            nextBlockType === 'partial'
              ? Math.min(
                  nextTotal ?? 0,
                  Math.max(0, patch.blockedIndividuals ?? p.blockedIndividuals)
                )
              : nextBlockType === 'full'
              ? nextTotal ?? 0
              : 0;
          return {
            ...p,
            ...patch,
            customFields: patch.customFields
              ? { ...(p.customFields || {}), ...patch.customFields }
              : p.customFields,
            blockType: nextBlockType,
            status: nextStatus,
            blockedIndividuals: nextBlocked,
            updatedAt: today,
          };
        }),
      }));
    },
    [commitDataMutation]
  );

  const bulkUpdatePersonsCategory = useCallback(
    (personIds: number[], customCategory: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const idSet = new Set(personIds);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) =>
          idSet.has(p.id) ? { ...p, customCategory, updatedAt: today } : p
        ),
      }));
    },
    [commitDataMutation]
  );

  const bulkUpdatePersonsStatusAndCategory = useCallback(
    (
      personIds: number[],
      patch: {
        blockType?: BlockScope;
        blockedIndividuals?: number;
        blockReason?: string;
        customCategory?: string;
      }
    ) => {
      if (personIds.length === 0) return;
      const today = new Date().toISOString().slice(0, 10);
      const idSet = new Set(personIds);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) => {
          if (!idSet.has(p.id)) return p;
          const nextBlockType = patch.blockType ?? p.blockType;
          const nextStatus: Person['status'] =
            nextBlockType === 'full'
              ? 'محجوب'
              : nextBlockType === 'archived'
              ? 'مؤرشف'
              : '';
          const total = p.individuals ?? 0;
          const nextBlocked =
            nextBlockType === 'partial'
              ? Math.min(
                  total,
                  Math.max(0, patch.blockedIndividuals ?? p.blockedIndividuals ?? 1)
                )
              : nextBlockType === 'full'
              ? total
              : 0;
          return {
            ...p,
            blockType: nextBlockType,
            status: nextStatus,
            blockedIndividuals: nextBlocked,
            blockReason:
              patch.blockReason !== undefined
                ? patch.blockReason
                : nextBlockType === 'none'
                ? ''
                : p.blockReason,
            customCategory:
              patch.customCategory !== undefined
                ? patch.customCategory
                : p.customCategory,
            updatedAt: today,
          };
        }),
      }));
    },
    [commitDataMutation]
  );

  // Delete Person — Invoked after confirmation modal (and pushed to Safe Recycle Bin)
  const deletePersonConfirmed = useCallback(
    (personId: number) => {
      commitDataMutation((prev) => {
        const target = prev.persons.find((p) => p.id === personId);
        return {
          ...prev,
          persons: prev.persons.filter((p) => p.id !== personId),
          readyListItems: prev.readyListItems.filter(
            (item) => item.sourcePersonId !== personId
          ),
          recycleBin: target
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'person',
                label: target.name,
                payload: { kind: 'person', person: target },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  const deletePersonsBulkConfirmed = useCallback(
    (personIds: number[]) => {
      if (personIds.length === 0) return 0;
      const idSet = new Set(personIds);
      let deletedCount = 0;
      commitDataMutation((prev) => {
        const targets = prev.persons.filter((p) => idSet.has(p.id));
        deletedCount = targets.length;
        if (targets.length === 0) return prev;
        let nextBin = prev.recycleBin;
        for (const target of targets) {
          nextBin = pushRecycleBinEntry(nextBin, {
            kind: 'person',
            label: target.name,
            payload: { kind: 'person', person: target },
          });
        }
        return {
          ...prev,
          persons: prev.persons.filter((p) => !idSet.has(p.id)),
          readyListItems: prev.readyListItems.filter(
            (item) =>
              item.sourcePersonId === null || !idSet.has(item.sourcePersonId)
          ),
          recycleBin: nextBin,
        };
      });
      return deletedCount;
    },
    [commitDataMutation]
  );

  // Quick Extract Commit (Multi-Destination, Split & Merge Strategy)
  const commitQuickExtractPlan = useCallback(
    (params: {
      rows: QuickExtractEvaluatedRow[];
      routing: QuickExtractRoutingConfig;
    }): QuickExtractCommitSummary => {
      const today = new Date().toISOString().slice(0, 10);
      let summaryResult: QuickExtractCommitSummary = {
        totalRows: params.rows.length,
        added: 0,
        updated: 0,
        replaced: 0,
        buckets: [],
      };

      commitDataMutation((prev) => {
        const plan = computeQuickExtractRoutingPlan({
          rows: params.rows,
          routing: params.routing,
          agencies: prev.agencies,
          persons: prev.persons,
          readyLists: prev.readyLists,
          readyListItems: prev.readyListItems,
        });

        let nextPersons = [...prev.persons];
        let nextReadyLists = [...prev.readyLists];
        let nextReadyListItems = [...prev.readyListItems];

        let maxPersonId = nextPersons.reduce((m, p) => Math.max(m, p.id), 100);
        let maxListId = nextReadyLists.reduce((m, l) => Math.max(m, l.id), 0);
        let maxItemId = nextReadyListItems.reduce(
          (m, it) => Math.max(m, it.id),
          0
        );

        const bucketMap = new Map<string, QuickExtractCommitBucketSummary>();
        const createdReadyListIds = new Map<string, number>();

        // Handle "replace" strategy per targeted destination bucket before inserting replacements
        const agencyIdsToReplace = new Set<number>();
        const existingReadyListIdsToReplace = new Set<number>();
        for (const item of plan.items) {
          if (item.actionType === 'skip_unmatched') continue;
          if (item.mergeStrategy === 'replace') {
            if (item.destination.kind === 'agency') {
              agencyIdsToReplace.add(item.destination.agencyId);
            } else if (
              item.destination.kind === 'existing_ready_list' &&
              item.destination.existingReadyListId
            ) {
              existingReadyListIdsToReplace.add(
                item.destination.existingReadyListId
              );
            }
          }
        }
        if (agencyIdsToReplace.size > 0) {
          nextPersons = nextPersons.filter(
            (p) => !agencyIdsToReplace.has(p.agencyId)
          );
        }
        if (existingReadyListIdsToReplace.size > 0) {
          nextReadyListItems = nextReadyListItems.filter(
            (it) => !existingReadyListIdsToReplace.has(it.listId)
          );
        }

        let effectiveTotal = 0;

        for (const item of plan.items) {
          if (item.actionType === 'skip_unmatched') continue;
          effectiveTotal += 1;

          const { row, destination, finalIndividuals, adjustmentNote } = item;

          if (!bucketMap.has(item.bucketKey)) {
            bucketMap.set(item.bucketKey, {
              destinationLabel: item.destinationLabel,
              destinationKind: destination.kind,
              agencyId:
                destination.kind === 'agency' ? destination.agencyId : undefined,
              readyListId:
                destination.kind === 'existing_ready_list'
                  ? destination.existingReadyListId
                  : undefined,
              added: 0,
              updated: 0,
              replaced: 0,
            });
          }
          const bucket = bucketMap.get(item.bucketKey)!;

          if (destination.kind === 'existing_ready_list') {
            const targetListId =
              destination.existingReadyListId || nextReadyLists[0]?.id;
            if (!targetListId) continue;
            bucket.readyListId = targetListId;
            const normName = normalizeArabic(row.resolvedName);

            if (item.mergeStrategy === 'update_matched') {
              const existingIdx = nextReadyListItems.findIndex(
                (it) =>
                  it.listId === targetListId &&
                  normalizeArabic(it.name) === normName
              );
              if (existingIdx !== -1) {
                nextReadyListItems[existingIdx] = {
                  ...nextReadyListItems[existingIdx],
                  individuals: finalIndividuals,
                  notes: adjustmentNote,
                  isOverridden: true,
                };
                bucket.updated += 1;
                summaryResult.updated += 1;
                continue;
              }
            }

            const currentPos = nextReadyListItems.filter(
              (it) => it.listId === targetListId
            ).length;
            maxItemId += 1;
            const matchedGlobal = findExistingMatchInAgency(
              row.resolvedName,
              nextPersons
            );
            nextReadyListItems.push({
              id: maxItemId,
              listId: targetListId,
              position: currentPos + 1,
              sourcePersonId: matchedGlobal ? matchedGlobal.id : null,
              name: row.resolvedName.trim(),
              nationalId: matchedGlobal?.nationalId || '',
              individuals: finalIndividuals,
              blockType: 'none',
              blockedIndividuals: 0,
              blockReason: '',
              status: '',
              notes: adjustmentNote,
              isOverridden: true,
            });
            if (item.mergeStrategy === 'replace') {
              bucket.replaced += 1;
              summaryResult.replaced += 1;
            } else {
              bucket.added += 1;
              summaryResult.added += 1;
            }
            continue;
          }

          if (destination.kind === 'ready_list') {
            let listId = createdReadyListIds.get(item.bucketKey);
            if (!listId) {
              maxListId += 1;
              listId = maxListId;
              createdReadyListIds.set(item.bucketKey, listId);
              const meta = destination.readyListMeta;
              const newList: ReadyList = {
                id: listId,
                agencyId: destination.agencyId || prev.agencies[0]?.id || 1,
                name: meta.name.trim() || 'قائمة مستخرجة (السحب السريع)',
                listDate: meta.listDate || today,
                subtitle1: meta.subtitle1.trim(),
                subtitle2: meta.subtitle2.trim(),
                autoUpdateDate: meta.autoUpdateDate,
                lastUpdatedAt: today,
                createdAt: today,
                note: meta.subtitle2.trim(),
              };
              nextReadyLists.push(newList);
            }
            bucket.readyListId = listId;
            const currentPos = nextReadyListItems.filter(
              (it) => it.listId === listId
            ).length;
            maxItemId += 1;
            const matchedInAgency = findExistingMatchInAgency(
              row.resolvedName,
              nextPersons.filter((p) => p.agencyId === destination.agencyId)
            );
            nextReadyListItems.push({
              id: maxItemId,
              listId,
              position: currentPos + 1,
              sourcePersonId: matchedInAgency ? matchedInAgency.id : null,
              name: row.resolvedName.trim(),
              nationalId: matchedInAgency?.nationalId || '',
              individuals: finalIndividuals,
              blockType: 'none',
              blockedIndividuals: 0,
              blockReason: '',
              status: '',
              notes: adjustmentNote,
              isOverridden: true,
            });
            bucket.added += 1;
            summaryResult.added += 1;
            continue;
          }

          // Target is specific agency OR master_roster
          const targetAgencyForNew =
            destination.kind === 'agency'
              ? destination.agencyId
              : prev.agencies[0]?.id || 1;

          const searchPool =
            destination.kind === 'master_roster'
              ? nextPersons
              : nextPersons.filter((p) => p.agencyId === targetAgencyForNew);

          const existing =
            item.mergeStrategy === 'add_new'
              ? null
              : findExistingMatchInAgency(row.resolvedName, searchPool);

          if (existing && item.mergeStrategy === 'update_matched') {
            const idx = nextPersons.findIndex((p) => p.id === existing.id);
            if (idx !== -1) {
              nextPersons[idx] = {
                ...nextPersons[idx],
                individuals: finalIndividuals,
                decreaseCount: row.resolvedDecreaseCount ?? nextPersons[idx].decreaseCount ?? 0,
                addOrDeleteCount:
                  row.resolvedAddOrDeleteCount ?? nextPersons[idx].addOrDeleteCount ?? 0,
                addOrDeleteAction:
                  row.resolvedAddOrDeleteAction || nextPersons[idx].addOrDeleteAction || 'لا يوجد',
                notes: nextPersons[idx].notes
                  ? `${nextPersons[idx].notes} · ${adjustmentNote}`
                  : adjustmentNote,
                updatedAt: today,
              };
              bucket.updated += 1;
              summaryResult.updated += 1;
              continue;
            }
          }

          maxPersonId += 1;
          nextPersons.push({
            id: maxPersonId,
            agencyId: existing ? existing.agencyId : targetAgencyForNew,
            name: row.resolvedName.trim(),
            nationalId: '',
            individuals: finalIndividuals,
            decreaseCount: row.resolvedDecreaseCount ?? 0,
            addOrDeleteCount: row.resolvedAddOrDeleteCount ?? 0,
            addOrDeleteAction: row.resolvedAddOrDeleteAction || 'لا يوجد',
            blockType: 'none',
            blockedIndividuals: 0,
            blockReason: '',
            status: '',
            notes: adjustmentNote,
            updatedAt: today,
          });
          if (item.mergeStrategy === 'replace') {
            bucket.replaced += 1;
            summaryResult.replaced += 1;
          } else {
            bucket.added += 1;
            summaryResult.added += 1;
          }
        }

        summaryResult = {
          ...summaryResult,
          totalRows: effectiveTotal,
          buckets: Array.from(bucketMap.values()),
        };

        return {
          ...prev,
          persons: nextPersons,
          readyLists: nextReadyLists,
          readyListItems: nextReadyListItems,
        };
      });

      return summaryResult;
    },
    [commitDataMutation]
  );

  // Legacy single-agency helper preserved for compatibility
  const commitQuickExtractRows = useCallback(
    (params: { targetAgencyId: number; rows: QuickExtractEvaluatedRow[] }) => {
      const today = new Date().toISOString().slice(0, 10);
      let added = 0;
      let updated = 0;

      commitDataMutation((prev) => {
        const nextPersons = [...prev.persons];
        let maxId = nextPersons.reduce((m, p) => Math.max(m, p.id), 100);

        for (const row of params.rows) {
          const calc = computeAdjustedIndividuals(row);
          const agencyPersons = nextPersons.filter(
            (p) => p.agencyId === params.targetAgencyId
          );
          const existing = findExistingMatchInAgency(
            row.resolvedName,
            agencyPersons
          );

          if (existing) {
            const idx = nextPersons.findIndex((p) => p.id === existing.id);
            if (idx !== -1) {
              nextPersons[idx] = {
                ...nextPersons[idx],
                individuals: calc.finalIndividuals,
                notes: nextPersons[idx].notes
                  ? `${nextPersons[idx].notes} · ${calc.adjustmentNote}`
                  : calc.adjustmentNote,
                updatedAt: today,
              };
              updated += 1;
            }
          } else {
            maxId += 1;
            nextPersons.push({
              id: maxId,
              agencyId: params.targetAgencyId,
              name: row.resolvedName.trim(),
              nationalId: '',
              individuals: calc.finalIndividuals,
              blockType: 'none',
              blockedIndividuals: 0,
              blockReason: '',
              status: '',
              notes: calc.adjustmentNote,
              updatedAt: today,
            });
            added += 1;
          }
        }

        return {
          ...prev,
          persons: nextPersons,
        };
      });

      return { added, updated };
    },
    [commitDataMutation]
  );

  // Finance Expenses (Worker Wages, Packaging, Hospitality, Custom, General)
  const addExpense = useCallback(
    (input: {
      agencyId: number;
      description: string;
      amountIqd: number;
      category: ExpenseCategory;
      occurredAt?: string;
      customCategoryLabel?: string;
      workerNames?: string;
      workerCount?: number;
      wageBasis?: AgencyExpense['wageBasis'];
      quantity?: number;
      unitCostIqd?: number;
      quotaLabel?: string;
      notes?: string;
    }) => {
      const dateStr = input.occurredAt || new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const nextId =
          prev.expenses.reduce((m, e) => Math.max(m, e.id), 0) + 1;
        const entry: AgencyExpense = {
          id: nextId,
          agencyId: input.agencyId,
          description: input.description.trim(),
          amountIqd: Math.max(0, Math.round(input.amountIqd)),
          category: input.category,
          occurredAt: dateStr,
          ...(input.customCategoryLabel?.trim()
            ? { customCategoryLabel: input.customCategoryLabel.trim() }
            : {}),
          ...(input.workerNames?.trim()
            ? { workerNames: input.workerNames.trim() }
            : {}),
          ...(input.workerCount && input.workerCount > 0
            ? { workerCount: input.workerCount }
            : {}),
          ...(input.wageBasis ? { wageBasis: input.wageBasis } : {}),
          ...(input.quantity && input.quantity > 0
            ? { quantity: input.quantity }
            : {}),
          ...(input.unitCostIqd && input.unitCostIqd > 0
            ? { unitCostIqd: input.unitCostIqd }
            : {}),
          ...(input.quotaLabel?.trim()
            ? { quotaLabel: input.quotaLabel.trim() }
            : {}),
          ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        };
        return {
          ...prev,
          expenses: [entry, ...prev.expenses],
        };
      });
    },
    [commitDataMutation]
  );

  const deleteExpenseConfirmed = useCallback(
    (expenseId: number) => {
      commitDataMutation((prev) => {
        const target = prev.expenses.find((e) => e.id === expenseId);
        return {
          ...prev,
          expenses: prev.expenses.filter((e) => e.id !== expenseId),
          recycleBin: target
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'expense',
                label: target.description,
                payload: { kind: 'expense', expense: target },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  // Ready Lists
  const createReadyList = useCallback(
    (input: {
      agencyId: number;
      name: string;
      listDate?: string;
      subtitle1?: string;
      subtitle2?: string;
      autoUpdateDate?: boolean;
      note?: string;
      populateFromAgency?: boolean;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      const createdListId =
        state.readyLists.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      commitDataMutation((prev) => {
        const nextListId = Math.max(
          createdListId,
          prev.readyLists.reduce((m, l) => Math.max(m, l.id), 0) + 1
        );
        const agencyName =
          prev.agencies.find((a) => a.id === input.agencyId)?.name || '';
        const shouldPopulate = input.populateFromAgency !== false;
        const agencyPersons = shouldPopulate
          ? prev.persons.filter(
              (p) => p.agencyId === input.agencyId && p.status !== 'مؤرشف'
            )
          : [];
        let nextItemId =
          prev.readyListItems.reduce((m, it) => Math.max(m, it.id), 0) + 1;

        const newItems: ReadyListItem[] = agencyPersons.map((p, idx) => ({
          id: nextItemId++,
          listId: nextListId,
          position: idx + 1,
          sourcePersonId: p.id,
          name: p.name,
          nationalId: p.nationalId,
          individuals: p.individuals,
          blockType: p.blockType,
          blockedIndividuals: p.blockedIndividuals,
          blockReason: p.blockReason,
          status: p.status,
          notes: p.notes,
        }));

        const listDate = input.listDate?.trim() || today;
        const subtitle1 =
          input.subtitle1?.trim() ||
          (agencyName ? `الوكالة: ${agencyName}` : '');
        const subtitle2 = input.subtitle2?.trim() || input.note?.trim() || '';

        return {
          ...prev,
          readyLists: [
            ...prev.readyLists,
            {
              id: nextListId,
              agencyId: input.agencyId,
              name: input.name.trim(),
              listDate,
              subtitle1,
              subtitle2,
              autoUpdateDate: input.autoUpdateDate ?? true,
              lastUpdatedAt: today,
              createdAt: today,
              note: subtitle2,
            },
          ],
          readyListItems: [...prev.readyListItems, ...newItems],
        };
      });
      return createdListId;
    },
    [commitDataMutation, state.readyLists]
  );

  const updateReadyListMetaConfirmed = useCallback(
    (
      listId: number,
      patch: {
        name?: string;
        listDate?: string;
        subtitle1?: string;
        subtitle2?: string;
        autoUpdateDate?: boolean;
        periodMeta?: PeriodQuotaMeta;
        freeformHeader?: FreeformHeaderConfig;
      }
    ) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => ({
        ...prev,
        readyLists: prev.readyLists.map((l) =>
          l.id === listId
            ? {
                ...l,
                name: patch.name !== undefined ? patch.name.trim() : l.name,
                listDate: patch.listDate?.trim() || l.listDate,
                subtitle1:
                  patch.subtitle1 !== undefined ? patch.subtitle1.trim() : l.subtitle1,
                subtitle2:
                  patch.subtitle2 !== undefined ? patch.subtitle2.trim() : l.subtitle2,
                autoUpdateDate: patch.autoUpdateDate ?? l.autoUpdateDate ?? false,
                lastUpdatedAt: today,
                note:
                  patch.subtitle2 !== undefined ? patch.subtitle2.trim() : l.note,
                periodMeta: patch.periodMeta ?? l.periodMeta,
                freeformHeader: patch.freeformHeader ?? l.freeformHeader,
              }
            : l
        ),
      }));
    },
    [commitDataMutation]
  );

  const deleteReadyListConfirmed = useCallback(
    (listId: number) => {
      commitDataMutation((prev) => {
        const targetList = prev.readyLists.find((l) => l.id === listId);
        const listItems = prev.readyListItems.filter(
          (it) => it.listId === listId
        );
        return {
          ...prev,
          readyLists: prev.readyLists.filter((l) => l.id !== listId),
          readyListItems: prev.readyListItems.filter((it) => it.listId !== listId),
          recycleBin: targetList
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'ready_list',
                label: targetList.name,
                payload: { kind: 'ready_list', list: targetList, items: listItems },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  const addReadyListItemDirect = useCallback(
    (input: {
      listId: number;
      name: string;
      nationalId?: string;
      individuals: number | null;
      notes: string;
    }) => {
      commitDataMutation((prev) => {
        const nextId =
          prev.readyListItems.reduce((m, it) => Math.max(m, it.id), 0) + 1;
        const maxPos = prev.readyListItems
          .filter((it) => it.listId === input.listId)
          .reduce((m, it) => Math.max(m, it.position), 0);
        const newItem: ReadyListItem = {
          id: nextId,
          listId: input.listId,
          position: maxPos + 1,
          sourcePersonId: null,
          name: input.name.trim(),
          nationalId: input.nationalId?.trim() || '',
          individuals: input.individuals,
          blockType: 'none',
          blockedIndividuals: 0,
          blockReason: '',
          status: '',
          notes: input.notes.trim(),
          isOverridden: true,
        };
        return {
          ...prev,
          readyListItems: [...prev.readyListItems, newItem],
        };
      });
    },
    [commitDataMutation]
  );

  const updateReadyListItemConfirmed = useCallback(
    (
      itemId: number,
      patch: {
        name?: string;
        nationalId?: string;
        individuals?: number | null;
        blockType?: BlockScope;
        blockedIndividuals?: number;
        blockReason?: string;
        notes?: string;
      }
    ) => {
      commitDataMutation((prev) => ({
        ...prev,
        readyListItems: prev.readyListItems.map((it) => {
          if (it.id !== itemId) return it;
          const nextBlockType = patch.blockType ?? it.blockType ?? 'none';
          const nextStatus: ReadyListItem['status'] =
            nextBlockType === 'full'
              ? 'محجوب'
              : nextBlockType === 'archived'
              ? 'مؤرشف'
              : '';
          const nextTotal =
            patch.individuals !== undefined ? patch.individuals : it.individuals;
          const nextBlocked =
            nextBlockType === 'partial'
              ? Math.min(
                  nextTotal ?? 0,
                  Math.max(
                    0,
                    patch.blockedIndividuals ?? it.blockedIndividuals ?? 0
                  )
                )
              : nextBlockType === 'full'
              ? nextTotal ?? 0
              : 0;
          return {
            ...it,
            ...patch,
            blockType: nextBlockType,
            status: nextStatus,
            blockedIndividuals: nextBlocked,
            isOverridden: true,
          };
        }),
      }));
    },
    [commitDataMutation]
  );

  const removeReadyListItemConfirmed = useCallback(
    (itemId: number) => {
      commitDataMutation((prev) => ({
        ...prev,
        readyListItems: prev.readyListItems.filter((it) => it.id !== itemId),
      }));
    },
    [commitDataMutation]
  );

  const deleteReadyListItemsBulkConfirmed = useCallback(
    (itemIds: number[]) => {
      if (itemIds.length === 0) return;
      const idSet = new Set(itemIds);
      commitDataMutation((prev) => ({
        ...prev,
        readyListItems: prev.readyListItems.filter((it) => !idSet.has(it.id)),
      }));
    },
    [commitDataMutation]
  );

  const createReadyListFromSelection = useCallback(
    (input: {
      name: string;
      agencyId?: number;
      personIds: number[];
      note?: string;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      const createdListId =
        state.readyLists.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      let addedCount = 0;

      commitDataMutation((prev) => {
        const nextListId = Math.max(
          createdListId,
          prev.readyLists.reduce((m, l) => Math.max(m, l.id), 0) + 1
        );
        const firstPerson = prev.persons.find((p) =>
          input.personIds.includes(p.id)
        );
        const resolvedAgencyId =
          input.agencyId ??
          firstPerson?.agencyId ??
          prev.agencies[0]?.id ??
          1;
        const agencyName =
          prev.agencies.find((a) => a.id === resolvedAgencyId)?.name || '';
        let nextItemId =
          prev.readyListItems.reduce((m, it) => Math.max(m, it.id), 0) + 1;

        const idOrder = input.personIds;
        const personMap = new Map(prev.persons.map((p) => [p.id, p]));
        const newItems: ReadyListItem[] = [];

        for (const pid of idOrder) {
          const p = personMap.get(pid);
          if (!p) continue;
          addedCount += 1;
          newItems.push({
            id: nextItemId++,
            listId: nextListId,
            position: newItems.length + 1,
            sourcePersonId: p.id,
            name: p.name,
            nationalId: p.nationalId,
            individuals: p.individuals,
            blockType: p.blockType,
            blockedIndividuals: p.blockedIndividuals,
            blockReason: p.blockReason,
            status: p.status,
            notes: p.notes,
          });
        }

        const listName =
          input.name.trim() || `قائمة توزيع (${newItems.length} مستفيد)`;
        const subtitle2 = input.note?.trim() || `مجموعة منتقاة (${newItems.length} مستفيد)`;

        return {
          ...prev,
          readyLists: [
            ...prev.readyLists,
            {
              id: nextListId,
              agencyId: resolvedAgencyId,
              name: listName,
              listDate: today,
              subtitle1: agencyName ? `الوكالة: ${agencyName}` : 'قائمة مخصصة',
              subtitle2,
              autoUpdateDate: true,
              lastUpdatedAt: today,
              createdAt: today,
              note: subtitle2,
            },
          ],
          readyListItems: [...prev.readyListItems, ...newItems],
        };
      });

      return { listId: createdListId, addedCount };
    },
    [commitDataMutation, state.readyLists]
  );

  const addPersonsToReadyList = useCallback(
    (listId: number, personIds: number[], overrideNotesMap?: Record<number, string>) => {
      const today = new Date().toISOString().slice(0, 10);
      let addedCount = 0;
      commitDataMutation((prev) => {
        const existingSourceIds = new Set(
          prev.readyListItems
            .filter((it) => it.listId === listId && it.sourcePersonId !== null)
            .map((it) => it.sourcePersonId as number)
        );
        let nextId =
          prev.readyListItems.reduce((m, it) => Math.max(m, it.id), 0) + 1;
        let maxPos = prev.readyListItems
          .filter((it) => it.listId === listId)
          .reduce((m, it) => Math.max(m, it.position), 0);

        const newItems: ReadyListItem[] = [];
        for (const pid of personIds) {
          if (existingSourceIds.has(pid)) continue;
          const p = prev.persons.find((cand) => cand.id === pid);
          if (!p) continue;
          existingSourceIds.add(pid);
          maxPos += 1;
          addedCount += 1;
          newItems.push({
            id: nextId++,
            listId,
            position: maxPos,
            sourcePersonId: p.id,
            name: p.name,
            nationalId: p.nationalId,
            individuals: p.individuals,
            blockType: p.blockType,
            blockedIndividuals: p.blockedIndividuals,
            blockReason: p.blockReason,
            status: p.status,
            notes: overrideNotesMap?.[pid] ?? p.notes,
          });
        }

        if (newItems.length === 0) return prev;
        return {
          ...prev,
          readyLists: prev.readyLists.map((l) =>
            l.id === listId ? { ...l, lastUpdatedAt: today } : l
          ),
          readyListItems: [...prev.readyListItems, ...newItems],
        };
      });
      return addedCount;
    },
    [commitDataMutation]
  );

  const moveReadyListItemOrder = useCallback(
    (itemId: number, direction: 'up' | 'down') => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const target = prev.readyListItems.find((it) => it.id === itemId);
        if (!target) return prev;
        const siblings = prev.readyListItems
          .filter((it) => it.listId === target.listId)
          .sort((a, b) => a.position - b.position);
        const idx = siblings.findIndex((it) => it.id === itemId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) {
          return prev;
        }
        const a = siblings[idx];
        const b = siblings[swapIdx];
        return {
          ...prev,
          readyLists: prev.readyLists.map((l) =>
            l.id === target.listId ? { ...l, lastUpdatedAt: today } : l
          ),
          readyListItems: prev.readyListItems.map((it) => {
            if (it.id === a.id) return { ...it, position: b.position };
            if (it.id === b.id) return { ...it, position: a.position };
            return it;
          }),
        };
      });
    },
    [commitDataMutation]
  );

  const movePersonsToAgencyConfirmed = useCallback(
    (personIds: number[], targetAgencyId: number) => {
      const today = new Date().toISOString().slice(0, 10);
      const idSet = new Set(personIds);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) =>
          idSet.has(p.id)
            ? { ...p, agencyId: targetAgencyId, updatedAt: today }
            : p
        ),
        relations: prev.relations.map((r) =>
          idSet.has(r.personId)
            ? { ...r, agencyId: targetAgencyId, updatedAt: today }
            : r
        ),
      }));
    },
    [commitDataMutation]
  );

  // Relationships Section
  const upsertRelationEntry = useCallback(
    (input: {
      personId: number;
      category: RelationCategory;
      note: string;
      reminderDate?: string;
      deliveryAddress?: string;
      deliveryPhone?: string;
      deliveryTime?: string;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const person = prev.persons.find((p) => p.id === input.personId);
        if (!person) return prev;
        const existingIdx = prev.relations.findIndex(
          (r) => r.personId === input.personId && r.category === input.category
        );
        if (existingIdx !== -1) {
          const updated = [...prev.relations];
          updated[existingIdx] = {
            ...updated[existingIdx],
            personName: person.name,
            agencyId: person.agencyId,
            note: input.note.trim(),
            reminderDate: input.reminderDate?.trim() || '',
            deliveryAddress: input.deliveryAddress?.trim() || '',
            deliveryPhone: input.deliveryPhone?.trim() || '',
            deliveryTime: input.deliveryTime?.trim() || '',
            updatedAt: today,
          };
          return { ...prev, relations: updated };
        }
        const nextId =
          prev.relations.reduce((m, r) => Math.max(m, r.id), 0) + 1;
        const entry: RelationEntry = {
          id: nextId,
          personId: person.id,
          personName: person.name,
          agencyId: person.agencyId,
          category: input.category,
          note: input.note.trim(),
          reminderDate: input.reminderDate?.trim() || '',
          deliveryAddress: input.deliveryAddress?.trim() || '',
          deliveryPhone: input.deliveryPhone?.trim() || '',
          deliveryTime: input.deliveryTime?.trim() || '',
          createdAt: today,
          updatedAt: today,
        };
        return {
          ...prev,
          relations: [entry, ...prev.relations],
        };
      });
    },
    [commitDataMutation]
  );

  const removeRelationEntryConfirmed = useCallback(
    (relationId: number) => {
      commitDataMutation((prev) => {
        const target = prev.relations.find((r) => r.id === relationId);
        return {
          ...prev,
          relations: prev.relations.filter((r) => r.id !== relationId),
          recycleBin: target
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'relation',
                label: target.personName,
                payload: { kind: 'relation', relation: target },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  // Agencies (Expert Mode)
  const addAgencyDirect = useCallback(
    (name: string, icon: string) => {
      commitDataMutation((prev) => {
        const nextId = prev.agencies.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        return {
          ...prev,
          agencies: [
            ...prev.agencies,
            { id: nextId, name: name.trim(), icon: icon || '🏢', isLocked: false },
          ],
        };
      });
    },
    [commitDataMutation]
  );

  const updateAgencyDetails = useCallback(
    (
      agencyId: number,
      patch: Partial<Pick<Agency, 'name' | 'icon' | 'logoDataUrl' | 'isLocked'>>
    ) => {
      commitDataMutation((prev) => ({
        ...prev,
        agencies: prev.agencies.map((a) =>
          a.id === agencyId ? { ...a, ...patch } : a
        ),
      }));
    },
    [commitDataMutation]
  );

  const transferAgencyRecordsConfirmed = useCallback(
    (fromAgencyId: number, toAgencyId: number) => {
      if (fromAgencyId === toAgencyId) return;
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) =>
          p.agencyId === fromAgencyId ? { ...p, agencyId: toAgencyId, updatedAt: today } : p
        ),
        relations: prev.relations.map((r) =>
          r.agencyId === fromAgencyId ? { ...r, agencyId: toAgencyId, updatedAt: today } : r
        ),
        expenses: prev.expenses.map((ex) =>
          ex.agencyId === fromAgencyId ? { ...ex, agencyId: toAgencyId } : ex
        ),
        readyLists: prev.readyLists.map((l) =>
          l.agencyId === fromAgencyId ? { ...l, agencyId: toAgencyId } : l
        ),
      }));
    },
    [commitDataMutation]
  );

  const deleteAgencyConfirmed = useCallback(
    (agencyId: number) => {
      commitDataMutation((prev) => {
        const targetAgency = prev.agencies.find((a) => a.id === agencyId);
        if (!targetAgency) return prev;
        let nextBin = prev.recycleBin;
        const removedPersons = prev.persons.filter((p) => p.agencyId === agencyId);
        for (const p of removedPersons) {
          nextBin = pushRecycleBinEntry(nextBin, {
            kind: 'person',
            label: `${p.name} (${targetAgency.name})`,
            payload: { kind: 'person', person: p },
          });
        }
        const removedLists = prev.readyLists.filter((l) => l.agencyId === agencyId);
        const removedListIds = new Set(removedLists.map((l) => l.id));
        for (const list of removedLists) {
          nextBin = pushRecycleBinEntry(nextBin, {
            kind: 'ready_list',
            label: `${list.name} (${targetAgency.name})`,
            payload: {
              kind: 'ready_list',
              list,
              items: prev.readyListItems.filter((it) => it.listId === list.id),
            },
          });
        }
        const removedExpenses = prev.expenses.filter((ex) => ex.agencyId === agencyId);
        for (const ex of removedExpenses) {
          nextBin = pushRecycleBinEntry(nextBin, {
            kind: 'expense',
            label: ex.description,
            payload: { kind: 'expense', expense: ex },
          });
        }
        const removedRelations = prev.relations.filter((r) => r.agencyId === agencyId);
        for (const rel of removedRelations) {
          nextBin = pushRecycleBinEntry(nextBin, {
            kind: 'relation',
            label: rel.personName,
            payload: { kind: 'relation', relation: rel },
          });
        }
        nextBin = pushRecycleBinEntry(nextBin, {
          kind: 'agency',
          label: targetAgency.name,
          payload: { kind: 'agency', agency: targetAgency },
        });
        return {
          ...prev,
          agencies: prev.agencies.filter((a) => a.id !== agencyId),
          persons: prev.persons.filter((p) => p.agencyId !== agencyId),
          expenses: prev.expenses.filter((ex) => ex.agencyId !== agencyId),
          relations: prev.relations.filter((r) => r.agencyId !== agencyId),
          readyLists: prev.readyLists.filter((l) => l.agencyId !== agencyId),
          readyListItems: prev.readyListItems.filter((it) => !removedListIds.has(it.listId)),
          recycleBin: nextBin,
        };
      });
    },
    [commitDataMutation]
  );

  const forceSyncNow = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const sess = getStoredSession();
      if (!sess?.user || !activeUid) {
        if (!options?.silent) {
          throw new Error('يرجى تسجيل الدخول أولًا لمزامنة البيانات.');
        }
        return null;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        hadOfflineOrErrorPendingRef.current = true;
        setSyncStatus('pending_offline');
        if (!options?.silent) {
          throw new Error('لا يوجد اتصال بالإنترنت حالياً؛ تم حفظ تغييراتك في طابور المزامنة.');
        }
        return null;
      }
      if (syncInFlightRef.current) return null;

      syncInFlightRef.current = true;
      setSyncStatus('syncing');

      try {
        const currentSnapshot = latestStateRef.current;
        const deviceId = currentSnapshot.deviceId || getOrCreateDeviceId();
        const clientUpdatedAt = currentSnapshot.updatedAt || new Date().toISOString();
        const selectiveSnapshot = buildSelectiveCloudSnapshot(currentSnapshot);

        const data = await pushWorkspaceLwwApi({
          snapshot: selectiveSnapshot,
          clientUpdatedAt,
          deviceId,
          force: options?.force,
        });

        let finalSyncStatus: WorkspaceSyncStatus = 'cloud_synced';
        if (data.conflictResolved && data.winner === 'server' && data.snapshot) {
          const remoteNormalized = normalizeLoadedWorkspaceState(
            data.snapshot as Partial<AppDatabaseState>,
            activeUid
          );
          const crdt = mergeWorkspacesCrdt({
            localState: currentSnapshot,
            remoteState: remoteNormalized,
            deviceId,
          });
          const conflictAudit = createAuditCheckpointEvent({
            actionType: 'conflict_lww',
            title: 'دمج تعارض المزامنة عبر CRDT',
            summary: crdt.summary,
            conflictResolved: true,
            restorableState: currentSnapshot,
          });
          const hydrated: AppDatabaseState = {
            ...crdt.mergedState,
            lastSyncedAt: new Date().toISOString(),
            auditLog: appendAuditCheckpointEvents(crdt.mergedState.auditLog, conflictAudit),
          };
          lastCloudSyncedUpdatedAtRef.current = hydrated.updatedAt || '';
          suppressNextAutoQueueRef.current = true;
          setState(hydrated);
          setLastConflictNotice(crdt.summary);
          if (crdt.conflictCopies.length > 0) {
            finalSyncStatus = 'conflict_saved';
          }
        } else {
          lastCloudSyncedUpdatedAtRef.current = clientUpdatedAt;
          const syncedAt = new Date().toISOString();
          suppressNextAutoQueueRef.current = true;
          setState((prev) => ({
            ...prev,
            lastSyncedAt: syncedAt,
          }));
        }

        // Background content-addressed chunk dedup & storage quota refresh
        void (async () => {
          try {
            const payloadJson = JSON.stringify(selectiveSnapshot);
            const built = await buildContentAddressedChunks(payloadJson, {
              mimeType: 'application/json',
              filename: 'workspace.json',
            });
            const chunkRes = await uploadChunkedWithDedupAndResume(
              built,
              createServerChunkTransport(),
              { label: currentSnapshot.activePeriod?.quotaName || 'مزامنة سحابية' }
            );
            if (chunkRes.quota) {
              setStorageQuota(chunkRes.quota);
            }
          } catch {
            // Chunk telemetry upload is non-blocking if offline
          }
        })();

        const queue = loadSyncQueue(activeUid);
        const pendingOps = queue.filter((q) => q.status === 'pending' || q.status === 'failed');
        if (pendingOps.length > 0 || (currentSnapshot.auditLog || []).length > 0) {
          try {
            await pushSyncQueueOpsApi({
              operations: pendingOps.map((o) => ({
                id: o.id,
                type: o.type,
                entity: o.entity,
                summary: o.summary,
                updatedAt: o.updatedAt,
                deviceId: o.deviceId,
              })),
              auditEvents: (currentSnapshot.auditLog || []).slice(0, 10).map((ev) => ({
                id: ev.id,
                actionType: ev.actionType,
                title: ev.title,
                summary: ev.summary,
                deviceId: ev.deviceId,
                timestamp: ev.timestamp,
              })),
            });
            if (pendingOps.length > 0) {
              markSyncQueueStatus(
                activeUid,
                pendingOps.map((o) => o.id),
                'synced'
              );
            }
          } catch {
            // Audit log push is non-fatal when main snapshot succeeded
          }
        }

        setSyncQueue(pruneSyncedQueueOperations(activeUid, 12));
        setSyncStatus(finalSyncStatus);
        autoRetryCountRef.current = 0;

        if (hadOfflineOrErrorPendingRef.current) {
          hadOfflineOrErrorPendingRef.current = false;
          emitAppToast({
            title: 'عاد الاتصال وتمت المزامنة تلقائياً',
            description: 'حُفظت كافة تعديلاتك وبياناتك في السحابة بنجاح دون أي فقدان.',
            tone: 'success',
          });
        }

        void syncWorkspaceSummaryToFirestore({
          uid: sess.user.uid,
          title: currentSnapshot.activePeriod?.quotaName || 'مساحة عمل Morrow',
          agencyCount: currentSnapshot.agencies.length,
          recordCount: currentSnapshot.persons.length,
          themePrefs: currentSnapshot.themePrefs,
        }).catch(() => {});

        return data;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'sync_error';
        const lowerErr = errMsg.toLowerCase();
        const isOfflineErr =
          (typeof navigator !== 'undefined' && navigator.onLine === false) ||
          lowerErr.includes('failed to fetch') ||
          lowerErr.includes('networkerror') ||
          lowerErr.includes('network request failed');
        const queue = loadSyncQueue(activeUid);
        const pendingOps = queue.filter((q) => q.status === 'pending' || q.status === 'failed');
        if (pendingOps.length > 0) {
          setSyncQueue(
            markSyncQueueStatus(
              activeUid,
              pendingOps.map((o) => o.id),
              'failed',
              errMsg
            )
          );
        }
        hadOfflineOrErrorPendingRef.current = true;
        if (isOfflineErr && typeof navigator !== 'undefined' && navigator.onLine === false) {
          setIsOnline(false);
        }
        setSyncStatus(isOfflineErr ? 'pending_offline' : 'error');
        if (!options?.silent) throw err;
        return null;
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [activeUid]
  );

  // Automatic background cloud sync flush (debounced + online reconnect + unsynced local drift)
  useEffect(() => {
    if (!activeUid || loadedUidRef.current !== activeUid || !isOnline) return;
    const sess = getStoredSession();
    if (!sess?.user) return;

    const hasPendingQueue = syncQueue.some(
      (q) => q.status === 'pending' || q.status === 'failed'
    );
    const snap = latestStateRef.current;
    const hasUnsyncedDrift =
      syncStatus === 'pending_offline' ||
      (Boolean(snap.updatedAt) &&
        snap.updatedAt !== lastCloudSyncedUpdatedAtRef.current &&
        (snap.agencies.length > 0 ||
          snap.persons.length > 0 ||
          (snap.monthlyArchives?.length || 0) > 0 ||
          (snap.ucrsSessions?.length || 0) > 0));

    if (!hasPendingQueue && !hasUnsyncedDrift) return;

    if (syncStatus === 'error') {
      if (autoRetryCountRef.current >= 4) return;
      const backoffMs = Math.min(30_000, 4_000 * Math.pow(2, autoRetryCountRef.current));
      const retryTimer = window.setTimeout(() => {
        autoRetryCountRef.current += 1;
        void forceSyncNow({ silent: true });
      }, backoffMs);
      return () => window.clearTimeout(retryTimer);
    }

    const delayMs = syncStatus === 'pending_offline' ? 500 : 1200;
    const timer = window.setTimeout(() => {
      void forceSyncNow({ silent: true });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [activeUid, isOnline, syncQueue, syncStatus, state.updatedAt, forceSyncNow]);

  const syncWorkspaceToServer = useCallback(async () => {
    return runWithSignatureLoader(
      {
        label: 'جاري نشر ومزامنة البيانات مع الخادم...',
        subtitle: 'يتم رفع أحدث نسخة وتأمين السجل السحابي لحسابك...',
      },
      async () => forceSyncNow({ silent: false, force: false })
    );
  }, [forceSyncNow]);

  const restoreWorkspaceFromServer = useCallback(async () => {
    return runWithSignatureLoader(
      {
        label: 'جاري استيراد واسترجاع مساحة العمل...',
        subtitle: 'يتم سحب أحدث نسخة محفوظة وتحديث السجلات على جهازك...',
      },
      async () => {
        const sess = getStoredSession();
        if (!sess?.user) {
          throw new Error('يرجى تسجيل الدخول أولًا.');
        }
        const data = await fetchWorkspaceSnapshotApi();
        if (data?.exists && data.snapshot) {
          const normalized = normalizeLoadedWorkspaceState(
            data.snapshot as Partial<AppDatabaseState>,
            activeUid ?? null
          );
          lastCloudSyncedUpdatedAtRef.current = normalized.updatedAt || '';
          suppressNextAutoQueueRef.current = true;
          setState(normalized);
          setPast([]);
          setFuture([]);
          setSyncStatus('cloud_synced');
          return true;
        }
        return false;
      }
    );
  }, [activeUid]);

  const applyServerRestoredSnapshot = useCallback(
    async (rawSnapshot: unknown): Promise<boolean> => {
      if (!rawSnapshot || typeof rawSnapshot !== 'object') return false;
      const normalized = normalizeLoadedWorkspaceState(
        rawSnapshot as Partial<AppDatabaseState>,
        activeUid ?? null
      );
      lastCloudSyncedUpdatedAtRef.current = normalized.updatedAt || '';
      suppressNextAutoQueueRef.current = true;
      setState(normalized);
      if (activeUid) {
        await saveTenantWorkspace(activeUid, normalized);
      }
      setPast([]);
      setFuture([]);
      setSyncStatus('cloud_synced');
      return true;
    },
    [activeUid]
  );

  const resolveConflictCopy = useCallback(
    (copyId: string, action: 'keep_current' | 'restore_copy') => {
      setState((prev) => {
        const copies = prev.conflictCopies || [];
        const target = copies.find((c) => c.id === copyId);
        if (!target) return prev;
        let nextState = {
          ...prev,
          conflictCopies: copies.map((c) =>
            c.id === copyId ? { ...c, resolved: true } : c
          ),
        };
        if (action === 'restore_copy' && target.localSnapshotJson) {
          try {
            const parsed = JSON.parse(target.localSnapshotJson);
            if (target.entityKind === 'person' && parsed && typeof parsed.id === 'number') {
              nextState = {
                ...nextState,
                persons: nextState.persons.map((p) =>
                  p.id === parsed.id ? { ...p, ...parsed } : p
                ),
                updatedAt: new Date().toISOString(),
              };
            } else if (target.entityKind === 'note' && parsed && typeof parsed.id === 'string') {
              nextState = {
                ...nextState,
                workspaceNotes: (nextState.workspaceNotes || []).map((n) =>
                  n.id === parsed.id ? { ...n, ...parsed } : n
                ),
                updatedAt: new Date().toISOString(),
              };
            }
          } catch {
            // ignore malformed snapshot
          }
        }
        return nextState;
      });
    },
    []
  );

  const refreshStorageQuota = useCallback(async () => {
    const q = await fetchStorageQuotaApi().catch(() => null);
    if (q) setStorageQuota(q);
    return q;
  }, []);

  // Real-Time WebSocket Sync + Push Alerts + Remote Session Revocation Listener
  useEffect(() => {
    if (!activeUid || !isOnline) {
      setRealtimeConnected(false);
      return;
    }
    const localDeviceId = getOrCreateDeviceId();
    void audioManager.fetchAndHydrateFromServer();
    const disconnect = createRealtimeSyncSocket({
      onStatusChange: (connected) => setRealtimeConnected(connected),
      onEvent: (ev) => {
        if (ev.type === 'session:revoked') {
          emitAppToast({
            title: 'تم إنهاء الجلسة عن بُعد',
            description: ev.reason || 'تم تسجيل الخروج من جهاز آخر.',
            tone: 'warning',
            channel: 'security',
            sfxEvent: 'warn',
          });
          onRemoteSessionRevokedRef.current?.(ev.reason);
          return;
        }
        if (ev.type === 'security:alert') {
          emitAppToast({
            title: ev.title,
            description: ev.summary,
            tone: 'warning',
            channel: 'security',
            sfxEvent: 'warn',
          });
          if (latestStateRef.current.securityPrefs?.pushAlertsEnabled !== false) {
            void triggerBrowserSecurityNotification(ev.title, ev.summary);
          }
          return;
        }
        if (ev.type === 'settings:audio_updated' && ev.deviceId !== localDeviceId) {
          audioManager.applyRemoteSettings(ev.settings, ev.deviceLabel);
          return;
        }
        if (ev.type === 'workspace:updated' && ev.deviceId !== localDeviceId) {
          void (async () => {
            try {
              const remoteRes = await fetchWorkspaceSnapshotApi();
              if (!remoteRes?.exists || !remoteRes.snapshot) return;
              const remoteNorm = normalizeLoadedWorkspaceState(
                remoteRes.snapshot as Partial<AppDatabaseState>,
                activeUid
              );
              const crdt = mergeWorkspacesCrdt({
                localState: latestStateRef.current,
                remoteState: remoteNorm,
                deviceId: localDeviceId,
              });
              lastCloudSyncedUpdatedAtRef.current = crdt.mergedState.updatedAt || '';
              suppressNextAutoQueueRef.current = true;
              setState(crdt.mergedState);
              await saveTenantWorkspace(activeUid, crdt.mergedState);
              setSyncStatus(crdt.conflictCopies.length > 0 ? 'conflict_saved' : 'cloud_synced');
              emitAppToast({
                title: 'تمت مزامنة تحديث فوري من جهاز آخر',
                description:
                  crdt.conflictCopies.length > 0
                    ? crdt.summary
                    : 'تم تحديث السجلات مباشرة عبر قناة WebSocket الحية.',
                tone: crdt.conflictCopies.length > 0 ? 'warning' : 'success',
                channel: 'sync',
                sfxEvent: 'sync_complete',
              });
            } catch {
              // ignore transient pull errors
            }
          })();
        }
      },
    });
    return () => disconnect();
  }, [activeUid, isOnline]);

  // --- Monthly Archives & Active Period Management ---
  const activePeriod = resolvePeriodMeta(state.activePeriod);

  const updateActivePeriod = useCallback((patch: Partial<PeriodQuotaMeta>) => {
    setState((prev) => ({
      ...prev,
      activePeriod: resolvePeriodMeta({
        ...resolvePeriodMeta(prev.activePeriod),
        ...patch,
      }),
    }));
  }, []);

  const archiveCurrentPeriod = useCallback(
    (options?: {
      label?: string;
      isClosed?: boolean;
      archiveSource?: 'manual' | 'auto';
      periodOverride?: PeriodQuotaMeta;
      freeformHeader?: FreeformHeaderConfig;
    }): MonthlyArchiveRecord => {
      let createdRecord: MonthlyArchiveRecord | null = null;
      setState((prev) => {
        const periodMeta = resolvePeriodMeta(
          options?.periodOverride || prev.activePeriod
        );
        const snap = createMonthlyArchiveSnapshot({
          label: options?.label,
          archiveSource: options?.archiveSource || 'manual',
          isClosed: options?.isClosed ?? true,
          periodMeta,
          freeformHeader:
            options?.freeformHeader || prev.tableHeaders?.master_roster?.freeformHeader,
          agencies: prev.agencies,
          persons: prev.persons,
          readyLists: prev.readyLists,
          readyListItems: prev.readyListItems,
          expenses: prev.expenses,
          relations: prev.relations,
          tableHeaders: prev.tableHeaders,
          calculationSettings: prev.calculationSettings,
        });
        createdRecord = snap;
        const existing = prev.monthlyArchives || [];
        return {
          ...prev,
          monthlyArchives: [snap, ...existing],
        };
      });
      return (
        createdRecord ||
        createMonthlyArchiveSnapshot({
          label: options?.label,
          archiveSource: options?.archiveSource || 'manual',
          isClosed: options?.isClosed ?? true,
          periodMeta: activePeriod,
          agencies: state.agencies,
          persons: state.persons,
          readyLists: state.readyLists,
          readyListItems: state.readyListItems,
          expenses: state.expenses,
          relations: state.relations,
          tableHeaders: state.tableHeaders,
          calculationSettings: state.calculationSettings,
        })
      );
    },
    [activePeriod, state]
  );

  const startNextMonthRollover = useCallback(
    (options?: {
      nextQuotaName?: string;
      nextQuotaNumber?: string;
      nextDate?: string;
      autoArchiveCurrent?: boolean;
      resetNotesAndChanges?: boolean;
    }) => {
      setState((prev) => {
        const curPeriod = resolvePeriodMeta(prev.activePeriod);
        let nextArchives = prev.monthlyArchives || [];

        if (options?.autoArchiveCurrent !== false) {
          const archived = createMonthlyArchiveSnapshot({
            archiveSource: 'auto',
            isClosed: true,
            periodMeta: curPeriod,
            freeformHeader: prev.tableHeaders?.master_roster?.freeformHeader,
            agencies: prev.agencies,
            persons: prev.persons,
            readyLists: prev.readyLists,
            readyListItems: prev.readyListItems,
            expenses: prev.expenses,
            relations: prev.relations,
            tableHeaders: prev.tableHeaders,
            calculationSettings: prev.calculationSettings,
          });
          nextArchives = [archived, ...nextArchives];
        }

        const nextPeriod = prepareNextMonthRollover({
          currentPeriod: curPeriod,
          nextQuotaName: options?.nextQuotaName,
          nextQuotaNumber: options?.nextQuotaNumber,
          nextDate: options?.nextDate,
        });

        const nextPersons = options?.resetNotesAndChanges
          ? prev.persons.map((p) => ({
              ...p,
              decreaseCount: 0,
              addOrDeleteCount: 0,
              addOrDeleteAction: 'لا يوجد' as const,
              updatedAt: nextPeriod.fullDate,
            }))
          : prev.persons;

        return {
          ...prev,
          activePeriod: nextPeriod,
          monthlyArchives: nextArchives,
          persons: nextPersons,
        };
      });
      setPast([]);
      setFuture([]);
    },
    []
  );

  const markArchiveCloudSynced = useCallback((archiveId: string) => {
    const syncedAt = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      monthlyArchives: (prev.monthlyArchives || []).map((a) =>
        a.id === archiveId ? { ...a, syncedToCloudAt: syncedAt } : a
      ),
    }));
  }, []);

  const deleteMonthlyArchive = useCallback((archiveId: string) => {
    setState((prev) => ({
      ...prev,
      monthlyArchives: (prev.monthlyArchives || []).filter(
        (a) => a.id !== archiveId
      ),
    }));
  }, []);

  const upsertUcrsSession = useCallback((session: UcrsSession) => {
    // Strip oversized image previews on older sessions to keep localStorage well within quota
    const compactSources = session.sources.map((s) => ({
      ...s,
      previewDataUrl:
        s.previewDataUrl && s.previewDataUrl.length > 260000
          ? undefined
          : s.previewDataUrl,
    }));
    const compactSession: UcrsSession = {
      ...session,
      sources: compactSources,
    };
    setState((prev) => {
      const existing = prev.ucrsSessions || [];
      const idx = existing.findIndex((s) => s.id === compactSession.id);
      const nextList =
        idx === -1
          ? [compactSession, ...existing].slice(0, 25)
          : existing.map((s, i) => (i === idx ? compactSession : s));
      return {
        ...prev,
        ucrsSessions: nextList,
      };
    });
  }, []);

  const deleteUcrsSession = useCallback((sessionId: string) => {
    setState((prev) => ({
      ...prev,
      ucrsSessions: (prev.ucrsSessions || []).filter((s) => s.id !== sessionId),
    }));
  }, []);

  const upsertUcrsLearningRule = useCallback((rule: UcrsLearningRule) => {
    setState((prev) => {
      const existing = prev.ucrsLearningRules || [];
      const idx = existing.findIndex(
        (r) =>
          r.wrongToken === rule.wrongToken &&
          r.correctedToken === rule.correctedToken
      );
      if (idx !== -1) {
        const next = existing.map((r, i) =>
          i === idx ? { ...r, usageCount: r.usageCount + 1, enabled: true } : r
        );
        return { ...prev, ucrsLearningRules: next };
      }
      return {
        ...prev,
        ucrsLearningRules: [rule, ...existing].slice(0, 80),
      };
    });
  }, []);

  const toggleUcrsLearningRule = useCallback((ruleId: string) => {
    setState((prev) => ({
      ...prev,
      ucrsLearningRules: (prev.ucrsLearningRules || []).map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  }, []);

  const deleteUcrsLearningRule = useCallback((ruleId: string) => {
    setState((prev) => ({
      ...prev,
      ucrsLearningRules: (prev.ucrsLearningRules || []).filter(
        (r) => r.id !== ruleId
      ),
    }));
  }, []);

  const applyAssistantAutoFixes = useCallback(
    (issueIds?: string[]) => {
      const outcome = applyDiagnosticAutoFixes(state, issueIds);
      if (outcome.fixedCount > 0) {
        commitDataMutation((prev) => applyDiagnosticAutoFixes(prev, issueIds).nextState);
      }
      return {
        fixedCount: outcome.fixedCount,
        summaryLines: outcome.summaryLines,
      };
    },
    [state, commitDataMutation]
  );

  return {
    state,
    workspaceCosmos: activeCosmos,
    activePeriod,
    monthlyArchives: state.monthlyArchives || [],
    ucrsSessions: state.ucrsSessions || [],
    ucrsLearningRules: state.ucrsLearningRules || [],
    themePrefs: activeThemePrefs,
    expertTableConfig: {
      ...DEFAULT_EXPERT_TABLE_CONFIG,
      ...(state.expertTableConfig || {}),
    },
    quickExtractPrefs: {
      ...DEFAULT_QUICK_EXTRACT_PREFS,
      ...(state.quickExtractPrefs || {}),
    },
    relationsPrefs: {
      ...DEFAULT_RELATIONS_PREFS,
      ...(state.relationsPrefs || {}),
    },
    generalPrefs: {
      ...DEFAULT_GENERAL_PREFS,
      ...(state.generalPrefs || {}),
      granularControls: {
        ...DEFAULT_GENERAL_PREFS.granularControls!,
        ...(state.generalPrefs?.granularControls || {}),
      },
      agencyAccentColors: {
        ...(DEFAULT_GENERAL_PREFS.agencyAccentColors || {}),
        ...(state.generalPrefs?.agencyAccentColors || {}),
      },
      surface2dPrefs: activeSurface2dPrefs,
    },
    securityPrefs: {
      ...DEFAULT_SECURITY_PREFS,
      ...(state.securityPrefs || {}),
      secondaryCloud: {
        ...DEFAULT_SECURITY_PREFS.secondaryCloud!,
        ...(state.securityPrefs?.secondaryCloud || {}),
      },
      driveAccountMeta: {
        ...DEFAULT_SECURITY_PREFS.driveAccountMeta!,
        ...(state.securityPrefs?.driveAccountMeta || {}),
      },
      smartSync: {
        ...DEFAULT_SECURITY_PREFS.smartSync!,
        ...(state.securityPrefs?.smartSync || {}),
      },
    },
    recycleBin: state.recycleBin || [],
    workspaceNotes: state.workspaceNotes || [],
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    setModeTier,
    setEditorEnabled,
    setDarkTheme,
    setThemePrefs,
    resetThemePrefs,
    saveCustomThemePreset,
    deleteCustomThemePreset,
    updateWorkspaceCosmos,
    updateAccessibilityPrefs,
    updateFeatureFlags,
    togglePinnedCosmosNode,
    recordRecentCosmosNode,
    toggleHiddenCosmosWorld,
    dismissCosmosSuggestion,
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
    restoreAllRecycleBinItems,
    purgeRecycleBinItem,
    clearRecycleBin,
    importWorkspaceJson,
    updateTableHeaderMeta,
    updateActivePeriod,
    archiveCurrentPeriod,
    startNextMonthRollover,
    markArchiveCloudSynced,
    deleteMonthlyArchive,
    upsertUcrsSession,
    deleteUcrsSession,
    upsertUcrsLearningRule,
    toggleUcrsLearningRule,
    deleteUcrsLearningRule,
    addPersonDirect,
    updatePersonConfirmed,
    bulkUpdatePersonsCategory,
    bulkUpdatePersonsStatusAndCategory,
    deletePersonConfirmed,
    deletePersonsBulkConfirmed,
    commitQuickExtractRows,
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
    transferAgencyRecordsConfirmed,
    deleteAgencyConfirmed,
    applyAssistantAutoFixes,
    syncWorkspaceToServer,
    forceSyncNow,
    restoreWorkspaceFromServer,
    exportMemoryVaultJson,
    restoreAuditCheckpoint,
    updateSmartPreferences,
    smartPreferences: state.smartPreferences || {},
    auditLog: state.auditLog || [],
    syncStatus,
    storageStatus,
    storageQuota,
    refreshStorageQuota,
    realtimeConnected,
    conflictCopies: state.conflictCopies || [],
    resolveConflictCopy,
    applyServerRestoredSnapshot,
    syncQueue,
    isOnline,
    lastConflictNotice,
    dismissConflictNotice: () => setLastConflictNotice(null),
    compressionStats,
    storageReady,
  };
}
