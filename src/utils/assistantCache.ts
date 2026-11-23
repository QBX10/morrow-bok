import type {
  AssistantBrainMode,
  AssistantEngineSource,
  AssistantToolCall,
} from '../types/assistant.ts';
import { normalizeIraqiDialect } from './assistantPrivacy.ts';

export interface AssistantCacheEntry {
  key: string;
  text: string;
  engineUsed: AssistantEngineSource;
  engineLabel: string;
  modelId?: string;
  toolCalls?: AssistantToolCall[];
  createdAtMs: number;
}

export const ASSISTANT_CACHE_TTL_MS = 10 * 60 * 1000;
export const ASSISTANT_CACHE_MAX_ENTRIES = 60;

const NON_CACHEABLE_TOOLS = new Set([
  'add_person',
  'update_person',
  'archive_person',
  'manage_expense',
  'manage_ready_list',
  'backup_restore',
  'run_diagnostics',
]);

export function buildAssistantCacheKey(params: {
  prompt: string;
  brainMode: AssistantBrainMode;
  modelId: string;
  activeView: string;
  selectedAgencyId: number | null;
  chainSignature?: string;
}): string {
  const normalizedPrompt = normalizeIraqiDialect(params.prompt).slice(0, 300);
  return [
    params.brainMode,
    params.modelId,
    params.chainSignature || 'default',
    params.activeView,
    String(params.selectedAgencyId ?? 'all'),
    normalizedPrompt,
  ].join('::');
}

export function getCachedAssistantResponse(
  entries: AssistantCacheEntry[],
  key: string,
  nowMs: number = Date.now(),
  ttlMs: number = ASSISTANT_CACHE_TTL_MS
): AssistantCacheEntry | null {
  const hit = entries.find((e) => e.key === key);
  if (!hit) return null;
  if (nowMs - hit.createdAtMs > ttlMs) return null;
  return hit;
}

export function setCachedAssistantResponse(
  entries: AssistantCacheEntry[],
  entry: Omit<AssistantCacheEntry, 'createdAtMs'>,
  nowMs: number = Date.now(),
  maxEntries: number = ASSISTANT_CACHE_MAX_ENTRIES
): AssistantCacheEntry[] {
  if (entry.toolCalls?.some((tc) => NON_CACHEABLE_TOOLS.has(tc.name))) {
    return entries;
  }
  const cleanText = String(entry.text || '').trim();
  if (!cleanText) return entries;

  const filtered = entries.filter(
    (e) => e.key !== entry.key && nowMs - e.createdAtMs <= ASSISTANT_CACHE_TTL_MS
  );
  return [{ ...entry, createdAtMs: nowMs }, ...filtered].slice(0, maxEntries);
}
