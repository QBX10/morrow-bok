import React, { useSyncExternalStore } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Lock,
  Moon,
  Music,
  Music2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getSoundSystemDiagnostics,
  NOTIFICATION_TONE_OPTIONS,
  playTactileFeedback,
  previewNotificationTone,
  previewSoundPack,
  resumeSharedAudioContext,
  SOUND_PACK_OPTIONS,
  type TactileSoundKind,
} from '../../utils/tactileFeedback';
import {
  getBackgroundMusicSnapshot,
  subscribeBackgroundMusic,
} from '../../utils/backgroundMusicEngine';
import {
  audioManager,
  NOTIFICATION_CHANNELS_META,
  type NotificationChannelId,
} from '../../services/audio/AudioManager';

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
  const settings = useSyncExternalStore(
    audioManager.subscribe,
    audioManager.getSettings,
    audioManager.getSettings
  );
  const music = useSyncExternalStore(
    subscribeBackgroundMusic,
    getBackgroundMusicSnapshot,
    getBackgroundMusicSnapshot
  );

  const diag = getSoundSystemDiagnostics();
  const musicVolPct = Math.round(music.volume * 100);
  const quietNow = audioManager.isQuietHoursNow();

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
    ? `${music.pauseReasonLabel}${music.activeLockCount > 1 ? ` (+${music.activeLockCount - 1})` : ''}`
    : music.awaitingGesture
    ? 'تبدأ تلقائياً عند أول تفاعل'
    : music.volume <= 0.005
    ? 'مكتومة'
    : music.gaplessLoopActive
    ? 'متصلة بدون فاصل (-23 LUFS)'
    : 'تعمل بهدوء في الخلفية';

  const handleToggleChannel = (
    channelId: NotificationChannelId,
    checked: boolean
  ) => {
    if (channelId === 'security') return;
    audioManager.playEvent(checked ? 'toggle_on' : 'toggle_off', {
      bypassPrefGate: true,
    });
    audioManager.updateSettings(
      {
        channels: {
          ...settings.channels,
          [channelId]: checked,
          security: true,
        },
      },
      {
        showLocalToast: true,
        toastTitle: checked
          ? 'تم تفعيل قناة الإشعار والمزامنة عبر أجهزتك'
          : 'تم كتم قناة الإشعار والمزامنة عبر أجهزتك',
      }
    );
  };

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
            <span>استوديو الصوت المركزي والإشعارات</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            مدير صوت واحد يتحكم بالموسيقى الهادئة، التأثيرات، قنوات الإشعارات، وساعات الهدوء مع مزامنة فورية بين أجهزتك.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="sound-master-toggle"
            onClick={() => {
              const next = !settings.masterSoundEnabled;
              audioManager.updateSettings(
                { masterSoundEnabled: next },
                {
                  showLocalToast: true,
                  toastTitle: next
                    ? 'تم تفعيل منظومة الأصوات ومزامنتها'
                    : 'تم كتم أصوات التطبيق ومزامنتها',
                }
              );
              if (next) {
                void resumeSharedAudioContext().then(() => {
                  audioManager.playEvent('toggle_on', {
                    sound: true,
                    haptic: true,
                    bypassPrefGate: true,
                  });
                });
              }
              onNotify?.(
                next ? 'تم تفعيل منظومة الأصوات.' : 'تم كتم المؤثرات الصوتية للتطبيق.'
              );
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            style={{
              backgroundColor: settings.masterSoundEnabled
                ? 'var(--bg-nav-active)'
                : 'var(--bg-main)',
              borderColor: settings.masterSoundEnabled
                ? 'var(--accent)'
                : 'var(--border-color)',
              color: settings.masterSoundEnabled
                ? 'var(--accent)'
                : 'var(--text-muted)',
            }}
          >
            {settings.masterSoundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {settings.masterSoundEnabled ? 'الأصوات مفعّلة' : 'الأصوات مكتومة'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              void resumeSharedAudioContext().then(() => {
                audioManager.playEvent('success', {
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
                color:
                  diag.contextState === 'running'
                    ? 'var(--success)'
                    : 'var(--warning)',
              }}
            />
            <span className="tabular-nums">{engineStatusLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              audioManager.resetToDefaults(true);
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
              <Music
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span>موسيقى الخلفية والتوقف التلقائي</span>
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
                    audioManager.playEvent('click', { bypassPrefGate: true });
                    audioManager.retryMusic();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--accent)',
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {music.awaitingGesture ? 'تنشيط التشغيل' : 'إعادة المحاولة'}
                  </span>
                </button>
              )}

            <button
              type="button"
              onClick={() => {
                const nextMusicEnabled = music.userPaused;
                audioManager.playEvent(nextMusicEnabled ? 'toggle_on' : 'toggle_off', {
                  bypassPrefGate: true,
                });
                audioManager.updateSettings(
                  { musicEnabled: nextMusicEnabled },
                  {
                    showLocalToast: true,
                    toastTitle: nextMusicEnabled
                      ? 'تم تشغيل موسيقى الخلفية ومزامنة الإعداد'
                      : 'تم إيقاف موسيقى الخلفية ومزامنة الإعداد',
                  }
                );
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{
                backgroundColor: music.userPaused
                  ? 'var(--accent)'
                  : 'var(--bg-main)',
                borderColor: music.userPaused
                  ? 'var(--accent)'
                  : 'var(--border-color)',
                color: music.userPaused
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div
            className="flex flex-col justify-center gap-1.5 rounded-xl border px-3.5 py-2.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>
                مستوى صوت الخلفية (الافتراضي 20%)
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
                audioManager.updateSettings(
                  { musicVolume: nextVol },
                  { debounceSyncMs: 320, showLocalToast: false }
                );
              }}
              className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
            />
          </div>

          <label
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: music.smartModeEnabled
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <div>
              <div className="font-extrabold">التوقف الذكي (مايك / كاميرا / سماعة)</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                لا تعود الموسيقى إلا بعد انتهاء كل أسباب التوقف وخفض 40% مع التنبيهات
              </div>
            </div>
            <input
              type="checkbox"
              checked={music.smartModeEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                audioManager.playEvent(checked ? 'toggle_on' : 'toggle_off', {
                  bypassPrefGate: true,
                });
                audioManager.updateSettings(
                  { smartPauseEnabled: checked },
                  { showLocalToast: true }
                );
              }}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
          </label>

          <label
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: music.pauseOnExit
                ? 'var(--accent)'
                : 'var(--border-color)',
            }}
          >
            <div>
              <div className="font-extrabold">إيقاف الموسيقى عند الخروج من التطبيق</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                إيقاف تدريجي سريع عند تصغير النافذة والعودة بـ Fade In عند الرجوع
              </div>
            </div>
            <input
              type="checkbox"
              data-testid="music-pause-on-exit-toggle"
              checked={music.pauseOnExit}
              onChange={(e) => {
                const checked = e.target.checked;
                audioManager.playEvent(checked ? 'toggle_on' : 'toggle_off', {
                  bypassPrefGate: true,
                });
                audioManager.updateSettings(
                  { pauseOnExit: checked },
                  {
                    showLocalToast: true,
                    toastTitle: checked
                      ? 'تم تفعيل الإيقاف التلقائي عند الخروج'
                      : 'تم السماح باستمرار الخلفية خارج النافذة',
                  }
                );
              }}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
          </label>
        </div>
      </div>

      {/* 2. Integrated Notifications + 4 Channels + Quiet Hours */}
      <div
        className="space-y-3 border-b pb-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-extrabold">
              <Bell
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span>الإشعارات المتكاملة وقنوات التنبيه (4 قنوات)</span>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              تحكم مستقل لكل قناة إشعار، مع بقاء تنبيهات الأمان مفعّلة دائماً حتى أثناء ساعات الهدوء.
            </div>
          </div>

          <label
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 font-extrabold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: settings.notificationsMasterEnabled
                ? 'var(--bg-nav-active)'
                : 'var(--bg-main)',
              borderColor: settings.notificationsMasterEnabled
                ? 'var(--accent)'
                : 'var(--border-color)',
              color: settings.notificationsMasterEnabled
                ? 'var(--accent)'
                : 'var(--text-muted)',
            }}
          >
            <input
              type="checkbox"
              data-testid="notifications-master-toggle"
              checked={settings.notificationsMasterEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                audioManager.playEvent(checked ? 'toggle_on' : 'toggle_off', {
                  bypassPrefGate: true,
                });
                audioManager.updateSettings(
                  { notificationsMasterEnabled: checked },
                  {
                    showLocalToast: true,
                    toastTitle: checked
                      ? 'تم تشغيل قنوات الإشعارات'
                      : 'تم إيقاف القنوات الاختيارية (الأمان يظل نشطاً)',
                  }
                );
              }}
              className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
            />
            <span>إشعارات التطبيق العامة</span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {NOTIFICATION_CHANNELS_META.map((ch) => {
            const enabled =
              ch.id === 'security' ? true : Boolean(settings.channels[ch.id]);
            const effectiveActive =
              ch.id === 'security' ||
              (settings.notificationsMasterEnabled && enabled);
            return (
              <label
                key={ch.id}
                data-testid={`notification-channel-${ch.id}`}
                className={`flex flex-col justify-between gap-2 rounded-xl border p-3 transition-colors ${
                  ch.locked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-[var(--accent)]'
                }`}
                style={{
                  backgroundColor: effectiveActive
                    ? 'var(--bg-main)'
                    : 'var(--bg-surface)',
                  borderColor: ch.locked
                    ? 'var(--accent)'
                    : effectiveActive
                    ? 'var(--border-color)'
                    : 'var(--border-color)',
                  opacity:
                    !ch.locked && !settings.notificationsMasterEnabled ? 0.65 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-extrabold">
                    {ch.locked ? (
                      <ShieldCheck
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                    ) : null}
                    <span>{ch.label}</span>
                  </div>
                  {ch.locked ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap shrink-0"
                      style={{ color: 'var(--accent)' }}
                      title="قناة الأمان إلزامية ومقفلة"
                    >
                      <Lock className="h-3 w-3 shrink-0" />
                      <span>مقفلة ON</span>
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={!settings.notificationsMasterEnabled}
                      onChange={(e) =>
                        handleToggleChannel(ch.id, e.target.checked)
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                    />
                  )}
                </div>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {ch.description}
                </p>
              </label>
            );
          })}
        </div>

        {/* Quiet Hours */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: settings.quietHoursEnabled
              ? 'var(--accent)'
              : 'var(--border-color)',
          }}
        >
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 font-extrabold">
              <Moon
                className="h-3.5 w-3.5 shrink-0"
                style={{
                  color: quietNow ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              />
              <span>ساعات الهدوء (Quiet Hours)</span>
              {quietNow && (
                <span
                  className="text-[10px] font-bold"
                  style={{ color: 'var(--accent)' }}
                >
                  — نشطة الآن (الأمان فقط يعمل بصوت)
                </span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              خلال هذا الوقت تنكتم أصوات كل القنوات والمؤثرات عدا تنبيهات الأمان الحرجة.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                من
              </span>
              <input
                type="time"
                aria-label="بداية ساعات الهدوء"
                data-testid="quiet-hours-start"
                value={settings.quietHoursStart}
                onChange={(e) => {
                  audioManager.updateSettings(
                    { quietHoursStart: e.target.value },
                    { showLocalToast: true, toastTitle: 'تم تحديث وقت بداية الهدوء' }
                  );
                }}
                className="h-8 rounded-lg border px-2 text-xs font-mono"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                إلى
              </span>
              <input
                type="time"
                aria-label="نهاية ساعات الهدوء"
                data-testid="quiet-hours-end"
                value={settings.quietHoursEnd}
                onChange={(e) => {
                  audioManager.updateSettings(
                    { quietHoursEnd: e.target.value },
                    { showLocalToast: true, toastTitle: 'تم تحديث وقت نهاية الهدوء' }
                  );
                }}
                className="h-8 rounded-lg border px-2 text-xs font-mono"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 font-extrabold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: settings.quietHoursEnabled
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                data-testid="quiet-hours-toggle"
                checked={settings.quietHoursEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  audioManager.playEvent(checked ? 'toggle_on' : 'toggle_off', {
                    bypassPrefGate: true,
                  });
                  audioManager.updateSettings(
                    { quietHoursEnabled: checked },
                    {
                      showLocalToast: true,
                      toastTitle: checked
                        ? 'تم تفعيل ساعات الهدوء ومزامنتها'
                        : 'تم إيقاف ساعات الهدوء ومزامنتها',
                    }
                  );
                }}
                className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
              />
              <span>{settings.quietHoursEnabled ? 'مفعّلة' : 'معطّلة'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Sound Pack Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-extrabold">
            <Music2
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--accent)' }}
            />
            <span>طابع أصوات التطبيق والانتقالات</span>
          </span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            انقر لاختيار ومعاينة الطابع الصوتي
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SOUND_PACK_OPTIONS.map((pack) => {
            const active = settings.soundPack === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                data-testid={`sound-pack-${pack.id}`}
                onClick={() => {
                  audioManager.updateSettings(
                    { soundPack: pack.id },
                    { showLocalToast: false }
                  );
                  previewSoundPack(pack.id);
                  onNotify?.(`تم تفعيل طابع الصوت: ${pack.label}`);
                }}
                className="flex flex-col items-start justify-between rounded-xl border p-3 text-right transition-colors cursor-pointer min-h-[76px]"
                style={{
                  backgroundColor: active
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span
                    className="font-extrabold truncate"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {pack.label}
                  </span>
                  {active && (
                    <Sparkles
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--accent)' }}
                    />
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

      {/* 4. Notification Tone Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-extrabold">
            <Bell
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--accent)' }}
            />
            <span>نغمة صوت الإشعارات والتنبيهات</span>
          </span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            تنزل معها الموسيقى إلى 40% تلقائياً
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {NOTIFICATION_TONE_OPTIONS.map((tone) => {
            const active = settings.notificationTone === tone.id;
            return (
              <button
                key={tone.id}
                type="button"
                data-testid={`notification-tone-${tone.id}`}
                onClick={() => {
                  audioManager.updateSettings(
                    {
                      notificationTone: tone.id,
                      notificationSoundEnabled: tone.id !== 'silent',
                    },
                    { showLocalToast: false }
                  );
                  previewNotificationTone(tone.id);
                  onNotify?.(`تم تعيين نغمة الإشعارات: ${tone.label}`);
                }}
                className="flex flex-col items-start justify-between rounded-xl border p-3 text-right transition-colors cursor-pointer min-h-[72px]"
                style={{
                  backgroundColor: active
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <span
                    className="font-extrabold truncate"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                    }}
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

      {/* 5. SFX Category Toggles & Volume */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label
          className="flex min-h-[56px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: settings.successErrorEnabled
              ? 'var(--accent)'
              : 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={settings.successErrorEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              audioManager.updateSettings(
                { successErrorEnabled: checked },
                { showLocalToast: false }
              );
              if (checked) {
                audioManager.playEvent('success', {
                  sound: true,
                  bypassPrefGate: true,
                });
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
            borderColor: settings.motionSoundsEnabled
              ? 'var(--accent)'
              : 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={settings.motionSoundsEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              audioManager.updateSettings(
                { motionSoundsEnabled: checked },
                { showLocalToast: false }
              );
              if (checked) {
                audioManager.playEvent('route_shift', {
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
              settings.notificationSoundEnabled &&
              settings.notificationTone !== 'silent'
                ? 'var(--accent)'
                : 'var(--border-color)',
          }}
        >
          <input
            type="checkbox"
            checked={
              settings.notificationSoundEnabled &&
              settings.notificationTone !== 'silent'
            }
            onChange={(e) => {
              const checked = e.target.checked;
              const nextTone =
                checked && settings.notificationTone === 'silent'
                  ? 'chime_duet'
                  : settings.notificationTone;
              audioManager.updateSettings(
                {
                  notificationSoundEnabled: checked,
                  notificationTone: nextTone,
                },
                { showLocalToast: false }
              );
              if (checked) {
                previewNotificationTone(nextTone);
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
              <Volume2
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span>مستوى المؤثرات</span>
            </span>
            <span
              className="font-mono text-[11px] font-bold tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {Math.round(settings.effectsVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            aria-label="مستوى صوت المؤثرات التفاعلية"
            value={Math.round(settings.effectsVolume * 100)}
            onChange={(e) => {
              const nextVol = Number(e.target.value) / 100;
              audioManager.updateSettings(
                { effectsVolume: nextVol },
                { debounceSyncMs: 320, showLocalToast: false }
              );
            }}
            onPointerUp={() => {
              audioManager.playEvent('click', { sound: true, bypassPrefGate: true });
            }}
            className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
          />
        </div>
      </div>

      {/* 6. 8-Profile Sound Matrix Tester */}
      <div
        className="pt-3 border-t space-y-2.5"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold">
            لوحة اختبار المؤثرات الفورية (حد صوتين متزامنين + أولوية وتهدئة)
          </span>
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
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <CheckCircle2
                className="h-3 w-3"
                style={{ color: 'var(--success)' }}
              />
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
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <AlertCircle
                className="h-3 w-3"
                style={{ color: 'var(--danger)' }}
              />
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
