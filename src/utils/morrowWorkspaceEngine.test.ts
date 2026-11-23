import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DATABASE_STATE } from '../data/seedData';
import type { MonthlyArchiveRecord } from '../types/agency';
import { computeAgencyMetrics } from './agencyLogic';
import {
  analyzeRawArabicText,
  buildIndexedWorkspaceAnalytics,
  computeProactiveInsightsAndForecasts,
  decideSummonOrNavigate,
  DEFAULT_MORROW_MACROS,
  executeMorrowMacro,
  generateExecutiveReport,
} from './morrowWorkspaceEngine';

function makeSeedState() {
  return structuredClone(INITIAL_DATABASE_STATE);
}

test('buildIndexedWorkspaceAnalytics matches computeAgencyMetrics in a single pass', () => {
  const state = makeSeedState();
  const indexed = buildIndexedWorkspaceAnalytics(
    state.agencies,
    state.persons,
    state.expenses,
    state.calculationSettings
  );

  const directAll = computeAgencyMetrics(
    state.persons,
    state.expenses,
    state.calculationSettings
  );

  assert.equal(indexed.totals.activeIndividuals, directAll.activeIndividuals);
  assert.equal(indexed.totals.activeHouseholds, directAll.activeHouseholds);
  assert.equal(indexed.totals.fullBags, directAll.fullBags);
  assert.equal(indexed.totals.profit, directAll.profit);

  for (const ag of state.agencies) {
    const directAg = computeAgencyMetrics(
      state.persons.filter((p) => p.agencyId === ag.id),
      state.expenses.filter((e) => e.agencyId === ag.id),
      state.calculationSettings
    );
    const indexedAg = indexed.byAgencyId.get(ag.id)?.metrics;
    assert.ok(indexedAg);
    assert.equal(indexedAg.activeIndividuals, directAg.activeIndividuals);
    assert.equal(indexedAg.fullBags, directAg.fullBags);
    assert.equal(indexedAg.revenue, directAg.revenue);
  }
});

test('decideSummonOrNavigate routes macros/charts to Canvas and explicit nav to Spotlight', () => {
  const state = makeSeedState();

  const macroDec = decideSummonOrNavigate('إغلاق الشهر', state.agencies, DEFAULT_MORROW_MACROS);
  assert.equal(macroDec.mode, 'summon_canvas');
  assert.equal(macroDec.canvasMode, 'macro_studio');

  const chartDec = decideSummonOrNavigate('اعرض لي رسم بياني لتوزيع الحصص', state.agencies);
  assert.equal(chartDec.mode, 'summon_canvas');
  assert.equal(chartDec.canvasMode, 'overview_charts');

  const forecastDec = decideSummonOrNavigate('توقع التغييرات للشهر القادم', state.agencies);
  assert.equal(forecastDec.mode, 'summon_canvas');
  assert.equal(forecastDec.canvasMode, 'forecast');

  const textDec = decideSummonOrNavigate('حلل النص التالي من واتساب', state.agencies);
  assert.equal(textDec.mode, 'summon_canvas');
  assert.equal(textDec.canvasMode, 'text_analysis');

  const navDec = decideSummonOrNavigate('وريني القوائم الجاهزة', state.agencies);
  assert.equal(navDec.mode, 'navigate_spotlight');
  assert.equal(navDec.targetView, 'ready_lists');
});

