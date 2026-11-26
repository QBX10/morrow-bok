import type {
  AppDatabaseState,
  ExpertColumnPreset,
  ExpertTableConfig,
  RecycleBinEntry,
} from '../types/agency.ts';

const MAX_RECYCLE_BIN_ENTRIES = 120;
export const RECYCLE_BIN_RETENTION_DAYS = 30;
const RETENTION_MS = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function parseRecycleDateMs(value?: string): number {
  if (!value) return 0;
  const isoCandidate = value.includes('T') ? value : value.replace(' ', 'T');
  const ms = Date.parse(isoCandidate);
  return Number.isFinite(ms) ? ms : 0;
}

export function computeRecycleExpiryIso(deletedAtIso?: string): string {
  const baseMs = parseRecycleDateMs(deletedAtIso) || Date.now();
  return new Date(baseMs + RETENTION_MS).toISOString();
}

export function getRemainingRecycleDays(entry: RecycleBinEntry, nowMs = Date.now()): number {
  const expiresMs = entry.expiresAt
    ? parseRecycleDateMs(entry.expiresAt)
    : (parseRecycleDateMs(entry.deletedAt) || nowMs) + RETENTION_MS;
  const diff = expiresMs - nowMs;
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function pruneExpiredRecycleBinEntries(
  bin: RecycleBinEntry[] | undefined,
  nowMs = Date.now()
): RecycleBinEntry[] {
  const list = Array.isArray(bin) ? bin : [];
  return list.filter((entry) => {
    const expiresMs = entry.expiresAt
      ? parseRecycleDateMs(entry.expiresAt)
      : (parseRecycleDateMs(entry.deletedAt) || nowMs) + RETENTION_MS;
    return expiresMs > nowMs;
  });
}

export function pushRecycleBinEntry(
  bin: RecycleBinEntry[] | undefined,
  entry: Omit<RecycleBinEntry, 'id' | 'deletedAt' | 'expiresAt'>
): RecycleBinEntry[] {
  const active = pruneExpiredRecycleBinEntries(bin);
  const nowIso = new Date().toISOString();
  const next: RecycleBinEntry = {
    ...entry,
    id: `bin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    deletedAt: nowIso.slice(0, 16).replace('T', ' '),
    expiresAt: computeRecycleExpiryIso(nowIso),
  };
  return [next, ...active].slice(0, MAX_RECYCLE_BIN_ENTRIES);
}

export function restoreRecycleBinEntryFromState(
  state: AppDatabaseState,
  entryId: string
): AppDatabaseState {
  const bin = Array.isArray(state.recycleBin) ? state.recycleBin : [];
  const entry = bin.find((e) => e.id === entryId);
  if (!entry) return state;

  let nextBin = bin.filter((e) => e.id !== entryId);
  let nextAgencies = state.agencies;
  const ensureAgencyAvailable = (agencyId: number) => {
    if (nextAgencies.some((a) => a.id === agencyId)) return;
    const binnedAgencyEntry = nextBin.find(
      (e) => e.payload.kind === 'agency' && e.payload.agency.id === agencyId
    );
    if (binnedAgencyEntry && binnedAgencyEntry.payload.kind === 'agency') {
      nextAgencies = [...nextAgencies, binnedAgencyEntry.payload.agency];
      nextBin = nextBin.filter((e) => e.id !== binnedAgencyEntry.id);
    }
  };

  const payload = entry.payload;

  if (payload.kind === 'agency') {
    const exists = nextAgencies.some((a) => a.id === payload.agency.id);
    return {
      ...state,
      agencies: exists ? nextAgencies : [...nextAgencies, payload.agency],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'person') {
    ensureAgencyAvailable(payload.person.agencyId);
    const exists = state.persons.some((p) => p.id === payload.person.id);
    return {
      ...state,
      agencies: nextAgencies,
      persons: exists ? state.persons : [...state.persons, payload.person],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'expense') {
    ensureAgencyAvailable(payload.expense.agencyId);
    const exists = state.expenses.some((ex) => ex.id === payload.expense.id);
    return {
      ...state,
      agencies: nextAgencies,
      expenses: exists ? state.expenses : [payload.expense, ...state.expenses],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'relation') {
    ensureAgencyAvailable(payload.relation.agencyId);
    const exists = state.relations.some((r) => r.id === payload.relation.id);
    return {
      ...state,
      agencies: nextAgencies,
      relations: exists ? state.relations : [payload.relation, ...state.relations],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'ready_list') {
    ensureAgencyAvailable(payload.list.agencyId);
    const listExists = state.readyLists.some((l) => l.id === payload.list.id);
    const existingItemIds = new Set(state.readyListItems.map((it) => it.id));
    const missingItems = payload.items.filter((it) => !existingItemIds.has(it.id));
    return {
      ...state,
      agencies: nextAgencies,
      readyLists: listExists ? state.readyLists : [...state.readyLists, payload.list],
      readyListItems: [...state.readyListItems, ...missingItems],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'note') {
    const notes = Array.isArray(state.workspaceNotes) ? state.workspaceNotes : [];
    const exists = notes.some((n) => n.id === payload.note.id);
    return {
      ...state,
      workspaceNotes: exists ? notes : [payload.note, ...notes],
      recycleBin: nextBin,
    };
  }

  return { ...state, recycleBin: nextBin };
}

export function restoreAllRecycleBinEntriesFromState(
  state: AppDatabaseState
): AppDatabaseState {
  const activeBin = pruneExpiredRecycleBinEntries(state.recycleBin);
  if (activeBin.length === 0) {
    return { ...state, recycleBin: [] };
  }
  // Restore agencies first so child entities re-attach cleanly
  const ordered = [
    ...activeBin.filter((e) => e.payload.kind === 'agency'),
    ...activeBin.filter((e) => e.payload.kind !== 'agency'),
  ];
  let current: AppDatabaseState = { ...state, recycleBin: activeBin };
  for (const item of ordered) {
    if ((current.recycleBin || []).some((e) => e.id === item.id)) {
      current = restoreRecycleBinEntryFromState(current, item.id);
    }
  }
  return current;
}

export function moveExpertColumnInOrder(
  config: ExpertTableConfig,
  columnId: string,
  direction: 'left' | 'right'
): ExpertTableConfig {
  const order = [...config.columnOrder];
  const idx = order.indexOf(columnId);
  if (idx === -1) return config;
  // In RTL table: 'right' moves earlier in columnOrder (index - 1), 'left' moves later (index + 1)
  const swapIdx = direction === 'right' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= order.length) return config;
  const tmp = order[idx];
  order[idx] = order[swapIdx];
  order[swapIdx] = tmp;
  return { ...config, columnOrder: order, activePresetId: null };
}

export function setExpertColumnRank(
  config: ExpertTableConfig,
  columnId: string,
  targetRank1Based: number
): ExpertTableConfig {
  const order = [...config.columnOrder];
  const fromIdx = order.indexOf(columnId);
  if (fromIdx === -1) return config;
  const clampedTargetIdx = Math.max(
    0,
    Math.min(order.length - 1, Math.round(targetRank1Based) - 1)
  );
  if (clampedTargetIdx === fromIdx) return config;
  const [item] = order.splice(fromIdx, 1);
  order.splice(clampedTargetIdx, 0, item);
  return { ...config, columnOrder: order, activePresetId: null };
}

export function moveExpertColumnToEdge(
  config: ExpertTableConfig,
  columnId: string,
  edge: 'start' | 'end'
): ExpertTableConfig {
  const order = [...config.columnOrder];
  const fromIdx = order.indexOf(columnId);
  if (fromIdx === -1) return config;
  const targetIdx = edge === 'start' ? 0 : order.length - 1;
  if (fromIdx === targetIdx) return config;
  const [item] = order.splice(fromIdx, 1);
  if (edge === 'start') {
    order.unshift(item);
  } else {
    order.push(item);
  }
  return { ...config, columnOrder: order, activePresetId: null };
}

export function reorderExpertColumnsByDrag(
  config: ExpertTableConfig,
  draggedColId: string,
  targetColId: string
): ExpertTableConfig {
  if (!draggedColId || !targetColId || draggedColId === targetColId) {
    return config;
  }
  const order = [...config.columnOrder];
  const fromIdx = order.indexOf(draggedColId);
  const toIdx = order.indexOf(targetColId);
  if (fromIdx === -1 || toIdx === -1) return config;
  const [item] = order.splice(fromIdx, 1);
  order.splice(toIdx, 0, item);
  return { ...config, columnOrder: order, activePresetId: null };
}

export function applyExpertColumnPreset(
  config: ExpertTableConfig,
  preset: ExpertColumnPreset
): ExpertTableConfig {
  const allKnownIds = Array.from(
    new Set([...preset.columnOrder, ...config.columnOrder])
  );
  const presetOrderSet = new Set(preset.columnOrder);
  const mergedOrder = [
    ...preset.columnOrder.filter((id) => allKnownIds.includes(id)),
    ...config.columnOrder.filter((id) => !presetOrderSet.has(id)),
  ];
  return {
    ...config,
    visibleColumns: preset.visibleColumns.filter((id) =>
      mergedOrder.includes(id)
    ),
    columnOrder: mergedOrder,
    pinnedColumnId:
      preset.pinnedColumnId !== undefined
        ? preset.pinnedColumnId
        : config.pinnedColumnId ?? 'name',
    activePresetId: preset.id,
  };
}

export function saveCustomExpertColumnPreset(
  config: ExpertTableConfig,
  name: string
): ExpertTableConfig {
  const cleanName = name.trim();
  if (!cleanName) return config;
  const existing = config.columnPresets || [];
  const preset: ExpertColumnPreset = {
    id: `custom_preset_${Date.now().toString(36)}`,
    name: cleanName.slice(0, 60),
    visibleColumns: [...config.visibleColumns],
    columnOrder: [...config.columnOrder],
    pinnedColumnId: config.pinnedColumnId ?? 'name',
    isBuiltIn: false,
  };
  return {
    ...config,
    columnPresets: [...existing, preset],
    activePresetId: preset.id,
  };
}

export function deleteCustomExpertColumnPreset(
  config: ExpertTableConfig,
  presetId: string
): ExpertTableConfig {
  const existing = config.columnPresets || [];
  const target = existing.find((p) => p.id === presetId);
  if (!target || target.isBuiltIn) return config;
  return {
    ...config,
    columnPresets: existing.filter((p) => p.id !== presetId),
    activePresetId:
      config.activePresetId === presetId ? null : config.activePresetId,
  };
}
