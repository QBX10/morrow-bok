import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldSkipCompression,
  smartCompressBinary,
} from '../compression/compressionEngine.ts';
import {
  computeRecycleExpiryIso,
  getRemainingRecycleDays,
  pruneExpiredRecycleBinEntries,
  pushRecycleBinEntry,
  RECYCLE_BIN_RETENTION_DAYS,
  restoreAllRecycleBinEntriesFromState,
  restoreRecycleBinEntryFromState,
} from '../../utils/recycleBin.ts';
import {
  buildSecurityAlertEmailContent,
  getEmailProviderStatus,
  parseClientDeviceAndBrowser,
} from '../notifications/emailNotificationService.ts';
import {
  mergeNoteContentCrdt,
  mergeWorkspacesCrdt,
  tickHlc,
} from './crdtEngine.ts';
import {
  buildContentAddressedChunks,
  uploadChunkedWithDedupAndResume,
  type ChunkTransportClient,
} from './chunkSyncEngine.ts';
import { buildPairingQrMatrix } from '../../utils/qrMatrix.ts';
import { INITIAL_DATABASE_STATE } from '../../data/seedData.ts';
import type { AppDatabaseState, RecycleBinEntry } from '../../types/agency.ts';

test('smart compression skips already-compressed formats and compresses structured JSON', async () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const jpgCheck = shouldSkipCompression({
    mimeType: 'image/jpeg',
    filename: 'receipt.jpg',
    bytes: fakeJpeg,
  });
  assert.equal(jpgCheck.skip, true);

  const mp4Result = await smartCompressBinary(new Uint8Array(2048), {
    mimeType: 'video/mp4',
    filename: 'clip.mp4',
  });
  assert.equal(mp4Result.alg, 'raw-skipped');
  assert.equal(mp4Result.skippedBecauseAlreadyCompressed, true);

  const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 10, 20, 30, 40]);
  const zipRes = await smartCompressBinary(zipMagic, {
    filename: 'archive.dat',
  });
  assert.equal(zipRes.alg, 'raw-skipped');

  const repetitiveJson = new TextEncoder().encode(
    JSON.stringify({ rows: Array.from({ length: 80 }, (_, i) => ({ id: i, agency: 'وكالة الموصل الأولى' })) })
  );
  const jsonRes = await smartCompressBinary(repetitiveJson, {
    mimeType: 'application/json',
    filename: 'workspace.json',
  });
  assert.equal(jsonRes.skippedBecauseAlreadyCompressed, false);
  assert.equal(jsonRes.alg, 'gzip');
  assert.ok(jsonRes.outputBytes < jsonRes.rawBytes);
});

test('30-day recycle bin retention calculates remaining days and prunes expired entries', () => {
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);
  const deletedToday = new Date(nowMs).toISOString();
  const expiryIso = computeRecycleExpiryIso(deletedToday);
  const activeEntry: RecycleBinEntry = {
    id: 'bin_active',
    kind: 'person',
    label: 'مستفيد نشط',
    deletedAt: deletedToday,
    expiresAt: expiryIso,
    payload: {
      kind: 'person',
      person: INITIAL_DATABASE_STATE.persons[0],
    },
  };
  assert.equal(getRemainingRecycleDays(activeEntry, nowMs), RECYCLE_BIN_RETENTION_DAYS);

  const expiredMs = nowMs - (RECYCLE_BIN_RETENTION_DAYS + 2) * 24 * 60 * 60 * 1000;
  const expiredEntry: RecycleBinEntry = {
    id: 'bin_expired',
    kind: 'person',
    label: 'مستفيد منتهي الصلاحية',
    deletedAt: new Date(expiredMs).toISOString(),
    expiresAt: computeRecycleExpiryIso(new Date(expiredMs).toISOString()),
    payload: {
      kind: 'person',
      person: INITIAL_DATABASE_STATE.persons[0],
    },
  };
  assert.equal(getRemainingRecycleDays(expiredEntry, nowMs), 0);

  const pruned = pruneExpiredRecycleBinEntries([activeEntry, expiredEntry], nowMs);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0].id, 'bin_active');
});

