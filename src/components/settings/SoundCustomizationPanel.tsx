import React, { useSyncExternalStore } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Music,
  Music2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getAppSoundPrefs,
  getSoundSystemDiagnostics,
  isGlobalAppSoundEnabled,
  NOTIFICATION_TONE_OPTIONS,
  playTactileFeedback,
  previewNotificationTone,
  previewSoundPack,
  resetAppSoundPrefs,
  resumeSharedAudioContext,
  setGlobalAppSoundEnabled,
  SOUND_PACK_OPTIONS,
  subscribeAppSoundPrefs,
  subscribeGlobalAppSoundEnabled,
  type TactileSoundKind,
  updateAppSoundPrefs,
} from '../../utils/tactileFeedback';
import {
  getBackgroundMusicSnapshot,
  retryBackgroundMusicPlayback,
  setBackgroundMusicSmartMode,
  setBackgroundMusicVolume,
  subscribeBackgroundMusic,
  toggleBackgroundMusic,
} from '../../utils/backgroundMusicEngine';
import { updateServerSoundSetting } from '../../utils/intelligentAmbience';

interface SoundCustomizationPanelProps {
  onNotify?: (msg: string) => void;
}

const SOUND_TEST_PROFILES: ReadonlyArray<{
  kind: TactileSoundKind;
  label: string;
}> = [
  { kind: 'tap', label: 'نقرة خفيفة' },
  { kind: 'nav', label: 'تنقل صفحة' },
  { kind: 'toggle_on', label: 'تفعيل مفتاح' },
  { kind: 'success', label: 'تأكيد نجاح' },
  { kind: 'notify', label: 'جرس إشعار' },
  { kind: 'warn', label: 'تنبيه تحذيري' },
  { kind: 'error', label: 'نغمة خطأ' },
  { kind: 'save_complete', label: 'اكتمال الحفظ' },
];

