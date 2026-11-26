import test from 'node:test';
import assert from 'node:assert/strict';
import {
  audioManager,
  canDeliverChannelNotification,
  DEFAULT_AUDIO_NOTIFICATION_SETTINGS,
  isWithinQuietHours,
  NOTIFICATION_CHANNELS_META,
  sanitizeAudioNotificationSettings,
  SFX_EVENT_TABLE,
} from './AudioManager.ts';
import {
  acquireMusicPauseLock,
  applySyncedBackgroundMusicSettings,
  getBackgroundMusicSnapshot,
  releaseMusicPauseLock,
  setBackgroundMusicPauseOnExit,
  setBackgroundMusicPaused,
  setBackgroundMusicSmartMode,
} from '../../utils/backgroundMusicEngine.ts';
import {
  AUDIO_PROFILES,
  clearSfxVoiceTracker,
  getActiveSfxVoiceCount,
  MAX_CONCURRENT_SFX_VOICES,
  tryAcquireSfxVoice,
} from '../../utils/tactileFeedback.ts';

test('SFX_EVENT_TABLE maps every event to a valid profile under 1s and ducking hits 40%', () => {
  const entries = Object.entries(SFX_EVENT_TABLE);
  assert.ok(entries.length >= 20);
  for (const [, kind] of entries) {
    const profile = AUDIO_PROFILES[kind];
    assert.ok(profile, `Missing audio profile for ${kind}`);
    for (const layer of profile.layers) {
      assert.ok(layer.durationSec + (layer.delaySec ?? 0) < 1);
    }
    if (profile.duckAmbient) {
      assert.equal(profile.duckAmbient.factor, 0.4);
    }
  }
});

test('SFX voice limiter caps concurrent voices at 2, honors cooldowns, and prioritizes alerts', () => {
  clearSfxVoiceTracker();
  assert.equal(MAX_CONCURRENT_SFX_VOICES, 2);

  const t0 = 10_000;
  // Two low-priority voices fill the 2-voice pool
  assert.equal(tryAcquireSfxVoice('tap', 120, t0), true);
  assert.equal(tryAcquireSfxVoice('nav', 120, t0 + 5), true);
  assert.equal(getActiveSfxVoiceCount(t0 + 10), 2);

  // Cooldown blocks rapid duplicate 'tap' within 75ms
  assert.equal(tryAcquireSfxVoice('tap', 120, t0 + 20), false);

  // 3rd low-priority voice is rejected when 2 voices active
  assert.equal(tryAcquireSfxVoice('search_tick', 120, t0 + 15), false);
  assert.equal(getActiveSfxVoiceCount(t0 + 20), 2);

  // High-priority error (priority 4) pre-empts lowest-priority voice without exceeding cap 2
  assert.equal(tryAcquireSfxVoice('error', 180, t0 + 25), true);
  assert.equal(getActiveSfxVoiceCount(t0 + 30), 2);

  // After voices expire, tracker clears down to 0
  assert.equal(getActiveSfxVoiceCount(t0 + 300), 0);
  clearSfxVoiceTracker();
});

