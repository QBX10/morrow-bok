import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMemoryKeyValueStore,
  createTenantStorageDriver,
  getCleanTenantInitialState,
  getTenantLocalFallbackKey,
  getTenantOnboardingKey,
  getTenantWorkspaceKey,
} from './tenantStorage.ts';

test('tenantStorage isolates workspace records strictly per uid with pre-save compression', async () => {
  const kvStore = createMemoryKeyValueStore();
  const driver = createTenantStorageDriver(kvStore);

  const uidAlpha = 'uid_alpha_001';
  const uidBeta = 'uid_beta_002';

  assert.equal(getTenantWorkspaceKey(uidAlpha), 'users/uid_alpha_001/workspace');
  assert.equal(getTenantLocalFallbackKey(uidAlpha), 'morrow_db_user_uid_alpha_001');
  assert.equal(getTenantOnboardingKey(uidAlpha), 'morrow_onboarding_done_uid_alpha_001');
  assert.equal(getTenantOnboardingKey(null), 'morrow_onboarding_done_guest');

  // Create rich workspace state for User A
  const stateAlpha = getCleanTenantInitialState(uidAlpha);
  stateAlpha.agencies = [
    { id: 101, name: 'وكالة ألفا الخاصة', icon: '🌾', isLocked: false },
    { id: 102, name: 'وكالة دجلة الفرعية', icon: '🏪', isLocked: false },
  ];
  stateAlpha.persons = Array.from({ length: 18 }, (_, i) => ({
    id: i + 1,
    agencyId: i % 2 === 0 ? 101 : 102,
    name: `مستفيد ألفا ${i + 1}`,
    nationalId: `9001${i}`,
    individuals: 4,
    blockType: 'none',
    blockedIndividuals: 0,
    blockReason: '',
    status: '',
    notes: 'بيانات خاصة بالمستخدم الأول فقط',
    updatedAt: '2026-11-24',
  }));

  const saveStatsAlpha = await driver.saveTenantWorkspace(uidAlpha, stateAlpha);
  assert.equal(saveStatsAlpha.algorithm, 'gzip');
  assert.ok(saveStatsAlpha.savingsPct >= 50);

  // User B has never logged in before -> MUST see null (no stored data) and clean empty initial state
  const loadedBetaBefore = await driver.loadTenantWorkspace(uidBeta);
  assert.equal(loadedBetaBefore, null);

  const cleanBeta = getCleanTenantInitialState(uidBeta);
  assert.equal(cleanBeta.agencies.length, 0);
  assert.equal(cleanBeta.persons.length, 0);
  assert.equal(cleanBeta.expenses.length, 0);
  assert.equal(cleanBeta.darkTheme, true);
  assert.equal(cleanBeta.themePrefs?.appTheme, 'obsidian-gold');

  // User B saves their own distinct 1-agency workspace
  cleanBeta.agencies = [
    { id: 999, name: 'وكالة بيتا المستقلة', icon: '📦', isLocked: false },
  ];
  await driver.saveTenantWorkspace(uidBeta, cleanBeta);

  // Reloading User A returns exact User A agencies & persons with 0 cross-tenant contamination
  const reloadedAlpha = await driver.loadTenantWorkspace(uidAlpha);
  assert.ok(reloadedAlpha);
  assert.equal(reloadedAlpha.state.agencies.length, 2);
  assert.equal(reloadedAlpha.state.agencies[0].name, 'وكالة ألفا الخاصة');
  assert.equal(reloadedAlpha.state.persons.length, 18);

  // Reloading User B returns exact User B agency with 0 agencies from User A
  const reloadedBeta = await driver.loadTenantWorkspace(uidBeta);
  assert.ok(reloadedBeta);
  assert.equal(reloadedBeta.state.agencies.length, 1);
  assert.equal(reloadedBeta.state.agencies[0].name, 'وكالة بيتا المستقلة');
  assert.equal(reloadedBeta.state.persons.length, 0);

  // Deleting User A does not affect User B
  await driver.clearTenantWorkspace(uidAlpha);
  assert.equal(await driver.loadTenantWorkspace(uidAlpha), null);
  const betaAfterAlphaDelete = await driver.loadTenantWorkspace(uidBeta);
  assert.ok(betaAfterAlphaDelete);
  assert.equal(betaAfterAlphaDelete.state.agencies[0].id, 999);
});
