import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFeeRules,
  calculateAllocation,
  computeAgencyMetrics,
  DEFAULT_CALCULATION_SETTINGS,
  getEffectiveAllocationForPerson,
  normalizePhoneNumber,
} from './agencyLogic';
import { getModeCapabilities } from './modePermissions';
import {
  buildSafeQuickExtractResult,
  computeAdjustedIndividuals,
  evaluateExtractedName,
  evaluateExtractedRow,
  recomputeRowValidation,
} from './quickExtractEngine';
import {
  moveExpertColumnInOrder,
  pushRecycleBinEntry,
  restoreRecycleBinEntryFromState,
} from './recycleBin';
import { INITIAL_DATABASE_STATE } from '../data/seedData';
import type { AgencyExpense, Person, QuickExtractRawRow } from '../types/agency';

test('normalizePhoneNumber handles Iraqi and international phone numbers', () => {
  assert.equal(normalizePhoneNumber('07701234567'), '+9647701234567');
  assert.equal(normalizePhoneNumber('٠٧٨٠١٢٣٤٥٦٧'), '+9647801234567');
  assert.equal(normalizePhoneNumber('009647701234567'), '+9647701234567');
});

test('partial and full block math computes eligible individuals, bags, and net profit', () => {
  const persons: Person[] = [
    {
      id: 1,
      agencyId: 1,
      name: 'علي حسن كاظم',
      nationalId: '19880101',
      individuals: 10,
      blockType: 'partial',
      blockedIndividuals: 4,
      blockReason: 'مسافر',
      status: '',
      notes: '',
      updatedAt: '2026-01-01',
    },
    {
      id: 2,
      agencyId: 1,
      name: 'سعد جبار محمد',
      nationalId: '19890202',
      individuals: 5,
      blockType: 'full',
      blockedIndividuals: 5,
      blockReason: 'موقوف',
      status: 'محجوب',
      notes: '',
      updatedAt: '2026-01-01',
    },
  ];
  const expenses: AgencyExpense[] = [
    {
      id: 1,
      agencyId: 1,
      description: 'أجور تحميل وتنزيل',
      amountIqd: 500,
      category: 'worker_wages',
      occurredAt: '2026-01-02',
    },
    {
      id: 2,
      agencyId: 1,
      description: 'إيجار ومطبوعات',
      amountIqd: 250,
      category: 'general',
      occurredAt: '2026-01-02',
    },
  ];

  const eff1 = getEffectiveAllocationForPerson(persons[0], DEFAULT_CALCULATION_SETTINGS);
  assert.equal(eff1.eligibleIndividuals, 6);
  assert.equal(eff1.priceIqd, 6 * 250 + 250);

  const eff2 = getEffectiveAllocationForPerson(persons[1], DEFAULT_CALCULATION_SETTINGS);
  assert.equal(eff2.eligibleIndividuals, 0);
  assert.equal(eff2.priceIqd, 0);

  const metrics = computeAgencyMetrics(persons, expenses, DEFAULT_CALCULATION_SETTINGS);
  assert.equal(metrics.activeHouseholds, 1);
  assert.equal(metrics.activeIndividuals, 6);
  assert.equal(metrics.totalKg, 54);
  assert.equal(metrics.fullBags, 1);
  assert.equal(metrics.remainderKg, 4);
  assert.equal(metrics.revenue, 1750);
  assert.equal(metrics.workerWages, 500);
  assert.equal(metrics.generalExpenses, 250);
  assert.equal(metrics.profit, 1000);
});

test('Quick Extract safe rejection gate rejects blurry/low clarity PDFs', () => {
  const rejected = buildSafeQuickExtractResult({
    clarityScore: 42,
    legibilityStatus: 'needs_review',
    pageCount: 1,
    rejectionReasons: [],
    documentSummary: '',
    rawRows: [],
  });
  assert.equal(rejected.status, 'rejected');
  assert.ok(rejected.rejectionReasons.length > 0);
});

