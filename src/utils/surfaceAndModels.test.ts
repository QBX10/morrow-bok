import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SURFACE_2D_PREFS,
  SURFACE_2D_THEMES,
  buildAmbientBackdropLayers,
  computeHubDialTelemetry,
  computeReadableForeground,
  getDensityPaddingClass,
  getMotion2DConfig,
  getSurfaceThemeDef,
  getViewBackdropPreset,
  mapAppThemeToSurfaceTheme,
  mapSurfaceThemeToAppTheme,
  normalizeHexColor,
  normalizeUsernameInput,
  resolveActiveSurfacePalette,
  resolveMorrowCompanionState,
  resolveSurface2DPrefs,
  validateAuthUsername,
} from './surface2dConfig.ts';
import { shouldFireTactileEvent } from './tactileFeedback.ts';
import {
  SMART_MODELS_CATALOG,
  SMART_TASK_CHIPS,
  executeSmartModelTask,
} from './smartModelsEngine.ts';
import { INITIAL_DATABASE_STATE } from '../data/seedData.ts';
import { getTabrixViewOrder } from './tabrixMotion.ts';

test('surface2dConfig resolves Obsidian & Gold default, migrates legacy keys, and rejects invalid overrides', () => {
  const resolvedDefault = resolveSurface2DPrefs(undefined);
  assert.deepEqual(resolvedDefault, DEFAULT_SURFACE_2D_PREFS);
  assert.equal(resolvedDefault.themeId, 'obsidian_gold');
  assert.equal(resolvedDefault.motionIntensity, 'subtle');
  assert.equal(resolvedDefault.cardDensity, 'balanced');

  const migratedLegacy = resolveSurface2DPrefs({
    // @ts-expect-error testing legacy migration value
    themeId: 'solar_obsidian_gold',
    tiltIntensity: 'dynamic',
  });
  assert.equal(migratedLegacy.themeId, 'obsidian_gold');
  assert.equal(migratedLegacy.motionIntensity, 'dynamic');

  const resolvedCustom = resolveSurface2DPrefs({
    themeId: 'royal_amethyst',
    motionIntensity: 'dynamic',
    cardDensity: 'spacious',
    customColors: {
      accent: '#ff6600',
      secondary: '38bdf8',
      surfaceTone: 'midnight',
    },
  });
  assert.equal(resolvedCustom.themeId, 'royal_amethyst');
  assert.equal(resolvedCustom.motionIntensity, 'dynamic');
  assert.equal(resolvedCustom.cardDensity, 'spacious');
  assert.equal(resolvedCustom.customColors?.accent, '#FF6600');
  assert.equal(resolvedCustom.customColors?.secondary, '#38BDF8');
  assert.equal(resolvedCustom.customColors?.surfaceTone, 'midnight');

  const fallback = resolveSurface2DPrefs({
    // @ts-expect-error testing invalid runtime values
    themeId: 'unknown_theme',
    // @ts-expect-error testing invalid runtime values
    motionIntensity: 'extreme',
    customColors: {
      accent: 'not-a-hex',
    },
  });
  assert.equal(fallback.themeId, 'obsidian_gold');
  assert.equal(fallback.motionIntensity, 'subtle');
  assert.equal(fallback.customColors, undefined);
});