export const SoundCustomizationPanel: React.FC<SoundCustomizationPanelProps> = ({
  onNotify,
}) => {
  const prefs = useSyncExternalStore(
    subscribeAppSoundPrefs,
    getAppSoundPrefs,
    getAppSoundPrefs
  );
  const masterEnabled = useSyncExternalStore(
    subscribeGlobalAppSoundEnabled,
    isGlobalAppSoundEnabled,
    isGlobalAppSoundEnabled
  );
  const music = useSyncExternalStore(
    subscribeBackgroundMusic,
    getBackgroundMusicSnapshot,
    getBackgroundMusicSnapshot
  );

  const diag = getSoundSystemDiagnostics();
  const musicVolPct = Math.round(music.volume * 100);

  const engineStatusLabel = !diag.supported
    ? 'المتصفح لا يدعم WebAudio'
    : diag.contextState === 'running'
    ? `نشط (${diag.sampleRate ? `${Math.round(diag.sampleRate / 1000)}kHz` : 'جاهز'})`
    : 'بانتظار التنشيط التفاعلي';

  const musicStatusLabel = music.usingSynthFallback
    ? 'نغمة هادئة احتياطية (بدون اتصال)'
    : music.hasError
    ? 'تعذر تحميل المسار الصوتي'
    : music.userPaused
    ? 'متوقفة يدوياً'
    : music.pauseReasonLabel
    ? music.pauseReasonLabel
    : music.awaitingGesture
    ? 'تبدأ عند أول تفاعل'
    : music.volume <= 0.005
    ? 'مكتومة'
    : 'تعمل بهدوء في الخلفية';

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5 space-y-5 text-xs"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* 0. Header + Master Control & WebAudio Diagnostics */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <SlidersHorizontal
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--accent)' }}
            />
            <span>استوديو الصوت والموسيقى الخلفية</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            تحكم شامل في مفتاح الصوت الرئيسي، الموسيقى الهادئة، طوابع النقرات، ونغمات التنبيه في التطبيق.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="sound-master-toggle"
            onClick={() => {
              const next = !masterEnabled;
              setGlobalAppSoundEnabled(next);
              if (next) {
                void resumeSharedAudioContext().then(() => {
                  playTactileFeedback('toggle_on', {
                    sound: true,
                    haptic: true,
                    bypassPrefGate: true,
                  });
                });
              }
              onNotify?.(next ? 'تم تفعيل منظومة الأصوات.' : 'تم كتم المؤثرات الصوتية للتطبيق.');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            style={{
              backgroundColor: masterEnabled ? 'var(--bg-nav-active)' : 'var(--bg-main)',
              borderColor: masterEnabled ? 'var(--accent)' : 'var(--border-color)',
              color: masterEnabled ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {masterEnabled ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{masterEnabled ? 'الأصوات مفعّلة' : 'الأصوات مكتومة'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void resumeSharedAudioContext().then(() => {
                playTactileFeedback('success', {
                  sound: true,
                  haptic: true,
                  bypassPrefGate: true,
                });
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            title={engineStatusLabel}
          >
            <Activity
              className="h-3.5 w-3.5 shrink-0"
              style={{
                color: diag.contextState === 'running' ? 'var(--success)' : 'var(--warning)',
              }}
            />
            <span className="tabular-nums">{engineStatusLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGlobalAppSoundEnabled(true);
              resetAppSoundPrefs();
              playTactileFeedback('save_complete', {
                sound: true,
                haptic: true,
                bypassPrefGate: true,
              });
              onNotify?.('تمت استعادة إعدادات الأصوات والإشعارات الافتراضية.');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>افتراضي</span>
          </button>
        </div>
      </div>

      {/* 1. Ambient Background Music Studio */}
      <div
        className="space-y-3 border-b pb-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 font-extrabold">
              <Music className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span>موسيقى الخلفية والتوقف الذكي</span>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {musicStatusLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(music.hasError || music.awaitingGesture || music.usingSynthFallback) &&
              !music.userPaused && (
                <button
                  type="button"
                  onClick={() => {
                    playTactileFeedback('tap');
                    retryBackgroundMusicPlayback();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--accent)',
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  <span>{music.awaitingGesture ? 'تنشيط التشغيل' : 'إعادة المحاولة'}</span>
                </button>
              )}

            <button
              type="button"
              onClick={() => {
                const nextPaused = !music.userPaused;
                playTactileFeedback(nextPaused ? 'toggle_off' : 'toggle_on');
                toggleBackgroundMusic();
                void updateServerSoundSetting(!nextPaused, music.volume);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{
                backgroundColor: music.userPaused ? 'var(--accent)' : 'var(--bg-main)',
                borderColor: music.userPaused ? 'var(--accent)' : 'var(--border-color)',
                color: music.userPaused ? 'var(--accent-fg)' : 'var(--text-primary)',
              }}
            >
              {music.userPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                  <span>تشغيل الخلفية</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 shrink-0" />
                  <span>إيقاف الخلفية</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col justify-center gap-1.5 py-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>
                مستوى صوت الخلفية
              </span>
              <span
                className="font-mono text-[11px] font-bold tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                {musicVolPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={musicVolPct}
              aria-label="مستوى صوت موسيقى الخلفية"
              onChange={(e) => {
                const nextVol = Number(e.target.value) / 100;
                setBackgroundMusicVolume(nextVol);
                void updateServerSoundSetting(!music.userPaused, nextVol);
              }}
              className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
            />
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--bg-main)]">
            <div>
              <div className="font-extrabold">التوقف الذكي عند التسجيل والكاميرا</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                يخفت أو يتوقف تلقائياً أثناء الميكروفون والمكالمات والتبويب المخفي
              </div>
            </div>
            <input
              type="checkbox"
              checked={music.smartModeEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                playTactileFeedback(checked ? 'toggle_on' : 'toggle_off');
                setBackgroundMusicSmartMode(checked);
              }}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
          </label>
        </div>
      </div>

      {/* 2. Sound Pack Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-extrabold">
            <Music2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <span>طابع أصوات التطبيق والانتقالات</span>
          </span>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            انقر لاختيار ومعاينة الطابع الصوتي
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SOUND_PACK_OPTIONS.map((pack) => {
            const active = prefs.soundPack === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                data-testid={`sound-pack-${pack.id}`}
                onClick={() => {
                  updateAppSoundPrefs({ soundPack: pack.id });
                  previewSoundPack(pack.id);
                  onNotify?.(`تم تفعيل طابع الصوت: ${pack.label}`);
                }}
                className="flex flex-col items-start justify-between rounded-xl border p-3 text-right transition-colors cursor-pointer min-h-[76px]"
                style={{
                  backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span
                    className="font-extrabold truncate"
                    style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}
                  >
                    {pack.label}
                  </span>
                  {active && (
                    <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  )}
                </div>
                <span
                  className="mt-1 text-[11px] leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {pack.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Notification Tone Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-extrabold">
            <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <span>نغمة صوت الإشعارات والتنبيهات</span>
          </span>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            تعمل مع التنبيهات والتحديثات الفورية
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {NOTIFICATION_TONE_OPTIONS.map((tone) => {
            const active = prefs.notificationTone === tone.id;
            return (
              <button
                key={tone.id}
                type="button"
                data-testid={`notification-tone-${tone.id}`}
                onClick={() => {
                  updateAppSoundPrefs({
                    notificationTone: tone.id,
                    notificationSoundEnabled: tone.id !== 'silent',
                  });
                  previewNotificationTone(tone.id);
                  onNotify?.(`تم تعيين نغمة الإشعارات: ${tone.label}`);
                }}
                className="flex flex-col items-start justify-between rounded-xl border p-3 text-right transition-colors cursor-pointer min-h-[72px]"
                style={{
                  backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <span
                    className="font-extrabold truncate"
                    style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}
                  >
                    {tone.label}
                  </span>
                </div>
                <span
                  className="mt-1 text-[11px] leading-snug"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {tone.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Channel Toggles & Effects Volume */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label
          className="flex min-h-[56px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: prefs.successErrorEnabled
              ? 'var(--accent)'
              : 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={prefs.successErrorEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              updateAppSoundPrefs({ successErrorEnabled: checked });
              if (checked) {
                playTactileFeedback('success', { sound: true, bypassPrefGate: true });
              }
            }}
          />
          <div>
            <div className="font-extrabold">أصوات النجاح والأخطاء</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              تأكيد العمليات والتنبيه عند الخطأ
            </div>
          </div>
        </label>

        <label
          className="flex min-h-[56px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: prefs.motionSoundsEnabled
              ? 'var(--accent)'
              : 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={prefs.motionSoundsEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              updateAppSoundPrefs({ motionSoundsEnabled: checked });
              if (checked) {
                playTactileFeedback('transition_slide', {
                  sound: true,
                  bypassPrefGate: true,
                });
              }
            }}
          />
          <div>
            <div className="font-extrabold">أصوات الانتقالات والحركة</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              فتح القوائم وتنقل الصفحات والسحب
            </div>
          </div>
        </label>

        <label
          className="flex min-h-[56px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor:
              prefs.notificationSoundEnabled && prefs.notificationTone !== 'silent'
                ? 'var(--accent)'
                : 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={prefs.notificationSoundEnabled && prefs.notificationTone !== 'silent'}
            onChange={(e) => {
              const checked = e.target.checked;
              updateAppSoundPrefs({
                notificationSoundEnabled: checked,
                notificationTone:
                  checked && prefs.notificationTone === 'silent'
                    ? 'chime_duet'
                    : prefs.notificationTone,
              });
              if (checked) {
                previewNotificationTone(
                  prefs.notificationTone === 'silent'
                    ? 'chime_duet'
                    : prefs.notificationTone
                );
              }
            }}
          />
          <div>
            <div className="font-extrabold">صوت الإشعارات</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              تنبيه صوتي مع الإشعارات والرسائل
            </div>
          </div>
        </label>

        <div
          className="flex min-h-[56px] flex-col justify-center gap-1.5 rounded-xl border px-3.5 py-2"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-extrabold">
              <Volume2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span>مستوى المؤثرات</span>
            </span>
            <span
              className="font-mono text-[11px] font-bold tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {Math.round(prefs.effectsVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            aria-label="مستوى صوت المؤثرات التفاعلية"
            value={Math.round(prefs.effectsVolume * 100)}
            onChange={(e) => {
              const nextVol = Number(e.target.value) / 100;
              updateAppSoundPrefs({ effectsVolume: nextVol });
            }}
            onPointerUp={() => {
              playTactileFeedback('tap', { sound: true, bypassPrefGate: true });
            }}
            className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
          />
        </div>
      </div>

      {/* 5. 8-Profile Sound Matrix Tester */}
      <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold">لوحة اختبار المؤثرات الفورية (8 نغمات معايرة)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-sound="success"
              onClick={() =>
                playTactileFeedback('success', {
                  sound: true,
                  haptic: true,
                  bypassPrefGate: true,
                })
              }
              className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--success)' }} />
              <span>النجاح</span>
            </button>
            <button
              type="button"
              data-sound="error"
              onClick={() =>
                playTactileFeedback('error', {
                  sound: true,
                  haptic: true,
                  bypassPrefGate: true,
                })
              }
              className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-[var(--danger)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <AlertCircle className="h-3 w-3" style={{ color: 'var(--danger)' }} />
              <span>الخطأ</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
          {SOUND_TEST_PROFILES.map((item) => (
            <button
              key={item.kind}
              type="button"
              data-sound={item.kind}
              onClick={() => {
                void resumeSharedAudioContext().then(() => {
                  playTactileFeedback(item.kind, {
                    sound: true,
                    haptic: true,
                    bypassPrefGate: true,
                  });
                });
              }}
              className="inline-flex h-9 items-center justify-center rounded-xl border px-2 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

