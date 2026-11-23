import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CALCULATION_SETTINGS,
  formatTotalQuota,
} from './agencyLogic.ts';
import {
  buildMorrowHierarchyTree,
  getHierarchyNodeById,
  getHierarchyPath,
  registerHierarchyExtension,
  resolveActiveHierarchyNodeId,
  searchHierarchyNodes,
} from './hierarchyRegistry.ts';
import {
  applyExpertColumnPreset,
  deleteCustomExpertColumnPreset,
  moveExpertColumnToEdge,
  reorderExpertColumnsByDrag,
  saveCustomExpertColumnPreset,
  setExpertColumnRank,
} from './recycleBin.ts';
import {
  computeSelectionAggregates,
  formatSelectedRecordsCopy,
} from './selectionActions.ts';
import {
  DEFAULT_EXPERT_COLUMN_PRESETS,
  DEFAULT_EXPERT_TABLE_CONFIG,
  INITIAL_DATABASE_STATE,
} from '../data/seedData.ts';
import type { SelectablePersonRecord } from '../components/SelectionActionBar.tsx';

test('hierarchyRegistry builds multi-level pyramid tree, resolves active nodes, and finds deep tools with Arabic search', () => {
  const tree = buildMorrowHierarchyTree(INITIAL_DATABASE_STATE.agencies);
  assert.equal(tree.level, 1);
  assert.equal(tree.id, 'root');
  assert.ok(tree.children.length >= 6);

  const customizerNode = getHierarchyNodeById(tree, 'column_customizer_node');
  assert.ok(customizerNode);
  assert.equal(customizerNode.level, 3);
  assert.equal(customizerNode.target.openColumnCustomizer, true);

  const path = getHierarchyPath(tree, 'settings_appearance_node');
  assert.equal(path.length, 3);
  assert.deepEqual(
    path.map((n) => n.id),
    ['root', 'settings_hub_node', 'settings_appearance_node']
  );

  const activeCustomId = resolveActiveHierarchyNodeId({
    activeView: 'master_roster',
    columnCustomizerOpen: true,
  });
  assert.equal(activeCustomId, 'column_customizer_node');

  const activeAgencyId = resolveActiveHierarchyNodeId({
    activeView: 'agency_roster',
    selectedAgencyId: INITIAL_DATABASE_STATE.agencies[0].id,
    columnCustomizerOpen: false,
  });
  assert.equal(
    activeAgencyId,
    `agency_node_${INITIAL_DATABASE_STATE.agencies[0].id}`
  );

  // Normalized Arabic search across Level 3 tools
  const hitsAppearance = searchHierarchyNodes(tree, 'استوديو المظهر');
  assert.ok(hitsAppearance.some((h) => h.node.id === 'settings_appearance_node'));

  const hitsColumns = searchHierarchyNodes(tree, 'ترتيب الاعمدة');
  assert.ok(hitsColumns.some((h) => h.node.id === 'column_customizer_node'));
});

test('registerHierarchyExtension attaches and cleans up nested runtime nodes cleanly', () => {
  const unregister = registerHierarchyExtension({
    parentId: 'settings_hub_node',
    node: {
      id: 'ext_audit_lab_node',
      title: 'مختبر التدقيق الإضافي',
      subtitle: 'أداة قابلة للتمديد الفوري',
      keywords: ['مختبر', 'تمديد'],
      category: 'tools',
      target: { view: 'quick_extract' },
    },
  });

  try {
    const treeWithExt = buildMorrowHierarchyTree(INITIAL_DATABASE_STATE.agencies);
    const attached = getHierarchyNodeById(treeWithExt, 'ext_audit_lab_node');
    assert.ok(attached);
    assert.equal(attached.level, 3);
    assert.equal(attached.parentId, 'settings_hub_node');

    const hits = searchHierarchyNodes(treeWithExt, 'مختبر');
    assert.ok(hits.some((h) => h.node.id === 'ext_audit_lab_node'));
  } finally {
    unregister();
  }

  const cleanTree = buildMorrowHierarchyTree(INITIAL_DATABASE_STATE.agencies);
  assert.equal(getHierarchyNodeById(cleanTree, 'ext_audit_lab_node'), null);
});

