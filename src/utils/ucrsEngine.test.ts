import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLearningRulesToName,
  buildCoverageRegionsFromRows,
  buildDefaultReadingPlan,
  buildDiagnosticsForSession,
  classifyIntakeSource,
  compareSessionWithRoster,
  computeSessionStatistics,
  computeSmartCoverage,
  extractLearningRuleFromCorrection,
  judgeContentRelevance,
  mergeSupplementaryExtraction,
  runSemanticSearch,
} from './ucrsEngine';
import { evaluateExtractedRow } from './quickExtractEngine';
import type { Person, UcrsLearningRule, UcrsSession } from '../types/agency';

test('classifyIntakeSource identifies PDF, images, batch, Word, Excel, CSV, TXT, and camera burst', () => {
  assert.equal(classifyIntakeSource({ fileName: 'ledger.pdf' }).kind, 'pdf');
  assert.equal(classifyIntakeSource({ fileName: 'sheet.xlsx' }).kind, 'excel');
  assert.equal(classifyIntakeSource({ fileName: 'data.csv' }).kind, 'csv');
  assert.equal(classifyIntakeSource({ fileName: 'book.docx' }).kind, 'word');
  assert.equal(classifyIntakeSource({ fileName: 'notes.txt' }).kind, 'text');
  assert.equal(
    classifyIntakeSource({ fileName: 'page1.jpg', fileCount: 3 }).kind,
    'image_batch'
  );
  assert.equal(
    classifyIntakeSource({ fileName: 'cam', isCameraBurst: true }).kind,
    'camera_burst'
  );
});

test('judgeContentRelevance distinguishes ration beneficiary tables from unrelated invoices', () => {
  const tableJudge = judgeContentRelevance({
    textSample: 'جدول مستفيدين وكالة منذر الحلو عدد الأفراد حصة الطحين نزول إضافة',
    contentType: 'جدول مستفيدين',
    rowCount: 15,
  });
  assert.equal(tableJudge.level, 'important');

  const invoiceJudge = judgeContentRelevance({
    textSample: 'فاتورة شراء قرطاسية وأقلام بقيمة 12000 دينار',
    contentType: 'فاتورة',
    rowCount: 0,
  });
  assert.equal(invoiceJudge.level, 'irrelevant');
});

test('Progressive extraction fusion merges supplementary source without duplicating confident rows and updates smart coverage', () => {
  const row1 = evaluateExtractedRow(
    {
      rowIndex: 1,
      pageNumber: 1,
      name: 'محمد جاسم علي',
      individuals: 5,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.98,
      numbersConfidence: 0.98,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: 'محمد جاسم علي | 5',
      suspectBox: { ymin: 100, xmin: 100, ymax: 180, xmax: 900 },
    },
    0
  );

  const row2Doubtful = evaluateExtractedRow(
    {
      rowIndex: 2,
      pageNumber: 1,
      name: 'عبذ الله حسن',
      individuals: 4,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.72,
      numbersConfidence: 0.95,
      modelDoubtFlag: true,
      modelDoubtReason: 'شك في حرف الذال',
      rawSnippet: 'عبذ الله حسن | 4',
      suspectBox: { ymin: 200, xmin: 100, ymax: 280, xmax: 900 },
    },
    1
  );

  const initialCoverage = computeSmartCoverage({
    rows: [row1, row2Doubtful],
    estimatedTotalItems: 4,
    unreadableCount: 2,
  });
  // Only row1 is confident out of 4 estimated => 25%
  assert.equal(initialCoverage.confidentCount, 1);
  assert.equal(initialCoverage.doubtfulCount, 1);
  assert.equal(initialCoverage.unreadableCount, 2);
  assert.equal(initialCoverage.overallPercent, 25);

  const session: UcrsSession = {
    id: 'sess_test_1',
    title: 'دفتر يناير',
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
    status: 'needs_completion',
    sources: [],
    identity: {
      contentType: 'دفتر يدوي',
      topic: 'قائمة مستفيدين',
      qualityLabel: 'متوسط',
      qualityScore: 72,
      relevanceLevel: 'important',
      relevanceReasons: ['جدول مستفيدين'],
      languageSummary: 'عربي',
      estimatedTotalRows: 4,
      estimatedColumns: 4,
      estimatedConfidentCount: 1,
      estimatedDoubtfulCount: 1,
      estimatedUnreadableCount: 2,
      wordCount: 20,
      detectedNamesCount: 4,
      detectedDates: [],
      detectedLocations: [],
      opinionAndRecommendation: 'مهم',
      suggestedActions: [],
    },
    plan: buildDefaultReadingPlan('extract_all'),
    rows: [row1, row2Doubtful],
    entities: [],
    coverage: initialCoverage,
    coverageRegions: buildCoverageRegionsFromRows([row1, row2Doubtful]),
    diagnostics: [],
    documentSummary: 'دفتر يناير',
  };

  const learnedRule = extractLearningRuleFromCorrection({
    originalName: 'عبذ الله حسن',
    correctedName: 'عبد الله حسن',
    sourceContext: 'دفتر يناير',
  });
  assert.ok(learnedRule);
  assert.equal(learnedRule.wrongToken, 'عبذ');
  assert.equal(learnedRule.correctedToken, 'عبد');

  const applied = applyLearningRulesToName('عبذ الله كريم', [learnedRule]);
  assert.equal(applied.updatedName, 'عبد الله كريم');

  // Supplementary clear photo recovers row2 cleanly + 2 previously unreadable rows + duplicates row1
  const incomingRow1Dup = { ...row1 };
  const incomingRow2Fixed = evaluateExtractedRow(
    {
      rowIndex: 2,
      pageNumber: 1,
      name: 'عبذ الله حسن',
      individuals: 4,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.97,
      numbersConfidence: 0.97,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: 'عبد الله حسن | 4',
    },
    1
  );
  const incomingRow3 = evaluateExtractedRow(
    {
      rowIndex: 3,
      pageNumber: 1,
      name: 'حسين علي كاظم',
      individuals: 6,
      decreaseCount: 0,
      addOrDeleteCount: 1,
      addOrDeleteAction: 'إضافة',
      nameConfidence: 0.96,
      numbersConfidence: 0.96,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: 'حسين علي كاظم | 6',
    },
    2
  );
  const incomingRow4 = evaluateExtractedRow(
    {
      rowIndex: 4,
      pageNumber: 1,
      name: 'كاظم عباس جاسم',
      individuals: 3,
      decreaseCount: 1,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.96,
      numbersConfidence: 0.96,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: 'كاظم عباس جاسم | 3',
    },
    3
  );

  const merged = mergeSupplementaryExtraction({
    session,
    sourceLabel: 'صورة الجزء السفلي الأيمن',
    incomingRows: [incomingRow1Dup, incomingRow2Fixed, incomingRow3, incomingRow4],
    learningRules: [learnedRule],
  });

  assert.equal(merged.diff.newlyRecoveredCount, 2);
  assert.equal(merged.diff.upgradedFromDoubtCount, 1);
  assert.equal(merged.diff.duplicatesSkippedCount, 1);
  assert.equal(merged.updatedSession.rows.length, 4);
  assert.equal(merged.updatedSession.coverage.overallPercent, 100);
  assert.equal(merged.updatedSession.status, 'ready');
});

