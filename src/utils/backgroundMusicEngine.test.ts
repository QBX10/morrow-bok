import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireMusicPauseLock,
  getBackgroundMusicSnapshot,
  releaseMusicPauseLock,
  resolveTopPauseReason,
  setBackgroundMusicPaused,
  setBackgroundMusicSmartMode,
  setBackgroundMusicVolume,
  shouldSmartMusicPlay,
  SMART_AUDIO_REASON_LABELS,
  SMART_AUDIO_REASON_PRIORITY,
} from './backgroundMusicEngine.ts';

test('Smart Audio Mode resolves pause reason by priority (call > live > mic > camera > tts > tab_hidden)', () => {
  assert.equal(resolveTopPauseReason([]), null);
  assert.equal(resolveTopPauseReason(['tab_hidden', 'camera']), 'camera');
  assert.equal(resolveTopPauseReason(['tab_hidden', 'mic', 'camera']), 'mic');
  assert.equal(resolveTopPauseReason(['mic', 'live']), 'live');
  assert.equal(resolveTopPauseReason(['live', 'mic', 'camera', 'call']), 'call');

  for (const reason of SMART_AUDIO_REASON_PRIORITY) {
    assert.ok(SMART_AUDIO_REASON_LABELS[reason].length > 5);
  }
});

test('shouldSmartMusicPlay pauses automatically on locks only when Smart Mode is enabled', () => {
  assert.equal(
    shouldSmartMusicPlay({
      authAllowed: true,
      userPaused: false,
      smartModeEnabled: true,
      volume: 0.27,
      pauseLocksCount: 0,
    }),
    true
  );

  assert.equal(
    shouldSmartMusicPlay({
      authAllowed: true,
      userPaused: false,
      smartModeEnabled: true,
      volume: 0.27,
      pauseLocksCount: 1,
    }),
    false
  );

  assert.equal(
    shouldSmartMusicPlay({
      authAllowed: true,
      userPaused: false,
      smartModeEnabled: false,
      volume: 0.27,
      pauseLocksCount: 2,
    }),
    true
  );

  assert.equal(
    shouldSmartMusicPlay({
      authAllowed: true,
      userPaused: true,
      smartModeEnabled: true,
      volume: 0.27,
      pauseLocksCount: 0,
    }),
    false
  );
});

test('Smart Audio controller tracks concurrent app-exit, camera, voice recording, and call locks and resumes cleanly when finished', () => {
  setBackgroundMusicSmartMode(true);
  setBackgroundMusicPaused(false);
  setBackgroundMusicVolume(0.27);

  acquireMusicPauseLock('test:app-exit', 'tab_hidden', 0);
  let snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, 'tab_hidden');
  assert.equal(snap.status, 'paused_auto');
  assert.equal(snap.activeLockCount, 1);

  acquireMusicPauseLock('test:camera', 'camera', 0);
  snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, 'camera');
  assert.equal(snap.activeLockCount, 2);

  acquireMusicPauseLock('test:mic', 'mic', 0);
  snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, 'mic');
  assert.equal(snap.activeLockCount, 3);

  acquireMusicPauseLock('test:call', 'call', 0);
  snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, 'call');
  assert.equal(snap.activeLockCount, 4);

  // Releasing call falls back smoothly to active mic lock
  releaseMusicPauseLock('test:call');
  snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, 'mic');
  assert.equal(snap.activeLockCount, 3);

  // Releasing remaining locks clears auto pause so background music resumes
  releaseMusicPauseLock('test:mic');
  releaseMusicPauseLock('test:camera');
  releaseMusicPauseLock('test:app-exit');
  snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, null);
  assert.equal(snap.pauseReasonLabel, null);
  assert.equal(snap.activeLockCount, 0);
  assert.equal(snap.smartModeEnabled, true);
});

test('Unified App Sound System exposes all 29 calibrated acoustic profiles with valid harmonic layers', async () => {
  const { AUDIO_PROFILES } = await import('./tactileFeedback.ts');
  const expectedKinds = [
    'tap',
    'menu_open',
    'menu_close',
    'nav',
    'transition_slide',
    'app_open',
    'app_close',
    'sheet_open',
    'sheet_close',
    'drag_snap',
    'toggle_on',
    'toggle_off',
    'type',
    'success',
    'warn',
    'error',
    'undo',
    'redo',
    'cord_tick',
    'notify',
    'message_send',
    'message_receive',
    'record_start',
    'record_stop',
    'camera_shutter',
    'save_complete',
    'delete_item',
    'search_tick',
    'auth_welcome',
  ] as const;

  for (const kind of expectedKinds) {
    const profile = AUDIO_PROFILES[kind];
    assert.ok(profile, `Missing profile ${kind}`);
    assert.ok(profile.layers.length >= 1);
    for (const layer of profile.layers) {
      assert.ok(layer.startFreq >= 20);
      assert.ok(layer.durationSec > 0 && layer.durationSec < 1);
      assert.ok(layer.peakGain > 0 && layer.peakGain <= 0.05);
    }
  }
});

test('Sound Packs, Notification Tones, and AppSoundPreferences customize and reset cleanly', async () => {
  const {
    applySoundPackToLayer,
    AUDIO_PROFILES,
    DEFAULT_APP_SOUND_PREFS,
    getAppSoundPrefs,
    NOTIFICATION_TONE_OPTIONS,
    resetAppSoundPrefs,
    resolveNotificationLayers,
    SOUND_PACK_OPTIONS,
    updateAppSoundPrefs,
  } = await import('./tactileFeedback.ts');

  assert.equal(SOUND_PACK_OPTIONS.length, 4);
  assert.equal(NOTIFICATION_TONE_OPTIONS.length, 5);

  for (const tone of NOTIFICATION_TONE_OPTIONS) {
    const layers = resolveNotificationLayers(tone.id);
    if (tone.id === 'silent') {
      assert.equal(layers.length, 0);
    } else {
      assert.ok(layers.length >= 1, `Expected layers for ${tone.id}`);
    }
  }

  const baseLayer = AUDIO_PROFILES.success.layers[0];
  const crystalLayer = applySoundPackToLayer(baseLayer, 'crystal_glass', 0.9);
  const minimalLayer = applySoundPackToLayer(baseLayer, 'minimal_soft', 0.5);
  assert.ok(crystalLayer.startFreq > baseLayer.startFreq);
  assert.ok(minimalLayer.peakGain < crystalLayer.peakGain);

  const updated = updateAppSoundPrefs({
    soundPack: 'studio_crisp',
    notificationTone: 'harp_pluck',
    motionSoundsEnabled: false,
    effectsVolume: 0.7,
  });
  assert.equal(updated.soundPack, 'studio_crisp');
  assert.equal(updated.notificationTone, 'harp_pluck');
  assert.equal(updated.motionSoundsEnabled, false);
  assert.equal(getAppSoundPrefs().effectsVolume, 0.7);

  const reset = resetAppSoundPrefs();
  assert.deepEqual(reset, DEFAULT_APP_SOUND_PREFS);
});
