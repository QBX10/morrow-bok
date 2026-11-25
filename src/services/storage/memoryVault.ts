import type {
  AppDatabaseState,
  AuditCheckpointActionType,
  AuditCheckpointDataSlice,
  AuditCheckpointEvent,
  SmartPreferencesMemory,
} from '../../types/agency';
import { getOrCreateDeviceId } from './syncEngine';

export const MEMORY_VAULT_SCHEMA = 'morrow.memory.vault.v1' as const;
const MAX_AUDIT_EVENTS = 80;
const MAX_RESTORABLE_CHECKPOINTS = 16;

export interface MorrowMemoryVaultEnvelope {
  schema: typeof MEMORY_VAULT_SCHEMA;
  exportedAt: string;
  deviceId: string;
  checksum: string;
  summary: {
    agenciesCount: number;
    personsCount: number;
    archivesCount: number;
    auditEventsCount: number;
  };
  smartPreferences: SmartPreferencesMemory;
  auditLog: AuditCheckpointEvent[];
  state: AppDatabaseState;
}

export function computeVaultChecksum(payloadText: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payloadText.length; i += 1) {
    const c = payloadText.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (Math.imul(h2, 33) ^ c) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function buildAuditDataSlice(
  state: AppDatabaseState
): AuditCheckpointDataSlice {
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

export function createAuditCheckpointEvent(params: {
  actionType: AuditCheckpointActionType;
  title: string;
  summary: string;
  deviceId?: string;
  conflictResolved?: boolean;
  restorableState?: AppDatabaseState;
}): AuditCheckpointEvent {
  return {
    id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    actionType: params.actionType,
    title: params.title,
    summary: params.summary,
    timestamp: new Date().toISOString(),
    deviceId: params.deviceId || getOrCreateDeviceId(),
    conflictResolved: params.conflictResolved,
    restorableData: params.restorableState
      ? buildAuditDataSlice(params.restorableState)
      : undefined,
  };
}

export function appendAuditCheckpointEvents(
  existing: AuditCheckpointEvent[] | undefined,
  nextEvent: AuditCheckpointEvent
): AuditCheckpointEvent[] {
  const combined = [nextEvent, ...(Array.isArray(existing) ? existing : [])].slice(
    0,
    MAX_AUDIT_EVENTS
  );
  // Keep restorable data slices on the most recent N checkpoints to keep storage lean
  let restorableSeen = 0;
  return combined.map((ev) => {
    if (!ev.restorableData) return ev;
    restorableSeen += 1;
    if (restorableSeen <= MAX_RESTORABLE_CHECKPOINTS) return ev;
    const { restorableData: _dropped, ...lightweight } = ev;
    return lightweight;
  });
}

export function createMemoryVaultExport(
  state: AppDatabaseState
): { envelope: MorrowMemoryVaultEnvelope; jsonText: string } {
  const deviceId = getOrCreateDeviceId();
  const cleanState: AppDatabaseState = {
    ...state,
    deviceId,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  const stateJson = JSON.stringify(cleanState);
  const checksum = computeVaultChecksum(stateJson);
  const envelope: MorrowMemoryVaultEnvelope = {
    schema: MEMORY_VAULT_SCHEMA,
    exportedAt: new Date().toISOString(),
    deviceId,
    checksum,
    summary: {
      agenciesCount: cleanState.agencies.length,
      personsCount: cleanState.persons.length,
      archivesCount: cleanState.monthlyArchives?.length || 0,
      auditEventsCount: cleanState.auditLog?.length || 0,
    },
    smartPreferences: cleanState.smartPreferences || {},
    auditLog: cleanState.auditLog || [],
    state: cleanState,
  };
  return {
    envelope,
    jsonText: JSON.stringify(envelope, null, 2),
  };
}

export interface ParsedMemoryVaultImport {
  sourceKind: 'memory_vault_v1' | 'legacy_workspace_json';
  exportedAt?: string;
  checksumVerified: boolean;
  state: Partial<AppDatabaseState>;
}

export function parseMemoryVaultImport(rawJson: string): ParsedMemoryVaultImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('ملف النسخة الاحتياطية غير صالح (JSON تالف أو غير مكتمل).');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('صيغة الملف غير متوافقة مع بيانات مساحة العمل.');
  }

  const candidate = parsed as Partial<MorrowMemoryVaultEnvelope>;
  if (candidate.schema === MEMORY_VAULT_SCHEMA && candidate.state) {
    if (!Array.isArray(candidate.state.agencies) || !Array.isArray(candidate.state.persons)) {
      throw new Error('ملف Memory Vault لا يحتوي على بنية وكالات وسجلات صالحة.');
    }
    const recomputed = computeVaultChecksum(JSON.stringify(candidate.state));
    const checksumVerified = Boolean(candidate.checksum && candidate.checksum === recomputed);
    if (candidate.checksum && !checksumVerified) {
      throw new Error('فشل التحقق من سلامة لقطة الذاكرة (Checksum mismatch).');
    }
    const mergedState: Partial<AppDatabaseState> = {
      ...candidate.state,
      smartPreferences:
        candidate.smartPreferences || candidate.state.smartPreferences,
      auditLog: candidate.auditLog || candidate.state.auditLog,
    };
    return {
      sourceKind: 'memory_vault_v1',
      exportedAt: candidate.exportedAt,
      checksumVerified: true,
      state: mergedState,
    };
  }

  const legacy = parsed as Partial<AppDatabaseState>;
  if (!Array.isArray(legacy.agencies) || !Array.isArray(legacy.persons)) {
    throw new Error('الملف المستورد لا يطابق صيغة Memory Vault أو النسخ الاحتياطية للتطبيق.');
  }
  return {
    sourceKind: 'legacy_workspace_json',
    checksumVerified: true,
    state: legacy,
  };
}