test('Quick Extract doubt engine flags corrupted Arabic names and missing fields', () => {
  const nameCheck = evaluateExtractedName('احمد ??? 12', 0.98, false, '');
  assert.equal(nameCheck.hasDoubt, true);
  assert.ok(nameCheck.reasons.length >= 2);

  const rawRow: QuickExtractRawRow = {
    rowIndex: 1,
    pageNumber: 1,
    name: 'محمد جاسم',
    individuals: 6,
    decreaseCount: null,
    addOrDeleteCount: 1,
    addOrDeleteAction: 'إضافة',
    nameConfidence: 0.85,
    numbersConfidence: 0.96,
    modelDoubtFlag: false,
    modelDoubtReason: '',
    rawSnippet: 'محمد جاسم | 6 | - | 1',
  };

  const evaluated = evaluateExtractedRow(rawRow, 0);
  assert.equal(evaluated.hasDoubt, true);
  assert.equal(evaluated.doubtConfirmed, false);
  assert.deepEqual(evaluated.missingFields, ['decreaseCount']);
  assert.equal(evaluated.isComplete, false);

  evaluated.resolvedDecreaseCount = 2;
  const calc = computeAdjustedIndividuals(evaluated);
  assert.equal(calc.finalIndividuals, 5); // 6 + 1 add - 2 decrease = 5

  // Zero-Blind-Commit: applying a suggestion clears red segments but keeps row awaiting explicit confirmation
  const afterSuggestion = recomputeRowValidation(
    { ...evaluated, resolvedName: 'محمد جاسم علي' },
    { resetConfirmOnNameEdit: true }
  );
  assert.equal(afterSuggestion.suspectSegments.length, 0);
  assert.equal(afterSuggestion.hasDoubt, true);
  assert.equal(afterSuggestion.doubtConfirmed, false);
});

test('Unified capabilities keep all tools active while respecting confirmation rules', () => {
  const strict = getModeCapabilities('beginner', false, false, true, true);
  assert.equal(strict.isReadOnlyPdfView, false);
  assert.equal(strict.canUseQuickExtract, true);
  assert.equal(strict.canEditRecords, true);
  assert.equal(strict.requireDeleteConfirm, true);
  assert.equal(strict.requireEditConfirm, true);
  assert.equal(strict.requireAddConfirm, false);

  const pro = getModeCapabilities('professional', true, false, true, true);
  assert.equal(pro.isReadOnlyPdfView, false);
  assert.equal(pro.canUseQuickExtract, true);
  assert.equal(pro.canEditRecords, true);
  assert.equal(pro.requireDeleteConfirm, true);
  assert.equal(pro.requireEditConfirm, true);
  assert.equal(pro.requireAddConfirm, false);
});

test('calculateAllocation computes exact bags and remainder with default 250 IQD fee', () => {
  assert.equal(DEFAULT_CALCULATION_SETTINGS.feePerIndividualIqd, 250);

  const alloc5 = calculateAllocation(5, DEFAULT_CALCULATION_SETTINGS);
  assert.deepEqual(alloc5, {
    totalKg: 45,
    fullBags: 0,
    remainderKg: 45,
    priceIqd: 1500, // 5 * 250 + 250 fixed
  });

  const alloc = calculateAllocation(11, DEFAULT_CALCULATION_SETTINGS);
  assert.deepEqual(alloc, {
    totalKg: 99,
    fullBags: 1,
    remainderKg: 49,
    priceIqd: 3000, // 11 * 250 + 250 fixed
  });
});

import {
  APP_THEMES,
  ARABIC_FONTS,
  DEFAULT_THEME_PREFERENCES,
  getAppThemeById,
  TABLE_THEMES,
} from './themes';
import {
  buildReadyListShareText,
  resolveReadyListItemRecord,
} from './excelExport';
import type { ReadyList, ReadyListItem } from '../types/agency';

test('themes registry exposes 5 Absolute Marine themes, 8 table themes, and 6 Arabic fonts with fg tokens', () => {
  assert.equal(APP_THEMES.length, 5);
  assert.equal(TABLE_THEMES.length, 8);
  assert.equal(ARABIC_FONTS.length, 6);
  for (const theme of APP_THEMES) {
    assert.ok(theme.vars['--accent-fg']);
    assert.ok(theme.vars['--success-fg']);
    assert.ok(theme.vars['--danger-fg']);
  }
  assert.equal(getAppThemeById('abyssal-emerald').isDark, true);
  assert.equal(getAppThemeById('desert-mirage').id, 'abyssal-emerald');
  assert.equal(getAppThemeById('midnight-slate').id, 'pelagic-sapphire');
  assert.equal(DEFAULT_THEME_PREFERENCES.tabularNumerals, true);
});

