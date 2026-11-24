import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_DATABASE_STATE } from '../data/seedData.ts';
import type { AppDatabaseState } from '../types/agency.ts';
import {
  buildNextCheckpoint,
  compressAndVerifyWorkspacePayload,
  computeWorkspaceDiff,
  evaluateSmartBackupReminders,
  isWeeklyAutoBackupDue,
} from './smartSyncEngine.ts';
import { generateStructuredWorkspaceZip } from './structuredExport.ts';
import { buildZipArchive, computeCrc32 } from './zipBuilder.ts';

function cloneSeedState(): AppDatabaseState {
  return structuredClone(INITIAL_DATABASE_STATE);
}

test('computeWorkspaceDiff distinguishes first save, unchanged, minor edit, and major addition', async () => {
  const baseState = cloneSeedState();
  const initialDiff = computeWorkspaceDiff(baseState, null);
  assert.equal(initialDiff.status, 'major_addition');

  const envelope = await compressAndVerifyWorkspacePayload(baseState);
  assert.equal(envelope.verified, true);
  assert.ok(envelope.integrityChecksum.length >= 16);

  const cp = buildNextCheckpoint({
    prevCheckpoint: null,
    diff: initialDiff,
    mode: 'manual',
    checksum: envelope.integrityChecksum,
    compressedBytes: envelope.compressedBytes,
  });

  // Even when checkpoint metadata updates, state diff stays unchanged
  const withCheckpointState: AppDatabaseState = {
    ...baseState,
    securityPrefs: {
      ...baseState.securityPrefs!,
      smartSync: cp,
    },
  };
  const unchangedDiff = computeWorkspaceDiff(withCheckpointState, cp);
  assert.equal(unchangedDiff.status, 'unchanged');

  // Minor edit to existing beneficiary note -> minor_edit (updates without duplicating)
  const minorEditedState = cloneSeedState();
  minorEditedState.persons[0] = {
    ...minorEditedState.persons[0],
    notes: 'تحديث ملاحظة التوصيل',
  };
  const minorDiff = computeWorkspaceDiff(minorEditedState, cp);
  assert.equal(minorDiff.status, 'minor_edit');

  const minorCp = buildNextCheckpoint({
    prevCheckpoint: cp,
    diff: minorDiff,
    mode: 'manual',
    checksum: 'abc12345',
    compressedBytes: 2048,
  });
  assert.equal(minorCp.history?.length, 1);

  // Substantial new records (3+ new persons) -> major_addition
  const majorState = cloneSeedState();
  for (let i = 1; i <= 3; i++) {
    majorState.persons.push({
      ...majorState.persons[0],
      id: 900 + i,
      name: `مستفيد جديد ${i}`,
    });
  }
  const majorDiff = computeWorkspaceDiff(majorState, minorCp);
  assert.equal(majorDiff.status, 'major_addition');
});

test('evaluateSmartBackupReminders and weekly scheduler detect overdue, unsaved changes, and export suggestions', () => {
  const state = cloneSeedState();
  const now = Date.parse('2026-11-24T12:00:00.000Z');
  const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isWeeklyAutoBackupDue({
    lastHash: 'x',
    lastDataHash: 'y',
    lastRecordCount: 10,
    lastAttachmentCount: 0,
    lastSavedAt: eightDaysAgo,
    lastSaveMode: 'weekly_auto',
    integrityChecksum: 'c',
    weeklyAutoEnabled: true,
  }, now), true);

  const overdueReminders = evaluateSmartBackupReminders(state, {
    lastHash: 'old_hash',
    lastDataHash: 'old_data',
    lastRecordCount: 10,
    lastAttachmentCount: 0,
    lastSavedAt: eightDaysAgo,
    lastSaveMode: 'manual',
    integrityChecksum: 'c',
    weeklyAutoEnabled: true,
  }, now);

  assert.ok(overdueReminders.some((r) => r.kind === 'weekly_overdue'));
  assert.ok(overdueReminders.some((r) => r.kind === 'unsaved_changes'));
  assert.ok(overdueReminders.some((r) => r.kind === 'structured_export_suggested'));
});

test('buildZipArchive creates valid PKZIP binary with UTF-8 Arabic filenames and CRC-32', async () => {
  const helloBytes = new TextEncoder().encode('بيانات تجريبية عربية');
  const crc = computeCrc32(helloBytes);
  assert.ok(crc > 0);

  const zip = await buildZipArchive([
    { path: 'Morrow_بيانات/الأسماء/test.txt', data: 'مرحباً بكم في مورّو' },
    { path: 'Morrow_بيانات/الملاحظات/note.json', data: '{"ok":true}' },
  ]);

  // Verify PK local header signature (0x50 0x4b 0x03 0x04)
  assert.equal(zip.bytes[0], 0x50);
  assert.equal(zip.bytes[1], 0x4b);
  assert.equal(zip.bytes[2], 0x03);
  assert.equal(zip.bytes[3], 0x04);
  assert.ok(zip.compressedBytes > 60);
  assert.equal(zip.crc32Hex.length, 8);
});

test('generateStructuredWorkspaceZip packages all 5 organized folders including XLSX & notes', async () => {
  const state = cloneSeedState();
  const exportSummary = await generateStructuredWorkspaceZip({
    state,
    authUser: null,
    appName: 'Morrow',
  });

  assert.ok(exportSummary.zipFilename.endsWith('.zip'));
  assert.equal(exportSummary.foldersSummary.length, 5);
  assert.ok(exportSummary.fileCount >= 8);
  assert.ok(exportSummary.compressedBytes > 1000);
});