test('isWithinQuietHours accurately evaluates overnight and daytime spans', () => {
  const at2330 = new Date(2026, 0, 1, 23, 30, 0);
  const at0315 = new Date(2026, 0, 1, 3, 15, 0);
  const at0700 = new Date(2026, 0, 1, 7, 0, 0);
  const at1400 = new Date(2026, 0, 1, 14, 0, 0);
  const at2200 = new Date(2026, 0, 1, 22, 0, 0);

  assert.equal(isWithinQuietHours(at2200, '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours(at2330, '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours(at0315, '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours(at0700, '22:00', '07:00'), false);
  assert.equal(isWithinQuietHours(at1400, '22:00', '07:00'), false);

  // Daytime window
  assert.equal(isWithinQuietHours(at1400, '09:00', '17:00'), true);
  assert.equal(isWithinQuietHours(at2330, '09:00', '17:00'), false);
});

test('Notification channels: Security stays ALWAYS ON and breaks Quiet Hours while other channels silence or mute cleanly', () => {
  assert.equal(NOTIFICATION_CHANNELS_META.length, 4);
  const secMeta = NOTIFICATION_CHANNELS_META.find((c) => c.id === 'security');
  assert.equal(secMeta?.locked, true);
  assert.equal(secMeta?.bypassesQuietHours, true);

  // Sanitizer prevents disabling security channel
  const forced = sanitizeAudioNotificationSettings({
    channels: { security: false as unknown as true, reminders: false, sync: true, whats_new: false },
  });
  assert.equal(forced.channels.security, true);
  assert.equal(forced.channels.reminders, false);

  const quietNight = new Date(2026, 0, 1, 23, 30, 0);
  const activeDay = new Date(2026, 0, 1, 14, 0, 0);

  const quietSettings = {
    ...DEFAULT_AUDIO_NOTIFICATION_SETTINGS,
    notificationsMasterEnabled: false,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    channels: {
      security: true as const,
      reminders: true,
      sync: false,
      whats_new: true,
    },
  };

  // Even when notificationsMasterEnabled=false and inside Quiet Hours, security ALWAYS fires
  const secDecision = canDeliverChannelNotification('security', quietSettings, quietNight);
  assert.equal(secDecision.allowed, true);
  assert.equal(secDecision.playSound, true);
  assert.equal(secDecision.bypassedQuietHours, true);

  // Non-security blocked when master notifications OFF
  assert.equal(canDeliverChannelNotification('reminders', quietSettings, activeDay).allowed, false);

  // When master ON + inside Quiet Hours: non-security allowed visually, playSound = false
  const quietMasterOn = { ...quietSettings, notificationsMasterEnabled: true };
  const remQuiet = canDeliverChannelNotification('reminders', quietMasterOn, quietNight);
  assert.equal(remQuiet.allowed, true);
  assert.equal(remQuiet.playSound, false);
  assert.equal(remQuiet.inQuietHours, true);

  // Daytime + enabled channel chimes normally
  const remDay = canDeliverChannelNotification('reminders', quietMasterOn, activeDay);
  assert.equal(remDay.allowed, true);
  assert.equal(remDay.playSound, true);

  // Independently disabled channel (sync=false) stays blocked
  assert.equal(canDeliverChannelNotification('sync', quietMasterOn, activeDay).allowed, false);
});

test('BackgroundMusic pauseOnExit, headset disconnect lock, and remote sync apply cleanly', () => {
  setBackgroundMusicSmartMode(true);
  setBackgroundMusicPaused(false);
  setBackgroundMusicPauseOnExit(true);

  acquireMusicPauseLock('env:headset-disconnected', 'headset_disconnected', 0);
  acquireMusicPauseLock('env:visibility', 'tab_hidden', 0);
  let snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, 'headset_disconnected');
  assert.equal(snap.activeLockCount, 2);

  // Disabling pauseOnExit clears exit locks while keeping headset lock intact
  setBackgroundMusicPauseOnExit(false);
  snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseOnExit, false);
  assert.equal(snap.pauseReason, 'headset_disconnected');
  assert.equal(snap.activeLockCount, 1);

  releaseMusicPauseLock('env:headset-disconnected');
  snap = getBackgroundMusicSnapshot();
  assert.equal(snap.pauseReason, null);
  assert.equal(snap.activeLockCount, 0);

  // Applying synced remote settings hydrates audioManager & music controller
  const synced = audioManager.applyRemoteSettings(
    {
      musicVolume: 0.18,
      pauseOnExit: true,
      quietHoursEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '06:30',
    },
    'Chrome / Linux'
  );
  assert.equal(synced.musicVolume, 0.18);
  assert.equal(synced.pauseOnExit, true);
  assert.equal(synced.quietHoursEnabled, true);
  assert.equal(synced.quietHoursStart, '23:00');
  assert.equal(getBackgroundMusicSnapshot().volume, 0.18);

  // Reset cleanly
  applySyncedBackgroundMusicSettings({
    userPaused: false,
    smartModeEnabled: true,
    pauseOnExit: true,
    volume: 0.2,
  });
});
