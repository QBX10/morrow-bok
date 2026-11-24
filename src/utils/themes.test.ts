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

test('exposes 5 Absolute Marine themes while preserving 8 table themes and 6 Google fonts', () => {
  assert.equal(APP_THEMES.length, 5);
  assert.equal(MODERN_APP_THEMES.length, 5);
  assert.equal(ALL_APP_THEMES.length, 5);
  assert.equal(APP_THEME_CAPSULES.length, 1);
  assert.equal(APP_THEMES[0].id, 'abyssal-emerald');
  assert.equal(TABLE_THEMES.length, 8);
  assert.equal(ARABIC_FONTS.length, 6);
  assert.ok(DEFAULT_APPEARANCE_PROFILES.length >= 2);

  for (const theme of ALL_APP_THEMES) {
    assert.ok(theme.id && theme.name && theme.mood);
    assert.equal(theme.swatches.length, 3);
    assert.ok(theme.vars['--bg-main']);
    assert.ok(theme.vars['--bg-surface']);
    assert.ok(theme.vars['--accent']);
    assert.ok(theme.vars['--accent-bright']);
    assert.ok(theme.vars['--accent-deep']);
    assert.ok(theme.vars['--text-primary']);
  }
});

test('resolves marine theme IDs and maps legacy/unknown theme IDs safely', () => {
  assert.equal(resolveAppThemeId('abyssal-emerald'), 'abyssal-emerald');
  assert.equal(resolveAppThemeId('midnight-trench'), 'midnight-trench');
  assert.equal(resolveAppThemeId('bioluminescent-reef'), 'bioluminescent-reef');
  assert.equal(resolveAppThemeId('arctic-fjord'), 'arctic-fjord');
  assert.equal(resolveAppThemeId('pelagic-sapphire'), 'pelagic-sapphire');

  assert.equal(resolveAppThemeId('obsidian-gold'), 'abyssal-emerald');
  assert.equal(resolveAppThemeId('midnight-slate'), 'pelagic-sapphire');
  assert.equal(resolveAppThemeId('charcoal-emerald'), 'bioluminescent-reef');
  assert.equal(resolveAppThemeId('nordic-dusk'), 'arctic-fjord');
  assert.equal(resolveAppThemeId('unknown-theme'), 'abyssal-emerald');

  assert.equal(getAppThemeById('abyssal-emerald').isDark, true);
  assert.equal(getAppThemeById('midnight-trench').id, 'midnight-trench');
  assert.equal(getAppThemeById('desert-mirage').isDark, true);
  assert.equal(getAppThemeById('desert-mirage').id, 'abyssal-emerald');

  assert.equal(resolveTableThemeId('classic-quota'), 'paper-ledger');
  assert.equal(resolveTableThemeId('financial-audit'), 'data-grid');
  assert.equal(resolveTableThemeId('card-based'), 'card-based');

  assert.equal(resolveArabicFontId('noto-sans'), 'ibm-plex');
  assert.equal(resolveArabicFontId('el-messiri'), 'el-messiri');
});
