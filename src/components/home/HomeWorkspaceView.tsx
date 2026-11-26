import { motion } from 'framer-motion';
import {
  Bell,
  Fingerprint,
  Laptop,
  Layers,
  ShieldAlert,
  Sparkles,
  Table2,
} from 'lucide-react';
import { useAgencyStore } from '../../store/useAgencyStore';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';
import { TheCoreOrb } from '../core/TheCoreOrb';
import { useSound } from '../../audio/useSound';
import { MODES, THEMES } from '../../theme/tokens';

export function HomeWorkspaceView() {
  const lang = useAgencyStore((s) => s.lang);
  const activeTheme = useAgencyStore((s) => s.notificationPrefs.activeTheme);
  const activeMode = useAgencyStore((s) => s.notificationPrefs.activeMode);
  const coreState = useAgencyStore((s) => s.coreState);
  const sheets = useAgencyStore((s) => s.sheets);
  const devices = useAgencyStore((s) => s.devices);
  const newDeviceBadgeCount = useAgencyStore((s) => s.newDeviceBadgeCount);
  const userDisplayName = useAgencyStore((s) => s.userDisplayName);
  const navigate = useAgencyStore((s) => s.navigate);
  const { play } = useSound();

  const isAr = lang === 'ar';
  const theme = THEMES[activeTheme];
  const mode = MODES[activeMode];

  const isTerminal = activeTheme === 'terminal_brutalist';
  const isPaper = activeTheme === 'solar_paper';
  const isBento = activeTheme === 'aurora_bento';

  const quickActions = [
    {
      id: 'assistant' as const,
      titleAr: 'المساعد الكامل (THE CORE)',
      titleEn: 'AI Assistant Core',
      descAr: `${coreState === 'idle' ? 'متصل وجاهز' : coreState}`,
      icon: Sparkles,
      bentoClass: 'bento-tile-violet',
    },
    {
      id: 'sheets' as const,
      titleAr: 'جداول العمل المكانية',
      titleEn: 'Spatial Sheets',
      descAr: `${sheets.length} ${isAr ? 'جداول نشطة' : 'active sheets'}`,
      icon: Table2,
      bentoClass: 'bento-tile-teal',
    },
    {
      id: 'modes' as const,
      titleAr: 'الأنماط والثيمات',
      titleEn: 'Modes & Themes',
      descAr: isAr ? mode.labelAr : mode.labelEn,
      icon: Layers,
      bentoClass: 'bento-tile-amber',
    },
    {
      id: 'sound_notifications' as const,
      titleAr: 'الصوت والإشعارات',
      titleEn: 'Sound & Alerts',
      descAr: isAr ? 'قنوات + -23 LUFS' : 'Channels + -23 LUFS',
      icon: Bell,
      bentoClass: 'bento-tile-coral',
    },
  ];

  return (
    <div className="space-y-6">
      {/* New-Device Non-Silent In-App Radar Alert Minimum */}
      {newDeviceBadgeCount > 0 && (
        <motion.button
          type="button"
          onClick={() => {
            play('notify_security');
            navigate('devices');
          }}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="theme-surface flex w-full items-center justify-between gap-3 border px-4 py-3 text-start"
          style={{ borderColor: 'var(--warning)' }}
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div className="text-xs font-semibold">
              {isAr
                ? `تنبيه رادار أمني: رُصد دخول من جهاز جديد غير موثوق (${newDeviceBadgeCount})`
                : `Radar Alert: New untrusted sign-in detected (${newDeviceBadgeCount})`}
            </div>
          </div>
          <span
            className="text-xs font-bold whitespace-nowrap"
            style={{ color: 'var(--warning)' }}
          >
            {isAr ? 'فحص الجهاز' : 'Inspect'}
          </span>
        </motion.button>
      )}

      {/* Theme-Adaptive Hero Section */}
      {isTerminal ? (
        <section className="theme-surface space-y-3 p-5">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            +---[ MORROW_OS // MODE:{activeMode.toUpperCase()} // USER:{userDisplayName} ]---+
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>
                &gt; WORKSPACE_READY <span className="terminal-cursor" />
              </h1>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                SHEETS={sheets.length} | DEVICES={devices.length} | AUDIO=-23LUFS | SYNC=E2E_ISOLATED
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('sheet_editor')}
              className="theme-control border px-4 py-2 text-xs font-bold"
              style={{
                borderColor: 'var(--accent)',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              [ OPEN_ACTIVE_SHEET ]
            </button>
          </div>
        </section>
      ) : isPaper ? (
        <section className="theme-surface grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <div className="space-y-2 md:col-span-8">
            <div
              className="text-xs tracking-wide"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
            >
              FOLIO 01 · {isAr ? mode.labelAr : mode.labelEn}
            </div>
            <h1 className="theme-display-heading text-3xl font-bold">
              {isAr ? `مرحباً ${userDisplayName} — طاولة العمل الهندسية` : `Welcome ${userDisplayName} — Drafting Desk`}
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {isAr ? mode.descAr : mode.descEn}
            </p>
          </div>
          <aside
            className="flex flex-col justify-between border-s ps-4 text-xs md:col-span-4"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}
          >
            <div>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {isAr ? 'ملاحظات الهامش' : 'Margin Note'}
              </div>
              <p className="mt-1">
                {isAr
                  ? `الجدول النشط: ${sheets[0]?.titleAr} · الأجهزة: ${devices.length}`
                  : `Active sheet: ${sheets[0]?.titleEn} · Devices: ${devices.length}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('assistant')}
              className="theme-control mt-3 border px-4 py-2 text-xs font-bold"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' }}
            >
              {isAr ? 'توسيع النواة الذكية' : 'Expand Core'}
            </button>
          </aside>
        </section>
      ) : (
        <section
          className={`theme-surface relative overflow-hidden p-6 ${isBento ? 'bento-tile-violet' : ''}`}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                <span>{isAr ? theme.nameAr : theme.nameEn}</span>
                <span aria-hidden="true">·</span>
                <span>{isAr ? mode.labelAr : mode.labelEn}</span>
              </div>
              <h1 className={`theme-display-heading font-bold ${isBento ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                {isAr ? `أهلاً ${userDisplayName}` : `Welcome, ${userDisplayName}`}
              </h1>
              <p className="max-w-xl text-sm" style={{ color: 'var(--text-muted)' }}>
                {isAr ? mode.descAr : mode.descEn}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <TheCoreOrb state={coreState} size="lg" onClick={() => navigate('assistant')} />
            </div>
          </div>
        </section>
      )}

      {/* Bento / Grid Quick Destinations */}
      <div
        className={`grid gap-4 ${
          isBento
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            : isTerminal
            ? 'grid-cols-1 md:grid-cols-4 gap-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {quickActions.map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.975 }}
              transition={{ type: 'spring', ...theme.springConfig }}
              onClick={() => navigate(item.id)}
              className={`theme-surface flex flex-col justify-between p-5 text-start ${
                isBento ? item.bentoClass : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                <span
                  className="text-xs tabular-nums"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  -&gt;
                </span>
              </div>
              <div className="mt-4">
                <div className={`font-bold ${isBento ? 'text-lg' : 'text-sm'}`}>
                  {isAr ? item.titleAr : item.titleEn}
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {item.descAr}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Quick Secondary Bar: Devices, Security, Auth Scan */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => navigate('devices')}
          className="theme-surface flex items-center justify-between p-4 text-start"
        >
          <div className="flex items-center gap-3">
            <Laptop className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="text-sm font-bold">{isAr ? 'الأجهزة والمزامنة' : 'Devices & Sync'}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {devices.length} {isAr ? 'أجهزة مرتبطة' : 'linked'}
              </div>
            </div>
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
            {newDeviceBadgeCount > 0 ? `! ${newDeviceBadgeCount}` : 'OK'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('security')}
          className="theme-surface flex items-center justify-between p-4 text-start"
        >
          <div className="flex items-center gap-3">
            <Fingerprint className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="text-sm font-bold">{isAr ? 'الأمان ومفاتيح Passkey' : 'Security & Passkeys'}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isAr ? 'رموز الاسترجاع والعزل' : 'Recovery & Isolation'}
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('signin')}
          className="theme-surface flex items-center justify-between p-4 text-start"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="text-sm font-bold">{isAr ? 'شاشة الدخول والمسح' : 'Scan Auth & OTP'}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isAr ? 'تجربة Passkey / 6-OTP' : 'Passkey / 6-segment OTP'}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Live 4-Theme Preview Switcher */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="theme-display-heading text-lg font-bold">
            {isAr ? 'مبدّل الثيمات الحي (4 هويات متكاملة)' : 'Live 4-Theme Switcher'}
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isAr ? 'يتزامن اختيارك مع كل أجهزتك' : 'Synced across devices'}
          </span>
        </div>
        <ThemeSwitcher />
      </section>
    </div>
  );
}
