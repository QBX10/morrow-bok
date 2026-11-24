import type { AppDatabaseState } from '../../types/agency';
import {
  DEFAULT_EXPERT_TABLE_CONFIG,
  DEFAULT_GENERAL_PREFS,
  DEFAULT_QUICK_EXTRACT_PREFS,
  DEFAULT_QUICK_TOGGLE_IDS,
  DEFAULT_RELATIONS_PREFS,
  DEFAULT_SECURITY_PREFS,
  DEFAULT_WORKSPACE_COSMOS,
} from '../../data/seedData';
import { DEFAULT_CALCULATION_SETTINGS } from '../../utils/agencyLogic';
import { DEFAULT_THEME_PREFERENCES } from '../../utils/themes';
import {
  compressJsonPayload,
  decompressJsonPayload,
  extractCompressionStats,
  type CompressedEnvelope,
  type CompressionStats,
} from '../compression/compressionEngine';

const TENANT_IDB_NAME = 'morrow_tenant_vault_v1';
const TENANT_IDB_STORE = 'tenant_records';
const TENANT_IDB_VERSION = 1;

export interface TenantKeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface TenantWorkspaceLoadResult {
  state: AppDatabaseState;
  stats: CompressionStats;
}

export function getTenantWorkspaceKey(uid: string): string {
  const safeUid = sanitizeTenantUid(uid);
  return `users/${safeUid}/workspace`;
}

export function getTenantLocalFallbackKey(uid: string): string {
  const safeUid = sanitizeTenantUid(uid);
  return `morrow_db_user_${safeUid}`;
}

export function getTenantOnboardingKey(uid?: string | null): string {
  if (!uid) return 'morrow_onboarding_done_guest';
  return `morrow_onboarding_done_${sanitizeTenantUid(uid)}`;
}

function sanitizeTenantUid(uid: string): string {
  const trimmed = String(uid || '').trim();
  if (!trimmed) {
    throw new Error('Tenant uid is required for isolated storage.');
  }
  return trimmed.replace(/[^a-zA-Z0-9._:@-]/g, '_');
}

export function getCleanTenantInitialState(_uid?: string | null): AppDatabaseState {
  const today = new Date().toISOString().slice(0, 10);
  const nowDate = new Date();
  return {
    stateVersion: 4,
    workspaceCosmos: {
      ...DEFAULT_WORKSPACE_COSMOS,
      pinnedNodeIds: ['cap_master_roster_portal', 'cap_calc_fees'],
      recentNodeIds: ['world_agencies_tables', 'world_calculator'],
      hiddenWorldIds: [],
      dismissedSuggestionIds: [],
      changeLog: [],
    },
    modeTier: 'expert',
    editorEnabled: true,
    darkTheme: true,
    requireLoginOnStart: true,
    calculationSettings: { ...DEFAULT_CALCULATION_SETTINGS },
    agencies: [],
    persons: [],
    expenses: [],
    readyLists: [],
    readyListItems: [],
    relations: [],
    tableHeaders: {
      master_roster: {
        title: 'السجل الشامل — جميع الوكالات',
        subtitle: 'كشف موحد لكافة المستفيدين والحصص والحالات عبر جميع الوكالات',
        date: today,
        autoUpdateDate: true,
        lastUpdatedAt: today,
      },
      relationships: {
        title: 'قسم العلاقات والمتابعة الميدانية',
        subtitle:
          'المفضلة · التعديل لاحقًا · التذكير · ملاحظات التوصيل · قيد المراجعة',
        date: today,
        autoUpdateDate: true,
        lastUpdatedAt: today,
      },
    },
    topBarConfig: {
      mode: 'normal',
      autoFocus: true,
      autoFocusAction: 'hide',
      autoHideInTables: false,
      showViewTitle: true,
      showQuickFocusToggle: true,
      showUndoRedo: true,
      showAuthButton: true,
    },
    expertTableConfig: {
      ...DEFAULT_EXPERT_TABLE_CONFIG,
      visibleColumns: [...DEFAULT_EXPERT_TABLE_CONFIG.visibleColumns],
      columnOrder: [...DEFAULT_EXPERT_TABLE_CONFIG.columnOrder],
      customCategories: [...DEFAULT_EXPERT_TABLE_CONFIG.customCategories],
      customColumns: [],
    },
    quickExtractPrefs: {
      ...DEFAULT_QUICK_EXTRACT_PREFS,
      focusedFields: [...DEFAULT_QUICK_EXTRACT_PREFS.focusedFields],
      referenceTemplates: [],
    },
    relationsPrefs: { ...DEFAULT_RELATIONS_PREFS },
    generalPrefs: {
      ...DEFAULT_GENERAL_PREFS,
      quickToggleIds: DEFAULT_QUICK_TOGGLE_IDS.filter(
        (id) => id !== 'qt_dark_mode'
      ),
      dismissedAttentionIds: [],
      recurringExpenseTemplates: [],
      homeLayoutPrefs: {
        sectionOrder: [
          'portfolio',
          'agencies',
          'workspace_tools',
          'radar_comparison',
          'mini_widgets',
        ],
        hiddenSections: [],
        activeMiniWidgets: [],
      },
    },
    securityPrefs: {
      ...DEFAULT_SECURITY_PREFS,
      smartSync: {
        lastHash: '',
        lastDataHash: '',
        lastRecordCount: 0,
        lastAttachmentCount: 0,
        lastSavedAt: '',
        lastSaveMode: 'manual',
        integrityChecksum: '',
        weeklyAutoEnabled: true,
        history: [],
      },
    },
    themePrefs: {
      ...DEFAULT_THEME_PREFERENCES,
      appTheme: 'abyssal-emerald',
      themeColorMode: 'dark',
    },
    recycleBin: [],
    workspaceNotes: [],
    activePeriod: {
      fullDate: today,
      year: nowDate.getFullYear(),
      monthNumber: nowDate.getMonth() + 1,
      monthName: 'الشهر الحالي',
      quotaName: 'الوجبة الحالية',
      quotaNumber: '1',
      quotaDate: today,
    },
    monthlyArchives: [],
    ucrsSessions: [],
    ucrsLearningRules: [],
  };
}

