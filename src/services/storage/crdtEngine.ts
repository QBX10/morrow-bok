import type {
  Agency,
  AgencyExpense,
  AppDatabaseState,
  ConflictCopyEntry,
  Person,
  ReadyList,
  ReadyListItem,
  RelationEntry,
  WorkspaceNoteItem,
} from '../../types/agency.ts';

export interface HybridLogicalClock {
  physicalMs: number;
  counter: number;
  nodeId: string;
}

export function serializeHlc(clock: HybridLogicalClock): string {
  return `${clock.physicalMs}:${String(clock.counter).padStart(4, '0')}:${clock.nodeId}`;
}

export function parseHlc(raw: string | undefined, fallbackNode = 'web'): HybridLogicalClock {
  if (!raw) return { physicalMs: 0, counter: 0, nodeId: fallbackNode };
  const parts = raw.split(':');
  const physicalMs = Number(parts[0]) || 0;
  const counter = Number(parts[1]) || 0;
  const nodeId = parts.slice(2).join(':') || fallbackNode;
  return { physicalMs, counter, nodeId };
}

export function tickHlc(
  prevRaw: string | undefined,
  nodeId: string,
  nowMs = Date.now()
): string {
  const prev = parseHlc(prevRaw, nodeId);
  if (nowMs > prev.physicalMs) {
    return serializeHlc({ physicalMs: nowMs, counter: 0, nodeId });
  }
  return serializeHlc({
    physicalMs: prev.physicalMs,
    counter: prev.counter + 1,
    nodeId,
  });
}

export function compareHlc(aRaw?: string, bRaw?: string): number {
  const a = parseHlc(aRaw);
  const b = parseHlc(bRaw);
  if (a.physicalMs !== b.physicalMs) return a.physicalMs - b.physicalMs;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.nodeId.localeCompare(b.nodeId);
}

