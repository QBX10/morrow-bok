import type {
  AppDatabaseState,
  ExpertColumnPreset,
  ExpertTableConfig,
  RecycleBinEntry,
} from '../types/agency.ts';

const MAX_RECYCLE_BIN_ENTRIES = 60;

export function pushRecycleBinEntry(
  bin: RecycleBinEntry[] | undefined,
  entry: Omit<RecycleBinEntry, 'id' | 'deletedAt'>
): RecycleBinEntry[] {
  const list = Array.isArray(bin) ? bin : [];
  const next: RecycleBinEntry = {
    ...entry,
    id: `bin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    deletedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  return [next, ...list].slice(0, MAX_RECYCLE_BIN_ENTRIES);
}

export function restoreRecycleBinEntryFromState(
  state: AppDatabaseState,
  entryId: string
): AppDatabaseState {
  const bin = Array.isArray(state.recycleBin) ? state.recycleBin : [];
  const entry = bin.find((e) => e.id === entryId);
  if (!entry) return state;

  const nextBin = bin.filter((e) => e.id !== entryId);
  const payload = entry.payload;

  if (payload.kind === 'person') {
    const exists = state.persons.some((p) => p.id === payload.person.id);
    return {
      ...state,
      persons: exists ? state.persons : [...state.persons, payload.person],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'expense') {
    const exists = state.expenses.some((ex) => ex.id === payload.expense.id);
    return {
      ...state,
      expenses: exists ? state.expenses : [payload.expense, ...state.expenses],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'relation') {
    const exists = state.relations.some((r) => r.id === payload.relation.id);
    return {
      ...state,
      relations: exists ? state.relations : [payload.relation, ...state.relations],
      recycleBin: nextBin,
    };
  }

  if (payload.kind === 'ready_list') {
    const listExists = state.readyLists.some((l) => l.id === payload.list.id);
    const existingItemIds = new Set(state.readyListItems.map((it) => it.id));
    const missingItems = payload.items.filter((it) => !existingItemIds.has(it.id));
    return {
      ...state,
      readyLists: listExists ? state.readyLists : [...state.readyLists, payload.list],
      readyListItems: [...state.readyListItems, ...missingItems],
      recycleBin: nextBin,
    };
  }

  return { ...state, recycleBin: nextBin };
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
