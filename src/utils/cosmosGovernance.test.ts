import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_GENERAL_PREFS,
  DEFAULT_WORKSPACE_COSMOS,
  INITIAL_DATABASE_STATE,
} from '../data/seedData.ts';
import type { AssistantUiContext } from '../types/assistant.ts';
import { DEFAULT_CALCULATION_SETTINGS } from './agencyLogic.ts';
import {
  executeApprovedToolMutation,
  resolveToolExecution,
} from './assistantExecutor.ts';
import { runOfflineBrain } from './assistantOfflineBrain.ts';
import { buildBeforeAfterDiff, validateToolCall } from './assistantTools.ts';
import {
  buildCosmosRegistry,
  createFeatureKitNode,
  LEGACY_KEY_MAP,
  RUNTIME_COSMOS_EXTENSIONS,
  searchCosmosNodes,
  validateRegistryGovernance,
  verifyLegacyCoverage,
} from './cosmosRegistry.ts';
import {
  ALL_APP_THEMES,
  APP_THEMES,
  ARABIC_FONTS,
  MODERN_APP_THEMES,
  TABLE_THEMES,
} from './themes.ts';

function makeContext(feePerIndividualIqd = 200): AssistantUiContext {
  return {
    activeView: 'hub',
    selectedAgencyId: null,
    focusedPersonId: null,
    modeTier: INITIAL_DATABASE_STATE.modeTier,
    themeId: INITIAL_DATABASE_STATE.themePrefs?.appTheme || 'arctic-snow',
    agencies: INITIAL_DATABASE_STATE.agencies.map((a) => ({
      id: a.id,
      name: a.name,
    })),
    readyLists: INITIAL_DATABASE_STATE.readyLists.map((l) => ({
      id: l.id,
      name: l.name,
      agencyId: l.agencyId,
    })),
    preferences: [],
    lastBackupAt: new Date().toISOString(),
    totalPersonsCount: INITIAL_DATABASE_STATE.persons.length,
    ...({ feePerIndividualIqd } as Record<string, unknown>),
  };
}

test('verifyLegacyCoverage ensures 0 deletions across every legacy key and protected zone', () => {
  const root = buildCosmosRegistry(INITIAL_DATABASE_STATE.agencies);
  const report = verifyLegacyCoverage(root);

  assert.equal(report.passed, true);
  assert.equal(report.missingLegacyKeys.length, 0);
  assert.ok(report.totalLegacyKeys >= LEGACY_KEY_MAP.length);
  assert.ok(report.protectedZonesCount >= 1);
});

test('validateRegistryGovernance enforces 14 worlds, depth <= 4, <= 6 capsules per galaxy, 0 duplicates/orphans', () => {
  const root = buildCosmosRegistry(INITIAL_DATABASE_STATE.agencies);
  const gov = validateRegistryGovernance(root);

  assert.equal(gov.passed, true, gov.violations.map((v) => v.message).join(' | '));
  assert.equal(gov.worldCount, 14);
  assert.equal(gov.violations.length, 0);
  assert.ok(gov.galaxyCount >= 14);
  assert.ok(gov.capsuleCount >= 20);
});

test('Feature Kit dynamically adds a new capsule and indexes it in natural search', () => {
  const sampleKit = createFeatureKitNode({
    id: 'cap_test_feature_kit',
    title: 'تصدير مخصص عبر البريد السحابي',
    icon: 'file_json',
    parentId: 'gal_ai_hub',
    worldId: 'world_morrow_ai',
    keywords: ['بريد', 'تصدير سحابي', 'ارسال'],
    target: { view: 'morrow_center', morrowTab: 'chat' },
    tags: ['تصدير', 'ذكاء'],
  });

  RUNTIME_COSMOS_EXTENSIONS.push(sampleKit);
  try {
    const root = buildCosmosRegistry(INITIAL_DATABASE_STATE.agencies);
    const hits = searchCosmosNodes(root, 'تصدير سحابي');
    assert.ok(hits.some((h) => h.node.id === 'cap_test_feature_kit'));
    const gov = validateRegistryGovernance(root);
    assert.equal(gov.passed, true);
  } finally {
    const idx = RUNTIME_COSMOS_EXTENSIONS.findIndex(
      (x) => x.id === 'cap_test_feature_kit'
    );
    if (idx >= 0) RUNTIME_COSMOS_EXTENSIONS.splice(idx, 1);
  }
});