test('two-device CRDT merge combines non-conflicting records/notes and preserves dual-copy conflict on concurrent same-record divergence', () => {
  const h1 = tickHlc(undefined, 'dev_a', 1_760_000_000_000);
  const h2 = tickHlc(h1, 'dev_b', 1_760_000_005_000);
  assert.ok(h2 > h1);

  const noteMerge = mergeNoteContentCrdt('سطر من الجهاز الأول', 'سطر من الجهاز الثاني');
  assert.equal(noteMerge.hadDualAppend, true);
  assert.match(noteMerge.merged, /الجهاز الأول/);
  assert.match(noteMerge.merged, /الجهاز الثاني/);

  const basePerson = INITIAL_DATABASE_STATE.persons[0] || {
    id: 101,
    name: 'علي حسن',
    agencyId: 1,
    individuals: 2,
    blockType: 'none' as const,
    notes: '',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-26T10:00:00.000Z',
  };

  const nowIso = '2026-11-26T10:00:10.000Z';
  const localState: AppDatabaseState = {
    ...INITIAL_DATABASE_STATE,
    deviceId: 'device_alpha',
    updatedAt: nowIso,
    persons: [
      { ...basePerson, name: 'علي حسن (تعديل أ)', individuals: 3, updatedAt: nowIso },
      { ...basePerson, id: 901, name: 'إضافة جهاز أ', updatedAt: nowIso },
    ],
    workspaceNotes: [
      {
        id: 'note_shared',
        title: 'ملاحظة مشتركة',
        content: 'محتوى الجهاز أ',
        category: 'quick',
        pinned: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  };

  const remoteState: AppDatabaseState = {
    ...INITIAL_DATABASE_STATE,
    deviceId: 'device_beta',
    updatedAt: '2026-11-26T10:00:20.000Z',
    persons: [
      {
        ...basePerson,
        name: 'علي حسن (تعديل ب)',
        individuals: 5,
        updatedAt: '2026-11-26T10:00:20.000Z',
      },
      { ...basePerson, id: 902, name: 'إضافة جهاز ب', updatedAt: '2026-11-26T10:00:20.000Z' },
    ],
    workspaceNotes: [
      {
        id: 'note_shared',
        title: 'ملاحظة مشتركة',
        content: 'محتوى الجهاز ب',
        category: 'quick',
        pinned: false,
        createdAt: nowIso,
        updatedAt: '2026-11-26T10:00:20.000Z',
      },
    ],
  };

  const result = mergeWorkspacesCrdt({
    localState,
    remoteState,
    deviceId: 'device_alpha',
  });

  // Both non-conflicting records 901 & 902 survive
  assert.ok(result.mergedState.persons.some((p) => p.id === 901));
  assert.ok(result.mergedState.persons.some((p) => p.id === 902));
  // Collaborative CRDT note contains both edits
  const mergedSharedNote = (result.mergedState.workspaceNotes || []).find(
    (n) => n.id === 'note_shared'
  );
  assert.ok(mergedSharedNote?.content.includes('محتوى الجهاز أ'));
  assert.ok(mergedSharedNote?.content.includes('محتوى الجهاز ب'));
  // Substantive concurrent divergence on same person generated dual-copy entry
  assert.ok(result.conflictCopies.some((c) => c.entityKind === 'person'));
});

test('chunked SHA-256 sync deduplicates identical chunks and resumes cleanly after mid-upload network drop', async () => {
  // Build deterministic high-entropy payload > 40KB so gzip leaves 5+ distinct chunks
  const largePayload = new Uint8Array(48 * 1024);
  let seed = 0x12345678;
  for (let i = 0; i < largePayload.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    largePayload[i] = (seed >>> 24) & 0xff;
  }

  const build = await buildContentAddressedChunks(largePayload, {
    mimeType: 'application/octet-stream',
    chunkSizeBytes: 8192,
  });
  assert.ok(build.totalChunks >= 4);

  const serverChunkStore = new Map<string, string>();
  let failOnUploadCall = 2; // Simulate internet outage after 1st chunk!
  const uploadLog: string[] = [];

  const flakyTransport: ChunkTransportClient = {
    async checkMissingChunks(hashes) {
      return hashes.filter((h) => !serverChunkStore.has(h));
    },
    async uploadChunk(chunk) {
      uploadLog.push(chunk.hash);
      if (uploadLog.length === failOnUploadCall) {
        throw new Error('Simulated mid-upload network drop');
      }
      serverChunkStore.set(chunk.hash, chunk.base64Data);
    },
    async commitManifest(params) {
      return {
        ok: true,
        quota: {
          usedBytes: params.compressedBytes,
          quotaBytes: 50 * 1024 * 1024,
          chunkCount: serverChunkStore.size,
          uniqueChunkCount: serverChunkStore.size,
          dedupSavedBytes: 0,
          usagePercent: 1,
          versionsCount: 1,
        },
      };
    },
  };

  await assert.rejects(
    () => uploadChunkedWithDedupAndResume(build, flakyTransport),
    /Simulated mid-upload network drop/
  );
  // 1 chunk was already stored before failure
  assert.equal(serverChunkStore.size, 1);

  // Network comes back; disable simulated failure and resume
  failOnUploadCall = -1;
  uploadLog.length = 0;
  const resumed = await uploadChunkedWithDedupAndResume(build, flakyTransport);
  // Resumed run must skip already-uploaded chunk 0 and upload only remaining chunks
  assert.equal(resumed.uploadedChunksCount, build.totalChunks - 1);
  assert.equal(resumed.deduplicatedChunksCount, 1);

  // Re-running with zero changes deduplicates 100% (0 chunks uploaded!)
  uploadLog.length = 0;
  const secondRun = await uploadChunkedWithDedupAndResume(build, flakyTransport);
  assert.equal(secondRun.uploadedChunksCount, 0);
  assert.equal(secondRun.deduplicatedChunksCount, build.totalChunks);
});

test('buildPairingQrMatrix generates deterministic 25x25 QR grid with finder patterns', () => {
  const m1 = buildPairingQrMatrix('morrow-pair:test123');
  const m2 = buildPairingQrMatrix('morrow-pair:test123');
  assert.equal(m1.size, 25);
  assert.deepEqual(m1.modules, m2.modules);
  // Top-left 7x7 finder outer corners are dark modules
  assert.equal(m1.modules[0][0], true);
  assert.equal(m1.modules[0][6], true);
  assert.equal(m1.modules[6][0], true);
  assert.equal(m1.modules[3][3], true);
  assert.equal(m1.modules[1][1], false);
});

test('parseClientDeviceAndBrowser distinguishes browsers/OS and generates stable fingerprint hashes', () => {
  const chromeWin = parseClientDeviceAndBrowser(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  const firefoxLinux = parseClientDeviceAndBrowser(
    'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'
  );
  const edgeWin = parseClientDeviceAndBrowser(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
  );

  assert.equal(chromeWin.browserName, 'Chrome');
  assert.equal(chromeWin.browserLabel, 'Chrome 131');
  assert.equal(chromeWin.osName, 'Windows');

  assert.equal(firefoxLinux.browserName, 'Firefox');
  assert.equal(firefoxLinux.browserLabel, 'Firefox 132');
  assert.equal(firefoxLinux.osName, 'Linux');

  assert.equal(edgeWin.browserName, 'Microsoft Edge');
  assert.equal(edgeWin.browserLabel, 'Microsoft Edge 131');

  assert.notEqual(chromeWin.fingerprintHash, firefoxLinux.fingerprintHash);
  assert.notEqual(chromeWin.fingerprintHash, edgeWin.fingerprintHash);
  assert.equal(
    chromeWin.fingerprintHash,
    parseClientDeviceAndBrowser(chromeWin.userAgent).fingerprintHash
  );
});

test('buildSecurityAlertEmailContent escapes untrusted HTML and formats failed/succeeded attempts', () => {
  const deviceInfo = parseClientDeviceAndBrowser(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/132.0'
  );
  const failedEmail = buildSecurityAlertEmailContent({
    uid: 'u_test',
    recipientEmail: 'user@example.com',
    displayName: 'علي <script>alert(1)</script>',
    loginMethod: 'password',
    outcome: 'failed',
    deviceInfo,
    ipMasked: '192.168.1.*',
    timestampIso: '2026-11-26T10:00:00.000Z',
  });

  assert.match(failedEmail.subject, /غير مصرح بها|Firefox 132/);
  assert.ok(!failedEmail.html.includes('<script>alert(1)</script>'));
  assert.ok(failedEmail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(failedEmail.text, /محاولة مرفوضة/);

  const succeededEmail = buildSecurityAlertEmailContent({
    uid: 'u_test',
    recipientEmail: 'user@example.com',
    displayName: 'علي',
    loginMethod: 'passkey',
    outcome: 'succeeded',
    deviceInfo,
    ipMasked: '10.0.0.*',
    timestampIso: '2026-11-26T10:00:00.000Z',
  });
  assert.match(succeededEmail.subject, /تسجيل دخول جديد/);
  assert.match(succeededEmail.text, /مفتاح المرور/);

  const providerStatus = getEmailProviderStatus();
  assert.equal(typeof providerStatus.configured, 'boolean');
  assert.ok(['smtp', 'resend', 'none'].includes(providerStatus.provider));
});

test('30-day recycle bin restores notes, agencies, auto-restores missing parent agency, and supports bulk restore', () => {
  const agency = INITIAL_DATABASE_STATE.agencies[0] || {
    id: 5001,
    name: 'وكالة اختبارية',
    location: 'بغداد',
  };
  const person = {
    ...(INITIAL_DATABASE_STATE.persons[0] || {
      id: 9901,
      name: 'مستفيد محذوف',
      individuals: 3,
      blockType: 'none' as const,
      notes: '',
      createdAt: '2026-11-26',
    }),
    id: 9901,
    agencyId: agency.id,
  };
  const note = {
    id: 'note_recycled_1',
    title: 'ملاحظة مهمة',
    content: 'تفاصيل محفوظة',
    category: 'quick' as const,
    pinned: false,
    createdAt: '2026-11-26T09:00:00.000Z',
    updatedAt: '2026-11-26T09:00:00.000Z',
  };

  let bin = pushRecycleBinEntry([], {
    kind: 'agency',
    label: agency.name,
    payload: { kind: 'agency', agency },
  });
  bin = pushRecycleBinEntry(bin, {
    kind: 'person',
    label: person.name,
    payload: { kind: 'person', person },
  });
  bin = pushRecycleBinEntry(bin, {
    kind: 'note',
    label: note.title,
    payload: { kind: 'note', note },
  });

  assert.equal(bin.length, 3);
  assert.ok(bin.every((item) => getRemainingRecycleDays(item) >= 29));

  const emptyState: AppDatabaseState = {
    ...INITIAL_DATABASE_STATE,
    agencies: [],
    persons: [],
    workspaceNotes: [],
    recycleBin: bin,
  };

  // Restoring the child person should automatically pull its deleted parent agency back too
  const personEntry = bin.find((e) => e.kind === 'person')!;
  const afterPersonRestore = restoreRecycleBinEntryFromState(emptyState, personEntry.id);
  assert.equal(afterPersonRestore.persons.some((p) => p.id === person.id), true);
  assert.equal(afterPersonRestore.agencies.some((a) => a.id === agency.id), true);
  // Only the note remains in recycle bin
  assert.equal(afterPersonRestore.recycleBin?.length, 1);
  assert.equal(afterPersonRestore.recycleBin?.[0].kind, 'note');

  // Bulk restore recovers remaining items from fresh binned state
  const afterBulk = restoreAllRecycleBinEntriesFromState(emptyState);
  assert.equal(afterBulk.agencies.some((a) => a.id === agency.id), true);
  assert.equal(afterBulk.persons.some((p) => p.id === person.id), true);
  assert.equal((afterBulk.workspaceNotes || []).some((n) => n.id === note.id), true);
  assert.equal(afterBulk.recycleBin?.length, 0);
});
