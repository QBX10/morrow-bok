import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Clock,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useAgencyStore } from '../../store/useAgencyStore';
import { useSound } from '../../audio/useSound';
import type { NotificationChannelKey } from '../../audio/SoundManager';

interface ChannelMeta {
  id: NotificationChannelKey;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: typeof ShieldAlert;
}

const CHANNEL_META: ChannelMeta[] = [
  {
    id: 'security',
    titleAr: 'تنبيهات الأمان والدخول',
    titleEn: 'Security & Sign-in Alerts',
    descAr: 'دخول من جهاز جديد أو تعديل مفاتيح الأمان (لا يمكن إسكات تنبيه الجهاز الجديد كلياً).',
    descEn: 'New-device alerts & key changes (new-device login always shows an in-app badge).',
    icon: ShieldAlert,
  },
  {
    id: 'reminders',
    titleAr: 'التذكيرات وإكمال المهام',
    titleEn: 'Reminders & Completions',
    descAr: 'تذكير المواعيد، حفظ الجداول، وانتهاء معالجة الذكاء الاصطناعي.',
    descEn: 'Task reminders, sheet saves, and completed AI runs.',
    icon: Bell,
  },
  {
    id: 'sync',
    titleAr: 'المزامنة بين الأجهزة',
    titleEn: 'Cross-Device Sync',
    descAr: 'إشعارات المزامنة الفورية أو تعارض الإصدارات أو انقطاع الشبكة.',
    descEn: 'Instant device sync confirmations and conflict warnings.',
    icon: RefreshCw,
  },
  {
    id: 'news',
    titleAr: 'الميزات والتحديثات',
    titleEn: 'Product Updates',
    descAr: 'اكتشاف الأدوات الجديدة والأنماط المضافة للمنصة.',
    descEn: 'New workflows and platform highlights.',
    icon: Sparkles,
  },
];

function AccessibleSwitch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="theme-control relative inline-flex h-[44px] w-[62px] shrink-0 items-center px-1.5 transition-colors"
    >
      <span
        className="flex h-7 w-full items-center border p-0.5 transition-colors"
        style={{
          borderRadius: 'var(--radius-control)',
          borderColor: checked ? 'var(--accent)' : 'var(--surface-border)',
          backgroundColor: checked ? 'var(--accent)' : 'var(--bg-input)',
        }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          className="h-5 w-5"
          style={{
            borderRadius: 'calc(var(--radius-control) * 0.65)',
            backgroundColor: checked ? 'var(--accent-fg)' : 'var(--text-muted)',
            marginInlineStart: checked ? 'auto' : '0px',
          }}
        />
      </span>
    </button>
  );
}