test('computeProactiveInsightsAndForecasts compares against archives and detects growth/drop', () => {
  const state = makeSeedState();
  const firstAg = state.agencies[0];
  const indexedBefore = buildIndexedWorkspaceAnalytics(
    state.agencies,
    state.persons,
    state.expenses,
    state.calculationSettings
  );
  const currentFirstInd = indexedBefore.byAgencyId.get(firstAg.id)?.metrics.activeIndividuals || 10;

  // Simulate previous month archive having 50% fewer individuals in agency 1
  const prevPersons = state.persons
    .filter((p) => p.agencyId === firstAg.id)
    .slice(0, Math.max(1, Math.floor(state.persons.filter((p) => p.agencyId === firstAg.id).length * 0.4)));

  const prevArchive: MonthlyArchiveRecord = {
    id: 'arch_prev',
    label: 'الحصة الثامنة - أيلول 2026',
    createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    isClosed: true,
    archiveSource: 'manual',
    periodMeta: {
      quotaNumber: '8',
      quotaName: 'الحصة الثامنة',
      monthNumber: 9,
      monthName: 'أيلول',
      year: 2026,
      fullDate: '2026-09-01',
      quotaDate: '2026-09-01',
    },
    agencies: [firstAg],
    persons: prevPersons,
    readyLists: [],
    readyListItems: [],
    expenses: [],
    relations: [],
    tableHeaders: {},
    calculationSettings: state.calculationSettings,
    summary: {
      totalAgencies: 1,
      totalHouseholds: prevPersons.length,
      activeHouseholds: prevPersons.length,
      totalIndividuals: Math.max(1, Math.round(currentFirstInd * 0.4)),
      totalKg: 100,
      totalRevenueIqd: 25000,
      totalExpensesIqd: 0,
    },
  };

  const result = computeProactiveInsightsAndForecasts({
    state,
    monthlyArchives: [prevArchive],
    lastBackupAt: null,
  });

  assert.ok(result.insights.length >= 2);
  assert.ok(result.insights.some((i) => i.category === 'backup'));
  const agForecast = result.forecast.agencyForecasts.find((f) => f.agencyId === firstAg.id);
  assert.ok(agForecast);
  assert.equal(agForecast.riskLevel, 'high');
  assert.ok(result.forecast.projectedIndividuals > 0);
});

test('analyzeRawArabicText parses Iraqi/Arabic updates and unmatched additions accurately', () => {
  const state = makeSeedState();
  const samplePerson = state.persons.find((p) => p.status === '' && (p.individuals ?? 0) > 0)!;
  const firstToken = samplePerson.name.split(' ').slice(0, 2).join(' ');

  const rawText = [
    `تعديل ${firstToken} إلى 7 أفراد`,
    `احجب ${firstToken} بالكامل`,
    `إضافة عائلة سلام كاظم الربيعي 5 أفراد`,
  ].join('\n');

  const analysis = analyzeRawArabicText({
    rawText,
    persons: state.persons,
    agencies: state.agencies,
  });

  assert.equal(analysis.entries.length, 3);
  assert.equal(analysis.entries[0].actionHint, 'update_individuals');
  assert.equal(analysis.entries[0].extractedIndividuals, 7);
  assert.equal(analysis.entries[0].matchedPersonId, samplePerson.id);

  assert.equal(analysis.entries[1].actionHint, 'block_full');
  assert.equal(analysis.entries[1].matchedPersonId, samplePerson.id);

  assert.equal(analysis.entries[2].actionHint, 'add_person');
  assert.equal(analysis.entries[2].extractedIndividuals, 5);
});

test('executeMorrowMacro("إغلاق الشهر") executes all 6 steps and stages Zero-Trust drafts without mutating state', () => {
  const state = makeSeedState();
  const originalSnapshot = JSON.stringify(state);
  const closeMonthMacro = DEFAULT_MORROW_MACROS.find((m) => m.triggerPhrase === 'إغلاق الشهر')!;

  const report = generateExecutiveReport({
    agencies: state.agencies,
    persons: state.persons,
    expenses: state.expenses,
    settings: state.calculationSettings,
  });
  assert.ok(report.summaryPoints.length >= 3);

  const macroResult = executeMorrowMacro({
    macro: closeMonthMacro,
    state,
    monthlyArchives: [],
    lastBackupAt: null,
  });

  assert.equal(macroResult.steps.length, 6);
  assert.ok(macroResult.report);
  assert.ok(macroResult.forecast);
  assert.ok(macroResult.diagnosticsSummary);
  assert.ok(
    macroResult.stagedDraftTools.some(
      (t) => t.name === 'backup_restore' && t.args.action === 'archive_period'
    )
  );
  // Input state must remain untouched (Zero-Trust)
  assert.equal(JSON.stringify(state), originalSnapshot);
});
