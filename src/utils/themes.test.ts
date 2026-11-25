import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_APP_THEMES,
  APP_SHAPES,
  APP_THEME_CAPSULES,
  APP_THEMES,
  ARABIC_FONTS,
  DEFAULT_APPEARANCE_PROFILES,
  getAppShapeById,
  getAppThemeById,
  getEffectiveAppTheme,
  MODERN_APP_THEMES,
  resolveAppShapeId,
  resolveAppThemeId,
  resolveArabicFontId,
  resolveAutoThemeTarget,
  resolveTableThemeId,
  TABLE_THEMES,
} from './themes.ts';

test('exposes 5 core themes (incl. Obsidian & Gold), Auto theme, 5 geometric app shapes, 8 table themes and 6 Google fonts', () => {
  assert.equal(APP_THEMES.length, 5);
  assert.equal(MODERN_APP_THEMES.length, 6);
  assert.equal(ALL_APP_THEMES.length, 6);
  assert.equal(APP_THEME_CAPSULES.length, 2);
  assert.equal(APP_THEMES[0].id, 'abyssal-emerald');
  assert.equal(APP_THEMES[4].id, 'obsidian-gold');
  assert.equal(MODERN_APP_THEMES[5].id, 'auto');
  assert.equal(APP_SHAPES.length, 5);
  assert.equal(TABLE_THEMES.length, 8);
  assert.equal(ARABIC_FONTS.length, 6);
  assert.ok(DEFAULT_APPEARANCE_PROFILES.length >= 2);

  for (const theme of ALL_APP_THEMES) {
    assert.ok(theme.id && theme.name && theme.mood);
    assert.equal(theme.swatches.length, 3);
    assert.ok(theme.vars['--bg-main']);
    assert.ok(theme.vars['--bg-surface']);
    assert.ok(theme.vars['--surface-well']);
    assert.ok(theme.vars['--surface-subtle']);
    assert.ok(theme.vars['--surface-pill']);
    assert.ok(theme.vars['--surface-overlay']);
    assert.ok(theme.vars['--accent']);
    assert.ok(theme.vars['--accent-bright']);
    assert.ok(theme.vars['--accent-deep']);
    assert.ok(theme.vars['--text-primary']);
  }

  for (const shape of APP_SHAPES) {
    assert.ok(shape.id && shape.name && shape.tagline);
    assert.ok(shape.cardRadiusPx > 0);
  }
});

test('resolves core themes, Obsidian & Gold, Auto Adaptive, and App Shapes safely', () => {
  assert.equal(resolveAppThemeId('abyssal-emerald'), 'abyssal-emerald');
  assert.equal(resolveAppThemeId('midnight-trench'), 'midnight-trench');
  assert.equal(resolveAppThemeId('bioluminescent-reef'), 'bioluminescent-reef');
  assert.equal(resolveAppThemeId('pelagic-sapphire'), 'pelagic-sapphire');
  assert.equal(resolveAppThemeId('obsidian-gold'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('auto'), 'auto');

  assert.equal(resolveAppThemeId('arctic-fjord'), 'midnight-trench');
  assert.equal(resolveAppThemeId('desert-mirage'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('midnight-slate'), 'pelagic-sapphire');
  assert.equal(resolveAppThemeId('charcoal-emerald'), 'bioluminescent-reef');
  assert.equal(resolveAppThemeId('nordic-dusk'), 'pelagic-sapphire');
  assert.equal(resolveAppThemeId('unknown-theme'), 'abyssal-emerald');

  assert.equal(getAppThemeById('abyssal-emerald').isDark, true);
  assert.equal(getAppThemeById('obsidian-gold').vars['--accent'], '#D4AF37');
  assert.equal(getAppThemeById('desert-mirage').id, 'obsidian-gold');

  assert.equal(resolveAutoThemeTarget({ prefersLight: true, hour: 22 }).id, 'daylight-alabaster');
  assert.equal(resolveAutoThemeTarget({ prefersLight: false, hour: 11 }).id, 'daylight-alabaster');
  assert.equal(resolveAutoThemeTarget({ prefersLight: false, hour: 22 }).id, 'obsidian-gold');
  assert.equal(getEffectiveAppTheme('auto', { prefersLight: true }).isDark, false);
  assert.equal(getEffectiveAppTheme('auto', { prefersLight: false, hour: 23 }).id, 'obsidian-gold');

  assert.equal(resolveAppShapeId('sharp-monolith'), 'sharp-monolith');
  assert.equal(resolveAppShapeId('royal-octagram'), 'royal-octagram');
  assert.equal(resolveAppShapeId('swiss-editorial'), 'swiss-editorial');
  assert.equal(resolveAppShapeId('floating-capsule'), 'floating-capsule');
  assert.equal(resolveAppShapeId('invalid-shape'), 'geometric-glass');
  assert.equal(getAppShapeById('royal-octagram').patternType, 'octagram');

  assert.equal(resolveTableThemeId('classic-quota'), 'paper-ledger');
  assert.equal(resolveTableThemeId('financial-audit'), 'data-grid');
  assert.equal(resolveTableThemeId('card-based'), 'card-based');

  assert.equal(resolveArabicFontId('noto-sans'), 'ibm-plex');
  assert.equal(resolveArabicFontId('el-messiri'), 'el-messiri');
});
