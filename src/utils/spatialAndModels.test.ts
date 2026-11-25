import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SPATIAL_3D_PREFS,
  SPATIAL_3D_THEMES,
  buildGradientMeshLayers,
  computeHubOrbTelemetry,
  computeParticleDisplacement,
  computeReadableForeground,
  createFloatingParticleFieldSpec,
  getDensityPaddingClass,
  getSpatialThemeDef,
  getSpatialViewChoreography,
  getTiltConfig,
  normalizeHexColor,
  normalizeUsernameInput,
  resolveActiveSpatialPalette,
  resolveMorrowEntityMoodState,
  resolveSpatial3DPrefs,
  validateAuthUsername,
} from './spatial3dConfig.ts';
import { shouldFireTactileEvent } from './tactileFeedback.ts';
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

test('getSpatialViewChoreography returns distinct camera and stage presets across views', () => {
  const hubPreset = getSpatialViewChoreography('hub');
  const morrowPreset = getSpatialViewChoreography('morrow_center');
  const rosterPreset = getSpatialViewChoreography('master_roster');

  assert.equal(hubPreset.cameraZ, 25.5);
  assert.ok(morrowPreset.cameraZ < hubPreset.cameraZ);
  assert.ok(morrowPreset.stageScale > hubPreset.stageScale);
  assert.ok(morrowPreset.ringSpeedMult > rosterPreset.ringSpeedMult);
  assert.notEqual(hubPreset.stageYaw, rosterPreset.stageYaw);
});

test('resolveMorrowEntityMoodState produces articulated telemetry for greet, excited, and focus moods', () => {
  const greetIdle = resolveMorrowEntityMoodState('greet', 0, false);
  const excitedPulse = resolveMorrowEntityMoodState('excited', 2, true);
  const focusIdle = resolveMorrowEntityMoodState('focus', 1, false);

  assert.ok(excitedPulse.coreSpinSpeed > focusIdle.coreSpinSpeed);
  assert.ok(focusIdle.coreSpinSpeed > greetIdle.coreSpinSpeed);
  assert.ok(excitedPulse.wingFlareRad > 0.25);
  assert.ok(focusIdle.wingFlareRad < 0);
  assert.ok(excitedPulse.eyeScaleY > focusIdle.eyeScaleY);
  assert.ok(excitedPulse.emissiveBoost > greetIdle.emissiveBoost);
  assert.ok(excitedPulse.hoverAmplitude > focusIdle.hoverAmplitude);
});

test('createFloatingParticleFieldSpec and computeParticleDisplacement produce bounded depth-aware mouse motion', () => {
  const hwField = createFloatingParticleFieldSpec(false);
  const swField = createFloatingParticleFieldSpec(true);
  assert.equal(hwField.count, 680);
  assert.equal(swField.count, 320);
  assert.equal(hwField.basePositions.length, hwField.count * 3);

  for (let i = 0; i < hwField.count; i++) {
    const x = hwField.basePositions[i * 3];
    const y = hwField.basePositions[i * 3 + 1];
    const z = hwField.basePositions[i * 3 + 2];
    assert.ok(Number.isFinite(x) && Math.abs(x) <= 23);
    assert.ok(Number.isFinite(y) && Math.abs(y) <= 14);
    assert.ok(Number.isFinite(z) && z <= 4 && z >= -23);
    assert.ok(hwField.depthLayers[i] >= 0.3 && hwField.depthLayers[i] <= 1.0);
  }

  const nearAtRest = computeParticleDisplacement({
    baseX: 0,
    baseY: 0,
    baseZ: 0,
    phase: 0,
    speed: 0.5,
    depthWeight: 1,
    timeSec: 0,
    pointerX: 0,
    pointerY: 0,
    pointerSpeed: 0,
    pulseActive: false,
    pulseProgress: 0,
    pulseIntensity: 1,
  });
  const nearMoved = computeParticleDisplacement({
    baseX: 0,
    baseY: 0,
    baseZ: 0,
    phase: 0,
    speed: 0.5,
    depthWeight: 1,
    timeSec: 0,
    pointerX: 0.85,
    pointerY: 0.45,
    pointerSpeed: 1.4,
    pulseActive: true,
    pulseProgress: 0.1,
    pulseIntensity: 1.2,
  });
  const farMoved = computeParticleDisplacement({
    baseX: 0,
    baseY: 0,
    baseZ: -18,
    phase: 0,
    speed: 0.5,
    depthWeight: 0.34,
    timeSec: 0,
    pointerX: 0.85,
    pointerY: 0.45,
    pointerSpeed: 1.4,
    pulseActive: false,
    pulseProgress: 0,
    pulseIntensity: 1,
  });

  assert.ok(Math.abs(nearMoved.x - nearAtRest.x) > Math.abs(farMoved.x - nearAtRest.x));
  assert.ok(nearMoved.glowBoost >= 0 && nearMoved.glowBoost <= 1);
});

test('shouldFireTactileEvent enforces cooldown to prevent duplicate input focus/pointer chimes', () => {
  assert.equal(shouldFireTactileEvent(1000, 0, 85), true);
  assert.equal(shouldFireTactileEvent(1040, 1000, 85), false);
  assert.equal(shouldFireTactileEvent(1085, 1000, 85), true);
});