test('resolveReadyListItemRecord respects live linked person unless overridden', () => {
  const livePerson: Person = {
    id: 101,
    agencyId: 1,
    name: 'حسين علي',
    nationalId: '1122',
    individuals: 6,
    blockType: 'none',
    blockedIndividuals: 0,
    blockReason: '',
    status: '',
    notes: 'حي النصر',
    updatedAt: '2026-01-01',
  };
  const personMap = new Map([[101, livePerson]]);

  const linkedItem: ReadyListItem = {
    id: 1,
    listId: 1,
    position: 1,
    sourcePersonId: 101,
    name: 'اسم قديم',
    individuals: 4,
    status: '',
    notes: 'ملاحظة قديمة',
  };
  assert.equal(resolveReadyListItemRecord(linkedItem, personMap).name, 'حسين علي');
  assert.equal(resolveReadyListItemRecord(linkedItem, personMap).individuals, 6);

  const editedItem: ReadyListItem = {
    ...linkedItem,
    name: 'حسين علي (معدل)',
    individuals: 8,
    isOverridden: true,
  };
  assert.equal(resolveReadyListItemRecord(editedItem, personMap).name, 'حسين علي (معدل)');
  assert.equal(resolveReadyListItemRecord(editedItem, personMap).individuals, 8);
});

test('buildReadyListShareText formats header, subtitles, date, rows, and totals', () => {
  const list: ReadyList = {
    id: 1,
    agencyId: 1,
    name: 'قائمة خط المركز',
    listDate: '2026-05-01',
    subtitle1: 'الوكالة: منذر الحلو',
    subtitle2: 'السائق: عباس فاضل',
    createdAt: '2026-05-01',
    note: '',
  };
  const items: ReadyListItem[] = [
    {
      id: 1,
      listId: 1,
      position: 1,
      sourcePersonId: null,
      name: 'جاسم محمد',
      individuals: 5,
      status: '',
      notes: 'توصيل صباحي',
      isOverridden: true,
    },
  ];
  const text = buildReadyListShareText({
    list,
    items,
    persons: [],
    settings: DEFAULT_CALCULATION_SETTINGS,
  });
  assert.ok(text.includes('قائمة خط المركز'));
  assert.ok(text.includes('2026-05-01'));
  assert.ok(text.includes('الوكالة: منذر الحلو'));
  assert.ok(text.includes('السائق: عباس فاضل'));
  assert.ok(text.includes('جاسم محمد'));
  assert.ok(text.includes('الإجمالي: 1 عائلة | 5 أفراد'));
});

import {
  buildSelectedRecordsCopyText,
  getRelationCategoryMeta,
  RELATION_CATEGORIES,
  resolveSectionTableHeader,
} from './relationMeta';

test('RELATION_CATEGORIES defines all 5 practical follow-up categories', () => {
  assert.equal(RELATION_CATEGORIES.length, 5);
  assert.equal(getRelationCategoryMeta('favorites').label, 'المفضلة');
  assert.equal(getRelationCategoryMeta('edit_later').label, 'التعديل لاحقًا');
  assert.equal(getRelationCategoryMeta('reminder').label, 'التذكير');
  assert.equal(
    getRelationCategoryMeta('delivery_notes').label,
    'ملاحظات التوصيل / الخط'
  );
  assert.equal(
    getRelationCategoryMeta('pending_audit').label,
    'قيد المتابعة / المراجعة'
  );
});

