import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SPATIAL_3D_PREFS,
  SPATIAL_3D_THEMES,
  buildGradientMeshLayers,
  computeHubOrbTelemetry,
  computeReadableForeground,
  getDensityPaddingClass,
  getSpatialThemeDef,
  getTiltConfig,
  normalizeHexColor,
  normalizeUsernameInput,
  resolveActiveSpatialPalette,
  resolveSpatial3DPrefs,
  validateAuthUsername,
} from './spatial3dConfig.ts';
import {
  SMART_MODELS_CATALOG,
  SMART_TASK_CHIPS,
  executeSmartModelTask,
} from './smartModelsEngine.ts';
import { INITIAL_DATABASE_STATE } from '../data/seedData.ts';
import { getTabrixViewOrder } from './tabrixMotion.ts';

test('spatial3dConfig resolves defaults and rejects invalid overrides safely', () => {
  const resolvedDefault = resolveSpatial3DPrefs(undefined);
  assert.deepEqual(resolvedDefault, DEFAULT_SPATIAL_3D_PREFS);

  const resolvedCustom = resolveSpatial3DPrefs({
    themeId: 'royal_amethyst',
    tiltIntensity: 'dynamic',
    cardDensity: 'spacious',
    customColors: {
      accent: '#ff6600',
      secondary: '38bdf8',
      surfaceTone: 'midnight',
    },
  });
  assert.equal(resolvedCustom.themeId, 'royal_amethyst');
  assert.equal(resolvedCustom.tiltIntensity, 'dynamic');
  assert.equal(resolvedCustom.cardDensity, 'spacious');
  assert.equal(resolvedCustom.customColors?.accent, '#FF6600');
  assert.equal(resolvedCustom.customColors?.secondary, '#38BDF8');
  assert.equal(resolvedCustom.customColors?.surfaceTone, 'midnight');

  const fallback = resolveSpatial3DPrefs({
    // @ts-expect-error testing invalid runtime values
    themeId: 'unknown_theme',
    // @ts-expect-error testing invalid runtime values
    tiltIntensity: 'extreme',
    customColors: {
      accent: 'not-a-hex',
    },
  });
  assert.equal(fallback.themeId, 'emerald_smoked');
  assert.equal(fallback.tiltIntensity, 'subtle');
  assert.equal(fallback.customColors, undefined);
});

test('spatial3d theme catalog, custom color palette, and WCAG contrast map cleanly', () => {
  assert.equal(Object.keys(SPATIAL_3D_THEMES).length, 6);
  const theme = getSpatialThemeDef('crimson_obsidian');
  assert.equal(theme.accent, '#F43F5E');
  assert.equal(theme.secondary, '#F59E0B');

  assert.equal(normalizeHexColor('abc'), null);
  assert.equal(normalizeHexColor('#10b981'), '#10B981');
  assert.equal(computeReadableForeground('#FFFFFF'), '#041216');
  assert.equal(computeReadableForeground('#0F172A'), '#FFFFFF');

  const palette = resolveActiveSpatialPalette({
    themeId: 'emerald_smoked',
    customColors: {
      accent: '#EAB308',
      secondary: '#EC4899',
      surfaceTone: 'obsidian',
    },
  });
  assert.equal(palette.isCustomized, true);
  assert.equal(palette.accent, '#EAB308');
  assert.equal(palette.secondary, '#EC4899');
  assert.equal(palette.bgMain, '#08080D');
  assert.equal(palette.accentFg, '#041216');
  assert.equal(palette.nodeColorHex, 0xeab308);
  assert.equal(palette.ringColorHex, 0xec4899);

  assert.equal(getTiltConfig('off').enabled, false);
  assert.equal(getTiltConfig('subtle').maxDeg, 2.2);
  assert.equal(getTiltConfig('dynamic').maxDeg, 4.5);

  assert.match(getDensityPaddingClass('compact'), /p-3\.5/);
  assert.match(getDensityPaddingClass('spacious'), /p-6/);
});

test('buildGradientMeshLayers and computeHubOrbTelemetry produce valid deterministic specs', () => {
  const slide0 = buildGradientMeshLayers({ themeId: 'holographic_cyan' }, 0, 'vibrant');
  const slide1 = buildGradientMeshLayers({ themeId: 'holographic_cyan' }, 1, 'vibrant');
  assert.equal(slide0.orbs.length, 4);
  assert.equal(slide0.palette.accent, '#22D3EE');
  assert.notEqual(slide0.orbs[0].animateX[0], slide1.orbs[0].animateX[0]);

  const emptyHub = computeHubOrbTelemetry(0, 0, 0);
  assert.equal(emptyHub.satelliteCount, 3);
  assert.equal(emptyHub.healthPct, 100);
  assert.equal(emptyHub.alertIntensity, 0);

  const activeHub = computeHubOrbTelemetry(5, 450, 2);
  assert.equal(activeHub.satelliteCount, 5);
  assert.ok(activeHub.ringSpinRate > 0.7);
  assert.ok(activeHub.healthPct < 100 && activeHub.healthPct >= 50);
  assert.ok(activeHub.alertIntensity > 0);
});

test('validateAuthUsername normalizes leading @ and enforces server-compatible rules', () => {
  assert.equal(normalizeUsernameInput('  @ali_1990  '), 'ali_1990');
  const validRes = validateAuthUsername('@ali_1990');
  assert.equal(validRes.valid, true);
  assert.equal(validRes.normalized, 'ali_1990');

  const tooShort = validateAuthUsername('ab');
  assert.equal(tooShort.valid, false);
  assert.ok(tooShort.error);

  const arabicChars = validateAuthUsername('محمد_علي');
  assert.equal(arabicChars.valid, false);
  assert.ok(arabicChars.error);
});

test('smartModelsEngine returns grounded multi-agency analysis and exports', () => {
  assert.equal(SMART_MODELS_CATALOG.length, 4);
  assert.equal(SMART_TASK_CHIPS.length, 4);

  const result = executeSmartModelTask({
    modelId: 'audit_inspector',
    taskChipId: 'diff_analysis',
    prompt: 'تحليل شامل للوكالات',
    params: {
      precisionLevel: 'forensic',
      speedMode: 'balanced',
      outputFormat: 'executive_grid',
    },
    state: INITIAL_DATABASE_STATE,
  });

  assert.equal(result.comparisonRows.length, INITIAL_DATABASE_STATE.agencies.length);
  assert.equal(result.kpis.length, 4);
  assert.ok(result.reasoningSteps.length >= 3);
  assert.ok(result.actionPlanSteps.length >= 3);
  assert.ok(result.latencyMs > 0);
  assert.ok(result.confidencePct >= 95);
  assert.match(result.exportMarkdown, /جدول مقارنة الوكالات/);
  assert.match(result.exportCsv, /الوكالة,العوائل,الأفراد_المستحقون/);
});

test('tabrixMotion VIEW_ORDER includes smart_models', () => {
  assert.ok(getTabrixViewOrder('smart_models') >= 0);
});
