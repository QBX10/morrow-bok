import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_APP_THEMES,
  APP_THEME_CAPSULES,
  APP_THEMES,
  ARABIC_FONTS,
  DEFAULT_APPEARANCE_PROFILES,
  getAppThemeById,
  MODERN_APP_THEMES,
  resolveAppThemeId,
  resolveArabicFontId,
  resolveTableThemeId,
  TABLE_THEMES,
} from './themes.ts';

test('defines all 8 God-Tier classic themes, 4 modern/glass themes, 8 table themes, and 6 Google fonts', () => {
  assert.equal(APP_THEMES.length, 8);
  assert.equal(MODERN_APP_THEMES.length, 4);
  assert.equal(ALL_APP_THEMES.length, 12);
  assert.equal(APP_THEME_CAPSULES.length, 3);
  assert.equal(TABLE_THEMES.length, 8);
  assert.equal(ARABIC_FONTS.length, 6);
  assert.ok(DEFAULT_APPEARANCE_PROFILES.length >= 2);

  for (const theme of ALL_APP_THEMES) {
    assert.ok(theme.id && theme.name && theme.mood);
    assert.equal(theme.swatches.length, 3);
    assert.ok(theme.vars['--bg-main']);
    assert.ok(theme.vars['--bg-surface']);
    assert.ok(theme.vars['--accent']);
    assert.ok(theme.vars['--text-primary']);
  }
});

test('resolves legacy, classic, and modern/glass theme IDs safely', () => {
  assert.equal(resolveAppThemeId('midnight-slate'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('warm-paper'), 'desert-mirage');
  assert.equal(resolveAppThemeId('crisp-daylight'), 'arctic-snow');
  assert.equal(resolveAppThemeId('charcoal-emerald'), 'emerald-forest');
  assert.equal(resolveAppThemeId('nordic-navy'), 'aurora');
  assert.equal(resolveAppThemeId('soft-mint'), 'zen-minimal');
  assert.equal(resolveAppThemeId('unknown-theme'), 'arctic-snow');

  assert.equal(resolveAppThemeId('alabaster-glass'), 'alabaster-glass');
  assert.equal(resolveAppThemeId('nordic-dusk'), 'nordic-dusk');
  assert.equal(resolveAppThemeId('sage-linen'), 'sage-linen');
  assert.equal(resolveAppThemeId('midnight-indigo'), 'midnight-indigo');

  assert.equal(getAppThemeById('obsidian-gold').isDark, true);
  assert.equal(getAppThemeById('desert-mirage').isDark, false);
  assert.equal(getAppThemeById('alabaster-glass').isDark, false);
  assert.equal(getAppThemeById('nordic-dusk').isDark, true);

  assert.equal(resolveTableThemeId('classic-quota'), 'paper-ledger');
  assert.equal(resolveTableThemeId('financial-audit'), 'data-grid');
  assert.equal(resolveTableThemeId('card-based'), 'card-based');

  assert.equal(resolveArabicFontId('noto-sans'), 'ibm-plex');
  assert.equal(resolveArabicFontId('el-messiri'), 'el-messiri');
});
