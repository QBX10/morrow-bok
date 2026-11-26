import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Flashlight,
  Key,
  Laptop,
  Mic,
  MicOff,
  Music,
  Radar,
  Send,
  Shield,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { TheCoreOrb } from '../core/TheCoreOrb';
import { useAgencyStore } from '../../store/useAgencyStore';
import { MODE_LIST } from '../../theme/tokens';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';
import { NotificationChannelManager } from '../notifications/NotificationChannelManager';
import { useSound } from '../../audio/useSound';

export function AssistantFullScreenView() {
  const lang = useAgencyStore((s) => s.lang);
  const coreState = useAgencyStore((s) => s.coreState);
  const turns = useAgencyStore((s) => s.assistantTurns);
  const setCoreState = useAgencyStore((s) => s.setCoreState);
  const sendAssistantPrompt = useAgencyStore((s) => s.sendAssistantPrompt);
  const goBack = useAgencyStore((s) => s.goBack);
  const { play, addPauseReason, removePauseReason } = useSound();

  const [input, setInput] = useState('');
  const [micActive, setMicActive] = useState(false);
  const isAr = lang === 'ar';

  const toggleMic = () => {
    const next = !micActive;
    setMicActive(next);
    if (next) {
      play('mic_open');
      addPauseReason('mic');
      setCoreState('listening');
    } else {
      play('mic_close');
      removePauseReason('mic');
      setCoreState('idle');
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="theme-surface flex flex-col items-center gap-4 p-6 text-center">
        <TheCoreOrb state={coreState} size="lg" onClick={toggleMic} />
        <div>
          <h1 className="theme-display-heading text-2xl font-bold">
            {isAr ? 'المساعد المركزي (THE CORE)' : 'THE CORE — AI Assistant'}
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {coreState === 'listening'
              ? isAr
                ? 'وضع الاستماع الصوتي نشط — أوقفت الموسيقى الخلفية تلقائياً.'
                : 'Voice listening active — ambient music paused cleanly.'
              : coreState === 'thinking'
              ? isAr
                ? 'جاري التحليل وتوليد الإجابة...'
                : 'Analyzing and synthesizing...'
              : isAr
              ? 'اسأل عن جداولك، صيغ الحساب، أو التحكم بالنظام.'
              : 'Ask about your spreadsheets, formulas, or workspace state.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            className="theme-control inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold"
            style={{
              borderColor: micActive ? 'var(--accent)' : 'var(--surface-border)',
              backgroundColor: micActive ? 'var(--accent)' : 'transparent',
              color: micActive ? 'var(--accent-fg)' : 'var(--text-primary)',
            }}
          >
            {micActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>{micActive ? (isAr ? 'إيقاف المايك' : 'Stop Mic') : (isAr ? 'تحدث صوتياً' : 'Voice Input')}</span>
          </button>
          <button
            type="button"
            onClick={goBack}
            className="theme-control border px-4 py-2 text-xs font-semibold"
            style={{ borderColor: 'var(--surface-border)' }}
          >
            {isAr ? 'تصغير النواة' : 'Minimize Core'}
          </button>
        </div>
      </div>

      {/* Conversation History */}
      <div className="space-y-3">
        {turns.map((turn) => (
          <motion.div
            key={turn.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`theme-surface p-4 text-sm leading-relaxed ${
              turn.role === 'user' ? 'ms-8 border-[var(--accent)]' : 'me-8'
            }`}
          >
            <div className="mb-1 text-xs font-bold" style={{ color: 'var(--accent)' }}>
              {turn.role === 'user' ? (isAr ? 'أنت' : 'You') : 'THE CORE'} · {turn.timestamp}
            </div>
            <div>{turn.text}</div>
          </motion.div>
        ))}
      </div>

      {/* Prompt Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendAssistantPrompt(input);
          setInput('');
        }}
        className="theme-surface-elevated flex items-center gap-2 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isAr ? 'اكتب طلبك للنواة الذكية...' : 'Message THE CORE...'}
          className="min-h-[44px] flex-1 bg-transparent px-3 text-sm outline-none"
        />
        <button
          type="submit"
          className="theme-control inline-flex items-center gap-2 px-4 py-2 text-xs font-bold"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          <Send className="h-4 w-4" />
          <span>{isAr ? 'إرسال' : 'Send'}</span>
        </button>
      </form>
    </div>
  );
}

export function ModesScreenView() {
  const lang = useAgencyStore((s) => s.lang);
  const activeMode = useAgencyStore((s) => s.notificationPrefs.activeMode);
  const setMode = useAgencyStore((s) => s.setMode);
  const isAr = lang === 'ar';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="theme-display-heading text-2xl font-bold">
          {isAr ? 'الأنماط التشغيلية والمظهر' : 'Operational Modes & Themes'}
        </h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {isAr
            ? 'اختر نمطاً لإطلاق موجة لونية شعاعية من نقطة اللمس وتغيير الإضاءة والمزاج الصوتي.'
            : 'Tap any mode to trigger a radial shockwave re-theming accent glow and sound mood.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODE_LIST.map((m) => {
          const active = activeMode === m.id;
          return (
            <motion.button
              key={m.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={(e) => setMode(m.id, { x: e.clientX, y: e.clientY })}
              className="theme-surface flex flex-col justify-between p-5 text-start"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--surface-border)',
                boxShadow: active ? '0 0 24px var(--accent-glow)' : undefined,
              }}
            >
              <div>
                <div className="text-base font-bold">{isAr ? m.labelAr : m.labelEn}</div>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? m.descAr : m.descEn}
                </p>
              </div>
              <div
                className="mt-4 text-xs font-bold"
                style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {active ? (isAr ? 'نشط الآن' : 'ACTIVE') : (isAr ? 'تفعيل النمط' : 'Activate')}
              </div>
            </motion.button>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="theme-display-heading text-lg font-bold">
          {isAr ? 'اختيار الثيم المتزامن' : 'Synced Design Themes'}
        </h2>
        <ThemeSwitcher />
      </section>
    </div>
  );
}

export function DevicesSyncScreenView() {
  const lang = useAgencyStore((s) => s.lang);
  const devices = useAgencyStore((s) => s.devices);
  const dismissNewDeviceAlert = useAgencyStore((s) => s.dismissNewDeviceAlert);
  const revokeDevice = useAgencyStore((s) => s.revokeDevice);
  const isOffline = useAgencyStore((s) => s.isOffline);
  const isAr = lang === 'ar';

  const newDevice = devices.find((d) => d.isNewAlert);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="theme-display-heading text-2xl font-bold">
          {isAr ? 'الأجهزة والمزامنة المعزولة' : 'Devices & Isolated Sync'}
        </h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {isOffline
            ? isAr
              ? 'الشبكة مقطوعة: يتم حفظ التعديلات في IndexedDB ورفعها فور العودة.'
              : 'Offline: Edits cached locally and replayed automatically on reconnect.'
            : isAr
            ? 'مزامنة فورية مشفّرة بين أجهزة هذا الحساب فقط.'
            : 'Real-time encrypted sync strictly isolated to this account.'}
        </p>
      </div>

      {/* Radar Ping Alert for New Device Login */}
      {newDevice && (
        <div
          className="theme-surface relative overflow-hidden p-5"
          style={{ borderColor: 'var(--warning)' }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                <motion.span
                  animate={{ scale: [0.8, 1.8], opacity: [0.75, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="absolute inset-0"
                  style={{
                    borderRadius: '9999px',
                    border: '2px solid var(--warning)',
                  }}
                />
                <Radar className="h-6 w-6" style={{ color: 'var(--warning)' }} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--warning)' }}>
                  {isAr ? 'نبضة رادار: تسجيل دخول من جهاز جديد' : 'Radar Ping: New Device Sign-In'}
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? newDevice.nameAr : newDevice.nameEn} · {newDevice.location}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={dismissNewDeviceAlert}
                className="theme-control inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--surface-border)' }}
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
                <span>{isAr ? 'هذا جهازي' : 'Trust Device'}</span>
              </button>
              <button
                type="button"
                onClick={() => revokeDevice(newDevice.id)}
                className="theme-control inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
              >
                <Trash2 className="h-4 w-4" />
                <span>{isAr ? 'طرد عن بُعد' : 'Revoke'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Devices List */}
      <div className="space-y-3">
        {devices.map((dev) => (
          <div
            key={dev.id}
            className="theme-surface flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="flex items-center gap-3">
              {dev.platform === 'mobile' ? (
                <Smartphone className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              ) : (
                <Laptop className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              )}
              <div>
                <div className="text-sm font-bold">
                  {isAr ? dev.nameAr : dev.nameEn}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {dev.location} · {dev.lastActive}
                </div>
              </div>
            </div>

            {!dev.current ? (
              <button
                type="button"
                onClick={() => revokeDevice(dev.id)}
                className="theme-control border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                {isAr ? 'تسجيل خروج عن بُعد' : 'Remote Sign Out'}
              </button>
            ) : (
              <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>
                {isAr ? 'الجلسة الحالية' : 'Current'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SoundNotificationsScreenView() {
  const lang = useAgencyStore((s) => s.lang);
  const {
    musicPlaying,
    toggleMusic,
    pauseReasons,
    toggleFlashlight,
    flashlightOn,
    flashlightMode,
  } = useSound();
  const isAr = lang === 'ar';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="theme-display-heading text-2xl font-bold">
            {isAr ? 'الصوت المركزي وقنوات الإشعارات' : 'Sound System & Notifications'}
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {isAr
              ? 'مدير صوت موحّد، موسيقى -23 LUFS تخفت عند التنبيهات، ومصباح سريع.'
              : 'Central SoundManager, -23 LUFS gapless music with 40% ducking & torch control.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleMusic}
            className="theme-control inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold"
            style={{
              borderColor: musicPlaying ? 'var(--accent)' : 'var(--surface-border)',
              color: musicPlaying ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            <Music className="h-4 w-4" />
            <span>
              {musicPlaying
                ? isAr
                  ? 'إيقاف الموسيقى'
                  : 'Pause Music'
                : isAr
                ? 'تشغيل الموسيقى'
                : 'Play Music'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void toggleFlashlight()}
            className="theme-control inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold"
            style={{
              borderColor: flashlightOn ? 'var(--warning)' : 'var(--surface-border)',
              backgroundColor: flashlightOn ? 'var(--warning)' : 'transparent',
              color: flashlightOn ? '#000' : 'var(--text-primary)',
            }}
          >
            <Flashlight className="h-4 w-4" />
            <span>
              {flashlightOn
                ? isAr
                  ? `إطفاء المصباح (${flashlightMode})`
                  : `Torch ON (${flashlightMode})`
                : isAr
                ? 'تشغيل المصباح'
                : 'Flashlight'}
            </span>
          </button>
        </div>
      </div>

      {/* Active Pause Reasons Banner */}
      {pauseReasons.length > 0 && (
        <div
          className="theme-surface p-3 text-xs font-semibold"
          style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
        >
          {isAr
            ? `أسباب التوقف التلقائي للموسيقى: ${pauseReasons.join(' · ')}`
            : `Active pause locks: ${pauseReasons.join(' · ')}`}
        </div>
      )}

      {/* Screen-glow Torch Fallback Strip when Hardware Torch Unavailable */}
      {flashlightOn && flashlightMode === 'screen_glow' && (
        <div
          className="theme-surface flex items-center justify-between p-5"
          style={{ backgroundColor: '#FFFBEB', color: '#1A1612' }}
        >
          <span className="text-sm font-bold">
            {isAr
              ? 'إضاءة الشاشة البديلة نشطة (فلاش الجهاز غير متاح على هذا المتصفح).'
              : 'Soft screen torch active (hardware camera torch unavailable on this device).'}
          </span>
          <button
            type="button"
            onClick={() => void toggleFlashlight()}
            className="theme-control border border-black/30 px-4 py-2 text-xs font-bold"
          >
            {isAr ? 'إغلاق' : 'Turn Off'}
          </button>
        </div>
      )}

      <NotificationChannelManager />
    </div>
  );
}

export function SecurityScreenView() {
  const lang = useAgencyStore((s) => s.lang);
  const userEmail = useAgencyStore((s) => s.userEmail);
  const authMethod = useAgencyStore((s) => s.authMethod);
  const pushToast = useAgencyStore((s) => s.pushToast);
  const signOutUser = useAgencyStore((s) => s.signOutUser);
  const { play } = useSound();
  const [codes] = useState(['MRW-8821-K9', 'MRW-4019-P2', 'MRW-9304-Z7', 'MRW-1765-Q4']);
  const isAr = lang === 'ar';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="theme-display-heading text-2xl font-bold">
          {isAr ? 'الأمان ومفاتيح الاسترجاع' : 'Security & Recovery'}
        </h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {userEmail} · {authMethod || 'passkey'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="theme-surface space-y-3 p-5">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-bold">
              {isAr ? 'حماية ربط الحسابات وإعادة التحقق' : 'Account Linking & Re-auth'}
            </h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {isAr
              ? 'لا يُدمج مزوّد خارجي إلا بعد تأكيد ملكية البريد، وتُطلب إعادة المصادقة عند تعطيل قنوات الأمان.'
              : 'External OAuth links strictly require verified email ownership and re-auth before critical changes.'}
          </p>
          <button
            type="button"
            onClick={() => {
              play('success');
              pushToast({
                title: isAr ? 'تم فحص سلامة الحساب والعزل' : 'Account isolation verified',
                tone: 'success',
              });
            }}
            className="theme-control border px-4 py-2 text-xs font-bold"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            {isAr ? 'فحص الأمان الآن' : 'Run Security Check'}
          </button>
        </div>

        <div className="theme-surface space-y-3 p-5">
          <div className="flex items-center gap-2.5">
            <Key className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-bold">
              {isAr ? 'رموز الاسترجاع الاحتياطية' : 'Recovery Codes'}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2" dir="ltr">
            {codes.map((c) => (
              <div
                key={c}
                className="border px-3 py-2 text-center text-xs font-bold tabular-nums"
                style={{
                  borderRadius: 'var(--radius-control)',
                  borderColor: 'var(--surface-border)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={signOutUser}
          className="theme-control border px-5 py-2.5 text-xs font-bold"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {isAr ? 'تسجيل الخروج من هذا الجهاز' : 'Sign Out This Device'}
        </button>
      </div>
    </div>
  );
}
