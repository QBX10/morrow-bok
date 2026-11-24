import type {
  AppDatabaseState,
  SmartSyncCheckpoint,
  SmartSyncHistoryEntry,
} from '../types/agency.ts';
import { computeCrc32Hex } from './zipBuilder.ts';

export type WorkspaceDiffStatus = 'unchanged' | 'minor_edit' | 'major_addition';

export interface WorkspaceDiffReport {
  status: WorkspaceDiffStatus;
  currentHash: string;
  currentDataHash: string;
  totalRecords: number;
  totalAttachments: number;
  recordDelta: number;
  attachmentDelta: number;
  changedCategories: string[];
  summaryArabic: string;
}

export interface SmartBackupReminder {
  id: string;
  kind: 'weekly_overdue' | 'unsaved_changes' | 'structured_export_suggested';
  title: string;
  message: string;
  actionLabel: string;
}

export interface CompressedBackupEnvelope {
  encoding: 'gzip-base64' | 'utf8-json';
  payload: string;
  originalBytes: number;
  compressedBytes: number;
  integrityChecksum: string;
  verified: boolean;
  createdAt: string;
}

const STAGED_RECOVERY_KEY = 'morrow_staged_backup_recovery_v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function fnv1aHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + ((i + 1) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

export function countStateAttachments(state: AppDatabaseState): number {
  let count = 0;
  for (const ag of state.agencies || []) {
    if (ag.logoDataUrl) count += 1;
  }
  for (const session of state.ucrsSessions || []) {
    for (const src of session.sources || []) {
      if (src.previewDataUrl) count += 1;
    }
  }
  return count;
}

export function countCoreWorkspaceRecords(state: AppDatabaseState): number {
  return (
    (state.agencies?.length || 0) +
    (state.persons?.length || 0) +
    (state.expenses?.length || 0) +
    (state.readyLists?.length || 0) +
    (state.readyListItems?.length || 0) +
    (state.relations?.length || 0) +
    (state.workspaceNotes?.length || 0) +
    (state.monthlyArchives?.length || 0)
  );
}

/**
 * Computes deterministic hashes separating business data from sync checkpoint metadata
 * so saving a sync checkpoint itself never triggers false-positive diffs.
 */
export function computeWorkspaceFingerprints(state: AppDatabaseState): {
  fullHash: string;
  dataHash: string;
  totalRecords: number;
  totalAttachments: number;
} {
  const sanitizedSecurity = state.securityPrefs
    ? {
        privacyPin: state.securityPrefs.privacyPin,
        privacyLocked: state.securityPrefs.privacyLocked,
        offlineCacheEnabled: state.securityPrefs.offlineCacheEnabled,
        allowCloudBeneficiaryNames: state.securityPrefs.allowCloudBeneficiaryNames,
        secondaryCloud: state.securityPrefs.secondaryCloud,
        driveAccountMeta: state.securityPrefs.driveAccountMeta,
      }
    : {};

  const coreDataPayload = JSON.stringify({
    agencies: state.agencies,
    persons: state.persons,
    expenses: state.expenses,
    readyLists: state.readyLists,
    readyListItems: state.readyListItems,
    relations: state.relations,
    workspaceNotes: state.workspaceNotes || [],
    monthlyArchives: state.monthlyArchives || [],
    ucrsSessions: state.ucrsSessions || [],
    calculationSettings: state.calculationSettings,
    activePeriod: state.activePeriod,
  });

  const fullPayload = JSON.stringify({
    core: coreDataPayload,
    tableHeaders: state.tableHeaders,
    themePrefs: state.themePrefs,
    expertTableConfig: state.expertTableConfig,
    generalPrefs: state.generalPrefs,
    security: sanitizedSecurity,
  });

  return {
    fullHash: fnv1aHash(fullPayload),
    dataHash: fnv1aHash(coreDataPayload),
    totalRecords: countCoreWorkspaceRecords(state),
    totalAttachments: countStateAttachments(state),
  };
}

/**
 * Performs silent internal state diffing against the last verified checkpoint
 * to classify changes into unchanged, minor_edit, or major_addition.
 */
