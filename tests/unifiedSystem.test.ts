import test from 'node:test';
import assert from 'node:assert/strict';
import { MODES, resolveThemeTokens, THEMES } from '../src/theme/tokens.ts';
import {
  ALL_SOUND_EVENT_IDS,
  SOUND_MAP,
  THEME_SOUND_PALETTES,
} from '../src/audio/soundMap.ts';
import {
  isTimeInQuietHours,
  shouldPlaySoundEvent,
  soundManager,
  type SoundPolicySnapshot,
} from '../src/audio/SoundManager.ts';

test('Design tokens expose all 4 distinct themes and 4 operational modes', () => {
  assert.deepEqual(Object.keys(THEMES), [
    'quantum_glass',
    'terminal_brutalist',
    'solar_paper',
    'aurora_bento',
  ]);
  assert.deepEqual(Object.keys(MODES), ['focus', 'creative', 'audit', 'night']);
  assert.equal(THEMES.terminal_brutalist.radiusCard, '0px');
  assert.equal(THEMES.aurora_bento.radiusCard, '28px');
  assert.equal(THEMES.solar_paper.colorScheme, 'light');
  assert.equal(THEMES.quantum_glass.surfaceBlur, '24px');

  const resolved = resolveThemeTokens('quantum_glass', 'creative');
  assert.equal(resolved.accent, '#A78BFA');
});

test('SoundMap defines all 35 required events under 1s duration and theme palettes', () => {
  assert.ok(ALL_SOUND_EVENT_IDS.length >= 35);
  assert.deepEqual(Object.keys(THEME_SOUND_PALETTES), [
    'glass',
    'terminal',
    'paper',
    'bento',
  ]);
  for (const id of ALL_SOUND_EVENT_IDS) {
    const spec = SOUND_MAP[id];
    assert.ok(spec.spriteDurationSec < 1.0, `Expected ${id} duration < 1s`);
    assert.ok(spec.hapticPattern.length > 0, `Expected ${id} haptic pattern`);
  }
});

test('Quiet hours wrap overnight cleanly and security alerts break through', () => {
  const quiet = { enabled: true, start: '22:00', end: '07:00' };
  assert.equal(isTimeInQuietHours(new Date('2026-01-01T23:30:00'), quiet), true);
  assert.equal(isTimeInQuietHours(new Date('2026-01-01T05:15:00'), quiet), true);
  assert.equal(isTimeInQuietHours(new Date('2026-01-01T14:00:00'), quiet), false);

  const policy: SoundPolicySnapshot = {
    masterSound: true,
    volumes: { music: 0.2, sfx: 0.85 },
    quietHours: quiet,
    channels: {
      security: { enabled: true, sound: true, haptic: true, push: true },
      reminders: { enabled: true, sound: true, haptic: true, push: true },
      sync: { enabled: true, sound: true, haptic: true, push: true },
      news: { enabled: true, sound: false, haptic: false, push: true },
    },
  };

  const reminderNight = shouldPlaySoundEvent({
    spec: SOUND_MAP.notify_reminders,
    policy,
    now: new Date('2026-01-01T23:45:00'),
  });
  assert.equal(reminderNight.allowedSound, false);

  const securityNight = shouldPlaySoundEvent({
    spec: SOUND_MAP.notify_security,
    policy,
    now: new Date('2026-01-01T23:45:00'),
  });
  assert.equal(securityNight.allowedSound, true);
  assert.equal(securityNight.allowedHaptic, true);
});

test('SoundManager pause reasons only resume when pause set becomes empty', () => {
  soundManager.addPauseReason('mic');
  soundManager.addPauseReason('call');
  assert.deepEqual(soundManager.getPauseReasons().sort(), ['call', 'mic']);
  soundManager.removePauseReason('mic');
  assert.deepEqual(soundManager.getPauseReasons(), ['call']);
  soundManager.removePauseReason('call');
  assert.deepEqual(soundManager.getPauseReasons(), []);
});

test('Zustand store updates theme/mode optimistically and rolls back prefs on sync failure', async () => {
  const { useAgencyStore } = await import('../src/store/useAgencyStore.ts');
  const { saveSession } = await import('../src/lib/authClient.ts');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'simulated failure' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

  try {
    saveSession(
      'test-jwt-token',
      { uid: 'user_test_rollback', provider: 'username', displayName: 'Tester', role: 'manager' },
      false
    );

    useAgencyStore.setState({ uid: 'user_test_rollback' });
    assert.equal(useAgencyStore.getState().notificationPrefs.channels.reminders.enabled, true);

    useAgencyStore.getState().setChannel('reminders', { enabled: false });
    // Immediate optimistic state update
    assert.equal(useAgencyStore.getState().notificationPrefs.channels.reminders.enabled, false);

    // Wait past 300ms debounce so sync fires and rolls back on HTTP 500
    await new Promise((r) => setTimeout(r, 420));

    const afterState = useAgencyStore.getState();
    assert.equal(afterState.notificationPrefs.channels.reminders.enabled, true);
    assert.ok(afterState.toasts.some((t) => t.tone === 'error'));

    useAgencyStore.getState().setTheme('terminal_brutalist');
    assert.equal(useAgencyStore.getState().notificationPrefs.activeTheme, 'terminal_brutalist');
    useAgencyStore.getState().setMode('audit', { x: 100, y: 120 });
    assert.equal(useAgencyStore.getState().notificationPrefs.activeMode, 'audit');
    assert.ok(useAgencyStore.getState().modeShockwave !== null);

    // Let any pending debounce settle cleanly
    await new Promise((r) => setTimeout(r, 360));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