test('natural Arabic & Iraqi dialect search ("وين هذا؟") finds key worlds and capsules', () => {
  const root = buildCosmosRegistry(INITIAL_DATABASE_STATE.agencies);

  const queries = [
    { q: 'أبي أغير لون الجدول', expectedWorld: 'world_themes' },
    { q: 'وين رسم الفرد', expectedWorld: 'world_calculator' },
    { q: 'قفل برقم سري', expectedWorld: 'world_security_backup' },
    { q: 'مؤشرات الأداء', expectedWorld: 'world_health_kpi' },
  ];

  for (const item of queries) {
    const hits = searchCosmosNodes(root, item.q);
    assert.ok(
      hits.length > 0,
      `Expected search hits for query "${item.q}"`
    );
    assert.ok(
      hits.some((h) => h.node.worldId === item.expectedWorld),
      `Expected world "${item.expectedWorld}" in hits for "${item.q}"`
    );
  }
});

test('preserves Frozen Zone themes, fonts, and safe migration/default settings', () => {
  assert.equal(APP_THEMES.length, 8);
  assert.equal(MODERN_APP_THEMES.length, 4);
  assert.equal(ALL_APP_THEMES.length, 12);
  assert.equal(TABLE_THEMES.length, 8);
  assert.equal(ARABIC_FONTS.length, 6);

  assert.equal(DEFAULT_CALCULATION_SETTINGS.feePerIndividualIqd, 250);
  assert.equal(DEFAULT_GENERAL_PREFS.settingsDisplayMode, 'fullscreen');
  assert.equal(DEFAULT_WORKSPACE_COSMOS.accessibility.numeralSystem, 'western');
  assert.equal(INITIAL_DATABASE_STATE.stateVersion, 3);
});

test('assistant handles natural fee change "خلّي رسم الفرد 250" via update_settings update_calc with Before/After diff', () => {
  const state = structuredClone(INITIAL_DATABASE_STATE);
  state.calculationSettings = {
    ...DEFAULT_CALCULATION_SETTINGS,
    feePerIndividualIqd: 200,
  };
  const uiContext = makeContext(200);

  const offline = runOfflineBrain({
    prompt: 'خلّي رسم الفرد 250',
    state,
    uiContext,
  });
  assert.equal(offline.handled, true);
  assert.ok(offline.toolCall);
  assert.equal(offline.toolCall?.name, 'update_settings');
  assert.equal(offline.toolCall?.args.action, 'update_calc');
  assert.equal(offline.toolCall?.args.feePerIndividualIqd, 250);

  const validated = validateToolCall(offline.toolCall!);
  assert.equal(validated.valid, true);

  const diff = buildBeforeAfterDiff(state, offline.toolCall!, null);
  assert.ok(diff);
  assert.ok(
    diff.changes.some(
      (c) => c.beforeValue.includes('200') && c.afterValue.includes('250')
    )
  );

  let savedFee = 0;
  const runtime = {
    state,
    uiContext,
    mutations: {
      addPersonDirect: () => {},
      updatePersonConfirmed: () => {},
      createReadyList: () => 1,
      addPersonsToReadyList: () => 0,
      addExpense: () => {},
      upsertRelationEntry: () => {},
    },
    navigate: () => {},
    selectAgency: () => {},
    focusPerson: () => {},
    issueTableCommand: () => {},
    setModeTier: () => {},
    setAppTheme: () => {},
    setDarkTheme: () => {},
    setAllowCloudNames: () => {},
    saveCalculationSettings: (next: typeof state.calculationSettings) => {
      savedFee = next.feePerIndividualIqd;
    },
    saveUserPref: () => {},
    deleteUserPref: () => {},
    applyAutoFixes: () => ({ fixedCount: 0, summaryLines: [] }),
    exportBackupJson: () => {},
    archiveCurrentPeriod: () => {},
    triggerSpotlight: () => {},
  };

  const res = resolveToolExecution(offline.toolCall!, runtime);

  assert.ok(res.confirmationDiff);

  executeApprovedToolMutation(offline.toolCall!, runtime);

  assert.equal(savedFee, 250);
});
