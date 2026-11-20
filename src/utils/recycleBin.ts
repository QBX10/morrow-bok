import type {
  AppDatabaseState,
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
  return { ...config, columnOrder: order };
}
