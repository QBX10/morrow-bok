import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enqueueSyncOperation,
  loadSyncQueue,
  markSyncQueueStatus,
  pruneSyncedQueueOperations,
  reconcileWorkspaceLww,
} from './syncEngine.ts';
import { getCleanTenantInitialState } from './tenantStorage.ts';

function withMockLocalStorage(fn: () => void): void {
  const storeMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem(key: string) {
      return storeMap.has(key) ? storeMap.get(key)! : null;
    },
    setItem(key: string, value: string) {
      storeMap.set(key, String(value));
    },
    removeItem(key: string) {
      storeMap.delete(key);
    },
    clear() {
      storeMap.clear();
    },
    key(index: number) {
      return Array.from(storeMap.keys())[index] ?? null;
    },
    get length() {
      return storeMap.size;
    },
  };

  const prevDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
  });

  try {
    fn();
  } finally {
    if (prevDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', prevDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  }
}

test('syncEngine coalesces pending workspace snapshots and transitions queue statuses', () => {
  withMockLocalStorage(() => {
    const uid = 'uid_queue_01';

    enqueueSyncOperation(uid, {
      type: 'workspace_snapshot',
      entity: 'workspace',
      summary: 'تحديث أول',
      updatedAt: '2026-11-25T08:00:00.000Z',
      deviceId: 'dev_1',
    });

    const afterSecond = enqueueSyncOperation(uid, {
      type: 'workspace_snapshot',
      entity: 'workspace',
      summary: 'تحديث ثانٍ مدمج',
      updatedAt: '2026-11-25T08:01:00.000Z',
      deviceId: 'dev_1',
    });

    assert.equal(afterSecond.length, 1);
    assert.equal(afterSecond[0].status, 'pending');
    assert.equal(afterSecond[0].summary, 'تحديث ثانٍ مدمج');

    const failed = markSyncQueueStatus(
      uid,
      [afterSecond[0].id],
      'failed',
      'network offline'
    );
    assert.equal(failed[0].status, 'failed');
    assert.equal(failed[0].retryCount, 1);
    assert.equal(failed[0].lastError, 'network offline');

    const synced = markSyncQueueStatus(uid, [afterSecond[0].id], 'synced');
    assert.equal(synced[0].status, 'synced');
    assert.equal(synced[0].lastError, undefined);

    const pruned = pruneSyncedQueueOperations(uid, 5);
    assert.equal(pruned.length, 1);
    assert.equal(loadSyncQueue(uid).length, 1);
  });
});

test('reconcileWorkspaceLww pulls remote data onto empty device and resolves conflicts by newest timestamp', () => {
  const uid = 'uid_lww_01';

  // 1. Fresh empty device should pull populated remote snapshot without conflict flag
  const emptyLocal = getCleanTenantInitialState(uid);
  const populatedRemote = getCleanTenantInitialState(uid);
  populatedRemote.agencies = [{ id: 1, name: 'وكالة السحابة', icon: '☁️', isLocked: false }];
  populatedRemote.updatedAt = '2026-11-25T08:00:00.000Z';

  const freshPull = reconcileWorkspaceLww({
    localState: emptyLocal,
    remoteState: populatedRemote,
    remoteUpdatedAt: populatedRemote.updatedAt,
    hasPendingLocalOps: false,
  });
  assert.equal(freshPull.winner, 'remote');
  assert.equal(freshPull.conflictDetected, false);
  assert.equal(freshPull.state.agencies.length, 1);

  // 2. Remote newer while local also has data -> remote wins with conflictDetected
  const olderLocal = getCleanTenantInitialState(uid);
  olderLocal.agencies = [{ id: 1, name: 'محلي قديم', icon: '📦', isLocked: false }];
  olderLocal.updatedAt = '2026-11-25T07:00:00.000Z';

  const remoteWins = reconcileWorkspaceLww({
    localState: olderLocal,
    localUpdatedAt: olderLocal.updatedAt,
    remoteState: populatedRemote,
    remoteUpdatedAt: '2026-11-25T08:10:00.000Z',
    hasPendingLocalOps: true,
  });
  assert.equal(remoteWins.winner, 'remote');
  assert.equal(remoteWins.conflictDetected, true);
  assert.equal(remoteWins.state.agencies[0].name, 'وكالة السحابة');

  // 3. Local newer -> local wins
  const newerLocal = getCleanTenantInitialState(uid);
  newerLocal.agencies = [{ id: 2, name: 'تعديل أوفلاين أحدث', icon: '⚡', isLocked: false }];
  newerLocal.updatedAt = '2026-11-25T09:00:00.000Z';

  const localWins = reconcileWorkspaceLww({
    localState: newerLocal,
    localUpdatedAt: newerLocal.updatedAt,
    remoteState: populatedRemote,
    remoteUpdatedAt: '2026-11-25T08:10:00.000Z',
    hasPendingLocalOps: true,
  });
  assert.equal(localWins.winner, 'local');
  assert.equal(localWins.conflictDetected, true);
  assert.equal(localWins.state.agencies[0].name, 'تعديل أوفلاين أحدث');
});
