import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agency } from '../types/agency.ts';
import {
  evaluateExtractedRow,
  recomputeRowValidation,
} from './quickExtractEngine.ts';
import {
  computeRowZeroTrustSummary,
  getFullRowCropBox,
  inferMetadataFromText,
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

test('Metadata inference extracts agency name, month/date, and center number from header text', () => {
  const header = `
    كشف توزيع الحصة التموينية
    وكالة منذر الحلو - مركز رقم 412
    لشهر تشرين الأول 2026
    الاسم | عدد الأفراد | النزول
  `;
  const meta = inferMetadataFromText(header, MOCK_AGENCIES, 'table.xlsx');
  assert.ok(meta);
  assert.equal(meta.agencyName, 'وكالة منذر الحلو');
  assert.equal(meta.matchedAgencyId, 1);
  assert.equal(meta.tableDateLabel, 'تشرين الأول 2026');
  assert.equal(meta.centerOrAgencyNumber, '412');
  assert.equal(meta.confirmedByUser, false);
});