export function computeWorkspaceDiff(
  state: AppDatabaseState,
  checkpoint?: SmartSyncCheckpoint | null
): WorkspaceDiffReport {
  const fp = computeWorkspaceFingerprints(state);

  if (!checkpoint || !checkpoint.lastHash) {
    return {
      status: 'major_addition',
      currentHash: fp.fullHash,
      currentDataHash: fp.dataHash,
      totalRecords: fp.totalRecords,
      totalAttachments: fp.totalAttachments,
      recordDelta: fp.totalRecords,
      attachmentDelta: fp.totalAttachments,
      changedCategories: ['كامل مساحة العمل'],
      summaryArabic: 'نقطة حفظ أولى شاملة لكافة السجلات والإعدادات والملاحظات.',
    };
  }

  if (checkpoint.lastHash === fp.fullHash) {
    return {
      status: 'unchanged',
      currentHash: fp.fullHash,
      currentDataHash: fp.dataHash,
      totalRecords: fp.totalRecords,
      totalAttachments: fp.totalAttachments,
      recordDelta: 0,
      attachmentDelta: 0,
      changedCategories: [],
      summaryArabic: 'بياناتك محفوظة ومحدّثة بالكامل، ولا يوجد أي تغيير جديد يتطلب الحفظ.',
    };
  }

  const recordDelta = fp.totalRecords - (checkpoint.lastRecordCount || 0);
  const attachmentDelta = fp.totalAttachments - (checkpoint.lastAttachmentCount || 0);
  const dataChanged = checkpoint.lastDataHash !== fp.dataHash;

  const changedCategories: string[] = [];
  if (recordDelta > 0) changedCategories.push(`${recordDelta} سجل جديد`);
  if (attachmentDelta > 0) changedCategories.push(`${attachmentDelta} مرفق وصورة جديدة`);
  if (dataChanged && changedCategories.length === 0) {
    changedCategories.push('تحديثات في الجداول والبيانات القائمة');
  }
  if (!dataChanged) {
    changedCategories.push('تعديلات في المظهر والتفضيلات');
  }

  // Classify substantial new additions vs updates to existing tables
  const isMajor =
    recordDelta >= 3 ||
    attachmentDelta >= 1 ||
    !checkpoint.lastSavedAt;

  return {
    status: isMajor ? 'major_addition' : 'minor_edit',
    currentHash: fp.fullHash,
    currentDataHash: fp.dataHash,
    totalRecords: fp.totalRecords,
    totalAttachments: fp.totalAttachments,
    recordDelta,
    attachmentDelta,
    changedCategories,
    summaryArabic: isMajor
      ? `إضافات وتحديثات جديدة (${changedCategories.join('، ')})`
      : `تحديث ذكي للبيانات القائمة دون تكرار النسخ (${changedCategories.join('، ')})`,
  };
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      const digest = await crypto.subtle.digest('SHA-256', copy);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback to deterministic CRC-32 + FNV fingerprint below
    }
  }
  const crc = computeCrc32Hex(bytes);
  return `${crc}${fnv1aHash(String.fromCharCode(...bytes.slice(0, 512)))}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  if (typeof btoa !== 'undefined') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

function base64ToUint8(base64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Compresses workspace state cleanly and executes a double Integrity Check
 * (hash comparison + round-trip decompression check) before approval.
 */
export async function compressAndVerifyWorkspacePayload(
  state: AppDatabaseState
): Promise<CompressedBackupEnvelope> {
  const jsonString = JSON.stringify(state);
  const rawBytes = new TextEncoder().encode(jsonString);
  const expectedChecksum = await computeSha256Hex(rawBytes);
  const createdAt = new Date().toISOString();

  if (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      const copy = new Uint8Array(rawBytes.length);
      copy.set(rawBytes);
      void writer.write(copy);
      void writer.close();

      const compressedChunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) compressedChunks.push(value);
      }

      const compLen = compressedChunks.reduce((acc, c) => acc + c.length, 0);
      const compBytes = new Uint8Array(compLen);
      let off = 0;
      for (const c of compressedChunks) {
        compBytes.set(c, off);
        off += c.length;
      }

      const b64 = uint8ToBase64(compBytes);
      // Double integrity verification: round-trip decompress & checksum compare
      const verifyInput = base64ToUint8(b64);
      const ds = new DecompressionStream('gzip');
      const dWriter = ds.writable.getWriter();
      const vCopy = new Uint8Array(verifyInput.length);
      vCopy.set(verifyInput);
      void dWriter.write(vCopy);
      void dWriter.close();

      const decompChunks: Uint8Array[] = [];
      const dReader = ds.readable.getReader();
      while (true) {
        const { value, done } = await dReader.read();
        if (done) break;
        if (value) decompChunks.push(value);
      }

      const decompLen = decompChunks.reduce((acc, c) => acc + c.length, 0);
      const decompBytes = new Uint8Array(decompLen);
      let dOff = 0;
      for (const c of decompChunks) {
        decompBytes.set(c, dOff);
        dOff += c.length;
      }

      const roundTripChecksum = await computeSha256Hex(decompBytes);
      if (roundTripChecksum !== expectedChecksum || decompLen !== rawBytes.length) {
        throw new Error('فشل التحقق المزدوج من سلامة البيانات المضغوطة.');
      }

      return {
        encoding: 'gzip-base64',
        payload: b64,
        originalBytes: rawBytes.length,
        compressedBytes: compBytes.length,
        integrityChecksum: expectedChecksum,
        verified: true,
        createdAt,
      };
    } catch {
      // Fall back to verified raw UTF-8 JSON envelope if browser lacks CompressionStream
    }
  }

  const parsedCheck = JSON.parse(jsonString) as AppDatabaseState;
  const verified = Array.isArray(parsedCheck.agencies) && Array.isArray(parsedCheck.persons);

  return {
    encoding: 'utf8-json',
    payload: jsonString,
    originalBytes: rawBytes.length,
    compressedBytes: rawBytes.length,
    integrityChecksum: expectedChecksum,
    verified,
    createdAt,
  };
}

export function stageLocalRecoveryBackup(envelope: CompressedBackupEnvelope): void {
  if (typeof localStorage === 'undefined') return;
  try {
    // Store metadata + compact envelope only if under safe quota (~1.5MB)
    if (envelope.payload.length < 1_500_000) {
      localStorage.setItem(STAGED_RECOVERY_KEY, JSON.stringify(envelope));
    }
  } catch {
    // Ignore localStorage quota saturation gracefully
  }
}

export function isWeeklyAutoBackupDue(
  checkpoint?: SmartSyncCheckpoint | null,
  nowMs = Date.now()
): boolean {
  if (checkpoint && checkpoint.weeklyAutoEnabled === false) return false;
  if (!checkpoint?.lastSavedAt) return true;
  const lastMs = Date.parse(checkpoint.lastSavedAt);
  if (!Number.isFinite(lastMs)) return true;
  return nowMs - lastMs >= SEVEN_DAYS_MS;
}

export function buildNextCheckpoint(params: {
  prevCheckpoint?: SmartSyncCheckpoint | null;
  diff: WorkspaceDiffReport;
  mode: 'manual' | 'weekly_auto' | 'cloud';
  checksum: string;
  compressedBytes: number;
  recordId?: string;
  isStructuredExport?: boolean;
}): SmartSyncCheckpoint {
  const nowIso = new Date().toISOString();
  const prevHistory = params.prevCheckpoint?.history || [];

  const historyEntry: SmartSyncHistoryEntry = {
    id: `sync_${Date.now().toString(36)}`,
    timestamp: nowIso,
    mode: params.isStructuredExport ? 'structured_export' : params.mode,
    diffKind: params.diff.status,
    summary: params.diff.summaryArabic,
    checksum: params.checksum.slice(0, 12),
    compressedBytes: params.compressedBytes,
  };

  // On minor_edit, update existing latest cloud/weekly entry without stacking duplicate backup logs
  let nextHistory: SmartSyncHistoryEntry[];
  if (
    params.diff.status === 'minor_edit' &&
    prevHistory.length > 0 &&
    prevHistory[0].mode === params.mode &&
    !params.isStructuredExport
  ) {
    nextHistory = [
      {
        ...historyEntry,
        id: prevHistory[0].id,
      },
      ...prevHistory.slice(1),
    ].slice(0, 16);
  } else {
    nextHistory = [historyEntry, ...prevHistory].slice(0, 16);
  }

  return {
    lastHash: params.diff.currentHash,
    lastDataHash: params.diff.currentDataHash,
    lastRecordCount: params.diff.totalRecords,
    lastAttachmentCount: params.diff.totalAttachments,
    lastSavedAt: nowIso,
    lastStructuredExportAt: params.isStructuredExport
      ? nowIso
      : params.prevCheckpoint?.lastStructuredExportAt,
    lastSaveMode: params.mode,
    integrityChecksum: params.checksum,
    weeklyAutoEnabled: params.prevCheckpoint?.weeklyAutoEnabled ?? true,
    lastCheckedAt: nowIso,
    backupRecordId:
      params.recordId ||
      params.prevCheckpoint?.backupRecordId ||
      `bk_${Date.now().toString(36)}`,
    history: nextHistory,
  };
}

/**
 * Evaluates calm, non-intrusive reminders from genuine workspace activity.
 */
export function evaluateSmartBackupReminders(
  state: AppDatabaseState,
  checkpoint?: SmartSyncCheckpoint | null,
  nowMs = Date.now()
): SmartBackupReminder[] {
  const reminders: SmartBackupReminder[] = [];
  const diff = computeWorkspaceDiff(state, checkpoint);

  const lastSavedMs = checkpoint?.lastSavedAt ? Date.parse(checkpoint.lastSavedAt) : 0;
  const daysSinceSave =
    lastSavedMs > 0 ? Math.floor((nowMs - lastSavedMs) / (24 * 60 * 60 * 1000)) : 99;

  if (!checkpoint?.lastSavedAt || daysSinceSave >= 7) {
    reminders.push({
      id: 'rem_weekly_checkin',
      kind: 'weekly_overdue',
      title: 'تذكير المراجعة الأسبوعية للنسخة الاحتياطية',
      message: !checkpoint?.lastSavedAt
        ? 'لم يتم إنشاء نقطة حفظ موثقة بعد — يُفضّل أخذ أول نسخة احتياطية آمنة الآن.'
        : `مرّ ${daysSinceSave} يوماً منذ آخر حفظ ناجح لبياناتك.`,
      actionLabel: 'حفظ ذكي الآن',
    });
  }

  if (diff.status === 'major_addition' && checkpoint?.lastSavedAt) {
    reminders.push({
      id: 'rem_unsaved_important',
      kind: 'unsaved_changes',
      title: 'تعديلات جديدة بانتظار المزامنة',
      message: `رُصدت تغييرات جديدة (${diff.changedCategories.join('، ')}) لم تُؤرشف في نقطة حفظ سحابية بعد.`,
      actionLabel: 'مزامنة التغييرات',
    });
  }

  const lastExportMs = checkpoint?.lastStructuredExportAt
    ? Date.parse(checkpoint.lastStructuredExportAt)
    : 0;
  const daysSinceExport =
    lastExportMs > 0 ? Math.floor((nowMs - lastExportMs) / (24 * 60 * 60 * 1000)) : 99;

  const significantVolume =
    diff.totalRecords >= 20 || diff.recordDelta >= 5 || diff.totalAttachments >= 2;
  if (significantVolume && daysSinceExport >= 10) {
    reminders.push({
      id: 'rem_structured_export',
      kind: 'structured_export_suggested',
      title: 'اقتراح تصدير نسخة منظمة خارجية',
      message:
        'تراكمت لديك سجلات وجداول جديدة؛ يُنصح بتصدير مجلد منظّم شامل والاحتفاظ به في حسابك المستقل.',
      actionLabel: 'تصدير بياناتك',
    });
  }

  return reminders;
}