export function createMemoryKeyValueStore(): TenantKeyValueStore {
  const map = new Map<string, unknown>();
  return {
    async get(key: string) {
      return map.get(key) ?? null;
    },
    async set(key: string, value: unknown) {
      map.set(key, value);
    },
    async delete(key: string) {
      map.delete(key);
    },
  };
}

function createBrowserIndexedDbStore(): TenantKeyValueStore {
  const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(TENANT_IDB_NAME, TENANT_IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TENANT_IDB_STORE)) {
          db.createObjectStore(TENANT_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    });

  return {
    async get(key: string) {
      try {
        const db = await openDb();
        return await new Promise<unknown>((resolve, reject) => {
          const tx = db.transaction(TENANT_IDB_STORE, 'readonly');
          const store = tx.objectStore(TENANT_IDB_STORE);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => reject(req.error);
        });
      } catch {
        return null;
      }
    },
    async set(key: string, value: unknown) {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(TENANT_IDB_STORE, 'readwrite');
          const store = tx.objectStore(TENANT_IDB_STORE);
          const req = store.put(value, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        // Handled by per-uid localStorage fallback layer
      }
    },
    async delete(key: string) {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(TENANT_IDB_STORE, 'readwrite');
          const store = tx.objectStore(TENANT_IDB_STORE);
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        // Ignore if IDB unavailable
      }
    },
  };
}

export function createTenantStorageDriver(backingStore?: TenantKeyValueStore) {
  const store = backingStore || createBrowserIndexedDbStore();

  async function saveTenantWorkspace(
    uid: string,
    state: AppDatabaseState
  ): Promise<CompressionStats> {
    const key = getTenantWorkspaceKey(uid);
    const envelope = await compressJsonPayload(state);
    const stats = extractCompressionStats(envelope);

    await store.set(key, envelope);

    // Strictly per-uid fallback mirror (no shared global key)
    if (typeof localStorage !== 'undefined') {
      try {
        const lsEnvelope: CompressedEnvelope = {
          v: envelope.v,
          alg: envelope.alg,
          rawBytes: envelope.rawBytes,
          compressedBytes: envelope.compressedBytes,
          savedBytes: envelope.savedBytes,
          savingsPct: envelope.savingsPct,
          payloadText: envelope.payloadText,
          updatedAt: envelope.updatedAt,
        };
        localStorage.setItem(
          getTenantLocalFallbackKey(uid),
          JSON.stringify(lsEnvelope)
        );
      } catch {
        // Quota exceeded is harmless because IndexedDB holds primary record
      }
    }

    return stats;
  }

  async function loadTenantWorkspace(
    uid: string
  ): Promise<TenantWorkspaceLoadResult | null> {
    const key = getTenantWorkspaceKey(uid);
    let envelope = (await store.get(key)) as CompressedEnvelope | null;

    if (!envelope && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(getTenantLocalFallbackKey(uid));
        if (raw) {
          envelope = JSON.parse(raw) as CompressedEnvelope;
        }
      } catch {
        envelope = null;
      }
    }

    if (!envelope) return null;

    const state = await decompressJsonPayload<AppDatabaseState>(envelope);
    const stats = extractCompressionStats({
      rawBytes: envelope.rawBytes || 0,
      compressedBytes: envelope.compressedBytes || 0,
      savedBytes: envelope.savedBytes || 0,
      savingsPct: envelope.savingsPct || 0,
      alg: envelope.alg || 'raw-json',
      updatedAt: envelope.updatedAt || new Date().toISOString(),
    });
    return { state, stats };
  }

  async function clearTenantWorkspace(uid: string): Promise<void> {
    await store.delete(getTenantWorkspaceKey(uid));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(getTenantLocalFallbackKey(uid));
      } catch {
        // ignore
      }
    }
  }

  return {
    saveTenantWorkspace,
    loadTenantWorkspace,
    clearTenantWorkspace,
  };
}

const defaultDriver = createTenantStorageDriver();

export const saveTenantWorkspace = defaultDriver.saveTenantWorkspace;
export const loadTenantWorkspace = defaultDriver.loadTenantWorkspace;
export const clearTenantWorkspace = defaultDriver.clearTenantWorkspace;
