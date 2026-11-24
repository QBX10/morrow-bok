import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compressJsonPayload,
  decompressJsonPayload,
  extractCompressionStats,
  formatBytesCompact,
  formatCompressionBadgeText,
} from './compressionEngine.ts';

function buildSampleArabicWorkspaceDataset() {
  const agencies = [
    { id: 1, name: 'وكالة النور المركزية للطحين', icon: '🌾', isLocked: false },
    { id: 2, name: 'وكالة الفرات للكمية الغذائية', icon: '🏪', isLocked: false },
  ];

  const persons = Array.from({ length: 64 }, (_, i) => ({
    id: i + 1,
    agencyId: (i % 2) + 1,
    name: `المستفيد رقم ${i + 1} عبد الكريم جاسم العراقي`,
    nationalId: `1985${String(100000 + i)}`,
    individuals: (i % 6) + 2,
    blockType: i % 10 === 0 ? 'partial' : 'none',
    blockedIndividuals: i % 10 === 0 ? 1 : 0,
    blockReason: i % 10 === 0 ? 'مسافر خارج المحافظة' : '',
    status: i % 4 === 0 ? 'تم التسليم' : 'قيد الانتظار',
    notes: 'عنوان السكن الحي العسكري قرب جامع الرحمن — وجبة شهرية قياسية',
    updatedAt: '2026-11-24',
  }));

  const expenses = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    agencyId: (i % 2) + 1,
    description: `أجور تحميل ونقل الوجبة رقم ${i + 1}`,
    amountIqd: 45000 + i * 2500,
    category: 'transport',
    occurredAt: '2026-11-20',
    quotaLabel: 'الوجبة الأولى',
  }));

  return {
    stateVersion: 4,
    darkTheme: true,
    agencies,
    persons,
    expenses,
    note: 'حزمة اختبار الضغط المسبق باللغة العربية والبيانات المهيكلة',
  };
}

test('compressJsonPayload compresses Arabic workspace dataset via gzip with >= 65% savings and lossless round-trip', async () => {
  const sample = buildSampleArabicWorkspaceDataset();
  const envelope = await compressJsonPayload(sample);

  assert.equal(envelope.v, 2);
  assert.equal(envelope.alg, 'gzip');
  assert.ok(envelope.rawBytes > 2000);
  assert.ok(envelope.compressedBytes < envelope.rawBytes);
  assert.ok(
    envelope.savingsPct >= 65,
    `Expected >= 65% savings on structured Arabic payload, got ${envelope.savingsPct}%`
  );

  const stats = extractCompressionStats(envelope);
  assert.equal(stats.savingsPct, envelope.savingsPct);
  assert.match(formatCompressionBadgeText(stats), /^تم الضغط والحفظ • توفير \d+%$/);

  // Round-trip from binary Uint8Array
  const restoredFromBytes = await decompressJsonPayload<typeof sample>(envelope);
  assert.deepEqual(restoredFromBytes, sample);

  // Round-trip from Base64 text fallback (simulating localStorage / JSON transport)
  const textOnlyEnvelope = {
    ...envelope,
    bytes: undefined,
  };
  const restoredFromBase64 =
    await decompressJsonPayload<typeof sample>(textOnlyEnvelope);
  assert.deepEqual(restoredFromBase64, sample);
});

test('formatBytesCompact formats byte, kilobyte, and megabyte values cleanly', () => {
  assert.equal(formatBytesCompact(0), '0 KB');
  assert.equal(formatBytesCompact(512), '512 B');
  assert.equal(formatBytesCompact(2048), '2.0 KB');
  assert.equal(formatBytesCompact(2 * 1024 * 1024), '2.00 MB');
  assert.equal(formatCompressionBadgeText(null), 'تم الضغط والحفظ • جاهز');
});

test('compressJsonPayload handles large payloads (>150KB) without stream deadlock', async () => {
  const bigDataset = {
    persons: Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `المستفيد ${i + 1} بن عبد الرحمن`,
      notes: 'سجل كبير لاختبار عدم توقف دفق الضغط في المتصفح والنواة',
    })),
  };
  const envelope = await compressJsonPayload(bigDataset);
  assert.equal(envelope.alg, 'gzip');
  assert.ok(envelope.rawBytes > 100_000);
  assert.ok(envelope.savingsPct >= 80);
  const restored = await decompressJsonPayload<typeof bigDataset>(envelope);
  assert.equal(restored.persons.length, 1000);
});
