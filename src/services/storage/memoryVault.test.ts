import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendAuditCheckpointEvents,
  createAuditCheckpointEvent,
  createMemoryVaultExport,
  MEMORY_VAULT_SCHEMA,
  parseMemoryVaultImport,
} from './memoryVault.ts';
import { getCleanTenantInitialState } from './tenantStorage.ts';

test('memoryVault exports checksummed morrow.memory.vault.v1 envelope and rejects tampering', () => {
  const state = getCleanTenantInitialState('uid_vault_01');
  state.agencies = [{ id: 7, name: 'وكالة الخزنة', icon: '🔐', isLocked: false }];
  state.smartPreferences = {
    activeView: 'finance',
    selectedAgencyId: 7,
    sidebarCollapsed: true,
    updatedAt: '2026-11-25T08:00:00.000Z',
  };

  const { envelope, jsonText } = createMemoryVaultExport(state);
  assert.equal(envelope.schema, MEMORY_VAULT_SCHEMA);
  assert.equal(envelope.summary.agenciesCount, 1);

  const parsed = parseMemoryVaultImport(jsonText);
  assert.equal(parsed.sourceKind, 'memory_vault_v1');
  assert.equal(parsed.checksumVerified, true);
  assert.equal(parsed.state.agencies?.[0]?.name, 'وكالة الخزنة');
  assert.equal(parsed.state.smartPreferences?.activeView, 'finance');

  // Tamper with state payload without updating checksum
  const tampered = JSON.parse(jsonText);
  tampered.state.agencies[0].name = 'وكالة معدلة بشكل غير شرعي';
  assert.throws(() => parseMemoryVaultImport(JSON.stringify(tampered)));

  // Legacy raw AppDatabaseState JSON compatibility
  const legacyParsed = parseMemoryVaultImport(JSON.stringify(state));
  assert.equal(legacyParsed.sourceKind, 'legacy_workspace_json');
  assert.equal(legacyParsed.state.agencies?.[0]?.id, 7);
});

test('appendAuditCheckpointEvents preserves history while capping heavy restorable slices', () => {
  const state = getCleanTenantInitialState('uid_audit_01');
  state.agencies = [{ id: 1, name: 'الوكالة ١', icon: '🌾', isLocked: false }];

  let log: ReturnType<typeof appendAuditCheckpointEvents> = [];
  for (let i = 1; i <= 20; i += 1) {
    const ev = createAuditCheckpointEvent({
      actionType: 'data_mutation',
      title: `تعديل رقم ${i}`,
      summary: `ملخص ${i}`,
      deviceId: 'dev_test',
      restorableState: state,
    });
    log = appendAuditCheckpointEvents(log, ev);
  }

  assert.equal(log.length, 20);
  const withSlices = log.filter((e) => Boolean(e.restorableData));
  assert.equal(withSlices.length, 16);
  assert.equal(log[0].title, 'تعديل رقم 20');
  assert.ok(log[0].restorableData);
  assert.equal(log[19].restorableData, undefined);
});
