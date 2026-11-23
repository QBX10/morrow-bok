import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agency } from '../types/agency.ts';
import {
  evaluateExtractedRow,
  recomputeRowValidation,
} from './quickExtractEngine.ts';
import {
  buildSemanticColumnMappings,
  computeRowZeroTrustSummary,
  getFullRowCropBox,
  inferMetadataFromText,
  performMetadataInference,
} from './zeroTrustExtract.ts';

const MOCK_AGENCIES: Agency[] = [
  {
    id: 1,
    name: 'وكالة منذر الحلو',
    icon: '🏪',
    isLocked: false,
  },
  {
    id: 2,
    name: 'وكالة النور المركزية',
    icon: '🌾',
    isLocked: false,
  },
];

test('The 1% Doubt Rule highlights any cell < 99% confidence as yellow or red', () => {
  const rowYellow = evaluateExtractedRow(
    {
      rowIndex: 54,
      pageNumber: 1,
      name: 'كاظم جبار علي',
      individuals: 6,
      decreaseCount: 1,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      rowDate: '2026-10-01',
      nameConfidence: 0.96, // 96% -> strictly < 99% => yellow
      numbersConfidence: 0.99,
      dateConfidence: 0.99,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '54 | كاظم جبار علي | 6 | 1',
      rowBox: { ymin: 410, xmin: 25, ymax: 448, xmax: 970 },
    },
    0
  );

  assert.equal(rowYellow.zeroTrustNameStatus, 'yellow');
  assert.equal(rowYellow.zeroTrustNumbersStatus, 'verified');
  assert.equal(rowYellow.zeroTrustConfirmed, false);

  const summary = computeRowZeroTrustSummary(rowYellow);
  assert.equal(summary.anyDoubt, true);
  assert.match(summary.name.tooltipQuestion, /هل هذا صحيح؟/);
  assert.match(summary.name.tooltipQuestion, /96%/);

  // Manual edit or explicit confirmation resolves doubt to verified
  const confirmedRow = recomputeRowValidation(
    { ...rowYellow, nameConfidence: 1, resolvedName: 'كاظم جبار علي' },
    { zeroTrustConfirmed: true }
  );
  assert.equal(confirmedRow.zeroTrustNameStatus, 'verified');
  assert.equal(confirmedRow.zeroTrustConfirmed, true);
});

test('The 1% Doubt Rule marks < 85% or corrupted glyph cells as red', () => {
  const rowRed = evaluateExtractedRow(
    {
      rowIndex: 12,
      pageNumber: 1,
      name: 'حس?ن كريم',
      individuals: 4,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.81,
      numbersConfidence: 0.8,
      modelDoubtFlag: true,
      modelDoubtReason: 'الخط مطموس جزئياً',
      rawSnippet: '12 | حس?ن كريم | 4',
    },
    0
  );

  assert.equal(rowRed.zeroTrustNameStatus, 'red');
  assert.equal(rowRed.zeroTrustNumbersStatus, 'red');
  assert.equal(rowRed.zeroTrustConfirmed, false);
});

test('Contextual full-row crop spans edge-to-edge horizontally with vertical padding', () => {
  const fullBoxFromWordOnly = getFullRowCropBox({
    suspectBox: { ymin: 500, xmin: 600, ymax: 530, xmax: 820 },
  });
  assert.ok(fullBoxFromWordOnly);
  assert.equal(fullBoxFromWordOnly.xmin, 0);
  assert.equal(fullBoxFromWordOnly.xmax, 1000);
  assert.ok(fullBoxFromWordOnly.ymin < 500);
  assert.ok(fullBoxFromWordOnly.ymax > 530);

  const fullBoxFromRow = getFullRowCropBox({
    rowBox: { ymin: 300, xmin: 35, ymax: 340, xmax: 960 },
  });
  assert.ok(fullBoxFromRow);
  assert.ok(fullBoxFromRow.xmin <= 15);
  assert.ok(fullBoxFromRow.xmax >= 985);
});