test('runSemanticSearch supports exact, fuzzy Arabic, semantic synonym, and numeric queries', () => {
  const rowA = evaluateExtractedRow(
    {
      rowIndex: 1,
      pageNumber: 1,
      name: 'محمذ علي حسن',
      individuals: 8,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.95,
      numbersConfidence: 0.95,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: 'محمذ علي حسن | موقوف مؤقتاً',
    },
    0
  );
  rowA.notes = 'موقوف لعدم المطابقة';

  const rowB = evaluateExtractedRow(
    {
      rowIndex: 2,
      pageNumber: 1,
      name: 'سعد جبار',
      individuals: 3,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.96,
      numbersConfidence: 0.96,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: 'سعد جبار | 3',
    },
    1
  );

  const session: UcrsSession = {
    id: 'sess_search',
    title: 'سجل البحث',
    createdAt: '2026-11-20',
    updatedAt: '2026-11-20',
    status: 'ready',
    sources: [],
    identity: null,
    plan: buildDefaultReadingPlan('semantic_search'),
    rows: [rowA, rowB],
    entities: [],
    coverage: computeSmartCoverage({ rows: [rowA, rowB] }),
    coverageRegions: [],
    diagnostics: [],
    documentSummary: '',
  };

  // Fuzzy match: محمد finds محمذ
  const fuzzyHits = runSemanticSearch({ query: 'محمد', sessions: [session] });
  assert.equal(fuzzyHits.length, 1);
  assert.equal(fuzzyHits[0].matchKind, 'fuzzy');

  // Semantic match: حجب finds موقوف
  const semanticHits = runSemanticSearch({ query: 'حجب', sessions: [session] });
  assert.equal(semanticHits.length, 1);
  assert.equal(semanticHits[0].matchKind, 'semantic');

  // Numeric match: > 5 finds 8
  const numericHits = runSemanticSearch({ query: '> 5', sessions: [session] });
  assert.equal(numericHits.length, 1);
  assert.ok(numericHits[0].matchedText.includes('محمذ'));
});

test('computeSessionStatistics, compareSessionWithRoster, and buildDiagnosticsForSession compute complete audit insights', () => {
  const row = evaluateExtractedRow(
    {
      rowIndex: 1,
      pageNumber: 1,
      name: 'علي حسن كاظم',
      individuals: 7,
      decreaseCount: 1,
      addOrDeleteCount: 2,
      addOrDeleteAction: 'إضافة',
      nameConfidence: 0.8,
      numbersConfidence: 0.95,
      modelDoubtFlag: true,
      modelDoubtReason: 'تداخل حروف',
      rawSnippet: 'علي حسن كاظم | 7',
    },
    0
  );
  const session: UcrsSession = {
    id: 's_stats',
    title: 'إحصاءات',
    createdAt: '2026-11-20',
    updatedAt: '2026-11-20',
    status: 'in_progress',
    sources: [],
    identity: null,
    plan: buildDefaultReadingPlan('extract_all'),
    rows: [row],
    entities: [],
    coverage: computeSmartCoverage({ rows: [row] }),
    coverageRegions: [],
    diagnostics: [],
    documentSummary: '',
  };

  const stats = computeSessionStatistics(session);
  assert.equal(stats.avgIndividuals, 7);
  assert.equal(stats.totalAdditions, 2);
  assert.equal(stats.totalDecreases, 1);

  const roster: Person[] = [
    {
      id: 1,
      agencyId: 1,
      name: 'علي حسن كاظم',
      nationalId: '111',
      individuals: 5,
      blockType: 'none',
      blockedIndividuals: 0,
      blockReason: '',
      status: '',
      notes: '',
      updatedAt: '2026-11-01',
    },
  ];
  const comp = compareSessionWithRoster(session, roster);
  assert.equal(comp.similarityPercent, 100);
  assert.equal(comp.changedIndividualsCount, 1);

  const diags = buildDiagnosticsForSession({ rows: [row] });
  assert.equal(diags.length, 1);
  assert.ok(diags[0].hypotheses.length >= 1);
});