export function NotificationChannelManager() {
  const lang = useAgencyStore((s) => s.lang);
  const prefs = useAgencyStore((s) => s.notificationPrefs);
  const loading = useAgencyStore((s) => s.notificationPrefsLoading);
  const isOffline = useAgencyStore((s) => s.isOffline);
  const setChannel = useAgencyStore((s) => s.setChannel);
  const setQuietHours = useAgencyStore((s) => s.setQuietHours);
  const setMasterSound = useAgencyStore((s) => s.setMasterSound);
  const setVolumes = useAgencyStore((s) => s.setVolumes);
  const pushToast = useAgencyStore((s) => s.pushToast);
  const { play, playChannelNotify } = useSound();

  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [reauthSecret, setReauthSecret] = useState('');
  const [reauthError, setReauthError] = useState('');

  const isAr = lang === 'ar';

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading notification settings">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="theme-surface h-28 animate-pulse p-5"
            style={{ opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  const handleToggleChannelEnabled = (id: NotificationChannelKey) => {
    const currentlyEnabled = prefs.channels[id].enabled;
    if (id === 'security' && currentlyEnabled) {
      play('warning');
      setSecurityModalOpen(true);
      setReauthSecret('');
      setReauthError('');
      return;
    }
    play(currentlyEnabled ? 'toggle_off' : 'toggle_on');
    setChannel(id, { enabled: !currentlyEnabled });
  };

  const handleConfirmSecurityDisable = () => {
    if (reauthSecret.trim().length < 4) {
      play('error');
      setReauthError(
        isAr
          ? 'أدخل كلمة المرور أو رمز التحقق (4 أحرف على الأقل).'
          : 'Enter password or verification code (min 4 chars).'
      );
      return;
    }
    setChannel('security', { enabled: false, push: false });
    setSecurityModalOpen(false);
    play('warning');
    pushToast({
      title: isAr
        ? 'تم تقليل تنبيهات الأمان — تبقى شارة الجهاز الجديد مرئية دائماً'
        : 'Security channel reduced — new-device badge stays active',
      tone: 'warning',
    });
  };

  return (
    <div className="space-y-5">
      {/* Offline & Master Controls Strip */}
      <div className="theme-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center border"
            style={{
              borderRadius: 'var(--radius-control)',
              borderColor: 'var(--surface-border)',
              color: prefs.masterSound ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {prefs.masterSound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-sm font-bold">
              {isAr ? 'مفتاح الصوت الرئيسي والمزج' : 'Master Sound & Audio Mixer'}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isAr
                ? 'يتحكم بجميع المؤثرات والموسيقى الخلفية المعايرة على -23 LUFS.'
                : 'Controls all SFX sprites and -23 LUFS calibrated background loop.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isOffline && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: 'var(--warning)' }}
            >
              <WifiOff className="h-4 w-4" />
              <span>{isAr ? 'وضع غير متصل · حفظ محلي فوري' : 'Offline · Cached locally'}</span>
            </span>
          )}
          <AccessibleSwitch
            checked={prefs.masterSound}
            label={isAr ? 'تفعيل الصوت الرئيسي' : 'Toggle master sound'}
            onToggle={() => {
              const next = !prefs.masterSound;
              setMasterSound(next);
              play(next ? 'toggle_on' : 'toggle_off', { forceSound: next });
            }}
          />
        </div>
      </div>

      {/* Volume Sliders & Quiet Hours */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="theme-surface space-y-4 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">
              {isAr ? 'مستوى الموسيقى والمؤثرات' : 'Music & SFX Levels'}
            </span>
            <span className="text-xs tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {Math.round(prefs.volumes.music * 100)}% / {Math.round(prefs.volumes.sfx * 100)}%
            </span>
          </div>

          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{isAr ? 'الموسيقى الخلفية (تخفت إلى 40% مع SFX)' : 'Ambient Music (ducks to 40% on SFX)'}</span>
              <span className="tabular-nums">{Math.round(prefs.volumes.music * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volumes.music}
              onChange={(e) => setVolumes({ music: Number(e.target.value) })}
              className="h-2 w-full cursor-pointer accent-[var(--accent)]"
            />
          </label>

          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{isAr ? 'مؤثرات الواجهة والتنبيهات' : 'UI & Notification SFX'}</span>
              <span className="tabular-nums">{Math.round(prefs.volumes.sfx * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volumes.sfx}
              onChange={(e) => setVolumes({ sfx: Number(e.target.value) })}
              className="h-2 w-full cursor-pointer accent-[var(--accent)]"
            />
          </label>
        </div>

        <div className="theme-surface space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <div>
                <div className="text-sm font-bold">
                  {isAr ? 'ساعات الهدوء' : 'Quiet Hours'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'كتم تلقائي للإشعارات غير الحرجة' : 'Auto-silence non-critical channels'}
                </div>
              </div>
            </div>
            <AccessibleSwitch
              checked={prefs.quietHours.enabled}
              label={isAr ? 'تفعيل ساعات الهدوء' : 'Toggle quiet hours'}
              onToggle={() => {
                const next = !prefs.quietHours.enabled;
                setQuietHours({ enabled: next });
                play(next ? 'toggle_on' : 'toggle_off');
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'من الساعة' : 'Start'}</span>
              <input
                type="time"
                value={prefs.quietHours.start}
                onChange={(e) => setQuietHours({ start: e.target.value })}
                className="theme-control w-full border px-3 py-2 text-sm tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--surface-border)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'إلى الساعة' : 'End'}</span>
              <input
                type="time"
                value={prefs.quietHours.end}
                onChange={(e) => setQuietHours({ end: e.target.value })}
                className="theme-control w-full border px-3 py-2 text-sm tabular-nums"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--surface-border)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Card per Channel */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CHANNEL_META.map((ch) => {
          const cfg = prefs.channels[ch.id];
          const Icon = ch.icon;
          const isSecurity = ch.id === 'security';

          return (
            <motion.section
              key={ch.id}
              layout
              className="theme-surface flex flex-col justify-between gap-4 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center border"
                    style={{
                      borderRadius: 'var(--radius-control)',
                      borderColor: cfg.enabled ? 'var(--accent)' : 'var(--surface-border)',
                      color: cfg.enabled ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{isAr ? ch.titleAr : ch.titleEn}</h3>
                      {isSecurity && (
                        <Lock className="h-3.5 w-3.5" style={{ color: 'var(--warning)' }} />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {isAr ? ch.descAr : ch.descEn}
                    </p>
                  </div>
                </div>
                <AccessibleSwitch
                  checked={cfg.enabled}
                  label={isAr ? ch.titleAr : ch.titleEn}
                  onToggle={() => handleToggleChannelEnabled(ch.id)}
                />
              </div>

              <div
                className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
                style={{ borderColor: 'var(--surface-border)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {(['sound', 'haptic', 'push'] as const).map((flag) => {
                    const active = cfg[flag];
                    const labelMap = {
                      sound: isAr ? 'صوت' : 'Sound',
                      haptic: isAr ? 'اهتزاز' : 'Haptic',
                      push: isAr ? 'دفع' : 'Push',
                    };
                    return (
                      <button
                        key={flag}
                        type="button"
                        role="switch"
                        aria-checked={active}
                        disabled={!cfg.enabled && !isSecurity}
                        onClick={() => {
                          const nextVal = !active;
                          setChannel(ch.id, { [flag]: nextVal });
                          play(nextVal ? 'toggle_on' : 'toggle_off');
                        }}
                        className="theme-control border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40"
                        style={{
                          borderColor: active ? 'var(--accent)' : 'var(--surface-border)',
                          backgroundColor: active ? 'var(--accent)' : 'transparent',
                          color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                        }}
                      >
                        {labelMap[flag]}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playChannelNotify(ch.id, true);
                    pushToast({
                      title: isAr ? `تجربة: ${ch.titleAr}` : `Test: ${ch.titleEn}`,
                      tone: isSecurity ? 'warning' : 'info',
                    });
                  }}
                  className="theme-control border px-3 py-2 text-xs font-semibold whitespace-nowrap"
                  style={{
                    borderColor: 'var(--surface-border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {isAr ? 'اختبار الصوت' : 'Test sound'}
                </button>
              </div>
            </motion.section>
          );
        })}
      </div>

      {/* Security Disable Warning + Re-authentication Dialog */}
      <AnimatePresence>
        {securityModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="theme-surface-elevated w-full max-w-md space-y-4 p-6"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 shrink-0" style={{ color: 'var(--warning)' }} />
                <div>
                  <h4 className="text-base font-bold">
                    {isAr ? 'تأكيد أمني — تعديل تنبيهات الأمان' : 'Security Re-authentication Required'}
                  </h4>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {isAr
                      ? 'إيقاف صوت/دفع الأمان يتطلب إعادة التحقق. تنبيه الجهاز الجديد سيبقى ظاهراً كشارة داخل التطبيق دائماً.'
                      : 'Disabling security alerts requires re-auth. New-device login alerts always retain an in-app badge minimum.'}
                  </p>
                </div>
              </div>

              <input
                type="password"
                value={reauthSecret}
                onChange={(e) => {
                  setReauthSecret(e.target.value);
                  setReauthError('');
                }}
                placeholder={isAr ? 'كلمة المرور أو رمز التحقق...' : 'Password or passkey PIN...'}
                className="theme-control w-full border px-3 py-2.5 text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--surface-border)',
                }}
              />
              {reauthError && (
                <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
                  {reauthError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    play('close_panel');
                    setSecurityModalOpen(false);
                  }}
                  className="theme-control border px-4 py-2 text-xs font-semibold"
                  style={{ borderColor: 'var(--surface-border)' }}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSecurityDisable}
                  className="theme-control px-4 py-2 text-xs font-bold"
                  style={{ backgroundColor: 'var(--warning)', color: '#000' }}
                >
                  {isAr ? 'تأكيد وتعديل' : 'Confirm & Update'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