test('surface2d theme catalog, Obsidian & Gold tokens, custom color palette, and WCAG contrast map cleanly', () => {
  assert.equal(Object.keys(SURFACE_2D_THEMES).length, 7);

  const obsidianGold = getSurfaceThemeDef('obsidian_gold');
  assert.equal(obsidianGold.accent, '#D4AF37');
  assert.equal(obsidianGold.bgMain, '#070708');
  assert.equal(obsidianGold.bgSurface, '#101012');

  const theme = getSurfaceThemeDef('crimson_obsidian');
  assert.equal(theme.accent, '#2DD4BF');
  assert.equal(theme.secondary, '#34D399');

  const autoTheme = getSurfaceThemeDef('auto_adaptive');
  assert.equal(autoTheme.isAuto, true);

  assert.equal(mapAppThemeToSurfaceTheme('obsidian-gold'), 'obsidian_gold');
  assert.equal(mapSurfaceThemeToAppTheme('obsidian_gold'), 'obsidian-gold');

  assert.equal(normalizeHexColor('abc'), null);
  assert.equal(normalizeHexColor('#10b981'), '#10B981');
  assert.equal(computeReadableForeground('#FFFFFF'), '#041216');
  assert.equal(computeReadableForeground('#0F172A'), '#FFFFFF');

  const palette = resolveActiveSurfacePalette({
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
  assert.equal(palette.bgMain, '#070708');
  assert.equal(palette.accentFg, '#041216');

  assert.equal(getMotion2DConfig('off').enabled, false);
  assert.equal(getMotion2DConfig('subtle').liftPx, 1.5);
  assert.equal(getMotion2DConfig('dynamic').liftPx, 3);

  assert.match(getDensityPaddingClass('compact'), /p-3\.5/);
  assert.match(getDensityPaddingClass('spacious'), /p-6/);
});

test('buildAmbientBackdropLayers and computeHubDialTelemetry produce valid deterministic 2D specs', () => {
  const slide0 = buildAmbientBackdropLayers({ themeId: 'holographic_cyan' }, 0, 'medium');
  const slide1 = buildAmbientBackdropLayers({ themeId: 'holographic_cyan' }, 1, 'medium');
  assert.equal(slide0.layers.length, 2);
  assert.equal(slide0.palette.accent, '#22D3EE');
  assert.notEqual(slide0.layers[0].animateX[0], slide1.layers[0].animateX[0]);

  const emptyHub = computeHubDialTelemetry(0, 0, 0);
  assert.equal(emptyHub.satelliteCount, 3);
  assert.equal(emptyHub.healthPct, 100);
  assert.equal(emptyHub.alertIntensity, 0);

  const activeHub = computeHubDialTelemetry(5, 450, 2);
  assert.equal(activeHub.satelliteCount, 5);
  assert.ok(activeHub.ringDurationSec < 26);
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

test('getViewBackdropPreset returns distinct 2D backdrop offsets across views', () => {
  const hubPreset = getViewBackdropPreset('hub');
  const morrowPreset = getViewBackdropPreset('morrow_center');
  const rosterPreset = getViewBackdropPreset('master_roster');

  assert.equal(hubPreset.offsetX, 0);
  assert.notEqual(morrowPreset.offsetX, hubPreset.offsetX);
  assert.notEqual(hubPreset.offsetY, rosterPreset.offsetY);
  assert.ok(morrowPreset.ringOpacity > rosterPreset.ringOpacity);
});

test('resolveMorrowCompanionState produces articulated 2D telemetry for greet, excited, and focus moods', () => {
  const greetIdle = resolveMorrowCompanionState('greet', 0, false);
  const excitedPulse = resolveMorrowCompanionState('excited', 2, true);
  const focusIdle = resolveMorrowCompanionState('focus', 1, false);

  assert.ok(excitedPulse.orbitDurationSec < focusIdle.orbitDurationSec);
  assert.ok(focusIdle.orbitDurationSec < greetIdle.orbitDurationSec);
  assert.ok(excitedPulse.breathAmplitudePx > focusIdle.breathAmplitudePx);
  assert.ok(excitedPulse.pulseScale > focusIdle.pulseScale);
  assert.ok(excitedPulse.ringOpacity > greetIdle.ringOpacity);
});

test('shouldFireTactileEvent enforces cooldown to prevent duplicate input focus/pointer chimes', () => {
  assert.equal(shouldFireTactileEvent(1000, 0, 85), true);
  assert.equal(shouldFireTactileEvent(1040, 1000, 85), false);
  assert.equal(shouldFireTactileEvent(1085, 1000, 85), true);
});