test('Metadata inference extracts agency name, month/date, semantic columns, and proactive greeting', () => {
  const header = `
    كشف توزيع الحصة التموينية
    وكالة منذر الحلو - مركز رقم 412
    لشهر تشرين الأول 2026
    الاسم | الأفراد الكلية | المستحقة | المحجوبين
  `;
  const meta = inferMetadataFromText(header, MOCK_AGENCIES, 'table.xlsx', [
    'الاسم',
    'الأفراد الكلية',
    'المستحقة',
    'المحجوبين',
  ]);
  assert.ok(meta);
  assert.equal(meta.agencyName, 'وكالة منذر الحلو');
  assert.equal(meta.matchedAgencyId, 1);
  assert.equal(meta.tableDateLabel, 'تشرين الأول 2026');
  assert.equal(meta.centerOrAgencyNumber, '412');
  assert.equal(meta.confirmedByUser, false);
  assert.ok(meta.proactivePrompt && meta.proactivePrompt.includes('هل أبدأ السحب'));

  const mappings = buildSemanticColumnMappings([
    'الاسم',
    'الأفراد الكلية',
    'المستحقة',
    'المحجوبين',
  ]);
  assert.equal(mappings.find((m) => m.sourceHeader === 'الأفراد الكلية')?.targetField, 'individuals');
  assert.equal(mappings.find((m) => m.sourceHeader === 'المستحقة')?.targetField, 'eligibleIndividuals');
  assert.equal(mappings.find((m) => m.sourceHeader === 'المحجوبين')?.targetField, 'decreaseCount');
});

test('performMetadataInference resolves Vision AI response and matches agencies safely', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        metadata: {
          agencyName: 'وكالة منذر الحلو',
          agencyNameConfidence: 0.97,
          tableDateLabel: 'تشرين الأول 2026',
          tableDateConfidence: 0.96,
          centerOrAgencyNumber: '412',
          detectedColumns: ['الاسم', 'الأفراد الكلية', 'المستحقة', 'المحجوبين'],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;

  try {
    const inferred = await performMetadataInference(
      {
        filename: 'sheet.jpg',
        imageDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      },
      MOCK_AGENCIES
    );
    assert.ok(inferred);
    assert.equal(inferred.agencyName, 'وكالة منذر الحلو');
    assert.equal(inferred.matchedAgencyId, 1);
    assert.equal(inferred.tableDateLabel, 'تشرين الأول 2026');
    assert.equal(inferred.confirmedByUser, false);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('Automatic mathematical validation highlights rows where total !== eligible + blocked', () => {
  const conflictRow = evaluateExtractedRow(
    {
      rowIndex: 7,
      pageNumber: 1,
      name: 'فلاح حسن عبود',
      individuals: 7,
      eligibleIndividuals: 5,
      decreaseCount: 1, // 5 + 1 = 6 !== 7 -> تعارض رياضي!
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 1,
      numbersConfidence: 1,
      dateConfidence: 1,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '7 | فلاح حسن عبود | 7 | 5 | 1',
    },
    0,
    { scanMode: 'fast' }
  );

  assert.ok(conflictRow.mathIssues.some((m) => m.includes('تعارض رياضي')));
  assert.equal(conflictRow.zeroTrustNumbersStatus, 'yellow');
  const conflictSummary = computeRowZeroTrustSummary(conflictRow);
  assert.equal(conflictSummary.hasMathConflict, true);
  assert.equal(conflictSummary.anyDoubt, true);

  const validRow = evaluateExtractedRow(
    {
      rowIndex: 8,
      pageNumber: 1,
      name: 'عباس كريم جاسم',
      individuals: 6,
      eligibleIndividuals: 5,
      decreaseCount: 1, // 5 + 1 = 6
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 1,
      numbersConfidence: 1,
      dateConfidence: 1,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '8 | عباس كريم جاسم | 6 | 5 | 1',
    },
    1,
    { scanMode: 'fast' }
  );

  assert.equal(validRow.mathIssues.length, 0);
  assert.equal(validRow.zeroTrustNumbersStatus, 'verified');
  const validSummary = computeRowZeroTrustSummary(validRow);
  assert.equal(validSummary.hasMathConflict, false);
  assert.equal(validSummary.anyDoubt, false);
});