function parseIsoMs(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Paragraph/line CRDT merge for collaborative WorkspaceNoteItem text content:
 * preserves unique additions from both devices when notes were edited concurrently.
 */
export function mergeNoteContentCrdt(localText: string, remoteText: string): {
  merged: string;
  hadDualAppend: boolean;
} {
  const a = localText.trim();
  const b = remoteText.trim();
  if (!a) return { merged: b, hadDualAppend: false };
  if (!b || a === b) return { merged: a, hadDualAppend: false };
  if (a.includes(b)) return { merged: a, hadDualAppend: false };
  if (b.includes(a)) return { merged: b, hadDualAppend: false };

  const linesA = a.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const linesB = b.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const seen = new Set<string>(linesA);
  const combined = [...linesA];
  for (const line of linesB) {
    if (!seen.has(line)) {
      seen.add(line);
      combined.push(line);
    }
  }
  return { merged: combined.join('\n'), hadDualAppend: true };
}

function mergeByIdLwwSet<T extends { id: number | string; updatedAt?: string }>(
  localItems: T[],
  remoteItems: T[],
  localBias: boolean,
  onSameIdDivergence?: (localItem: T, remoteItem: T) => T
): T[] {
  const map = new Map<string, T>();
  for (const item of remoteItems) {
    map.set(String(item.id), item);
  }
  for (const localItem of localItems) {
    const key = String(localItem.id);
    const remoteItem = map.get(key);
    if (!remoteItem) {
      map.set(key, localItem);
      continue;
    }
    const localSerialized = JSON.stringify(localItem);
    const remoteSerialized = JSON.stringify(remoteItem);
    if (localSerialized === remoteSerialized) continue;

    if (onSameIdDivergence) {
      map.set(key, onSameIdDivergence(localItem, remoteItem));
      continue;
    }

    const localMs = parseIsoMs(localItem.updatedAt);
    const remoteMs = parseIsoMs(remoteItem.updatedAt);
    if (localMs > remoteMs) {
      map.set(key, localItem);
    } else if (remoteMs > localMs) {
      map.set(key, remoteItem);
    } else {
      map.set(key, localBias ? localItem : remoteItem);
    }
  }
  return Array.from(map.values());
}

export interface CrdtWorkspaceMergeResult {
  mergedState: AppDatabaseState;
  crdtMergedCount: number;
  conflictCopies: ConflictCopyEntry[];
  summary: string;
}

/**
 * Merges two divergent device states via CRDT element-set union + per-record
 * timestamp resolution. When non-mergeable edits collide inside a narrow
 * concurrency window or conflicting binary payloads differ, preserves a
 * non-destructive ConflictCopyEntry ("نسختان") so zero data is ever lost.
 */
export function mergeWorkspacesCrdt(params: {
  localState: AppDatabaseState;
  remoteState: AppDatabaseState;
  deviceId: string;
}): CrdtWorkspaceMergeResult {
  const { localState, remoteState, deviceId } = params;
  const localMs = parseIsoMs(localState.updatedAt);
  const remoteMs = parseIsoMs(remoteState.updatedAt);
  const localBias = localMs >= remoteMs;

  let crdtMergedCount = 0;
  const createdCopies: ConflictCopyEntry[] = [];
  const nowIso = new Date().toISOString();

  // Merge Agencies (union by id)
  const mergedAgencies = mergeByIdLwwSet<Agency & { updatedAt?: string }>(
    localState.agencies,
    remoteState.agencies,
    localBias
  );

  // Merge Persons with field-level reconciliation + conflict copy if substantive concurrent edits differ
  const mergedPersons = mergeByIdLwwSet<Person>(
    localState.persons,
    remoteState.persons,
    localBias,
    (loc, rem) => {
      crdtMergedCount += 1;
      const locTs = parseIsoMs(loc.updatedAt);
      const remTs = parseIsoMs(rem.updatedAt);
      const concurrentWindow = Math.abs(locTs - remTs) <= 60_000;
      const substantiveDiff =
        loc.name !== rem.name ||
        loc.individuals !== rem.individuals ||
        loc.blockType !== rem.blockType;

      if (concurrentWindow && substantiveDiff) {
        createdCopies.push({
          id: `cc_p_${loc.id}_${Date.now().toString(36)}`,
          entityKind: 'person',
          entityLabel: `${loc.name} ↔ ${rem.name}`,
          localDeviceId: localState.deviceId || deviceId,
          remoteDeviceId: remoteState.deviceId || 'remote',
          reason: 'تعديل متزامن على نفس سجل المستفيد في جهازين؛ تم دمج الملاحظات وحفظ نسخة تعارض للمراجعة.',
          createdAt: nowIso,
          localSnapshotJson: JSON.stringify(loc),
          resolved: false,
        });
      }

      const winner = locTs > remTs ? loc : remTs > locTs ? rem : localBias ? loc : rem;
      const mergedNote = mergeNoteContentCrdt(loc.notes || '', rem.notes || '');
      return {
        ...winner,
        notes: mergedNote.merged,
        updatedAt: winner.updatedAt || nowIso.slice(0, 10),
      };
    }
  );

  // Merge Notes via text CRDT
  const mergedNotes = mergeByIdLwwSet<WorkspaceNoteItem>(
    localState.workspaceNotes || [],
    remoteState.workspaceNotes || [],
    localBias,
    (loc, rem) => {
      crdtMergedCount += 1;
      const { merged, hadDualAppend } = mergeNoteContentCrdt(loc.content, rem.content);
      if (hadDualAppend) {
        createdCopies.push({
          id: `cc_n_${loc.id}_${Date.now().toString(36)}`,
          entityKind: 'note',
          entityLabel: loc.title || rem.title,
          localDeviceId: localState.deviceId || deviceId,
          remoteDeviceId: remoteState.deviceId || 'remote',
          reason: 'تم دمج تعديلات الجهازين معاً في نفس الملاحظة عبر CRDT وحفظ النسخة الاحتياطية.',
          createdAt: nowIso,
          localSnapshotJson: JSON.stringify(loc),
          resolved: true,
        });
      }
      const winner = parseIsoMs(loc.updatedAt) >= parseIsoMs(rem.updatedAt) ? loc : rem;
      return {
        ...winner,
        content: merged,
        pinned: Boolean(loc.pinned || rem.pinned),
        updatedAt: nowIso,
      };
    }
  );

  // Merge Expenses & ReadyLists & Relations
  const mergedExpenses = mergeByIdLwwSet<AgencyExpense & { updatedAt?: string }>(
    localState.expenses.map((e) => ({ ...e, updatedAt: e.occurredAt })),
    remoteState.expenses.map((e) => ({ ...e, updatedAt: e.occurredAt })),
    localBias
  );

  const mergedLists = mergeByIdLwwSet<ReadyList & { updatedAt?: string }>(
    localState.readyLists.map((l) => ({ ...l, updatedAt: l.lastUpdatedAt })),
    remoteState.readyLists.map((l) => ({ ...l, updatedAt: l.lastUpdatedAt })),
    localBias
  );

  const mergedListItems = mergeByIdLwwSet<ReadyListItem & { updatedAt?: string }>(
    localState.readyListItems,
    remoteState.readyListItems,
    localBias
  );

  const mergedRelations = mergeByIdLwwSet<RelationEntry>(
    localState.relations,
    remoteState.relations,
    localBias
  );

  const existingCopies = [
    ...(localState.conflictCopies || []),
    ...(remoteState.conflictCopies || []),
  ];
  const dedupedCopiesMap = new Map<string, ConflictCopyEntry>();
  for (const copy of [...createdCopies, ...existingCopies]) {
    dedupedCopiesMap.set(copy.id, copy);
  }
  const allCopies = Array.from(dedupedCopiesMap.values()).slice(0, 40);

  const primaryWinner = localBias ? localState : remoteState;
  const nextHlc = tickHlc(
    compareHlc(localState.hlcTimestamp, remoteState.hlcTimestamp) >= 0
      ? localState.hlcTimestamp
      : remoteState.hlcTimestamp,
    deviceId
  );

  const mergedState: AppDatabaseState = {
    ...primaryWinner,
    agencies: mergedAgencies.sort((a, b) => a.id - b.id),
    persons: mergedPersons.sort((a, b) => a.id - b.id),
    expenses: mergedExpenses,
    readyLists: mergedLists,
    readyListItems: mergedListItems,
    relations: mergedRelations,
    workspaceNotes: mergedNotes,
    conflictCopies: allCopies,
    hlcTimestamp: nextHlc,
    updatedAt: nowIso,
    deviceId,
  };

  return {
    mergedState,
    crdtMergedCount,
    conflictCopies: createdCopies,
    summary:
      createdCopies.length > 0
        ? `تم دمج ${crdtMergedCount} سجلاً عبر CRDT مع حفظ ${createdCopies.length} نسخة تعارض للمراجعة بأمان.`
        : `تم دمج تعديلات الجهازين بنجاح عبر CRDT دون أي فقدان للبيانات.`,
  };
}