test('resolveSectionTableHeader returns stored header or sensible default with autoUpdateDate', () => {
  const custom = {
    'agency:1': {
      title: 'وكالة منذر — وجبة أيار',
      subtitle: 'الخط الأول',
      date: '2026-05-10',
      autoUpdateDate: false,
      lastUpdatedAt: '2026-05-10',
    },
  };
  const resolvedCustom = resolveSectionTableHeader({
    key: 'agency:1',
    tableHeaders: custom,
    fallbackTitle: 'افتراضي',
  });
  assert.equal(resolvedCustom.title, 'وكالة منذر — وجبة أيار');
  assert.equal(resolvedCustom.autoUpdateDate, false);

  const resolvedFallback = resolveSectionTableHeader({
    key: 'agency:2',
    tableHeaders: custom,
    fallbackTitle: 'وكالة علي جاسم',
    fallbackSubtitle: 'وصف فرعي',
  });
  assert.equal(resolvedFallback.title, 'وكالة علي جاسم');
  assert.equal(resolvedFallback.subtitle, 'وصف فرعي');
  assert.equal(resolvedFallback.autoUpdateDate, true);
});

test('buildSelectedRecordsCopyText formats single detailed card and multi-selection summary', () => {
  const single = buildSelectedRecordsCopyText({
    persons: [
      {
        name: 'حسين علي كاظم',
        agencyName: 'وكالة منذر الحلو',
        nationalId: '19880101',
        individuals: 6,
        notes: 'قرب الجامع',
      },
    ],
    settings: DEFAULT_CALCULATION_SETTINGS,
  });
  assert.ok(single.includes('الاسم: حسين علي كاظم'));
  assert.ok(single.includes('الوكالة: وكالة منذر الحلو'));
  assert.ok(single.includes('الملاحظات: قرب الجامع'));

  const multi = buildSelectedRecordsCopyText({
    persons: [
      { name: 'حسين علي', individuals: 6 },
      { name: 'زهراء محمد', individuals: 5 },
    ],
    settings: DEFAULT_CALCULATION_SETTINGS,
  });
  assert.ok(multi.includes('1. حسين علي — 6 أفراد'));
  assert.ok(multi.includes('2. زهراء محمد — 5 أفراد'));
});

import {
  analyzeArabicNameAgainstTree,
  auditExtractedRowMath,
  buildArabicNameTree,
  computeQuickExtractRoutingPlan,
  evaluateRoutingRuleCondition,
} from './quickExtractEngine';
import { evaluateBurstFrameMetrics } from './ledgerImageProcessor';
import type { Agency, QuickExtractRoutingConfig } from '../types/agency';

test('Arabic Name Tree isolates suspect red-flag words and suggests matching roster names', () => {
  const seedPersons: Person[] = [
    {
      id: 10,
      agencyId: 1,
      name: 'حسين علي كاظم',
      nationalId: '19880101',
      individuals: 6,
      blockType: 'none',
      blockedIndividuals: 0,
      blockReason: '',
      status: '',
      notes: '',
      updatedAt: '2026-01-01',
    },
  ];
  const tree = buildArabicNameTree(seedPersons);
  const res = analyzeArabicNameAgainstTree({
    name: 'حسين عل؟ كاظم',
    tree,
    nameConfidence: 0.78,
    modelDoubtFlag: true,
    modelDoubtReason: 'تداخل نقاط في الكلمة الوسطى',
    suspectSpans: [{ word: 'عل؟', reason: 'حرف غير واضح' }],
  });

  assert.ok(res.suspectSegments.some((s) => s.wordIndex === 1 && s.word === 'عل؟'));
  assert.ok(res.suggestedNames.includes('حسين علي كاظم'));
});

test('auditExtractedRowMath catches impossible decrease, missing action type, and extreme jumps', () => {
  const issues1 = auditExtractedRowMath({
    resolvedName: 'علي حسن',
    resolvedIndividuals: 3,
    resolvedDecreaseCount: 5,
    resolvedAddOrDeleteCount: 2,
    resolvedAddOrDeleteAction: 'لا يوجد',
  });
  assert.equal(issues1.length, 2);

  const existing: Person = {
    id: 22,
    agencyId: 1,
    name: 'علي حسن',
    nationalId: '111',
    individuals: 4,
    blockType: 'none',
    blockedIndividuals: 0,
    blockReason: '',
    status: '',
    notes: '',
    updatedAt: '2026-01-01',
  };
  const issues2 = auditExtractedRowMath(
    {
      resolvedName: 'علي حسن',
      resolvedIndividuals: 12,
      resolvedDecreaseCount: 0,
      resolvedAddOrDeleteCount: 0,
      resolvedAddOrDeleteAction: 'لا يوجد',
    },
    existing
  );
  assert.equal(issues2.length, 1);
  assert.ok(issues2[0].includes('فارق رقمي كبير'));
});

