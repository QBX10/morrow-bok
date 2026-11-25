import React, { useSyncExternalStore } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Music2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  getAppSoundPrefs,
  NOTIFICATION_TONE_OPTIONS,
  playTactileFeedback,
  previewNotificationTone,
  previewSoundPack,
  resetAppSoundPrefs,
  SOUND_PACK_OPTIONS,
  subscribeAppSoundPrefs,
  updateAppSoundPrefs,
} from '../../utils/tactileFeedback';

interface SoundCustomizationPanelProps {
  onNotify?: (msg: string) => void;
}

export const SoundCustomizationPanel: React.FC<SoundCustomizationPanelProps> = ({
  onNotify,
}) => {
  const prefs = useSyncExternalStore(
    subscribeAppSoundPrefs,
    getAppSoundPrefs,
    getAppSoundPrefs
  );

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5 space-y-5 text-xs"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Header + Test & Reset Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5" style={{ borderColor: 'var(--border-color)' }}>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <SlidersHorizontal className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>تخصيص الأصوات ونغمات الإشعارات</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            اختر طابع الأصوات العام، نغمة الإشعارات، وأصوات النجاح والأخطاء والانتقالات في كامل التطبيق.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
            <span>اختبار النجاح</span>
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
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-[var(--danger)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <AlertCircle className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
            <span>اختبار الخطأ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetAppSoundPrefs();
              playTactileFeedback('save_complete', {
                sound: true,
                haptic: true,
                bypassPrefGate: true,
              });
              onNotify?.('تمت استعادة إعدادات الأصوات والإشعارات الافتراضية.');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>افتراضي</span>
          </button>
        </div>
      </div>

      {/* 1. Sound Pack Selector (تغيير أصوات التطبيق) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-extrabold">
            <Music2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
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

      {/* 2. Notification Tone Selector (تغيير صوت الإشعارات) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-extrabold">
            <Bell className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
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

      {/* 3. Channel Toggles & Effects Volume */}
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
              <Volume2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
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
    </div>
  );
};