test('expert column reordering supports rank selection, start/end edges, drag reorder, presets, and built-in protection', () => {
  let cfg = { ...DEFAULT_EXPERT_TABLE_CONFIG };

  // Move 'notes' to position #2 (1-based)
  cfg = setExpertColumnRank(cfg, 'notes', 2);
  assert.equal(cfg.columnOrder[1], 'notes');
  assert.equal(cfg.activePresetId, null);

  // Move 'price' to start and 'letter' to end
  cfg = moveExpertColumnToEdge(cfg, 'price', 'start');
  assert.equal(cfg.columnOrder[0], 'price');

  cfg = moveExpertColumnToEdge(cfg, 'letter', 'end');
  assert.equal(cfg.columnOrder[cfg.columnOrder.length - 1], 'letter');

  // Drag & drop 'status' onto index of 'name'
  const nameIdxBefore = cfg.columnOrder.indexOf('name');
  cfg = reorderExpertColumnsByDrag(cfg, 'status', 'name');
  assert.equal(cfg.columnOrder[nameIdxBefore], 'status');

  // Apply built-in field preset
  const fieldPreset = DEFAULT_EXPERT_COLUMN_PRESETS.find(
    (p) => p.id === 'preset_field_dist'
  );
  assert.ok(fieldPreset);
  cfg = applyExpertColumnPreset(cfg, fieldPreset);
  assert.equal(cfg.activePresetId, 'preset_field_dist');
  assert.deepEqual(cfg.visibleColumns, fieldPreset.visibleColumns);

  // Save custom preset & delete custom vs protect built-in
  cfg = saveCustomExpertColumnPreset(cfg, 'قالب الميدان المخصص');
  const savedId = cfg.activePresetId!;
  assert.ok(savedId.startsWith('custom_preset_'));
  assert.ok(cfg.columnPresets?.some((p) => p.id === savedId));

  // Built-in preset must remain protected
  const afterAttemptBuiltinDelete = deleteCustomExpertColumnPreset(
    cfg,
    'preset_default'
  );
  assert.ok(
    afterAttemptBuiltinDelete.columnPresets?.some(
      (p) => p.id === 'preset_default'
    )
  );

  // Custom preset deletes cleanly
  const afterCustomDelete = deleteCustomExpertColumnPreset(cfg, savedId);
  assert.equal(
    afterCustomDelete.columnPresets?.some((p) => p.id === savedId),
    false
  );
  assert.equal(afterCustomDelete.activePresetId, null);
});

test('selectionActions computes exact multi-metric aggregates (bags, remainder kg, IQD) honoring dynamic formula & block scopes', () => {
  const settings = {
    ...DEFAULT_CALCULATION_SETTINGS,
    kgPerIndividual: 9,
    kgPerBag: 50,
    feePerIndividualIqd: 1000,
    fixedCardFeeIqd: 1000,
  };

  const sample: SelectablePersonRecord[] = [
    {
      selectionKey: 'p1',
      personId: 1,
      name: 'حسن كريم',
      agencyId: 1,
      agencyName: 'وكالة 1',
      nationalId: '101',
      individuals: 6, // 6 * 9 = 54kg; fee = 6000 + 1000 = 7000
      blockType: 'none',
      blockedIndividuals: 0,
      blockReason: '',
      status: '',
      notes: 'توصيل مبكر',
      updatedAt: '2026-04-01',
    },
    {
      selectionKey: 'p2',
      personId: 2,
      name: 'زينب علي',
      agencyId: 1,
      agencyName: 'وكالة 1',
      nationalId: '102',
      individuals: 5,
      blockType: 'partial',
      blockedIndividuals: 2, // eligible = 3 -> 27kg; fee = 3000 + 1000 = 4000
      blockReason: 'مسافر',
      status: '',
      notes: '',
      updatedAt: '2026-04-01',
    },
    {
      selectionKey: 'p3',
      personId: 3,
      name: 'محمود جاسم',
      agencyId: 1,
      agencyName: 'وكالة 1',
      nationalId: '103',
      individuals: 4,
      blockType: 'full',
      blockedIndividuals: 4, // eligible = 0 -> 0kg; fee = 0
      blockReason: 'موقوف',
      status: '',
      notes: '',
      updatedAt: '2026-04-01',
    },
  ];

  const agg = computeSelectionAggregates(sample, settings);
  assert.equal(agg.count, 3);
  assert.equal(agg.activeRecordsCount, 2);
  assert.equal(agg.blockedRecordsCount, 1);
  assert.equal(agg.totalRawIndividuals, 15);
  assert.equal(agg.totalEligibleIndividuals, 9);
  assert.equal(agg.totalKg, 81);
  assert.equal(agg.fullBags, 1);
  assert.equal(agg.remainderKg, 31);
  assert.equal(agg.totalPriceIqd, 11000);
  assert.equal(agg.quotaLabel, formatTotalQuota(81, settings));

  const namesCopy = formatSelectedRecordsCopy(sample, 'names_only', settings);
  assert.equal(namesCopy, '1. حسن كريم\n2. زينب علي\n3. محمود جاسم');

  const tableCopy = formatSelectedRecordsCopy(sample, 'details_table', settings);
  assert.ok(tableCopy.includes('حسن كريم'));
  assert.ok(tableCopy.includes('9 فرد'));

  const shareCopy = formatSelectedRecordsCopy(sample, 'share_summary', settings, {
    title: 'كشف التوزيع السريع',
    date: '2026-04-01',
  });
  assert.ok(shareCopy.includes('كشف التوزيع السريع'));
  assert.ok(shareCopy.includes('11,000'));
});
