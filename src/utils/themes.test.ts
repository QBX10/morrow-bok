import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_THEMES,
  ARABIC_FONTS,
  DEFAULT_APPEARANCE_PROFILES,
  getAppThemeById,
  resolveAppThemeId,
  resolveArabicFontId,
  resolveTableThemeId,
  TABLE_THEMES,
} from './themes.ts';

test('defines all 8 God-Tier app themes, 8 table themes, and 6 Google fonts', () => {
  assert.equal(APP_THEMES.length, 8);
  assert.equal(TABLE_THEMES.length, 8);
  assert.equal(ARABIC_FONTS.length, 6);
  assert.ok(DEFAULT_APPEARANCE_PROFILES.length >= 2);

  for (const theme of APP_THEMES) {
    assert.ok(theme.id && theme.name && theme.mood);
    assert.equal(theme.swatches.length, 3);
    assert.ok(theme.vars['--bg-main']);
    assert.ok(theme.vars['--bg-surface']);
    assert.ok(theme.vars['--accent']);
    assert.ok(theme.vars['--text-primary']);
  }
});

test('resolves legacy theme, table, and font IDs safely to new IDs', () => {
  assert.equal(resolveAppThemeId('midnight-slate'), 'obsidian-gold');
  assert.equal(resolveAppThemeId('warm-paper'), 'desert-mirage');
  assert.equal(resolveAppThemeId('crisp-daylight'), 'arctic-snow');
  assert.equal(resolveAppThemeId('charcoal-emerald'), 'emerald-forest');
  assert.equal(resolveAppThemeId('nordic-navy'), 'aurora');
  assert.equal(resolveAppThemeId('soft-mint'), 'zen-minimal');
  assert.equal(resolveAppThemeId('unknown-theme'), 'arctic-snow');

  assert.equal(getAppThemeById('obsidian-gold').isDark, true);
  assert.equal(getAppThemeById('desert-mirage').isDark, false);

  assert.equal(resolveTableThemeId('classic-quota'), 'paper-ledger');
  assert.equal(resolveTableThemeId('financial-audit'), 'data-grid');
  assert.equal(resolveTableThemeId('card-based'), 'card-based');

  assert.equal(resolveArabicFontId('noto-sans'), 'ibm-plex');
  assert.equal(resolveArabicFontId('el-messiri'), 'el-messiri');
});