test('evaluateBurstFrameMetrics rejects blurry/flat captures and accepts crisp high-contrast ledger text', () => {
  const w = 120;
  const h = 120;

  // Flat blurry frame (uniform gray)
  const blurry = new Uint8ClampedArray(w * h).fill(180);
  const blurryMetrics = evaluateBurstFrameMetrics({
    width: w,
    height: h,
    lumaSamples: blurry,
  });
  assert.equal(blurryMetrics.isAcceptable, false);
  assert.ok(blurryMetrics.issues.length >= 1);

  // Crisp alternating ink-on-paper grid pattern
  const crisp = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isInk = (x % 6 < 2 && y % 8 < 5) || y % 20 === 0;
      crisp[y * w + x] = isInk ? 25 : 235;
    }
  }
  const crispMetrics = evaluateBurstFrameMetrics({
    width: w,
    height: h,
    lumaSamples: crisp,
  });
  assert.equal(crispMetrics.isAcceptable, true);
  assert.ok(crispMetrics.sharpnessScore >= 40);
});

test('computeQuickExtractRoutingPlan splits additions and decreases across Agency and Ready List destinations', () => {
  const agencies: Agency[] = [
    { id: 1, name: 'وكالة منذر', icon: '🌾', isLocked: false },
    { id: 2, name: 'وكالة علي', icon: '📦', isLocked: false },
  ];
  const persons: Person[] = [
    {
      id: 1,
      agencyId: 1,
      name: 'جاسم محمد علي',
      nationalId: '1001',
      individuals: 5,
      blockType: 'none',
      blockedIndividuals: 0,
      blockReason: '',
      status: '',
      notes: '',
      updatedAt: '2026-01-01',
    },
  ];
  const rows = [
    evaluateExtractedRow(
      {
        rowIndex: 1,
        pageNumber: 1,
        name: 'جاسم محمد علي',
        individuals: 5,
        decreaseCount: 1,
        addOrDeleteCount: 0,
        addOrDeleteAction: 'لا يوجد',
        nameConfidence: 0.99,
        numbersConfidence: 0.99,
        modelDoubtFlag: false,
        modelDoubtReason: '',
        rawSnippet: '',
      },
      0,
      { persons }
    ),
    evaluateExtractedRow(
      {
        rowIndex: 2,
        pageNumber: 1,
        name: 'زهراء كاظم حسن',
        individuals: 4,
        decreaseCount: 0,
        addOrDeleteCount: 2,
        addOrDeleteAction: 'إضافة',
        nameConfidence: 0.99,
        numbersConfidence: 0.99,
        modelDoubtFlag: false,
        modelDoubtReason: '',
        rawSnippet: '',
      },
      1,
      { persons }
    ),
  ];

  const routing: QuickExtractRoutingConfig = {
    mode: 'split_by_change',
    mergeStrategy: 'update_matched',
    primaryDestination: {
      kind: 'agency',
      agencyId: 1,
      readyListMeta: {
        name: 'عام',
        listDate: '2026-05-01',
        subtitle1: '',
        subtitle2: '',
        autoUpdateDate: false,
      },
    },
    additionsDestination: {
      kind: 'ready_list',
      agencyId: 2,
      readyListMeta: {
        name: 'قائمة الإضافات الجديدة',
        listDate: '2026-05-01',
        subtitle1: 'فرع 2',
        subtitle2: 'سريع',
        autoUpdateDate: false,
      },
    },
    decreasesDestination: {
      kind: 'master_roster',
      agencyId: 1,
      readyListMeta: {
        name: 'نزول',
        listDate: '2026-05-01',
        subtitle1: '',
        subtitle2: '',
        autoUpdateDate: false,
      },
    },
  };

  const plan = computeQuickExtractRoutingPlan({
    rows,
    routing,
    agencies,
    persons,
  });
  assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0].destination.kind, 'master_roster');
  assert.equal(plan.items[0].actionType, 'update_matched');
  assert.equal(plan.items[0].finalIndividuals, 4);
  assert.equal(plan.items[1].destination.kind, 'ready_list');
  assert.equal(plan.items[1].finalIndividuals, 6);
});

