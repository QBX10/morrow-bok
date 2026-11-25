import type {
  AppDatabaseState,
  SyncQueueOpStatus,
  SyncQueueOperation,
} from '../../types/agency';

const DEVICE_ID_STORAGE_KEY = 'morrow_device_id_v1';

function sanitizeUid(uid: string): string {
  return String(uid || 'guest').replace(/[^a-zA-Z0-9._:@-]/g, '_');
}

export function getSyncQueueStorageKey(uid: string): string {
  return `morrow_sync_queue_v1::${sanitizeUid(uid)}`;
}

export function getOrCreateDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (existing && existing.trim().length >= 6) {
        return existing.trim();
      }
      const generated = `dev_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
      return generated;
    }
  } catch {
    // ignore storage restriction
  }
  return `dev_mem_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadSyncQueue(uid: string): SyncQueueOperation[] {
  if (!uid || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getSyncQueueStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SyncQueueOperation =>
        Boolean(item && typeof item.id === 'string' && typeof item.updatedAt === 'string')
    );
  } catch {
    return [];
  }
}

export function saveSyncQueue(uid: string, queue: SyncQueueOperation[]): void {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    const trimmed = queue.slice(-80);
    localStorage.setItem(getSyncQueueStorageKey(uid), JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

export function enqueueSyncOperation(
  uid: string,
  op: Omit<SyncQueueOperation, 'id' | 'status' | 'retryCount'> & { id?: string }
): SyncQueueOperation[] {
  const queue = loadSyncQueue(uid);
  const entry: SyncQueueOperation = {
    id:
      op.id ||
      `sq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    type: op.type,
    entity: op.entity,
    summary: op.summary,
    updatedAt: op.updatedAt,
    deviceId: op.deviceId,
    status: 'pending',
    retryCount: 0,
  };
  // Coalesce consecutive pending workspace_snapshot ops to keep queue lean
  const filtered =
    entry.type === 'workspace_snapshot'
      ? queue.filter((q) => !(q.type === 'workspace_snapshot' && q.status === 'pending'))
      : queue;
  const next = [...filtered, entry].slice(-80);
  saveSyncQueue(uid, next);
  return next;
}

export function markSyncQueueStatus(
  uid: string,
  opIds: string[],
  status: SyncQueueOpStatus,
  errorMessage?: string
): SyncQueueOperation[] {
  if (opIds.length === 0) return loadSyncQueue(uid);
  const idSet = new Set(opIds);
  const queue = loadSyncQueue(uid);
  const next = queue.map((op) => {
    if (!idSet.has(op.id)) return op;
    return {
      ...op,
      status,
      retryCount: status === 'failed' ? (op.retryCount || 0) + 1 : op.retryCount,
      lastError: status === 'failed' ? errorMessage : undefined,
    };
  });
  saveSyncQueue(uid, next);
  return next;
}

export function pruneSyncedQueueOperations(uid: string, keepRecent = 12): SyncQueueOperation[] {
  const queue = loadSyncQueue(uid);
  const unsynced = queue.filter((q) => q.status !== 'synced');
  const recentSynced = queue.filter((q) => q.status === 'synced').slice(-keepRecent);
  const next = [...recentSynced, ...unsynced].sort(
    (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
  );
  saveSyncQueue(uid, next);
  return next;
}

export interface LwwReconcileResult {
  winner: 'local' | 'remote' | 'equal';
  state: AppDatabaseState;
  conflictDetected: boolean;
  summary: string;
}

function parseTimestampSafe(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function hasWorkspaceContent(state: Partial<AppDatabaseState> | null | undefined): boolean {
  if (!state) return false;
  return (
    (Array.isArray(state.agencies) && state.agencies.length > 0) ||
    (Array.isArray(state.persons) && state.persons.length > 0) ||
    (Array.isArray(state.expenses) && state.expenses.length > 0) ||
    (Array.isArray(state.readyLists) && state.readyLists.length > 0) ||
    (Array.isArray(state.monthlyArchives) && state.monthlyArchives.length > 0)
  );
}

/**
 * Resolves divergence between device-local state and cloud snapshot using
 * Last-Write-Wins (LWW) based on ISO timestamps, preferring populated cloud
 * state when an empty fresh device first authenticates.
 */
export function reconcileWorkspaceLww(params: {
  localState: AppDatabaseState;
  localUpdatedAt?: string;
  remoteState: AppDatabaseState | null;
  remoteUpdatedAt?: string;
  hasPendingLocalOps?: boolean;
}): LwwReconcileResult {
  const { localState, remoteState, hasPendingLocalOps = false } = params;
  if (!remoteState) {
    return {
      winner: 'local',
      state: localState,
      conflictDetected: false,
      summary: 'لا توجد نسخة سحابية سابقة؛ سيتم اعتماد النسخة المحلية.',
    };
  }

  const localHasData = hasWorkspaceContent(localState);
  const remoteHasData = hasWorkspaceContent(remoteState);

  if (!localHasData && remoteHasData && !hasPendingLocalOps) {
    return {
      winner: 'remote',
      state: remoteState,
      conflictDetected: false,
      summary: 'تم سحب مساحة العمل من السحابة لهذا الجهاز الجديد.',
    };
  }

  const localMs = parseTimestampSafe(params.localUpdatedAt || localState.updatedAt);
  const remoteMs = parseTimestampSafe(params.remoteUpdatedAt || remoteState.updatedAt);

  if (remoteMs > localMs + 500) {
    return {
      winner: 'remote',
      state: remoteState,
      conflictDetected: hasPendingLocalOps || (localHasData && localMs > 0),
      summary:
        'النسخة السحابية أحدث زمنياً (Last-Write-Wins)؛ تم تحديث الجهاز بأحدث التعديلات.',
    };
  }

  if (localMs > remoteMs + 500 || hasPendingLocalOps) {
    return {
      winner: 'local',
      state: localState,
      conflictDetected: remoteMs > 0 && localHasData && remoteHasData,
      summary:
        'التعديلات المحلية أحدث زمنياً؛ سيتم رفعها للسحابة لتوحيد كافة الأجهزة.',
    };
  }

  return {
    winner: 'equal',
    state: localState,
    conflictDetected: false,
    summary: 'النسخة المحلية والسحابية متطابقتان ومحدّثتان.',
  };
}
