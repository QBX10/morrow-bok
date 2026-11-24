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

test('locks application theme exclusively to Obsidian & Gold while preserving 8 table themes and 6 Google fonts', () => {
  assert.equal(APP_THEMES.length, 1);
  assert.equal(MODERN_APP_THEMES.length, 0);
  assert.equal(ALL_APP_THEMES.length, 1);
  assert.equal(APP_THEME_CAPSULES.length, 1);
  assert.equal(APP_THEMES[0].id, 'obsidian-gold');
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

test('resolves all legacy and unknown theme IDs safely to obsidian-gold', () => {
  assert.equal(resolveAppThemeId('midnight-slate'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('warm-paper'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('crisp-daylight'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('charcoal-emerald'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('nordic-navy'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('soft-mint'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('unknown-theme'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('alabaster-glass'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('nordic-dusk'), 'obsidian-gold');

  assert.equal(getAppThemeById('obsidian-gold').isDark, true);
  assert.equal(getAppThemeById('desert-mirage').isDark, true);
  assert.equal(getAppThemeById('desert-mirage').id, 'obsidian-gold');

  assert.equal(resolveTableThemeId('classic-quota'), 'paper-ledger');
  assert.equal(resolveTableThemeId('financial-audit'), 'data-grid');
  assert.equal(resolveTableThemeId('card-based'), 'card-based');

  assert.equal(resolveArabicFontId('noto-sans'), 'ibm-plex');
  assert.equal(resolveArabicFontId('el-messiri'), 'el-messiri');
});