test('computeQuickExtractRoutingPlan evaluates custom dynamic rules, existing_ready_list targets, and per-row overrides', () => {
  const agencies: Agency[] = [
    { id: 1, name: 'وكالة منذر', icon: '🌾', isLocked: false },
    { id: 2, name: 'وكالة علي', icon: '📦', isLocked: false },
  ];
  const readyLists: ReadyList[] = [
    {
      id: 77,
      agencyId: 1,
      name: 'قائمة إضافات الخط الأول',
      listDate: '2026-05-01',
      subtitle1: '',
      subtitle2: '',
      createdAt: '2026-05-01',
      note: '',
    },
  ];
  const persons: Person[] = [
    {
      id: 10,
      agencyId: 2,
      name: 'سعد كريم جاسم',
      nationalId: '2001',
      individuals: 5,
      blockType: 'none',
      blockedIndividuals: 0,
      blockReason: '',
      status: '',
      notes: '',
      updatedAt: '2026-01-01',
    },
  ];

  const rowAdd = evaluateExtractedRow(
    {
      rowIndex: 1,
      pageNumber: 1,
      name: 'كاظم عباس حسن',
      individuals: 4,
      decreaseCount: 0,
      addOrDeleteCount: 2,
      addOrDeleteAction: 'إضافة',
      nameConfidence: 0.99,
      numbersConfidence: 0.99,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '',
    },
    0,
    { persons }
  );
  const rowUpdate = evaluateExtractedRow(
    {
      rowIndex: 2,
      pageNumber: 1,
      name: 'سعد كريم جاسم',
      individuals: 5,
      decreaseCount: 1,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.99,
      numbersConfidence: 0.99,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '',
    },
    1,
    { persons }
  );
  const rowExcluded = evaluateExtractedRow(
    {
      rowIndex: 3,
      pageNumber: 1,
      name: 'مهدي صالح',
      individuals: 3,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.99,
      numbersConfidence: 0.99,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '',
    },
    2,
    { persons }
  );

  assert.equal(
    evaluateRoutingRuleCondition(
      rowAdd,
      {
        id: 'r1',
        label: 'إضافات',
        enabled: true,
        condition: 'has_addition',
        mergeStrategy: 'add_new',
        destination: {
          kind: 'existing_ready_list',
          agencyId: 1,
          existingReadyListId: 77,
          readyListMeta: { name: '', listDate: '2026-05-01', subtitle1: '', subtitle2: '', autoUpdateDate: false },
        },
      },
      persons
    ),
    true
  );

  const routing: QuickExtractRoutingConfig = {
    mode: 'custom_rules',
    mergeStrategy: 'update_matched',
    primaryDestination: {
      kind: 'agency',
      agencyId: 2,
      mergeStrategy: 'update_matched',
      readyListMeta: { name: '', listDate: '2026-05-01', subtitle1: '', subtitle2: '', autoUpdateDate: false },
    },
    additionsDestination: {
      kind: 'ready_list',
      agencyId: 1,
      readyListMeta: { name: '', listDate: '2026-05-01', subtitle1: '', subtitle2: '', autoUpdateDate: false },
    },
    decreasesDestination: {
      kind: 'agency',
      agencyId: 1,
      readyListMeta: { name: '', listDate: '2026-05-01', subtitle1: '', subtitle2: '', autoUpdateDate: false },
    },
    customRules: [
      {
        id: 'rule-add',
        label: 'كل سجل فيه إضافة -> قائمة إضافات الخط الأول',
        enabled: true,
        condition: 'has_addition',
        mergeStrategy: 'add_new',
        destination: {
          kind: 'existing_ready_list',
          agencyId: 1,
          existingReadyListId: 77,
          mergeStrategy: 'add_new',
          readyListMeta: { name: '', listDate: '2026-05-01', subtitle1: '', subtitle2: '', autoUpdateDate: false },
        },
      },
    ],
    rowOverrides: {
      [rowExcluded.id]: { excluded: true },
    },
  };

  const plan = computeQuickExtractRoutingPlan({
    rows: [rowAdd, rowUpdate, rowExcluded],
    routing,
    agencies,
    persons,
    readyLists,
  });

  assert.equal(plan.items.length, 3);
  assert.equal(plan.items[0].destination.kind, 'existing_ready_list');
  assert.equal(plan.items[0].destination.existingReadyListId, 77);
  assert.equal(plan.items[0].actionType, 'add_new');
  assert.equal(plan.items[0].finalIndividuals, 6);

  assert.equal(plan.items[1].destination.kind, 'agency');
  assert.equal(plan.items[1].destination.agencyId, 2);
  assert.equal(plan.items[1].actionType, 'update_matched');
  assert.equal(plan.items[1].finalIndividuals, 4);

  assert.equal(plan.items[2].actionType, 'skip_unmatched');
  assert.equal(plan.counts.add, 1);
  assert.equal(plan.counts.update, 1);
  assert.equal(plan.counts.skip, 1);
});

test('Unified capabilities keep table/category/bulk permissions open and respect no-confirm override', () => {
  const defaultStrict = getModeCapabilities('beginner', false, false, true, true);
  assert.equal(defaultStrict.isExpertMode, true);
  assert.equal(defaultStrict.canCustomizeColumns, true);
  assert.equal(defaultStrict.canManageCustomCategories, true);
  assert.equal(defaultStrict.canBulkEdit, true);
  assert.equal(defaultStrict.canBypassEditConfirm, false);
  assert.equal(defaultStrict.requireEditConfirm, true);
  assert.equal(defaultStrict.requireDeleteConfirm, true);

  const selectiveConfirm = getModeCapabilities('professional', true, false, false, true);
  assert.equal(selectiveConfirm.canCustomizeColumns, true);
  assert.equal(selectiveConfirm.canBypassEditConfirm, false);
  assert.equal(selectiveConfirm.requireEditConfirm, false);
  assert.equal(selectiveConfirm.requireDeleteConfirm, true);

  const directFastSave = getModeCapabilities('expert', false, true, true, true);
  assert.equal(directFastSave.canBypassEditConfirm, true);
  assert.equal(directFastSave.requireEditConfirm, false);
  assert.equal(directFastSave.requireDeleteConfirm, false);
});

test('applyFeeRules and computeAgencyMetrics respect discount, rounding step, and includeBlockedInFees', () => {
  const settings = {
    ...DEFAULT_CALCULATION_SETTINGS,
    feePerIndividualIqd: 200,
    fixedCardFeeIqd: 250,
    discountPercent: 10,
    roundingStepIqd: 250,
    includeBlockedInFees: true,
  };

  // Raw for 5 individuals: 5*200 + 250 = 1250 -> 10% off = 1125 -> nearest 250 = 1250 (Math.round(4.5)*250 = 1250)
  // Raw for 4 individuals: 4*200 + 250 = 1050 -> 10% off = 945 -> nearest 250 = 1000
  assert.equal(applyFeeRules(1050, settings), 1000);
  assert.equal(calculateAllocation(4, settings)?.priceIqd, 1000);

  const fullBlocked: Person[] = [
    {
      id: 901,
      agencyId: 1,
      name: 'حسن طارق',
      nationalId: '',
      individuals: 5,
      blockType: 'full',
      blockedIndividuals: 5,
      blockReason: 'موقوف',
      status: 'محجوب',
      notes: '',
      updatedAt: '2026-01-01',
    },
  ];
  const effIncluded = getEffectiveAllocationForPerson(fullBlocked[0], settings);
  assert.equal(effIncluded.eligibleIndividuals, 0);
  assert.equal(
    effIncluded.priceIqd,
    applyFeeRules(settings.fixedCardFeeIqd, settings)
  );

  const metricsExcluded = computeAgencyMetrics(fullBlocked, [], {
    ...settings,
    includeBlockedInFees: false,
  });
  const metricsIncluded = computeAgencyMetrics(fullBlocked, [], settings);
  assert.equal(metricsExcluded.revenue, 0);
  assert.ok(metricsIncluded.revenue > 0);
});

test('evaluateExtractedRow and buildSafeQuickExtractResult respect focusedFields and fast vs audit modes', () => {
  const rowNamesOnly = evaluateExtractedRow(
    {
      rowIndex: 1,
      pageNumber: 1,
      name: 'علي حسن كاظم',
      individuals: null,
      decreaseCount: null,
      addOrDeleteCount: null,
      addOrDeleteAction: 'غير محدد',
      nameConfidence: 0.96,
      numbersConfidence: 0.4,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '',
    },
    0,
    { focusedFields: ['name'], scanMode: 'audit' }
  );
  // Missing numeric fields are ignored when only 'name' is focused
  assert.deepEqual(rowNamesOnly.missingFields, []);
  assert.equal(rowNamesOnly.isComplete, true);
  assert.equal(rowNamesOnly.hasDoubt, false);

  const rowFast = evaluateExtractedRow(
    {
      rowIndex: 2,
      pageNumber: 1,
      name: 'كاظم عباس',
      individuals: 5,
      decreaseCount: 0,
      addOrDeleteCount: 0,
      addOrDeleteAction: 'لا يوجد',
      nameConfidence: 0.85,
      numbersConfidence: 0.82,
      modelDoubtFlag: false,
      modelDoubtReason: '',
      rawSnippet: '',
    },
    1,
    { focusedFields: ['name', 'individuals'], scanMode: 'fast' }
  );
  assert.equal(rowFast.hasDoubt, false);

  const fastDoc = buildSafeQuickExtractResult({
    sourceMode: 'camera_burst',
    scanMode: 'fast',
    focusedFields: ['name', 'individuals'],
    legibilityStatus: 'clear',
    clarityScore: 42,
    clarityThreshold: 55,
    pageCount: 1,
    rejectionReasons: [],
    documentSummary: 'اختبار الوضع السريع',
    rawRows: [
      {
        rowIndex: 1,
        pageNumber: 1,
        name: 'حسين فاضل جاسم',
        individuals: 4,
        decreaseCount: null,
        addOrDeleteCount: null,
        addOrDeleteAction: 'لا يوجد',
        nameConfidence: 0.94,
        numbersConfidence: 0.93,
        modelDoubtFlag: false,
        modelDoubtReason: '',
        rawSnippet: '',
      },
    ],
  });
  // Fast mode uses lower clarity threshold floor so clarityScore 42 is accepted
  assert.notEqual(fastDoc.status, 'rejected');
  assert.equal(fastDoc.rows.length, 1);
  assert.equal(fastDoc.rows[0].isComplete, true);
});

test('Safe Recycle Bin restores deleted persons and moveExpertColumnInOrder shifts RTL columns', () => {
  const basePerson = INITIAL_DATABASE_STATE.persons[0];
  const bin = pushRecycleBinEntry([], {
    kind: 'person',
    label: basePerson.name,
    payload: { kind: 'person', person: basePerson },
  });
  assert.equal(bin.length, 1);

  const withoutPerson = {
    ...INITIAL_DATABASE_STATE,
    persons: INITIAL_DATABASE_STATE.persons.filter((p) => p.id !== basePerson.id),
    recycleBin: bin,
  };
  assert.equal(
    withoutPerson.persons.some((p) => p.id === basePerson.id),
    false
  );

  const restored = restoreRecycleBinEntryFromState(withoutPerson, bin[0].id);
  assert.equal(
    restored.persons.some((p) => p.id === basePerson.id),
    true
  );
  assert.equal(restored.recycleBin?.length, 0);

  const cfg = {
    visibleColumns: ['serial', 'name', 'individuals'],
    columnOrder: ['serial', 'name', 'individuals'],
    columnLabels: {},
    customCategories: [],
    customColumns: [],
    allowDirectNoConfirmEdit: false,
  };
  const movedLeft = moveExpertColumnInOrder(cfg, 'name', 'left');
  assert.deepEqual(movedLeft.columnOrder, ['serial', 'individuals', 'name']);
  const movedRight = moveExpertColumnInOrder(movedLeft, 'name', 'right');
  assert.deepEqual(movedRight.columnOrder, ['serial', 'name', 'individuals']);
});

